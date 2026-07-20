// POST /api/admin/sync-drive-documents
// Generates contract + invoice PDFs for every client and uploads them to their
// Google Drive folders using the service account (same path used elsewhere in
// the app for receipts/contracts). Safe to re-run — existing files are not
// deleted; new versions are just uploaded alongside.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";
import { generateContractPDF, EnquiryData } from "@/lib/generate-contract";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceTemplate } from "@/lib/pdf/InvoiceTemplate";
import { createElement } from "react";
import type { InvoiceWithDetails } from "@/lib/supabase/types";

// ─── Package key mapper (mirrors fill-contract route) ────────

type PkgKey = keyof Pick<
    EnquiryData,
    "pkg_mini" | "pkg_full8" | "pkg_full13" | "pkg_hourly" | "pkg_combo" | "pkg_portrait" | "pkg_unsure"
  >;

function packageNameToKey(name: string): PkgKey | null {
    const n = name.toLowerCase();
    if (n.includes("mini") || n.includes("elopement"))                                                return "pkg_mini";
    if (n.includes("essential"))                                                                      return "pkg_full8";
    if (n.includes("premium"))                                                                        return "pkg_full13";
    if (n.includes("portrait") || n.includes("headshot") || n.includes("newborn") || n.includes("maternity") || n.includes("couples")) return "pkg_portrait";
    if (n.includes("videography") || n.includes("video") || (n.includes("photo") && n.includes("video"))) return "pkg_combo";
    if (n.includes("photography only") || n.includes("hourly") || n.includes("photo"))               return "pkg_hourly";
    return null;
}

// ─── Route ───────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  let ownerUserId: string;
    try {
          ownerUserId = await getOwnerUserId();
    } catch {
          return apiError("Unauthorized", 401);
    }

  if (!isDriveConfigured()) {
        return apiError("Google Drive service account is not configured.", 503);
  }

  // All clients
  const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone")
      .eq("owner_id", ownerUserId);

  if (clientsErr || !clients?.length) {
        return apiSuccess({ results: [], message: "No clients found." });
  }

  const results: Array<{
        client: string;
        contract?: string;
        invoices: string[];
        errors: string[];
  }> = [];

  for (const client of clients) {
        const clientName = `${client.first_name} ${client.last_name}`.trim();
        const clientResult: { client: string; contract?: string; invoices: string[]; errors: string[] } = {
                client: clientName, invoices: [], errors: [],
        };

      try {
              // getOrCreateClientFolder builds Root/Year/Month/[Client Name]/... (with
          // Deliverables/Photos+Videos, Quotes, Contracts, Invoices, Receipts) and
          // persists gdrive_folder_id back to the client row — same as every other
          // Drive write path in this app.
          const clientFolderId = await getOrCreateClientFolder(client.id, clientName);

          const { data: booking } = await supabase
                .from("bookings")
                .select(
                            "id, event_date, event_start_time, event_end_time, venue_name, quoted_total, deposit_amount, package_id, hours_booked, special_requests"
                          )
                .eq("client_id", client.id)
                .order("event_date", { ascending: true })
                .limit(1)
                .maybeSingle();

          // ── Contract PDF ─────────────────────────────────────
          try {
                    const enquiryData: EnquiryData = {
                                full_name: clientName,
                                email:     client.email    ?? "",
                                phone:     client.phone    ?? "",
                    };

                if (booking) {
                            if (booking.event_date)       enquiryData.event_date      = booking.event_date;
                            if (booking.event_start_time) enquiryData.start_time      = booking.event_start_time;
                            if (booking.event_end_time)   enquiryData.end_time        = booking.event_end_time;
                            if (booking.venue_name)       enquiryData.venue           = booking.venue_name;
                            if (booking.quoted_total   != null) enquiryData.total_fee        = booking.quoted_total;
                            if (booking.deposit_amount != null) enquiryData.deposit_amount   = booking.deposit_amount;
                            if (booking.special_requests)       enquiryData.special_requests = booking.special_requests;

                      if (booking.package_id) {
                                    // Clear any existing package flags
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
                                              enquiryData.package_name = pkg.name;
                                              const pkgKey = packageNameToKey(pkg.name);
                                              if (pkgKey) enquiryData[pkgKey] = "Yes";

                                      if (pkg.base_price != null) {
                                                        const isHourly = !pkg.max_hours;
                                                        enquiryData.list_price = (isHourly && booking.hours_booked != null)
                                                          ? Math.round(Number(booking.hours_booked) * Number(pkg.base_price))
                                                                            : Number(pkg.base_price);
                                      }

                                      if (pkg.includes_photography && pkg.includes_videography) enquiryData.svc_both  = "Yes";
                                              else if (pkg.includes_videography)                          enquiryData.svc_video = "Yes";
                                              else                                                         enquiryData.svc_photo = "Yes";
                              }
                      }
                }

                const contractBuf      = await generateContractPDF(enquiryData);
                    const contractFilename = `Contract_${clientName.replace(/\s+/g, "_")}.pdf`;
                    const contractUrl      = await uploadToDriveFolder(clientFolderId, "Contracts", contractFilename, contractBuf);
                    clientResult.contract  = contractUrl;
          } catch (e: any) {
                    clientResult.errors.push(`Contract: ${e.message}`);
          }

          // ── Invoice PDFs ──────────────────────────────────────
          const { data: invoices } = await supabase
                .from("invoices")
                .select(`
                          *,
                                    clients (id, first_name, last_name, email, phone, address),
                                              invoice_line_items (id, description, quantity, unit_price, total, sort_order)
                                                      `)
                .eq("client_id", client.id)
                .eq("owner_id",  ownerUserId);

          for (const invoice of (invoices ?? [])) {
                    try {
                                invoice.invoice_line_items = (invoice.invoice_line_items ?? []).sort(
                                              (a: any, b: any) => a.sort_order - b.sort_order
                                            );
                                const pdfBuf = await renderToBuffer(
                                              createElement(InvoiceTemplate, { invoice: invoice as unknown as InvoiceWithDetails }) as any
                                            );
                                const url = await uploadToDriveFolder(clientFolderId, "Invoices", `${invoice.invoice_number}.pdf`, pdfBuf as Buffer);
                                clientResult.invoices.push(url);
                    } catch (e: any) {
                                clientResult.errors.push(`Invoice ${invoice.invoice_number}: ${e.message}`);
                    }
          }
      } catch (e: any) {
              clientResult.errors.push(`Folder setup: ${e.message}`);
      }

      results.push(clientResult);
  }

  return apiSuccess({ results });
}
