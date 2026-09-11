// POST /api/pdf/run-sheet — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// The calling route (app/api/bookings/[id]/run-sheet/route.ts) already
// checks auth/role before it ever reaches here.
import type { NextApiRequest, NextApiResponse } from "next";
import { generateRunSheetPDF, RunSheetData } from "@/lib/generate-run-sheet";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body as RunSheetData;

  try {
    const pdfBuffer = await generateRunSheetPDF(data);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("[pdf/run-sheet] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
