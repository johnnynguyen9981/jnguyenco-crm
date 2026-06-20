// GET /api/admin/fix-package-service-types
// One-time fix: assigns correct service_type to packages that have null/wrong service_type.
// Visit this URL once while logged in, then you can delete this file.
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

  // Fetch all packages so we can inspect them
  const { data: allPkgs, error: fetchErr } = await admin
    .from("packages")
    .select("id, name, service_type");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const updates: { id: string; name: string; old: string | null; new: string }[] = [];

  for (const pkg of allPkgs ?? []) {
    const n = (pkg.name ?? "").toLowerCase();
    let correctType: string | null = null;

    if (n.includes("wedding") || n.includes("elopement") || n.includes("essential") || n.includes("premium") || n.includes("full day") || n.includes("mini")) {
      correctType = "WEDDING";
    } else if (n.includes("headshot") || n.includes("couples") || n.includes("family") || n.includes("newborn") || n.includes("maternity") || n.includes("portrait")) {
      correctType = "PORTRAIT";
    } else if (n.includes("event") || n.includes("birthday") || n.includes("baptism") || n.includes("party") || n.includes("hourly") || n.includes("combo")) {
      correctType = "EVENT";
    }

    if (correctType && pkg.service_type !== correctType) {
      updates.push({ id: pkg.id, name: pkg.name, old: pkg.service_type, new: correctType });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({
      success: true,
      message: "All packages already have correct service_type — nothing to update.",
      all_packages: allPkgs,
    });
  }

  // Apply updates
  const results = await Promise.all(
    updates.map(u =>
      admin.from("packages").update({ service_type: u.new }).eq("id", u.id)
        .then(({ error }) => ({ ...u, ok: !error, error: error?.message }))
    )
  );

  return NextResponse.json({
    success: true,
    message: `Updated ${results.filter(r => r.ok).length} packages.`,
    updates: results,
    all_packages: allPkgs,
  });
}
