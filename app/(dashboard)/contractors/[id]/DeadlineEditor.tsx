"use client";
// Inline, click-to-edit Deadline cell for one row of the Booking Assignments
// table on the contractor detail page. Click the date (or "—") to swap in a
// native date input; it saves as soon as a complete date is entered, through
// the same PATCH endpoint the booking detail page's inline deadline edit
// uses, and reverts on failure — same optimistic pattern as PaidToggle.tsx
// in this folder.
//
// Saves on onChange rather than onBlur: a native <input type="date"> only
// reports a non-empty value once every segment (day/month/year) is filled
// in, and onChange only fires at that point — so it's the reliable "the
// user picked a real date" signal (same trigger DeliverableStatusSelect.tsx
// uses for its dropdown). Saving on blur instead was the original bug here:
// clicking away before finishing all three segments delivers an empty
// value, which matched the empty "no deadline yet" starting state, so the
// save() guard silently treated it as "nothing changed" and never sent the
// request at all.
//
// Once work has been marked received (work_received_at set), the deadline
// becomes historical record-keeping rather than something to keep nudging —
// this cell shows "Received <date>" read-only here, same as the static
// version did. Changing it after the fact still works from the booking
// detail page's edit form, which explicitly warns about overwriting the
// original agreed date.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

export function DeadlineEditor({
  bookingId,
  assignmentId,
  initialDeadline,
  workReceivedAt,
}: {
  bookingId: string;
  assignmentId: string;
  initialDeadline: string | null;
  workReceivedAt: string | null;
}) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(initialDeadline ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(next: string) {
    const prev = deadline;
    const normalized = next || "";
    if (normalized === prev) {
      setEditing(false);
      return;
    }
    setDeadline(normalized); // optimistic
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: normalized || null }),
      });
      if (!res.ok) throw new Error("Failed to update deadline");
      setEditing(false);
      router.refresh();
    } catch {
      setDeadline(prev); // revert on failure
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (workReceivedAt) {
    return (
      <span className="text-green-700 font-medium text-sm">
        Received {formatDate(workReceivedAt)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={deadline}
        disabled={saving}
        onChange={(e) => {
          // Native date inputs only fire onChange once a complete date is
          // picked, so this is exactly the "user chose a real date" signal
          // — no empty/partial value ever reaches save() here.
          if (e.target.value) save(e.target.value);
        }}
        onBlur={(e) => {
          // Clicked/tabbed away without finishing the date (still empty) —
          // just close the editor, nothing to save.
          if (!e.target.value) setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className="input text-sm py-0.5 px-1.5 w-[9.5rem] disabled:opacity-60"
      />
    );
  }

  const overdue = !!deadline &&
    new Date(`${deadline}T00:00:00`) < new Date(new Date().toDateString());

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={deadline ? "Click to change deadline" : "Click to set a deadline"}
      className={`text-sm hover:underline underline-offset-2 ${
        overdue ? "text-red-600 font-medium" : deadline ? "text-gray-600" : "text-gray-300"
      }`}
    >
      {deadline ? `${formatDate(deadline)}${overdue ? " (overdue)" : ""}` : "—"}
    </button>
  );
}
