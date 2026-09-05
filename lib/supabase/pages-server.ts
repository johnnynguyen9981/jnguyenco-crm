// Server-side Supabase client for Pages Router API routes (pages/api/**).
//
// Exists only for handlers that must avoid the App Router's module graph —
// see pages/api/bookings/[id]/contractors/[assignmentId]/call-sheet.ts for
// why. next/headers' cookies() (used by lib/supabase/server.ts) is an App
// Router-only API and throws outside it, so this reads/writes cookies via
// the plain req/res API Pages Router handlers get instead.
//
// Read-only in practice: middleware.ts already calls supabase.auth.getUser()
// on every request (refreshing the session cookie there if needed), so by
// the time a Pages API handler runs there's nothing left for it to persist.
// set/remove are no-ops, matching how lib/supabase/server.ts already treats
// "can't set a cookie here" as safe to ignore in Server Components.
import { createServerClient } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

function stripBOM(s: string | undefined): string {
  if (!s) return "";
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export function createPagesClient(req: NextApiRequest, _res: NextApiResponse) {
  return createServerClient(
    stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL),
    stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set() {
          // no-op — see file header
        },
        remove() {
          // no-op — see file header
        },
      },
    }
  );
}
