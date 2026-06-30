// ─────────────────────────────────────────────────────────────────────────────
// Gmail API helpers — send from johnny.nguyen@jnguyen.co
// ─────────────────────────────────────────────────────────────────────────────
import { google } from "googleapis";
import { getAuthenticatedClient } from "./auth";

interface EmailOptions {
  to:       string;
  subject:  string;
  html:     string;
  /** Optional plain-text fallback */
  text?:    string;
  /** Attach a PDF invoice as base64 */
  pdfAttachment?: {
    filename: string;
    data:     string; // base64-encoded PDF bytes
  };
}

/**
 * Send an email from johnny.nguyen@jnguyen.co using the Gmail API.
 * Constructs a proper RFC 2822 MIME message.
 */
export async function sendEmail(
  userId: string,
  opts: EmailOptions
): Promise<{ messageId: string }> {
  const authClient = await getAuthenticatedClient(userId);
  const gmail      = google.gmail({ version: "v1", auth: authClient });

  const fromAddress = process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "johnny.nguyen@jnguyen.co";
  const boundary    = `boundary_${Date.now()}`;

  const hasAttachment = !!opts.pdfAttachment;

  let rawMessage: string;

  if (hasAttachment) {
    rawMessage = [
      `From: JNguyen Co. <${fromAddress}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(opts.html).toString("base64"),
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${opts.pdfAttachment!.filename}"`,
      `Content-Disposition: attachment; filename="${opts.pdfAttachment!.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      opts.pdfAttachment!.data,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    rawMessage = [
      `From: JNguyen Co. <${fromAddress}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(opts.html).toString("base64"),
    ].join("\r\n");
  }

  // Gmail API requires URL-safe base64
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId:      "me",
    requestBody: { raw: encodedMessage },
  });

  return { messageId: res.data.id! };
}

// ── Pre-built email templates ─────────────────────────────────────────────────

/** Booking confirmation email */
export function bookingConfirmationHtml(params: {
  clientName: string;
  eventDate: string;
  serviceType: string;
  venueName?: string;
  packageName?: string;
  quotedTotal?: number;
  bookingUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #083a4f; margin: 0; padding: 0; background: #f8f8f6; }
    .container { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #c0d5d6; }
    .header { background: #083a4f; padding: 24px 40px; }
    .body   { padding: 32px 40px; }
    .body p { line-height: 1.7; font-size: 15px; color: #333; }
    .details { background: #e5e1dd; border-radius: 6px; padding: 20px 24px; margin: 20px 0; }
    .details table { width: 100%; border-collapse: collapse; }
    .details td { padding: 6px 0; font-size: 14px; vertical-align: top; }
    .details td:first-child { font-weight: 600; color: #407e8c; width: 140px; }
    .cta { display: inline-block; background: #a58d66; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin-top: 8px; }
    .footer { background: #e5e1dd; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
    </div>
    <div class="body">
      <p>Hi ${params.clientName},</p>
      <p>Thank you for booking with JNguyen Co.! I'm so excited to be part of your special day. Here's a summary of your booking:</p>
      <div class="details">
        <table>
          <tr><td>Service</td><td>${params.serviceType}</td></tr>
          ${params.packageName  ? `<tr><td>Package</td><td>${params.packageName}</td></tr>` : ""}
          <tr><td>Event Date</td><td>${params.eventDate}</td></tr>
          ${params.venueName    ? `<tr><td>Venue</td><td>${params.venueName}</td></tr>` : ""}
          ${params.quotedTotal  ? `<tr><td>Quoted Total</td><td>$${params.quotedTotal.toLocaleString()}</td></tr>` : ""}
        </table>
      </div>
      <p>To secure your date, please review and sign the contract and pay the deposit as outlined in your quote. If you have any questions, just reply to this email.</p>
      <p>Looking forward to capturing your memories ✨</p>
      <p>Warm regards,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
    </div>
    <div class="footer">
      JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a>
    </div>
  </div>
</body>
</html>
`.trim();
}

/** Invoice sent email (invoice PDF attached separately) */
export function invoiceSentHtml(params: {
  clientName:    string;
  invoiceNumber: string;
  totalAmount:   number;
  dueDate:       string;
  invoiceUrl:    string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #083a4f; margin: 0; padding: 0; background: #f8f8f6; }
    .container { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #c0d5d6; }
    .header { background: #083a4f; padding: 24px 40px; }
    .body   { padding: 32px 40px; }
    .body p { line-height: 1.7; font-size: 15px; color: #333; }
    .amount-box { background: #083a4f; color: #ffffff; border-radius: 6px; padding: 20px 24px; text-align: center; margin: 20px 0; }
    .amount-box .amount { font-size: 36px; font-weight: 700; color: #c0d5d6; }
    .amount-box .due    { font-size: 13px; color: #a58d66; margin-top: 4px; }
    .details { background: #e5e1dd; border-radius: 6px; padding: 16px 24px; margin: 16px 0; font-size: 14px; }
    .cta { display: inline-block; background: #a58d66; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin-top: 8px; }
    .footer { background: #e5e1dd; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
    </div>
    <div class="body">
      <p>Hi ${params.clientName},</p>
      <p>Please find your invoice attached. You can also view it online using the link below.</p>
      <div class="amount-box">
        <div class="amount">$${params.totalAmount.toLocaleString()}</div>
        <div class="due">Due by ${params.dueDate}</div>
      </div>
      <div class="details">
        <strong>Invoice:</strong> ${params.invoiceNumber} &nbsp;|&nbsp; <strong>Due:</strong> ${params.dueDate}
      </div>
      <p>Please transfer the amount via bank transfer. Reference your invoice number in the payment description.</p>
      <p>Reply to this email if you have any questions.</p>
      <p>Thank you,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
    </div>
    <div class="footer">
      JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a>
    </div>
  </div>
</body>
</html>
`.trim();
}

/** Pre-event checklist — sent 1–2 weeks before the event */
export function preEventChecklistHtml(params: {
  clientName:  string;
  eventDate:   string;
  bookingUrl:  string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#083a4f;margin:0;padding:0;background:#f8f8f6}
  .container{max-width:580px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #c0d5d6}
  .header{background:#083a4f;padding:24px 40px}
  .body{padding:32px 40px}
  .body p{line-height:1.7;font-size:15px;color:#333}
  .checklist{background:#f7f4f1;border-radius:6px;padding:20px 24px;margin:20px 0}
  .checklist p{margin:0 0 8px;font-size:14px;color:#083a4f;line-height:1.6}
  .checklist p:last-child{margin:0}
  .footer{background:#e5e1dd;padding:20px 40px;text-align:center;font-size:12px;color:#666}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
  </div>
  <div class="body">
    <p>Hi ${params.clientName},</p>
    <p>Your event on <strong>${params.eventDate}</strong> is coming up fast — so exciting! 🎉</p>
    <p>To make sure the day runs smoothly and I capture every moment perfectly, could you please send me the following details when you get a chance:</p>
    <div class="checklist">
      <p>📋 <strong>Final run sheet / timeline</strong> — ceremony time, reception start, key moments</p>
      <p>📍 <strong>Venue address &amp; access details</strong> — parking, entry point, any access restrictions</p>
      <p>📞 <strong>Vendor contacts</strong> — celebrant, MC, venue coordinator, florist</p>
      <p>🔄 <strong>Any last-minute changes</strong> — guest list updates, location changes, special moments added</p>
    </div>
    <p>If you have a preferred shot list or must-have moments, please include those too — the more detail the better!</p>
    <p>I'll also be in touch shortly to confirm our meeting to go through the run sheet together.</p>
    <p>Can't wait for the big day,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
  </div>
  <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
</div>
</body>
</html>`.trim();
}

/** Gallery delivery — sends Google Drive link after final payment */
export function galleryDeliveryHtml(params: {
  clientName:   string;
  eventDate:    string;
  driveUrl:     string;
  packageName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#083a4f;margin:0;padding:0;background:#f8f8f6}
  .container{max-width:580px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #c0d5d6}
  .header{background:#083a4f;padding:24px 40px}
  .body{padding:32px 40px}
  .body p{line-height:1.7;font-size:15px;color:#333}
  .gallery-box{background:#083a4f;border-radius:8px;padding:24px;text-align:center;margin:24px 0}
  .gallery-box p{color:#c0d5d6;margin:0 0 16px;font-size:14px}
  .cta{display:inline-block;background:#a58d66;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:16px}
  .tip{background:#f7f4f1;border-radius:6px;padding:14px 18px;margin:16px 0;font-size:13px;color:#083a4f}
  .footer{background:#e5e1dd;padding:20px 40px;text-align:center;font-size:12px;color:#666}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
  </div>
  <div class="body">
    <p>Hi ${params.clientName},</p>
    <p>The wait is over! 🎉 Your photos${params.packageName?.toLowerCase().includes("video") || params.packageName?.toLowerCase().includes("film") ? " and film" : ""} from <strong>${params.eventDate}</strong> are ready and waiting for you.</p>
    <p>I've poured so much heart into every edit — I truly hope they take you right back to that day. ❤️</p>
    <div class="gallery-box">
      <p>Click below to access your private Google Drive gallery</p>
      <a href="${params.driveUrl}" class="cta">View My Gallery →</a>
    </div>
    <div class="tip">
      <strong>💡 Tips:</strong> Sign in with your Google account to download at full resolution. Download all files before saving to your phone to preserve quality. Back them up somewhere safe — these are irreplaceable!
    </div>
    <p>Please let me know once you've had a chance to look through everything. If anything needs a small adjustment, just reply and I'll take care of it.</p>
    <p>It was such an honour to be part of your story. Thank you for trusting me with your memories. 🙏</p>
    <p>With love,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
  </div>
  <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
</div>
</body>
</html>`.trim();
}

/** Google review request — sent after client reacts positively to gallery */
export function reviewRequestHtml(params: {
  clientName:  string;
  reviewUrl:   string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#083a4f;margin:0;padding:0;background:#f8f8f6}
  .container{max-width:580px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #c0d5d6}
  .header{background:#083a4f;padding:24px 40px}
  .body{padding:32px 40px}
  .body p{line-height:1.7;font-size:15px;color:#333}
  .stars{font-size:32px;text-align:center;margin:16px 0}
  .cta-wrap{text-align:center;margin:24px 0}
  .cta{display:inline-block;background:#a58d66;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:15px}
  .note{font-size:13px;color:#888;text-align:center;margin-top:12px}
  .footer{background:#e5e1dd;padding:20px 40px;text-align:center;font-size:12px;color:#666}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
  </div>
  <div class="body">
    <p>Hi ${params.clientName},</p>
    <p>I'm so glad you love your gallery! 😊 Reactions like yours are genuinely why I do this work — knowing the photos brought back those feelings is the best feeling.</p>
    <p>I have a small favour to ask: if you have 2 minutes, would you be willing to leave a Google review? It makes a huge difference for a small local business and helps other couples and families find me.</p>
    <div class="stars">⭐⭐⭐⭐⭐</div>
    <div class="cta-wrap">
      <a href="${params.reviewUrl}" class="cta">Leave a Google Review →</a>
      <p class="note">Just click the link above — it takes less than 2 minutes.</p>
    </div>
    <p>And if you know anyone getting married, celebrating a milestone, or needing beautiful photos, I'd be so grateful for a referral. 🙏</p>
    <p>Thank you again for having me as part of your story.</p>
    <p>With gratitude,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
  </div>
  <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
</div>
</body>
</html>`.trim();
}

/** Payment overdue reminder */
export function paymentReminderHtml(params: {
  clientName:    string;
  invoiceNumber: string;
  amountDue:     number;
  dueDate:       string;
  daysOverdue:   number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #083a4f; }
    .container { max-width: 580px; margin: 40px auto; border: 1px solid #c0d5d6; border-radius: 8px; overflow: hidden; }
    .header { background: #083a4f; padding: 24px 36px; }
    .body { padding: 28px 36px; }
    .overdue { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 14px 20px; font-weight: 600; color: #856404; }
    .footer { background: #e5e1dd; padding: 16px 36px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
  </div>
  <div class="body">
    <p>Hi ${params.clientName},</p>
    <div class="overdue">⚠️ Invoice ${params.invoiceNumber} is ${params.daysOverdue} day(s) overdue. Amount due: <strong>$${params.amountDue.toLocaleString()}</strong></div>
    <p>Please arrange payment at your earliest convenience. Reply if you have any questions.</p>
    <p>Thank you,<br/><strong>Johnny Nguyen</strong> · JNguyen Co.</p>
  </div>
  <div class="footer">JNguyen Co. · Canberra, ACT · johnny.nguyen@jnguyen.co · <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
</div>
</body>
</html>
`.trim();
}

/** E-signature request — sent to client with signing link */
export function contractSigningRequestHtml(params: {
  clientName:  string;
  eventDate:   string;
  packageName: string;
  signingUrl:  string;
  expiresDate: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #083a4f; margin: 0; padding: 0; background: #f8f8f6; }
    .container { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #c0d5d6; }
    .header { background: #083a4f; padding: 24px 40px; }
    .body   { padding: 32px 40px; }
    .body p { line-height: 1.7; font-size: 15px; color: #333; }
    .details { background: #f0f4f4; border-left: 3px solid #407e8c; border-radius: 4px; padding: 14px 20px; margin: 16px 0; font-size: 14px; color: #083a4f; }
    .details div { margin: 4px 0; }
    .details strong { display: inline-block; min-width: 110px; color: #407e8c; }
    .cta-wrap { text-align: center; margin: 28px 0; }
    .cta { display: inline-block; background: #407e8c; color: #fff !important; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; }
    .note { font-size: 12px; color: #999; margin-top: 10px; }
    .footer { background: #e5e1dd; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
    </div>
    <div class="body">
      <p>Hi ${params.clientName},</p>
      <p>Thank you so much for choosing JNguyen Co.! Your photography &amp; videography contract is ready for your review and signature.</p>
      <p>Please take a moment to read through the agreement and sign electronically — no printing or scanning required.</p>
      <div class="details">
        <div><strong>Event Date:</strong> ${params.eventDate}</div>
        <div><strong>Package:</strong> ${params.packageName}</div>
        <div><strong>Link expires:</strong> ${params.expiresDate}</div>
      </div>
      <div class="cta-wrap">
        <a href="${params.signingUrl}" class="cta">✍️ Review &amp; Sign Contract</a>
        <p class="note">Link expires ${params.expiresDate}. Reply to this email if you need a new one.</p>
      </div>
      <p>If you have any questions before signing, just reply to this email.</p>
      <p>Warm regards,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
    </div>
    <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
  </div>
</body>
</html>`.trim();
}

/** Contract signed — confirmation sent to client (signed PDF attached) */
export function contractSignedConfirmationHtml(params: {
  clientName:  string;
  eventDate:   string;
  packageName: string;
  signedAt:    string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #083a4f; margin: 0; padding: 0; background: #f8f8f6; }
    .container { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #c0d5d6; }
    .header { background: #083a4f; padding: 24px 40px; }
    .body   { padding: 32px 40px; }
    .body p { line-height: 1.7; font-size: 15px; color: #333; }
    .success { background: #f0faf4; border: 1px solid #6fcf97; border-radius: 6px; padding: 18px 24px; text-align: center; margin: 20px 0; }
    .success .tick { font-size: 32px; line-height: 1; }
    .success p { color: #27ae60; font-weight: 700; margin: 8px 0 0; font-size: 16px; }
    .details { background: #f0f4f4; border-left: 3px solid #407e8c; border-radius: 4px; padding: 14px 20px; margin: 16px 0; font-size: 14px; color: #083a4f; }
    .details div { margin: 4px 0; }
    .details strong { display: inline-block; min-width: 110px; color: #407e8c; }
    .footer { background: #e5e1dd; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
    </div>
    <div class="body">
      <p>Hi ${params.clientName},</p>
      <div class="success">
        <div class="tick">✅</div>
        <p>Your contract has been signed successfully!</p>
      </div>
      <p>A signed copy of your contract is attached to this email for your records.</p>
      <div class="details">
        <div><strong>Event Date:</strong> ${params.eventDate}</div>
        <div><strong>Package:</strong> ${params.packageName}</div>
        <div><strong>Signed:</strong> ${params.signedAt}</div>
      </div>
      <p>The next step is to pay your deposit to officially secure your date — you'll receive a separate invoice shortly.</p>
      <p>I can't wait to be a part of your special day! 🎉</p>
      <p>Warm regards,<br/><strong>Johnny Nguyen</strong><br/>JNguyen Co.</p>
    </div>
    <div class="footer">JNguyen Co. &nbsp;·&nbsp; Canberra, ACT &nbsp;·&nbsp; johnny.nguyen@jnguyen.co &nbsp;·&nbsp; <a href="https://www.jnguyen.co" style="color:#666;text-decoration:none;">www.jnguyen.co</a></div>
  </div>
</body>
</html>`.trim();
}
