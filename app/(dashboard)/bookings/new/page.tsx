// app/(dashboard)/bookings/new/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Camera, Video, Layers } from "lucide-react";

// ── Static fallbacks shown when no DB packages exist yet ─────────────────────
const WEDDING_FALLBACK = [
  { id: "", name: "Mini Wedding / Elopement", base_price: 1600, max_hours: 4,
    description: "1 Photographer & 1 Videographer · 200–350 edited images · 3–5 min film · Next-day teaser" },
  { id: "", name: "Full Day Essential",       base_price: 3200, max_hours: 8,
    description: "1 Photographer & 1 Videographer · 400–600 edited images · 5–7 min highlight film · Full ceremony" },
  { id: "", name: "Full Day Premium",         base_price: 4800, max_hours: 13,
    description: "2 Photographers & 2 Videographers · 700–1,000 images · 6–8 min cinematic film · Full ceremony & speeches" },
];

const PORTRAIT_FALLBACK = [
  { id: "", name: "Headshot Session",  base_price: 300, max_hours: 1,
    description: "1 hr · 20–40 edited images · Online gallery" },
  { id: "", name: "Couples Portrait",  base_price: 450, max_hours: 2,
    description: "Up to 2 hrs · 50–80 edited images · Online gallery" },
  { id: "", name: "Family Portrait",   base_price: 550, max_hours: 2,
    description: "Up to 2 hrs · 60–100 edited images · Online gallery" },
];

// Hourly event options (not DB packages — just rate cards)
const EVENT_RATES = [
  { key: "photo", label: "Photography",        rate: "$150/hr", price: 150,
    icon: Camera,  desc: "Photography only" },
  { key: "both",  label: "Photo + Videography", rate: "$250/hr", price: 250,
    icon: Layers,  desc: "Combined photography & videography" },
];

const SERVICE_TYPES = [
  { value: "WEDDING",  label: "Wedding / Elopement",      icon: "💍" },
  { value: "EVENT",    label: "Event",                    icon: "🎉" },
  { value: "PORTRAIT", label: "Portrait Session",         icon: "📷" },
];

// ── Small re-usable card selector ─────────────────────────────────────────────
function OptionCard({
  selected, onSelect, label, sub, price, icon,
}: {
  selected: boolean; onSelect: () => void;
  label: string; sub?: string; price?: string; icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
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
        <div className="flex-1 min-w-0">
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewBookingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const prefillClient = searchParams.get("client_id");

  const [submitting, setSubmitting]   = useState(false);
  const [error,      setError]        = useState<string | null>(null);
  const [warning,    setWarning]      = useState<string | null>(null);

  // ── Client picker ─────────────────────────────────────────────────────────
  const [clientSearch,    setClientSearch]    = useState("");
  const [clientResults,   setClientResults]   = useState<any[]>([]);
  const [selectedClient,  setSelectedClient]  = useState<any | null>(null);
  const [clientLoading,   setClientLoading]   = useState(false);

  // ── Packages from DB ──────────────────────────────────────────────────────
  const [dbPackages, setDbPackages] = useState<any[]>([]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [serviceType,      setServiceType]      = useState("WEDDING");
  const [packageId,        setPackageId]        = useState("");      // DB package id
  const [packageName,      setPackageName]      = useState("");      // for fallback display
  const [eventRateKey,     setEventRateKey]     = useState("");      // "photo" | "both"
  const [eventDate,        setEventDate]        = useState("");
  const [startTime,        setStartTime]        = useState("");
  const [endTime,          setEndTime]          = useState("");
  const [quotedTotal,      setQuotedTotal]      = useState("");
  const [depositAmount,    setDepositAmount]    = useState("");
  const [hoursBooked,      setHoursBooked]      = useState("");
  const [venueName,        setVenueName]        = useState("");
  const [venueAddress,     setVenueAddress]     = useState("");
  const [shotList,         setShotList]         = useState("");
  const [specialRequests,  setSpecialRequests]  = useState("");
  const [internalNotes,    setInternalNotes]    = useState("");

  // ── Load DB packages ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setDbPackages(d.data?.packages ?? []))
      .catch(console.error);
  }, []);

  // ── Pre-fill client from URL param ────────────────────────────────────────
  useEffect(() => {
    if (!prefillClient) return;
    fetch(`/api/clients/${prefillClient}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setSelectedClient(d.data); })
      .catch(console.error);
  }, [prefillClient]);

  // ── Client search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    const t = setTimeout(() => {
      setClientLoading(true);
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setClientResults(d.data?.clients ?? []))
        .catch(console.error)
        .finally(() => setClientLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // ── Reset package when service type changes ───────────────────────────────
  useEffect(() => {
    setPackageId("");
    setPackageName("");
    setEventRateKey("");
    setQuotedTotal("");
    setDepositAmount("");
  }, [serviceType]);

  // ── Packages to display for current service type ──────────────────────────
  const visiblePackages = dbPackages.filter((p) => p.service_type === serviceType);
  const displayPackages = visiblePackages.length > 0
    ? visiblePackages
    : serviceType === "WEDDING"  ? WEDDING_FALLBACK
    : serviceType === "PORTRAIT" ? PORTRAIT_FALLBACK
    : [];

  function selectPackage(pkg: any) {
    const alreadySelected = pkg.id ? packageId === pkg.id : packageName === pkg.name;
    if (alreadySelected) {
      setPackageId("");
      setPackageName("");
      setQuotedTotal("");
    } else {
      setPackageId(pkg.id ?? "");
      setPackageName(pkg.name);
      setQuotedTotal(String(pkg.base_price));
    }
    setEventRateKey("");
  }

  function selectEventRate(key: string, price: number) {
    if (eventRateKey === key) {
      setEventRateKey("");
      setQuotedTotal("");
    } else {
      setEventRateKey(key);
      setPackageId("");
      setPackageName("");
      // Auto-calc total if hours already entered
      if (hoursBooked) {
        setQuotedTotal(String(price * parseFloat(hoursBooked)));
      }
    }
  }

  // ── Recalculate event total when hours change ─────────────────────────────
  useEffect(() => {
    if (!eventRateKey || !hoursBooked) return;
    const rate = EVENT_RATES.find((r) => r.key === eventRateKey);
    if (rate) setQuotedTotal(String(rate.price * parseFloat(hoursBooked)));
  }, [hoursBooked, eventRateKey]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) { setError("Please select a client."); return; }
    if (!eventDate)       { setError("Event date is required."); return; }
    setSubmitting(true);
    setError(null);
    setWarning(null);

    try {
      const body: Record<string, any> = {
        client_id:    selectedClient.id,
        service_type: serviceType,
        event_date:   eventDate,
      };
      if (packageId)        body.package_id        = packageId;
      if (startTime)        body.event_start_time  = startTime;
      if (endTime)          body.event_end_time    = endTime;
      if (quotedTotal)      body.quoted_total      = parseFloat(quotedTotal);
      if (depositAmount)    body.deposit_amount    = parseFloat(depositAmount);
      if (hoursBooked)      body.hours_booked      = parseFloat(hoursBooked);
      if (venueName)        body.venue_name        = venueName;
      if (venueAddress)     body.venue_address     = venueAddress;
      if (shotList)         body.shot_list         = shotList;
      if (specialRequests)  body.special_requests  = specialRequests;
      if (internalNotes)    body.internal_notes    = internalNotes;

      const res  = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create booking."); return; }
      const booking = data.data?.booking ?? data.booking;
      if (data.data?.double_booking_warning || data.warning) setWarning("Heads up: another booking exists on this date.");
      router.push(`/bookings/${booking.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const ic = "input w-full";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href="/bookings" className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">New Booking</h1>
          <p className="text-xs text-brand-teal">Fill in the event details and select a package.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {warning && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
            ⚠️ {warning}
          </div>
        )}

        {/* ── 01 CLIENT ───────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            01 — Client
          </h2>

          {selectedClient ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-brand-pale-blue/20 border border-brand-pale-blue">
              <div>
                <p className="font-medium text-brand-navy text-sm">
                  {selectedClient.first_name} {selectedClient.last_name}
                </p>
                <p className="text-xs text-gray-500">{selectedClient.email}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedClient(null); setClientSearch(""); }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className={ic}
                placeholder="Search by name or email…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientLoading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
              )}
              {clientResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {clientResults.map((c: any) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                        onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(""); }}
                      >
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {clientSearch.length >= 2 && clientResults.length === 0 && !clientLoading && (
                <p className="text-sm text-gray-400 mt-2">
                  No clients found.{" "}
                  <Link href="/clients/new" className="text-brand-teal hover:underline">Add new client</Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 02 SERVICE TYPE ─────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            02 — Service Type
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_TYPES.map((s) => (
              <OptionCard
                key={s.value}
                selected={serviceType === s.value}
                onSelect={() => setServiceType(s.value)}
                label={s.label}
                icon={s.icon}
              />
            ))}
          </div>
        </div>

        {/* ── 03 PACKAGE ──────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            03 — Package
          </h2>

          {serviceType === "EVENT" ? (
            <>
              <p className="text-xs text-gray-400">Events are priced hourly. Select the service rate below.</p>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_RATES.map((r) => (
                  <OptionCard
                    key={r.key}
                    selected={eventRateKey === r.key}
                    onSelect={() => selectEventRate(r.key, r.price)}
                    label={r.label}
                    price={r.rate}
                    sub={r.desc}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Enter hours booked in the Pricing section — total will calculate automatically.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3">
                {displayPackages.map((pkg: any) => (
                  <OptionCard
                    key={pkg.id || pkg.name}
                    selected={pkg.id ? packageId === pkg.id : packageName === pkg.name}
                    onSelect={() => selectPackage(pkg)}
                    label={pkg.name}
                    price={`$${pkg.base_price.toLocaleString()}${pkg.max_hours ? ` · up to ${pkg.max_hours} hrs` : ""}`}
                    sub={pkg.description}
                  />
                ))}
              </div>
              <OptionCard
                selected={!packageId && !packageName}
                onSelect={() => { setPackageId(""); setPackageName(""); setQuotedTotal(""); }}
                label="Custom / No Package"
                sub="Enter a manual quoted total in the Pricing section"
              />
            </>
          )}
        </div>

        {/* ── 04 DATE & TIME ──────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            04 — Date &amp; Time
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Event Date *</label>
              <input type="date" className={ic} value={eventDate}
                onChange={(e) => setEventDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className={ic} value={startTime}
                onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className={ic} value={endTime}
                onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── 05 VENUE ────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            05 — Venue
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Venue Name</label>
              <input className={ic} placeholder="e.g. Old Parliament House"
                value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </div>
            <div>
              <label className="label">Venue Address</label>
              <input className={ic} placeholder="e.g. Barton ACT 2600"
                value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── 06 PRICING ──────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            06 — Pricing
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Quoted Total (AUD)
                {packageName && <span className="text-gray-400 font-normal normal-case ml-1">— auto-filled from package</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  placeholder="0.00" value={quotedTotal}
                  onChange={(e) => setQuotedTotal(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Deposit Amount (AUD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" className={ic + " pl-7"}
                  placeholder="0.00" value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)} />
              </div>
            </div>
          </div>
          {serviceType === "EVENT" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Hours Booked</label>
                <input type="number" step="0.5" min="0.5" className={ic}
                  placeholder="e.g. 3" value={hoursBooked}
                  onChange={(e) => setHoursBooked(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ── 07 NOTES ────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            07 — Notes
          </h2>
          <div>
            <label className="label">Shot List / Must-have Moments</label>
            <textarea rows={3} className={ic + " resize-y"}
              placeholder="Key people, moments, or shots the client has requested…"
              value={shotList} onChange={(e) => setShotList(e.target.value)} />
          </div>
          <div>
            <label className="label">Special Requests</label>
            <textarea rows={2} className={ic + " resize-y"}
              placeholder="Any special considerations, access requirements…"
              value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
          </div>
          <div>
            <label className="label">
              Internal Notes{" "}
              <span className="text-gray-400 font-normal normal-case">(not shared with client)</span>
            </label>
            <textarea rows={2} className={ic + " resize-y"}
              placeholder="Private reminders, contractor notes, logistics…"
              value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
              : "Create Booking"
            }
          </button>
          <Link href="/bookings" className="btn-secondary">Cancel</Link>
        </div>

      </form>
    </div>
  );
}
