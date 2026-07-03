// POST /api/clients/[id]/create-drive-folder
// Creates (or retrieves) the Drive folder structure for a client using OAuth tokens.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { google } from "googleapis";
import { getDriveFolderUrl } from "@/lib/google/drive";

type Params = { params: { id: string } };

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  const parentQ = parentId
    ? ` and '${parentId}' in parents`
    : ` and 'root' in parents`;
  const safeName = name.replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentQ}`,
    fields: "files(id)",
    spaces: "drive",
  });
  if (data.files && data.files.length > 0) return data.files[0].id!;
  const { data: f } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  return f.id!;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Use getOwnerUserId() so staff logins resolve to the founder's owner_id.
  let ownerUserId: string;
  try {
    ownerUserId = await getOwnerUserId();
  } catch {
    return apiError("Unauthorized", 401);
  }

  // Do NOT select gdrive_folder_id — if the migration hasn't run yet, PostgREST
  // throws a schema-cache error on explicit column selection. findOrCreateFolder()
  // is idempotent (looks up by name before creating), so no caching is needed.
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !client) {
    console.error("[create-drive-folder] client query failed:", error?.message, "| clientId:", params.id, "| ownerUserId:", ownerUserId);
    return apiError(error?.message ?? "Client not found", 404);
  }

  // Get OAuth client (tokens stored in google_tokens table)
  let authClient: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  try {
    authClient = await getAuthenticatedClient(user.id);
  } catch {
    return apiError(
      "Google account not connected. Please connect it in Settings → Integrations.",
      503
    );
  }

  const drive = google.drive({ version: "v3", auth: authClient });
  const clientName = `${client.first_name} ${client.last_name}`.trim();

  // Create: JNguyen Co. CRM / [Client Name] / {Quotes, Contracts, Invoices}
  const rootId = await findOrCreateFolder(drive, "JNguyen Co. CRM");
  const clientFolderId = await findOrCreateFolder(drive, clientName, rootId);
  await Promise.all([
    findOrCreateFolder(drive, "Quotes",    clientFolderId),
    findOrCreateFolder(drive, "Contracts", clientFolderId),
    findOrCreateFolder(drive, "Invoices",  clientFolderId),
  ]);

  // Try to persist folder ID. Silently fails until gdrive_folder_id migration runs.
  const { error: updateError } = await supabase
    .from("clients")
    .update({ gdrive_folder_id: clientFolderId })
    .eq("id", client.id);
  if (updateError) {
    console.warn("[create-drive-folder] could not cache folder ID (run migration?):", updateError.message);
  }

  return apiSuccess({
    folder_id: clientFolderId,
    folder_url: getDriveFolderUrl(clientFolderId),
  });
}
