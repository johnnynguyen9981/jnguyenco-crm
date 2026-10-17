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

  // Only unaccepted enquiries (no owner yet) can be declined. Check first: previously the
  // bookings were deleted before this check, so declining an already-accepted client would
  // wipe their bookings while keeping the client.
  const { data: enquiry, error: lookupErr } = await admin
    .from("clients")
    .select("id, owner_id")
    .eq("id", clientId)
    .maybeSingle();

  if (lookupErr) {
    console.error("Decline enquiry lookup error:", lookupErr);
    return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
  }
  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }
  if (enquiry.owner_id) {
    return NextResponse.json({ error: "This enquiry has already been accepted as a client and can't be declined." }, { status: 409 });
  }

  // Delete the enquiry's (ownerless) INQUIRY booking(s) first (FK constraint), then the client
  const { error: bookingErr } = await admin
    .from("bookings")
    .delete()
    .eq("client_id", clientId)
    .is("owner_id", null);

  if (bookingErr) {
    console.error("Decline enquiry booking error:", bookingErr);
    return NextResponse.json({ error: "Failed to remove the enquiry's booking" }, { status: 500 });
  }

  const { error } = await admin.from("clients").delete().eq("id", clientId).is("owner_id", null);

  if (error) {
    console.error("Decline enquiry error:", error);
    return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
