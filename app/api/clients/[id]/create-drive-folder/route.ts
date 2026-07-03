// POST /api/clients/[id]/create-drive-folder
// Creates (or retrieves) the Drive folder for a client and returns the URL.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { getOrCreateClientFolder, getDriveFolderUrl, isDriveConfigured } from "@/lib/google/drive";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  if (!isDriveConfigured()) return apiError("Google Drive is not configured.", 503);

  // Fetch client name + existing folder ID
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, gdrive_folder_id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !client) return apiError("Client not found", 404);

  const clientName = `${client.first_name} ${client.last_name}`.trim();

  const folderId = await getOrCreateClientFolder(client.id, clientName);
  const folderUrl = getDriveFolderUrl(folderId);

  return apiSuccess({ folder_id: folderId, folder_url: folderUrl });
}
