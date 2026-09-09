"use client";
// Inline, click-to-toggle Paid/Unpaid badge for one row of the Booking
// Assignments table on the contractor detail page. Hits the same PATCH
// endpoint and follows the same optimistic-update/revert-on-failure
// pattern as the Paid badge on the booking detail page (see
// ContractorAssignment.tsx's toggle()) and DeliverableStatusSelect.tsx —
// so marking paid here also auto-records/removes the linked Expense via
// that endpoint's syncContractorPaymentExpense, exactly as it would from
// the booking page.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PaidToggle({
  bookingId,
  assignmentId,
  initialPaid,
}: {
  bookingId: string;
  assignmentId: string;
  initialPaid: boolean;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(initialPaid);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const prev = paid;
    const next = !paid;
    setPaid(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: next }),
      });
      if (!res.ok) throw new Error("Failed to update paid status");
      router.refresh();
    } catch {
      setPaid(prev); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={toggle}
      title={paid ? "Click to mark unpaid" : "Click to mark paid"}
      className={`badge text-xs cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
        paid ? "badge-confirmed" : "badge-pending"
      }`}
    >
      {saving ? "…" : paid ? "Paid" : "Unpaid"}
    </button>
  );
}
