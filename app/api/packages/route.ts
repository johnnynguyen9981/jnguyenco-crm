// GET /api/packages — returns all active packages, optionally filtered by service_type.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  // Auth check — user must be signed in
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to bypass RLS — packages are global shared data, not per-user
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get("service_type");

  let query = admin
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("base_price", { ascending: true });

  if (serviceType) query = query.eq("service_type", serviceType);

  const { data: packages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ packages });
}
