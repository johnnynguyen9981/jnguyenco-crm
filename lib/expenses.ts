// lib/expenses.ts — Expense helpers for JNguyen Co. CRM

import type { ExpenseCategory } from "@/lib/supabase/types";

// ── Australian Financial Year helpers ────────────────────────────────────────

/**
 * Returns the Australian financial year string for a given date.
 * ATO financial year: 1 July – 30 June
 * e.g. 2024-08-01 → "2024-25", 2025-03-15 → "2024-25", 2025-07-01 → "2025-26"
 */
export function getAustralianFY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  if (month >= 7) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/** Returns the current Australian financial year string. */
export function currentAustralianFY(): string {
  return getAustralianFY(new Date());
}

/** Returns a list of FY options for filter dropdowns (last 3 years + current). */
export function getFYOptions(): string[] {
  const current = currentAustralianFY();
  const [startYear] = current.split("-").map(Number);
  return [
    `${startYear - 2}-${String(startYear - 1).slice(2)}`,
    `${startYear - 1}-${String(startYear).slice(2)}`,
    current,
  ];
}

/** Returns start/end Date objects for a given FY string e.g. "2024-25" */
export function fyDateRange(fy: string): { start: Date; end: Date } {
  const [startStr] = fy.split("-");
  const startYear = parseInt(startStr, 10);
  return {
    start: new Date(`${startYear}-07-01`),
    end:   new Date(`${startYear + 1}-06-30`),
  };
}

// ── Category metadata ─────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES: Record<
  ExpenseCategory,
  { label: string; color: string; bgColor: string; chartColor: string }
> = {
  SOFTWARE_SUBSCRIPTIONS: {
    label:      "Software & Subscriptions",
    color:      "text-blue-700",
    bgColor:    "bg-blue-50",
    chartColor: "#2563eb",
  },
  EQUIPMENT_GEAR: {
    label:      "Equipment & Gear",
    color:      "text-purple-700",
    bgColor:    "bg-purple-50",
    chartColor: "#9333ea",
  },
  VEHICLE_TRAVEL: {
    label:      "Vehicle & Travel",
    color:      "text-orange-700",
    bgColor:    "bg-orange-50",
    chartColor: "#ea580c",
  },
  MARKETING_PROFESSIONAL: {
    label:      "Marketing & Professional",
    color:      "text-green-700",
    bgColor:    "bg-green-50",
    chartColor: "#16a34a",
  },
  CONTRACTOR_PAYMENTS: {
    label:      "Contractor Payments",
    color:      "text-rose-700",
    bgColor:    "bg-rose-50",
    chartColor: "#e11d48",
  },
};

export function getCategoryBadge(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES[category] ?? {
    label:      category,
    color:      "text-gray-700",
    bgColor:    "bg-gray-50",
    chartColor: "#6b7280",
  };
}

// ── Auto-recurring expense generator ─────────────────────────────────────────

/**
 * Checks for due monthly recurring expenses and auto-creates entries.
 * Called on every expenses page render, so several runs can overlap.
 *
 * Logic:
 *   - Find all recurring template expenses (parent_expense_id IS NULL, is_recurring = true)
 *   - Work out every month due since last_generated_date
 *   - Write them in one upsert. The unique index on (parent_expense_id, date)
 *     makes this safe to repeat: a month that already exists is skipped.
 *   - Only move last_generated_date forward once that write has succeeded
 */
export async function generateDueRecurringExpenses(
  supabase: any,
  ownerUserId: string
): Promise<number> {
  const today = new Date();

  // Fetch active recurring templates
  const { data: templates, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("owner_id", ownerUserId)
    .eq("is_recurring", true)
    .is("parent_expense_id", null);

  if (error || !templates?.length) return 0;

  let generated = 0;

  for (const template of templates) {
    const lastDate = template.last_generated_date
      ? new Date(template.last_generated_date)
      : new Date(template.date);

    // Calculate next due date (1 month after last generated)
    const nextDue = new Date(lastDate);
    nextDue.setMonth(nextDue.getMonth() + 1);

    // Only generate if nextDue is in the past or today
    if (nextDue > today) continue;

    // Build all missing months up to today
    const rows: Record<string, unknown>[] = [];
    const cursor = new Date(nextDue);
    while (cursor <= today) {
      rows.push({
        owner_id:           ownerUserId,
        title:              template.title,
        vendor:             template.vendor,
        category:           template.category,
        amount:             template.amount,
        date:               cursor.toISOString().split("T")[0],
        notes:              template.notes,
        is_recurring:       false,
        financial_year:     getAustralianFY(cursor),
        parent_expense_id:  template.id,
      });

      // Advance by 1 month
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("expenses")
      .upsert(rows, { onConflict: "parent_expense_id,date", ignoreDuplicates: true })
      .select("id");

    if (insertError) {
      // Leave last_generated_date alone so the next page load tries again
      console.error("[expenses] recurring generation failed:", template.id, insertError.message);
      continue;
    }

    generated += inserted?.length ?? 0;

    // Update last_generated_date on the template
    await supabase
      .from("expenses")
      .update({ last_generated_date: rows[rows.length - 1].date })
      .eq("id", template.id);
  }

  return generated;
}
