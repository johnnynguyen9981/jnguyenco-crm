/**
 * Server-side contract PDF generation using @react-pdf/renderer.
 * Branded with JNguyen Co. brand colors and real logo.
 */
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Image,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Brand colours ─────────────────────────────────────────
const NAVY      = "#083a4f";
const SAND      = "#a58d66";
const TEAL      = "#407e8c";
const PALE_BLUE = "#c0d5d6";
const CREAM_BG  = "#f7f4f1";

// ─── Logo image (PNG from public folder) ───────────────────
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

// ─── Package metadata ──────────────────────────────────────
const PACKAGES: Record<string, { hours: number | null; images: string | null; fee: number | null; label: string }> = {
  pkg_mini:     { hours: 4,    images: "200–350",   fee: 1600, label: "Mini Wedding / Elopement" },
  pkg_full8:    { hours: 8,    images: "400–600",   fee: 3200, label: "Full Day Essential" },
  pkg_full13:   { hours: 13,   images: "700–1,000", fee: 4800, label: "Full Day Premium" },
  pkg_hourly:   { hours: null, images: null,         fee: null, label: "Event Photography Only" },
  pkg_combo:    { hours: null, images: null,         fee: null, label: "Event Photography & Videography" },
  pkg_portrait: { hours: null, images: null,         fee: null, label: "Portrait Session" },
  pkg_unsure:   { hours: null, images: null,         fee: null, label: "TBD – to be advised" },
};

// ─── Team per package ──────────────────────────────────────
const PACKAGE_TEAM: Record<string, string> = {
  pkg_mini:     "1 Photographer & 1 Videographer",
  pkg_full8:    "1 Photographer & 1 Videographer",
  pkg_full13:   "2 Photographers & 2 Videographers",
  pkg_hourly:   "1 Photographer",
  pkg_combo:    "1 Photographer & 1 Videographer",
  pkg_portrait: "1 Photographer",
  pkg_unsure:   "To be confirmed",
};

// ─── Deliverables included per package ────────────────────
const PACKAGE_DELIVERABLES_LIST: Record<string, string[]> = {
  pkg_mini: [
    "200–350 professionally edited high-resolution images",
    "3–5 minute cinematic highlight film",
    "Next-day teaser (30–60 sec vertical reel for social media)",
    "Full ceremony coverage",
    "Online gallery delivery via Google Drive (download link)",
  ],
  pkg_full8: [
    "400–600 professionally edited high-resolution images",
    "5–7 minute cinematic highlight film",
    "Next-day teaser (30–60 sec vertical reel for social media)",
    "Full ceremony & reception coverage",
    "Online gallery delivery via Google Drive (download link)",
  ],
  pkg_full13: [
    "700–1,000 professionally edited high-resolution images",
    "6–8 minute cinematic film",
    "Next-day teaser (30–60 sec vertical reel for social media)",
    "Full ceremony, speeches & reception coverage",
    "Online gallery delivery via Google Drive (download link)",
    "Raw footage add-on (uncut ceremony — if requested and included in package)",
  ],
  pkg_hourly: [
    "60+ professionally edited high-resolution images per hour",
    "Online gallery delivery via Google Drive (download link)",
    "Final delivery within 4–8 weeks after the event",
  ],
  pkg_combo: [
    "60+ professionally edited high-resolution images per hour",
    "2–3 minute cinematic event highlight reel",
    "Full event video coverage",
    "Online gallery delivery via Google Drive (download link)",
    "Final delivery within 4–8 weeks after the event",
  ],
  pkg_portrait: [
    "Professionally edited high-resolution images",
    "Online gallery delivery via Google Drive (download link)",
    "Final delivery within 4–8 weeks after the session",
  ],
  pkg_unsure: [
    "Deliverables to be mutually confirmed in writing prior to the event",
  ],
};

// ─── Delivery timeline per package ────────────────────────
const PACKAGE_TIMELINE: Record<string, string[]> = {
  pkg_mini: [
    "Teaser reel — within 24–48 hours after the event",
    "Photo gallery (200–350 images) — within 4 weeks after the event",
    "Highlight film (3–5 min) — within 6 weeks after the event",
  ],
  pkg_full8: [
    "Teaser reel — within 24–48 hours after the event",
    "Photo gallery (400–600 images) — within 6 weeks after the event",
    "Highlight film (5–7 min) — within 8 weeks after the event",
  ],
  pkg_full13: [
    "Teaser reel — within 24–48 hours after the event",
    "Photo gallery (700–1,000 images) — within 6 weeks after the event",
    "Highlight film (6–8 min) — within 8 weeks after the event",
    "Raw footage (if included) — within 8 weeks after the event",
  ],
  pkg_hourly: [
    "Photo gallery (60+ images per hour) — within 4–8 weeks after the event",
  ],
  pkg_combo: [
    "Photo gallery (60+ images per hour) — within 4–8 weeks after the event",
    "Event highlight reel (2–3 min) + full event video — within 4–8 weeks after the event",
  ],
  pkg_portrait: [
    "Edited photo gallery — within 4–8 weeks after the session",
  ],
  pkg_unsure: [
    "Delivery timeline to be mutually agreed in writing prior to the event",
  ],
};

export interface EnquiryData {
  full_name?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  guest_count?: string;
  venue?: string;
  suburb?: string;
  pkg_mini?: string;
  pkg_full8?: string;
  pkg_full13?: string;
  pkg_hourly?: string;
  pkg_combo?: string;
  pkg_unsure?: string;
  pkg_portrait?: string;
  package_name?: string;
  svc_photo?: string;
  svc_video?: string;
  svc_both?: string;
  additional_info?: string;
  special_requests?: string;
  // Explicit pricing — override package-derived values when supplied
  total_fee?: string | number;
  deposit_amount?: string | number;
  remaining_balance?: string | number;
  // Original package list price (set when a discount is applied so the contract can show both)
  list_price?: string | number;
}

function resolvePackage(d: EnquiryData) {
  for (const key of ["pkg_mini","pkg_full8","pkg_full13","pkg_hourly","pkg_combo","pkg_portrait","pkg_unsure"] as const) {
    if (d[key] === "Yes") return { key, ...PACKAGES[key] };
  }
  return null;
}

function resolveServices(d: EnquiryData) {
  if (d.svc_both  === "Yes") return "Photography & Videography";
  if (d.svc_video === "Yes") return "Videography";
  return "Photography";
}

function fmt(amount: number | null) {
  if (amount == null) return "TBD";
  return "$" + amount.toLocaleString("en-AU");
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function fmtDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return d + "/" + m + "/" + y;
}

/** "HH:MM" (24-hr) → "h:MM AM/PM" */
function fmtTime(timeStr?: string): string {
  if (!timeStr) return "TBD";
  const [hStr, mStr] = timeStr.split(":");
  if (!hStr || !mStr) return timeStr;
  const h   = parseInt(hStr, 10);
  const min = mStr.padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return h12 + ":" + min + " " + ampm;
}

function today() {
  return new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Styles ────────────────────────────────────────────────
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
  summaryFee:   { fontSize: 13, color: NAVY, fontFamily: "Helvetica-Bold" },
  sectionRow:   { flexDirection: "row", alignItems: "center", marginTop: 9, marginBottom: 4 },
  sectionBar:   { width: 2.5, height: 12, backgroundColor: TEAL, marginRight: 6, borderRadius: 1.5 },
  sectionText:  { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: NAVY, letterSpacing: 0.5 },
  subheading:   { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: TEAL, marginTop: 5, marginBottom: 2 },
  body:    { lineHeight: 1.55, marginBottom: 3.5, color: "#1a2e3a" },
  bullet:  { marginLeft: 10, marginBottom: 2, lineHeight: 1.5 },
  field:   { flexDirection: "row", marginBottom: 3.5, alignItems: "flex-start" },
  label:   { fontFamily: "Helvetica-Bold", width: 145, flexShrink: 0, fontSize: 7.5, color: SAND },
  value:   { flex: 1, fontSize: 8.5, color: NAVY },
  divider: { borderBottomWidth: 0.5, borderBottomColor: PALE_BLUE, marginVertical: 6 },
  bankRow:   { flexDirection: "row", marginBottom: 2 },
  bankLabel: { width: 110, fontFamily: "Helvetica-Bold", fontSize: 8, color: SAND },
  bankValue: { fontSize: 8.5, color: NAVY },
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

// ─── Header (fixed on all pages) ──────────────────────────
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

// ─── Footer (absolute, fixed on all pages) ────────────────
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

// ─── Section title ─────────────────────────────────────────
const Section = ({ title }: { title: string }) => (
  <View style={s.sectionRow}>
    <View style={s.sectionBar} />
    <Text style={s.sectionText}>{title}</Text>
  </View>
);

// ─── Field row ─────────────────────────────────────────────
const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value || "—"}</Text>
  </View>
);

// ─── Divider ───────────────────────────────────────────────
const Divider = () => <View style={s.divider} />;

// ─── Summary card ──────────────────────────────────────────
const SummaryCard = ({ d, pkg, svc, total, deposit, remaining, listPrice, discountPct, discountAmt }: {
  d: EnquiryData;
  pkg: ReturnType<typeof resolvePackage>;
  svc: string;
  total: number | null;
  deposit: number | null;
  remaining: number | null;
  listPrice: number | null;
  discountPct: number | null;
  discountAmt: number | null;
}) => (
  <View style={s.summaryCard}>
    <View>
      <Text style={s.summaryLabel}>CLIENT</Text>
      <Text style={s.summaryValue}>{d.full_name || "—"}</Text>
      <Text style={s.summarySub}>{d.email || ""}</Text>
    </View>
    <View>
      <Text style={s.summaryLabel}>EVENT DATE</Text>
      <Text style={s.summaryValue}>{fmtDate(d.event_date)}</Text>
      <Text style={s.summarySub}>{d.event_type || ""}</Text>
    </View>
    <View>
      <Text style={s.summaryLabel}>PACKAGE</Text>
      <Text style={s.summaryValue}>{d.package_name || pkg?.label || svc || "—"}</Text>
      <Text style={s.summarySub}>{svc}</Text>
    </View>
    <View style={{ alignItems: "flex-end" }}>
      <Text style={s.summaryLabel}>TOTAL FEE</Text>
      {listPrice != null && discountPct != null && (
        <Text style={[s.summarySub, { textDecoration: "line-through", color: "#999" }]}>{fmt(listPrice)}</Text>
      )}
      <Text style={s.summaryFee}>{fmt(total)}</Text>
      {discountPct != null && discountAmt != null && (
        <Text style={[s.summarySub, { color: "#2a7a4b" }]}>{discountPct + "% off · saves " + fmt(discountAmt)}</Text>
      )}
      <Text style={s.summarySub}>{"Deposit: " + fmt(deposit)}</Text>
      <Text style={s.summarySub}>{"Remaining: " + fmt(remaining)}</Text>
    </View>
  </View>
);

// ─── Contract document ─────────────────────────────────────
const ContractDoc = ({ d, signatureDataUri, clientSignatureDataUri, clientSignedAt }: {
  d: EnquiryData;
  signatureDataUri: string | null;
  clientSignatureDataUri?: string | null;
  clientSignedAt?: string | null;
}) => {
  const pkg       = resolvePackage(d);
  const svc       = resolveServices(d);

  // Explicit pricing takes priority; fall back to package-based calculation
  const total     = d.total_fee       != null ? Number(d.total_fee)       : (pkg?.fee ?? null);
  const deposit   = d.deposit_amount  != null ? Number(d.deposit_amount)  : (total != null ? Math.round(total * 0.3) : null);
  const remaining = d.remaining_balance != null ? Number(d.remaining_balance) : (total != null && deposit != null ? total - deposit : null);

  // Discount pricing
  const listPrice   = d.list_price != null ? Number(d.list_price) : null;
  const hasDiscount = listPrice != null && total != null && listPrice > total;
  const discountAmt = hasDiscount ? listPrice - total : null;
  const discountPct = hasDiscount && listPrice > 0 ? Math.round((1 - total / listPrice) * 100) : null;

  const location   = [d.venue, d.suburb].filter(Boolean).join(", ") || "—";
  const hours      = pkg?.hours ?? null;
  const images     = pkg?.images ?? null;
  const clientName = d.full_name || "—";

  // Pre-compute deliverable and timeline arrays (avoids complex ternaries in JSX)
  const deliverablesList: string[] =
    (pkg?.key && PACKAGE_DELIVERABLES_LIST[pkg.key])
      ? PACKAGE_DELIVERABLES_LIST[pkg.key]
      : images
        ? ["Delivery of " + images + " professionally edited high-resolution images",
           "Online gallery delivery via Google Drive (download link)"]
        : ["Online gallery delivery via Google Drive (download link)"];

  const timelineList: string[] =
    (pkg?.key && PACKAGE_TIMELINE[pkg.key])
      ? PACKAGE_TIMELINE[pkg.key]
      : ["All deliverables to be mutually agreed in writing prior to the event"];

  const coverage = hours
    ? hours + " consecutive hours  ·  " + fmtTime(d.start_time) + " – " + fmtTime(d.end_time)
    : fmtTime(d.start_time) + " – " + fmtTime(d.end_time);

  return (
    <Document title={"Photography Contract – " + clientName} author="JNguyen Co.">
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.contractTitle}>PHOTOGRAPHY SERVICES AGREEMENT</Text>
        <Text style={s.contractSubtitle}>{"Agreement Date: " + today()}</Text>

        <SummaryCard d={d} pkg={pkg} svc={svc} total={total} deposit={deposit} remaining={remaining}
          listPrice={listPrice} discountPct={discountPct} discountAmt={discountAmt} />

        <Text style={s.body}>
          {"THIS AGREEMENT is made as of " + today() + " between "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{clientName}</Text>
          {" (\"Client\") and "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Johnny Nguyen</Text>
          {" (\"Photographer\")."}
        </Text>

        <Divider />

        {/* 1 */}
        <Section title="1. Engagement of Photographer" />
        <Text style={s.subheading}>1.1 Services</Text>
        <Text style={s.body}>
          Subject to the terms set out herein, Client engages Photographer to provide, and
          Photographer agrees to provide, the photography services described in this Section 1.1
          (the "Services").
        </Text>
        <Field label="Date of Event:"           value={fmtDate(d.event_date)} />
        <Field label="Location of Event:"       value={location} />
        <Field label="Description of Services:" value={pkg ? svc + " — " + (d.package_name || pkg.label) : svc} />
        <Field label="Coverage Time:"           value={coverage} />
        {d.special_requests ? (
          <Field label="Special Requests:"      value={d.special_requests} />
        ) : null}
        <Text style={s.body}>
          As part of the Services, the Photographer will produce or take similar action to
          create materials from Images and provide related deliverables pursuant to the
          provision of the Services ("Work Product"). "Images" means photographic material,
          whether still or moving, created by Photographer pursuant to this Agreement and
          includes transparencies, negatives, prints or digital files, captured, recorded,
          stored or delivered in any type of analogue, photographic, optical, electronic,
          magnetic, digital or any other medium.
        </Text>
        <Text style={s.subheading}>1.2 Exclusivity</Text>
        <Text style={s.body}>
          Client acknowledges and agrees that Photographer will be the exclusive provider of
          the Services in coverage of the Event, unless otherwise agreed to by the parties in
          writing.
        </Text>

        <Divider />

        {/* 2 */}
        <Section title="2. Fees and Deposit" />
        <Text style={s.subheading}>2.1 Fees</Text>
        <Text style={s.body}>
          Client will pay Photographer the fees set out herein in this Section 2.1 ("Fees"),
          including any applicable federal or state/provincial sales or value-added taxes due
          on such Fees.
        </Text>
        {hasDiscount && listPrice != null && (
          <Field label="Standard Package Rate:" value={fmt(listPrice)} />
        )}
        {hasDiscount && discountPct != null && discountAmt != null && (
          <Field label="Discount Applied:" value={discountPct + "% off — you save " + fmt(discountAmt)} />
        )}
        <Field label="Total Fee for Services:"  value={fmt(total)} />
        <Field label="Additional Hourly Rate:"  value="$100 per hour" />
        <Field label="Deposit due on signing:"  value={fmt(deposit)} />
        <Field label="Remaining balance due:"   value={fmt(remaining) + " — due at end of event day (" + fmtDate(d.event_date) + ")"} />
        <Text style={s.subheading}>2.2 Late Payment</Text>
        <Text style={s.body}>
          Any outstanding balance not paid within 7 days of the due date will incur a late
          fee of 1.5% per month (or the maximum permitted by law, whichever is less) on the
          outstanding amount, calculated from the due date until the date of payment in full.
        </Text>
        <Text style={s.subheading}>2.3 Deposit</Text>
        <Text style={s.body}>
          Client acknowledges and agrees that the deposit amount set out above is due upon
          the signing of this Agreement and is not refundable ("Deposit"), so as to fairly
          compensate Photographer for committing his/her time to provide the Services and
          turning down other potential projects or clients. Both parties agree that the
          Deposit will be credited towards the total Fees payable by Client.
        </Text>

        <Divider />

        {/* 3 */}
        <Section title="3. Package Inclusions and Deliverables" />
        <Text style={s.body}>
          The Photographer agrees to provide the following services and deliverables as part of the package selected below. All deliverables listed are included in the agreed fee unless explicitly stated as optional or subject to add-on.
        </Text>
        <Field label="Package Selected:"   value={d.package_name || pkg?.label || svc || "—"} />
        {pkg?.key ? <Field label="Coverage Team:"    value={PACKAGE_TEAM[pkg.key] ?? "—"} /> : null}
        {hours    ? <Field label="Coverage Duration:" value={hours + " consecutive hours"} /> : null}

        <Text style={s.subheading}>What's Included:</Text>
        <View>
          {deliverablesList.map((item, i) => (
            <Text key={i} style={s.bullet}>{"•  " + item}</Text>
          ))}
          {d.additional_info
            ? <Text style={s.bullet}>{"•  Additional notes: " + d.additional_info}</Text>
            : null}
        </View>

        <Text style={s.subheading}>Delivery Timeline:</Text>
        <View>
          {timelineList.map((item, i) => (
            <Text key={i} style={s.bullet}>{"•  " + item}</Text>
          ))}
        </View>

        <View style={[s.notice, { marginTop: 6 }]}>
          <Text style={s.noticeText}>
            All deliverables will be sent via a Google Drive download link once final payment has been cleared. Gallery passwords are not used — the link is shared directly and securely.
          </Text>
        </View>

        <Divider />

        {/* 4 */}
        <Section title="4. Delivery and Delays" />
        <Text style={s.body}>
          All delivery timelines are as specified in Section 3 above. Deliverables will be sent via the Google Drive link only after the full balance has been cleared. In the event that circumstances beyond the Photographer's control (illness, equipment failure, extreme weather) cause a delay, the Photographer will notify the Client in writing as soon as practicable and provide a revised delivery date.
        </Text>

        <Divider />

        {/* 5 */}
        <Section title="5. Photo Editing and Revisions" />
        <Text style={s.body}>
          After you receive your edited photos, you'll have up to 7 days to share your
          feedback. We're happy to provide one round of re-edits free of charge. If you'd
          like further adjustments beyond that, an additional fee of $15 per photo or $250
          per video will apply.
        </Text>

        <Divider />

        {/* 6 */}
        <Section title="6. Client Responsibilities" />
        <Text style={s.subheading}>6.1 Required Consents</Text>
        <Text style={s.body}>
          Client will ensure that all required consents, as applicable, have been obtained
          prior to performance of the Services, including any consents required for the
          performance of Services and the delivery of Work Product by Photographer and, as
          applicable, from venues or locales where the Services are to be performed or from
          attendees of the event.
        </Text>
        <Text style={s.subheading}>6.2 Expenses</Text>
        <Text style={s.body}>
          Client will provide the means of travel or be responsible for reasonable travel
          expenses incurred by Photographer that are necessary for the performance of the
          Services or travel that is otherwise requested by Client where the location of the
          performance of the Services is not in the city of Canberra, Australia.
        </Text>
        <Text style={s.subheading}>6.3 Waiver</Text>
        <Text style={s.body}>
          Client (on behalf of himself/herself and any other participant whose image or
          recording may be captured by the Services) hereby waives all rights and claims,
          and releases Photographer from any claim or cause of action, whether now known or
          unknown, relating to the sale, display, license, use and exploitation of Images
          pursuant to this Agreement.
        </Text>
        <Text style={s.subheading}>6.4 Model Release</Text>
        <Text style={s.body}>
          Client (on behalf of himself/herself and all persons whose likeness is captured
          during the Services) hereby grants Photographer an irrevocable, worldwide,
          royalty-free licence to use, display, publish and reproduce any Images containing
          Client's or any attendee's likeness for the purposes of Photographer's portfolio,
          website, social media, and general marketing and promotional materials. Client
          warrants that they have obtained consent from all attendees over the age of 18 and
          from the parent or guardian of any minors whose likeness may be captured.
        </Text>

        <Divider />

        {/* 7 */}
        <Section title="7. Photographer Responsibilities" />
        <Text style={s.subheading}>7.1 Equipment</Text>
        <Text style={s.body}>
          Client will not be required to supply any photography equipment to Photographer.
        </Text>
        <Text style={s.subheading}>7.2 Manner of Service</Text>
        <Text style={s.body}>
          Photographer will ensure that the Services are performed in a good, expedient,
          workmanlike and safe manner, and in such a manner as to avoid unreasonable
          interference with Client's activities.
        </Text>
        <Text style={s.subheading}>7.3 Photography Staff</Text>
        <Text style={s.body}>
          Photographer will, and will ensure that all Photography Staff (employees,
          assistants or other parties engaged by Photographer to assist with the Services):
          comply with the reasonable directions of Client regarding the safety of attendees
          and applicable health, safety and security requirements of any locations where the
          Services are provided; and ensure that Work Product meets the specifications set
          out in Section 1.1 in all material respects. Photographer will be responsible in
          every respect for the actions of all Photography Staff.
        </Text>

        <Divider />

        {/* 8 */}
        <Section title="8. Artistic Release" />
        <Text style={s.subheading}>8.1 Consistency</Text>
        <Text style={s.body}>
          Photographer will use reasonable efforts to ensure that the Services are produced
          in a style consistent with Photographer's current portfolio, and Photographer will
          use reasonable efforts to consult with Client and incorporate any reasonable
          suggestions.
        </Text>
        <Text style={s.subheading}>8.2 Style</Text>
        <Text style={s.body}>Client acknowledges and agrees that:</Text>
        <Text style={s.bullet}>
          {"•  Client has reviewed Photographer's previous work and portfolio and has a" +
          " reasonable expectation that Photographer will perform the Services in a similar style;"}
        </Text>
        <Text style={s.bullet}>
          {"•  Photographer will use its artistic judgement when providing the Services," +
          " and shall have final say regarding the aesthetic judgement and artistic quality; and"}
        </Text>
        <Text style={s.bullet}>
          {"•  Disagreement with Photographer's aesthetic judgement or artistic ability are" +
          " not valid reasons for termination of this Agreement or request of any monies returned."}
        </Text>

        <Divider />

        {/* 9 */}
        <Section title="9. Term and Termination" />
        <Text style={s.subheading}>9.1 Term</Text>
        <Text style={s.body}>
          This Agreement will begin on the Effective Date and continue until the latter of
          (i) the date where all outstanding Fees under this Agreement are paid in full; or
          (ii) the date where all final Work Product has been delivered ("Term").
        </Text>
        <Text style={s.subheading}>9.2 Cancellation</Text>
        <Text style={s.body}>
          Client may terminate the Agreement ("Cancellation") and/or reschedule the Services
          ("Rescheduling") by providing Photographer with written notice no later than 30
          days before the original date of the Event (the "Minimum Notice"). Client
          acknowledges and agrees that Client is not relieved of any payment obligations for
          Cancellations and Rescheduling unless the Minimum Notice is duly provided or unless
          the parties otherwise agree in writing.
        </Text>
        <Text style={s.subheading}>9.3 Rescheduling</Text>
        <Text style={s.body}>
          In the event of Rescheduling, Photographer will use commercially reasonable
          efforts to accommodate Client's change. If Photographer is not able to accommodate
          Client's change despite using commercially reasonable efforts, the parties agree
          that such Rescheduling will be deemed as Cancellation by Client and that
          Photographer will be under no obligation to perform the Services other than on the
          original date of the event.
        </Text>
        <Text style={s.subheading}>9.4 No Refund</Text>
        <Text style={s.body}>
          Client acknowledges and agrees that Cancellation by Client will not result in a
          refund of any fees paid on or prior to the date of Cancellation by Client.
        </Text>
        <Text style={s.subheading}>9.5 Replacement</Text>
        <Text style={s.body}>
          In the event that Photographer is unable to perform the Services, Photographer,
          subject to Client's consent (not to be unreasonably withheld), shall cause a
          replacement photographer to perform the Services. In the event that such consent
          is not obtained, Photographer shall terminate this Agreement and shall return the
          Deposit and all fees paid by Client, and thereafter shall have no further liability
          to Client.
        </Text>

        <Divider />

        {/* 10 */}
        <Section title="10. Ownership of Work Product" />
        <Text style={s.body}>
          Photographer will own all right, title and interest in all Work Product. Client
          hereby grants Photographer and any of its service providers an exclusive,
          royalty-free, worldwide, irrevocable, transferable and sublicensable license to
          use any materials created by Client or attendees during the performance of the
          Services that may be protected by copyright ("Event Materials") as part of any
          Work Product or in connection with the marketing, advertising or promotion of
          Photographer's services, including in connection with Photographer's studio,
          portfolio, website or social media, in any format or medium.
        </Text>

        <Divider />

        {/* 11 */}
        <Section title="11. Limited License to Client" />
        <View style={s.notice}>
          <Text style={s.noticeText}>
            In plain terms: You are free to share and print your photos for personal use,
            including on your personal social media accounts. You may not sell them or use
            them for commercial purposes without the Photographer's written consent.
          </Text>
        </View>
        <Text style={s.subheading}>11.1 Personal Use</Text>
        <Text style={s.body}>
          Photographer hereby grants Client an exclusive, limited, irrevocable, royalty-free,
          non-transferable and non-sublicensable license to use Work Product for Client's
          Personal Use, provided that Client does not remove any attribution or copyright
          notices included by Photographer. "Personal Use" includes use of photos on Client's
          personal social media pages; in personal creations such as scrapbooks or albums;
          in non-commercial physical display; and in personal communications such as family
          newsletter, email, or holiday card. Client will not make any other use of the Work
          Product without Photographer's prior written consent, including use of the Work
          Product for commercial sale.
        </Text>

        <Divider />

        {/* 12 */}
        <Section title="12. Indemnity and Limitation of Liability" />
        <Text style={s.subheading}>12.1 Indemnification</Text>
        <Text style={s.body}>
          Client agrees to indemnify, defend and hold harmless Photographer and its
          affiliates, employees, agents and independent contractors for any injury, property
          damage, liability, claim or other cause of action arising out of or related to the
          Services and/or Work Product Photographer provides to Client.
        </Text>
        <Text style={s.subheading}>12.2 Force Majeure</Text>
        <Text style={s.body}>
          Neither party shall be held in breach of or liable under this Agreement for any
          delay or non-performance caused by illness, emergency, fire, strike, pandemic,
          earthquake, or any other conditions beyond the reasonable control of the
          non-performing party. If such event persists for more than 60 days, the party not
          affected may terminate the Agreement and any prepaid fees for Services not
          performed (other than the Deposit) shall be returned within 15 days of termination.
        </Text>
        <Text style={s.subheading}>12.3 Failure to Deliver</Text>
        <Text style={s.body}>
          Photographer shall not be held liable for delays in the delivery of Work Product
          due to technological malfunctions, service interruptions beyond the control of
          Photographer, or for Work Product that fails to meet specifications due to the
          actions of Client or attendees that are beyond the control of Photographer.
        </Text>
        <Text style={s.subheading}>12.4 Maximum Liability</Text>
        <Text style={s.body}>
          Notwithstanding anything to the contrary, Client agrees that Photographer's
          maximum liability arising out of or related to the Services or the Work Product
          shall not exceed the total Fees payable under this Agreement.
        </Text>

        <Divider />

        {/* 13 */}
        <Section title="13. General" />
        <Text style={s.subheading}>13.1 Notice</Text>
        <Field label="Photographer's Email:" value="johnny.nguyen@jnguyen.co" />
        <Field label="Photographer's Website:" value="https://www.jnguyen.co" />
        <Field label="Client's Email:"        value={d.email || "—"} />
        <Field label="Client's Phone:"        value={d.phone || "—"} />
        <Text style={s.subheading}>13.2 Survival</Text>
        <Text style={s.body}>Articles 10, 11, 12 and 13 will survive termination of this Agreement.</Text>
        <Text style={s.subheading}>13.3 Governing Law</Text>
        <Text style={s.body}>
          This Agreement will be governed by the laws of the Australian Capital Territory,
          Australia, and the parties submit to the exclusive jurisdiction of the courts of
          that territory.
        </Text>
        <Text style={s.subheading}>13.4 Amendment</Text>
        <Text style={s.body}>
          This Agreement may only be amended, supplemented or otherwise modified by written
          agreement signed by each of the parties.
        </Text>
        <Text style={s.subheading}>13.5 Entire Agreement</Text>
        <Text style={s.body}>
          This Agreement constitutes the entire agreement between the parties with respect
          to the Services and supersedes all prior agreements and understandings both formal
          and informal.
        </Text>
        <Text style={s.subheading}>13.6 Dispute Resolution</Text>
        <Text style={s.body}>
          In the event of any dispute arising out of or in connection with this Agreement,
          the parties agree to first attempt to resolve the dispute through good faith
          negotiation. If the dispute is not resolved within 14 days of written notice, the
          parties agree to submit the dispute to mediation before commencing any legal
          proceedings. The costs of mediation shall be shared equally unless otherwise
          agreed.
        </Text>
        <Text style={s.subheading}>13.7 Severability</Text>
        <Text style={s.body}>
          If any provision of this Agreement is determined to be illegal, invalid or
          unenforceable by any court of competent jurisdiction, that provision or part
          thereof will be severed from this Agreement and all other provisions will continue
          in full force and effect.
        </Text>

        <Divider />

        {/* Payment */}
        <Section title="Payment Details" />
        <View style={s.notice}>
          <Text style={s.noticeText}>
            Please use your name as the payment reference. Payment by direct bank transfer:
          </Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>Account Name:</Text>
          <Text style={s.bankValue}>Thanh Nhan Nguyen</Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>BSB:</Text>
          <Text style={s.bankValue}>082-902</Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>Account Number:</Text>
          <Text style={s.bankValue}>890398777</Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>Deposit Amount:</Text>
          <Text style={[s.bankValue, { fontFamily: "Helvetica-Bold", color: TEAL }]}>
            {fmt(deposit)}
          </Text>
        </View>

        <Divider />

        {/* Signatures */}
        <Section title="Signatures" />
        <Text style={s.body}>
          By signing below, both parties confirm they have read and agree to this Agreement.
        </Text>
        <View style={s.sigRow}>
          {/* ── Client block ── */}
          <View style={s.sigBlock}>
            <Text style={[s.sigName, { color: TEAL }]}>Client</Text>
            <Text style={s.body}>{"Name: " + clientName}</Text>
            {clientSignatureDataUri ? (
              <Image
                src={clientSignatureDataUri}
                style={{ width: 110, height: 50, objectFit: "contain", marginTop: 2 }}
              />
            ) : null}
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature</Text>
            <View style={{ marginTop: 6 }} />
            {clientSignedAt ? (
              <Text style={{ fontSize: 8.5, color: NAVY, marginBottom: 3 }}>
                {new Date(clientSignedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            ) : null}
            <View style={[s.sigLine, { marginTop: clientSignedAt ? 0 : 14 }]} />
            <Text style={s.sigLabel}>Date</Text>
          </View>

          {/* ── Photographer block — digital signature + date ── */}
          <View style={s.sigBlock}>
            <Text style={[s.sigName, { color: TEAL }]}>Photographer</Text>
            <Text style={s.body}>Name: Johnny Nguyen — JNguyen Co.</Text>
            {/* Digital signature image */}
            {signatureDataUri ? (
              <Image
                src={signatureDataUri}
                style={{ width: 110, height: 50, objectFit: "contain", marginTop: 2 }}
              />
            ) : null}
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature (Digital)</Text>
            <View style={{ marginTop: 6 }} />
            {/* Pre-filled date */}
            <Text style={{ fontSize: 8.5, color: NAVY, marginBottom: 3 }}>{today()}</Text>
            <View style={[s.sigLine, { marginTop: 0 }]} />
            <Text style={s.sigLabel}>Date</Text>
          </View>
        </View>

      </Page>
    </Documen