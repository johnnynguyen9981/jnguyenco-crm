// POST /api/google/calendar/sync-deliverable
// Syncs a single deliverable's due date to Google Calendar as an all-day
// reminder event, and stores the event ID back on the deliverable row.
// Mirrors /api/google/calendar/sync (which does the same for booking shoot days).
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncDeliverableToCalendar, deleteDeliverableCalendarEvent } from "@/lib/google/calendar";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { deliverable_id, action } = await req.json();
  if (!deliverable_id) return apiError("deliverable_id is required");

  // Fetch the deliverable + booking + client in one query.
  // Note: deliverables has no owner_id column — access is scoped by RLS via
  // team membership (see "team_deliverables_access" policy), not per-owner.
  const { data: deliverable, error: dErr } = await supabase
    .from("deliverables")
    .select(`*, bookings (id, clients (first_name, last_name))`)
    .eq("id", deliverable_id)
    .single();

  if (dErr || !deliverable) return apiError("Deliverable not found", 404);

  const booking = (deliverable as any).bookings;
  const client  = booking?.clients;

  try {
    // ── Delete event (e.g. when a deliverable is removed) ──────────────────
    if (action === "delete") {
      if (!deliverable.gcal_event_id) return apiError("No Google Calendar reminder linked to this deliverable");
      await deleteDeliverableCalendarEvent(user.id, deliverable.gcal_event_id);
      await supabase.from("deliverables").update({ gcal_event_id: null }).eq("id", deliverable_id);
      return apiSuccess({ deleted: true });
    }

    if (!booking || !client) return apiError("Deliverable is missing its booking/client — cannot sync", 400);

    // ── Create or update event ───────────────────────────────────────────
    const result = await syncDeliverableToCalendar(user.id, deliverable, booking, client);

    await supabase
      .from("deliverables")
      .update({ gcal_event_id: result.gcal_event_id })
      .eq("id", deliverable_id);

    return apiSuccess({
      gcal_event_id: result.gcal_event_id,
      html_link:     result.html_link,
      action:        deliverable.gcal_event_id ? "updated" : "created",
    });

  } catch (err: any) {
    if (err.message?.includes("not connected") || err.message?.includes("reconnected")) {
      return apiError(err.message.includes("reconnected") ? err.message : "Google account not connected. Please connect it in Settings → Integrations.", 403);
    }
    if (err.message?.includes("no due date") || err.message?.includes("no due date to sync")) {
      return apiError(err.message, 400);
    }
    console.error("[calendar/sync-deliverable] Error:", err);
    return apiError(`Google Calendar sync failed: ${err.message}`, 500);
  }
}
