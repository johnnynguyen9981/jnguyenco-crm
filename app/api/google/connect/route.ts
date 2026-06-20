// GET /api/google/connect
// Redirects authenticated user to the Google consent screen
// to grant Gmail + Calendar access.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/auth";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Build auth URL — Google will redirect back to /api/auth/callback?google_code=...
  const authUrl = getGoogleAuthUrl();
  // Modify the redirect_uri to pass google_code instead of code
  const url = new URL(authUrl);
  url.searchParams.set(
    "redirect_uri",
    `${process.env.GOOGLE_REDIRECT_URI ?? `${appUrl}/api/auth/callback`}`
  );

  return NextResponse.redirect(url.toString());
}
