// PATCH  /api/bookings/[id]/contractors/[assignmentId] — update confirmed/paid/rate
// DELETE /api/bookings/[id]/contractors/[assignmentId] — unassign
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";

type Params = { params: { id: string; assignmentId: string } };

async function assertOwnsBooking(supabase: any, bookingId: string, ownerUserId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("owner_id", ownerUserId)
    .single();
  return !error && !!data;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();
  if (!(await assertOwnsBooking(supabase, params.id, ownerUserId))) {
    return apiError("Booking not found", 404);
  }

  let body: { confirmed?: boolean; paid?: boolean; agreed_rate?: number | null; notes?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const update: Record<string, unknown> = {};
  if (typeof body.confirmed === "boolean") update.confirmed = body.confirmed;
  if (typeof body.paid === "boolean") {
    update.paid = body.paid;
    update.paid_date = body.paid ? new Date().toISOString().slice(0, 10) : null;
  }
  if (body.agreed_rate !== undefined) update.agreed_rate = body.agreed_rate;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabase
    .from("booking_contractors")
    .update(update)
    .eq("id", params.assignmentId)
    .eq("booking_id", params.id)
    .select("id, role, agreed_rate, confirmed, paid, contractors (id, first_name, last_name, email, phone, role)")
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Assignment not found", 404)
      : apiError(error.message, 500);
  }
  return apiSuccess(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();
  if (!(await assertOwnsBooking(supabase, params.id, ownerUserId))) {
    return apiError("Booking not found", 404);
  }

  const { error } = await supabase
    .from("booking_contractors")
    .delete()
    .eq("id", params.assignmentId)
    .eq("booking_id", params.id);

  if (error) return apiError(error.message, 500);
  return new Response(null, { status: 204 });
}
