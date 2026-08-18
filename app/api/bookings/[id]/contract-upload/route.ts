// app/api/bookings/[id]/contract-upload/route.ts
// Uploads a signed contract file (PDF or scanned image) to the client's
// Google Drive folder under .../[ClientName]/Contracts/, using the same
// Year/Month/ClientName structure as every other Drive write in this app
// (see lib/google/drive.ts getOrCreateClientFolder).
//
// Returns: { fileUrl }
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDriveConfigured, getOrCreateClientFolder, uploadToDriveFolder } from "@/lib/google/drive";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the booking's client (need id + name for the Drive folder path)
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, client_id, event_date, clients (id, first_name, last_name)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const client = (booking as any).clients;
  if (!client) return NextResponse.json({ error: "Booking has no client on file" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate file type — signed contracts are usually a PDF, but a phone
  // photo/scan of a paper-signed copy is common too.
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|heic)$/i)) {
    return NextResponse.json({ error: "Only PDF and images are accepted" }, { status: 400 });
  }

  // Max 20 MB
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  if (!isDriveConfigured()) {
    return NextResponse.json(
      { fileUrl: null, driveSkipped: true,
        driveMessage: "Google Drive is not configured — contract not uploaded." },
      { status: 200 }
    );
  }

  try {
    const clientName = `${client.first_name} ${client.last_name}`.trim();
    const clientFolderId = await getOrCreateClientFolder(client.id, clientName, booking.event_date);

    const timestamp = new Date().toISOString().split("T")[0];
    const ext = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || (file.type === "application/pdf" ? ".pdf" : "");
    const fileName = `Signed Contract - ${clientName} - ${timestamp}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadToDriveFolder(
      clientFolderId,
      "Contracts",
      fileName,
      buffer,
      file.type || "application/pdf"
    );

    return NextResponse.json({ fileUrl });
  } catch (err: any) {
    console.error("[bookings/contract-upload]", err);

    const isPermission = err.message?.includes("insufficientPermissions") ||
                          err.code === 403 || err.status === 403;

    if (isPermission) {
      return NextResponse.json(
        { fileUrl: null, driveSkipped: true,
          driveMessage: "Google Drive upload failed (permission issue) — contract not uploaded." },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
