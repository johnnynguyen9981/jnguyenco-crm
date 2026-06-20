// GET    /api/invoices/[id]  — full invoice with client, line items
// PATCH  /api/invoices/[id]  — update status, amount_paid, notes
// DELETE /api/invoices/[id]  — delete draft invoice only
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address),
      bookings (id, event_date, service_type, venue_name, packages(name)),
      invoice_line_items (id, description, quantity, unit_price, total, sort_order)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Invoice not found", 404)
      : apiError(error.message, 500);
  }
  return apiSuccess(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { owner_id: _, invoice_number: __, ...safe } = body;

  // Auto-set paid_at when status becomes PAID
  if (safe.status === "PAID" && !safe.paid_at) {
    safe.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select(`*, clients(first_name, last_name, email, address),
              invoice_line_items(*)`)
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Only allow deletion of DRAFT invoices
  const { data: inv } = await supabase
    .from("invoices").select("status").eq("id", params.id).eq("owner_id", user.id).single();
  if (!inv) return apiError("Invoice not found", 404);
  if (inv.status !== "DRAFT") {
    return apiError(`Cannot delete a ${inv.status} invoice. Void it instead.`, 409);
  }

  const { error } = await supabase
    .from("invoices").delete().eq("id", params.id).eq("owner_id", user.id);
  if (error) return apiError(error.message, 500);
  return new Response(null, { status: 204 });
}
