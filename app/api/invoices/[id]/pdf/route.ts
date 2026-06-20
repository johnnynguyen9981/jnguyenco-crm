// GET /api/invoices/[id]/pdf
// Renders the branded invoice PDF server-side and returns it as a downloadable file.
// Uses @react-pdf/renderer renderToBuffer — runs entirely on the server.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceTemplate } from "@/lib/pdf/InvoiceTemplate";
import { createElement } from "react";
import type { InvoiceWithClient } from "@/lib/supabase/types";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the full invoice data needed for the PDF
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone, address),
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

  try {
    // Render PDF to a Node.js Buffer using renderToBuffer
    const pdfBuffer = await renderToBuffer(
      createElement(InvoiceTemplate, { invoice: invoice as InvoiceWithClient }) as any
    );

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Content-Length":      String(pdfBuffer.length),
        // Allow inline preview in the browser (change to attachment to force download)
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[pdf/route] renderToBuffer error:", err);
    return NextResponse.json({ error: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}
