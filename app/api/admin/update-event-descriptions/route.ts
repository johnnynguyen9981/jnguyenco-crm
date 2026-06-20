// GET /api/admin/update-event-descriptions — one-time update
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

  const updates = [
    {
      id: "5d92a48d-876d-4d9a-a8de-9ffae0a06214",
      description: "60+ professionally edited images per hour · Online gallery delivery · 4–8 week turnaround",
    },
    {
      id: "4154c8fd-b599-4673-ab92-a25869936bf6",
      description: "60+ professionally edited images per hour · 2–3 min highlight reel + full event video · Online gallery delivery · 4–8 week turnaround",
    },
  ];

  const results = await Promise.all(
    updates.map(u =>
      admin.from("packages").update({ description: u.description }).eq("id", u.id)
        .then(({ error }) => ({ id: u.id, ok: !error, error: error?.message }))
    )
  );

  return NextResponse.json({ success: true, results });
}
