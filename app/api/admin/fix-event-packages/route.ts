// GET /api/admin/fix-event-packages
// One-time: renames photography package, adds combo, removes video add-on.
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

  // 1. Rename "Event Photography (Hourly)" → "Event Photography Only"
  const { error: renameErr } = await admin
    .from("packages")
    .update({ name: "Event Photography Only", description: "Hourly photography for events (birthdays, baptisms, parties). $150/hr." })
    .eq("id", "5d92a48d-876d-4d9a-a8de-9ffae0a06214");
  results.rename = renameErr ? "FAILED: " + renameErr.message : "OK";

  // 2. Delete "Event Videography Add-on"
  const { error: deleteErr } = await admin
    .from("packages")
    .delete()
    .eq("id", "23fe90ac-7147-459d-8397-5170e070f319");
  results.delete_addon = deleteErr ? "FAILED: " + deleteErr.message : "OK";

  // 3. Insert "Event Photography & Videography" combo at $250/hr
  const { data: inserted, error: insertErr } = await admin
    .from("packages")
    .insert({
      name: "Event Photography & Videography",
      service_type: "EVENT",
      base_price: 250,
      includes_photography: true,
      includes_videography: true,
      description: "Combined photography and videography for events. $250/hr.",
      is_active: true,
    })
    .select("id, name, base_price, service_type");
  results.insert_combo = insertErr ? "FAILED: " + insertErr.message : inserted;

  return NextResponse.json({ success: true, results });
}
