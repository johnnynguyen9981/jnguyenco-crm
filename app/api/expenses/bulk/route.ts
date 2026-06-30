// app/api/expenses/bulk/route.ts
// Bulk-import helper used by the Bulk Import modal.
//
// POST /api/expenses/bulk?mode=check
//   Body: { expenses: ExpenseCandidate[] }
//   Returns: { results: Array<ExpenseCandidate & { isDuplicate: boolean }> }
//   Checks each candidate against existing expenses (same date + amount).
//
// POST /api/expenses/bulk?mode=save
//   Body: { expenses: ExpenseCandidate[] }
//   Returns: { saved: number }
//   Inserts all supplied candidates — caller is responsible for having
//   already removed any duplicates they want to skip.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { getAustralianFY } from "@/lib/expenses";

const VALID_CATEGORIES = [
  "EQUIPMENT_GEAR",
  "SOFTWARE_SUBSCRIPTIONS",
  "VEHICLE_TRAVEL",
  "MARKETING_PROFESSIONAL",
] as const;

type ExpenseCandidate = {
  title:            string;
  vendor?:          string;
  amount:           number;
  date:             string;   // YYYY-MM-DD
  category:         string;
  notes?:           string;
  gdrive_file_id?:  string | null;
  gdrive_file_name?: string | null;
  gdrive_file_url?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getOwnerUserId();
  const mode    = req.nextUrl.searchParams.get("mode") ?? "check";
  const body    = await req.json() as { expenses?: ExpenseCandidate[] };

  if (!Array.isArray(body.expenses) || body.expenses.length === 0) {
    return NextResponse.json({ error: "No expenses provided" }, { status: 400 });
  }

  // ── CHECK mode ──────────────────────────────────────────────────────────

  if (mode === "check") {
    // For each candidate, query for an existing expense with same date + amount.
    // Same date + same amount is a very strong signal (effectively unique for
    // business receipts). If vendor also matches (case-insensitive), it's
    // almost certainly a duplicate.
    const results = await Promise.all(
      body.expenses.map(async (exp) => {
        const { data } = await supabase
          .from("expenses")
          .select("id, vendor")
          .eq("owner_id", ownerId)
          .eq("date",     exp.date)
          .eq("amount",   exp.amount)
          .limit(3);

        let isDuplicate = (data?.length ?? 0) > 0;

        // If there are amount+date matches but different vendors, be more lenient
        // (e.g. two different purchases of the same price on the same day)
        if (isDuplicate && exp.vendor && data?.length) {
          const vendorLower = exp.vendor.toLowerCase();
          isDuplicate = data.some(
            d => !d.vendor || d.vendor.toLowerCase() === vendorLower
          );
        }

        return {
          ...exp,
          isDuplicate,
          duplicateId: isDuplicate ? (data?.[0]?.id ?? null) : null,
        };
      })
    );

    return NextResponse.json({ results });
  }

  // ── SAVE mode ───────────────────────────────────────────────────────────

  if (mode === "save") {
    const rows = body.expenses.map((exp) => ({
      owner_id:         ownerId,
      title:            String(exp.title    ?? "").trim().slice(0, 200),
      vendor:           exp.vendor ? String(exp.vendor).trim().slice(0, 100) : null,
      category:         VALID_CATEGORIES.includes(exp.category as any)
                          ? exp.category
                          : "EQUIPMENT_GEAR",
      amount:           Math.abs(Number(exp.amount) || 0),
      date:             /^\d{4}-\d{2}-\d{2}$/.test(String(exp.date ?? ""))
                          ? String(exp.date)
                          : new Date().toISOString().split("T")[0],
      notes:            exp.notes ? String(exp.notes).trim().slice(0, 500) : null,
      is_recurring:     false,
      financial_year:   getAustralianFY(exp.date ?? new Date().toISOString().split("T")[0]),
      gdrive_file_id:   exp.gdrive_file_id   ?? null,
      gdrive_file_name: exp.gdrive_file_name ?? null,
      gdrive_file_url:  exp.gdrive_file_url  ?? null,
    }));

    const { data, error } = await supabase
      .from("expenses")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[expenses/bulk] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: data?.length ?? 0 });
  }

  return NextResponse.json({ error: "Invalid mode. Use ?mode=check or ?mode=save" }, { status: 400 });
}
