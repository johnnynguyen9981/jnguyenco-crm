// POST /api/clients/[id]/fill-contract
// Accepts multipart/form-data with a "form" file (enquiry PDF)
// Returns the filled contract PDF and saves to Documents storage.
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateContractPDF, EnquiryData } from "@/lib/generate-contract";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";

const BUCKET = "documents";

/** Map a DB package name to the corresponding pkg_* key used by the contract generator. */
function packageNameToKey(name: string): keyof Pick<EnquiryData, "pkg_mini"|"pkg_full8"|"pkg_full13"|"pkg_hourly"|"pkg_combo"|"pkg_portrait"|"pkg_unsure"> | null {
  const n = name.toLowerCase();
  if (n.includes("mini") || n.includes("elopement"))                                              return "pkg_mini";
  if (n.includes("essential"))                                                                    return "pkg_full8";
  if (n.includes("premium"))                                                                     return "pkg_full13";
  if (n.includes("portrait") || n.includes("headshot") || n.includes("newborn") || n.includes("maternity") || n.includes("couples")) return "pkg_portrait";
  if (n.includes("videography") || n.includes("video") || (n.includes("photo") && n.includes("video"))) return "pkg_combo";
  if (n.includes("photography only") || n.includes("hourly") || n.includes("photo"))             return "pkg_hourly";
  return null;
}

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function ensureBucket(admin: ReturnType<typeof adminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find((b) => b.id === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false });
  }
}

function extractFormFields(pdfBytes: Buffer): EnquiryData {
  const tmp = join(tmpdir(), "enquiry_" + Date.now() + ".pdf");
  writeFileSync(tmp, pdfBytes);
  try {
    const python = process.platform === "win32" ? "python" : "python3";
    const scriptPath = join(process.cwd(), "scripts", "extract_enquiry.py");
    const out = execFileSync(python, [scriptPath, tmp], { timeout: 15000 }).toString();
    return JSON.parse(out) as EnquiryData;
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: client } = await supabase
    .from("clients")
    .select("first_name, last_name, email, phone")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  const form = await req.formData();
  const file = form.get("form") as File | null;

  let enquiryData: EnquiryData = {};

  const dataField = form.get("data") as string | null;
  if (dataField) {
    try {
      const parsed = JSON.parse(dataField) as EnquiryData & { package_name?: string };
      enquiryData = parsed;
      if (parsed.package_name) {
        const pkgKey = packageNameToKey(parsed.package_name);
        if (pkgKey) enquiryData[pkgKey] = "Yes";
      }
    } catch (e) {
      console.error("Failed to parse manual data field:", e);
    }
  } else if (file) {
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      enquiryData = extractFormFields(bytes);
    } catch (e) {
      console.error("Failed to extract enquiry fields:", e);
    }
  }

  // Always override with latest DB booking data
  const { data: booking } = await supabase
    .from("bookings")
    .select("event_date, event_start_time, event_end_time, venue_name, service_type, quoted_total, deposit_amount, package_id, hours_booked, special_requests")
    .eq("client_id", params.id)
    .eq("owner_id", user.id)
    .order("event_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (booking) {
    if (booking.event_date)              enquiryData.event_date       = booking.event_date;
    if (booking.event_start_time)        enquiryData.start_time       = booking.event_start_time;
    if (booking.event_end_time)          enquiryData.end_time         = booking.event_end_time;
    if (booking.venue_name)              enquiryData.venue            = booking.venue_name;
    if (booking.quoted_total   != null)  enquiryData.total_fee        = booking.quoted_total;
    if (booking.deposit_amount != null)  enquiryData.deposit_amount   = booking.deposit_amount;
    if (booking.special_requests)        enquiryData.special_requests = booking.special_requests;

    if (booking.package_id) {
      (["pkg_mini","pkg_full8","pkg_full13","pkg_hourly","pkg_combo","pkg_portrait","pkg_unsure"] as const)
        .forEach(k => { delete enquiryData[k]; });
      delete enquiryData.svc_both;
      delete enquiryData.svc_photo;
      delete enquiryData.svc_video;

      const { data: pkg } = await supabase
        .from("packages")
        .select("name, includes_photography, includes_videography, base_price, max_hours")
        .eq("id", booking.package_id)
        .single();

      if (pkg?.name) {
        enquiryData.package_name = pkg.name;   // pass real name to contract
        const pkgKey = packageNameToKey(pkg.name);
        if (pkgKey) enquiryData[pkgKey] = "Yes";

        if (pkg.base_price != null) {
          const isHourlyPkg = !pkg.max_hours;
          enquiryData.list_price = (isHourlyPkg && booking.hours_booked != null)
            ? Math.round(Number(booking.hours_booked) * Number(pkg.base_price))
            : Number(pkg.base_price);
        }

        if (pkg.includes_photography && pkg.includes_videography) {
          enquiryData.svc_both  = "Yes";
        } else if (pkg.includes_videography) {
          enquiryData.svc_video = "Yes";
        } else {
          enquiryData.svc_photo = "Yes";
        }
      }
    }
  }

  if (client) {
    if (!enquiryData.full_name) {
      enquiryData.full_name = (client.first_name ?? "") + " " + (client.last_name ?? "");
      enquiryData.full_name = enquiryData.full_name.trim();
    }
    if (!enquiryData.email) enquiryData.email = client.email ?? "";
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateContractPDF(enquiryData);
  } catch (e) {
    console.error("PDF generation error:", e);
    return NextResponse.json({ error: "Failed to generate contract PDF" }, { status: 500 });
  }

  const clientName = (enquiryData.full_name ?? "Client").replace(/\s+/g, "_");
  const fileName   = "Contract_" + clientName + "_" + Date.now() + ".pdf";

  // Save to Supabase Storage
  const admin = adminClient();
  await ensureBucket(admin);
  await admin.storage
    .from(BUCKET)
    .upload(user.id + "/" + fileName, pdfBuffer, { contentType: "application/pdf", upsert: false });

  // Upload to Google Drive (non-fatal)
  if (isDriveConfigured()) {
    try {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, first_name, last_name, gdrive_folder_id")
        .eq("id", params.id)
        .eq("owner_id", user.id)
        .single();

      if (clientRow) {
        const displayName = `${clientRow.first_name} ${clientRow.last_name}`.trim();
        const folderId = clientRow.gdrive_folder_id
          ? clientRow.gdrive_folder_id
          : await getOrCreateClientFolder(clientRow.id, displayName);
        await uploadToDriveFolder(folderId, "Contracts", fileName, pdfBuffer);
      }
    } catch (e: any) {
      console.warn("[drive] Contract upload failed:", e?.message);
    }
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"" + fileName + "\"",
    },
  });
}
