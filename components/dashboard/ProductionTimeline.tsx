// Gantt-style stage tracker for the dashboard — one row per active
// deliverable, showing where it sits across the post-production pipeline
// (Not Started → Culling → Editing → Ready → Delivered → Client Approved)
// plus its due date. Server-renderable (no interactivity, just links).
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { DeliverableStatus, DeliverableType } from "@/lib/supabase/types";

const STAGES: { key: DeliverableStatus; label: string; color: string }[] = [
  { key: "NOT_STARTED",     label: "Not started", color: "bg-slate-300" },
  { key: "CULLING",         label: "Culling",      color: "bg-amber-400" },
  { key: "EDITING",         label: "Editing",      color: "bg-teal-500" },
  { key: "READY",           label: "Ready",        color: "bg-blue-500" },
  { key: "DELIVERED",       label: "Delivered",    color: "bg-green-500" },
  { key: "CLIENT_APPROVED", label: "Approved",     color: "bg-green-600" },
];

const STAGE_INDEX: Record<DeliverableStatus, number> = STAGES.reduce(
  (acc, s, i) => ({ ...acc, [s.key]: i }),
  {} as Record<DeliverableStatus, number>
);

const TYPE_LABEL: Record<string, string> = {
  PHOTO_GALLERY:  "Photo gallery",
  HIGHLIGHT_FILM: "Highlight film",
  TEASER:         "Teaser",
  RAW_FOOTAGE:    "Raw footage",
};

export type TimelineRow = {
  id: string;
  bookingId: string;
  clientName: string;
  type: DeliverableType | string;
  eventDate?: string | null;
  dueDate?: string | null;
  status: DeliverableStatus;
};

export function ProductionTimeline({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
        <h2 className="text-base font-semibold text-brand-navy">Production Timeline</h2>
        <Link href="/deliverables" className="text-xs text-brand-teal hover:underline font-medium">
          View all →
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5 border-b border-brand-pale-blue bg-brand-pale-blue/10">
        {STAGES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="divide-y divide-brand-pale-blue">
        {rows.map((r) => {
          const stageIdx  = STAGE_INDEX[r.status] ?? 0;
          const dueDate   = r.dueDate ? new Date(r.dueDate) : null;
          const daysLeft  = dueDate ? Math.round((dueDate.getTime() - Date.now()) / 86400000) : null;
          const overdue   = daysLeft !== null && daysLeft < 0;
          const dueSoon   = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

          return (
            <Link
              key={r.id}
              href={`/bookings/${r.bookingId}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-brand-pale-blue/20 transition-colors"
            >
              <div className="w-32 sm:w-40 shrink-0 min-w-0">
                <p className="text-sm font-medium truncate">{r.clientName}</p>
                <p className="text-xs text-gray-400 truncate">
                  {TYPE_LABEL[r.type] ?? r.type}
                  {r.eventDate && <> · {formatDate(r.eventDate).replace(/,? \d{4}$/, "")}</>}
                </p>
              </div>

              <div className="flex-1 min-w-[120px]">
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                  {STAGES.map((s, i) => (
                    <div key={s.key} className={`flex-1 ${i <= stageIdx ? s.color : "bg-gray-100"}`} />
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{STAGES[stageIdx].label}</p>
              </div>

              <div className="w-24 sm:w-28 text-right shrink-0">
                <p className={`text-xs font-medium ${overdue ? "text-red-600" : dueSoon ? "text-amber-700" : "text-gray-500"}`}>
                  {r.dueDate ? formatDate(r.dueDate) : "No due date"}
                </p>
                {daysLeft !== null && (
                  <p className={`text-[11px] ${overdue ? "text-red-500" : "text-gray-400"}`}>
                    {overdue
                      ? `${Math.abs(daysLeft)}d overdue`
                      : daysLeft === 0
                      ? "Due today"
                      : `${daysLeft}d left`}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
