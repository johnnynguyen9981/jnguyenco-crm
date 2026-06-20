// POST /api/payments — log a payment milestone against a booking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { booking_id, payment_type, amount, due_date, status, method, reference, notes, invoice_id } = body;

  if (!booking_id)    return apiError("booking_id is required");
  if (!payment_type)  return apiError("payment_type is required");
  if (!amount)        return apiError("amount is required");

  // Verify booking belongs to owner
  const { data: booking } = await supabase
    .from("bookings").select("id").eq("id", booking_id).eq("owner_id", user.id).maybeSingle();
  if (!booking) return apiError("Booking not found", 404);

  const { data, error } = await supabase
    .from("payments")
    .insert({ booking_id, payment_type, amount, due_date, status: status ?? "PENDING",
              method, reference, notes, invoice_id, owner_id: user.id })
    .select().single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, 201);
}
