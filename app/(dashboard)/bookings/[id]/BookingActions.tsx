// app/(dashboard)/bookings/[id]/BookingActions.tsx
// Client component — handles interactive booking actions.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Loader2, FileText, Send, ClipboardList, FolderOpen, Star, ListChecks } from "lucide-react";

const BOOKING_STATUSES = ["INQUIRY","QUOTED","CONTRACTED","CONFIRMED","COMPLETED","CANCELLED"];

// ── Status update form ────────────────────────────────────────────────────────
export function StatusUpdateForm({ bookingId, currentStatus }: { bookingId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <label className="label text-xs">Update Status</label>
      <div className="flex gap-2 mt-1">
        <select value={status} onChange={e => setStatus(e.target.value)} className="input text-sm py-1.5">
          {BOOKING_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <button onClick={save} disabled={saving} className="btn-secondary text-sm py-1.5">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Quick payment form ────────────────────────────────────────────────────────
export function QuickPaymentForm({ bookingId }: { bookingId: string }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id:   bookingId,
        payment_type: fd.get("payment_type"),
        amount:       parseFloat(fd.get("amount") as string),
        status:       fd.get("status"),
        due_date:     fd.get("due_date") || undefined,
      }),
    });
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <select name="payment_type" className="input text-xs py-1.5" required>
          <option value="DEPOSIT">Deposit</option>
          <option value="BALANCE">Balance</option>
          <option value="EXTRA_SERVICE">Extra Service</option>
        </select>
        <select name="status" className="input text-xs py-1.5">
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>
      <input type="number" name="amount" step="0.01" min="0" className="input w-full text-xs py-1.5" placeholder="Amount $" required />
      <input type="date" name="due_date" className="input w-full text-xs py-1.5" />
      <button type="submit" disabled={saving} className="btn-primary w-full text-xs py-1.5">
        {saving ? "Saving…" : "Save Payment"}
      </button>
    </form>
  );
}

// ── Delete booking ────────────────────────────────────────────────────────────
export function DeleteBookingButton({ bookingId, clientId }: { bookingId: string; clientId: string }) {
  const router  = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push(clientId ? `/clients/${clientId}` : "/bookings");
        router.refresh();
        return;
      }
      const json = await res.json();
      setError(json.error ?? "Delete failed.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className="btn-danger text-sm py-1.5 flex items-center gap-1.5"
      >
        <Trash2 size={14} /> Delete Booking
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !loading && setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-navy">Delete this booking?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This is permanent. Bookings with paid invoices cannot be deleted — set status to Cancelled instead.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirm(false)} disabled={loading} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={loading} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Generate deposit invoice ──────────────────────────────────────────────────
export function GenerateDepositInvoiceButton({
  bookingId,
  clientId,
  depositAmount,
  eventDate,
  serviceType,
}: {
  bookingId: string;
  clientId: string;
  depositAmount: number;
  eventDate?: string;
  serviceType?: string;
}) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const serviceLabel =
    serviceType === "WEDDING"  ? "Wedding Photography" :
    serviceType === "EVENT"    ? "Event Photography" :
    serviceType === "PORTRAIT" ? "Portrait Photography" :
    "Photography";

  // Format event date dd/mm/yyyy for the line item description
  const fmtDate = (d?: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return day && m && y ? ` · ${day}/${m}/${y}` : "";
  };

  async function handleGenerate() {
    if (depositAmount <= 0) {
      setError("No deposit amount set. Add a quoted total first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Due date: today + 7 days
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const dueDate = due.toISOString().split("T")[0];

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: {
            booking_id:           bookingId,
            client_id:            clientId,
            due_date:             dueDate,
            apply_gst:            false,
            notes:                "Deposit due upon signing of contract.",
            invoice_payment_type: "DEPOSIT",
          },
          line_items: [{
            description: `${serviceLabel} Deposit${fmtDate(eventDate)}`,
            quantity:    1,
            unit_price:  depositAmount,
            sort_order:  0,
          }],
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create invoice."); return; }

      const inv = data.data ?? data;
      router.push(`/invoices/${inv.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-secondary text-sm py-1.5 w-full flex items-center justify-center gap-2"
      >
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
          : <><FileText size={14} /> Generate Deposit Invoice</>
        }
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

type Props = {
  booking: any;
  client:  any;
};

// ── Numbered step badge ───────────────────────────────────────────────────────
const N = ({ n }: { n: number }) => (
  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-brand-teal/50 text-brand-teal text-[8px] font-bold leading-none flex-shrink-0">
    {n}
  </span>
);

// ── Delivery modal ────────────────────────────────────────────────────────────
function DeliveryModal({ bookingId, clientEmail, onClose, onSent }: {
  bookingId: string; clientEmail: string;
  onClose: () => void; onSent: (msg: string) => void;
}) {
  const [driveUrl, setDriveUrl] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  async function send() {
    if (!driveUrl.trim()) { setErr("Please paste the Google Drive link."); return; }
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/google/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "gallery_delivery", booking_id: bookingId, to: clientEmail, drive_url: driveUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      onSent(`Gallery delivery sent to ${clientEmail} ✓`);
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
            <FolderOpen size={18} className="text-brand-teal" />
          </div>
          <div>
            <h3 className="font-semibold text-brand-navy">Send Gallery Delivery</h3>
            <p className="text-xs text-gray-500">Paste your Google Drive folder link below</p>
          </div>
        </div>
        <div>
          <label className="label text-xs">Google Drive Link</label>
          <input
            className="input w-full text-sm mt-1"
            placeholder="https://drive.google.com/drive/folders/…"
            value={driveUrl}
            onChange={e => setDriveUrl(e.target.value)}
          />
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={send} disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Gallery</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookingActions({ booking, client }: Props) {
  const [gcalLoading,        setGcalLoading]        = useState(false);
  const [actionLoading,      setActionLoading]      = useState<string | null>(null);
  const [showDeliveryModal,  setShowDeliveryModal]  = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function msg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  }

  async function syncCalendar() {
    setGcalLoading(true);
    try {
      const res  = await fetch("/api/google/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: booking.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Calendar sync failed");
      msg("success", "Event synced to Google Calendar ✓");
    } catch (err: any) { msg("error", err.message); }
    finally { setGcalLoading(false); }
  }

  async function sendEmail(template: string, extra?: Record<string, any>) {
    setActionLoading(template);
    try {
      const res  = await fetch("/api/google/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, booking_id: booking.id, to: client?.email, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      const labels: Record<string, string> = {
        booking_confirmation: "Booking confirmation",
        pre_event_checklist:  "Pre-event checklist",
        review_request:       "Review request",
      };
      msg("success", `${labels[template] ?? "Email"} sent to ${client?.email} ✓`);
    } catch (err: any) { msg("error", err.message); }
    finally { setActionLoading(null); }
  }

  async function sendQuote() {
    setActionLoading("quote");
    try {
      const res  = await fetch(`/api/bookings/${booking.id}/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ send: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote failed");
      msg("success", `Quote ${data.data?.quote_number} sent to ${client?.email} ✓`);
    } catch (err: any) { msg("error", err.message); }
    finally { setActionLoading(null); }
  }

  async function autoPopulateDeliverables() {
    setActionLoading("deliverables");
    try {
      const res  = await fetch(`/api/bookings/${booking.id}/deliverables`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      msg("success", data.data?.created > 0 ? `${data.data.created} deliverable${data.data.created !== 1 ? "s" : ""} created ✓` : "Deliverables already up to date ✓");
      window.location.reload();
    } catch (err: any) { msg("error", err.message); }
    finally { setActionLoading(null); }
  }

  const busy = (key: string) => actionLoading === key;

  return (
    <>
      {showDeliveryModal && (
        <DeliveryModal
          bookingId={booking.id}
          clientEmail={client?.email}
          onClose={() => setShowDeliveryModal(false)}
          onSent={text => msg("success", text)}
        />
      )}

      <div className="flex flex-col items-end gap-2">
        {message && (
          <p className={`text-xs px-3 py-1.5 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 justify-end">

          {/* 1 — Quote */}
          <button onClick={sendQuote} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5" title="Generate & email quote PDF">
            <N n={1} />
            {busy("quote") ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Send Quote
          </button>

          {/* 2 — Booking confirmation */}
          <button onClick={() => sendEmail("booking_confirmation")} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5">
            <N n={2} />
            {busy("booking_confirmation") ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send Confirmation
          </button>

          {/* 3 — Pre-event checklist */}
          <button onClick={() => sendEmail("pre_event_checklist")} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5" title="Email client asking for run sheet, vendor contacts, venue details">
            <N n={3} />
            {busy("pre_event_checklist") ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
            Pre-Event Checklist
          </button>

          {/* 4 — Setup deliverables */}
          <button onClick={autoPopulateDeliverables} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5" title="Auto-create deliverables based on package">
            <N n={4} />
            {busy("deliverables") ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}
            Setup Deliverables
          </button>

          {/* 5 — Send gallery */}
          <button onClick={() => setShowDeliveryModal(true)} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5" title="Send Google Drive gallery link to client">
            <N n={5} />
            <FolderOpen size={14} />
            Send Gallery
          </button>

          {/* 6 — Request review */}
          <button onClick={() => sendEmail("review_request")} disabled={!!actionLoading}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5" title="Email client requesting a Google review">
            <N n={6} />
            {busy("review_request") ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
            Request Review
          </button>

          {/* 7 — Generate invoice */}
          <Link href={`/invoices/new?booking_id=${booking.id}&client_id=${booking.client_id}`}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5">
            <N n={7} />
            Generate Invoice
          </Link>

          {/* 8 — Sync calendar */}
          <button onClick={syncCalendar} disabled={gcalLoading}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            <N n={8} />
            {gcalLoading ? "Syncing…" : booking.gcal_event_id ? "Re-sync Calendar" : "Sync to Calendar"}
          </button>

        </div>
      </div>
    </>
  );
}
