import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { clientId, userId, bookingId } = await req.json();
  if (!clientId || !userId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify the caller is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  // Assign owner_id to claim the client
  const { error: clientErr } = await admin
    .from("clients")
    .update({ owner_id: userId })
    .eq("id", clientId);

  if (clientErr) {
    console.error("Accept enquiry error:", clientErr);
    return NextResponse.json({ error: "Failed to accept" }, { status: 500 });
  }

  // Update booking status from INQUIRY to PENDING
  if (bookingId) {
    await admin
      .from("bookings")
      .update({ status: "PENDING" })
      .eq("id", bookingId);
  }

  return NextResponse.json({ success: true });
}
