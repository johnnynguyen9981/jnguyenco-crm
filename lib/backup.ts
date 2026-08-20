// lib/backup.ts
// Shared full-database export -> Google Drive logic, used by both:
//   - app/api/admin/backup/route.ts   (manual, founder-triggered via browser)
//   - app/api/cron/monthly-backup/route.ts (automatic, Vercel Cron)
// Exists because the Supabase project is on the Free plan, which has no
// built-in scheduled backups or point-in-time recovery.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { uploadBackupToDrive } from "@/lib/google/drive";

export const BACKUP_TABLES = [
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

export interface BackupResult {
  success: true;
  filename: string;
  sizeBytes: number;
  counts: Record<string, number | string>;
  webViewLink: string;
}

/**
 * Pulls every business table (skipping google_tokens, which only holds OAuth
 * credentials, not business data) into a single JSON file and uploads it to
 * the "Backups" folder in the CRM's Google Drive, alongside the per-client
 * Year/Month folders. Throws on Drive upload failure -- callers should wrap
 * in try/catch to surface a clean error response.
 */
export async function runFullBackup(): Promise<BackupResult> {
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

  for (const table of BACKUP_TABLES) {
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

  const webViewLink = await uploadBackupToDrive(filename, buffer, "application/json");

  return {
    success: true,
    filename,
    sizeBytes: buffer.length,
    counts,
    webViewLink,
  };
}
