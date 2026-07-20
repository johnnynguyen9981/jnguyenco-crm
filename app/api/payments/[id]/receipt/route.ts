// GET  /api/payments/[id]/receipt — download receipt PDF
// POST /api/payments/[id]/receipt — generate PDF + email to client
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptTemplate } from "@/lib/pdf/ReceiptTemplate";
import type { ReceiptData } from "@/lib/pdf/ReceiptTemplate";
import { createElement } from "react";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { apiError, getAppUrl } from "@/lib/utils";

type Params = { params: { id: string } };

type ReceiptPayload = {
      receiptData: ReceiptData;
      clientEmail: string | null;
      clientName: string;
      clientFolderId: string | null;
      clientId: string;
};

// Plain (non-discriminated-union) result shape. This project's tsconfig has
// "strict": false, which disables strictNullChecks -- and without
// strictNullChecks, TypeScript's control-flow narrowing on discriminated
// unions (the `if (!result.ok) return ...` pattern) does NOT reliably narrow
// and fails to compile. So instead of a tagged union, this uses a flat object
// with a nullable `data` field and a separate nullable `errorReason` field --
// no narrowing required, just plain null checks.
type BuildOutcome = {
      data: ReceiptPayload | null;
      errorReason: "NOT_FOUND" | "NOT_PAID" | "QUERY_ERROR" | null;
      errorDetail?: string;
};

// ── Shared: build receipt data from payment id ──────────────────────────────
// NOTE: deliberately flat, single-table queries chained together instead of
// nested embeds (e.g. payments->bookings->packages). Multi-level PostgREST
// embeds in this project have repeatedly proven unreliable (ambiguous/failed
// relationship resolution), so every step below fetches one table at a time.
async function buildReceiptData(paymentId: string, supabase: any): Promise<BuildOutcome> {
      // Step 1: fetch the payment row itself — no joins.
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

  // Step 2: fetch the booking separately using payment.booking_id.
  const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, client_id, event_date, service_type, quoted_total, package_id")
        .eq("id", payment.booking_id)
        .maybeSingle();

  if (bookingErr) {
          console.error("[receipt] bookings query failed:", bookingErr.message);
  }

  // Step 3: fetch the package name separately using booking.package_id (if any).
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

  // Step 4: fetch the client separately using booking.client_id.
  const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, gdrive_folder_id")
        .eq("id", booking?.client_id)
        .maybeSingle();

  if (clientErr) console.error("[receipt] clients query failed:", clientErr.message);

  // Generate receipt number: REC-YYYYMM-{last6 of payment id}
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
          // Booking
          eventType:       booking?.service_type  ?? "Event",
          eventDate:       booking?.event_date,
          packageName:     packageName,
          totalQuoted:     booking?.quoted_total,
          // Client
          clientFirstName: client?.first_name ?? "",
          clientLastName:  client?.last_name  ?? "",
          clientEmail:     client?.email,
          // Computed
          isBalancePayment: payment.payment_type === "BALANCE",
          abn: process.env.NEXT_PUBLIC_BUSINESS_ABN ?? "",
  };

  const clientName     = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
      const clientEmail    = client?.email ?? null;
      const clientFolderId = client?.gdrive_folder_id ?? null;
      const clientId       = client?.id ?? null;

  return {
          data: { receiptData, clientEmail, clientName, clientFolderId, clientId },
          errorReason: null,
  };
}

function receiptErrorResponse(
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
      return NextResponse.json({ error: message }, { status: errorReason === "QUERY_ERROR" ? 500 : 404 });
}

// ── GET — return PDF as download ────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
      const supabase = await createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify payment belongs to owner
  const { data: ownerCheck } = await supabase
        .from("payments").select("id").eq("id", params.id).eq("owner_id", user.id).maybeSingle();
      if (!ownerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outcome = await buildReceiptData(params.id, supabase);
      if (!outcome.data) return receiptErrorResponse(outcome.errorReason, outcome.errorDetail);

  const { receiptData, clientFolderId, clientName, clientId } = outcome.data;

  try {
          const pdfBuffer = await renderToBuffer(
                    createElement(ReceiptTemplate, { data: receiptData }) as any
                  );

        // Upload to Drive if configured
        if (isDriveConfigured() && clientId) {
                  try {
                              const folderId = clientFolderId
                                ? clientFolderId
                                            : await getOrCreateClientFolder(clientId, clientName);
                              await uploadToDriveFolder(
                                            folderId, "Receipts",
                                            `${receiptData.receiptNumber}.pdf`,
                                            pdfBuffer as Buffer
                                          );
                  } catch (e: any) {
                              console.warn("[drive] Receipt upload failed:", e?.message);
                  }
        }

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
                  status: 200,
                  headers: {
                              "Content-Type":        "application/pdf",
                              "Content-Disposition": `attachment; filename="${receiptData.receiptNumber}.pdf"`,
                              "Content-Length":      String(pdfBuffer.length),
                              "Cache-Control":       "no-store",
                  },
        });
  } catch (err: any) {
          console.error("[receipt/GET] renderToBuffer error:", err);
          return NextResponse.json({ error: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}

// ── POST — generate PDF + email to client ──────────────────────────────────
export async function POST(_req: NextRequest, { params }: Params) {
      const supabase = await createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return apiError("Unauthorized", 401);

  const { data: ownerCheck } = await supabase
        .from("payments").select("id").eq("id", params.id).eq("owner_id", user.id).maybeSingle();
      if (!ownerCheck) return apiError("Not found", 404);

  const outcome = await buildReceiptData(params.id, supabase);
      if (!outcome.data) return receiptErrorResponse(outcome.errorReason, outcome.errorDetail);

  const { receiptData, clientEmail, clientName, clientFolderId, clientId } = outcome.data;

  if (!clientEmail) return apiError("Client has no email address", 422);

  try {
          const pdfBuffer = await renderToBuffer(
                    createElement(ReceiptTemplate, { data: receiptData }) as any
                  );

        // Upload to Drive if configured
        if (isDriveConfigured() && clientId) {
                  try {
                              const folderId = clientFolderId
                                ? clientFolderId
                                            : await getOrCreateClientFolder(clientId, clientName);
                              await uploadToDriveFolder(
                                            folderId, "Receipts",
                                            `${receiptData.receiptNumber}.pdf`,
                                            pdfBuffer as Buffer
                                          );
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

        return NextResponse.json({ ok: true, receiptNumber: receiptData.receiptNumber });
  } catch (err: any) {
          console.error("[receipt/POST] error:", err);
          return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
