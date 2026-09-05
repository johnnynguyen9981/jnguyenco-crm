"use client";
// app/(dashboard)/packages/[id]/edit/page.tsx — Edit a package
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";

const ic = "input w-full";

interface PackageForm {
  name: string;
  base_price: string;
  max_hours: string;
  includes_photography: boolean;
  includes_videography: boolean;
  photo_count_min: string;
  photo_count_max: string;
  film_duration_min_sec: string;
  film_duration_max_sec: string;
  description: string;
  team: string;
  deliverables: string; // textarea — one bullet per line
  timeline: string;     // textarea — one bullet per line
  is_active: boolean;
}

const EMPTY: PackageForm = {
  name: "", base_price: "", max_hours: "",
  includes_photography: true, includes_videography: false,
  photo_count_min: "", photo_count_max: "",
  film_duration_min_sec: "", film_duration_max_sec: "",
  description: "", team: "", deliverables: "", timeline: "",
  is_active: true,
};

function linesToArray(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

export default function EditPackagePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm]       = useState<PackageForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);

  function set<K extends keyof PackageForm>(field: K, value: PackageForm[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/packages/${id}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to load package.");
          return;
        }
        const pkg = json.package;
        setForm({
          name: pkg.name ?? "",
          base_price: pkg.base_price != null ? String(pkg.base_price) : "",
          max_hours: pkg.max_hours != null ? String(pkg.max_hours) : "",
          includes_photography: !!pkg.includes_photography,
          includes_videography: !!pkg.includes_videography,
          photo_count_min: pkg.photo_count_min != null ? String(pkg.photo_count_min) : "",
          photo_count_max: pkg.photo_count_max != null ? String(pkg.photo_count_max) : "",
          film_duration_min_sec: pkg.film_duration_min_sec != null ? String(pkg.film_duration_min_sec) : "",
          film_duration_max_sec: pkg.film_duration_max_sec != null ? String(pkg.film_duration_max_sec) : "",
          description: pkg.description ?? "",
          team: pkg.team ?? "",
          deliverables: (pkg.deliverables ?? []).join("\n"),
          timeline: (pkg.timeline ?? []).join("\n"),
          is_active: !!pkg.is_active,
        });
      } catch {
        setError("Network error loading package.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Package name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          base_price: form.base_price ? parseFloat(form.base_price) : null,
          max_hours: form.max_hours ? parseInt(form.max_hours, 10) : null,
          includes_photography: form.includes_photography,
          includes_videography: form.includes_videography,
          photo_count_min: form.photo_count_min ? parseInt(form.photo_count_min, 10) : null,
          photo_count_max: form.photo_count_max ? parseInt(form.photo_count_max, 10) : null,
          film_duration_min_sec: form.film_duration_min_sec ? parseInt(form.film_duration_min_sec, 10) : null,
          film_duration_max_sec: form.film_duration_max_sec ? parseInt(form.film_duration_max_sec, 10) : null,
          description: form.description.trim() || null,
          team: form.team.trim() || null,
          deliverables: linesToArray(form.deliverables),
          timeline: linesToArray(form.timeline),
          is_active: form.is_active,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save package.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href="/packages" className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Edit Package</h1>
          <p className="text-xs text-brand-teal">Changes apply to every contract generated from this package going forward.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6 pb-20">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">Saved.</div>
        )}

        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Basics
          </h2>

          <div>
            <label className="label">Name *</label>
            <input className={ic} value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Base Price (AUD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Max Hours <span className="text-gray-400 font-normal">(blank = hourly rate)</span></label>
              <input type="number" min="0" className={ic}
                value={form.max_hours} onChange={(e) => set("max_hours", e.target.value)} />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.includes_photography}
                onChange={(e) => set("includes_photography", e.target.checked)} />
              Includes Photography
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.includes_videography}
                onChange={(e) => set("includes_videography", e.target.checked)} />
              Includes Videography
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)} />
              Active
            </label>
          </div>

          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(shown in package pickers)</span></label>
            <textarea rows={2} className={ic + " resize-y"}
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Photo &amp; Film Counts <span className="text-gray-400 font-normal normal-case tracking-normal">(optional — used in contract deliverables)</span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Photo Count Min</label>
              <input type="number" min="0" className={ic}
                value={form.photo_count_min} onChange={(e) => set("photo_count_min", e.target.value)} />
            </div>
            <div>
              <label className="label">Photo Count Max</label>
              <input type="number" min="0" className={ic}
                value={form.photo_count_max} onChange={(e) => set("photo_count_max", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Film Duration Min (sec)</label>
              <input type="number" min="0" className={ic}
                value={form.film_duration_min_sec} onChange={(e) => set("film_duration_min_sec", e.target.value)} />
            </div>
            <div>
              <label className="label">Film Duration Max (sec)</label>
              <input type="number" min="0" className={ic}
                value={form.film_duration_max_sec} onChange={(e) => set("film_duration_max_sec", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Contract Content
          </h2>

          <div>
            <label className="label">Coverage Team <span className="text-gray-400 font-normal">e.g. &quot;1 Photographer &amp; 1 Videographer&quot;</span></label>
            <input className={ic} value={form.team} onChange={(e) => set("team", e.target.value)} />
          </div>

          <div>
            <label className="label">Deliverables <span className="text-gray-400 font-normal">(one bullet per line — shown as &quot;What&apos;s Included&quot;)</span></label>
            <textarea rows={6} className={ic + " resize-y font-mono text-xs"}
              placeholder={"200–350 professionally edited high-resolution images\n3–5 minute cinematic highlight film\nOnline gallery delivery via Google Drive (download link)"}
              value={form.deliverables} onChange={(e) => set("deliverables", e.target.value)} />
          </div>

          <div>
            <label className="label">Delivery Timeline <span className="text-gray-400 font-normal">(one bullet per line)</span></label>
            <textarea rows={4} className={ic + " resize-y font-mono text-xs"}
              placeholder={"Teaser reel — within 24–48 hours after the event\nPhoto gallery — within 4 weeks after the event"}
              value={form.timeline} onChange={(e) => set("timeline", e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 pb-10">
          <Link href="/packages" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary min-w-[140px] justify-center">
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Check size={15} /> Save Changes</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}
