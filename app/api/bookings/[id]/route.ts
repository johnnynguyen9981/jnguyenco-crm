// GET    /api/bookings/[id]  — full booking detail with client, package, payments, deliverables
// PATCH  /api/bookings/[id]  — update booking (status, notes, venue, gcal_event_id, etc.)
// DELETE /api/bookings/[id]  — cancel/delete booking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import type { BookingUpdate } from "@/lib/supabase/types";
import { syncBookingToCalendar, deleteCalendarEvent } from "@/lib/google/calendar";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address, instagram_handle,
               partner_first, partner_last, partner_email, partner_phone),
      packages (id, name, base_price, max_hours, includes_photography, includes_videography,
                photo_count_min, photo_count_max, description),
      payments (id, payment_type, amount, due_date, paid_date, status, method, reference, notes),
      deliverables (id, type, status, image_count, film_duration_sec,
                    delivery_url, delivery_platform, due_date, delivered_at, client_viewed_at, notes),
      booking_contractors (
        id, role, agreed_rate, confirmed, paid,
        contractors (id, first_name, last_name, email, phone, role)
      ),
      invoices (id, invoice_number, status, total_amount, amount_paid, due_date)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Booking not found", 404)
      : apiError(error.message, 500);
  }
  return apiSuccess(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let body: BookingUpdate & { owner_id?: never };
  try { body = await req.json(); } catch { return apiError("Invalid JSON"); }

  const { owner_id: _, ...safe } = body as any;

  const { data, error } = await supabase
    .from("bookings")
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select(`*, clients(first_name, last_name, email), packages(name, base_price)`)
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Booking not found", 404)
      : apiError(error.message, 500);
  }

  // ── Auto-sync to Google Calendar (fire-and-forget) ──
  if (data.clients) {
    try {
      const calResult = await syncBookingToCalendar(user.id, data, data.clients as any);
      await supabase.from("bookings").update({ gcal_event_id: calResult.gcal_event_id }).eq("id", params.id);
      (data as any).gcal_event_id = calResult.gcal_event_id;
    } catch (calErr: any) {
      console.warn("[bookings/PATCH] Calendar sync skipped:", calErr?.message);
    }
  }

  return apiSuccess(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Block if paid invoices exist
  const { count: paidCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", params.id)
    .eq("status", "PAID");

  if ((paidCount ?? 0) > 0) {
    return apiError("Cannot delete — this booking has paid invoices. Change status to CANCELLED instead.", 409);
  }

  // Fetch gcal_event_id before deleting so we can clean up Calendar
  const { data: toDelete } = await supabase
    .from("bookings").select("gcal_event_id").eq("id", params.id).eq("owner_id", user.id).single();

  const { error } = await supabase
    .from("bookings").delete().eq("id", params.id).eq("owner_id", user.id);
  if (error) return apiError(error.message, 500);

  // ── Remove Calendar event if one was linked ──
  if (toDelete?.gcal_event_id) {
    try {
      await deleteCalendarEvent(user.id, toDelete.gcal_event_id);
    } catch (calErr: any) {
      console.warn("[bookings/DELETE] Calendar cleanup skipped:", calErr?.message);
    }
  }

  return new Response(null, { status: 204 });
}
