// lib/google/drive.ts
// Google Drive integration using a Service Account (not OAuth user tokens).
//
// Setup requirements (one-time):
//   1. In Google Cloud Console → IAM & Admin → Service Accounts → create a service account
//   2. Create a JSON key for it and set GOOGLE_SERVICE_ACCOUNT_JSON in your env vars
//   3. In your Google Drive, create a folder called "JNguyen Co. CRM"
//   4. Share that folder with the service account email (Editor access)
//   5. Copy the folder ID from its URL and set GOOGLE_DRIVE_ROOT_FOLDER_ID in env vars
//
// Folder structure created per client:
//   JNguyen Co. CRM /
//     └── [Client Name] /
//           ├── Quotes/
//           ├── Contracts/
//           └── Invoices/

import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type DriveSubfolder = "Quotes" | "Contracts" | "Invoices";

/** Returns true if Drive env vars are configured. */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

function getDriveClient(): drive_v3.Drive {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set.");
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/** Finds a folder by name under a parent; creates it if it doesn't exist. */
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/\\/g, "").replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `name = '${safeName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (data.files && data.files.length > 0) {
    return data.files[0].id!;
  }

  const { data: folder } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return folder.id!;
}

/**
 * Creates (or retrieves) the client's Drive folder and its Quotes/Contracts/Invoices
 * subfolders inside the root CRM folder. Returns the client folder ID.
 *
 * Also persists the folder ID back to the clients table via service role client.
 */
export async function getOrCreateClientFolder(
  clientId: string,
  clientName: string
): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID env var is not set.");

  const drive = getDriveClient();

  // Create / find the client folder
  const clientFolderId = await findOrCreateFolder(drive, clientName, rootId);

  // Ensure all three subfolders exist (safe to run multiple times)
  await Promise.all([
    findOrCreateFolder(drive, "Quotes",    clientFolderId),
    findOrCreateFolder(drive, "Contracts", clientFolderId),
    findOrCreateFolder(drive, "Invoices",  clientFolderId),
  ]);

  // Persist folder ID back to Supabase using service role (works in any context)
  try {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin
      .from("clients")
      .update({ gdrive_folder_id: clientFolderId })
      .eq("id", clientId);
  } catch (e) {
    console.warn("[drive] Failed to persist gdrive_folder_id:", e);
  }

  return clientFolderId;
}

/**
 * Uploads a PDF buffer to a client's Drive subfolder.
 * If the subfolder doesn't exist yet, it's created automatically.
 * Returns the file's Google Drive webViewLink.
 */
export async function uploadToDriveFolder(
  clientFolderId: string,
  subfolder: DriveSubfolder,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const drive = getDriveClient();
  const subFolderId = await findOrCreateFolder(drive, subfolder, clientFolderId);

  const { data: file } = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [subFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
}

/** Returns a browsable URL for a Drive folder. */
export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
