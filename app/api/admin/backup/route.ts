// POST /api/admin/backup
// One-off / on-demand full data export -> uploaded to Google Drive.
// Exists because the Supabase project is on the Free plan, which has no
// built-in scheduled backups or point-in-time recovery. This route pulls
// every business table (skipping google_tokens, which only holds OAuth
// credentials, not business data) into a single JSON file and uploads it
// to the "Backups" folder in the CRM's Google Drive, alongside the
// per-client Year/Month folders.
import { NextResponse, type NextRequest } from "next/server";
import { isCurrentUserFounder } from "@/lib/team";
import { isDriveConfigured, getDriveFolderUrl, getServiceAccountJson } from "@/lib/google/drive";
import { runFullBackup } from "@/lib/backup";

// Force dynamic rendering -- this route must never be statically cached or
// ISR'd; every hit should re-run auth + a fresh export.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function runBackup() {
  if (!(await isCurrentUserFounder())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "Google Drive is not configured on this deployment." }, { status: 503 });
  }

  try {
    const result = await runFullBackup();
    return NextResponse.json(result);
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

// Founder-gated, non-secret-leaking diagnostic for the service-account env
// var parsing bug. Reports lengths/prefixes/whether-it-parses-as-JSON only --
// never the actual key material. Visit /api/admin/backup?envcheck=1
function checkServiceAccountEnv() {
  const env = process.env as Record<string, string | undefined>;
  const b64Raw = env["GOOGLE_SERVICE_ACCOUNT_B64"] ?? "";
  const jsonRaw = env["GOOGLE_SERVICE_ACCOUNT_JSON"] ?? "";

  function inspect(label: string, raw: string, isB64: boolean) {
    const info: Record<string, unknown> = {
      label,
      present: raw.length > 0,
      rawLength: raw.length,
      hasLeadingBOM: raw.charCodeAt(0) === 0xFEFF,
      hasWhitespaceEnds: raw !== raw.trim(),
      first10: JSON.stringify(raw.slice(0, 10)),
      last10: JSON.stringify(raw.slice(-10)),
    };
    if (!raw) return info;
    try {
      const decoded = isB64 ? Buffer.from(raw.trim(), "base64").toString("utf8") : raw.trim();
      info.decodedLength = decoded.length;
      info.decodedFirst20 = JSON.stringify(decoded.slice(0, 20));
      try {
        const parsed = JSON.parse(decoded);
        info.parsesAsJson = true;
        info.hasType = typeof parsed.type;
        info.hasClientEmail = typeof parsed.client_email;
        info.hasPrivateKey = typeof parsed.private_key;
      } catch (e: any) {
        info.parsesAsJson = false;
        info.parseError = e?.message;
      }
    } catch (e: any) {
      info.decodeError = e?.message;
    }
    return info;
  }

  return {
    actualFunctionOutputLength: getServiceAccountJson().length,
    b64: inspect("GOOGLE_SERVICE_ACCOUNT_B64", b64Raw, true),
    json: inspect("GOOGLE_SERVICE_ACCOUNT_JSON", jsonRaw, false),
  };
}

// GET alias -- lets the backup be triggered by visiting the URL directly in a
// logged-in browser tab (e.g. https://.../api/admin/backup), which is more
// reliable for one-off manual triggering than firing a fetch() from a
// non-page JS context (browser extensions etc.) where auth cookies may not
// be attached the same way as a real top-level navigation.
//
// ?envcheck=1 -- runs the safe, non-secret-leaking service-account env
// diagnostic instead of the actual backup (still founder-gated).
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("envcheck")) {
    if (!(await isCurrentUserFounder())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(checkServiceAccountEnv());
  }
  return runBackup();
}
