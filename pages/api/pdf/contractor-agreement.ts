// POST /api/pdf/contractor-agreement — internal PDF-render endpoint, see lib/pdf/render-client.ts
// Pure function of its JSON body: no auth, no DB access, no side effects.
// The calling route (app/api/contractors/[id]/generate-contract/route.ts)
// already checks auth/role before it ever reaches here.
import type { NextApiRequest, NextApiResponse } from "next";
import {
  generateContractorAgreementPDF,
  ContractorAgreementData,
  ContractLanguage,
} from "@/lib/generate-contractor-agreement";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data, language } = req.body as {
    data: ContractorAgreementData;
    language?: ContractLanguage;
  };

  try {
    const pdfBuffer = await generateContractorAgreementPDF(data, language);
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("[pdf/contractor-agreement] generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
