// POST /api/admin/backup
// One-off / on-demand full data export -> uploaded to Google Drive.
// Exists because the Supabase project is on the Free plan, which has no
// built-in scheduled backups or point-in-time recovery. This route pulls
// every business table (skipping google_tokens, which only holds OAuth
// credentials, not business data) into a single JSON file and uploads it
// to the "Backups" folder in the CRM's Google Drive, alongside the
// per-client Year/Month folders.
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isCurrentUserFounder } from "@/lib/team";
import { uploadBackupToDrive, isDriveConfigured, getDriveFolderUrl } from "@/lib/google/drive";

const TABLES = [
  "clients",
  "contractors",
  "partners",
  "venues",
  "packages",
  "team_members",
  "bookings",
  "booking_venues",
  "booking_contractors",
  "deliverables",
  "invoices",
  "invoice_line_items",
  "payments",
  "expenses",
] as const;

async function runBackup() {
  if (!(await isCurrentUserFounder())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "Google Drive is not configured on this deployment." }, { status: 503 });
  }

  // Service-role client -- bypasses RLS so the backup captures everything,
  // not just rows visible to whichever team member happens to trigger it.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const backup: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    source: "jnguyenco-crm Supabase project",
  };
  const counts: Record<string, number | string> = {};

  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select("*");
    if (error) {
      backup[table] = [];
      counts[table] = `ERROR: ${error.message}`;
      continue;
    }
    backup[table] = data ?? [];
    counts[table] = data?.length ?? 0;
  }

  const json = JSON.stringify(backup, null, 2);
  const buffer = Buffer.from(json, "utf-8");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `jnguyenco-crm-backup-${stamp}.json`;

  try {
    const webViewLink = await uploadBackupToDrive(filename, buffer, "application/json");
    return NextResponse.json({
      success: true,
      filename,
      sizeBytes: buffer.length,
      counts,
      webViewLink,
    });
  } catch (e: any) {
    // Temporary verbose diagnostics -- surfaces the underlying Google API
    // error (status/body/code) instead of just the top-level parse error,
    // so we can see WHY the Drive upload failed instead of guessing.
    const diag: Record<string, unknown> = {
      message: e?.message,
      name: e?.name,
      code: e?.code,
      status: e?.response?.status,
      statusText: e?.response?.statusText,
    };
    try {
      const raw = e?.response?.data;
      diag.responseData =
        typeof raw === "string" ? raw.slice(0, 2000) : JSON.stringify(raw)?.slice(0, 2000);
    } catch {
      diag.responseData = "(unserializable)";
    }
    try {
      diag.stack = String(e?.stack ?? "").split("\n").slice(0, 8).join(" | ");
    } catch {}
    return NextResponse.json({ error: `Drive upload failed`, diag }, { status: 500 });
  }
}

export async function POST() {
  return runBackup();
}

// GET alias -- lets the backup be triggered by visiting the URL directly in a
// logged-in browser tab (e.g. https://.../api/admin/backup), which is more
// reliable for one-off manual triggering than firing a fetch() from a
// non-page JS context (browser extensions etc.) where auth cookies may not
// be attached the same way as a real top-level navigation.
export async function GET() {
  return runBackup();
}
