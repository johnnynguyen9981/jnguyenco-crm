"use client";
// app/(dashboard)/contractors/new/page.tsx — Add new contractor
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import type { ContractorRole, ContractorRateType } from "@/lib/supabase/types";

const ROLE_OPTIONS: { value: ContractorRole; label: string }[] = [
  { value: "PHOTO_EDITOR", label: "Photo Editor" },
  { value: "PHOTOGRAPHER", label: "Photographer" },
  { value: "VIDEOGRAPHER", label: "Videographer" },
  { value: "BOTH",         label: "Photographer & Videographer" },
  { value: "OTHER",        label: "Other" },
];

const ic = "input w-full";

export default function NewContractorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name:  "",
    email:      "",
    phone:      "",
    role:       "PHOTO_EDITOR" as ContractorRole,
    rate_type:  "PER_PROJECT" as ContractorRateType,
    default_rate: "",
    start_date: "",
    notes:      "",
  });

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:   form.first_name.trim(),
          last_name:    form.last_name.trim(),
          email:        form.email.trim()      || null,
          phone:        form.phone.trim()      || null,
          role:         form.role,
          rate_type:    form.rate_type,
          default_rate: form.default_rate ? parseFloat(form.default_rate) : null,
          start_date:   form.start_date        || null,
          notes:        form.notes.trim()      || null,
          is_active:    true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create contractor.");
        return;
      }

      router.push(`/contractors/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href="/contractors" className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Add New Contractor</h1>
          <p className="text-xs text-brand-teal">Save their details, then generate an agreement from their profile.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Contact Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className={ic} value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className={ic} value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className={ic} value={form.email}
                onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={ic} placeholder="04XX XXX XXX" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Role &amp; Rate
          </h2>

          <div>
            <label className="label">Role</label>
            <select className={ic} value={form.role}
              onChange={(e) => set("role", e.target.value as ContractorRole)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Rate Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => set("rate_type", "HOURLY")}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.rate_type === "HOURLY"
                    ? "border-brand-teal bg-brand-teal text-white"
                    : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600"
                }`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => set("rate_type", "PER_PROJECT")}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.rate_type === "PER_PROJECT"
                    ? "border-brand-teal bg-brand-teal text-white"
                    : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600"
                }`}
              >
                Per Project
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Rate (AUD) {form.rate_type === "HOURLY" ? "per hour" : "per project"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  placeholder="0.00" value={form.default_rate}
                  onChange={(e) => set("default_rate", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className={ic} value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Notes <span className="text-gray-400 font-normal">(optional — used to fill the agreement's scope section)</span></label>
            <textarea rows={3} className={ic + " resize-y"}
              placeholder="e.g. Editing all wedding galleries within 2 weeks of raw file handoff..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 pb-10">
          <Link href="/contractors" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary min-w-[140px] justify-center">
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Check size={15} /> Create Contractor</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}
