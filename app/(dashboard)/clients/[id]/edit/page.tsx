"use client";
// app/(dashboard)/clients/[id]/edit/page.tsx
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { ReferralSource } from "@/lib/supabase/types";

const ic = "input w-full";

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const [form, setForm] = useState({
    first_name:       "",
    last_name:        "",
    email:            "",
    phone:            "",
    instagram_handle: "",
    address:          "",
    referral_source:  "" as ReferralSource | "",
    referral_notes:   "",
    partner_first:    "",
    partner_last:     "",
    partner_email:    "",
    partner_phone:    "",
  });

  // Load existing client data
  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d.data ?? d;
        setForm({
          first_name:       c.first_name       ?? "",
          last_name:        c.last_name        ?? "",
          email:            c.email            ?? "",
          phone:            c.phone            ?? "",
          instagram_handle: c.instagram_handle ?? "",
          address:          c.address          ?? "",
          referral_source:  c.referral_source  ?? "",
          referral_notes:   c.referral_notes   ?? "",
          partner_first:    c.partner_first    ?? "",
          partner_last:     c.partner_last     ?? "",
          partner_email:    c.partner_email    ?? "",
          partner_phone:    c.partner_phone    ?? "",
        });
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load client.");
        setLoading(false);
      });
  }, [id]);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:       form.first_name.trim(),
          last_name:        form.last_name.trim(),
          email:            form.email.trim(),
          phone:            form.phone            || null,
          instagram_handle: form.instagram_handle || null,
          address:          form.address          || null,
          referral_source:  form.referral_source  || null,
          referral_notes:   form.referral_notes   || null,
          partner_first:    form.partner_first    || null,
          partner_last:     form.partner_last     || null,
          partner_email:    form.partner_email    || null,
          partner_phone:    form.partner_phone    || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save changes.");
        return;
      }

      setSuccess(true);
      router.push(`/clients/${id}`);
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
      {/* Header */}
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href={`/clients/${id}`} className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Edit Client</h1>
          <p className="text-xs text-brand-teal">
            {form.first_name} {form.last_name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Contact Details ──────────────────────────────────────────── */}
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

          <div>
            <label className="label">Email Address *</label>
            <input type="email" className={ic} value={form.email}
              onChange={(e) => set("email", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number</label>
              <input className={ic} placeholder="04XX XXX XXX" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Instagram Handle</label>
              <input className={ic} placeholder="@handle" value={form.instagram_handle}
                onChange={(e) => set("instagram_handle", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <input className={ic} placeholder="e.g. 12 Smith St, Canberra ACT 2601"
              value={form.address}
              onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>

        {/* ── Referral ─────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Referral
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">How did they find us?</label>
              <select className={ic} value={form.referral_source}
                onChange={(e) => set("referral_source", e.target.value as ReferralSource | "")}>
                <option value="">Select source…</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="GOOGLE">Google Search</option>
                <option value="WORD_OF_MOUTH">Word of Mouth</option>
                <option value="WEDDING_WIRE">Wedding Wire</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Referral Notes</label>
              <input className={ic} placeholder="e.g. Referred by Sarah & Tom"
                value={form.referral_notes}
                onChange={(e) => set("referral_notes", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Partner / Spouse ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Partner / Spouse{" "}
            <span className="text-gray-400 font-normal normal-case">(optional)</span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input className={ic} value={form.partner_first}
                onChange={(e) => set("partner_first", e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className={ic} value={form.partner_last}
                onChange={(e) => set("partner_last", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className={ic} value={form.partner_email}
                onChange={(e) => set("partner_email", e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={ic} value={form.partner_phone}
                onChange={(e) => set("partner_phone", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Changes</>
            }
          </button>
          <Link href={`/clients/${id}`} className="btn-secondary">Cancel</Link>
        </div>

      </form>
    </div>
  );
}
