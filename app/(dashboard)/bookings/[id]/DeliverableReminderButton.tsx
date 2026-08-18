"use client";
// Small inline control shown next to each deliverable's due date on the
// booking detail page. Lets Johnny push (or re-push) a due-date reminder to
// the shared Google Calendar for a single deliverable — used as a manual
// fallback for whenever the automatic sync (on deliverable creation) didn't
// run, e.g. Google wasn't connected yet at the time.
import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

type Props = {
  deliverableId: string;
  synced: boolean;
};

export function DeliverableReminderButton({ deliverableId, synced }: Props) {
  const [loading,  setLoading]  = useState(false);
  const [isSynced, setIsSynced] = useState(synced);
  const [error,    setError]    = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/google/calendar/sync-deliverable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deliverable_id: deliverableId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add reminder");
      setIsSynced(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (isSynced) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
        <BellRing size={11} /> Reminder set
      </span>
    );
  }

  return (
    <button
      onClick={sync}
      disabled={loading}
      title={error ?? "Add a due-date reminder to Google Calendar"}
      className="inline-flex items-center gap-1 text-[11px] text-brand-teal hover:underline disabled:opacity-50"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
      {loading ? "Adding…" : error ? "Retry reminder" : "Add reminder"}
    </button>
  );
}
