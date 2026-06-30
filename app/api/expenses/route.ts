// app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAustralianFY, currentAustralianFY } from "@/lib/expenses";

// GET /api/expenses?fy=2024-25&category=SOFTWARE_SUBSCRIPTIONS&search=adobe&page=1
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fy       = searchParams.get("fy") || currentAustralianFY();
  const category = searchParams.get("category") || "";
  const search   = searchParams.get("search")?.trim() || "";
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 25;

  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("owner_id", user.id)
    .eq("financial_year", fy)
    .order("date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (category) query = query.eq("category", category);
  if (search)   query = query.or(`title.ilike.%${search}%,vendor.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Category totals for the selected FY
  const { data: allForFY } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("owner_id", user.id)
    .eq("financial_year", fy);

  const totals: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of allForFY ?? []) {
    totals[row.category] = (totals[row.category] ?? 0) + Number(row.amount);
    grandTotal += Number(row.amount);
  }

  return NextResponse.json({
    expenses: data ?? [],
    count: count ?? 0,
    totals,
    grandTotal,
    page,
    pageSize,
  });
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, vendor, category, amount, date, notes,
    is_recurring, recurring_frequency,
    gdrive_file_id, gdrive_file_name, gdrive_file_url,
  } = body;

  if (!title || !category || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const financial_year = getAustralianFY(date);

  const { data, error } = await supabase.from("expenses").insert({
    owner_id: user.id,
    title,
    vendor:   vendor || null,
    category,
    amount:   Number(amount),
    date,
    notes:    notes || null,
    is_recurring:       !!is_recurring,
    recurring_frequency: is_recurring ? (recurring_frequency || "MONTHLY") : null,
    last_generated_date: is_recurring ? date : null,
    gdrive_file_id:   gdrive_file_id   || null,
    gdrive_file_name: gdrive_file_name || null,
    gdrive_file_url:  gdrive_file_url  || null,
    financial_year,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
