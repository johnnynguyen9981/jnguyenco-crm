// POST /api/admin/migrate-drive-folders
// One-time migration: moves existing client folders from
//   JNguyen Co. CRM / [Client Name] /
// into
//   JNguyen Co. CRM / Clients / YYYY / Month / [Client Name] /
// and adds Deliverables / Photos + Videos subfolders if missing.
//
// Trigger once from the browser:
//   fetch('/api/admin/migrate-drive-folders', { method: 'POST' })
//     .then(r => r.json()).then(console.log)

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { google } from "googleapis";

type DriveClient = ReturnType<typeof google.drive>;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** List all folder children of parentId (non-trashed). */
async function listFolders(
  drive: DriveClient,
  parentId: string
): Promise<Array<{ id: string; name: string }>> {
  const results: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;
  do {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      spaces: "drive",
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const f of data.files ?? []) {
      if (f.id && f.name) results.push({ id: f.id, name: f.name });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return results;
}

/** Find a folder by name under parentId, or create it. */
async function findOrCreateFolder(
  drive: DriveClient,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`,
    fields: "files(id)",
    spaces: "drive",
  });
  if (data.files && data.files.length > 0) return data.files[0].id!;
  const { data: f } = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  return f.id!;
}

/** Move a Drive folder to a new parent (removes old parent). */
async function moveFolder(
  drive: DriveClient,
  fileId: string,
  oldParentId: string,
  newParentId: string
): Promise<void> {
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: oldParentId,
    fields: "id, parents",
  });
}

// ─── route ────────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let ownerUserId: string;
  try {
    ownerUserId = await getOwnerUserId();
  } catch {
    return apiError("Unauthorized", 401);
  }

  // Load all clients so we can match folder names → event dates.
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("owner_id", ownerUserId);
  if (clientsErr || !clients) return apiError("Could not load clients", 500);

  // Load all bookings (earliest per client).
  const { data: bookings } = await supabase
    .from("bookings")
    .select("client_id, event_date")
    .order("event_date", { ascending: true });

  // Build a map: clientId → earliest event_date
  const eventDateByClientId = new Map<string, string>();
  for (const b of bookings ?? []) {
    if (b.client_id && b.event_date && !eventDateByClientId.has(b.client_id)) {
      eventDateByClientId.set(b.client_id, b.event_date);
    }
  }

  // Build a map: "First Last" → { id, event_date }
  type ClientInfo = { id: string; year: string; month: string };
  const clientByName = new Map<string, ClientInfo>();
  for (const c of clients) {
    const name = `${c.first_name} ${c.last_name}`.trim();
    const rawDate = eventDateByClientId.get(c.id);
    const d = rawDate ? new Date(rawDate) : new Date();
    clientByName.set(name, {
      id: c.id,
      year: String(d.getUTCFullYear()),
      month: d.toLocaleString("en-AU", { month: "long", timeZone: "UTC" }),
    });
  }

  // Get Drive client.
  let authClient: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  try {
    authClient = await getAuthenticatedClient(user.id);
  } catch {
    return apiError("Google account not connected.", 503);
  }
  const drive = google.drive({ version: "v3", auth: authClient });

  // Find "JNguyen Co. CRM" root folder.
  const { data: rootSearch } = await drive.files.list({
    q: `name = 'JNguyen Co. CRM' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`,
    fields: "files(id)",
    spaces: "drive",
  });
  const rootId = rootSearch.files?.[0]?.id;
  if (!rootId) return apiError("JNguyen Co. CRM root folder not found in Drive.", 404);

  // Ensure Clients/ exists.
  const clientsId = await findOrCreateFolder(drive, "Clients", rootId);

  // List direct children of root — these are the old client folders.
  const rootChildren = await listFolders(drive, rootId);
  // Exclude "Clients" itself (already migrated ones live there).
  const oldFolders = rootChildren.filter(f => f.name !== "Clients");

  const moved: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const folder of oldFolders) {
    const info = clientByName.get(folder.name);
    if (!info) {
      skipped.push(`${folder.name} (no matching client)`);
      continue;
    }

    try {
      // Ensure Clients/YYYY/Month/ path exists.
      const yearId  = await findOrCreateFolder(drive, info.year,  clientsId);
      const monthId = await findOrCreateFolder(drive, info.month, yearId);

      // Move the client folder into Clients/YYYY/Month/.
      await moveFolder(drive, folder.id, rootId, monthId);

      // Add Deliverables/Photos/Videos inside the (now-moved) client folder.
      const deliverablesId = await findOrCreateFolder(drive, "Deliverables", folder.id);
      await Promise.all([
        findOrCreateFolder(drive, "Photos", deliverablesId),
        findOrCreateFolder(drive, "Videos", deliverablesId),
      ]);

      moved.push(`${folder.name} → Clients/${info.year}/${info.month}/`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${folder.name}: ${msg}`);
    }
  }

  return apiSuccess({ moved, skipped, errors });
}
