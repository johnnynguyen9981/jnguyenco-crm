"use client";
// app/(dashboard)/bookings/[id]/ContractorAssignment.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type ContractorRole = "PHOTOGRAPHER" | "VIDEOGRAPHER" | "BOTH" | "PHOTO_EDITOR" | "OTHER";

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Other",
};

const ROLE_OPTIONS: { value: ContractorRole; label: string }[] = [
  { value: "PHOTOGRAPHER", label: "Photographer" },
  { value: "VIDEOGRAPHER", label: "Videographer" },
  { value: "BOTH",         label: "Photographer & Videographer" },
  { value: "PHOTO_EDITOR", label: "Photo Editor" },
  { value: "OTHER",        label: "Other" },
];

interface Assignment {
  id: string;
  role: string;
  agreed_rate: number | null;
  confirmed: boolean;
  paid: boolean;
  contractors: { id: string; first_name: string; last_name: string; role: string } | null;
}

interface AvailableContractor {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function ContractorAssignment({
  bookingId,
  assignments,
  availableContractors,
}: {
  bookingId: string;
  assignments: Assignment[];
  availableContractors: AvailableContractor[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [contractorId, setContractorId] = useState("");
  const [role, setRole] = useState<ContractorRole>("PHOTOGRAPHER");
  const [agreedRate, setAgreedRate] = useState("");

  function selectContractor(id: string) {
    setContractorId(id);
    const c = availableContractors.find((c) => c.id === id);
    if (c && ["PHOTOGRAPHER", "VIDEOGRAPHER", "BOTH", "PHOTO_EDITOR", "OTHER"].includes(c.role)) {
      setRole(c.role as ContractorRole);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!contractorId) {
      setError("Select a contractor.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contractors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractor_id: contractorId,
          role,
          agreed_rate: agreedRate ? parseFloat(agreedRate) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to assign contractor.");
        return;
      }
      setShowForm(false);
      setContractorId("");
      setAgreedRate("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(assignmentId: string, field: "confirmed" | "paid", value: boolean) {
    setBusyId(assignmentId);
    try {
      await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(assignmentId: string, name: string) {
    if (!confirm(`Remove ${name} from this booking?`)) return;
    setBusyId(assignmentId);
    try {
      await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Crew / Contractors</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-brand-teal hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Assign
        </button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-xs text-gray-400">No crew assigned to this booking yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const c = a.contractors;
            const name = c ? `${c.first_name} ${c.last_name}` : "Unknown contractor";
            const isBusy = busyId === a.id;
            return (
              <div key={a.id} className="flex items-start justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[a.role] ?? a.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggle(a.id, "confirmed", !a.confirmed)}
                      className={`badge text-xs ${a.confirmed ? "badge-confirmed" : "badge-pending"}`}
                    >
                      {a.confirmed ? "Confirmed" : "Unconfirmed"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggle(a.id, "paid", !a.paid)}
                      className={`badge text-xs ${a.paid ? "badge-confirmed" : "badge-cancelled"}`}
                    >
                      {a.paid ? "Paid" : "Unpaid"}
                    </button>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-medium">{a.agreed_rate != null ? formatCurrency(a.agreed_rate) : "—"}</p>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => remove(a.id, name)}
                    className="text-gray-300 hover:text-red-500"
                    title="Remove"
                  >
                    {isBusy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAssign} className="space-y-2 pt-2 border-t border-gray-100">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <label className="label text-xs">Contractor</label>
            <select
              className="input w-full text-sm"
              value={contractorId}
              onChange={(e) => selectContractor(e.target.value)}
            >
              <option value="">Select a contractor…</option>
              {availableContractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {ROLE_LABELS[c.role] ?? c.role}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Role for this booking</label>
              <select
                className="input w-full text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as ContractorRole)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Agreed rate (AUD)</label>
              <input
                type="number" step="0.01" min="0"
                className="input w-full text-sm"
                placeholder="0.00"
                value={agreedRate}
                onChange={(e) => setAgreedRate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary py-1 text-xs">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Assigning…</> : <><Check size={12} /> Assign</>}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-1 text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}

      {availableContractors.length === 0 && showForm && (
        <p className="text-xs text-gray-400">
          No active contractors yet — add one from the Contractors section first.
        </p>
      )}
    </div>
  );
}
