// POST /api/bookings/generate-all-deliverables
// Bulk version of /api/bookings/[id]/deliverables — walks every booking
// that's actually going ahead (contracted, confirmed, or completed; skips
// inquiries/quotes still being negotiated and cancelled bookings), sets up
// deliverable due dates from its package where missing, and best-effort
// syncs each due date to Google Calendar as a reminder.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { populateDeliverablesForBooking } from "@/lib/deliverables/populateForBooking";
import { isGoogleConnected } from "@/lib/google/auth";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("owner_id", user.id)
    .in("status", ["CONTRACTED", "CONFIRMED", "COMPLETED"]);

  if (error) return apiError(error.message, 500);

  // Look this up once rather than once per booking in the loop below.
  const connected = await isGoogleConnected(user.id);

  let bookingsWithNewDeliverables = 0;
  let deliverablesCreated         = 0;
  let calendarSynced              = 0;
  let failed                      = 0;

  for (const b of bookings ?? []) {
    try {
      const result = await populateDeliverablesForBooking(supabase, user.id, b.id, connected);
      if (result.skipped && result.skipped !== "booking not found") failed++;
      if (result.created > 0) {
        bookingsWithNewDeliverables++;
        deliverablesCreated += result.created;
        calendarSynced      += result.calendarSynced;
      }
    } catch (err) {
      failed++;
      console.error("[generate-all-deliverables] Failed for booking", b.id, err);
    }
  }

  return apiSuccess({
    bookings_checked:               (bookings ?? []).length,
    bookings_with_new_deliverables: bookingsWithNewDeliverables,
    deliverables_created:           deliverablesCreated,
    calendar_synced:                calendarSynced,
    google_connected:               connected,
    failed,
  });
}
