"use client";
// app/(dashboard)/clients/new/page.tsx — Add new client from enquiry form
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import type { ReferralSource, ServiceType } from "@/lib/supabase/types";

// ── Package options (mirrors enquiry form section 03) ─────────────────────────
const PACKAGES = [
  {
    id: "mini_wedding",
    label: "Mini Wedding / Elopement",
    price: "$1,600",
    quoted: 1600,
    desc: "Up to 4 hrs · 1 Photographer + 1 Videographer · 200–350 images · 3–5 min film",
  },
  {
    id: "full_day_essential",
    label: "Full Day Essential",
    price: "$3,200",
    quoted: 3200,
    desc: "Up to 8 hrs · 400–600 images · 5–7 min highlight film",
  },
  {
    id: "full_day_premium",
    label: "Full Day Premium",
    price: "$4,800",
    quoted: 4800,
    desc: "Up to 13 hrs · 2 Photographers + 2 Videographers · 700–1,000 images",
  },
  {
    id: "hourly_photo",
    label: "Hourly Photography",
    price: "$200/hr",
    quoted: null,
    desc: "60+ professionally edited images per hour · Online gallery delivery · 4–8 week turnaround",
  },
  {
    id: "hourly_photo_video",
    label: "Hourly Photo + Video",
    price: "$350/hr",
    quoted: null,
    desc: "60+ edited images/hr · 2–3 min highlight reel + full event video · Online gallery · 4–8 week turnaround",
  },
  {
    id: "not_sure",
    label: "Not sure — please advise me",
    price: null,
    quoted: null,
    desc: "",
  },
];

// ── Event type → service_type mapping ────────────────────────────────────────
const EVENT_TYPE_OPTIONS: { label: string; serviceType: ServiceType }[] = [
  { label: "Wedding / Elopement", serviceType: "WEDDING" },
  { label: "Birthday",            serviceType: "EVENT"   },
  { label: "Baptism",             serviceType: "EVENT"   },
  { label: "Party / Celebration", serviceType: "EVENT"   },
  { label: "Corporate Event",     serviceType: "EVENT"   },
  { label: "Portrait Session",    serviceType: "PORTRAIT"},
  { label: "Other",               serviceType: "EVENT"   },
];

const BUDGET_OPTIONS = [
  { id: "under_1k",  label: "Under $1,000"     },
  { id: "1k_2.5k",   label: "$1,000 – $2,500"  },
  { id: "2.5k_4.5k", label: "$2,500 – $4,500"  },
  { id: "4.5k_plus", label: "$4,500+"           },
];

const SERVICES_OPTIONS = [
  { id: "PHOTO", label: "Photography" },
  { id: "VIDEO", label: "Videography" },
  { id: "BOTH",  label: "Both"        },
];

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [dbPackages, setDbPackages] = useState<any[]>([]);

  // Fetch real DB package IDs on mount so we can save package_id on the booking
  useEffect(() => {
    fetch("/api/packages")
      .then(r => r.json())
      .then(d => { if (d.packages) setDbPackages(d.packages); })
      .catch(() => {});
  }, []);

  // Match a local package selection to its DB package_id by name keywords
  function findDbPackageId(localId: string): string | null {
    if (!localId || !dbPackages.length) return null;
    const label = PACKAGES.find(p => p.id === localId)?.label.toLowerCase() ?? "";
    const match = dbPackages.find(dp => {
      const n = dp.name.toLowerCase();
      if (label.includes("mini") || label.includes("elopement")) return n.includes("mini") || n.includes("elopement");
      if (label.includes("essential"))                            return n.includes("essential");
      if (label.includes("premium"))                             return n.includes("premium");
      if (label.includes("photo") && label.includes("video"))    return n.includes("photo") && n.includes("video");
      if (label.includes("hourly"))                              return n.includes("hourly") || n.includes("photo");
      return false;
    });
    return match?.id ?? null;
  }

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // 01 — Your Details
    first_name: "", last_name: "", email: "", phone: "",
    instagram_handle: "",
    referral_source: "" as ReferralSource | "",
    referral_notes: "",
    // Partner / Spouse (optional, weddings)
    partner_first: "", partner_last: "", partner_email: "", partner_phone: "",
    // 02 — Event Details
    event_type_label: "",    // human label from select
    event_date: "", event_start_time: "", event_end_time: "",
    guest_count: "", venue_name: "", venue_suburb: "",
    hours_booked: "",
    // 03 — Package Selection
    selected_package: "",
    // 04 — Services Required
    services_required: "",
    // 05 — Budget
    budget_range: "",
    // 06 — Quote & Deposit
    quoted_total: "",
    discount_percent: "",   // % off the package list price
    deposit_amount: "",
    // 07 — Additional Information
    shot_list: "",
    special_requests: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // ── Derived values for discount UI ───────────────────────────────────────
  const selectedPkg   = PACKAGES.find(p => p.id === form.selected_package) ?? null;
  const discountPct   = Math.min(100, Math.max(0, parseFloat(form.discount_percent) || 0));
  const basePrice     = selectedPkg?.quoted ?? null;
  const savingsAmt    = basePrice != null && discountPct > 0
    ? Math.round(basePrice * discountPct / 100)
    : 0;

  // When discount % changes: recalculate quoted total and 30% deposit
  function handleDiscountChange(raw: string) {
    const pct  = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    if (basePrice != null) {
      const discounted = Math.round(basePrice * (1 - pct / 100));
      const deposit    = Math.round(discounted * 0.30);
      setForm(prev => ({
        ...prev,
        discount_percent: raw,
        quoted_total:     String(discounted),
        deposit_amount:   String(deposit),
      }));
    } else {
      set("discount_percent", raw);
    }
  }

  // When quoted total is changed manually: keep 30% deposit in sync
  function handleQuotedTotalChange(raw: string) {
    const total   = parseFloat(raw) || 0;
    const deposit = Math.round(total * 0.30);
    setForm(prev => ({
      ...prev,
      quoted_total:  raw,
      deposit_amount: total > 0 ? String(deposit) : prev.deposit_amount,
    }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("First name, last name and email are required.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create client
      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:       form.first_name.trim(),
          last_name:        form.last_name.trim(),
          email:            form.email.trim(),
          phone:            form.phone || null,
          instagram_handle: form.instagram_handle || null,
          referral_source:  form.referral_source  || null,
          referral_notes:   form.referral_notes   || null,
          partner_first:    form.partner_first     || null,
          partner_last:     form.partner_last      || null,
          partner_email:    form.partner_email     || null,
          partner_phone:    form.partner_phone     || null,
        }),
      });

      const clientJson = await clientRes.json();
      if (!clientRes.ok) {
        setError(clientJson.error ?? "Failed to create client.");
        return;
      }

      const clientId: string = clientJson.data.id;

      // 2. If event date provided, create an INQUIRY booking
      if (form.event_date) {
        const eventOption = EVENT_TYPE_OPTIONS.find(o => o.label === form.event_type_label);
        const serviceType: ServiceType = eventOption?.serviceType ?? "EVENT";

        const pkg = PACKAGES.find(p => p.id === form.selected_package);

        // Build internal_notes from enquiry extras
        const noteParts: string[] = [];
        if (form.event_type_label)  noteParts.push(`Event type: ${form.event_type_label}`);
        if (form.guest_count)        noteParts.push(`Est. guests: ${form.guest_count}`);
        if (form.selected_package && pkg) noteParts.push(`Package interest: ${pkg.label}${pkg.price ? ` (${pkg.price})` : ""}`);
        if (discountPct > 0 && basePrice != null) noteParts.push(`Discount applied: ${discountPct}% off list price ($${basePrice.toLocaleString("en-AU")}) → $${savingsAmt.toLocaleString("en-AU")} saving`);
        if (form.services_required)  noteParts.push(`Services: ${form.services_required}`);
        if (form.budget_range)       noteParts.push(`Budget: ${BUDGET_OPTIONS.find(b => b.id === form.budget_range)?.label ?? form.budget_range}`);

        await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id:         clientId,
            service_type:      serviceType,
            status:            "INQUIRY",
            event_date:        form.event_date,
            event_start_time:  form.event_start_time || null,
            event_end_time:    form.event_end_time   || null,
            venue_name:        form.venue_name       || null,
            venue_address:     form.venue_suburb     || null,
            package_id:        findDbPackageId(form.selected_package),
            quoted_total:      form.quoted_total  ? parseFloat(form.quoted_total)  : (pkg?.quoted ?? null),
            deposit_amount:    form.deposit_amount ? parseFloat(form.deposit_amount) : null,
            hours_booked:      form.hours_booked  ? parseFloat(form.hours_booked)  : null,
            shot_list:         form.shot_list     || null,
            special_requests:  form.special_requests || null,
            internal_notes:    noteParts.length ? noteParts.join("\n") : null,
          }),
        });
        // Booking errors are non-fatal — client is already created
      }

      router.push(`/clients/${clientId}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const ic = "input"; // input className shorthand

  // ── Helpers for card-style checkbox/radio selectors ───────────────────────
  function OptionCard({
    selected, onSelect, label, sub, price,
  }: {
    selected: boolean; onSelect: () => void;
    label: string; sub?: string; price?: string | null;
  }) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`text-left w-full rounded-md border px-4 py-3 transition-colors ${
          selected
            ? "border-brand-teal bg-brand-teal/5 text-brand-navy"
            : "border-gray-200 bg-white text-gray-700 hover:border-brand-teal/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
            selected ? "bg-brand-teal border-brand-teal" : "border-gray-300"
          }`}>
            {selected && <Check size={11} className="text-white" strokeWidth={3} />}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{label}</span>
              {price && <span className="text-xs font-semibold text-brand-teal">{price}</span>}
            </div>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href="/clients" className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Add New Client</h1>
          <p className="text-xs text-brand-teal">Enquiry intake — creates a client record and an inquiry booking.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        {/* ── 01 YOUR DETAILS ───────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            01 — Your Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className={ic} value={form.first_name}
                onChange={e => set("first_name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className={ic} value={form.last_name}
                onChange={e => set("last_name", e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Email Address *</label>
            <input type="email" className={ic} value={form.email}
              onChange={e => set("email", e.target.value)} required />
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input className={ic} placeholder="04XX XXX XXX" value={form.phone}
              onChange={e => set("phone", e.target.value)} />
          </div>

          <div>
            <label className="label">How did you hear about us?</label>
            <div className="grid grid-cols-2 gap-3">
              <select className={ic} value={form.referral_source}
                onChange={e => set("referral_source", e.target.value as ReferralSource | "")}>
                <option value="">Select source…</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="GOOGLE">Google Search</option>
                <option value="WORD_OF_MOUTH">Word of Mouth</option>
                <option value="WEDDING_WIRE">Wedding Wire</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="OTHER">Other</option>
              </select>
              <input className={ic} placeholder="e.g. Referred by Sarah & Tom"
                value={form.referral_notes}
                onChange={e => set("referral_notes", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Instagram Handle <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className={ic} placeholder="@handle" value={form.instagram_handle}
              onChange={e => set("instagram_handle", e.target.value)} />
          </div>
        </div>

        {/* ── Partner / Spouse ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Partner / Spouse <span className="text-gray-400 font-normal normal-case">(optional — for weddings)</span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input className={ic} value={form.partner_first}
                onChange={e => set("partner_first", e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className={ic} value={form.partner_last}
                onChange={e => set("partner_last", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className={ic} value={form.partner_email}
                onChange={e => set("partner_email", e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={ic} value={form.partner_phone}
                onChange={e => set("partner_phone", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── 02 EVENT DETAILS ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            02 — Event Details
          </h2>
          <p className="text-xs text-gray-400 -mt-2">
            Fill in if you have event details — creates an Inquiry booking automatically.
          </p>

          <div>
            <label className="label">Event Type</label>
            <select className={ic} value={form.event_type_label}
              onChange={e => set("event_type_label", e.target.value)}>
              <option value="">Select type…</option>
              {EVENT_TYPE_OPTIONS.map(o => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Event Date</label>
              <input type="date" className={ic} value={form.event_date}
                onChange={e => set("event_date", e.target.value)} />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className={ic} value={form.event_start_time}
                onChange={e => set("event_start_time", e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className={ic} value={form.event_end_time}
                onChange={e => set("event_end_time", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Venue Name</label>
              <input className={ic} placeholder="e.g. Old Parliament House" value={form.venue_name}
                onChange={e => set("venue_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Venue Address</label>
              <input className={ic} placeholder="e.g. Barton ACT 2600" value={form.venue_suburb}
                onChange={e => set("venue_suburb", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estimated Guest Count</label>
              <input type="number" min="0" className={ic} placeholder="e.g. 80"
                value={form.guest_count}
                onChange={e => set("guest_count", e.target.value)} />
            </div>
            <div>
              <label className="label">Hours Booked <span className="text-gray-400 font-normal">(events/portraits)</span></label>
              <input type="number" min="0.5" step="0.5" className={ic} placeholder="e.g. 3"
                value={form.hours_booked}
                onChange={e => set("hours_booked", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── 03 PACKAGE SELECTION ─────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            03 — Package Selection
          </h2>
          <p className="text-xs text-gray-400 -mt-1">Tick all that apply. Final package confirmed in the quote.</p>
          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map(pkg => (
              <OptionCard
                key={pkg.id}
                selected={form.selected_package === pkg.id}
                onSelect={() => {
                  const isDeselecting = form.selected_package === pkg.id;
                  const newTotal   = (!isDeselecting && pkg.quoted != null) ? pkg.quoted : null;
                  const newDeposit = newTotal != null ? Math.round(newTotal * 0.30) : null;
                  setForm(prev => ({
                    ...prev,
                    selected_package: isDeselecting ? "" : pkg.id,
                    discount_percent: isDeselecting ? "" : "0",
                    quoted_total:     isDeselecting ? "" : (newTotal != null ? String(newTotal) : prev.quoted_total),
                    deposit_amount:   isDeselecting ? "" : (newDeposit != null ? String(newDeposit) : prev.deposit_amount),
                  }));
                }}
                label={pkg.label}
                price={pkg.price ?? undefined}
                sub={pkg.desc || undefined}
              />
            ))}
          </div>
        </div>

        {/* ── 04 SERVICES REQUIRED ─────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            04 — Services Required
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {SERVICES_OPTIONS.map(s => (
              <OptionCard
                key={s.id}
                selected={form.services_required === s.id}
                onSelect={() => set("services_required", form.services_required === s.id ? "" : s.id)}
                label={s.label}
              />
            ))}
          </div>
        </div>

        {/* ── 05 APPROXIMATE BUDGET ────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            05 — Approximate Budget
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_OPTIONS.map(b => (
              <OptionCard
                key={b.id}
                selected={form.budget_range === b.id}
                onSelect={() => set("budget_range", form.budget_range === b.id ? "" : b.id)}
                label={b.label}
              />
            ))}
          </div>
        </div>

        {/* ── 06 QUOTE & DEPOSIT ───────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            06 — Quote &amp; Deposit
          </h2>
          <p className="text-xs text-gray-400 -mt-2">
            Auto-filled from the package above. Apply a discount % to reduce the price — deliverables stay the same.
          </p>

          {/* Discount row — only shown when a fixed-price package is selected */}
          {basePrice != null && (
            <div className="rounded-md border border-brand-pale-blue bg-brand-cream/50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-sm text-gray-600">
                List price:{" "}
                <span className="font-bold text-brand-navy">${basePrice.toLocaleString("en-AU")}</span>
              </div>

              {/* Discount % input */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-brand-teal whitespace-nowrap">Discount</label>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="0" max="100" step="0.5"
                    className={ic + " pr-7 text-sm"}
                    placeholder="0"
                    value={form.discount_percent === "0" ? "" : form.discount_percent}
                    onChange={e => handleDiscountChange(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                </div>
              </div>

              {/* Savings badge */}
              {savingsAmt > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1">
                  −${savingsAmt.toLocaleString("en-AU")} off
                </span>
              )}

              {/* Note that deliverables are unchanged */}
              {discountPct > 0 && (
                <span className="text-xs text-gray-400 italic">Package deliverables remain the same</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quoted Total (AUD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" step="0.01" min="0"
                  className={ic + " pl-7"}
                  placeholder="0.00"
                  value={form.quoted_total}
                  onChange={e => handleQuotedTotalChange(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Deposit Amount (AUD) <span className="text-gray-400 font-normal">30% auto</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" step="0.01" min="0"
                  className={ic + " pl-7"}
                  placeholder="0.00"
                  value={form.deposit_amount}
                  onChange={e => set("deposit_amount", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 07 ADDITIONAL INFORMATION ───────────── */}
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-brand-navy text-sm mb-0.5">07 — Additional Information</h3>
            <p className="text-xs text-gray-400">Any special requests or notes for this booking.</p>
          </div>

          <div>
            <label className="label">Shot List / Must-have Moments</label>
            <textarea
              className={ic + " min-h-[80px]"}
              placeholder="Key people, moments, or shots the client has requested…"
              value={form.shot_list}
              onChange={e => set("shot_list", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Special Requests / Notes</label>
            <textarea
              className={ic + " min-h-[80px]"}
              placeholder="e.g. Ceremony at 2pm, reception at venue X…"
              value={form.special_requests}
              onChange={e => set("special_requests", e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 pb-10">
          <Link href="/clients" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary min-w-[140px] justify-center">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Create Client</>}
          </button>
        </div>

      </form>
    </div>
  );
}
