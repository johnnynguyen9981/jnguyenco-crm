// app/api/expenses/upload/route.ts
// Uploads a receipt/bill file to Google Drive under:
//   Business Expenses / FY YYYY-YY / [filename]
//
// Uses the service account (same as every other Drive write in this app) --
// no longer falls back to user OAuth, since the app no longer requests a
// Drive OAuth scope at all (see lib/google/auth.ts for why).
//
// Returns: { fileId, fileName, fileUrl }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDriveConfigured } from "@/lib/google/drive";
import { google } from "googleapis";
import { Readable } from "stream";
import { getAustralianFY } from "@/lib/expenses";

// ── Drive client helper ──────────────────────────────────────────────────────

function getServiceAccountDrive() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
    const credentials = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
    const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
}

async function findOrCreateFolder(
    drive: ReturnType<typeof google.drive>,
    name: string,
    parentId: string
  ): Promise<string> {
    const safeName = name.replace(/'/g, "\\'");
    const { data } = await drive.files.list({
          q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
    });
    if (data.files?.length) return data.files[0].id!;
    const { data: folder } = await drive.files.create({
          requestBody: {
                  name,
                  mimeType: "application/vnd.google-apps.folder",
                  parents: [parentId],
          },
          fields: "id",
          supportsAllDrives: true,
    });
    return folder.id!;
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const dateStr  = (formData.get("date") as string) || new Date().toISOString().split("T")[0];

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate file type
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|heic)$/i)) {
          return NextResponse.json({ error: "Only PDF and images are accepted" }, { status: 400 });
    }

  // Max 20 MB
  if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  if (!isDriveConfigured()) {
        return NextResponse.json(
          { fileId: null, fileName: null, fileUrl: null, driveSkipped: true,
                   driveMessage: "Google Drive service account is not configured — receipt not saved." },
          { status: 200 }
              );
  }

  try {
        const drive  = getServiceAccountDrive();
        const rawRootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";
        const rootId = rawRootId.charCodeAt(0) === 0xFEFF ? rawRootId.slice(1) : rawRootId;

      // Build folder path: Business Expenses / FY YYYY-YY
      const expensesFolderId = await findOrCreateFolder(drive, "Business Expenses", rootId);
        const fy               = getAustralianFY(dateStr);
        const fyFolderId       = await findOrCreateFolder(drive, `FY ${fy}`, expensesFolderId);

      // Unique filename with timestamp to avoid collisions
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const fileName  = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const { data: uploaded } = await drive.files.create({
              requestBody: {
                        name:    fileName,
                        parents: [fyFolderId],
              },
              media: {
                        mimeType: file.type || "application/octet-stream",
                        body:     Readable.from(buffer),
              },
              fields: "id, webViewLink, name",
              supportsAllDrives: true,
      });

      const fileUrl = uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`;

      return NextResponse.json({
              fileId:   uploaded.id,
              fileName: uploaded.name ?? file.name,
              fileUrl,
      });
  } catch (err: any) {
        console.error("[expenses/upload]", err);

      // Drive permission issue on the service account — return a soft 200 so
      // the expense form can still save the record without a receipt attachment.
      const isPermission = err.message?.includes("insufficientPermissions") ||
                                  err.code === 403 || err.status === 403;

      if (isPermission) {
              return NextResponse.json(
                { fileId: null, fileName: null, fileUrl: null, driveSkipped: true,
                           driveMessage: "Google Drive upload failed (permission issue) — receipt not saved." },
                { status: 200 }
                      );
      }

      return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
