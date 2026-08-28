// PATCH  /api/bookings/[id]/contractors/[assignmentId] — update confirmed/paid/rate
// DELETE /api/bookings/[id]/contractors/[assignmentId] — unassign
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import { getAustralianFY } from "@/lib/expenses";

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH: "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER: "Other",
};

function hoursBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // overnight coverage
  return Math.round((mins / 60) * 100) / 100;
}

// Computes the payout amount for an assignment, falling back to the
// contractor's standing default rate/rate-type if nothing was agreed
// specifically for this booking.
function computeAssignmentAmount(row: {
  agreed_rate?: number | null;
  rate_type?: string | null;
  coverage_start_time?: string | null;
  coverage_end_time?: string | null;
}, contractor: { default_rate?: number | null; rate_type?: string | null }): number {
  const rate = row.agreed_rate ?? contractor.default_rate ?? 0;
  const rateType = row.rate_type ?? contractor.rate_type ?? "PER_PROJECT";
  if (rateType === "HOURLY") {
    const hours = hoursBetween(row.coverage_start_time, row.coverage_end_time);
    if (hours && hours > 0) return Math.round(rate * hours * 100) / 100;
  }
  return Math.round(rate * 100) / 100;
}

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

// See app/api/bookings/[id]/contractors/route.ts for why this exists — lets
// rate_type/coverage_* updates degrade gracefully until the
// 20260813_booking_contractor_coverage.sql migration has been run.
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("schema cache") || (msg.includes("column") && msg.includes("does not exist"));
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

  let body: {
    confirmed?: boolean;
    paid?: boolean;
    agreed_rate?: number | null;
    notes?: string;
    rate_type?: "HOURLY" | "PER_PROJECT" | null;
    coverage_start_time?: string | null;
    coverage_end_time?: string | null;
    deadline?: string | null;
    work_received_at?: string | null;
  };
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

  const coverageUpdate: Record<string, unknown> = {};
  if (body.rate_type !== undefined) coverageUpdate.rate_type = body.rate_type;
  if (body.coverage_start_time !== undefined) coverageUpdate.coverage_start_time = body.coverage_start_time;
  if (body.coverage_end_time !== undefined) coverageUpdate.coverage_end_time = body.coverage_end_time;
  if (body.deadline !== undefined) coverageUpdate.deadline = body.deadline;

  // work_received_at is set/cleared explicitly by the "Mark work received"
  // toggle — never bundled with the deadline edit, so closing out an
  // assignment never touches the original agreed deadline. Kept in its own
  // object (like coverageUpdate) so it degrades gracefully — same pattern
  // as rate_type/coverage_* — until the 20260828 migration has been run.
  const receivedUpdate: Record<string, unknown> = {};
  if (body.work_received_at !== undefined) receivedUpdate.work_received_at = body.work_received_at;

  const selectCols =
    "id, role, agreed_rate, confirmed, paid, deadline, work_received_at, rate_type, coverage_start_time, coverage_end_time, " +
    "contractors (id, first_name, last_name, email, phone, role, default_rate, rate_type)";

  let { data, error } = await supabase
    .from("booking_contractors")
    .update({ ...update, ...coverageUpdate, ...receivedUpdate })
    .eq("id", params.assignmentId)
    .eq("booking_id", params.id)
    .select(selectCols)
    .single();

  // work_received_at doesn't exist yet — retry without it so
  // confirmed/paid/deadline/coverage updates still work.
  if (error && isMissingColumnError(error) && Object.keys(receivedUpdate).length > 0) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .update({ ...update, ...coverageUpdate })
      .eq("id", params.assignmentId)
      .eq("booking_id", params.id)
      .select(selectCols.replace(", work_received_at", ""))
      .single());
  }

  // rate_type/coverage columns don't exist yet — retry with only the
  // original fields so confirmed/paid/agreed_rate updates still work.
  if (error && isMissingColumnError(error) && Object.keys(coverageUpdate).length > 0) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .update(update)
      .eq("id", params.assignmentId)
      .eq("booking_id", params.id)
      .select(selectCols)
      .single());
  }

  // The select itself references columns (rate_type/coverage_*/default_rate/
  // work_received_at) that may not exist yet — fall back to a minimal select
  // so the core confirmed/paid toggle never breaks because of newer columns.
  const minimalSelectCols = "id, role, agreed_rate, confirmed, paid, deadline, contractors (id, first_name, last_name, email, phone, role)";
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .update(update)
      .eq("id", params.assignmentId)
      .eq("booking_id", params.id)
      .select(minimalSelectCols)
      .single());
  }

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Assignment not found", 404)
      : apiError(error.message, 500);
  }

  // ── Auto-record contractor payment as a business Expense ─────────────────
  // Fires only when this PATCH explicitly flips `paid`. Never lets an
  // expense-side hiccup fail the paid toggle itself.
  if (typeof body.paid === "boolean") {
    try {
      await syncContractorPaymentExpense(supabase, user.id, params.id, params.assignmentId, body.paid, data);
    } catch (e) {
      console.error("syncContractorPaymentExpense failed:", e);
    }
  }

  return apiSuccess(data);
}

// Keeps `expenses` in sync with a booking_contractors assignment's paid state.
// Paid → true: (re)creates a linked expense reflecting the current rate.
// Paid → false: removes any previously auto-created linked expense.
async function syncContractorPaymentExpense(
  supabase: any,
  ownerUserId: string,
  bookingId: string,
  assignmentId: string,
  paid: boolean,
  assignment: any
) {
  // Always clear out any prior auto-generated entry for this assignment first
  // — keeps things idempotent whether this is a first-time pay, an unpay, or
  // a re-pay after a rate correction.
  try {
    await supabase.from("expenses").delete().eq("source_booking_contractor_id", assignmentId);
  } catch {
    // source_booking_contractor_id column not migrated yet — nothing to clean up.
  }

  if (!paid) return;

  const contractor = assignment?.contractors ?? {};
  const contractorName = [contractor.first_name, contractor.last_name].filter(Boolean).join(" ") || "Contractor";
  const roleLabel = ROLE_LABELS[assignment?.role] ?? assignment?.role ?? "";

  const { data: bookingInfo } = await supabase
    .from("bookings")
    .select("event_date, service_type, clients (first_name, last_name)")
    .eq("id", bookingId)
    .single();
  const client = bookingInfo?.clients;
  const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(" ") : "";

  const amount = computeAssignmentAmount(assignment ?? {}, contractor);
  const date = new Date().toISOString().slice(0, 10);
  const financial_year = getAustralianFY(date);
  const title = `Contractor payment — ${contractorName}${roleLabel ? ` (${roleLabel})` : ""}${clientName ? ` — ${clientName}` : ""}`;
  const notes = `Auto-recorded when marked Paid on the booking${bookingInfo?.event_date ? ` (event ${bookingInfo.event_date})` : ""}.`;

  const baseExpense = {
    owner_id: ownerUserId,
    title,
    vendor: contractorName,
    amount,
    date,
    notes,
    financial_year,
    source_booking_contractor_id: assignmentId,
  };

  let { error } = await supabase.from("expenses").insert({ ...baseExpense, category: "CONTRACTOR_PAYMENTS" });

  // CONTRACTOR_PAYMENTS category not migrated yet — fall back to an existing
  // category so the expense still gets recorded.
  if (error && (error.code === "23514" || /check constraint|category/i.test(error.message ?? ""))) {
    ({ error } = await supabase.from("expenses").insert({ ...baseExpense, category: "MARKETING_PROFESSIONAL" }));
  }

  // source_booking_contractor_id column not migrated yet — retry without it.
  if (error && isMissingColumnError(error)) {
    const { source_booking_contractor_id, ...withoutLink } = baseExpense;
    ({ error } = await supabase.from("expenses").insert({ ...withoutLink, category: "CONTRACTOR_PAYMENTS" }));
    if (error && (error.code === "23514" || /check constraint|category/i.test(error.message ?? ""))) {
      await supabase.from("expenses").insert({ ...withoutLink, category: "MARKETING_PROFESSIONAL" });
    }
  }
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

  // Clean up any auto-recorded expense that was linked to this assignment.
  try {
    await supabase.from("expenses").delete().eq("source_booking_contractor_id", params.assignmentId);
  } catch {
    // source_booking_contractor_id column not migrated yet — nothing to clean up.
  }

  return new Response(null, { status: 204 });
}
