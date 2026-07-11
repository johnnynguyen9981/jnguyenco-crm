// POST /api/clients/[id]/create-drive-folder
// Creates the Drive folder structure for a client using the service account.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import { getOrCreateClientFolder, getDriveFolderUrl } from "@/lib/google/drive";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let ownerUserId: string;
  try {
    ownerUserId = await getOwnerUserId();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !client) return apiError(error?.message ?? "Client not found", 404);

  const clientName = `${client.first_name} ${client.last_name}`.trim();

  try {
    const clientFolderId = await getOrCreateClientFolder(client.id, clientName);
    return apiSuccess({
      folder_id:  clientFolderId,
      folder_url: getDriveFolderUrl(clientFolderId),
    });
  } catch (e: any) {
    return apiError(`Drive error: ${e.message}`, 500);
  }
}
