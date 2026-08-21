// GET /api/admin/add-hybrid-mini-session
// One-time: inserts "Hybrid Mini Session" + "Hybrid Mini Session — Extended" packages
// under WEDDING / ELOPEMENT (photo + video bundle, matches live jnguyen.co/services listing).
// Idempotent: if these already exist (e.g. from an earlier run under PORTRAIT), this
// updates them in place to service_type WEDDING instead of inserting duplicates.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const PACKAGES = [
  {
    name: "Hybrid Mini Session",
    service_type: "WEDDING",
    base_price: 375,
    max_hours: 2, // stored as integer (DB constraint); actual duration is 1.5 hrs — see description
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
    service_type: "WEDDING",
    base_price: 625,
    max_hours: 3, // stored as integer (DB constraint); actual duration is 2.5 hrs — see description
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
    .select("id, name")
    .in("name", PACKAGES.map((p) => p.name));

  const existingByName = new Map((existing ?? []).map((p) => [p.name, p.id]));

  const toInsert = PACKAGES.filter((p) => !existingByName.has(p.name));
  const toUpdate = PACKAGES.filter((p) => existingByName.has(p.name));

  const results: any[] = [];

  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await admin
      .from("packages")
      .insert(toInsert)
      .select("id, name, base_price, service_type");

    if (insertErr) {
      return NextResponse.json({ error: "Insert failed: " + insertErr.message }, { status: 500 });
    }
    results.push(...(inserted ?? []));
  }

  for (const pkg of toUpdate) {
    const id = existingByName.get(pkg.name)!;
    const { name, ...fields } = pkg;
    const { data: updated, error: updateErr } = await admin
      .from("packages")
      .update(fields)
      .eq("id", id)
      .select("id, name, base_price, service_type");

    if (updateErr) {
      return NextResponse.json({ error: `Update failed for ${name}: ` + updateErr.message }, { status: 500 });
    }
    results.push(...(updated ?? []));
  }

  return NextResponse.json({ success: true, packages: results });
}
