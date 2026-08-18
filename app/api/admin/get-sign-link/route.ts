// app/api/admin/get-sign-link/route.ts
// RETIRED — one-off diagnostic (2026-08-14) used to test the live e-signature
// flow at /sign/[token] end-to-end (mint a token without emailing, view the
// page, verify canvas drawing + the new "Resend Signing Link" button, then
// revert) while investigating a client report of being unable to sign. Left
// disabled rather than deleted (file deletion isn't permitted in this
// environment's mount).
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "This diagnostic route has been retired." },
    { status: 410 }
  );
}
