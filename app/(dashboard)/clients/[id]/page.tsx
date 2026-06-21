// app/(dashboard)/clients/[id]/page.tsx — Client detail page
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import {
  formatDate, formatPhone, formatCurrency,
  getBookingStatusBadge, getInvoiceStatusBadge, formatServiceType
} from "@/lib/utils";
import {
  ArrowLeft, Mail, Phone, MapPin, Instagram,
  Plus, Edit, CalendarDays, FileText, FolderOpen
} from "lucide-react";
import { FillContractButton } from "./FillContractButton";
import { DeleteClientButton } from "../DeleteClientButton";

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("first_name, last_name").eq("id", params.id).single();
  return { title: data ? `${data.first_name} ${data.last_name} — Clients` : "Client" };
}

export default async function ClientDetailPage({ params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: client, error } = await supabase
    .from("clients")
    .select(`
      *,
      bookings (
        id, event_date, event_start_time, event_end_time, status, service_type,
        quoted_total, deposit_amount, venue_name, venue_address,
        packages (name)
      ),
      invoices (
        id, invoice_number, status, total_amount, amount_paid, due_date, issue_date
      )
    `)
    .eq("id", params.id)
    .eq("owner_id", user!.id)
    .single();

  if (error || !client) {
    console.error("[client/[id]] query failed:", error?.message, "| user:", user?.id, "| id:", params.id);
    notFound();
  }

  const bookings = (client.bookings ?? []).sort(
    (a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );
  const latestBooking: any = bookings[0] ?? null;
  const invoices = client.invoices ?? [];
  const totalRevenue = invoices.filter((i: any) => i.status === "PAID")
    .reduce((sum: number, i: any) => sum + (i.total_amount ?? 0), 0);

  return (
    <>
      <TopBar
        title={`${client.first_name} ${client.last_name}`}
        subtitle="Client Profile"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Back link */}
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={15} /> All Clients
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: contact info ─────────────────── */}
          <div className="space-y-4">
            {/* Contact card */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-brand-navy">
                    {client.first_name} {client.last_name}
                  </h2>
                  {client.partner_first && (
                    <p className="text-sm text-brand-teal">
                      &amp; {client.partner_first} {client.partner_last}
                    </p>
                  )}
                </div>
                <Link href={`/clients/${client.id}/edit`} className="btn-secondary py-1 text-xs">
                  <Edit size={13} /> Edit
                </Link>
              </div>

              <div className="space-y-2.5">
                {client.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={14} className="text-brand-teal shrink-0" />
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal break-all">
                      {client.email}
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={14} className="text-brand-teal shrink-0" />
                    <a href={`tel:${client.phone}`} className="hover:text-brand-teal">
                      {formatPhone(client.phone)}
                    </a>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <MapPin size={14} className="text-brand-teal shrink-0 mt-0.5" />
                    <span>{client.address}</span>
                  </div>
                )}
                {client.instagram_handle && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Instagram size={14} className="text-brand-teal shrink-0" />
                    <a
                      href={`https://instagram.com/${client.instagram_handle.replace("@", "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="hover:text-brand-teal"
                    >
                      @{client.instagram_handle.replace("@", "")}
                    </a>
                  </div>
                )}
                {client.gdrive_folder_id && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <FolderOpen size={14} className="text-brand-teal shrink-0" />
                    <a
                      href={`https://drive.google.com/drive/folders/${client.gdrive_folder_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="hover:text-brand-teal"
                    >
                      Google Drive folder ↗
                    </a>
                  </div>
                )}
              </div>

              {client.referral_source && (
                <div className="mt-4 pt-4 border-t border-brand-pale-blue">
                  <p className="text-xs text-brand-teal font-semibold uppercase tracking-wider mb-1">
                    Referral Source
                  </p>
                  <p className="text-sm text-gray-700">
                    {client.referral_source.replace(/_/g, " ").toLowerCase()
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </p>
                  {client.referral_notes && (
                    <p className="text-xs text-gray-500 mt-0.5">{client.referral_notes}</p>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                Summary
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total bookings</span>
                  <span className="font-semibold">{bookings.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Invoices</span>
                  <span className="font-semibold">{invoices.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Revenue (paid)</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Client since</span>
                  <span className="font-semibold">{formatDate(client.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Generate Contract — pre-filled from most recent booking */}
            <FillContractButton
              clientId={client.id}
              clientName={`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()}
              clientEmail={client.email ?? ""}
              clientPhone={client.phone ?? ""}
              eventDate={latestBooking?.event_date ?? ""}
              startTime={latestBooking?.event_start_time ?? ""}
              endTime={latestBooking?.event_end_time ?? ""}
              venueName={latestBooking?.venue_name ?? ""}
              venueSuburb={latestBooking?.venue_address ?? ""}
              eventType={latestBooking?.service_type ?? ""}
              totalFee={latestBooking?.quoted_total ?? undefined}
              depositAmount={latestBooking?.deposit_amount ?? undefined}
              packageName={latestBooking?.packages?.name ?? ""}
            />

            {/* Delete client */}
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-3">Danger zone — this cannot be undone.</p>
              <DeleteClientButton
                clientId={client.id}
                clientName={`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()}
                variant="button"
              />
            </div>
          </div>

          {/* ── Right column: bookings + invoices ────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Bookings */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-brand-pale-blue">
                <h3 className="font-semibold text-brand-navy flex items-center gap-2">
                  <CalendarDays size={16} className="text-brand-teal" /> Bookings
                </h3>
                <Link href={`/bookings/new?client_id=${client.id}`} className="btn-primary py-1 text-xs">
                  <Plus size={13} /> New Booking
                </Link>
              </div>
              {bookings.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">No bookings yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Date</th>
                      <th className="table-header">Service</th>
                      <th className="table-header hidden sm:table-cell">Venue</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Quoted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: any) => (
                      <tr key={b.id} className="table-row">
                        <td className="table-cell">
                          <Link href={`/bookings/${b.id}`} className="font-medium hover:text-brand-teal">
                            {formatDate(b.event_date)}
                          </Link>
                        </td>
                        <td className="table-cell text-sm text-gray-600">
                          {formatServiceType(b.service_type)}
                          {b.packages?.name && (
                            <span className="block text-xs text-gray-400">{b.packages.name}</span>
                          )}
                        </td>
                        <td className="table-cell hidden sm:table-cell text-xs text-gray-500">
                          {b.venue_name ?? "—"}
                        </td>
                        <td className="table-cell">
                          <span className={getBookingStatusBadge(b.status).class}>
                            {getBookingStatusBadge(b.status).label}
                          </span>
                        </td>
                        <td className="table-cell text-right font-semibold text-sm">
                          {formatCurrency(b.quoted_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Invoices */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-brand-pale-blue">
                <h3 className="font-semibold text-brand-navy flex items-center gap-2">
                  <FileText size={16} className="text-brand-teal" /> Invoices
                </h3>
                {bookings.length > 0 && (
                  <Link href={`/invoices/new?client_id=${client.id}`} className="btn-secondary py-1 text-xs">
                    <Plus size={13} /> New Invoice
                  </Link>
                )}
              </div>
              {invoices.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">No invoices yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Invoice #</th>
                      <th className="table-header">Issue Date</th>
                      <th className="table-header">Due Date</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Total</th>
                      <th className="table-header text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell">
                          <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-brand-teal">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="table-cell text-sm">{formatDate(inv.issue_date)}</td>
                        <td className="table-cell text-sm">{formatDate(inv.due_date)}</td>
                        <td className="table-cell">
                          <span className={getInvoiceStatusBadge(inv.status).class}>
                            {getInvoiceStatusBadge(inv.status).label}
                          </span>
                        </td>
                        <td className="table-cell text-right font-semibold text-sm">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="table-cell text-right text-sm text-green-600 font-medium">
                          {formatCurrency(inv.amount_paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
