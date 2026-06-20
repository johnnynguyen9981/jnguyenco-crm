// PATCH /api/payments/[id] — mark payment as PAID, update reference/method
// DELETE /api/payments/[id] — remove a payment record
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { owner_id: _, booking_id: __, ...safe } = body;

  // Auto-set paid_date when marking PAID
  if (safe.status === "PAID" && !safe.paid_date) {
    safe.paid_date = new Date().toISOString().split("T")[0];
  }

  const { data, error } = await supabase
    .from("payments")
    .update(safe)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select().single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { error } = await supabase
    .from("payments").delete().eq("id", params.id).eq("owner_id", user.id);
  if (error) return apiError(error.message, 500);
  return new Response(null, { status: 204 });
}
