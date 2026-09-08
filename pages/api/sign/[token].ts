// POST /api/sign/[token]
// PUBLIC route — no auth required.
// Processes a client's e-signature submission:
//   1. Validates token & expiry
//   2. Builds the signed contract PDF (with client signature embedded)
//   3. Emails signed PDF to client + photographer
//   4. Saves signed PDF to Supabase Storage (always) + Google Drive (optional)
//   5. Marks booking as signed, invalidates token
//
// Ported to Pages Router: any App Router route (app/api/**) that builds
// @react-pdf/renderer element trees resolves `react` through the
// "react-server" webpack condition, creating a second, incompatible `react`
// module instance from the one @react-pdf/renderer expects (it's kept out of
// the webpack bundle via serverExternalPackages). That mismatch makes every
// PDF template's JSX elements fail react-pdf's isValidElement() check,
// surfacing as "Minified React error #31" at render time. Pages Router
// doesn't use that webpack condition, so react resolves once, consistently.
// See pages/api/bookings/[id]/contractors/[assignmentId]/call-sheet.ts for
// the original fix of this pattern.
//
// This route is public (uses createServiceClient(), no user session), so
// unlike the other migrated routes it needs no createPagesClient/cookie
// handling and no founder/owner-resolution logic.
import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { generateContractPDF, EnquiryData } from "@/lib/generate-contract";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { contractSignedConfirmationHtml } from "@/lib/google/gmail";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";
import { formatDate } from "@/lib/utils";

/** Copy of packageNameToKey from fill-contract (could be shared) */
function packageNameToKey(name: string): keyof Pick<EnquiryData,
    "pkg_mini"|"pkg_full8"|"pkg_full13"|"pkg_hourly"|"pkg_combo"|"pkg_portrait"|"pkg_unsure"
  > | null {
    const n = name.toLowerCase();
    if (n.includes("mini") || n.includes("elopement"))                                     return "pkg_mini";
    if (n.includes("essential"))                                                            return "pkg_full8";
    if (n.includes("premium"))                                                             return "pkg_full13";
    if (n.includes("portrait") || n.includes("headshot") || n.includes("newborn") ||
              n.includes("maternity") || n.includes("couples"))                                  return "pkg_portrait";
    if (n.includes("videography") || n.includes("video") ||
              (n.includes("photo") && n.includes("video")))                                      return "pkg_combo";
    if (n.includes("photography only") || n.includes("hourly") || n.includes("photo"))    return "pkg_hourly";
    return null;
}

function apiSuccess<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json({ data });
}

function apiError(res: NextApiResponse, message: string, status = 400) {
  return res.status(status).json({ error: message });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return apiError(res, "Method not allowed", 405);
  }

  const { token } = req.query as { token: string };
  const body = req.body || {};
  const { signature_data_uri, signed_name } = body as {
        signature_data_uri: string;
        signed_name:        string;
  };

  if (!signature_data_uri) return apiError(res, "signature_data_uri is required");
  if (!signature_data_uri.startsWith("data:image/")) return apiError(res, "Invalid signature format");

  // Service client — no user session on public page
  const supabase = createServiceClient();

  // Fetch booking by token
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`
      id, owner_id, event_date, event_start_time, event_end_time,
      venue_name, service_type, quoted_total, deposit_amount,
      hours_booked, special_requests,
      contract_signed_at, contract_sign_expires_at,
      clients (id, first_name, last_name, email, gdrive_folder_id),
      packages (id, name, includes_photography, includes_videography, base_price, max_hours)
    `)
    .eq("contract_sign_token", token)
    .single();

  if (bErr || !booking) return apiError(res, "Invalid or expired signing link.", 404);

  const now = new Date();
  if (new Date(booking.contract_sign_expires_at!) < now) {
        return apiError(res, "This signing link has expired. Please contact JNguyen Co. for a new link.", 410);
  }
  if (booking.contract_signed_at) {
        return apiError(res, "This contract has already been signed.", 409);
  }

  const client = booking.clients as any;
  const pkg    = booking.packages as any;

  if (!client?.email) return apiError(res, "No client email on file.", 500);

  // ── Build EnquiryData ────────────────────────────────────────────────────
  const enquiryData: EnquiryData = {
        full_name:       `${client.first_name} ${client.last_name}`.trim(),
        email:           client.email,
        event_date:      booking.event_date,
        start_time:      booking.event_start_time ?? undefined,
        end_time:        booking.event_end_time   ?? undefined,
        venue:           booking.venue_name       ?? undefined,
        special_requests: booking.special_requests ?? undefined,
        total_fee:       booking.quoted_total     ?? undefined,
        deposit_amount:  booking.deposit_amount   ?? undefined,
  };

  if (pkg?.name) {
        enquiryData.package_name = pkg.name;
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

  // ── Generate signed PDF ──────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
        pdfBuffer = await generateContractPDF(enquiryData, {
                clientSignatureDataUri: signature_data_uri,
                clientSignedAt:         now.toISOString(),
        });
  } catch (e: any) {
        console.error("[sign/token] PDF generation failed:", e);
        return apiError(res, "Failed to generate signed contract PDF: " + e.message, 500);
  }

  const clientName  = `${client.first_name} ${client.last_name}`.trim();
  const packageName = pkg?.name ?? "Photography & Videography Package";
  const eventDate   = formatDate(booking.event_date);
  const signedAt    = now.toLocaleString("en-AU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const pdfFilename = `Contract_Signed_${clientName.replace(/\s+/g, "_")}_${booking.event_date}.pdf`;
  const pdfBase64   = pdfBuffer.toString("base64");

  const confirmHtml = contractSignedConfirmationHtml({ clientName, eventDate, packageName, signedAt });

  // ── Email to client (with signed PDF attached) ───────────────────────────
  try {
        await sendEmailViaSMTP({
                to:      client.email,
                subject: "Your Signed Contract — JNguyen Co.",
                html:    confirmHtml,
                pdfAttachment: { filename: pdfFilename, data: pdfBase64 },
        });
  } catch (e: any) {
        console.error("[sign/token] Client email failed:", e);
        // Don't abort — still try to save + notify photographer
  }

  // ── Save signed PDF to Supabase Storage (always — durable backup that
  //    doesn't depend on Google Drive being connected/working) ────────────
  const BUCKET = "documents";
  let storageUrl: string | null = null;
  try {
    const storagePath = `${booking.owner_id}/${pdfFilename}`;
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b: any) => b.id === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: false });
    }
    await supabase.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10); // 10-year link
    storageUrl = signed?.signedUrl ?? null;
  } catch (e: any) {
    console.error("[sign/token] Supabase Storage upload failed:", e?.message);
    // Non-fatal — signed PDF is still emailed to both parties
  }

  // ── Save signed PDF to Google Drive — same service-account client folder
  //    (Year/Month/ClientName/Contracts) used by quotes, invoices & receipts,
  //    instead of the old OAuth path that wrote to a disconnected folder tree
  //    and silently failed whenever "Connect Google" hadn't been completed. ─
  let driveUrl: string | null = null;
  if (isDriveConfigured()) {
    try {
      const folderId = client.gdrive_folder_id
        ? client.gdrive_folder_id
        : await getOrCreateClientFolder(client.id, clientName, booking.event_date);
      driveUrl = await uploadToDriveFolder(folderId, "Contracts", pdfFilename, pdfBuffer);
    } catch (e: any) {
      console.warn("[sign/token] Drive upload failed (non-fatal):", e?.message);
      // Non-fatal — signed PDF is still emailed to both parties and saved to Supabase Storage
    }
  }

  const contractUrl = driveUrl ?? storageUrl;
  const savedWhereNote = driveUrl
    ? "It has also been saved to their Google Drive folder."
    : storageUrl
      ? "It has also been saved to CRM Storage (Drive upload didn't run - check the Google Drive connection if you expected it there)."
      : "WARNING: It could NOT be saved to storage automatically - please save the attached PDF manually.";

  // ── Email to photographer (notification + signed PDF) ────────────────────
  const photographerEmail = process.env.SMTP_USER ?? "johnny.nguyen@jnguyen.co";
  try {
    await sendEmailViaSMTP({
      to:      photographerEmail,
      subject: `✅ Contract Signed — ${clientName} — ${eventDate}`,
      html:    `
        <p>Hi Johnny,</p>
        <p><strong>${clientName}</strong> just signed their contract for <strong>${eventDate}</strong> (${packageName}).</p>
        <p>The signed contract is attached. ${savedWhereNote}</p>
        <p>Next step: send the deposit invoice to secure the date.</p>
        <p>— JNguyen Co. CRM</p>
      `,
      pdfAttachment: { filename: pdfFilename, data: pdfBase64 },
    });
  } catch (e: any) {
    console.error("[sign/token] Photographer email failed:", e);
  }

  // ── Mark booking as signed, clear token ──────────────────────────────────
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      contract_signed_at:   now.toISOString(),
      contract_sign_token:  null,
      contract_signed_url:  contractUrl,
    })
    .eq("id", booking.id);

  if (updateErr) {
        console.error("[sign/token] Failed to update booking:", updateErr);
        return apiError(res, "Signature saved but failed to update booking status: " + updateErr.message, 500);
  }

  return apiSuccess(res, {
        message:       "Contract signed successfully.",
        signed_at:     now.toISOString(),
        contract_url:  contractUrl,
  });
}
