// GET /api/admin/debug-env — TEMPORARY diagnostic route.
// Checks whether key Supabase env vars have a stray leading BOM
// (U+FEFF, charCode 65279) or other invisible characters, which breaks
// fetch() header construction ("Cannot convert argument to a ByteString...").
// DELETE THIS ROUTE after the investigation is done.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function inspect(name: string, val: string | undefined) {
  if (val == null) return { name, present: false };
  return {
    name,
    present: true,
    length: val.length,
    firstCharCode: val.charCodeAt(0),
    lastCharCode: val.charCodeAt(val.length - 1),
    first10: JSON.stringify(val.slice(0, 10)),
    last10: JSON.stringify(val.slice(-10)),
    hasBOM: val.charCodeAt(0) === 0xfeff,
    trimmedLength: val.trim().length,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = [
    inspect("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    inspect("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    inspect("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  ];

  return NextResponse.json({ report });
}
