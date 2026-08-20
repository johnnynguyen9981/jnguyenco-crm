"use client";
// app/(dashboard)/bookings/[id]/ContractorAssignment.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Loader2, Check, FileText, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type ContractorRole = "PHOTOGRAPHER" | "VIDEOGRAPHER" | "BOTH" | "PHOTO_EDITOR" | "OTHER";
type RateType = "HOURLY" | "PER_PROJECT";

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

// Photographers/videographers are conventionally paid per hour of coverage;
// photo editors (and anything uncategorised) are conventionally a flat
// per-project/per-delivery fee. Used only as a starting default — always
// user-editable.
function defaultRateTypeForRole(role: string): RateType {
  return role === "PHOTOGRAPHER" || role === "VIDEOGRAPHER" || role === "BOTH"
    ? "HOURLY"
    : "PER_PROJECT";
}

/** "14:00" or "14:00:00" -> "2:00 PM" */
function formatTimeLabel(t?: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${period}`;
}

/** Decimal hours between two "HH:MM" strings, or null if invalid/non-positive. */
function hoursBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return diff > 0 ? diff : null;
}

interface Assignment {
  id: string;
  role: string;
  agreed_rate: number | null;
  rate_type?: RateType | null;
  coverage_start_time?: string | null;
  coverage_end_time?: string | null;
  deadline?: string | null;
  confirmed: boolean;
  paid: boolean;
  contractors: { id: string; first_name: string; last_name: string; role: string } | null;
}

/** "2026-08-25" -> "25 Aug 2026" */
function formatDeadlineLabel(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(d?: string | null): boolean {
  if (!d) return false;
  const dt = new Date(`${d}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt.getTime() < today.getTime();
}

interface AvailableContractor {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  rate_type?: RateType | null;
  default_rate?: number | null;
}

export function ContractorAssignment({
  bookingId,
  assignments,
  availableContractors,
  bookingStartTime,
  bookingEndTime,
}: {
  bookingId: string;
  assignments: Assignment[];
  availableContractors: AvailableContractor[];
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [contractorId, setContractorId] = useState("");
  const [role, setRole] = useState<ContractorRole>("PHOTOGRAPHER");
  const [rateType, setRateType] = useState<RateType>("HOURLY");
  const [agreedRate, setAgreedRate] = useState("");
  const [coverageStart, setCoverageStart] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [deadline, setDeadline] = useState("");

  const [callSheetId, setCallSheetId] = useState<string | null>(null);
  const [callSheetError, setCallSheetError] = useState<string | null>(null);

  // Inline edit (rate/coverage only — role & contractor are fixed once assigned)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRateType, setEditRateType] = useState<RateType>("HOURLY");
  const [editAgreedRate, setEditAgreedRate] = useState("");
  const [editCoverageStart, setEditCoverageStart] = useState("");
  const [editCoverageEnd, setEditCoverageEnd] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function selectContractor(id: string) {
    setContractorId(id);
    const c = availableContractors.find((c) => c.id === id);
    if (!c) return;
    const r = ["PHOTOGRAPHER", "VIDEOGRAPHER", "BOTH", "PHOTO_EDITOR", "OTHER"].includes(c.role)
      ? (c.role as ContractorRole)
      : "PHOTOGRAPHER";
    setRole(r);
    const rt = c.rate_type === "HOURLY" || c.rate_type === "PER_PROJECT" ? c.rate_type : defaultRateTypeForRole(r);
    setRateType(rt);
    setAgreedRate(c.default_rate != null ? String(c.default_rate) : "");
    if (rt === "HOURLY") {
      setCoverageStart(bookingStartTime ?? "");
      setCoverageEnd(bookingEndTime ?? "");
    } else {
      setCoverageStart("");
      setCoverageEnd("");
    }
  }

  function changeRole(r: ContractorRole) {
    setRole(r);
    const rt = defaultRateTypeForRole(r);
    setRateType(rt);
    if (rt === "HOURLY" && !coverageStart && !coverageEnd) {
      setCoverageStart(bookingStartTime ?? "");
      setCoverageEnd(bookingEndTime ?? "");
    }
  }

  function changeRateType(rt: RateType) {
    setRateType(rt);
    if (rt === "HOURLY") {
      setCoverageStart((s) => s || bookingStartTime || "");
      setCoverageEnd((s) => s || bookingEndTime || "");
    }
  }

  const newAssignHours = rateType === "HOURLY" ? hoursBetween(coverageStart, coverageEnd) : null;
  const newAssignTotal = newAssignHours != null && agreedRate ? newAssignHours * parseFloat(agreedRate) : null;

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
          rate_type: rateType,
          coverage_start_time: rateType === "HOURLY" && coverageStart ? coverageStart : null,
          coverage_end_time:   rateType === "HOURLY" && coverageEnd   ? coverageEnd   : null,
          deadline: deadline || null,
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
      setCoverageStart("");
      setCoverageEnd("");
      setDeadline("");
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

  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setEditRateType(a.rate_type === "HOURLY" || a.rate_type === "PER_PROJECT" ? a.rate_type : defaultRateTypeForRole(a.role));
    setEditAgreedRate(a.agreed_rate != null ? String(a.agreed_rate) : "");
    setEditCoverageStart(a.coverage_start_time?.slice(0, 5) ?? "");
    setEditCoverageEnd(a.coverage_end_time?.slice(0, 5) ?? "");
    setEditDeadline(a.deadline ?? "");
  }

  const editHours = editRateType === "HOURLY" ? hoursBetween(editCoverageStart, editCoverageEnd) : null;
  const editTotal = editHours != null && editAgreedRate ? editHours * parseFloat(editAgreedRate) : null;

  async function saveEdit(assignmentId: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreed_rate: editAgreedRate ? parseFloat(editAgreedRate) : null,
          rate_type: editRateType,
          coverage_start_time: editRateType === "HOURLY" && editCoverageStart ? editCoverageStart : null,
          coverage_end_time:   editRateType === "HOURLY" && editCoverageEnd   ? editCoverageEnd   : null,
          deadline: editDeadline || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save changes.");
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function downloadCallSheet(assignmentId: string, name: string) {
    setCallSheetId(assignmentId);
    setCallSheetError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contractors/${assignmentId}/call-sheet`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed to generate call sheet." }));
        throw new Error(j.error ?? "Failed to generate call sheet.");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const cd   = res.headers.get("content-disposition") ?? "";
      const m    = cd.match(/filename="([^"]+)"/);
      a.download = m?.[1] ?? `Call_Sheet_${name.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setCallSheetError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCallSheetId(null);
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

  const ic = "input w-full text-sm";

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

      {callSheetError && <p className="text-xs text-red-600">{callSheetError}</p>}
      {error && !showForm && <p className="text-xs text-red-600">{error}</p>}

      {assignments.length === 0 ? (
        <p className="text-xs text-gray-400">No crew assigned to this booking yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const c = a.contractors;
            const name = c ? `${c.first_name} ${c.last_name}` : "Unknown contractor";
            const isBusy = busyId === a.id;
            const isEditing = editingId === a.id;
            const coverageLabel = a.coverage_start_time && a.coverage_end_time
              ? `${formatTimeLabel(a.coverage_start_time)} – ${formatTimeLabel(a.coverage_end_time)}`
              : null;
            const rateLabel = a.agreed_rate != null
              ? `${formatCurrency(a.agreed_rate)}${a.rate_type === "HOURLY" ? "/hr" : ""}`
              : "—";

            return (
              <div key={a.id} className="py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-start justify-between text-sm">
                  <div>
                    {c ? (
                      <Link href={`/contractors/${c.id}`} className="font-medium hover:text-brand-teal hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <p className="font-medium">{name}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {ROLE_LABELS[a.role] ?? a.role}
                      {a.rate_type === "PER_PROJECT" && " · flat fee"}
                    </p>
                    {coverageLabel && (
                      <p className="text-xs text-gray-400">Coverage: {coverageLabel}</p>
                    )}
                    {a.deadline && (
                      <p className={`text-xs ${isOverdue(a.deadline) ? "text-red-600 font-medium" : "text-gray-400"}`}>
                        Deadline: {formatDeadlineLabel(a.deadline)}{isOverdue(a.deadline) && " (overdue)"}
                      </p>
                    )}
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
                    <p className="font-medium">{rateLabel}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingId(null) : startEdit(a))}
                        className="text-gray-300 hover:text-brand-teal"
                        title="Edit rate & coverage"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={callSheetId === a.id}
                        onClick={() => downloadCallSheet(a.id, name)}
                        className="text-xs text-brand-teal hover:underline flex items-center gap-1 disabled:opacity-50"
                        title="Generate call sheet"
                      >
                        {callSheetId === a.id
                          ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                          : <><FileText size={12} /> Call Sheet</>
                        }
                      </button>
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
                </div>

                {isEditing && (
                  <div className="mt-2 p-2.5 rounded-lg bg-gray-50 space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRateType("HOURLY")}
                        className={`flex-1 text-xs py-1.5 rounded border ${editRateType === "HOURLY" ? "border-brand-teal bg-brand-teal/10 text-brand-navy font-medium" : "border-gray-200 text-gray-500"}`}
                      >
                        Per Hour
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRateType("PER_PROJECT")}
                        className={`flex-1 text-xs py-1.5 rounded border ${editRateType === "PER_PROJECT" ? "border-brand-teal bg-brand-teal/10 text-brand-navy font-medium" : "border-gray-200 text-gray-500"}`}
                      >
                        Per Project
                      </button>
                    </div>
                    <div>
                      <label className="label text-xs">
                        {editRateType === "HOURLY" ? "Rate ($/hr)" : "Flat fee (AUD)"}
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        className={ic}
                        placeholder="0.00"
                        value={editAgreedRate}
                        onChange={(e) => setEditAgreedRate(e.target.value)}
                      />
                    </div>
                    {editRateType === "HOURLY" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label text-xs">Coverage Start</label>
                          <input type="time" className={ic} value={editCoverageStart}
                            onChange={(e) => setEditCoverageStart(e.target.value)} />
                        </div>
                        <div>
                          <label className="label text-xs">Coverage End</label>
                          <input type="time" className={ic} value={editCoverageEnd}
                            onChange={(e) => setEditCoverageEnd(e.target.value)} />
                        </div>
                      </div>
                    )}
                    {editTotal != null && (
                      <p className="text-xs text-gray-500">
                        {editHours} hrs × {formatCurrency(parseFloat(editAgreedRate))}/hr = <span className="font-medium text-brand-navy">{formatCurrency(editTotal)}</span>
                      </p>
                    )}
                    <div>
                      <label className="label text-xs">Deadline (internal — when this work is due back)</label>
                      <input type="date" className={ic} value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={editSaving}
                        onClick={() => saveEdit(a.id)}
                        className="btn-primary py-1 text-xs"
                      >
                        {editSaving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Check size={12} /> Save</>}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary py-1 text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
              className={ic}
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

          <div>
            <label className="label text-xs">Role for this booking</label>
            <select
              className={ic}
              value={role}
              onChange={(e) => changeRole(e.target.value as ContractorRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs">How are they paid?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changeRateType("HOURLY")}
                className={`flex-1 text-xs py-1.5 rounded border ${rateType === "HOURLY" ? "border-brand-teal bg-brand-teal/10 text-brand-navy font-medium" : "border-gray-200 text-gray-500"}`}
              >
                Per Hour
              </button>
              <button
                type="button"
                onClick={() => changeRateType("PER_PROJECT")}
                className={`flex-1 text-xs py-1.5 rounded border ${rateType === "PER_PROJECT" ? "border-brand-teal bg-brand-teal/10 text-brand-navy font-medium" : "border-gray-200 text-gray-500"}`}
              >
                Per Project
              </button>
            </div>
          </div>

          <div>
            <label className="label text-xs">
              {rateType === "HOURLY" ? "Agreed Rate ($/hr)" : "Agreed Flat Fee (AUD)"}
            </label>
            <input
              type="number" step="0.01" min="0"
              className={ic}
              placeholder="0.00"
              value={agreedRate}
              onChange={(e) => setAgreedRate(e.target.value)}
            />
          </div>

          {rateType === "HOURLY" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Coverage Start</label>
                <input type="time" className={ic} value={coverageStart}
                  onChange={(e) => setCoverageStart(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Coverage End</label>
                <input type="time" className={ic} value={coverageEnd}
                  onChange={(e) => setCoverageEnd(e.target.value)} />
              </div>
              {(bookingStartTime || bookingEndTime) && (
                <p className="col-span-2 text-[11px] text-gray-400">
                  Defaults to the booking&apos;s own time ({formatTimeLabel(bookingStartTime ?? undefined)} – {formatTimeLabel(bookingEndTime ?? undefined)}) — adjust if this crew member only covers part of the event.
                </p>
              )}
            </div>
          )}

          {newAssignTotal != null && (
            <p className="text-xs text-gray-500">
              {newAssignHours} hrs × {formatCurrency(parseFloat(agreedRate))}/hr = <span className="font-medium text-brand-navy">{formatCurrency(newAssignTotal)}</span>
            </p>
          )}

          <div>
            <label className="label text-xs">Deadline (internal — when this work is due back, optional)</label>
            <input type="date" className={ic} value={deadline}
              onChange={(e) => setDeadline(e.target.value)} />
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
