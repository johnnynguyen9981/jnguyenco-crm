// app/api/admin/debug-drive-env/route.ts
// RETIRED — this was a temporary diagnostic route for troubleshooting Drive env
// var parsing. It had NO authentication check and leaked environment variable
// presence/lengths, BOM status, and the Vercel deploy commit SHA to anyone who
// hit the URL — an information-disclosure risk on the live deployed app.
//
// Left disabled rather than deleted (file deletion isn't permitted in this
// environment's mount). If Drive env vars need debugging again, recreate this
// with a founder-role check (see lib/team.ts `isCurrentUserFounder()`) and
// remove it again once done.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "This diagnostic route has been retired for security reasons (was unauthenticated)." },
    { status: 410 }
  );
}
