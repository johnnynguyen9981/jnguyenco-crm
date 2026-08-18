"use client";
// Mobile-first, tickable night-before checklist. Optimistic UI — taps feel
// instant, each toggle fires a best-effort PATCH in the background and
// rolls back locally if it fails. State lives on the booking row, so it's
// safe to close the tab and come back (or open on a different device).
import { useMemo, useState, useTransition } from "react";
import { formatDate } from "@/lib/utils";
import type { ChecklistSection } from "@/lib/checklist/nightBeforeItems";
import { Check } from "lucide-react";

const NAVY = "#083a4f";
const TEAL = "#407e8c";
const GOLD = "#a58d66";

type Props = {
  bookingId:    string;
  clientName:   string;
  eventDate:    string;
  sections:     ChecklistSection[];
  initialState: Record<string, boolean>;
};

function daysUntilLabel(eventDate: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate + "T00:00:00");
  const diffDays = Math.round((event.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0)  return "Today";
  if (diffDays === 1)  return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1)    return `In ${diffDays} days`;
  return "Past event";
}

export function ChecklistClient({ bookingId, clientName, eventDate, sections, initialState }: Props) {
  const [state, setState]     = useState<Record<string, boolean>>(initialState);
  const [error, setError]     = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  const totalItems  = useMemo(() => sections.reduce((n, s) => n + s.items.length, 0), [sections]);
  const checkedCount = useMemo(
    () => sections.reduce((n, s) => n + s.items.filter(i => state[i.key]).length, 0),
    [sections, state]
  );
  const progress = totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100);
  const allDone  = checkedCount === totalItems;

  async function toggle(key: string) {
    const next = !state[key];
    setState(prev => ({ ...prev, [key]: next })); // optimistic
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/checklist`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key, checked: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setState(prev => ({ ...prev, [key]: !next })); // roll back
      setError("Couldn't save that — check your connection and try again.");
    }
  }

  async function reset() {
    if (!confirm("Reset the whole checklist? This unticks everything.")) return;
    const prev = state;
    setState({});
    try {
      const res = await fetch(`/api/bookings/${bookingId}/checklist`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reset: true }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setState(prev);
      setError("Couldn't reset — check your connection and try again.");
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f8f6" }}>
      {/* Sticky header */}
      <div
        style={{ background: NAVY, position: "sticky", top: 0, zIndex: 10 }}
        className="px-4 pt-5 pb-4 shadow-md"
      >
        <p className="text-[11px] uppercase tracking-wide" style={{ color: GOLD }}>
          Night-before checklist
        </p>
        <h1 className="text-white text-xl font-bold leading-tight mt-0.5">{clientName}</h1>
        <p className="text-sm mt-0.5" style={{ color: "#c0d5d6" }}>
          {formatDate(eventDate)} &nbsp;·&nbsp; {daysUntilLabel(eventDate)}
        </p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#c0d5d6" }}>
            <span>{checkedCount} / {totalItems} packed</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: allDone ? "#6fcf97" : GOLD }}
            />
          </div>
        </div>
      </div>

      {allDone && (
        <div className="mx-4 mt-4 rounded-lg px-4 py-3 text-sm font-medium text-center"
          style={{ background: "#f0faf4", border: "1px solid #6fcf97", color: "#27ae60" }}>
          ✅ All packed — you're ready. Have a great shoot!
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffc107" }}>
          {error}
        </div>
      )}

      {/* Sections */}
      <div className="px-4 pb-28 pt-4 space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <h2 className="text-xs font-bold uppercase tracking-wide mb-1.5 px-1" style={{ color: TEAL }}>
              {section.title}
            </h2>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#e2e8f0", background: "white" }}>
              {section.items.map((item, i) => {
                const checked = !!state[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => startTransition(() => toggle(item.key))}
                    className="w-full flex items-center gap-3 text-left px-3.5 py-3 active:bg-gray-50"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                      minHeight: 48,
                    }}
                  >
                    <span
                      className="shrink-0 flex items-center justify-center rounded-md transition-colors"
                      style={{
                        width: 24, height: 24,
                        background: checked ? "#083a4f" : "white",
                        border: checked ? "none" : "1.5px solid #cbd5e1",
                      }}
                    >
                      {checked && <Check size={15} color="white" strokeWidth={3} />}
                    </span>
                    <span
                      className="text-sm leading-snug"
                      style={{
                        color: checked ? "#94a3b8" : "#1f2937",
                        textDecoration: checked ? "line-through" : "none",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="pt-2 text-center">
          <button onClick={reset} className="text-xs" style={{ color: "#94a3b8" }}>
            Reset checklist
          </button>
        </div>

        <p className="text-center text-[11px] pt-2" style={{ color: "#c0c8ca" }}>
          JNguyen Co. — tip: add this page to your home screen for one-tap access.
        </p>
      </div>
    </div>
  );
}
