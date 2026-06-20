// app/(dashboard)/invoices/[id]/page.tsx
// Invoice detail — PDF download, send via Gmail, mark as paid, status management.
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getInvoiceStatusBadge,
} from "@/lib/utils";
import { InvoiceDetailActions } from "./InvoiceDetailActions";

type Props = { params: { id: string } };

export default async function InvoiceDetailPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address),
      bookings (id, event_date, service_type, packages (name)),
      invoice_line_items (id, description, quantity, unit_price, total, sort_order)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !invoice) notFound();

  const lineItems = ((invoice.invoice_line_items as any[]) || []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const client = invoice.clients as any;
  const booking = invoice.bookings as any;
  const badge = getInvoiceStatusBadge(invoice.status);
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "PAID";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
          <span className="text-gray-300">/</span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-brand-navy font-mono">{invoice.invoice_number}</h1>
              <span className={`badge ${badge.class}`}>{badge.label}</span>
              {isOverdue && (
                <span className="badge badge-red text-xs">OVERDUE</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {client ? `${client.first_name} ${client.last_name}` : ""}
              {booking?.event_date ? ` · ${formatDate(booking.event_date)}` : ""}
            </p>
          </div>
        </div>

        {/* Actions — client component */}
        <InvoiceDetailActions invoice={invoice} client={client} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main: invoice preview ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-6">
            {/* From / To header */}
            <div className="grid grid-cols-2 gap-6 pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">From</p>
                <p className="font-semibold text-brand-navy">{process.env.NEXT_PUBLIC_BUSINESS_NAME || "JNguyen Co."}</p>
                <p className="text-sm text-gray-500">{process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "johnny.nguyen@jnguyen.co"}</p>
                {process.env.NEXT_PUBLIC_BUSINESS_ABN && (
                  <p className="text-sm text-gray-500">ABN: {process.env.NEXT_PUBLIC_BUSINESS_ABN}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
                {client && (
                  <>
                    <p className="font-semibold text-brand-navy">{client.first_name} {client.last_name}</p>
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-brand-navy">{client.email}</a>
                    {client.address && <p className="text-sm text-gray-500">{client.address}</p>}
                  </>
                )}
              </div>
            </div>

            {/* Invoice meta */}
            <div className="grid grid-cols-3 gap-4 text-sm pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice #</p>
                <p className="font-mono font-medium mt-0.5">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Issued</p>
                <p className="font-medium mt-0.5">{formatDate(invoice.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Due</p>
                <p className={`font-medium mt-0.5 ${isOverdue ? "text-red-600" : ""}`}>
                  {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                </p>
              </div>
            </div>

            {/* Line items */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Qty</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unit Price</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li: any) => (
                  <tr key={li.id} className="border-b border-gray-50">
                    <td className="py-3 text-gray-700">{li.description}</td>
                    <td className="py-3 text-center text-gray-500">{li.quantity}</td>
                    <td className="py-3 text-right text-gray-500">{formatCurrency(li.unit_price)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(li.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {Number(invoice.gst) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>GST (10%)</span>
                    <span>{formatCurrency(invoice.gst)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-brand-navy text-base pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Notes</p>
                <p>{invoice.notes}</p>
              </div>
            )}

            {/* Payment details */}
            <div className="border border-gray-200 rounded-lg p-4 text-sm space-y-1">
              <p className="font-semibold text-brand-navy mb-2">Payment Details</p>
              <p className="text-gray-600">Bank Transfer: JNguyen Co.</p>
              <p className="text-gray-600">BSB: 062-000 · Account: 12345678</p>
              <p className="text-gray-400 text-xs mt-2">Reference: {invoice.invoice_number}</p>
            </div>
          </div>
        </div>

        {/* ── Right: status + actions ── */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`badge ${badge.class}`}>{badge.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Due</span>
                <span className="font-bold text-brand-navy">{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid On</span>
                  <span className="text-green-600 font-medium">{formatDate(invoice.paid_at)}</span>
                </div>
              )}
              {invoice.sent_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent</span>
                  <span className="text-gray-600">{formatDate(invoice.sent_at)}</span>
                </div>
              )}
            </div>
          </div>

          {booking && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Booking</h2>
              <Link href={`/bookings/${booking.id}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded text-sm">
                <p className="font-medium text-brand-navy">{formatDate(booking.event_date)}</p>
                <p className="text-gray-500 text-xs">{booking.service_type} {booking.packages?.name ? `· ${booking.packages.name}` : ""}</p>
              </Link>
            </div>
          )}

          {client && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Client</h2>
              <Link href={`/clients/${client.id}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded text-sm">
                <p className="font-medium text-brand-navy">{client.first_name} {client.last_name}</p>
                <p className="text-gray-500 text-xs">{client.email}</p>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
