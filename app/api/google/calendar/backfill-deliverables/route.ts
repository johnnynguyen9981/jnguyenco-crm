// POST /api/google/calendar/backfill-deliverables
// One-off backfill: finds every deliverable that has a due_date but no
// gcal_event_id yet (i.e. was created before Calendar reminders existed, or
// the automatic sync failed at the time — e.g. Google wasn't connected), and
// syncs each one to Google Calendar. Deliverables have no owner_id column —
// access is scoped by RLS via team membership, not per-owner (same model as
// the global Deliverables list), so this covers every deliverable the
// business has, not just ones "belonging" to the calling user.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncDeliverableToCalendar } from "@/lib/google/calendar";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data: deliverables, error } = await supabase
    .from("deliverables")
    .select(`*, bookings (id, clients (first_name, last_name))`)
    .is("gcal_event_id", null)
    .not("due_date", "is", null);

  if (error) return apiError(error.message, 500);

  let synced = 0;
  let failed = 0;
  let skipped = 0; // no linked booking/client to build the event from

  for (const d of deliverables ?? []) {
    const booking = (d as any).bookings;
    const client  = booking?.clients;
    if (!booking || !client) { skipped++; continue; }

    try {
      const result = await syncDeliverableToCalendar(user.id, d, booking, client);
      await supabase.from("deliverables").update({ gcal_event_id: result.gcal_event_id }).eq("id", d.id);
      synced++;
    } catch (err: any) {
      // If Google simply isn't connected, stop early — every subsequent
      // attempt will fail identically, no point burning through the list.
      if (err.message?.includes("not connected") || err.message?.includes("reconnected")) {
        return apiError(err.message, 403);
      }
      console.error("[calendar/backfill-deliverables] Failed for deliverable", d.id, err);
      failed++;
    }
  }

  return apiSuccess({
    total_checked: (deliverables ?? []).length,
    synced,
    failed,
    skipped,
  });
}
