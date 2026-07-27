// GET /api/admin/fix-pricing-2026 — one-time price correction.
// Brings Event + Portrait package pricing in line with current rate card:
//   - Event Photography Only:            $200/hr (was $150/hr)
//   - Event Photography & Videography:    $350/hr (was $250/hr)
//   - Event Videography Add-on:           $150/hr (re-created — was deleted)
//   - All Portrait session packages:      $200/hr (was $150/hr)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, any> = {};

  // 1. Event Photography Only: $200/hr
  const r1 = await admin.from("packages")
    .update({ base_price: 200 })
    .eq("id", "5d92a48d-876d-4d9a-a8de-9ffae0a06214")
    .select("id, name, base_price");
  results.event_photo_only = r1.error ? "FAILED: " + r1.error.message : r1.data;

  // 2. Event Photography & Videography: $350/hr
  const r2 = await admin.from("packages")
    .update({ base_price: 350 })
    .eq("id", "4154c8fd-b599-4673-ab92-a25869936bf6")
    .select("id, name, base_price");
  results.event_photo_video = r2.error ? "FAILED: " + r2.error.message : r2.data;

  // 3. All Portrait packages -> $200/hr, and fix stale "$150/hr" text in descriptions
  const { data: portraitPkgs } = await admin
    .from("packages")
    .select("id, description")
    .eq("service_type", "PORTRAIT");

  const portraitResults: any[] = [];
  for (const pkg of portraitPkgs ?? []) {
    const newDesc = (pkg.description ?? "").replace(/\$150\/hr/g, "$200/hr");
    const { data, error } = await admin
      .from("packages")
      .update({ base_price: 200, description: newDesc })
      .eq("id", pkg.id)
      .select("id, name, base_price, description");
    portraitResults.push(error ? "FAILED: " + error.message : data);
  }
  results.portrait_packages = portraitResults;

  // 4. Re-create "Event Videography Add-on" ($150/hr) — was previously deleted
  const { data: existingAddon } = await admin
    .from("packages")
    .select("id")
    .eq("name", "Event Videography Add-on")
    .maybeSingle();

  if (existingAddon) {
    const r4 = await admin.from("packages")
      .update({
        base_price: 150,
        is_active: true,
        description: "Add-on videography for an event already booked for photography. $150/hr, on top of the photography rate.",
      })
      .eq("id", existingAddon.id)
      .select("id, name, base_price");
    results.videography_addon = r4.error ? "FAILED: " + r4.error.message : r4.data;
  } else {
    const r4 = await admin.from("packages")
      .insert({
        name: "Event Videography Add-on",
        service_type: "EVENT",
        base_price: 150,
        includes_photography: false,
        includes_videography: true,
        description: "Add-on videography for an event already booked for photography. $150/hr, on top of the photography rate.",
        is_active: true,
      })
      .select("id, name, base_price, service_type");
    results.videography_addon = r4.error ? "FAILED: " + r4.error.message : r4.data;
  }

  return NextResponse.json({ success: true, results });
}
