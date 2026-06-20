// GET /api/admin/seed-portrait-packages
// One-time route: deletes old portrait packages and inserts correct hourly ones.
// Visit this URL once in the browser while logged in, then you can delete this file.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const PORTRAIT_PACKAGES = [
  {
    name: "Headshot Session",
    service_type: "PORTRAIT",
    base_price: 150,
    includes_photography: true,
    includes_videography: false,
    description: "Professional headshot session from 1 hour at $150/hr. 20–40 edited images delivered via online gallery.",
    is_active: true,
  },
  {
    name: "Couples Portrait",
    service_type: "PORTRAIT",
    base_price: 150,
    includes_photography: true,
    includes_videography: false,
    description: "Romantic couples or engagement session from 1 hour at $150/hr. 40–80 edited images delivered via online gallery.",
    is_active: true,
  },
  {
    name: "Family Portrait",
    service_type: "PORTRAIT",
    base_price: 150,
    includes_photography: true,
    includes_videography: false,
    description: "Family portrait session from 1 hour at $150/hr. 40–80 edited images delivered via online gallery.",
    is_active: true,
  },
  {
    name: "Newborn / Maternity",
    service_type: "PORTRAIT",
    base_price: 150,
    includes_photography: true,
    includes_videography: false,
    description: "Gentle newborn or maternity session from 1 hour at $150/hr. 30–60 edited images delivered via online gallery.",
    is_active: true,
  },
];

export async function GET() {
  // Must be signed in
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Remove any existing portrait packages
  const { error: deleteErr } = await admin
    .from("packages")
    .delete()
    .eq("service_type", "PORTRAIT");

  if (deleteErr) {
    return NextResponse.json({ error: "Delete failed: " + deleteErr.message }, { status: 500 });
  }

  // Insert fresh portrait packages (minimal columns only)
  const { data, error: insertErr } = await admin
    .from("packages")
    .insert(PORTRAIT_PACKAGES)
    .select("id, name, base_price, service_type, is_active");

  if (insertErr) {
    return NextResponse.json({ error: "Insert failed: " + insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Portrait packages seeded successfully.",
    packages: data,
  });
}
