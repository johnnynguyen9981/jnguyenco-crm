// app/api/admin/clear-drive-folders/route.ts
// RETIRED — this was a one-off admin utility to bulk-clear clients.gdrive_folder_id
// (e.g. to force folders to be rebuilt). It had NO authentication check and used
// the Supabase service-role key, meaning anyone who discovered the URL could wipe
// every client's Drive folder pointer on the live deployed app with a single POST.
//
// Left disabled rather than deleted (file deletion isn't permitted in this
// environment's mount). If this utility is needed again, recreate it with a
// founder-role check (see lib/team.ts `isCurrentUserFounder()`) before re-enabling.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This admin route has been retired for security reasons (was unauthenticated)." },
    { status: 410 }
  );
}
