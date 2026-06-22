"use client";
// app/(dashboard)/clients/new/page.tsx — Add new client from enquiry form
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import type { ServiceType } from "@/lib/supabase/types";

// ── Service type options (mirrors Edit Booking) ───────────────────────────────
const SERVICE_TYPES = [
  { value: "WEDDING",  label: "Wedding / Elopement", icon: "💍" },
  { value: "EVENT",    label: "Event",                icon: "🎉" },
  { value: "PORTRAIT", label: "Portrait Session",     icon: "📷" },
];

// Sub-types shown only when EVENT is selected
const EVENT_SUB_TYPES = [
  "Birthday", "Baptism", "Party / Celebration", "Corporate Event", "Other",
];

const BUDGET_OPTIONS = [
  { id: "under_1k",  label: "Under $1,000"    },
  { id: "1k_2.5k",  label: "$1,000 – $2,500" },
  { id: "2.5k_4.5k",label: "$2,500 – $4,500" },
  { id: "4.5k_plus", label: "$4,500+"          },
];

const SERVICES_OPTIONS = [
  { id: "PHOTO", label: "Photography" },
  { id: "VIDEO", label: "Videography" },
  { id: "BOTH",  label: "Both"        },
];

const REFERRAL_OPTIONS = [
  { value: "INSTAGRAM",    label: "Instagram"      },
  { value: "GOOGLE",       label: "Google Search"  },
  { value: "WORD_OF_MOUTH",label: "Word of Mouth"  },
  { value: "WEDDING_WIRE", label: "Wedding Wire"   },
  { value: "FACEBOOK",     label: "Facebook"       },
  { value: "OTHER",        label: "Other"          },
];

// ── Package description helper (same as Edit Booking) ────────────────────────
function getPkgDesc(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("mini") || n.includes("elopement"))
    return "Up to 4 hrs · 1 Photographer + 1 Videographer · 200–350 images · 3–5 min film";
  if (n.includes("essential"))
    return "Up to 8 hrs · 1 Photographer + 1 Videographer · 400–600 images · 5–7 min film";
  if (n.includes("premium"))
    return "Up to 13 hrs · 2 Photographers + 2 Videographers · 700–1,000 images · 6–8 min film";
  if ((n.includes("photo") && n.includes("video")) || n.includes("combo"))
    return "Combined photography & videography per hour";
  if (n.includes("hourly") || n.includes("photo"))
    return "Events: birthdays, baptisms, parties · photography only";
  return "";
}

function fmtPkgPrice(pkg: any): string {
  if (pkg.base_price == null) return "";
  const amt = `$${Number(pkg.base_price).toLocaleString("en-AU")}`;
  return pkg.max_hours ? amt : `${amt}/hr`;
}

// ── Shared OptionCard component (same style as Edit Booking) ─────────────────
function OptionCard({ selected, onSelect, label, sub, icon, price }: {
  selected: boolean; onSelect: () => void;
  label: string; sub?: string; icon?: string; price?: string;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={`text-left w-full rounded-lg border px-4 py-3 transition-colors ${
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
            {icon && <span>{icon}</span>}
            <span className="font-medium text-sm">{label}</span>
            {price && <span className="text-xs font-semibold text-brand-teal">{price}</span>}
          </div>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NewClientPage() {
  const router = useRouter();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [dbPackages, setDbPackages] = useState<any[]>([]);

  // ── Section 02: Service type (drives package filter) ─────────────────────
  const [serviceType,     setServiceType]     = useState<ServiceType>("WEDDING");

  // ── Section 03: Package (from DB, filtered by service type) ──────────────
  const [packageId,       setPackageId]       = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [quotedTotal,     setQuotedTotal]     = useState("");
  const [depositAmount,   setDepositAmount]   = useState("");
  const [hoursBooked,     setHoursBooked]     = useState("");

  // ── Rest of form ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // 01 — Your Details
    first_name: "", last_name: "", email: "", phone: "",
    instagram_handle: "",
    referral_source: "",
    referral_notes: "",
    // Partner / Spouse (optional)
    partner_first: "", partner_last: "", partner_email: "", partner_phone: "",
    // 04 — Event Details
    event_sub_type: "",   // Birthday, Baptism, etc. (only for EVENT)
    event_date: "", event_start_time: "", event_end_time: "",
    venue_name: "", venue_address: "",
    guest_count: "",
    // 05 — Services Required
    services_required: "",
    // 06 — Budget
    budget_range: "",
    // 08 — Additional Information
    shot_list: "",
    special_requests: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Fetch DB packages on mount
  useEffect(() => {
    fetch("/api/packages")
      .then(r => r.json())
      .then(d => { if (d.packages) setDbPackages(d.packages); })
      .catch(() => {});
  }, []);

  // ── Derived values (mirrors Edit Booking) ─────────────────────────────────
  const visiblePackages = dbPackages.filter(p =>
    !p.service_type || p.service_type.toUpperCase() === serviceType
  );

  const selectedDbPkg = dbPackages.find(p => p.id === packageId) ?? null;
  const basePrice     = selectedDbPkg?.base_price != null ? Number(selectedDbPkg.base_price) : null;
  const isHourly      = selectedDbPkg != null && !selectedDbPkg.max_hours;
  const discountPct   = Math.min(100, Math.max(0, parseFloat(discountPercent) || 0));
  const hrs           = parseFloat(hoursBooked) || 0;
  const listTotal     = isHourly && hrs > 0 ? hrs * (basePrice ?? 0) : (basePrice ?? 0);
  const savingsAmt    = basePrice != null && discountPct > 0
    ? Math.round(listTotal * discountPct / 100)
    : 0;

  // ── Pricing handlers (mirrors Edit Booking) ───────────────────────────────
  function handleHoursChange(raw: string) {
    setHoursBooked(raw);
    if (isHourly && basePrice != null) {
      const h = parseFloat(raw) || 0;
      if (h > 0) {
        const total   = Math.round(h * basePrice * (1 - discountPct / 100));
        const deposit = Math.round(total * 0.30);
        setQuotedTotal(String(total));
        setDepositAmount(String(deposit));
      } else {
        setQuotedTotal("");
        setDepositAmount("");
      }
    }
  }

  function handleDiscountChange(raw: string) {
    const pct = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    if (basePrice != null) {
      const base       = isHourly && hrs > 0 ? hrs * basePrice : basePrice;
      const discounted = Math.round(base * (1 - pct / 100));
      const deposit    = Math.round(discounted * 0.30);
      setDiscountPercent(raw);
      setQuotedTotal(String(discounted));
      setDepositAmount(String(deposit));
    } else {
      setDiscountPercent(raw);
    }
  }

  function handleQuotedTotalChange(raw: string) {
    const total   = parseFloat(raw) || 0;
    const deposit = Math.round(total * 0.30);
    setQuotedTotal(raw);
    if (total > 0) setDepositAmount(String(deposit));
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
        const noteParts: string[] = [];
        if (form.event_sub_type)    noteParts.push(`Event type: ${form.event_sub_type}`);
        if (form.guest_count)        noteParts.push(`Est. guests: ${form.guest_count}`);
        if (selectedDbPkg)           noteParts.push(`Package interest: ${selectedDbPkg.name}${basePrice ? ` ($${basePrice.toLocaleString("en-AU")}${isHourly ? "/hr" : ""})` : ""}`);
        if (discountPct > 0 && basePrice != null) noteParts.push(`Discount applied: ${discountPct}% → $${savingsAmt.toLocaleString("en-AU")} saving`);
        if (form.services_required)  noteParts.push(`Services: ${form.services_required}`);
        if (form.budget_range)       noteParts.push(`Budget: ${BUDGET_OPTIONS.find(b => b.id === form.budget_range)?.label ?? form.budget_range}`);

        await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id:        clientId,
            service_type:     serviceType,
            status:           "INQUIRY",
            event_date:       form.event_date,
            event_start_time: form.event_start_time || null,
            event_end_time:   form.event_end_time   || null,
            venue_name:       form.venue_name        || null,
            venue_address:    form.venue_address     || null,
            package_id:       packageId              || null,
            quoted_total:     quotedTotal  ? parseFloat(quotedTotal)  : null,
            deposit_amount:   depositAmount ? parseFloat(depositAmount) : null,
            hours_booked:     hoursBooked  ? parseFloat(hoursBooked)  : null,
            shot_list:        form.shot_list          || null,
            special_requests: form.special_requests   || null,
            internal_notes:   noteParts.length ? noteParts.join("\n") : null,
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

  const ic = "input w-full";

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
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── 01 YOUR DETAILS ──────────────────────────────────────────── */}
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
                onChange={e => set("referral_source", e.target.value)}>
                <option value="">Select source…</option>
                {REFERRAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
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

        {/* ── PARTNER / SPOUSE ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            Partner / Spouse{" "}
            <span className="text-gray-400 font-normal normal-case">(optional — for weddings)</span>
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

        {/* ── 02 SERVICE TYPE ──────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            02 — Service Type
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_TYPES.map(s => (
              <OptionCard key={s.value} selected={serviceType === s.value}
                onSelect={() => { setServiceType(s.value as ServiceType); setPackageId(""); setDiscountPercent(""); setQuotedTotal(""); setDepositAmount(""); }}
                label={s.label} icon={s.icon} />
            ))}
          </div>

          {/* Sub-type for events only */}
          {serviceType === "EVENT" && (
            <div className="pt-1">
              <label className="label">Event Type</label>
              <select className={ic} value={form.event_sub_type}
                onChange={e => set("event_sub_type", e.target.value)}>
                <option value="">Select event type…</option>
                {EVENT_SUB_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── 03 PACKAGE ───────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            03 — Package
          </h2>
          <p className="text-xs text-gray-400 -mt-1">
            Select a package to auto-fill pricing. Final package confirmed in the quote.
          </p>

          {visiblePackages.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {visiblePackages.map((pkg: any) => (
                <OptionCard
                  key={pkg.id}
                  selected={packageId === pkg.id}
                  onSelect={() => {
                    const isDeselecting = packageId === pkg.id;
                    setPackageId(isDeselecting ? "" : pkg.id);
                    setDiscountPercent("0");
                    if (!isDeselecting && pkg.base_price != null) {
                      const pkgIsHourly = !pkg.max_hours;
                      const curHrs      = parseFloat(hoursBooked) || 0;
                      if (!pkgIsHourly) {
                        const full    = Math.round(Number(pkg.base_price));
                        const deposit = Math.round(full * 0.30);
                        setQuotedTotal(String(full));
                        setDepositAmount(String(deposit));
                      } else if (curHrs > 0) {
                        const total   = Math.round(curHrs * Number(pkg.base_price));
                        const deposit = Math.round(total * 0.30);
                        setQuotedTotal(String(total));
                        setDepositAmount(String(deposit));
                      } else {
                        setQuotedTotal("");
                        setDepositAmount("");
                      }
                    } else if (isDeselecting) {
                      setQuotedTotal("");
                      setDepositAmount("");
                    }
                  }}
                  label={pkg.name}
                  price={fmtPkgPrice(pkg)}
                  sub={pkg.description || getPkgDesc(pkg.name) || (pkg.max_hours ? `Up to ${pkg.max_hours} hrs` : undefined)}
                />
              ))}
              <OptionCard
                selected={!packageId}
                onSelect={() => { setPackageId(""); setDiscountPercent(""); setQuotedTotal(""); setDepositAmount(""); }}
                label="Custom / No Package"
                sub="Enter quoted total manually"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">
              Loading packages… or no packages found for this service type.
            </p>
          )}
        </div>

        {/* ── 04 EVENT DETAILS ─────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            04 — Event Details
          </h2>
          <p className="text-xs text-gray-400 -mt-2">
            Fill in if you have event details — creates an Inquiry booking automatically.
          </p>

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
              <input className={ic} placeholder="e.g. Old Parliament House"
                value={form.venue_name} onChange={e => set("venue_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Venue Address</label>
              <input className={ic} placeholder="e.g. Barton ACT 2600"
                value={form.venue_address} onChange={e => set("venue_address", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Estimated Guest Count</label>
            <input type="number" min="0" className={ic} placeholder="e.g. 80"
              value={form.guest_count} onChange={e => set("guest_count", e.target.value)} />
          </div>
        </div>

        {/* ── 05 SERVICES REQUIRED ─────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            05 — Services Required
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

        {/* ── 06 APPROXIMATE BUDGET ────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            06 — Approximate Budget
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

        {/* ── 07 PRICING ───────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            07 — Pricing
          </h2>
          <p className="text-xs text-gray-400 -mt-2">
            Auto-filled from the package above. Apply a discount % to reduce the price — deliverables stay the same.
          </p>

          {/* Discount strip — same as Edit Booking */}
          {basePrice != null && (
            <div className="rounded-md border border-brand-pale-blue bg-brand-cream/50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-sm text-gray-600">
                {isHourly ? (
                  <>Rate: <span className="font-bold text-brand-navy">${basePrice.toLocaleString("en-AU")}/hr</span></>
                ) : (
                  <>List price: <span className="font-bold text-brand-navy">${basePrice.toLocaleString("en-AU")}</span></>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-brand-teal whitespace-nowrap">Discount</label>
                <div className="relative w-24">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    className={ic + " pr-7 text-sm"}
                    placeholder="0"
                    value={discountPercent === "0" ? "" : discountPercent}
                    onChange={e => handleDiscountChange(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                </div>
              </div>

              {savingsAmt > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1">
                  −${savingsAmt.toLocaleString("en-AU")} off
                </span>
              )}
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
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  placeholder="0.00" value={quotedTotal}
                  onChange={e => handleQuotedTotalChange(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Deposit Amount (AUD) <span className="text-gray-400 font-normal">30% auto</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  placeholder="0.00" value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)} />
              </div>
            </div>

            {/* Hours booked — shown for EVENT/PORTRAIT, especially useful for hourly packages */}
            {(serviceType === "EVENT" || serviceType === "PORTRAIT") && (
              <div>
                <label className="label">
                  Hours Booked
                  {isHourly && basePrice != null && (
                    <span className="text-gray-400 font-normal ml-1">× ${basePrice}/hr = quoted total</span>
                  )}
                </label>
                <input type="number" step="0.5" min="0.5" className={ic}
                  placeholder="e.g. 3" value={hoursBooked}
                  onChange={e => handleHoursChange(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* ── 08 ADDITIONAL INFORMATION ────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            08 — Additional Information
          </h2>
          <p className="text-xs text-gray-400 -mt-2">Any special requests or notes for this booking.</p>

          <div>
            <label className="label">Shot List / Must-have Moments</label>
            <textarea rows={3} className={ic + " resize-y"}
              placeholder="Key people, moments, or shots the client has requested…"
              value={form.shot_list}
              onChange={e => set("shot_list", e.target.value)} />
          </div>

          <div>
            <label className="label">Special Requests / Notes</label>
            <textarea rows={2} className={ic + " resize-y"}
              placeholder="e.g. Ceremony at 2pm, reception at venue X…"
              value={form.special_requests}
              onChange={e => set("special_requests", e.target.value)} />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 pb-10">
          <Link href="/clients" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary min-w-[140px] justify-center">
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Check size={15} /> Create Client</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}
