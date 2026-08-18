"use client";
// One-click bulk action on the Deliverables list page: walks every booking
// that's actually going ahead, sets up any missing deliverable due dates
// from its package, and pushes each to Google Calendar as a reminder.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";

export function GenerateAllButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch("/api/bookings/generate-all-deliverables", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const {
        bookings_checked, bookings_with_new_deliverables,
        deliverables_created, calendar_synced, google_connected, failed,
      } = data.data;

      if (deliverables_created === 0) {
        setResult(`Checked ${bookings_checked} booking${bookings_checked !== 1 ? "s" : ""} — all already have deadlines set ✓`);
      } else {
        setResult(
          `${deliverables_created} deadline${deliverables_created !== 1 ? "s" : ""} set across ${bookings_with_new_deliverables} booking${bookings_with_new_deliverables !== 1 ? "s" : ""}` +
          (google_connected ? ` · ${calendar_synced} Calendar reminder${calendar_synced !== 1 ? "s" : ""} added` : " · connect Google in Settings to add Calendar reminders") +
          (failed > 0 ? ` · ${failed} booking${failed !== 1 ? "s" : ""} failed` : "")
        );
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={run}
        disabled={loading}
        className="btn-secondary text-sm flex items-center gap-1.5"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
        {loading ? "Setting up deadlines…" : "Set up deadlines for all bookings"}
      </button>
      {result && <p className="text-xs text-gray-500">{result}</p>}
      {error  && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
