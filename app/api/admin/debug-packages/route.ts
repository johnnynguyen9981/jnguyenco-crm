import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // No filters — return everything
  const { data, error } = await admin
    .from("packages")
    .select("id, name, service_type, base_price, is_active")
    .order("service_type");

  return NextResponse.json({ error: error?.message ?? null, count: data?.length ?? 0, packages: data });
}
