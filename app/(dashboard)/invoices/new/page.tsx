// app/(dashboard)/invoices/new/page.tsx
// Client component — invoice generator with line items, GST, and booking pre-fill.
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

type LineItem = {
  id: string;       // temp client-side key
  description: string;
  quantity: number;
  unit_price: number;
};

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefillBookingId = searchParams.get("booking_id") || "";
  const prefillClientId = searchParams.get("client_id") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client + booking pickers
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState(prefillBookingId);

  // Invoice fields
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [includeGst, setIncludeGst] = useState(true);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("Thank you for choosing JNguyen Co.!");

  // Totals
  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const gst = includeGst ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  // Pre-fill if coming from a booking
  useEffect(() => {
    if (prefillClientId) {
      fetch(`/api/clients/${prefillClientId}`)
        .then((r) => r.json())
        .then((d) => { if (d.client) setSelectedClient(d.client); })
        .catch(console.error);
    }
  }, [prefillClientId]);

  // Load client's bookings when client selected
  useEffect(() => {
    if (!selectedClient) { setBookings([]); return; }
    fetch(`/api/bookings?client_id=${selectedClient.id}&limit=20`)
      .then((r) => r.json())
      .then((d) => setBookings(d.data?.bookings || []))
      .catch(console.error);
  }, [selectedClient]);

  // Pre-fill line items from booking package when booking selected
  useEffect(() => {
    if (!selectedBookingId || !bookings.length) return;
    const booking = bookings.find((b: any) => b.id === selectedBookingId);
    if (!booking?.packages) return;
    const pkg = booking.packages;
    setLineItems([{
      id: crypto.randomUUID(),
      description: pkg.name,
      quantity: booking.hours_booked || 1,
      unit_price: booking.hours_booked
        ? (pkg.hourly_rate || pkg.base_price)
        : pkg.base_price,
    }]);
  }, [selectedBookingId, bookings]);

  // Client search
  useEffect(() => {
    if (clientSearch.length < 2) { setClients([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setClients(d.data?.clients || []))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((li) => li.id === id ? { ...li, [field]: value } : li)
    );
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) { setError("Please select a client."); return; }
    if (!dueDate) { setError("Due date is required."); return; }
    if (lineItems.some((li) => !li.description.trim())) {
      setError("All line items must have a description.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body = {
        client_id: selectedClient.id,
        booking_id: selectedBookingId || undefined,
        due_date: dueDate,
        include_gst: includeGst,
        notes,
        line_items: lineItems.map((li, i) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unit_price: Number(li.unit_price),
          sort_order: i,
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create invoice."); return; }

      router.push(`/invoices/${data.invoice.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-brand-navy">New Invoice</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Client ── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Client</h2>
          {selectedClient ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-brand-pale-blue/30 border border-brand-pale-blue">
              <div>
                <p className="font-medium text-brand-navy">{selectedClient.first_name} {selectedClient.last_name}</p>
                <p className="text-sm text-gray-500">{selectedClient.email}</p>
              </div>
              <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(""); setSelectedBookingId(""); }}
                className="text-xs text-gray-400 hover:text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" className="input w-full" placeholder="Search client…"
                value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
              {clients.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {clients.map((c: any) => (
                    <li key={c.id}>
                      <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                        onClick={() => { setSelectedClient(c); setClients([]); setClientSearch(""); }}>
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-gray-400 ml-2">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedClient && (
            <div>
              <label className="label">Link to Booking (optional)</label>
              <select className="input w-full" value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}>
                <option value="">— No booking —</option>
                {bookings.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.event_date} — {b.service_type}
                    {b.packages?.name ? ` · ${b.packages.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Line Items ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Line Items</h2>
            <button type="button" onClick={() => setLineItems((p) => [...p, newLineItem()])}
              className="text-xs text-brand-teal hover:underline">+ Add item</button>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide px-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-2 text-right">Unit Price</span>
            <span className="col-span-2 text-right">Total</span>
          </div>

          {lineItems.map((li) => (
            <div key={li.id} className="grid grid-cols-12 gap-2 items-center group">
              <input type="text" className="input col-span-6 py-1.5 text-sm" placeholder="Description"
                value={li.description} onChange={(e) => updateLineItem(li.id, "description", e.target.value)} required />
              <input type="number" min="1" step="0.5" className="input col-span-2 py-1.5 text-sm text-center"
                value={li.quantity} onChange={(e) => updateLineItem(li.id, "quantity", parseFloat(e.target.value) || 0)} />
              <div className="col-span-2 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input type="number" min="0" step="0.01" className="input w-full py-1.5 text-sm text-right pl-5"
                  value={li.unit_price} onChange={(e) => updateLineItem(li.id, "unit_price", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <span className="text-sm font-medium">{formatCurrency(li.quantity * li.unit_price)}</span>
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(li.id)}
                    className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-1">✕</button>
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeGst} onChange={(e) => setIncludeGst(e.target.checked)}
                  className="rounded border-gray-300" />
                GST (10%)
              </label>
              <span className="font-medium">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-between text-brand-navy font-semibold text-base pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* ── Invoice Settings ── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Invoice Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Due Date *</label>
              <input type="date" className="input w-full" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Notes to Client</label>
            <textarea rows={3} className="input w-full resize-none"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating…" : "Create Invoice"}
          </button>
          <Link href="/invoices" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
