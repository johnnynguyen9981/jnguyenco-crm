// POST /api/bookings/[id]/deliverables
// Auto-populates deliverables for a booking based on its package.
// Idempotent — skips types that already exist on the booking. Best-effort
// syncs each newly created deliverable's due date to Google Calendar.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { populateDeliverablesForBooking } from "@/lib/deliverables/populateForBooking";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const result = await populateDeliverablesForBooking(supabase, user.id, params.id);

  if (result.skipped === "booking not found") return apiError("Booking not found", 404);
  if (result.skipped) return apiError(result.skipped, 500);

  if (result.created === 0) {
    return apiSuccess({ created: 0, message: "All deliverables already exist" });
  }

  return apiSuccess({ created: result.created, calendar_synced: result.calendarSynced }, 201);
}
