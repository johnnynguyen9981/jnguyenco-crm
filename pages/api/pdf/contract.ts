// POST /api/pdf/contract — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// Called both by authenticated routes (fill-contract, admin sync) and by the
// public e-sign flow (app/api/sign/[token]/route.ts), so it stays open —
// same risk profile as this app's other public routes (e.g. /api/enquire).
import type { NextApiRequest, NextApiResponse } from "next";
import { generateContractPDF, EnquiryData } from "@/lib/generate-contract";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { enquiryData, signOptions } = req.body as {
    enquiryData: EnquiryData;
    signOptions?: { clientSignatureDataUri?: string; clientSignedAt?: string };
  };

  try {
    const pdfBuffer = await generateContractPDF(enquiryData, signOptions);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("[pdf/contract] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
