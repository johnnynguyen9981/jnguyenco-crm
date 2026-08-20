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

export async function POST() {
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
    return NextResponse.json({ error: `Drive upload failed: ${e.message}` }, { status: 500 });
  }
}
