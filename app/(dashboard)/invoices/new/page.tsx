"use client";
// app/(dashboard)/invoices/new/page.tsx
// Smart invoice builder — pre-fills from booking including discount, deposit credit, balance due.
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, AlertCircle, ChevronDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

function uid() { return crypto.randomUUID(); }
function blank(): LineItem { return { id: uid(), description: "", quantity: 1, unit_price: 0 }; }

export default function NewInvoicePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const prefillBookingId = searchParams.get("booking_id") || "";
  const prefillClientId  = searchParams.get("client_id")  || "";

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Client picker ─────────────────────────────────────────────────────────
  const [clientSearch,    setClientSearch]    = useState("");
  const [clientResults,   setClientResults]   = useState<any[]>([]);
  const [selectedClient,  setSelectedClient]  = useState<any | null>(null);

  // ── Booking picker ────────────────────────────────────────────────────────
  const [bookings,         setBookings]         = useState<any[]>([]);
  const [selectedBookingId,setSelectedBookingId]= useState(prefillBookingId);
  const [fullBooking,      setFullBooking]       = useState<any | null>(null);
  const [bookingLoading,   setBookingLoading]    = useState(false);
  const [bookingFetchError,setBookingFetchError] = useState<string | null>(null);

  // ── Invoice fields ────────────────────────────────────────────────────────
  const [lineItems,  setLineItems]  = useState<LineItem[]>([blank()]);
  const [includeGst, setIncludeGst] = useState(false);
  const [dueDate,    setDueDate]    = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("Thank you for choosing JNguyen Co.!");

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const gst      = includeGst ? subtotal * 0.1 : 0;
  const total    = subtotal + gst;

  // ── Derived booking summary ────────────────────────────────────────────────
  const pkg          = fullBooking?.packages as any;
  const originalPrice = pkg?.base_price ? Number(pkg.base_price) : null;
  const quotedTotal   = fullBooking?.quoted_total ? Number(fullBooking.quoted_total) : null;
  const discountAmt   = (originalPrice != null && quotedTotal != null && originalPrice > quotedTotal)
    ? originalPrice - quotedTotal : 0;
  const discountPct   = (originalPrice && discountAmt > 0)
    ? Math.round(discountAmt / originalPrice * 100) : 0;

  const payments = (fullBooking?.payments as any[]) || [];
  const totalPaid = payments.filter(p => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const depositPaid = payments.filter(p => p.payment_type === "DEPOSIT" && p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = quotedTotal != null ? quotedTotal - totalPaid : null;

  // ── Auto-load client from prefill ─────────────────────────────────────────
  useEffect(() => {
    if (!prefillClientId) return;
    fetch(`/api/clients/${prefillClientId}`)
      .then(r => r.json())
      .then(d => { if (d.data) setSelectedClient(d.data); })
      .catch(() => {});
  }, [prefillClientId]);

  // ── Load bookings when client selected ────────────────────────────────────
  useEffect(() => {
    if (!selectedClient) { setBookings([]); setFullBooking(null); return; }
    fetch(`/api/bookings?client_id=${selectedClient.id}&limit=20`)
      .then(r => r.json())
      .then(d => setBookings(d.data?.bookings || []))
      .catch(() => {});
  }, [selectedClient]);

  // ── Load full booking detail (with payments) when booking selected ─────────
  useEffect(() => {
    if (!selectedBookingId) { setFullBooking(null); setBookingFetchError(null); return; }
    setBookingLoading(true);
    setBookingFetchError(null);
    fetch(`/api/bookings/${selectedBookingId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
        setFullBooking(d.data ?? null);
        if (!d.data) setBookingFetchError("Booking data not found in response.");
      })
      .catch(err => { setBookingFetchError(err.message || "Failed to load booking."); setFullBooking(null); })
      .finally(() => setBookingLoading(false));
  }, [selectedBookingId]);

  // ── Client search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=8`)
        .then(r => r.json())
        .then(d => setClientResults(d.data?.clients || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // ── Pre-fill helpers ──────────────────────────────────────────────────────
  function fillFinalInvoice() {
    if (!fullBooking) return;
    const serviceName = pkg?.name
      ? `${pkg.name}${discountPct > 0 ? ` (${discountPct}% discount applied)` : ""}`
      : fullBooking.service_type === "WEDDING"  ? "Wedding Photography & Videography"
      : fullBooking.service_type === "EVENT"    ? "Event Photography"
      : "Photography Session";

    const items: LineItem[] = [];

    // Line 1: package at quoted (discounted) price
    if (quotedTotal != null && quotedTotal > 0) {
      items.push({ id: uid(), description: serviceName, quantity: 1, unit_price: quotedTotal });
    } else {
      items.push(blank());
    }

    // Line 2: deduct deposit(s) already paid
    if (depositPaid > 0) {
      items.push({
        id: uid(),
        description: `Less: Deposit already paid${payments.find(p => p.payment_type === "DEPOSIT" && p.status === "PAID")?.paid_date ? ` (${formatDate(payments.find(p => p.payment_type === "DEPOSIT" && p.status === "PAID")?.paid_date)})` : ""}`,
        quantity: 1,
        unit_price: -depositPaid,
      });
    }

    setLineItems(items);
  }

  function fillFullInvoice() {
    if (!fullBooking) return;
    const serviceName = pkg?.name
      ? `${pkg.name}${discountPct > 0 ? ` (${discountPct}% discount applied)` : ""}`
      : "Photography Package";
    setLineItems([{
      id: uid(),
      description: serviceName,
      quantity: 1,
      unit_price: quotedTotal ?? 0,
    }]);
  }

  function fillDepositInvoice() {
    if (!fullBooking) return;
    const depAmt = fullBooking.deposit_amount
      ? Number(fullBooking.deposit_amount)
      : quotedTotal ? Math.round(quotedTotal * 0.30) : 0;
    setLineItems([{
      id: uid(),
      description: `${pkg?.name ?? "Photography Package"} – Deposit`,
      quantity: 1,
      unit_price: depAmt,
    }]);
  }

  // ── Line item helpers ─────────────────────────────────────────────────────
  function updateLi(id: string, field: keyof LineItem, val: string | number) {
    setLineItems(p => p.map(li => li.id === id ? { ...li, [field]: val } : li));
  }
  function removeLi(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems(p => p.filter(li => li.id !== id));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) { setError("Please select a client."); return; }
    if (!dueDate)         { setError("Due date is required.");   return; }
    if (lineItems.some(li => !li.description.trim())) {
      setError("All line items must have a description."); return;
    }

    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:  selectedClient.id,
          booking_id: selectedBookingId || undefined,
          due_date:   dueDate,
          include_gst: includeGst,
          notes,
          line_items: lineItems.map((li, i) => ({
            description: li.description,
            quantity:    Number(li.quantity),
            unit_price:  Number(li.unit_price),
            sort_order:  i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create invoice."); return; }
      router.push(`/invoices/${data.invoice?.id ?? data.data?.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-brand-navy">New Invoice</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── 01 Client ── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            01 — Client
          </h2>

          {selectedClient ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-brand-pale-blue/30 border border-brand-pale-blue">
              <div>
                <p className="font-medium text-brand-navy">{selectedClient.first_name} {selectedClient.last_name}</p>
                <p className="text-sm text-gray-500">{selectedClient.email}</p>
              </div>
              <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(""); setSelectedBookingId(""); setFullBooking(null); setLineItems([blank()]); }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input className="input w-full" placeholder="Search client by name…"
                value={clientSearch} onChange={e => setClientSearch(e.target.value)} autoFocus />
              {clientResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {clientResults.map((c: any) => (
                    <li key={c.id}>
                      <button type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                        onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(""); }}>
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Booking selector */}
          {selectedClient && (
            <div>
              <label className="label">Link to Booking</label>
              <select className="input w-full" value={selectedBookingId}
                onChange={e => { setSelectedBookingId(e.target.value); setLineItems([blank()]); }}>
                <option value="">— No booking —</option>
                {bookings.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.event_date ? formatDate(b.event_date) : "No date"} · {b.service_type}
                    {b.packages?.name ? ` · ${b.packages.name}` : ""}
                    {b.quoted_total ? ` · ${formatCurrency(b.quoted_total)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Booking summary panel (shown when booking selected) ── */}
        {bookingLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Loader2 size={14} className="animate-spin" /> Loading booking details…
          </div>
        )}

        {bookingFetchError && !bookingLoading && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            Could not load booking details: {bookingFetchError}
          </div>
        )}

        {fullBooking && !bookingLoading && (
          <div className="card border-brand-teal/20 bg-brand-cream/40 space-y-4">
            <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
              Booking Summary
            </h2>

            {/* Financial breakdown */}
            <div className="space-y-1.5 text-sm">
              {originalPrice != null && (
                <div className="flex justify-between text-gray-500">
                  <span>Package ({pkg?.name})</span>
                  <span>{formatCurrency(originalPrice)}</span>
                </div>
              )}
              {discountAmt > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discountPct}% off)</span>
                  <span>−{formatCurrency(discountAmt)}</span>
                </div>
              )}
              {quotedTotal != null && (
                <div className="flex justify-between font-semibold text-brand-navy border-t border-brand-pale-blue pt-1.5">
                  <span>Quoted Total</span>
                  <span>{formatCurrency(quotedTotal)}</span>
                </div>
              )}
              {depositPaid > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Deposit paid</span>
                  <span className="text-green-600">−{formatCurrency(depositPaid)}</span>
                </div>
              )}
              {totalPaid > depositPaid && (
                <div className="flex justify-between text-gray-500">
                  <span>Other payments received</span>
                  <span className="text-green-600">−{formatCurrency(totalPaid - depositPaid)}</span>
                </div>
              )}
              {balanceDue != null && (
                <div className={`flex justify-between font-bold text-base border-t border-brand-pale-blue pt-1.5 ${balanceDue <= 0 ? "text-green-600" : "text-brand-navy"}`}>
                  <span>Balance Due</span>
                  <span>{balanceDue <= 0 ? "Paid in full ✓" : formatCurrency(balanceDue)}</span>
                </div>
              )}
            </div>

            {/* Quick-fill buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-brand-pale-blue">
              <span className="text-xs text-gray-400 self-center mr-1">Fill as:</span>
              {balanceDue != null && balanceDue > 0 && (
                <button type="button" onClick={fillFinalInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-brand-navy transition-colors">
                  <Check size={11} /> Final Invoice (balance {formatCurrency(balanceDue)})
                </button>
              )}
              {quotedTotal != null && quotedTotal > 0 && (
                <button type="button" onClick={fillFullInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-teal/40 text-brand-teal text-xs font-semibold hover:bg-brand-teal/5 transition-colors">
                  Full Invoice ({formatCurrency(quotedTotal)})
                </button>
              )}
              {depositPaid === 0 && quotedTotal != null && (
                <button type="button" onClick={fillDepositInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                  Deposit Only
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 02 Line Items ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2 flex-1">
              02 — Line Items
            </h2>
            <button type="button" onClick={() => setLineItems(p => [...p, blank()])}
              className="text-xs text-brand-teal hover:underline ml-4 mb-2">+ Add item</button>
          </div>

          <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide px-1 -mt-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-3 text-right">Unit Price</span>
            <span className="col-span-1"></span>
          </div>

          {lineItems.map(li => (
            <div key={li.id} className="grid grid-cols-12 gap-2 items-center group">
              <input className="input col-span-6 py-1.5 text-sm" placeholder="Description"
                value={li.description} onChange={e => updateLi(li.id, "description", e.target.value)} required />
              <input type="number" min="0.5" step="0.5" className="input col-span-2 py-1.5 text-sm text-center"
                value={li.quantity} onChange={e => updateLi(li.id, "quantity", parseFloat(e.target.value) || 0)} />
              <div className="col-span-3 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">$</span>
                <input type="number" step="0.01" className="input w-full py-1.5 text-sm text-right pl-6"
                  value={li.unit_price} onChange={e => updateLi(li.id, "unit_price", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-1 flex justify-end">
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLi(li.id)}
                    className="text-gray-300 hover:text-red-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                )}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-500">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={includeGst} onChange={e => setIncludeGst(e.target.checked)}
                  className="rounded border-gray-300 accent-brand-teal" />
                GST (10%)
              </label>
              <span className="font-medium">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-between text-brand-navy font-bold text-base pt-1.5 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* ── 03 Invoice Settings ── */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue pb-2">
            03 — Invoice Settings
          </h2>
          <div>
            <label className="label">Due Date *</label>
            <input type="date" className="input w-full" value={dueDate}
              onChange={e => setDueDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Notes to Client</label>
            <textarea rows={2} className="input w-full resize-y"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary min-w-[140px] justify-center">
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
              : <><Check size={14} /> Create Invoice</>
            }
          </button>
          <Link href="/invoices" className="btn-secondary">Cancel</Link>
        </div>

      </form>
    </div>
  );
}
