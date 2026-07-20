// POST /api/admin/migrate-drive-folders
// RETIRED — this was a one-time migration that moved client folders from
//   JNguyen Co. CRM / [Client Name] /            (personal "My Drive")
// into
//   JNguyen Co. CRM / Clients / YYYY / Month / [Client Name] /
//
// It required full OAuth Drive access to the owner's *personal* My Drive.
// That scope was removed (2026-07) so the app only needs to request
// gmail.send + calendar.events during Google sign-in — both are "sensitive"
// scopes with free/fast verification, instead of the "restricted" full-Drive
// scope which requires a paid annual CASA security assessment to verify.
//
// All ongoing Drive writes go through the service account
// (lib/google/drive.ts getOrCreateClientFolder / uploadToDriveFolder), which
// only has access to the Shared Drive it was granted, not personal My Drive.
// If you still have old client folders sitting loose in your personal Drive
// from before this migration ran, move them manually in the Drive UI, or ask
// to have this restored temporarily (it would need the old Drive OAuth scope
// reconnected first).
import { NextRequest } from "next/server";
import { apiError } from "@/lib/utils";

export async function POST(_req: NextRequest) {
    return apiError(
          "This one-time migration has been retired now that the app no longer requests full Drive OAuth access (it required reaching into personal My Drive, which the service account can't do). See the comment at the top of this file for details.",
          410
        );
}
