// POST /api/pdf/invoice — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// The calling routes (app/api/invoices/[id]/pdf/route.ts and
// app/api/admin/sync-drive-documents/route.ts) already check auth before
// they ever reach here.
import type { NextApiRequest, NextApiResponse } from "next";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceTemplate } from "@/lib/pdf/InvoiceTemplate";
import { createElement } from "react";
import type { InvoiceWithDetails } from "@/lib/supabase/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoice = req.body as InvoiceWithDetails;

  try {
    const pdfBuffer = await renderToBuffer(createElement(InvoiceTemplate, { invoice }) as any);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer as Buffer);
  } catch (e) {
    console.error("[pdf/invoice] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
