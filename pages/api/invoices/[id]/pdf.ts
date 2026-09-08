// GET /api/invoices/[id]/pdf
// Renders the branded invoice PDF server-side and returns it as a downloadable file.
//
// Pages Router API route (not app/api/) — see pages/api/payments/[id]/
// receipt.ts for the full explanation: app/api/** routes compile through
// Next's "react-server" webpack condition, which resolves `react` to a
// build @react-pdf/renderer's reconciler rejects everything from as "not a
// valid React child" (Minified React error #31).
//
// isCurrentUserFounder() from lib/team.ts calls the App Router-only
// createClient() internally, so the founder-role check is inlined here.
import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesClient } from "@/lib/supabase/pages-server";
import { renderToBuffer } from "@/lib/pdf/renderQueue";
import { InvoiceTemplate } from "@/lib/pdf/InvoiceTemplate";
import { createElement } from "react";
import type { InvoiceWithDetails } from "@/lib/supabase/types";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = String(req.query.id);
  const supabase = createPagesClient(req, res);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data: member } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .single();
  const role = member?.role ?? "FOUNDER";
  if (role !== "FOUNDER") return res.status(403).json({ error: "Forbidden" });

  // The "Send Invoice to Client" flow fetches this PDF to attach to the email
  // *before* the invoice is marked SENT (that happens once the email actually
  // goes out, so a failed send doesn't leave the invoice incorrectly marked as
  // sent). Without this flag the attachment would still say "DRAFT" even
  // though the client is receiving it right now. asSent only changes what's
  // rendered on this copy — it never writes to the DB.
  const asSent = req.query.asSent === "true";

  // Fetch the full invoice data needed for the PDF
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address, gdrive_folder_id),
      bookings (event_date),
      invoice_line_items (id, description, quantity, unit_price, total, sort_order)
    `)
    .eq("id", invoiceId)
    .eq("owner_id", user.id)
    .single();

  if (error || !invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // Sort line items by sort_order
  invoice.invoice_line_items = (invoice.invoice_line_items ?? []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );

  if (asSent && invoice.status === "DRAFT") {
    invoice.status = "SENT";
  }

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(InvoiceTemplate, { invoice: invoice as unknown as InvoiceWithDetails }) as any
    );

    // Upload to Google Drive before returning response (Vercel kills fire-and-forget tasks)
    if (isDriveConfigured()) {
      const clientRow = invoice.clients as any;
      if (clientRow?.id) {
        const clientName = `${clientRow.first_name ?? ""} ${clientRow.last_name ?? ""}`.trim();
        try {
          const bookingRow = invoice.bookings as any;
          const folderId = clientRow.gdrive_folder_id
            ? clientRow.gdrive_folder_id
            : await getOrCreateClientFolder(clientRow.id, clientName, bookingRow?.event_date);
          await uploadToDriveFolder(folderId, "Invoices", `${invoice.invoice_number}.pdf`, pdfBuffer as Buffer);
        } catch (e: any) {
          console.warn("[drive] Invoice upload failed:", e?.message, e?.stack?.split("\n")[1]);
        }
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader("Content-Length", String((pdfBuffer as Buffer).length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error("[invoices/pdf] renderToBuffer error:", err);
    return res.status(500).json({ error: `PDF generation failed: ${err.message}` });
  }
}
