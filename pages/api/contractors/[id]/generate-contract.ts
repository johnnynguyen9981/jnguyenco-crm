// POST /api/contractors/[id]/generate-contract
// Generates an Independent Contractor Agreement PDF from the contractor's
// saved details and returns it for download. PDF only — no e-sign flow,
// this is printed/emailed and signed manually.
//
// Pages Router API route (not app/api/) — see pages/api/payments/[id]/
// receipt.ts for the full explanation: app/api/** routes compile through
// Next's "react-server" webpack condition, which resolves `react` to a
// build @react-pdf/renderer's reconciler rejects everything from as "not a
// valid React child" (Minified React error #31).
//
// getOwnerUserId/getCurrentTeamMember/isFounder from lib/team.ts call the
// App Router-only createClient() internally, so the founder-role gate and
// owner lookup are inlined here, same as the other migrated PDF routes.
import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesClient } from "@/lib/supabase/pages-server";
import { generateContractorAgreementPDF, ContractorAgreementData, ContractLanguage } from "@/lib/generate-contractor-agreement";

function parseLanguage(value: unknown): ContractLanguage {
  return value === "VI" || value === "BOTH" ? value : "EN";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contractorId = String(req.query.id);
  const supabase = createPagesClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data: member } = await supabase
    .from("team_members")
    .select("role, user_id")
    .eq("user_id", user.id)
    .single();
  const role = member?.role ?? "FOUNDER";
  if (role !== "FOUNDER") return res.status(403).json({ error: "Forbidden" });

  let ownerUserId = user.id;
  if (member && member.role !== "FOUNDER") {
    const { data: founder } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("role", "FOUNDER")
      .eq("is_active", true)
      .not("user_id", "is", null)
      .single();
    ownerUserId = founder?.user_id ?? user.id;
  }

  // Body is optional — default to English if none / unparseable, so existing
  // callers that POST with no body keep working.
  const language: ContractLanguage = parseLanguage((req.body as any)?.language);

  const { data: contractor, error } = await supabase
    .from("contractors")
    .select("id, first_name, last_name, email, phone, role, rate_type, default_rate, start_date, notes")
    .eq("id", contractorId)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !contractor) {
    return res.status(404).json({ error: "Contractor not found" });
  }

  const agreementData: ContractorAgreementData = {
    contractor_name: `${contractor.first_name} ${contractor.last_name}`.trim(),
    role:            contractor.role,
    email:           contractor.email ?? undefined,
    phone:           contractor.phone ?? undefined,
    rate_type:       (contractor.rate_type as "HOURLY" | "PER_PROJECT") ?? "PER_PROJECT",
    rate_amount:     contractor.default_rate ?? null,
    start_date:      contractor.start_date ?? undefined,
    notes:           contractor.notes ?? undefined,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateContractorAgreementPDF(agreementData, language);
  } catch (e) {
    console.error("[contractors/generate-contract] PDF generation error:", e);
    return res.status(500).json({ error: "Failed to generate agreement PDF" });
  }

  const langSuffix = language === "BOTH" ? "EN-VI" : language;
  const fileName = `Contractor_Agreement_${agreementData.contractor_name.replace(/\s+/g, "_")}_${langSuffix}_${Date.now()}.pdf`;

  // Track that a contract was generated (non-fatal if it fails)
  await supabase
    .from("contractors")
    .update({
      contract_generated_at: new Date().toISOString(),
      contract_file_name:    fileName,
      updated_at:            new Date().toISOString(),
    })
    .eq("id", contractorId)
    .eq("owner_id", ownerUserId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.status(200).send(pdfBuffer);
}
