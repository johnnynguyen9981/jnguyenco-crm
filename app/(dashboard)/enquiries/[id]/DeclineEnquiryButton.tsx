"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

// Two-step, in-page confirmation. We don't use window.confirm(): some browsers (including
// embedded/in-app browsers) block native pop-ups, which made Decline silently do nothing.
export function DeclineEnquiryButton({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDecline() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/enquiries/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        router.push("/enquiries");
        router.refresh();
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to decline enquiry. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        Decline
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-700 font-medium">Remove this enquiry and its booking? This can&apos;t be undone.</span>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(""); }}
          disabled={loading}
          className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={loading}
          className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
        >
          <Trash2 size={14} />
          {loading ? "Removing…" : "Yes, remove"}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
