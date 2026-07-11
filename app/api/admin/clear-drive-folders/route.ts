import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("clients")
    .update({ gdrive_folder_id: null })
    .not("gdrive_folder_id", "is", null)
    .select("id, first_name, last_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cleared: data?.length ?? 0, clients: data });
}
