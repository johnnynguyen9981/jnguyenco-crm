// GET /api/google/callback
// Dedicated callback for the Google OAuth2 flow (Gmail + Calendar).
// Google redirects here with ?code=... after the user grants permission.
// This is separate from /api/auth/callback which handles Supabase login.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeAndSaveTokens } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  const oauthError = searchParams.get("error");
  if (oauthError) {
    console.warn("[google/callback] OAuth denied:", oauthError);
    return NextResponse.redirect(`${appUrl}/settings?google=denied`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?google=error&reason=no_code`);
  }

  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`);
  }

  try {
    await exchangeCodeAndSaveTokens(code, user.id);
    return NextResponse.redirect(`${appUrl}/settings?google=connected`);
  } catch (err: any) {
    console.error("[google/callback] Token exchange error:", err.message);
    return NextResponse.redirect(`${appUrl}/settings?google=error&reason=${encodeURIComponent(err.message)}`);
  }
}
