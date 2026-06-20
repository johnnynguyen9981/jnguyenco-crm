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

  // 1. Event Photography Only: $200/hr
  const r1 = await admin.from("packages")
    .update({ base_price: 200, description: "60+ professionally edited images per hour · Online gallery delivery · 4–8 week turnaround" })
    .eq("id", "5d92a48d-876d-4d9a-a8de-9ffae0a06214");
  results.push({ name: "Event Photography Only", ok: !r1.error, error: r1.error?.message });

  // 2. Event Photography & Videography: $350/hr
  const r2 = await admin.from("packages")
    .update({ base_price: 350, description: "60+ professionally edited images per hour · 2–3 min highlight reel + full event video · Online gallery delivery · 4–8 week turnaround" })
    .eq("id", "4154c8fd-b599-4673-ab92-a25869936bf6");
  results.push({ name: "Event Photography & Videography", ok: !r2.error, error: r2.error?.message });

  // 3. All portrait packages: $200/hr (update by service_type = PORTRAIT)
  const r3 = await admin.from("packages")
    .update({ base_price: 200 })
    .eq("service_type", "PORTRAIT");
  results.push({ name: "Portrait packages (all)", ok: !r3.error, error: r3.error?.message });

  return NextResponse.json({ success: true, results });
}
