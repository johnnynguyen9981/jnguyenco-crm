// Dashboard widget: contractor payments awaiting action.
//
// Photographer/Videographer crew are paid per booking, per hour, once the
// event has happened — the risk is a payment quietly going overdue after
// the event date passes. The Photo Editor is paid per project, but
// batched: Johnny pays out once every 5 completed (work-received) projects
// have accumulated, not after each one — so the risk there isn't
// "overdue", it's losing track of the running count and missing the
// moment a payout is actually due.
//
// Both read straight off booking_contractors.paid / work_received_at, which
// already exist in the schema (see 20260820_contractor_payment_expenses.sql
// and 20260828_contractor_work_received.sql) — this is a read-only view on
// data the app already tracks, no migration needed.
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

// Editor payouts are batched every 5 completed projects — Johnny's stated
// business rule (see claude/dashboard-redesign-spec.md in the project
// notes). Change this constant if the batch size ever changes.
const EDITOR_BATCH_SIZE = 5;

export type UnpaidAssignment = {
  id: string;
  role: string;
  agreedRate: number | null;
  rateType: "HOURLY" | "PER_PROJECT" | null;
  coverageStartTime: string | null;
  coverageEndTime: string | null;
  workReceivedAt: string | null;
  contractorId: string;
  contractorName: string;
  contractorDefaultRate: number | null;
  contractorRateType: "HOURLY" | "PER_PROJECT" | null;
  bookingId: string;
  eventDate: string | null;
  clientName: string;
};

/** "14:00" -> hours between start/end, overnight-safe. Mirrors the same
 * helper in ContractorAssignment.tsx and the assignment PATCH route — kept
 * as its own copy rather than a shared import, matching how that logic is
 * already duplicated between those two files. */
function hoursBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // overnight coverage
  return Math.round((mins / 60) * 100) / 100;
}

/** Mirrors computeAssignmentAmount() in
 * app/api/bookings/[id]/contractors/[assignmentId]/route.ts. */
function computeAmount(a: UnpaidAssignment): number {
  const rate = a.agreedRate ?? a.contractorDefaultRate ?? 0;
  const rateType = a.rateType ?? a.contractorRateType ?? "PER_PROJECT";
  if (rateType === "HOURLY") {
    const hours = hoursBetween(a.coverageStartTime, a.coverageEndTime);
    if (hours && hours > 0) return Math.round(rate * hours * 100) / 100;
  }
  return Math.round(rate * 100) / 100;
}

function resolvedRateType(a: UnpaidAssignment): "HOURLY" | "PER_PROJECT" {
  if (a.rateType) return a.rateType;
  if (a.contractorRateType) return a.contractorRateType;
  return a.role === "PHOTOGRAPHER" || a.role === "VIDEOGRAPHER" || a.role === "BOTH"
    ? "HOURLY"
    : "PER_PROJECT";
}

function daysSince(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d) / 86400000);
}

type Batch = {
  contractorId: string;
  contractorName: string;
  projects: { id: string; clientName: string; workReceivedAt: string; amount: number }[];
};

function buildBatches(assignments: UnpaidAssignment[]): (Batch & { count: number; totalAmount: number; due: boolean })[] {
  const groups = new Map<string, Batch>();
  assignments
    .filter((a) => resolvedRateType(a) === "PER_PROJECT" && a.workReceivedAt)
    .forEach((a) => {
      const g = groups.get(a.contractorId) ?? { contractorId: a.contractorId, contractorName: a.contractorName, projects: [] };
      g.projects.push({ id: a.id, clientName: a.clientName, workReceivedAt: a.workReceivedAt!, amount: computeAmount(a) });
      groups.set(a.contractorId, g);
    });
  return Array.from(groups.values()).map((g) => ({
    ...g,
    count: g.projects.length,
    totalAmount: g.projects.reduce((s, p) => s + p.amount, 0),
    due: g.projects.length >= EDITOR_BATCH_SIZE,
  }));
}

function buildPerEventDue(assignments: UnpaidAssignment[], today: string) {
  return assignments
    .filter((a) => resolvedRateType(a) === "HOURLY" && a.eventDate && a.eventDate < today)
    .map((a) => ({ ...a, amount: computeAmount(a) }))
    .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1));
}

/** Count of items needing action right now — feeds the "Needs your
 * attention" chip on the dashboard. One per overdue per-event payment, plus
 * one per editor batch that has reached the payout threshold. */
export function countContractorPaymentAlerts(assignments: UnpaidAssignment[]): number {
  const today = new Date().toISOString().split("T")[0];
  const perEventDue = buildPerEventDue(assignments, today).length;
  const batchesDue = buildBatches(assignments).filter((b) => b.due).length;
  return perEventDue + batchesDue;
}

export function ContractorPayments({ assignments }: { assignments: UnpaidAssignment[] }) {
  const today = new Date().toISOString().split("T")[0];
  const perEventDue = buildPerEventDue(assignments, today);
  const batches = buildBatches(assignments);

  if (perEventDue.length === 0 && batches.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
        <h2 className="text-base font-semibold text-brand-navy">Contractor Payments</h2>
        <Link href="/contractors" className="text-xs text-brand-teal hover:underline font-medium">
          View all →
        </Link>
      </div>

      {perEventDue.length > 0 && (
        <div className="divide-y divide-brand-pale-blue">
          {perEventDue.map((a) => {
            const overdueDays = daysSince(a.eventDate!);
            return (
              <Link
                key={a.id}
                href={`/bookings/${a.bookingId}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-brand-pale-blue/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.contractorName}</p>
                  <p className="text-xs text-gray-400 truncate">{a.clientName} · event {formatDate(a.eventDate)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-brand-navy">{formatCurrency(a.amount)}</p>
                  <p className="text-[11px] text-red-500">{overdueDays}d since event</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {batches.length > 0 && (
        <div className="divide-y divide-brand-pale-blue border-t border-brand-pale-blue">
          {batches.map((b) => (
            <Link
              key={b.contractorId}
              href={`/contractors/${b.contractorId}`}
              className={`flex items-center gap-4 px-5 py-3 hover:bg-brand-pale-blue/20 transition-colors ${b.due ? "bg-amber-50" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.contractorName}</p>
                <p className="text-xs text-gray-400 truncate">
                  {b.count} / {EDITOR_BATCH_SIZE} projects since last payout
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-brand-navy">{formatCurrency(b.totalAmount)}</p>
                <p className={`text-[11px] ${b.due ? "text-amber-700 font-semibold" : "text-gray-400"}`}>
                  {b.due ? "Batch ready — pay now" : "accumulating"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
