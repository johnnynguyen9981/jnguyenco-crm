// POST /api/google/gmail/send
// Sends a pre-templated or custom email.
// Supports two sending accounts:
//   from_account: "gmail"   → Google Gmail API  (johnny.nguyen9981@gmail.com)
//   from_account: "godaddy" → GoDaddy SMTP      (johnny.nguyen@jnguyen.co)
// Defaults to "godaddy" when not specified.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendEmail,
  bookingConfirmationHtml,
  invoiceSentHtml,
  paymentReminderHtml,
  preEventChecklistHtml,
  galleryDeliveryHtml,
  reviewRequestHtml,
  contractSigningRequestHtml,
} from "@/lib/google/gmail";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { apiSuccess, apiError } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

type EmailTemplate   = "booking_confirmation" | "invoice_sent" | "payment_reminder" | "pre_event_checklist" | "gallery_delivery" | "review_request" | "contract_signing_request" | "custom";
type FromAccount     = "gmail" | "godaddy";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { template, to, subject, from_account = "gmail" } = body as {
    template:      EmailTemplate;
    to:            string;
    subject?:      string;
    from_account?: FromAccount;
  };

  if (!template) return apiError("template is required");
  if (!to)       return apiError("to (recipient email) is required");

  try {
    let emailHtml    = "";
    let emailSubject = subject ?? "";
    let pdfAttachment: { filename: string; data: string } | undefined;

    switch (template) {
      // ── Booking confirmation ────────────────────────────────────────────
      case "booking_confirmation": {
        const { booking_id } = body;
        if (!booking_id) return apiError("booking_id required for booking_confirmation");

        const { data: booking } = await supabase
          .from("bookings")
          .select(`*, clients(first_name, last_name), packages(name)`)
          .eq("id", booking_id)
          .eq("owner_id", user.id)
          .single();

        if (!booking) return apiError("Booking not found", 404);

        emailHtml = bookingConfirmationHtml({
          clientName:   `${booking.clients.first_name} ${booking.clients.last_name}`,
          eventDate:    formatDate(booking.event_date),
          serviceType:  booking.service_type,
          venueName:    booking.venue_name,
          packageName:  booking.packages?.name,
          quotedTotal:  booking.quoted_total,
          bookingUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.id}`,
        });
        emailSubject = emailSubject || `Booking Confirmed — ${formatDate(booking.event_date)} — JNguyen Co.`;
        break;
      }

      // ── Invoice sent (with PDF attachment) ─────────────────────────────
      case "invoice_sent": {
        const { invoice_id, pdf_base64 } = body;
        if (!invoice_id) return apiError("invoice_id required for invoice_sent");
        if (!pdf_base64) return apiError("pdf_base64 required for invoice_sent");

        const { data: invoice } = await supabase
          .from("invoices")
          .select(`*, clients(first_name, last_name)`)
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .single();

        if (!invoice) return apiError("Invoice not found", 404);

        emailHtml = invoiceSentHtml({
          clientName:    `${invoice.clients.first_name} ${invoice.clients.last_name}`,
          invoiceNumber: invoice.invoice_number,
          totalAmount:   invoice.total_amount,
          dueDate:       formatDate(invoice.due_date),
          invoiceUrl:    `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}`,
        });
        emailSubject  = emailSubject || `Invoice ${invoice.invoice_number} — JNguyen Co.`;
        pdfAttachment = { filename: `${invoice.invoice_number}.pdf`, data: pdf_base64 };

        // Mark invoice as sent
        await supabase
          .from("invoices")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", invoice_id);
        break;
      }

      // ── Payment reminder ────────────────────────────────────────────────
      case "payment_reminder": {
        const { invoice_id } = body;
        if (!invoice_id) return apiError("invoice_id required for payment_reminder");

        const { data: invoice } = await supabase
          .from("invoices")
          .select(`*, clients(first_name, last_name)`)
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .single();

        if (!invoice) return apiError("Invoice not found", 404);

        const daysOverdue = Math.max(
          0,
          Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
        );
        emailHtml = paymentReminderHtml({
          clientName:    `${invoice.clients.first_name} ${invoice.clients.last_name}`,
          invoiceNumber: invoice.invoice_number,
          amountDue:     invoice.total_amount - invoice.amount_paid,
          dueDate:       formatDate(invoice.due_date),
          daysOverdue,
        });
        emailSubject = emailSubject || `Payment Reminder — ${invoice.invoice_number} — JNguyen Co.`;
        break;
      }

      // ── Pre-event checklist ────────────────────────────────────────────
      case "pre_event_checklist": {
        const { booking_id } = body;
        if (!booking_id) return apiError("booking_id required for pre_event_checklist");

        const { data: booking } = await supabase
          .from("bookings")
          .select(`*, clients(first_name, last_name)`)
          .eq("id", booking_id)
          .eq("owner_id", user.id)
          .single();

        if (!booking) return apiError("Booking not found", 404);

        emailHtml = preEventChecklistHtml({
          clientName:  `${booking.clients.first_name} ${booking.clients.last_name}`,
          eventDate:   formatDate(booking.event_date),
          bookingUrl:  `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.id}`,
        });
        emailSubject = emailSubject || `Getting Ready for Your Event — JNguyen Co.`;
        break;
      }

      // ── Gallery delivery ───────────────────────────────────────────────
      case "gallery_delivery": {
        const { booking_id, drive_url } = body;
        if (!booking_id) return apiError("booking_id required for gallery_delivery");
        if (!drive_url)  return apiError("drive_url required for gallery_delivery");

        const { data: booking } = await supabase
          .from("bookings")
          .select(`*, clients(first_name, last_name), packages(name)`)
          .eq("id", booking_id)
          .eq("owner_id", user.id)
          .single();

        if (!booking) return apiError("Booking not found", 404);

        emailHtml = galleryDeliveryHtml({
          clientName:   `${booking.clients.first_name} ${booking.clients.last_name}`,
          eventDate:    formatDate(booking.event_date),
          driveUrl:     drive_url,
          packageName:  booking.packages?.name,
        });
        emailSubject = emailSubject || `Your Gallery is Ready — JNguyen Co. 🎉`;
        break;
      }

      // ── Review request ─────────────────────────────────────────────────
      case "review_request": {
        const { booking_id } = body;
        if (!booking_id) return apiError("booking_id required for review_request");

        const { data: booking } = await supabase
          .from("bookings")
          .select(`*, clients(first_name, last_name)`)
          .eq("id", booking_id)
          .eq("owner_id", user.id)
          .single();

        if (!booking) return apiError("Booking not found", 404);

        const reviewUrl = body.review_url ?? "https://g.page/r/CZdsm6gVm2xqEAE/review";

        emailHtml = reviewRequestHtml({
          clientName: `${booking.clients.first_name} ${booking.clients.last_name}`,
          reviewUrl,
        });
        emailSubject = emailSubject || `A Small Favour — JNguyen Co.`;
        break;
      }

      // ── Contract signing request ────────────────────────────────────────
      case "contract_signing_request": {
        const { booking_id, signing_url } = body;
        if (!booking_id)  return apiError("booking_id required for contract_signing_request");
        if (!signing_url) return apiError("signing_url required for contract_signing_request");

        const { data: booking } = await supabase
          .from("bookings")
          .select(`*, clients(first_name, last_name), packages(name), contract_sign_expires_at`)
          .eq("id", booking_id)
          .eq("owner_id", user.id)
          .single();

        if (!booking) return apiError("Booking not found", 404);

        const expiresDate = booking.contract_sign_expires_at
          ? new Date(booking.contract_sign_expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
          : "30 days";

        emailHtml = contractSigningRequestHtml({
          clientName:  `${booking.clients.first_name} ${booking.clients.last_name}`,
          eventDate:   formatDate(booking.event_date),
          packageName: booking.packages?.name ?? "Photography & Videography Package",
          signingUrl:  signing_url,
          expiresDate,
        });
        emailSubject = emailSubject || `Please Sign Your Contract — JNguyen Co.`;
        break;
      }

      // ── Custom HTML email ───────────────────────────────────────────────
      case "custom": {
        const { html } = body;
        if (!html)    return apiError("html is required for custom template");
        if (!subject) return apiError("subject is required for custom template");
        emailHtml    = html;
        emailSubject = subject;
        break;
      }

      default:
        return apiError(`Unknown template: ${template}`);
    }

    // ── Route to the correct sending 