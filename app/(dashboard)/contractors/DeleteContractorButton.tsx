"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface Props {
  contractorId: string;
  contractorName: string;
  /** If true renders a full-width danger button (for detail page).
   *  If false (default) renders a small icon button (for list row). */
  variant?: "icon" | "button";
}

export function DeleteContractorButton({ contractorId, contractorName, variant = "icon" }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contractors/${contractorId}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push("/contractors");
        router.refresh();
        return;
      }
      const json = await res.json();
      setError(json.error ?? "Delete failed.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {variant === "button" ? (
        <button
          onClick={() => setConfirm(true)}
          className="btn-danger w-full flex items-center justify-center gap-2 text-sm"
        >
          <Trash2 size={14} /> Delete Contractor
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirm(true); }}
          className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
          title="Delete contractor"
        >
          <Trash2 size={14} />
        </button>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !loading && setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-navy">Delete {contractorName}?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently remove their record. Contractors assigned to existing bookings cannot be deleted.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirm(false)}
                disabled={loading}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={14} /> Delete</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
