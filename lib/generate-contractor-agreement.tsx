/**
 * Server-side Independent Contractor Agreement PDF generation using
 * @react-pdf/renderer. Used for business-services contractors hired on an
 * ongoing basis (e.g. a Photo Editor) — distinct from the client-facing
 * Photography Services Agreement in lib/generate-contract.tsx.
 * Branded with JNguyen Co. brand colors and real logo.
 */
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Image,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Brand colours (matches lib/generate-contract.tsx) ─────
const NAVY      = "#083a4f";
const SAND      = "#a58d66";
const TEAL      = "#407e8c";
const PALE_BLUE = "#c0d5d6";
const CREAM_BG  = "#f7f4f1";

function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "PNG", "LetterHeadNavy.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}
const LOGO_DATA_URI = getLogoDataUri();

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Contractor",
};

export interface ContractorAgreementData {
  contractor_name: string;
  role: string;                          // ContractorRole
  email?: string;
  phone?: string;
  rate_type: "HOURLY" | "PER_PROJECT";
  rate_amount?: number | null;
  start_date?: string;                   // YYYY-MM-DD
  notes?: string;                        // additional scope notes
}

function fmt(amount: number | null | undefined): string {
  if (amount == null) return "TBD";
  return "$" + Number(amount).toLocaleString("en-AU");
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return d + "/" + m + "/" + y;
}

function today() {
  return new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Styles (reuses the same system as the client contract) ─
const s = StyleSheet.create({
  page: {
    fontSize: 8.5,
    fontFamily: "Helvetica",
    paddingTop: "1.4cm",
    paddingBottom: "1.8cm",
    paddingHorizontal: "1.8cm",
    color: NAVY,
    backgroundColor: "#ffffff",
  },
  header:        { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  headerContact: { alignItems: "flex-end" },
  headerTagline: { fontSize: 7.5, color: TEAL, marginBottom: 1, letterSpacing: 0.5 },
  headerCity:    { fontSize: 7, color: "#777" },
  headerEmail:   { fontSize: 7, color: TEAL },
  rulePrimary:   { borderBottomWidth: 1.5, borderBottomColor: NAVY, marginBottom: 1.5 },
  ruleAccent:    { borderBottomWidth: 0.5, borderBottomColor: TEAL, marginBottom: 10 },
  contractTitle: {
    textAlign: "center", fontFamily: "Helvetica-Bold",
    fontSize: 11, color: NAVY, letterSpacing: 2, marginBottom: 2,
  },
  contractSubtitle: { textAlign: "center", fontSize: 7.5, color: "#888", marginBottom: 10 },
  summaryCard: {
    backgroundColor: CREAM_BG, borderRadius: 5, padding: "8 12", marginBottom: 10,
    borderLeftWidth: 2.5, borderLeftColor: TEAL, flexDirection: "row", justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 6.5, color: TEAL, fontFamily: "Helvetica-Bold", marginBottom: 2, letterSpacing: 0.5 },
  summaryValue: { fontSize: 8.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  summarySub:   { fontSize: 7, color: "#666" },
  sectionRow:   { flexDirection: "row", alignItems: "center", marginTop: 9, marginBottom: 4 },
  sectionBar:   { width: 2.5, height: 12, backgroundColor: TEAL, marginRight: 6, borderRadius: 1.5 },
  sectionText:  { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: NAVY, letterSpacing: 0.5 },
  subheading:   { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: TEAL, marginTop: 5, marginBottom: 2 },
  body:    { lineHeight: 1.55, marginBottom: 3.5, color: "#1a2e3a" },
  field:   { flexDirection: "row", marginBottom: 3.5, alignItems: "flex-start" },
  label:   { fontFamily: "Helvetica-Bold", width: 150, flexShrink: 0, fontSize: 7.5, color: SAND },
  value:   { flex: 1, fontSize: 8.5, color: NAVY },
  divider: { borderBottomWidth: 0.5, borderBottomColor: PALE_BLUE, marginVertical: 6 },
  sigRow:    { flexDirection: "row", marginTop: 18, gap: 30 },
  sigBlock:  { flex: 1 },
  sigName:   { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: NAVY, marginBottom: 2 },
  sigLine:   { borderBottomWidth: 0.75, borderBottomColor: NAVY, marginTop: 22, marginBottom: 3 },
  sigLabel:  { fontSize: 7, color: "#888" },
  footer:      { position: "absolute", bottom: "0.7cm", left: "1.8cm", right: "1.8cm" },
  footerRule:  { borderTopWidth: 0.5, borderTopColor: PALE_BLUE, marginBottom: 3 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between" },
  footerLeft:  { fontSize: 6.5, color: "#aaa" },
  footerRight: { fontSize: 6.5, color: TEAL },
  notice:     { backgroundColor: CREAM_BG, padding: "5 8", borderRadius: 3, marginVertical: 5 },
  noticeText: { fontSize: 7.5, color: "#555", lineHeight: 1.5 },
});

const Header = () => (
  <View fixed>
    <View style={s.header}>
      {LOGO_DATA_URI ? (
        <Image src={LOGO_DATA_URI} style={{ width: 75, height: 60 }} />
      ) : (
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY }}>JNguyen Co.</Text>
      )}
      <View style={{ flex: 1 }} />
      <View style={s.headerContact}>
        <Text style={s.headerTagline}>Photography &amp; Videography</Text>
        <Text style={s.headerCity}>Canberra, Australia</Text>
        <Text style={s.headerEmail}>johnny.nguyen@jnguyen.co</Text>
        <Text style={s.headerEmail}>https://www.jnguyen.co</Text>
      </View>
    </View>
    <View style={s.rulePrimary} />
    <View style={s.ruleAccent} />
  </View>
);

const Footer = () => (
  <View style={s.footer} fixed>
    <View style={s.footerRule} />
    <View style={s.footerRow}>
      <Text style={s.footerLeft}>
        JNguyen Co. Photography &amp; Videography &middot; Canberra, Australia &middot; johnny.nguyen@jnguyen.co &middot; www.jnguyen.co
      </Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => "Page " + pageNumber + " of " + totalPages}
      />
    </View>
  </View>
);

const Section = ({ title }: { title: string }) => (
  <View style={s.sectionRow}>
    <View style={s.sectionBar} />
    <Text style={s.sectionText}>{title}</Text>
  </View>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value || "—"}</Text>
  </View>
);

const Divider = () => <View style={s.divider} />;

interface AgreementDocProps { d: ContractorAgreementData }

const AgreementDoc = ({ d }: AgreementDocProps) => {
  const roleLabel  = ROLE_LABELS[d.role] ?? d.role;
  const rateLabel  = d.rate_type === "HOURLY"
    ? fmt(d.rate_amount) + " per hour"
    : fmt(d.rate_amount) + " per project (flat fee, agreed per engagement)";
  const name = d.contractor_name || "—";

  return (
    <Document title={"Independent Contractor Agreement – " + name} author="JNguyen Co.">
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.contractTitle}>INDEPENDENT CONTRACTOR AGREEMENT</Text>
        <Text style={s.contractSubtitle}>{"Agreement Date: " + today()}</Text>

        <View style={s.summaryCard}>
          <View>
            <Text style={s.summaryLabel}>CONTRACTOR</Text>
            <Text style={s.summaryValue}>{name}</Text>
            <Text style={s.summarySub}>{d.email || ""}</Text>
          </View>
          <View>
            <Text style={s.summaryLabel}>ROLE</Text>
            <Text style={s.summaryValue}>{roleLabel}</Text>
          </View>
          <View>
            <Text style={s.summaryLabel}>RATE</Text>
            <Text style={s.summaryValue}>{rateLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.summaryLabel}>START DATE</Text>
            <Text style={s.summaryValue}>{fmtDate(d.start_date)}</Text>
          </View>
        </View>

        <Text style={s.body}>
          {"THIS AGREEMENT is made as of " + today() + " between "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Johnny Nguyen, trading as JNguyen Co.</Text>
          {" (ABN 17 806 783 014) (\"Company\") and "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{name}</Text>
          {" (\"Contractor\")."}
        </Text>

        <Divider />

        {/* 1 */}
        <Section title="1. Engagement and Services" />
        <Text style={s.body}>
          Company engages Contractor, and Contractor accepts the engagement, to provide the
          services described below (the "Services") on the terms of this Agreement.
        </Text>
        <Field label="Role:"          value={roleLabel} />
        <Field label="Start Date:"    value={fmtDate(d.start_date)} />
        <Field label="Description of Services:" value={
          d.role === "PHOTO_EDITOR"
            ? "Post-production photo editing (culling, colour grading, retouching) of images captured by Company for its clients, delivered to Company's specifications and within agreed turnaround times."
            : "Services as directed by Company from time to time, consistent with the Contractor's role above."
        } />
        {d.notes ? <Field label="Additional Scope Notes:" value={d.notes} /> : null}
        <Text style={s.subheading}>1.1 Independent Contractor Status</Text>
        <Text style={s.body}>
          Contractor is engaged as an independent contractor and not as an employee, agent, or
          partner of Company. Nothing in this Agreement creates an employment relationship.
          Contractor is responsible for their own income tax, GST (if registered), superannuation
          contributions, insurance, and any other statutory obligations arising from this
          engagement. Contractor is free to provide services to other clients, provided this does
          not conflict with Section 4 (Confidentiality) or create a conflict of interest with
          Company's business.
        </Text>

        <Divider />

        {/* 2 */}
        <Section title="2. Payment Terms" />
        <Field label="Rate:" value={rateLabel} />
        <Text style={s.body}>
          {d.rate_type === "HOURLY"
            ? "Contractor will record hours worked and invoice Company at the hourly rate above. "
            : "Contractor will invoice Company the agreed flat fee per project upon completion and delivery of that project's work, unless otherwise agreed in writing. "}
          Company will pay approved invoices within 14 days of receipt via bank transfer.
          Contractor is responsible for including GST on invoices if registered for GST.
          Rates may be varied by mutual written agreement (including email) at any time.
        </Text>

        <Divider />

        {/* 3 */}
        <Section title="3. Ownership of Work Product" />
        <Text style={s.body}>
          All images, edited files, project files, and any other material Contractor creates,
          edits, or delivers under this Agreement ("Work Product") are created as a work made
          for hire for Company to the fullest extent permitted by law. To the extent any Work
          Product is not automatically owned by Company, Contractor hereby assigns to Company,
          absolutely and irrevocably, all right, title and interest (including copyright and
          moral rights, to the extent capable of assignment or waiver under applicable law) in
          the Work Product. Contractor waives any moral rights in the Work Product to the extent
          permitted by law. Contractor may not use, retain, publish, or share any Work Product
          (including in a personal portfolio) without Company's prior written consent.
        </Text>

        <Divider />

        {/* 4 */}
        <Section title="4. Confidentiality" />
        <Text style={s.body}>
          Contractor will, in the course of this engagement, have access to confidential
          information including client photographs and footage, client personal information
          (names, contact details, addresses, event details), pricing, business processes, and
          other non-public business information of Company ("Confidential Information").
          Contractor agrees to: (a) keep all Confidential Information strictly confidential and
          not disclose it to any third party; (b) use Confidential Information solely to perform
          the Services; (c) store client photographs/footage and any files securely and delete
          local copies once a project is delivered and accepted, unless otherwise agreed; and
          (d) not post, share, or publish any client images, footage, or personal information on
          social media, portfolios, or elsewhere without Company's prior written consent. This
          obligation survives termination of this Agreement indefinitely.
        </Text>

        <Divider />

        {/* 5 */}
        <Section title="5. Term and Termination" />
        <Text style={s.subheading}>5.1 Term</Text>
        <Text style={s.body}>
          This Agreement begins on the Start Date above and continues on an ongoing basis until
          terminated in accordance with this Section.
        </Text>
        <Text style={s.subheading}>5.2 Termination</Text>
        <Text style={s.body}>
          Either party may terminate this Agreement at any time, for any reason, by giving the
          other party at least 14 days' written notice (including by email). Company may
          terminate immediately, without notice, if Contractor breaches Section 4
          (Confidentiality) or Section 3 (Ownership of Work Product), or engages in conduct that
          Company reasonably considers harmful to its clients or reputation.
        </Text>
        <Text style={s.subheading}>5.3 Effect of Termination</Text>
        <Text style={s.body}>
          On termination, Contractor will promptly deliver all completed and in-progress Work
          Product to Company, and will delete all copies of client images, footage, and
          Confidential Information from personal devices and accounts, other than a copy retained
          solely as required by law. Company will pay for all Services properly performed and
          invoiced up to the date of termination. Sections 3, 4, 6 and 7 survive termination.
        </Text>

        <Divider />

        {/* 6 */}
        <Section title="6. Indemnity and Liability" />
        <Text style={s.body}>
          Contractor agrees to indemnify Company against any loss, damage, or claim arising from
          Contractor's breach of this Agreement, negligence, or wilful misconduct in performing
          the Services. Neither party's liability under this Agreement will exceed the total
          amount paid or payable to Contractor in the 3 months preceding the event giving rise to
          the claim, except in the case of a breach of Section 4 (Confidentiality).
        </Text>

        <Divider />

        {/* 7 */}
        <Section title="7. General" />
        <Field label="Company's Email:"    value="johnny.nguyen@jnguyen.co" />
        <Field label="Contractor's Email:" value={d.email || "—"} />
        <Field label="Contractor's Phone:" value={d.phone || "—"} />
        <Text style={s.subheading}>7.1 Governing Law</Text>
        <Text style={s.body}>
          This Agreement is governed by the laws of the Australian Capital Territory, Australia,
          and the parties submit to the exclusive jurisdiction of the courts of that territory.
        </Text>
        <Text style={s.subheading}>7.2 Amendment</Text>
        <Text style={s.body}>
          This Agreement may only be amended by written agreement (including email) signed or
          confirmed by both parties.
        </Text>
        <Text style={s.subheading}>7.3 Entire Agreement</Text>
        <Text style={s.body}>
          This Agreement constitutes the entire agreement between the parties regarding the
          Services and supersedes all prior discussions and understandings on this subject.
        </Text>

        <Divider />

        {/* Signatures */}
        <Section title="Signatures" />
        <Text style={s.body}>
          By signing below, both parties confirm they have read and agree to this Agreement.
        </Text>
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <Text style={[s.sigName, { color: TEAL }]}>Contractor</Text>
            <Text style={s.body}>{"Name: " + name}</Text>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature</Text>
            <View style={{ marginTop: 22 }} />
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Date</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={[s.sigName, { color: TEAL }]}>Company</Text>
            <Text style={s.body}>Name: Johnny Nguyen — JNguyen Co.</Text>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature</Text>
            <View style={{ marginTop: 6 }} />
            <Text style={{ fontSize: 8.5, color: NAVY, marginBottom: 3 }}>{today()}</Text>
            <View style={[s.sigLine, { marginTop: 0 }]} />
            <Text style={s.sigLabel}>Date</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};

export async function generateContractorAgreementPDF(
  data: ContractorAgreementData
): Promise<Buffer> {
  return renderToBuffer(<AgreementDoc d={data} />) as Promise<Buffer>;
}
