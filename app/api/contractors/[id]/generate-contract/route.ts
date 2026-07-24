// POST /api/contractors/[id]/generate-contract
// Generates an Independent Contractor Agreement PDF from the contractor's
// saved details and returns it for download. PDF only — no e-sign flow,
// this is printed/emailed and signed manually.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { generateContractorAgreementPDF, ContractorAgreementData, ContractLanguage } from "@/lib/generate-contractor-agreement";

type Params = { params: { id: string } };

function parseLanguage(value: unknown): ContractLanguage {
  return value === "VI" || value === "BOTH" ? value : "EN";
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Body is optional — default to English if none / unparseable, so existing
  // callers that POST with no body keep working.
  let language: ContractLanguage = "EN";
  try {
    const body = await req.json();
    language = parseLanguage(body?.language);
  } catch {
    // no JSON body sent — fall back to default
  }

  const ownerUserId = await getOwnerUserId();

  const { data: contractor, error } = await supabase
    .from("contractors")
    .select("id, first_name, last_name, email, phone, role, rate_type, default_rate, start_date, notes")
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Failed to generate agreement PDF" }, { status: 500 });
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
    .eq("id", params.id)
    .eq("owner_id", ownerUserId);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
