// Server-side Supabase client
// Use in Server Components, API Routes, Server Actions
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @supabase/ssr 0.3.0 calls cookies.get(name) internally (not getAll).
        // We must provide get/set/remove so chunked session cookies are found.
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set(name, value, options as any);
          } catch {
            // Server Components cannot set cookies — safe to ignore
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set(name, "", { ...options as any, maxAge: 0 });
          } catch {
            // Server Components cannot set cookies — safe to ignore
          }
        },
      },
    }
  );
}

// Service-role client — bypasses RLS. Use only in trusted server contexts.
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
