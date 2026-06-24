"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeclineEnquiryButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDecline() {
    if (!confirm("Remove this enquiry? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch("/api/enquiries/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (res.ok) {
      router.push("/enquiries");
      router.refresh();
    } else {
      alert("Failed to decline enquiry. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDecline}
      disabled={loading}
      className="flex items-center gap-1.5 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
    >
      <Trash2 size={14} />
      {loading ? "Removing…" : "Decline"}
    </button>
  );
}
