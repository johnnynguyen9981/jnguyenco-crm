// POST /api/forms/send
// Emails the enquiry PDF form to a client as an attachment.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    clientId?:    string;
    clientEmail:  string;
    clientName?:  string;
    message?:     string;
  };

  const { clientEmail, clientName = "", message = "" } = body;

  if (!clientEmail) {
    return NextResponse.json({ error: "clientEmail is required" }, { status: 400 });
  }

  // Read the PDF from public/
  let pdfBase64: string;
  try {
    const pdfPath = join(process.cwd(), "public", "JNguyen_Co_Enquiry_Form.pdf");
    const pdfBytes = readFileSync(pdfPath);
    pdfBase64 = pdfBytes.toString("base64");
  } catch {
    return NextResponse.json({ error: "Could not read enquiry form PDF" }, { status: 500 });
  }

  const firstName = clientName.split(" ")[0] || "there";
  const personalNote = message.trim()
    ? `<p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.7;">${message.trim()}</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f7f4f1;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f1;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07);">

        <!-- Header -->
        <tr>
          <td style="background:#083a4f;padding:24px 40px;text-align:left;">
            <img src="https://jnguyenco-crm.vercel.app/PNG/LetterHeadSand.png" alt="JNguyen Co." style="height:60px;width:auto;display:block;" />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#083a4f;font-size:18px;font-weight:600;">
              Hi ${firstName},
            </p>
            ${personalNote}
            <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.7;">
              Thank you for your interest in JNguyen Co.! I've attached our
              <strong>Client Enquiry Form</strong> to this email.
            </p>
            <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.7;">
              Please fill it in and reply with the completed form, and I'll get back
              to you with a personalised quote within <strong>24–48 hours</strong>.
            </p>

            <!-- Steps -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f7f4f1;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
              <tr>
                <td style="padding:0 0 12px;">
                  <p style="margin:0;color:#083a4f;font-size:11px;font-weight:700;
                             letter-spacing:2px;text-transform:uppercase;">Next Steps</p>
                </td>
              </tr>
              <tr><td style="padding:4px 0;color:#444;font-size:13px;">
                <span style="color:#a58d66;font-weight:700;">01</span>&nbsp;&nbsp;Open and fill in the attached PDF
              </td></tr>
              <tr><td style="padding:4px 0;color:#444;font-size:13px;">
                <span style="color:#a58d66;font-weight:700;">02</span>&nbsp;&nbsp;Reply to this email with the completed form
              </td></tr>
              <tr><td style="padding:4px 0;color:#444;font-size:13px;">
                <span style="color:#a58d66;font-weight:700;">03</span>&nbsp;&nbsp;Receive your personalised quote within 48 hours
              </td></tr>
            </table>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.7;">
              If you have any questions in the meantime, feel free to reply to this email
              or reach out via Instagram. I'd love to hear more about your plans!
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#083a4f;padding:24px 40px;">
            <p style="margin:0;color:#a58d66;font-size:13px;font-weight:600;">
              Johnny Nguyen
            </p>
            <p style="margin:4px 0 0;color:#c0d5d6;font-size:12px;">
              JNguyen Co. &middot; <a href="mailto:johnny.nguyen@jnguyen.co" style="color:#c0d5d6;text-decoration:none;">johnny.nguyen@jnguyen.co</a> &middot; <a href="https://www.jnguyen.co" style="color:#c0d5d6;text-decoration:none;">www.jnguyen.co</a> &middot; Canberra, ACT
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendEmailViaSMTP({
      to:      clientEmail,
      subject: `Your JNguyen Co. Enquiry Form${clientName ? ` — ${clientName}` : ""}`,
      html,
      text: `Hi ${firstName},\n\nPlease find the JNguyen Co. Client Enquiry Form attached. Fill it in and reply to this email and I will send you a personalised quote within 24–48 hours.\n\nJohnny Nguyen\nJNguyen Co.`,
      pdfAttachment: {
        filename: "JNguyen_Co_Enquiry_Form.pdf",
        data: pdfBase64,
      },
    });
  } catch (e) {
    console.error("SMTP error:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
