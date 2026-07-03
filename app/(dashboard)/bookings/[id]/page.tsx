// app/(dashboard)/bookings/[id]/page.tsx
// Booking detail page — server-rendered with client-side action buttons.
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember } from "@/lib/team";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getBookingStatusBadge,
  getPaymentStatusBadge,
  formatServiceType,
} from "@/lib/utils";
import { BookingActions, StatusUpdateForm, QuickPaymentForm, DeleteBookingButton, GenerateDepositInvoiceButton, EditPaymentModal } from "./BookingActions";
import { FillContractButton } from "@/app/(dashboard)/clients/[id]/FillContractButton";
import { ContractCard } from "./ContractCard";

type Props = { params: { id: string } };

const DELIVERABLE_LABELS: Record<string, string> = {
  PHOTO_GALLERY: "Photo Gallery",
  HIGHLIGHT_FILM: "Highlight Film",
  TEASER: "Teaser / Reel",
  RAW_FOOTAGE: "Raw Footage",
};

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "badge-gray",
  CULLING:     "badge-yellow",
  EDITING:     "badge-yellow",
  READY:       "badge-blue",
  DELIVERED:   "badge-green",
  CLIENT_APPROVED: "badge-green",
};

export default async function BookingDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [ownerUserId, teamMember] = await Promise.all([
    getOwnerUserId(),
    getCurrentTeamMember(),
  ]);
  const showFinancials = !teamMember || teamMember.role === "FOUNDER";

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      clients (*),
      packages (*),
      payments (*, id, payment_type, amount, due_date, paid_date, status, method, notes),
      deliverables (*),
      invoices (id, invoice_number, status, total_amount, due_date, created_at)
    `)
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !booking) notFound();

  const client = booking.clients as any;
  const pkg = booking.packages as any;
  const payments = (booking.payments as any[]) || [];
  const deliverables = (booking.deliverables as any[]) || [];
  const invoices = (booking.invoices as any[]) || [];

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const depositAmount = payments
    .filter((p) => p.payment_type === "DEPOSIT")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const depositPaid = payments
    .filter((p) => p.payment_type === "DEPOSIT" && p.status === "PAID")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balanceDue = (booking.quoted_total || 0) - totalPaid;

  const statusBadge = getBookingStatusBadge(booking.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bookings" className="text-gray-400 hover:text-gray-600 text-sm">← Bookings</Link>
          <span className="text-gray-300">/</span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-brand-navy">
                {client ? `${client.first_name} ${client.last_name}` : "Booking"}
              </h1>
              <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatServiceType(booking.service_type)} · {formatDate(booking.event_date)}
            </p>
          </div>
        </div>

        {/* Action buttons — founder only */}
        {showFinancials && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link href={`/bookings/${booking.id}/edit`} className="btn-secondary text-sm py-1.5">Edit</Link>
            <BookingActions booking={booking} client={client} />
            <DeleteBookingButton bookingId={booking.id} clientId={booking.client_id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: booking info + client ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Booking Details */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Booking Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-400">Service</dt>
                <dd className="font-medium mt-0.5">{formatServiceType(booking.service_type)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Status</dt>
                <dd className="mt-0.5">
                  <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Event Date</dt>
                <dd className="font-medium mt-0.5">{formatDate(booking.event_date)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Time</dt>
                <dd className="font-medium mt-0.5">
                  {booking.event_start_time
                    ? `${booking.event_start_time} – ${booking.event_end_time || "TBC"}`
                    : "TBC"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Package</dt>
                <dd className="font-medium mt-0.5">{pkg?.name ?? "Custom"}</dd>
              </div>
              {showFinancials && (
                <div>
                  <dt className="text-gray-400">Quoted Total</dt>
                  <dd className="font-medium mt-0.5">
                    {booking.quoted_total ? formatCurrency(booking.quoted_total) : "TBD"}
                  </dd>
                </div>
              )}
              {showFinancials && depositAmount > 0 && (
                <div>
                  <dt className="text-gray-400">Deposit</dt>
                  <dd className={`font-medium mt-0.5 ${depositPaid >= depositAmount ? "text-green-600" : ""}`}>
                    {formatCurrency(depositAmount)}
                    {depositPaid >= depositAmount ? " ✓" : " (unpaid)"}
                  </dd>
                </div>
              )}
              {showFinancials && booking.quoted_total > 0 && (
                <div>
                  <dt className="text-gray-400">Remaining</dt>
                  <dd className={`font-medium mt-0.5 ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(balanceDue)}
                  </dd>
                </div>
              )}
              {booking.hours_booked && (
                <div>
                  <dt className="text-gray-400">Hours Booked</dt>
                  <dd className="font-medium mt-0.5">{booking.hours_booked}h</dd>
                </div>
              )}
              {booking.gcal_event_id && (
                <div>
                  <dt className="text-gray-400">Google Calendar</dt>
                  <dd className="mt-0.5">
                    {booking.gcal_html_link ? (
                      <a href={booking.gcal_html_link} target="_blank" rel="noopener noreferrer"
                        className="text-brand-teal hover:underline text-xs">
                        View event ↗
                      </a>
                    ) : (
                      <span className="text-xs text-green-600">✓ Synced</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            <StatusUpdateForm bookingId={booking.id} currentStatus={booking.status} />
          </div>

          {/* Shot list */}
          {(booking.shot_list || booking.special_requests) && (
            <div className="card space-y-4">
              <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Planning</h2>
              {booking.shot_list && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Shot List</p>
                  <p className="text-sm whitespace-pre-wrap">{booking.shot_list}</p>
                </div>
              )}
              {booking.special_requests && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Special Requests</p>
                  <p className="text-sm whitespace-pre-wrap">{booking.special_requests}</p>
                </div>
              )}
              {booking.internal_notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Internal Notes</p>
                  <p className="text-sm whitespace-pre-wrap text-gray-600">{booking.internal_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Deliverables</h2>
              {deliverables.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{DELIVERABLE_LABELS[d.type] ?? d.type}</p>
                    {d.delivery_url && (
                      <a href={d.delivery_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-teal hover:underline">
                        {d.delivery_platform ?? "View link"} ↗
                      </a>
                    )}
                    {d.due_date && (
                      <p className="text-xs text-gray-400">Due {formatDate(d.due_date)}</p>
                    )}
                  </div>
                  <span className={`badge ${DELIVERABLE_STATUS_COLORS[d.status] ?? "badge-gray"} text-xs`}>
                    {d.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Invoices — founder only */}
          {showFinancials && invoices.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Invoices</h2>
                <Link href={`/invoices/new?booking_id=${booking.id}&client_id=${booking.client_id}`}
                  className="text-xs text-brand-teal hover:underline">
                  + New Invoice
                </Link>
              </div>
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between text-sm py-1.5">
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-navy hover:underline">
                    {inv.invoice_number}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{formatCurrency(inv.total_amount)}</span>
                    <span className={`badge badge-${inv.status === "PAID" ? "green" : inv.status === "OVERDUE" ? "red" : "gray"} text-xs`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: client + payments ── */}
        <div className="space-y-6">
          {/* Client card */}
          {client && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Client</h2>
                <Link href={`/clients/${client.id}`} className="text-xs text-brand-teal hover:underline">
                  View profile →
                </Link>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{client.first_name} {client.last_name}</p>
                <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-500 hover:text-brand-navy">
                  <span>✉</span> {client.email}
                </a>
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-gray-500 hover:text-brand-navy">
                    <span>📞</span> {client.phone}
                  </a>
                )}
                {client.instagram_handle && (
                  <p className="text-gray-500">@ {client.instagram_handle}</p>
                )}
              </div>
            </div>
          )}

          {/* Payment milestones — founder only */}
          {showFinancials && <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Payments</h2>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Quoted total</span>
                <span className="font-medium">{booking.quoted_total ? formatCurrency(booking.quoted_total) : "TBD"}</span>
              </div>
              {depositAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Deposit
                    {depositPaid >= depositAmount && (
                      <span className="ml-1.5 text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">PAID</span>
                    )}
                  </span>
                  <span className={`font-medium ${depositPaid >= depositAmount ? "text-green-600" : "text-gray-700"}`}>
                    {formatCurrency(depositAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Total paid</span>
                <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-0.5">
                <span className="font-semibold">Remaining</span>
                <span className={`font-semibold ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            {/* Payment rows */}
            {payments.length === 0 ? (
              <p className="text-xs text-gray-400">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => {
                  const badge = getPaymentStatusBadge(p.status);
                  return (
                    <div key={p.id} className="flex items-start justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium capitalize">{p.payment_type.replace(/_/g, " ").toLowerCase()}</p>
                          <EditPaymentModal payment={p} />
                        </div>
                        <p className="text-xs text-gray-400">
                          {p.paid_date ? `Paid ${formatDate(p.paid_date)}` : p.due_date ? `Due ${formatDate(p.due_date)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(p.amount)}</p>
                        <span className={`badge ${badge.class} text-xs`}>{badge.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick add payment */}
            <details className="group">
              <summary className="text-xs text-brand-teal cursor-pointer hover:underline">+ Record payment</summary>
              <QuickPaymentForm bookingId={booking.id} />
            </details>

            {/* Deposit invoice shortcut */}
            {client && (() => {
              const qt = booking.quoted_total ?? 0;
              const depAmt = depositAmount > 0 ? depositAmount : (qt > 0 ? Math.round(qt * 0.5) : 0);
              return depAmt > 0 ? (
                <GenerateDepositInvoiceButton
                  bookingId={booking.id}
                  clientId={client.id}
                  depositAmount={depAmt}
                  eventDate={booking.event_date}
                  serviceType={booking.service_type}
                />
              ) : null;
            })()}

          </div>}

          {/* Contract + Generate Contract — founder only */}
          {showFinancials && <>
            <ContractCard
              bookingId={booking.id}
              contractSentAt={booking.contract_sent_at ?? null}
              contractSignedAt={booking.contract_signed_at ?? null}
              contractSignedUrl={(booking as any).contract_signed_url ?? null}
              contractSignToken={(booking as any).contract_sign_token ?? null}
              clientEmail={client?.email ?? null}
              driveFolderUrl={client?.gdrive_folder_id ? `https://drive.google.com/drive/folders/${client.gdrive_folder_id}` : null}
            />

            {client && (() => {
              const qt = booking.quoted_total ?? 0;
              const contractDeposit   = depositAmount != null ? depositAmount : undefined;
              const contractRemaining = qt > 0 && contractDeposit != null ? qt - contractDeposit : undefined;
              return (
                <div className="card space-y-2">
                  <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Generate Contract</h2>
                  <p className="text-xs text-gray-400">Generate the PDF contract to send to your client.</p>
                  <FillContractButton
                    clientId={client.id}
                    clientName={`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()}
                    clientEmail={client.email ?? ""}
                    clientPhone={client.phone ?? ""}
                    eventDate={booking.event_date ?? ""}
                    startTime={booking.event_start_time?.slice(0, 5) ?? ""}
                    endTime={booking.event_end_time?.slice(0, 5) ?? ""}
                    venueName={booking.venue_name ?? ""}
                    venueSuburb={booking.venue_address ?? ""}
                    eventType={
                      booking.service_type === "WEDDING"  ? "Wedding" :
                      booking.service_type === "EVENT"    ? "Event" :
                      booking.service_type === "PORTRAIT" ? "Portrait Session" :
                      booking.service_type ?? ""
                    }
                    totalFee={qt > 0 ? qt : undefined}
                    depositAmount={contractDeposit}
                    remainingBalance={contractRemaining}
                  />
                </div>
              );
            })()}
          </>}
        </div>
      </div>
    </div>
  );
}
