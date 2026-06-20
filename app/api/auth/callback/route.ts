// /api/auth/callback
// 1. Supabase OAuth login  (code param)
// 2. Google OAuth tokens   (google_code param)
//
// @supabase/ssr 0.3.0 createServerClient reads cookies via cookies.get(name),
// not cookies.getAll(). We must supply get + set so the PKCE verifier can be
// found, and write the new session tokens directly onto the redirect response.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeAndSaveTokens } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  // ── 1. Google OAuth token exchange (state=google_connect) ───────────────
  const state = searchParams.get("state");
  if (state === "google_connect") {
    const googleCode = searchParams.get("code");
    if (!googleCode) {
      return NextResponse.redirect(`${appUrl}/settings?google=error&reason=no_code`);
    }
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`);
    }
    try {
      await exchangeCodeAndSaveTokens(googleCode, user.id);
      return NextResponse.redirect(`${appUrl}/settings?google=connected`);
    } catch (err: any) {
      console.error("[api/auth/callback] Google token error:", err.message);
      return NextResponse.redirect(`${appUrl}/settings?google=error&reason=${encodeURIComponent(err.message)}`);
    }
  }

  // ── 2. Supabase OAuth login ───────────────────────────────────────────────
  const supabaseCode = searchParams.get("code");
  if (supabaseCode) {
    const successResponse = NextResponse.redirect(`${appUrl}/`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            req.cookies.set(name, value);
            successResponse.cookies.set(name, value, options as any);
          },
          remove(name: string, options: Record<string, unknown>) {
            req.cookies.set(name, "");
            successResponse.cookies.set(name, "", { ...options as any, maxAge: 0 });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(supabaseCode);

    if (error) {
      console.error("[api/auth/callback] exchange error:", error.message);
      return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
    }

    return successResponse;
  }

  // ── 3. Handle Google OAuth error (user denied) ───────────────────────────
  const oauthError = searchParams.get("error");
  if (oauthError) {
    console.warn("[api/auth/callback] Google OAuth denied:", oauthError);
    return NextResponse.redirect(`${appUrl}/settings?google=denied`);
  }

  return NextResponse.redirect(`${appUrl}/`);
}
