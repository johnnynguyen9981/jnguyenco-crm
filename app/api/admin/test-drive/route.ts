import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
    const json = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    const credentials = JSON.parse(json);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    const rawFolder = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";
    const folderId = rawFolder.charCodeAt(0) === 0xFEFF ? rawFolder.slice(1) : rawFolder;

    // Try to get metadata of the root folder
    const meta = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType, driveId",
      supportsAllDrives: true,
    });

    // Try to list contents
    const list = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });

    return NextResponse.json({
      folder: meta.data,
      children: list.data.files,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
