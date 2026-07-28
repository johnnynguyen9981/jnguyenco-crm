// GET /api/admin/add-package-fields — one-time migration.
// Adds team/deliverables/timeline columns to packages, then populates
// them for every existing package so the contract generator can read
// real deliverable/timeline/team data straight from the DB.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const UPDATES: {
  id: string;
  team: string;
  deliverables: string[];
  timeline: string[];
}[] = [
  {
    id: "ec509d10-999c-4dea-8392-b49c7c0df39a", // Mini Wedding / Elopement
    team: "1 Photographer & 1 Videographer",
    deliverables: [
      "200–350 professionally edited high-resolution images",
      "3–5 minute cinematic highlight film",
      "Next-day teaser (30–60 sec vertical reel for social media)",
      "Full ceremony coverage",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Teaser reel — within 24–48 hours after the event",
      "Photo gallery (200–350 images) — within 4 weeks after the event",
      "Highlight film (3–5 min) — within 6 weeks after the event",
    ],
  },
  {
    id: "f3fca969-6a4d-498a-ac39-ee233c32040e", // Full Day - Essential
    team: "1 Photographer & 1 Videographer",
    deliverables: [
      "400–600 professionally edited high-resolution images",
      "5–7 minute cinematic highlight film",
      "Next-day teaser (30–60 sec vertical reel for social media)",
      "Full ceremony & reception coverage",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Teaser reel — within 24–48 hours after the event",
      "Photo gallery (400–600 images) — within 6 weeks after the event",
      "Highlight film (5–7 min) — within 8 weeks after the event",
    ],
  },
  {
    id: "bd3fe105-a491-41ac-8abc-f6a5b628bf9e", // Full Day - Premium
    team: "2 Photographers & 2 Videographers",
    deliverables: [
      "700–1,000 professionally edited high-resolution images",
      "6–8 minute cinematic film",
      "Next-day teaser (30–60 sec vertical reel for social media)",
      "Full ceremony, speeches & reception coverage",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Teaser reel — within 24–48 hours after the event",
      "Photo gallery (700–1,000 images) — within 6 weeks after the event",
      "Highlight film (6–8 min) — within 8 weeks after the event",
    ],
  },
  {
    id: "5d92a48d-876d-4d9a-a8de-9ffae0a06214", // Event Photography Only
    team: "1 Photographer",
    deliverables: [
      "60+ professionally edited high-resolution images per hour",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Photo gallery (60+ images per hour) — within 4–8 weeks after the event",
    ],
  },
  {
    id: "4154c8fd-b599-4673-ab92-a25869936bf6", // Event Photography & Videography
    team: "1 Photographer & 1 Videographer",
    deliverables: [
      "60+ professionally edited high-resolution images per hour",
      "2–3 minute cinematic event highlight reel",
      "Full event video coverage",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Photo gallery (60+ images per hour) — within 4–8 weeks after the event",
      "Event highlight reel (2–3 min) + full event video — within 4–8 weeks after the event",
    ],
  },
  {
    id: "65595c54-c5f3-4681-b183-eb3b4b108cd7", // Event Videography Add-on (inactive, kept in sync)
    team: "1 Videographer",
    deliverables: [
      "Add-on videography for an event already booked for photography",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Video delivered — within 4–8 weeks after the event",
    ],
  },
  {
    id: "2fcccb52-069c-4bc3-940d-1c15ab4c366b", // Headshot Session
    team: "1 Photographer",
    deliverables: [
      "20–40 professionally edited high-resolution images",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Edited photo gallery — within 4–8 weeks after the session",
    ],
  },
  {
    id: "47c33615-a5e1-4153-9b14-672065e4ba14", // Newborn / Maternity
    team: "1 Photographer",
    deliverables: [
      "30–60 professionally edited high-resolution images",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Edited photo gallery — within 4–8 weeks after the session",
    ],
  },
  {
    id: "a92567fb-a2aa-48ce-b81d-5f0c84c2aced", // Family Portrait
    team: "1 Photographer",
    deliverables: [
      "40–80 professionally edited high-resolution images",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Edited photo gallery — within 4–8 weeks after the session",
    ],
  },
  {
    id: "9f9c3323-1a23-4105-af02-03987f745386", // Couples Portrait
    team: "1 Photographer",
    deliverables: [
      "40–80 professionally edited high-resolution images",
      "Online gallery delivery via Google Drive (download link)",
    ],
    timeline: [
      "Edited photo gallery — within 4–8 weeks after the session",
    ],
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

  const alterSql = `
    ALTER TABLE packages
      ADD COLUMN IF NOT EXISTS team text,
      ADD COLUMN IF NOT EXISTS deliverables text[],
      ADD COLUMN IF NOT EXISTS timeline text[];
  `;

  const { error: alterErr } = await admin.rpc("exec_sql", { sql: alterSql });
  if (alterErr) {
    return NextResponse.json(
      { success: false, step: "alter_table", error: alterErr.message },
      { status: 500 }
    );
  }

  const results: Record<string, any> = {};
  for (const u of UPDATES) {
    const { data, error } = await admin
      .from("packages")
      .update({ team: u.team, deliverables: u.deliverables, timeline: u.timeline })
      .eq("id", u.id)
      .select("id, name, team, deliverables, timeline");
    results[u.id] = error ? "FAILED: " + error.message : data;
  }

  return NextResponse.json({ success: true, results });
}
