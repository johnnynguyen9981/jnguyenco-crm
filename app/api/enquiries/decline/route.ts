import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  // Delete bookings first (FK constraint), then the client
  await admin.from("bookings").delete().eq("client_id", clientId);
  const { error } = await admin.from("clients").delete().eq("id", clientId).is("owner_id", null);

  if (error) {
    console.error("Decline enquiry error:", error);
    return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
