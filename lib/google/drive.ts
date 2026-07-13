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
import { createClient as createServerClient } from "@/lib/supabase/server";

export type DriveSubfolder = "Quotes" | "Contracts" | "Invoices";

/** Returns true if Drive env vars are configured. */
export function isDriveConfigured(): boolean {
  const env = process.env as Record<string, string | undefined>;
  return !!(
    getServiceAccountJson() &&
    (stripBOM(env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] ?? "").trim() || "0AFXFUoYwRDw-Uk9PVA")
  );
}

function stripBOM(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

/** Reads the service account JSON from env — uses dynamic access to prevent webpack build-time inlining. */
function getServiceAccountJson(): string {
  const env = process.env as Record<string, string | undefined>;
  // Prefer base64-encoded var (no encoding/newline/BOM issues)
  const b64 = stripBOM(env["GOOGLE_SERVICE_ACCOUNT_B64"] ?? "").trim();
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  // Fall back to raw JSON var
  return stripBOM(env["GOOGLE_SERVICE_ACCOUNT_JSON"] ?? "").trim();
}

function getDriveClient(): drive_v3.Drive {
  const saJson = getServiceAccountJson();
  if (!saJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set.");
  }
  const credentials = JSON.parse(saJson);
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
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
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
    supportsAllDrives: true,
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
  const env = process.env as Record<string, string | undefined>;
  const fromEnv = stripBOM(env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] ?? "").trim();
  // Fallback to known root folder ID if env var is missing/corrupt
  const rootId = fromEnv || "0AFXFUoYwRDw-Uk9PVA";
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID env var is not set.");

  const drive = getDriveClient();

  // Look up booking event_date to determine Year/Month folder names
  const supabase = await createServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("event_date")
    .eq("client_id", clientId)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const eventDate   = booking?.event_date ? new Date(booking.event_date) : new Date();
  const yearFolder  = String(eventDate.getUTCFullYear());
  const monthFolder = eventDate.toLocaleString("en-AU", { month: "long", timeZone: "UTC" });

  // Structure: Root / Year / Month / ClientName / ...
  const yearId          = await findOrCreateFolder(drive, yearFolder,   rootId);
  const monthId         = await findOrCreateFolder(drive, monthFolder,  yearId);
  const clientFolderId  = await findOrCreateFolder(drive, clientName,   monthId);

  // Ensure all subfolders exist (safe to run multiple times)
  const [deliverablesFolderId] = await Promise.all([
    findOrCreateFolder(drive, "Deliverables", clientFolderId),
    findOrCreateFolder(drive, "Quotes",       clientFolderId),
    findOrCreateFolder(drive, "Contracts",    clientFolderId),
    findOrCreateFolder(drive, "Invoices",     clientFolderId),
  ]);

  // Ensure Photos and Videos subfolders inside Deliverables
  await Promise.all([
    findOrCreateFolder(drive, "Photos", deliverablesFolderId),
    findOrCreateFolder(drive, "Videos", deliverablesFolderId),
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
    supportsAllDrives: true,
  });

  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
}

/** Returns a browsable URL for a Drive folder. */
export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Uploads a PDF buffer to Google Drive using the user's personal OAuth client
 * (no service account required). Creates a "JNguyen Co. CRM / [clientName] / Contracts"
 * folder structure automatically. Returns the file's webViewLink.
 *
 * Used by public routes (e.g. /api/sign/[token]) via getAuthenticatedClientByOwnerId().
 */
export async function uploadToDriveWithOAuth(
  authClient: any,
  clientName: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const drive = google.drive({ version: "v3", auth: authClient });

  // Find or create root CRM folder
  async function findOrCreate(name: string, parentId?: string): Promise<string> {
    const parentQ = parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;
    const { data } = await drive.files.list({
      q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentQ}`,
      fields: "files(id)",
      spaces: "drive",
    });
    if (data.files && data.files.length > 0) return data.files[0].id!;
    const { data: f } = await drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) },
      fields: "id",
    });
    return f.id!;
  }

  const rootId      = await findOrCreate("JNguyen Co. CRM");
  const clientId    = await findOrCreate(clientName, rootId);
  const contractsId = await findOrCreate("Contracts", clientId);

  const { data: file } = await drive.files.create({
    requestBody: { name: filename, parents: [contractsId] },
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });

  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
}
