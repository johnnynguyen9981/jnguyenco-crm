// POST /api/auth/google-login
// Initiates the Supabase Google OAuth flow for initial login.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
    const supabase = await createClient();
    // Always use the actual request origin for the OAuth redirect.
  // This makes auth work correctly in Electron, local dev, and Vercel.
  const host  = _req.headers.get("x-forwarded-host") ?? _req.headers.get("host") ?? "jnguyenco-crm.vercel.app";
  const proto = _req.headers.get("x-forwarded-proto") ?? "https";
  const appUrl = `${proto}://${host}`;

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
