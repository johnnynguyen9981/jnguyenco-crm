// POST /api/auth/google-login
// Initiates the Supabase Google OAuth flow for initial login.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  return handler(_req);
}

export async function POST(_req: NextRequest) {
  return handler(_req);
}

async function handler(_req: NextRequest) {
    const supabase = await createClient();
    // Always use the actual request origin for the OAuth redirect.
  // This makes auth work correctly in Electron, local dev, and Vercel.
  const host  = _req.headers.get("x-forwarded-host") ?? _req.headers.get("host") ?? "jnguyenco-crm.vercel.app";
  // No x-forwarded-proto means no reverse proxy in front (Vercel always sets
  // it) — i.e. local dev or the Electron desktop app talking to its own
  // localhost server over plain HTTP, never HTTPS.
  const proto = _req.headers.get("x-forwarded-proto") ?? "http";
  const appUrl = `${proto}://${host}`;

  const redirectTo = `${appUrl}/api/auth/callback`;
  console.log("[google-login] host:", host, "proto:", proto, "redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
                redirectTo,
                scopes:     "email profile",
                // Force Google account picker every time — prevents auto-login with old Gmail
                queryParams: { prompt: "select_account" },
        },
  });

  if (error || !data.url) {
        console.log("[google-login] signInWithOAuth failed:", error?.message);
        return NextResponse.redirect(`${appUrl}/login?error=oauth_start_failed`);
  }

  console.log("[google-login] redirecting to Google:", data.url);
  return NextResponse.redirect(data.url);
}
