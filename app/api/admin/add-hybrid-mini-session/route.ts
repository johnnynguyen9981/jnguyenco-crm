// GET /api/admin/add-hybrid-mini-session
// One-time: inserts "Hybrid Mini Session" + "Hybrid Mini Session — Extended" packages
// (PORTRAIT category, photo + video bundle, matches live jnguyen.co/services listing).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const PACKAGES = [
  {
    name: "Hybrid Mini Session",
    service_type: "PORTRAIT",
    base_price: 375,
    max_hours: 1.5,
    hourly_rate: 250,
    includes_photography: true,
    includes_videography: true,
    photo_count_min: 40,
    photo_count_max: 60,
    description:
      "Portrait + video reel bundle — 1.5 hours · 40–60 professionally edited hi-res images · " +
      "30-second vertical reel (Instagram/TikTok-ready, colour-graded to match wedding aesthetic) · " +
      "Photos delivered in 5–7 business days · Reel delivered in 48 hours. " +
      "Positioned as a portrait + video bundle (effectively $250/hr), not a plain rate increase over the $230/hr portrait rate.",
    team: "1 Photographer & 1 Videographer",
    deliverables: [
      "40-60 professionally edited hi-res images",
      "30-second vertical reel (Instagram/TikTok-ready)",
    ],
    timeline: [
      "Photos — 5-7 business days after the session",
      "Reel — 48 hours after the session",
    ],
    is_active: true,
  },
  {
    name: "Hybrid Mini Session — Extended",
    service_type: "PORTRAIT",
    base_price: 625,
    max_hours: 2.5,
    hourly_rate: 250,
    includes_photography: true,
    includes_videography: true,
    photo_count_min: 80,
    photo_count_max: 100,
    description:
      "Extended portrait + video reel bundle — 2.5 hours · 80–100 professionally edited hi-res images · " +
      "30-second reel + 1 additional 60-second \"story cut\" · " +
      "Photos delivered in 5–7 business days · Reel delivered in 48 hours.",
    team: "1 Photographer & 1 Videographer",
    deliverables: [
      "80-100 professionally edited hi-res images",
      "30-second reel + 1 additional 60-second story cut",
    ],
    timeline: [
      "Photos — 5-7 business days after the session",
      "Reel — 48 hours after the session",
    ],
    is_active: true,
  },
];

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

  const { data: existing } = await admin
    .from("packages")
    .select("name")
    .in("name", PACKAGES.map((p) => p.name));

  const existingNames = new Set((existing ?? []).map((p) => p.name));
  const toInsert = PACKAGES.filter((p) => !existingNames.has(p.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ success: true, message: "Already exists" });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("packages")
    .insert(toInsert)
    .select("id, name, base_price, service_type");

  if (insertErr) {
    return NextResponse.json({ error: "Insert failed: " + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, packages: inserted });
}
