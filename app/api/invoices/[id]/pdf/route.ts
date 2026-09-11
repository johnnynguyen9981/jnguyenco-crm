// GET /api/invoices/[id]/pdf
// Renders the branded invoice PDF server-side and returns it as a downloadable file.
// The actual @react-pdf/renderer renderToBuffer() call happens in
// pages/api/pdf/invoice.ts (Pages Router), reached via a loopback fetch —
// see lib/pdf/render-client.ts for why it can't be called directly here.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPdfInternal } from "@/lib/pdf/render-client";
import type { InvoiceWithDetails } from "@/lib/supabase/types";
import { getOrCreateClientFolder, uploadToDriveFolder, isDriveConfigured } from "@/lib/google/drive";
import { isCurrentUserFounder } from "@/lib/team";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isCurrentUserFounder())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The "Send Invoice to Client" flow fetches this PDF to attach to the email
  // *before* the invoice is marked SENT (that happens once the email actually
  // goes out, so a failed send doesn't leave the invoice incorrectly marked as
  // sent). Without this flag the attachment would still say "DRAFT" even
  // though the client is receiving it right now. asSent only changes what's
  // rendered on this copy — it never writes to the DB.
  const asSent = new URL(req.url).searchParams.get("asSent") === "true";

  // Fetch the full invoice data needed for the PDF
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address, gdrive_folder_id),
      bookings (event_date),
      invoice_line_items (id, description, quantity, unit_price, total, sort_order)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Sort line items by sort_order
  invoice.invoice_line_items = (invoice.invoice_line_items ?? []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );

  if (asSent && invoice.status === "DRAFT") {
    invoice.status = "SENT";
  }

  try {
    // Render PDF via the Pages Router internal endpoint (see lib/pdf/render-client.ts)
    const pdfBuffer = await renderPdfInternal(
      "/api/pdf/invoice",
      invoice as unknown as InvoiceWithDetails,
      req.url
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
          await uploadToDriveFolder(folderId, "Invoices", `${invoice.invoice_number}.pdf`, pdfBuffer);
        } catch (e: any) {
          console.warn("[drive] Invoice upload failed:", e?.message, e?.stack?.split("\n")[1]);
        }
      }
    }

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Content-Length":      String(pdfBuffer.length),
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[pdf/route] renderToBuffer error:", err);
    return NextResponse.json({ error: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}
