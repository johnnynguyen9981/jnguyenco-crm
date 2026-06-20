// POST /api/bookings/[id]/quote
// Generates a quote PDF from booking data and emails it to the client.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { generateQuotePDF, PACKAGE_DELIVERABLES, DEFAULT_DELIVERABLES, type QuoteData } from "@/lib/generate-quote";
import { sendEmailViaSMTP } from "@/lib/email/smtp";

type Params = { params: { id: string } };

function fmtDate(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Load booking with client + package
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone),
      packages (id, name, base_price, max_hours, description)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  const client  = booking.clients as any;
  const pkg     = booking.packages as any;
  const body    = await req.json().catch(() => ({}));

  // Pricing
  const quotedTotal    = booking.quoted_total ?? pkg?.base_price ?? 0;
  const depositPct     = body.deposit_percent ?? 30;
  const depositAmount  = booking.deposit_amount ?? Math.round(quotedTotal * depositPct / 100);
  const balanceAmount  = quotedTotal - depositAmount;

  // Deliverables list — use package name to look up, else fall back
  const pkgName    = pkg?.name ?? "";
  const delivList  = PACKAGE_DELIVERABLES[pkgName] ?? DEFAULT_DELIVERABLES;

  // Service type label
  const serviceLabel =
    booking.service_type === "WEDDING"  ? "Wedding / Elopement" :
    booking.service_type === "EVENT"    ? "Event" :
    booking.service_type === "PORTRAIT" ? "Portrait Session" :
    booking.service_type;

  const quoteData: QuoteData = {
    quote_number:         `QT-${params.id.substring(0, 8).toUpperCase()}`,
    quote_date:           new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
    valid_until:          addDays(14),
    client_name:          `${client.first_name} ${client.last_name}`,
    client_email:         client.email,
    client_phone:         client.phone ?? undefined,
    event_type:           serviceLabel,
    event_date:           fmtDate(booking.event_date),
    venue_name:           booking.venue_name ?? undefined,
    venue_address:        booking.venue_address ?? undefined,
    package_name:         pkgName || undefined,
    package_deliverables: delivList,
    add_ons:              body.add_ons ?? [],
    quoted_total:         quotedTotal,
    deposit_percent:      depositPct,
    deposit_amount:       depositAmount,
    balance_amount:       balanceAmount,
  };

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateQuotePDF(quoteData);
  } catch (err: any) {
    console.error("[quote/pdf] Generation error:", err);
    return apiError(`PDF generation failed: ${err.message}`, 500);
  }

  const pdfBase64 = pdfBuffer.toString("base64");

  // If send=true in body, email the quote
  if (body.send !== false) {
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#083a4f;margin:0;padding:0;background:#f8f8f6}
  .container{max-width:580px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #c0d5d6}
  .header{background:#083a4f;padding:32px 40px}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .header p{color:#c0d5d6;margin:4px 0 0;font-size:13px}
  .body{padding:32px 40px}
  .body p{line-height:1.7;font-size:15px;color:#333}
  .highlight{background:#f7f4f1;border-left:3px solid #a58d66;padding:14px 18px;margin:20px 0;border-radius:0 6px 6px 0}
  .highlight p{margin:0;font-size:14px;color:#083a4f}
  .footer{background:#e5e1dd;padding:20px 40px;text-align:center;font-size:12px;color:#666}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>JNguyen Co.</h1>
    <p>Photography &amp; Videography · Canberra</p>
  </div>
  <div class="body">
    <p>Hi ${client.first_name},</p>
    <p>Thank you for your enquiry — I'm so excited at the possibility of capturing your memories!</p>
    <p>Please find your personalised quote attached. It covers everything included in your package, the pricing breakdown, and how to proceed when you're ready to lock in your date.</p>
    <div class="highlight">
      <p><strong>To secure your date:</strong> review the attached quote, then reply to this email to receive the Service Agreement. Sign and return the contract, then pay the deposit — and your date is locked. 🎉</p>
    </div>
    <p>This quote is valid for <strong>14 days</strong>. I have limited bookings available each year to maintain quality, so don't wait too long!</p>
    <p>If you have any questions or would like to adjust anything, just hit reply — I'm happy to chat.</p>
    <p>Looking forward to hearing from you,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
  </div>
  <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co</div>
</div>
</body>
</html>`.trim();

    try {
      await sendEmailViaSMTP({
        to:      client.email,
        subject: `Your Quote — JNguyen Co. · ${serviceLabel}${booking.event_date ? ` · ${fmtDate(booking.event_date)}` : ""}`,
        html:    emailHtml,
        pdfAttachment: {
          filename: `Quote-${quoteData.quote_number}.pdf`,
          data:     pdfBase64,
        },
      });
    } catch (err: any) {
      console.error("[quote/email] Send error:", err);
      // Return PDF anyway — don't fail silently
      return apiSuccess({ pdf_base64: pdfBase64, emailed: false, email_error: err.message });
    }
  }

  // Update booking status to QUOTED if still INQUIRY
  if (booking.status === "INQUIRY") {
    await supabase
      .from("bookings")
      .update({ status: "QUOTED" })
      .eq("id", params.id);
  }

  return apiSuccess({
    pdf_base64:   pdfBase64,
    quote_number: quoteData.quote_number,
    emailed:      body.send !== false,
    sent_to:      client.email,
  });
}
