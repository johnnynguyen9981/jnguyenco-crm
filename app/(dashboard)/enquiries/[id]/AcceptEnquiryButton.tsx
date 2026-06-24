"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export function AcceptEnquiryButton({
  clientId, userId, bookingId,
}: { clientId: string; userId: string; bookingId?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAccept() {
    setLoading(true);
    const res = await fetch("/api/enquiries/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, userId, bookingId }),
    });
    if (res.ok) {
      router.push("/clients");
      router.refresh();
    } else {
      alert("Failed to accept enquiry. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      className="flex items-center gap-1.5 bg-brand-navy text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-navy/90 disabled:opacity-60 transition-colors"
    >
      <CheckCircle size={14} />
      {loading ? "Accepting…" : "Accept & Add Client"}
    </button>
  );
}
