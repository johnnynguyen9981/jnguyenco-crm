// GET /api/cron/monthly-backup
// Runs once a month (see vercel.json) -- full data export uploaded to
// Google Drive. Same auth pattern as /api/cron/night-before-checklist: no
// user session in a cron context, so this is protected by CRON_SECRET
// (Vercel automatically sends `Authorization: Bearer $CRON_SECRET` for its
// own scheduled invocations) rather than a founder login check.
import { NextRequest, NextResponse } from "next/server";
import { runFullBackup } from "@/lib/backup";
import { isDriveConfigured } from "@/lib/google/drive";
import { sendEmailViaSMTP } from "@/lib/email/smtp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "Google Drive is not configured on this deployment." }, { status: 503 });
  }

  const recipient = process.env.NIGHT_BEFORE_CHECKLIST_EMAIL || process.env.NEXT_PUBLIC_BUSINESS_EMAIL;

  try {
    const result = await runFullBackup();

    if (recipient) {
      try {
        await sendEmailViaSMTP({
          to: recipient,
          subject: `CRM backup complete — ${result.filename}`,
          html: `
            <p>Your monthly JNguyen Co. CRM data backup ran successfully.</p>
            <ul>
              <li><strong>File:</strong> ${result.filename}</li>
              <li><strong>Size:</strong> ${(result.sizeBytes / 1024).toFixed(0)} KB</li>
              <li><strong>Records:</strong> ${Object.entries(result.counts).map(([k, v]) => `${k}: ${v}`).join(", ")}</li>
            </ul>
            <p><a href="${result.webViewLink}">Open the backup file in Google Drive</a></p>
          `,
        });
      } catch (emailErr) {
        // Don't fail the whole cron run just because the confirmation email
        // didn't send -- the backup itself already succeeded.
        console.error("[cron/monthly-backup] Backup succeeded but confirmation email failed:", emailErr);
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[cron/monthly-backup] Backup failed:", e);
    if (recipient) {
      try {
        await sendEmailViaSMTP({
          to: recipient,
          subject: `⚠️ CRM monthly backup FAILED`,
          html: `<p>The monthly CRM data backup failed to run.</p><p>Error: ${e?.message ?? "Unknown error"}</p><p>Check the Vercel logs for /api/cron/monthly-backup.</p>`,
        });
      } catch {
        // If even the failure email fails, there's nothing more we can do here.
      }
    }
    return NextResponse.json({ error: `Backup failed: ${e?.message}` }, { status: 500 });
  }
}
