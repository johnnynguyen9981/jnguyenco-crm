// POST /api/pdf/quote — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// The calling route (app/api/bookings/[id]/quote/route.ts) already checks
// auth before it ever reaches here.
import type { NextApiRequest, NextApiResponse } from "next";
import { generateQuotePDF, QuoteData } from "@/lib/generate-quote";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body as QuoteData;

  try {
    const pdfBuffer = await generateQuotePDF(data);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("[pdf/quote] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
