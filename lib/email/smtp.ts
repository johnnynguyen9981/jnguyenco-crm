// ─────────────────────────────────────────────────────────────────────────────
// SMTP email helper — supports GoDaddy and Gmail via Nodemailer
// ─────────────────────────────────────────────────────────────────────────────
import nodemailer from "nodemailer";

interface EmailOptions {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;
  pdfAttachment?: {
    filename: string;
    data:     string; // base64-encoded PDF bytes
  };
}

function stripBOM(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function createTransporter() {
  const host = stripBOM(process.env.SMTP_HOST);
  const port = parseInt(stripBOM(process.env.SMTP_PORT) ?? "465", 10);
  const user = stripBOM(process.env.SMTP_USER);
  const pass = stripBOM(process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env.local"
    );
  }

  // port 465 → implicit SSL (secure: true, no STARTTLS upgrade needed)
  // port 587 → STARTTLS (secure: false, requireTLS: true)
  // Works for both Gmail and GoDaddy (and most other providers)
  const useSSL = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure: useSSL,
    requireTLS: !useSSL,
    auth: { user, pass },
  });
}

/**
 * Send an email via SMTP (Gmail or GoDaddy — driven by .env.local).
 * Mirrors the signature of lib/google/gmail.ts sendEmail.
 */
export async function sendEmailViaSMTP(
  opts: EmailOptions
): Promise<{ messageId: string }> {
  const transporter = createTransporter();

  // SMTP_FROM lets you set a display address separate from the login user
  const fromAddress =
    process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "johnny.nguyen@jnguyen.co";

  const attachments = opts.pdfAttachment
    ? [
        {
          filename:    opts.pdfAttachment.filename,
          content:     opts.pdfAttachment.data,
          encoding:    "base64" as const,
          contentType: "application/pdf",
        },
      ]
    : [];

  const info = await transporter.sendMail({
    from:        `"JNguyen Co." <${fromAddress}>`,
    to:          opts.to,
    subject:     opts.subject,
    html:        opts.html,
    text:        opts.text,
    attachments,
  });

  return { messageId: info.messageId };
}
