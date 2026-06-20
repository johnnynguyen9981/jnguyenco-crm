"use client";
// app/(dashboard)/bookings/[id]/edit/page.tsx
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Check } from "lucide-react";

const SERVICE_TYPES = [
  { value: "WEDDING",  label: "Wedding / Elopement", icon: "💍" },
  { value: "EVENT",    label: "Event",                icon: "🎉" },
  { value: "PORTRAIT", label: "Portrait Session",     icon: "📷" },
];

const STATUSES = [
  { value: "INQUIRY",    label: "Inquiry" },
  { value: "QUOTED",     label: "Quoted" },
  { value: "CONTRACTED", label: "Contracted" },
  { value: "CONFIRMED",  label: "Confirmed" },
  { value: "COMPLETED",  label: "Completed" },
  { value: "CANCELLED",  label: "Cancelled" },
];

// ── Package description + price helpers ──────────────────────────────────────
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

export default function EditBookingPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const [dbPackages,       setDbPackages]       = useState<any[]>([]);
  const [payments,         setPayments]         = useState<any[]>([]);
  const [clientName,       setClientName]       = useState("");

  const [serviceType,     setServiceType]     = useState("WEDDING");
  const [status,          setStatus]          = useState("INQUIRY");
  const [packageId,       setPackageId]       = useState("");
  const [eventDate,       setEventDate]       = useState("");
  const [startTime,       setStartTime]       = useState("");
  const [endTime,         setEndTime]         = useState("");
  const [quotedTotal,     setQuotedTotal]     = useState("");
  const [depositAmount,   setDepositAmount]   = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [hoursBooked,     setHoursBooked]     = useState("");
  const [venueName,       setVenueName]       = useState("");
  const [venueAddress,    setVenueAddress]    = useState("");
  const [shotList,        setShotList]        = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [internalNotes,   setInternalNotes]   = useState("");

  // Load booking + packages
  useEffect(() => {
    Promise.all([
      fetch(`/api/bookings/${id}`).then(r => r.json()),
      fetch("/api/packages").then(r => r.json()),
    ]).then(([bd, pd]) => {
      const b = bd.data ?? bd;
      setClientName(
        b.clients ? `${b.clients.first_name} ${b.clients.last_name}` : ""
      );
      setServiceType(b.service_type ?? "WEDDING");
      setStatus(b.status ?? "INQUIRY");
      setPackageId(b.package_id ?? "");
      setEventDate(b.event_date ?? "");
      setStartTime(b.event_start_time?.slice(0, 5) ?? "");
      setEndTime(b.event_end_time?.slice(0, 5) ?? "");
      setQuotedTotal(b.quoted_total != null ? String(b.quoted_total) : "");
      setDepositAmount(b.deposit_amount != null ? String(b.deposit_amount) : "");
      setDiscountPercent("");
      setHoursBooked(b.hours_booked != null ? String(b.hours_booked) : "");
      setVenueName(b.venue_name ?? "");
      setVenueAddress(b.venue_address ?? "");
      setShotList(b.shot_list ?? "");
      setSpecialRequests(b.special_requests ?? "");
      setInternalNotes(b.internal_notes ?? "");
      setPayments(b.payments ?? []);
      setDbPackages(pd.packages ?? pd.data?.packages ?? []);
      setLoading(false);
    }).catch(() => { setError("Failed to load booking."); setLoading(false); });
  }, [id]);

  // Show packages that match the service type, or have no service_type set (universal packages)
  const visiblePackages = dbPackages.filter(p =>
    !p.service_type || p.service_type.toUpperCase() === serviceType.toUpperCase()
  );

  // ── Discount helpers (mirrors new-client page) ───────────────────────────
  const selectedDbPkg = dbPackages.find(p => p.id === packageId) ?? null;
  const basePrice     = selectedDbPkg?.base_price != null ? Number(selectedDbPkg.base_price) : null;
  const isHourly      = selectedDbPkg != null && !selectedDbPkg.max_hours;
  const discountPct   = Math.min(100, Math.max(0, parseFloat(discountPercent) || 0));
  const hrs           = parseFloat(hoursBooked) || 0;
  // For display in discount strip: use hours × rate if hourly, otherwise flat price
  const listTotal     = isHourly && hrs > 0 ? hrs * (basePrice ?? 0) : (basePrice ?? 0);
  const savingsAmt    = basePrice != null && discountPct > 0
    ? Math.round(listTotal * discountPct / 100)
    : 0;

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

  const totalPaid     = payments.filter(p => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const paidDepositTotal = payments.filter(p => p.payment_type === "DEPOSIT").reduce((s, p) => s + Number(p.amount), 0);
  const depositPaid   = payments.filter(p => p.payment_type === "DEPOSIT" && p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const qt            = parseFloat(quotedTotal) || 0;
  const remaining     = qt - totalPaid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventDate) { setError("Event date is required."); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, any> = {
        service_type:    serviceType,
        status,
        event_date:      eventDate,
        package_id:      packageId  || null,
        event_start_time: startTime || null,
        event_end_time:   endTime   || null,
        quoted_total:    quotedTotal    ? parseFloat(quotedTotal)    : null,
        deposit_amount:  depositAmount  ? parseFloat(depositAmount)  : null,
        hours_booked:    hoursBooked    ? parseFloat(hoursBooked)    : null,
        venue_name:      venueName    || null,
        venue_address:   venueAddress || null,
        shot_list:       shotList     || null,
        special_requests: specialRequests || null,
        internal_notes:  internalNotes   || null,
      };
      const res  = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed."); return; }
      router.push(`/bookings/${id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const ic = "input w-full";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-brand-teal" />
    </div>
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-brand-pale-blue px-6 py-4 flex items-center gap-4">
        <Link href={`/bookings/${id}`} className="text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-brand-navy">Edit Booking</h1>
          {clientName && <p className="text-xs text-brand-teal">{clientName}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── 01 STATUS ──────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            01 — Status
          </h2>
          <select className={ic} value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* ── 02 SERVICE TYPE ─────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            02 — Service Type
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_TYPES.map(s => (
              <OptionCard key={s.value} selected={serviceType === s.value}
                onSelect={() => { setServiceType(s.value); setPackageId(""); }}
                label={s.label} icon={s.icon} />
            ))}
          </div>
        </div>

        {/* ── 03 PACKAGE ──────────────────────────────────────────────── */}
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
                        // Fixed-price package — set total directly
                        const full    = Math.round(Number(pkg.base_price));
                        const deposit = Math.round(full * 0.30);
                        setQuotedTotal(String(full));
                        setDepositAmount(String(deposit));
                      } else if (curHrs > 0) {
                        // Hourly package + hours already entered — calculate immediately
                        const total   = Math.round(curHrs * Number(pkg.base_price));
                        const deposit = Math.round(total * 0.30);
                        setQuotedTotal(String(total));
                        setDepositAmount(String(deposit));
                      } else {
                        // Hourly but no hours yet — clear so user enters hours first
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
                onSelect={() => { setPackageId(""); setDiscountPercent(""); }}
                label="Custom / No Package"
                sub="Enter quoted total manually"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              No packages found for this service type. Enter pricing manually below.
            </p>
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
                onChange={e => setEventDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className={ic} value={startTime}
                onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className={ic} value={endTime}
                onChange={e => setEndTime(e.target.value)} />
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
                value={venueName} onChange={e => setVenueName(e.target.value)} />
            </div>
            <div>
              <label className="label">Venue Address</label>
              <input className={ic} placeholder="e.g. Barton ACT 2600"
                value={venueAddress} onChange={e => setVenueAddress(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── 06 PRICING ──────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            06 — Pricing
          </h2>
          <p className="text-xs text-gray-400 -mt-2">
            Auto-filled from the package above. Apply a discount % to reduce the price — deliverables stay the same.
          </p>

          {/* Discount strip */}
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
            {(serviceType === "EVENT" || serviceType === "PORTRAIT") && (
              <div>
                <label className="label">
                  Hours Booked
                  {isHourly && basePrice != null && (
                    <span className="text-gray-400 font-normal ml-1">
                      × ${basePrice}/hr = quoted total
                    </span>
                  )}
                </label>
                <input type="number" step="0.5" min="0.5" className={ic}
                  placeholder="e.g. 3" value={hoursBooked}
                  onChange={e => handleHoursChange(e.target.value)} />
              </div>
            )}
          </div>

          {/* Payment summary — read-only */}
          {payments.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment Summary</p>
              {paidDepositTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Deposit
                    {depositPaid >= paidDepositTotal && (
                      <span className="ml-1.5 text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">PAID</span>
                    )}
                  </span>
                  <span className={`font-medium ${depositPaid >= paidDepositTotal ? "text-green-600" : "text-gray-700"}`}>
                    ${paidDepositTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Total paid</span>
                <span className="font-medium text-green-600">
                  ${totalPaid.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="font-semibold">Remaining</span>
                <span className={`font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  ${remaining.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
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
              value={shotList} onChange={e => setShotList(e.target.value)}
              placeholder="Key people, moments, or shots the client has requested…" />
          </div>
          <div>
            <label className="label">Special Requests</label>
            <textarea rows={2} className={ic + " resize-y"}
              value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
              placeholder="Any special considerations, access requirements…" />
          </div>
          <div>
            <label className="label">
              Internal Notes{" "}
              <span className="text-gray-400 font-normal normal-case">(not shared with client)</span>
            </label>
            <textarea rows={2} className={ic + " resize-y"}
              value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
              placeholder="Private reminders, contractor notes, logistics…" />
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Changes</>
            }
          </button>
          <Link href={`/bookings/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
