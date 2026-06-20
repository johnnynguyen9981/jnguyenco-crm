// POST /api/google/calendar/sync
// Syncs a booking to Google Calendar and stores the event ID back in Supabase.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBookingToCalendar, deleteCalendarEvent } from "@/lib/google/calendar";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { booking_id, action } = await req.json();
  if (!booking_id) return apiError("booking_id is required");

  // Fetch the booking + client in one query
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`*, clients (first_name, last_name, email)`)
    .eq("id", booking_id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  try {
    // ── Delete event (e.g. when booking is cancelled) ─────────────────────
    if (action === "delete") {
      if (!booking.gcal_event_id) return apiError("No Google Calendar event linked to this booking");
      await deleteCalendarEvent(user.id, booking.gcal_event_id);
      await supabase.from("bookings").update({ gcal_event_id: null }).eq("id", booking_id);
      return apiSuccess({ deleted: true });
    }

    // ── Create or update event ─────────────────────────────────────────────
    const result = await syncBookingToCalendar(user.id, booking, booking.clients);

    // Store the Google Calendar event ID
    await supabase
      .from("bookings")
      .update({ gcal_event_id: result.gcal_event_id })
      .eq("id", booking_id);

    return apiSuccess({
      gcal_event_id: result.gcal_event_id,
      html_link:     result.html_link,
      action:        booking.gcal_event_id ? "updated" : "created",
    });

  } catch (err: any) {
    // If the error is "not connected", surface that specifically
    if (err.message?.includes("not connected")) {
      return apiError("Google account not connected. Please connect it in Settings → Integrations.", 403);
    }
    console.error("[calendar/sync] Error:", err);
    return apiError(`Google Calendar sync failed: ${err.message}`, 500);
  }
}
