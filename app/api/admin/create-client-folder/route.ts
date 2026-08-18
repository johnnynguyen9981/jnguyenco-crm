// POST /api/admin/create-client-folder
// RETIRED — one-off admin utility (2026-08-14) used to build fresh Shared
// Drive folder structures (and repoint gdrive_folder_id) for Jessica Vo and
// Chloe Mackrell, whose folders had been left behind in the old personal-
// Drive tree from before the service-account Shared Drive migration. Reuses
// lib/google/drive.ts getOrCreateClientFolder(), same as every other Drive
// write path in the app. Left disabled rather than deleted (file deletion
// isn't permitted in this environment's mount).
import { NextRequest } from "next/server";
import { apiError } from "@/lib/utils";

export async function POST(_req: NextRequest) {
  return apiError("This one-off admin utility has been retired.", 410);
}
