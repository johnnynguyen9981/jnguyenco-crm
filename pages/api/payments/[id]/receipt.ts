// GET  /api/payments/[id]/receipt — download receipt PDF
// POST /api/payments/[id]/receipt — generate PDF + email to client
//
// This is a Pages Router API route, not an App Router route handler, even
// though every other API route in this project lives under app/api/. That's
// deliberate — see pages/api/bookings/[id]/contractors/[assignmentId]/
// call-sheet.ts for the full explanation: any file under app/** that builds
// a react-pdf element tree gets compiled through Next's app-router
// "react-server" webpack condition, which resolves `react` to a
// Server-Components-only build missing the reconciler internals
// @react-pdf/renderer needs (it resolves `react` the normal Node.js way).
// Two different `react` module instances in the same process means every
// element ReceiptTemplate builds gets rejected by react-pdf's own
// reconciler as "not a valid React child" (Minified React error #31) —
// this is exactly the crash that was showing up, verbatim, in the Payments
// card UI (SendReceiptButton just forwards whatever error message the API
// returns). Pages Router API routes never enter that module graph, so
// `react` resolves once, consistently, for both sides.
//
// Everything below is otherwise unchanged from the old app/api route: same
// buildReceiptData query steps, same Drive upload, same receipt email HTML.
// Only the transport changed — NextRequest/NextResponse + async params to
// NextApiRequest/NextApiResponse + req.query, and createPagesClient
// (req/res cookies) instead of the App Router-only createClient()
// (next/headers cookies()).
import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesClient } from "@/lib/supabase/pages-server";
import { renderToBuffer } from "@/lib/pdf/renderQueue";
import { ReceiptTemplate } from "@/lib/pdf/ReceiptTemplate";
import type { ReceiptData } from "@/lib/pdf/ReceiptTemplate";
import { createElement } from "react";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { getAppUrl } from "@/lib/utils";

type ReceiptPayload = {
  receiptData: ReceiptData;
  clientEmail: string | null;
  clientName: string;
  clientFolderId: string | null;
  clientId: string;
  eventDate: string | null;
};

// Plain (non-discriminated-union) result shape — see the original app/api
// route's history for why (this project's tsconfig disables
// strictNullChecks, which breaks control-flow narrowing on tagged unions).
type BuildOutcome = {
  data: ReceiptPayload | null;
  errorReason: "NOT_FOUND" | "NOT_PAID" | "QUERY_ERROR" | null;
  errorDetail?: string;
};

// ── Shared: build receipt data from payment id ──────────────────────────────
// Deliberately flat, single-table queries chained together instead of nested
// embeds (e.g. payments->bookings->packages) — multi-level PostgREST embeds
// in this project have repeatedly proven unreliable.
async function buildReceiptData(paymentId: string, supabase: any): Promise<BuildOutcome> {
  const { data: payment, error: paymentErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentErr) {
    console.error("[receipt] payments query failed:", paymentErr.message);
    return { data: null, errorReason: "QUERY_ERROR", errorDetail: paymentErr.message };
  }
  if (!payment) {
    return { data: null, errorReason: "NOT_FOUND" };
  }
  if (payment.status !== "PAID") {
    return { data: null, errorReason: "NOT_PAID", errorDetail: `status=${payment.status}` };
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, client_id, event_date, service_type, quoted_total, package_id")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (bookingErr) {
    console.error("[receipt] bookings query failed:", bookingErr.message);
  }

  let packageName: string | undefined;
  if (booking?.package_id) {
    const { data: pkg, error: pkgErr } = await supabase
      .from("packages")
      .select("name")
      .eq("id", booking.package_id)
      .maybeSingle();
    if (pkgErr) console.error("[receipt] packages query failed:", pkgErr.message);
    packageName = pkg?.name;
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, gdrive_folder_id")
    .eq("id", booking?.client_id)
    .maybeSingle();

  if (clientErr) console.error("[receipt] clients query failed:", clientErr.message);

  const now     = new Date();
  const yyyymm  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const shortId = paymentId.replace(/-/g, "").slice(-6).toUpperCase();
  const receiptNumber = `REC-${yyyymm}-${shortId}`;

  const receiptData: ReceiptData = {
    receiptNumber,
    issuedDate:      now.toISOString(),
    paymentType:     payment.payment_type,
    amount:          payment.amount,
    paidDate:        payment.paid_date ?? now.toISOString(),
    method:          payment.method ?? "Bank Transfer",
    reference:       payment.reference,
    notes:           payment.notes,
    eventType:       booking?.service_type  ?? "Event",
    eventDate:       booking?.event_date,
    packageName:     packageName,
    totalQuoted:     booking?.quoted_total,
    clientFirstName: client?.first_name ?? "",
    clientLastName:  client?.last_name  ?? "",
    clientEmail:     client?.email,
    isBalancePayment: payment.payment_type === "BALANCE",
    abn: process.env.NEXT_PUBLIC_BUSINESS_ABN ?? "",
  };

  const clientName     = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
  const clientEmail    = client?.email ?? null;
  const clientFolderId = client?.gdrive_folder_id ?? null;
  const clientId       = client?.id ?? null;
  const eventDate      = booking?.event_date ?? null;

  return {
    data: { receiptData, clientEmail, clientName, clientFolderId, clientId, eventDate },
    errorReason: null,
  };
}

function sendReceiptError(
  res: NextApiResponse,
  errorReason: "NOT_FOUND" | "NOT_PAID" | "QUERY_ERROR" | null,
  errorDetail?: string
) {
  console.error("[receipt] buildReceiptData failed:", errorReason, errorDetail ?? "");
  const message =
    errorReason === "NOT_PAID"
      ? "This payment has not been marked as PAID yet."
      : errorReason === "QUERY_ERROR"
        ? "Could not look up this payment (database error). Check server logs."
        : "Payment not found.";
  return res.status(errorReason === "QUERY_ERROR" ? 500 : 404).json({ error: message });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const paymentId = String(req.query.id);
  const supabase = createPagesClient(req, res);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  // Verify payment belongs to owner
  const { data: ownerCheck } = await supabase
    .from("payments").select("id").eq("id", paymentId).eq("owner_id", user.id).maybeSingle();
  if (!ownerCheck) return res.status(404).json({ error: "Not found" });

  const outcome = await buildReceiptData(paymentId, supabase);
  if (!outcome.data) return sendReceiptError(res, outcome.errorReason, outcome.errorDetail);

  if (req.method === "GET") {
    const { receiptData, clientFolderId, clientName, clientId, eventDate } = outcome.data;
    try {
      const pdfBuffer = await renderToBuffer(
        createElement(ReceiptTemplate, { data: receiptData }) as any
      );

      if (isDriveConfigured() && clientId) {
        try {
          const folderId = clientFolderId
            ? clientFolderId
            : await getOrCreateClientFolder(clientId, clientName, eventDate);
          await uploadToDriveFolder(folderId, "Receipts", `${receiptData.receiptNumber}.pdf`, pdfBuffer as Buffer);
        } catch (e: any) {
          console.warn("[drive] Receipt upload failed:", e?.message);
        }
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${receiptData.receiptNumber}.pdf"`);
      res.setHeader("Content-Length", String((pdfBuffer as Buffer).length));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(pdfBuffer);
    } catch (err: any) {
      console.error("[receipt/GET] renderToBuffer error:", err);
      return res.status(500).json({ error: `PDF generation failed: ${err.message}` });
    }
  }

  if (req.method === "POST") {
    const { receiptData, clientEmail, clientName, clientFolderId, clientId, eventDate } = outcome.data;
    if (!clientEmail) return res.status(422).json({ error: "Client has no email address" });

    try {
      const pdfBuffer = await renderToBuffer(
        createElement(ReceiptTemplate, { data: receiptData }) as any
      );

      if (isDriveConfigured() && clientId) {
        try {
          const folderId = clientFolderId
            ? clientFolderId
            : await getOrCreateClientFolder(clientId, clientName, eventDate);
          await uploadToDriveFolder(folderId, "Receipts", `${receiptData.receiptNumber}.pdf`, pdfBuffer as Buffer);
        } catch (e: any) {
          console.warn("[drive] Receipt upload failed:", e?.message);
        }
      }

      const paymentLabel = receiptData.isBalancePayment
        ? "Balance Payment — Paid in Full"
        : receiptData.paymentType === "DEPOSIT"
          ? "Deposit Payment"
          : "Payment";

      const appUrl = getAppUrl();
      const logoUrl = `${appUrl}/PNG/LetterHeadNavy.png`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#083a4f;padding:28px 40px;text-align:center;">
          <img src="${logoUrl}" alt="JNguyen Co." height="60" style="display:block;margin:0 auto 8px;">
          <p style="margin:0;color:#c0d5d6;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Payment Receipt</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 4px;font-size:13px;color:#555;">Hi <strong>${clientName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:13px;color:#555;">
            This is your official receipt for your <strong>${paymentLabel}</strong>. Please find the full receipt PDF attached.
          </p>

          <!-- Amount box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#083a4f;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;text-align:center;">
              <p style="margin:0 0 4px;color:#c0d5d6;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Amount Received</p>
              <p style="margin:0;color:#ffffff;font-size:26px;font-weight:bold;">$${receiptData.amount.toFixed(2)}</p>
            </td></tr>
          </table>

          <!-- Details -->
          <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #c0d5d6;border-radius:6px;margin-bottom:24px;font-size:12px;">
            <tr style="background:#f9f8f6;"><td style="color:#555;padding:8px 12px;width:40%;">Receipt Number</td><td style="color:#083a4f;font-weight:bold;padding:8px 12px;">${receiptData.receiptNumber}</td></tr>
            <tr><td style="color:#555;padding:8px 12px;">Payment Type</td><td style="color:#083a4f;font-weight:bold;padding:8px 12px;">${paymentLabel}</td></tr>
            <tr style="background:#f9f8f6;"><td style="color:#555;padding:8px 12px;">Payment Method</td><td style="color:#083a4f;font-weight:bold;padding:8px 12px;">Bank Transfer (EFT)</td></tr>
            <tr><td style="color:#555;padding:8px 12px;">Date Paid</td><td style="color:#083a4f;font-weight:bold;padding:8px 12px;">${new Date(receiptData.paidDate).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</td></tr>
            ${receiptData.eventDate ? `<tr style="background:#f9f8f6;"><td style="color:#555;padding:8px 12px;">Event Date</td><td style="color:#083a4f;font-weight:bold;padding:8px 12px;">${new Date(receiptData.eventDate).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</td></tr>` : ""}
          </table>

          ${receiptData.isBalancePayment ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:14px 18px;text-align:center;color:#15803d;font-size:13px;font-weight:bold;">
              ✅ Your booking is now fully paid. We can't wait to capture your special day!
            </td></tr>
          </table>` : `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:14px 18px;text-align:center;color:#1e40af;font-size:12px;">
              Your deposit has been received and your booking date is now secured. 🎉<br>The balance will be due closer to your event date.
            </td></tr>
          </table>`}

          <p style="margin:0;font-size:12px;color:#555;">
            If you have any questions, feel free to reply to this email or contact us at
            <a href="mailto:johnny.nguyen@jnguyen.co" style="color:#407e8c;">johnny.nguyen@jnguyen.co</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#e5e1dd;padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#888;">JNguyen Co. · Wedding &amp; Event Photography &amp; Videography · Canberra, ACT</p>
          <p style="margin:4px 0 0;font-size:11px;"><a href="https://www.jnguyen.co" style="color:#a58d66;text-decoration:none;">www.jnguyen.co</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await sendEmailViaSMTP({
        to:      clientEmail,
        subject: `Payment Receipt — ${receiptData.receiptNumber} — JNguyen Co.`,
        html,
        text: `Hi ${clientName},\n\nThank you for your payment of $${receiptData.amount.toFixed(2)}.\nReceipt: ${receiptData.receiptNumber}\nDate: ${new Date(receiptData.paidDate).toLocaleDateString("en-AU")}\n\nPlease find your receipt PDF attached.\n\n— JNguyen Co.`,
        pdfAttachment: {
          filename: `${receiptData.receiptNumber}.pdf`,
          data:     Buffer.from(pdfBuffer as any).toString("base64"),
        },
      });

      return res.status(200).json({ ok: true, receiptNumber: receiptData.receiptNumber });
    } catch (err: any) {
      console.error("[receipt/POST] error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
