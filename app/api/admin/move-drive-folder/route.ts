// POST /api/admin/move-drive-folder
// RETIRED — this was a one-time manual fix (2026-08-14) to relocate three
// misplaced client Drive folders (Thi Hai Ly Le, Anna Marcus Boles,
// Christina Juyeon Lee) within the Shared Drive, using the service account
// (which correctly supports Shared Drive item moves via
// addParents/removeParents + supportsAllDrives, unlike generic Drive
// connector tools). NOTE: this cannot move a folder from My Drive into a
// Shared Drive -- the Drive API rejects that outright ("Moving folders into
// shared drives is not supported"), so it does not help with the
// Jessica Vo / Chloe Mackrell personal-Drive folders; that would need a
// recursive copy-then-delete migration instead. Left disabled rather than
// deleted (file deletion isn't permitted in this environment's mount).
import { NextRequest } from "next/server";
import { apiError } from "@/lib/utils";

export async function POST(_req: NextRequest) {
  return apiError("This one-off admin utility has been retired.", 410);
}
