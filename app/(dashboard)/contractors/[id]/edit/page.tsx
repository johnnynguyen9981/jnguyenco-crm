"use client";
// app/(dashboard)/contractors/[id]/edit/page.tsx
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { ContractorRole, ContractorRateType } from "@/lib/supabase/types";

const ROLE_OPTIONS: { value: ContractorRole; label: string }[] = [
  { value: "PHOTO_EDITOR", label: "Photo Editor" },
  { value: "PHOTOGRAPHER", label: "Photographer" },
  { value: "VIDEOGRAPHER", label: "Videographer" },
  { value: "BOTH",         label: "Photographer & Videographer" },
  { value: "OTHER",        label: "Other" },
];

const ic = "input w-full";

export default function EditContractorPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const [form, setForm] = useState({
    first_name:   "",
    last_name:    "",
    email:        "",
    phone:        "",
    role:         "PHOTO_EDITOR" as ContractorRole,
    rate_type:    "PER_PROJECT" as ContractorRateType,
    default_rate: "",
    start_date:   "",
    notes:        "",
    is_active:    true,
  });

  useEffect(() => {
    fetch(`/api/contractors/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d.data ?? d;
        setForm({
          first_name:   c.first_name   ?? "",
          last_name:    c.last_name    ?? "",
          email:        c.email        ?? "",
          phone:        c.phone        ?? "",
          role:         c.role         ?? "PHOTO_EDITOR",
          rate_type:    c.rate_type    ?? "PER_PROJECT",
          default_rate: c.default_rate != null ? String(c.default_rate) : "",
          start_date:   c.start_date   ?? "",
          notes:        c.notes        ?? "",
          is_active:    c.is_active    ?? true,
        });
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load contractor.");
        setLoading(false);
      });
  }, [id]);

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

    setSaving(true);
    try {
      const res = await fetch(`/api/contractors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:   form.first_name.trim(),
          last_name:    form.last_name.trim(),
          email:        form.email.trim() || null,
          phone:        form.phone.trim() || null,
          role:         form.role,
          rate_type:    form.rate_type,
          default_rate: form.default_rate ? parseFloat(form.default_rate) : null,
          start_date:   form.start_date || null,
          notes:        form.notes.trim() || null,
          is_active:    form.is_active,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save changes.");
        return;
      }

      router.push(`/contractors/${id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href={`/contractors/${id}`} className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Edit Contractor</h1>
          <p className="text-xs text-brand-teal">{form.first_name} {form.last_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
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
              <input className={ic} value={form.phone}
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
              <button type="button" onClick={() => set("rate_type", "HOURLY")}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.rate_type === "HOURLY" ? "border-brand-teal bg-brand-teal text-white" : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600"
                }`}>
                Hourly
              </button>
              <button type="button" onClick={() => set("rate_type", "PER_PROJECT")}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.rate_type === "PER_PROJECT" ? "border-brand-teal bg-brand-teal text-white" : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600"
                }`}>
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
            <label className="label">Notes</label>
            <textarea rows={3} className={ic + " resize-y"}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Changes</>
            }
          </button>
          <Link href={`/contractors/${id}`} className="btn-secondary">Cancel</Link>
        </div>

      </form>
    </div>
  );
}
