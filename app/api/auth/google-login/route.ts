// POST /api/auth/google-login
// Initiates the Supabase Google OAuth flow for initial login.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
    const supabase = await createClient();
    // Always use the actual request origin for the OAuth redirect.
  // This makes auth work correctly in Electron, local dev, and Vercel.
  const { origin } = new URL(_req.url);
    const appUrl = origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
                redirectTo: `${appUrl}/api/auth/callback`,
                scopes:     "email profile",
                // Force Google account picker every time — prevents auto-login with old Gmail
                queryParams: { prompt: "select_account" },
        },
  });

  if (error || !data.url) {
        return NextResponse.redirect(`${appUrl}/login?error=oauth_start_failed`);
  }

  return NextResponse.redirect(data.url);
}
