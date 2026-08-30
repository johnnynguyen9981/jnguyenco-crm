// POST /api/admin/backfill-invoice-line-item-totals
// One-off (but safe to re-run) fix for invoice_line_items created before the
// POST /api/invoices route started computing `total` on insert. Recomputes
// total = quantity * unit_price for any line item where it's missing/zero
// but shouldn't be, scoped to the current user's own invoices.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { isCurrentUserFounder } from "@/lib/team";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);
  if (!(await isCurrentUserFounder())) return apiError("Forbidden", 403);

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_line_items(id, quantity, unit_price, total)")
    .eq("owner_id", user.id);

  if (error) return apiError(error.message, 500);

  const fixed: { invoice_number: string; line_item_id: string; old_total: number | null; new_total: number }[] = [];

  for (const inv of invoices ?? []) {
    for (const li of (inv.invoice_line_items as any[]) ?? []) {
      const correctTotal = Number(li.quantity) * Number(li.unit_price);
      const currentTotal = li.total == null ? null : Number(li.total);
      if (currentTotal !== correctTotal) {
        const { error: updErr } = await supabase
          .from("invoice_line_items")
          .update({ total: correctTotal })
          .eq("id", li.id);
        if (updErr) return apiError(`Failed updating line item ${li.id}: ${updErr.message}`, 500);
        fixed.push({
          invoice_number: (inv as any).invoice_number,
          line_item_id: li.id,
          old_total: currentTotal,
          new_total: correctTotal,
        });
      }
    }
  }

  return apiSuccess({ fixed_count: fixed.length, fixed });
}
