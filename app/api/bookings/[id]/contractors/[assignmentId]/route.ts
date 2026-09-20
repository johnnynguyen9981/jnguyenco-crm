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

type Params = { params: Promise<{ id: string; assignmentId: string }> };

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

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
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
    amount_paid?: number | null;
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

  let update: Record<string, unknown> = {};
  if (typeof body.confirmed === "boolean") update.confirmed = body.confirmed;
  if (typeof body.paid === "boolean") {
    update.paid = body.paid;
    update.paid_date = body.paid ? new Date().toISOString().slice(0, 10) : null;
    // Unmarking Paid is a full reset — clears any partial-payment progress
    // too, rather than leaving a stale amount sitting against an Unpaid
    // badge. (Marking Paid directly, without going through amount_paid,
    // intentionally leaves amount_paid alone — reconciled below instead.)
    if (!body.paid) update.amount_paid = 0;
  }
  if (body.agreed_rate !== undefined) update.agreed_rate = body.agreed_rate;
  if (body.notes !== undefined) update.notes = body.notes;

  // amount_paid tracks a running total paid out so far, before the
  // assignment is fully settled — e.g. a deposit now, the rest after the
  // event. Kept in its own object (like coverageUpdate) so it degrades
  // gracefully until the 20260905 migration has been run.
  let amountPaid: number | undefined;
  if (body.amount_paid !== undefined) {
    const n = Number(body.amount_paid);
    if (!Number.isFinite(n) || n < 0) return apiError("amount_paid must be a non-negative number");
    amountPaid = Math.round(n * 100) / 100;
  }
  const amountPaidUpdate: Record<string, unknown> = {};
  if (amountPaid !== undefined) amountPaidUpdate.amount_paid = amountPaid;

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

  // Single merged update payload, pruned in place below as migration-gated
  // columns turn out to be missing — this replaced an earlier chain of
  // fallback branches that each guessed which column had caused the error
  // from the *request body's* shape rather than the database's actual
  // response. That guess was wrong whenever a request only touched one
  // migration-gated field (e.g. "Mark work received" sends only
  // work_received_at): the SELECT's unconditional `amount_paid` reference
  // failed first (that migration hadn't run yet), the chain misread it as a
  // work_received_at/coverage problem instead, and its matching fallback
  // dropped the *actual* update fields entirely, ending on a `.update({})`
  // no-op that still returned 200 — the request appeared to succeed while
  // silently changing nothing.
  let fullUpdate: Record<string, unknown> = { ...update, ...coverageUpdate, ...receivedUpdate, ...amountPaidUpdate };
  let selectCols =
    "id, role, agreed_rate, confirmed, paid, amount_paid, deadline, work_received_at, rate_type, coverage_start_time, coverage_end_time, " +
    "contractors (id, first_name, last_name, email, phone, role, default_rate, rate_type)";

  async function attempt() {
    return supabase
      .from("booking_contractors")
      .update(fullUpdate)
      .eq("id", params.assignmentId)
      .eq("booking_id", params.id)
      .select(selectCols)
      .single();
  }

  let { data, error } = await attempt();

  // Each of these columns was added in its own later migration and may not
  // exist yet on a database that hasn't had it run. On a missing-column
  // error, drop whichever of these are actually present in this request/
  // select and retry — never touching fields the request didn't ask to
  // change — until the update succeeds or nothing more can be dropped.
  const migrationGatedColumns = [
    "amount_paid", "work_received_at", "rate_type", "coverage_start_time", "coverage_end_time", "deadline",
  ];
  for (const col of migrationGatedColumns) {
    if (!error || !isMissingColumnError(error)) break;
    if (!(col in fullUpdate) && !selectCols.includes(col)) continue;
    const { [col]: _drop, ...rest } = fullUpdate;
    fullUpdate = rest;
    selectCols = selectCols.replace(new RegExp(`,\\s*${col}\\b`), "");
    ({ data, error } = await attempt());
  }

  // Still failing on some other missing column (e.g. default_rate on
  // contractors) — fall back to the original, always-present columns only.
  const minimalSelectCols = "id, role, agreed_rate, confirmed, paid, deadline, contractors (id, first_name, last_name, email, phone, role)";
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .update(fullUpdate)
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

  // ── Reconcile amount_paid against the computed total ─────────────────────
  // If a partial-payment update now covers (or exceeds) the full amount,
  // auto-complete the assignment exactly as if the Paid badge had been
  // clicked directly — no separate manual step needed once it's all paid.
  let finalPaid: boolean | undefined = typeof body.paid === "boolean" ? body.paid : undefined;
  const row: any = data;
  if (amountPaid !== undefined && "amount_paid" in row && !row.paid) {
    const total = computeAssignmentAmount(row, row.contractors ?? {});
    if (total > 0 && row.amount_paid >= total) {
      const { data: completed, error: completeErr } = await supabase
        .from("booking_contractors")
        .update({ paid: true, paid_date: new Date().toISOString().slice(0, 10) })
        .eq("id", params.assignmentId)
        .eq("booking_id", params.id)
        .select(selectCols)
        .single();
      if (!completeErr && completed) {
        data = completed;
        finalPaid = true;
      }
    }
  }

  // ── Auto-record contractor payment as a business Expense ─────────────────
  // Fires whenever this request settled the assignment (directly via the
  // Paid toggle, or indirectly via amount_paid reaching the full total).
  // Never lets an expense-side hiccup fail the request itself.
  if (typeof finalPaid === "boolean") {
    try {
      await syncContractorPaymentExpense(supabase, user.id, params.id, params.assignmentId, finalPaid, data);
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

export async function DELETE(_req: NextRequest, props: Params) {
  const params = await props.params;
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
