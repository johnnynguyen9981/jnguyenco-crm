// POST /api/auth/google-login
// Initiates the Supabase Google OAuth flow for initial login.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/api/auth/callback`,
      scopes:     "email profile",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_start_failed`);
  }

  return NextResponse.redirect(data.url);
}
