"use client";
// Inline, auto-saving status dropdown for a single deliverable. Used on the
// Deliverables list page and the booking detail page's Deliverables section.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeliverableStatus } from "@/lib/supabase/types";

const STATUS_BADGE: Record<DeliverableStatus, string> = {
  NOT_STARTED:      "badge badge-inquiry",
  CULLING:          "badge badge-quoted",
  EDITING:          "badge badge-contracted",
  READY:            "badge badge-confirmed",
  DELIVERED:        "badge badge-completed",
  CLIENT_APPROVED:  "badge badge-completed",
};

const STATUS_LABEL: Record<DeliverableStatus, string> = {
  NOT_STARTED:      "Not started",
  CULLING:          "Culling",
  EDITING:          "Editing",
  READY:            "Ready",
  DELIVERED:        "Delivered",
  CLIENT_APPROVED:  "Client approved",
};

const ALL_STATUSES: DeliverableStatus[] = [
  "NOT_STARTED", "CULLING", "EDITING", "READY", "DELIVERED", "CLIENT_APPROVED",
];

export function DeliverableStatusSelect({
  deliverableId,
  currentStatus,
}: {
  deliverableId: string;
  currentStatus: DeliverableStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: DeliverableStatus) {
    const prev = status;
    setStatus(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      setStatus(prev); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value as DeliverableStatus)}
      className={`${STATUS_BADGE[status]} border-0 cursor-pointer pr-6 disabled:opacity-60`}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s} className="text-gray-900 bg-white font-normal">
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
