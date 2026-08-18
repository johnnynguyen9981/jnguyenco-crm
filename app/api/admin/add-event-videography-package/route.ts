// GET /api/admin/add-event-videography-package
// One-time: inserts "Event Videography Only" package (EVENT category, videography-only, hourly).
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

  // Skip if it already exists
  const { data: existing } = await admin
    .from("packages")
    .select("id")
    .eq("name", "Event Videography Only")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, message: "Already exists", package: existing });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("packages")
    .insert({
      name: "Event Videography Only",
      service_type: "EVENT",
      base_price: 280,
      includes_photography: false,
      includes_videography: true,
      description: "1–2 min highlight reel per hour of coverage · Online gallery delivery · 6–8 week turnaround",
      team: "1 Videographer",
      deliverables: [
        "1-2 minute highlight reel per hour of coverage",
        "Online gallery delivery via Google Drive",
      ],
      timeline: ["Highlight reel — within 6-8 weeks after the event"],
      is_active: true,
    })
    .select("id, name, base_price, service_type");

  if (insertErr) {
    return NextResponse.json({ error: "Insert failed: " + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, package: inserted });
}
