// lib/deliverables/populateForBooking.ts
// Shared core of "auto-populate deliverables for a booking" — used by both
// the single-booking route (POST /api/bookings/[id]/deliverables) and the
// bulk route (POST /api/bookings/generate-all-deliverables). Idempotent:
// skips deliverable types that already exist on the booking. Best-effort
// syncs each newly created deliverable's due date to Google Calendar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeliverableTemplates, addDaysToDate } from "@/lib/deliverables/autoPopulate";
import { isGoogleConnected } from "@/lib/google/auth";
import { syncDeliverableToCalendar } from "@/lib/google/calendar";

export interface PopulateResult {
  created:        number;
  calendarSynced: number;
  skipped?:       string; // reason nothing happened, e.g. "booking not found"
}

export async function populateDeliverablesForBooking(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string,
  // Pass through so a bulk caller only has to look this up once instead of
  // once per booking in the loop.
  googleConnected?: boolean,
): Promise<PopulateResult> {
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`
      id, event_date, service_type, owner_id,
      packages (id, name, max_hours, includes_photography, includes_videography, photo_count_min, photo_count_max, film_duration_min_sec, film_duration_max_sec),
      deliverables (type),
      clients (first_name, last_name)
    `)
    .eq("id", bookingId)
    .eq("owner_id", userId)
    .single();

  if (bErr || !booking) return { created: 0, calendarSynced: 0, skipped: "booking not found" };

  const pkg         = (booking as any).packages;
  const serviceType = booking.service_type ?? "EVENT";
  const eventDate    = booking.event_date;

  const templates = getDeliverableTemplates(pkg, serviceType);

  const existingTypes = new Set(
    ((booking as any).deliverables ?? []).map((d: any) => d.type)
  );

  const toInsert = templates
    .filter(t => !existingTypes.has(t.type))
    .map(t => ({
      booking_id:        bookingId,
      type:              t.type,
      status:            "NOT_STARTED" as const,
      notes:             t.notes,
      due_date:          eventDate ? addDaysToDate(eventDate, t.due_days_after) : null,
      image_count:       t.image_count_max ?? null,
      film_duration_sec: t.film_duration_sec ?? null,
    }));

  if (toInsert.length === 0) return { created: 0, calendarSynced: 0 };

  const { data, error } = await supabase
    .from("deliverables")
    .insert(toInsert)
    .select();

  if (error || !data) return { created: 0, calendarSynced: 0, skipped: error?.message ?? "insert failed" };

  // Best-effort: auto-create a Google Calendar due-date reminder for each new
  // deliverable. Non-blocking — if Google isn't connected, or a single sync
  // fails, the deliverables are still created; reminders can be added later.
  let calendarSynced = 0;
  const client = (booking as any).clients;
  const connected = googleConnected ?? (client ? await isGoogleConnected(userId) : false);
  if (client && connected) {
    for (const d of data) {
      if (!d.due_date) continue;
      try {
        const result = await syncDeliverableToCalendar(userId, d, { id: bookingId }, client);
        await supabase.from("deliverables").update({ gcal_event_id: result.gcal_event_id }).eq("id", d.id);
        calendarSynced++;
      } catch (syncErr) {
        console.error("[populateDeliverablesForBooking] Calendar sync failed for deliverable", d.id, syncErr);
      }
    }
  }

  return { created: data.length, calendarSynced };
}
