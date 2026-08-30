// GET  /api/packages/[id] — fetch a single package (any status)
// PATCH /api/packages/[id] — update a package's fields
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isCurrentUserFounder } from "@/lib/team";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data: pkg, error } = await admin
    .from("packages")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ package: pkg });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Package pricing/config is founder-only — GET is shared with staff (they
  // need it for bookings) but writes are not. This uses the service-role
  // client below, which bypasses RLS, so this check is the only thing
  // stopping a logged-in staff account from editing pricing directly.
  if (!(await isCurrentUserFounder())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const allowedFields = [
    "name", "base_price", "max_hours", "hourly_rate",
    "includes_photography", "includes_videography",
    "photo_count_min", "photo_count_max",
    "film_duration_min_sec", "film_duration_max_sec",
    "description", "team", "deliverables", "timeline", "is_active",
  ] as const;

  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from("packages")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ package: data });
}
