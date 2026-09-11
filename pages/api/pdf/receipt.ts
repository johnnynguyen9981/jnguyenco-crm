// POST /api/pdf/receipt — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// The calling route (app/api/payments/[id]/receipt/route.ts) already checks
// auth/ownership before it ever reaches here.
import type { NextApiRequest, NextApiResponse } from "next";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptTemplate, ReceiptData } from "@/lib/pdf/ReceiptTemplate";
import { createElement } from "react";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body as ReceiptData;

  try {
    const pdfBuffer = await renderToBuffer(createElement(ReceiptTemplate, { data }) as any);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer as Buffer);
  } catch (e) {
    console.error("[pdf/receipt] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
