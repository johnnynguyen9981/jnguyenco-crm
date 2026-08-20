// GET /api/admin/update-package-prices — one-time price update
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: { name: string; ok: boolean; error?: string }[] = [];

  // 1. Event Photography Only: $230/hr (unchanged — already matches jnguyen.co)
  const r1 = await admin.from("packages")
    .update({ base_price: 230, description: "60+ professionally edited images per hour · Online gallery delivery · 4–8 week turnaround" })
    .eq("id", "5d92a48d-876d-4d9a-a8de-9ffae0a06214");
  results.push({ name: "Event Photography Only", ok: !r1.error, error: r1.error?.message });

  // 2. Event Photography & Videography: $425/hr (was $450/hr — corrected to match jnguyen.co/services)
  const r2 = await admin.from("packages")
    .update({ base_price: 425, description: "50–80 professionally edited images per hour + 1–2 min highlight reel per hour · Online gallery delivery · 4–8 week turnaround" })
    .eq("id", "4154c8fd-b599-4673-ab92-a25869936bf6");
  results.push({ name: "Event Photography & Videography", ok: !r2.error, error: r2.error?.message });

  // 3. Portrait packages (Couples/Family/Newborn etc, excluding Headshot which is a flat
  //    $375 session, not hourly): $250/hr (was $200/hr — corrected to match jnguyen.co/services)
  const r3 = await admin.from("packages")
    .update({ base_price: 250 })
    .eq("service_type", "PORTRAIT")
    .neq("name", "Headshot Session");
  results.push({ name: "Portrait packages (excl. Headshot)", ok: !r3.error, error: r3.error?.message });

  // 4. Headshot Session: flat $375 (confirmed correct value; re-asserted here so a future
  //    re-run of this route can never regress it back toward the old $200/hr portrait rate)
  const r4 = await admin.from("packages")
    .update({ base_price: 375 })
    .eq("service_type", "PORTRAIT")
    .eq("name", "Headshot Session");
  results.push({ name: "Headshot Session", ok: !r4.error, error: r4.error?.message });

  return NextResponse.json({ success: true, results });
}
