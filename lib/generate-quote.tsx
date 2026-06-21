/**
 * Server-side quote PDF generation using @react-pdf/renderer.
 * Branded with JNguyen Co. colours — mirrors the contract PDF style.
 */
import React from "react";
import fs from "fs";
import path from "path";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Image,
} from "@react-pdf/renderer";

// ─── Brand colours ─────────────────────────────────────────────────────────────
const NAVY      = "#083a4f";
const SAND      = "#a58d66";
const TEAL      = "#407e8c";
const PALE_BLUE = "#c0d5d6";
const CREAM_BG  = "#f7f4f1";
const WHITE     = "#ffffff";

// ─── Logo image (PNG from public folder) ──────────────────────────────────────
function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "PNG", "LetterHeadSand.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const LOGO_DATA_URI = getLogoDataUri();

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:        { backgroundColor: CREAM_BG, fontFamily: "Helvetica", fontSize: 9, color: NAVY, paddingBottom: 40 },
  header:      { backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 28, paddingBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName:   { color: WHITE, fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  brandSub:    { color: PALE_BLUE, fontSize: 7, marginTop: 2 },
  quoteTag:    { backgroundColor: SAND, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4 },
  quoteTagTxt: { color: WHITE, fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  body:        { paddingHorizontal: 36, paddingTop: 24 },
  metaRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaBlock:   { flex: 1 },
  metaLabel:   { fontSize: 7, color: TEAL, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  metaValue:   { fontSize: 9, color: NAVY, lineHeight: 1.5 },
  metaBold:    { fontSize: 9, color: NAVY, fontFamily: "Helvetica-Bold", lineHeight: 1.6 },
  divider:     { height: 1, backgroundColor: PALE_BLUE, marginVertical: 14 },
  sectionHead: { fontSize: 7, color: TEAL, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  card:        { backgroundColor: WHITE, borderRadius: 6, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: PALE_BLUE },
  row:         { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel:    { fontSize: 9, color: NAVY, flex: 1 },
  rowValue:    { fontSize: 9, color: NAVY, fontFamily: "Helvetica-Bold" },
  bullet:      { fontSize: 8.5, color: NAVY, marginBottom: 3, lineHeight: 1.4 },
  priceTable:  { marginTop: 4 },
  ptRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: PALE_BLUE },
  ptRowLast:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  ptLabel:     { fontSize: 9, color: NAVY },
  ptValue:     { fontSize: 9, color: NAVY, fontFamily: "Helvetica-Bold" },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", backgroundColor: NAVY, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6 },
  totalLabel:  { fontSize: 9, color: PALE_BLUE, fontFamily: "Helvetica-Bold" },
  totalValue:  { fontSize: 11, color: WHITE, fontFamily: "Helvetica-Bold" },
  depositBox:  { backgroundColor: SAND, borderRadius: 4, padding: 10, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  depositLbl:  { fontSize: 8, color: WHITE, fontFamily: "Helvetica-Bold" },
  depositVal:  { fontSize: 12, color: WHITE, fontFamily: "Helvetica-Bold" },
  balBox:      { backgroundColor: PALE_BLUE, borderRadius: 4, padding: 10, marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balLbl:      { fontSize: 8, color: NAVY, fontFamily: "Helvetica-Bold" },
  balVal:      { fontSize: 12, color: NAVY, fontFamily: "Helvetica-Bold" },
  bankCard:    { backgroundColor: NAVY, borderRadius: 6, padding: 14, marginBottom: 12 },
  bankTitle:   { color: SAND, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  bankRow:     { flexDirection: "row", marginBottom: 4 },
  bankLabel:   { color: PALE_BLUE, fontSize: 8, width: 90 },
  bankValue:   { color: WHITE, fontSize: 8, fontFamily: "Helvetica-Bold" },
  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: NAVY, paddingHorizontal: 36, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText:  { color: PALE_BLUE, fontSize: 7 },
  note:        { fontSize: 7.5, color: TEAL, lineHeight: 1.5, marginBottom: 4 },
});

// ─── Data shape ────────────────────────────────────────────────────────────────
export interface QuoteData {
  quote_number:          string;
  quote_date:            string; // e.g. "11 June 2026"
  valid_until:           string; // e.g. "25 June 2026"
  client_name:           string;
  client_email:          string;
  client_phone?:         string;
  event_type:            string;
  event_date?:           string; // e.g. "14 February 2027"
  venue_name?:           string;
  venue_address?:        string;
  package_name?:         string;
  package_deliverables:  string[];
  add_ons?:              Array<{ description: string; amount: number }>;
  quoted_total:          number;
  deposit_percent:       number; // e.g. 30
  deposit_amount:        number;
  balance_amount:        number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 });

// ─── PDF Document ──────────────────────────────────────────────────────────────
function QuoteDoc({ d }: { d: QuoteData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={{ width: 75, height: 60 }} />
            ) : (
              <View>
                <Text style={s.brandName}>JNguyen Co.</Text>
                <Text style={s.brandSub}>Photography &amp; Videography · Canberra</Text>
              </View>
            )}
          </View>
          <View style={s.quoteTag}>
            <Text style={s.quoteTagTxt}>QUOTE</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Meta row */}
          <View style={s.metaRow}>
            <View style={s.metaBlock}>
              <Text style={s.metaLabel}>Prepared For</Text>
              <Text style={s.metaBold}>{d.client_name}</Text>
              <Text style={s.metaValue}>{d.client_email}</Text>
              {d.client_phone ? <Text style={s.metaValue}>{d.client_phone}</Text> : null}
            </View>
            <View style={[s.metaBlock, { alignItems: "flex-end" }]}>
              <Text style={s.metaLabel}>Quote Details</Text>
              <Text style={s.metaValue}>Ref: {d.quote_number}</Text>
              <Text style={s.metaValue}>Date: {d.quote_date}</Text>
              <Text style={[s.metaValue, { color: SAND }]}>Valid Until: {d.valid_until}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Event details */}
          <Text style={s.sectionHead}>Event Details</Text>
          <View style={[s.card, { marginBottom: 14 }]}>
            <View style={s.row}>
              <Text style={s.rowLabel}>Event Type</Text>
              <Text style={s.rowValue}>{d.event_type}</Text>
            </View>
            {d.event_date ? (
              <View style={s.row}>
                <Text style={s.rowLabel}>Event Date</Text>
                <Text style={s.rowValue}>{d.event_date}</Text>
              </View>
            ) : null}
            {d.venue_name ? (
              <View style={s.row}>
                <Text style={s.rowLabel}>Venue</Text>
                <Text style={s.rowValue}>{d.venue_name}</Text>
              </View>
            ) : null}
            {d.venue_address ? (
              <View style={[s.row, { marginBottom: 0 }]}>
                <Text style={s.rowLabel}>Address</Text>
                <Text style={s.rowValue}>{d.venue_address}</Text>
              </View>
            ) : null}
          </View>

          {/* Package & deliverables */}
          <Text style={s.sectionHead}>
            {d.package_name ? `Package — ${d.package_name}` : "Services Quoted"}
          </Text>
          <View style={[s.card, { marginBottom: 14 }]}>
            {d.package_deliverables.map((item, i) => (
              <Text key={i} style={s.bullet}>✓  {item}</Text>
            ))}
            {d.add_ons?.length ? (
              <>
                <View style={[s.divider, { marginVertical: 8 }]} />
                <Text style={[s.metaLabel, { marginBottom: 6 }]}>Add-ons</Text>
                {d.add_ons.map((a, i) => (
                  <View key={i} style={s.row}>
                    <Text style={s.rowLabel}>{a.description}</Text>
                    <Text style={s.rowValue}>{fmt(a.amount)}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>

          {/* Pricing summary */}
          <Text style={s.sectionHead}>Pricing Summary</Text>
          <View style={[s.card, { marginBottom: 14 }]}>
            <View style={s.priceTable}>
              <View style={s.ptRow}>
                <Text style={s.ptLabel}>
                  {d.package_name ?? "Service"}{" "}
                  {d.add_ons?.length ? "+ Add-ons" : ""}
                </Text>
                <Text style={s.ptValue}>{fmt(d.quoted_total)}</Text>
              </View>
              <View style={s.ptRowLast}>
                <Text style={[s.ptLabel, { color: TEAL }]}>GST included where applicable</Text>
                <Text style={s.ptValue}> </Text>
              </View>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Investment</Text>
              <Text style={s.totalValue}>{fmt(d.quoted_total)}</Text>
            </View>
            <View style={s.depositBox}>
              <View>
                <Text style={s.depositLbl}>
                  Deposit Due ({d.deposit_percent}%) — on signing
                </Text>
                <Text style={[s.depositLbl, { fontSize: 7, marginTop: 2, fontFamily: "Helvetica" }]}>
                  Secures your date. Non-refundable.
                </Text>
              </View>
              <Text style={s.depositVal}>{fmt(d.deposit_amount)}</Text>
            </View>
            <View style={s.balBox}>
              <View>
                <Text style={s.balLbl}>Balance Due — after event</Text>
                <Text style={[s.balLbl, { fontSize: 7, marginTop: 2, fontFamily: "Helvetica" }]}>
                  Payable within 7 days of the event date.
                </Text>
              </View>
              <Text style={s.balVal}>{fmt(d.balance_amount)}</Text>
            </View>
          </View>

          {/* Bank transfer details */}
          <View style={s.bankCard}>
            <Text style={s.bankTitle}>Bank Transfer Details</Text>
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Account Name</Text>
              <Text style={s.bankValue}>JNguyen Co.</Text>
            </View>
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Bank</Text>
              <Text style={s.bankValue}>Please request BSB &amp; Account via email</Text>
            </View>
            <View style={s.bankRow}>
              <Text style={s.bankLabel}>Reference</Text>
              <Text style={s.bankValue}>
                {d.client_name}{d.event_date ? ` · ${d.event_date}` : ""}
              </Text>
            </View>
          </View>

          {/* Notes */}
          <Text style={s.note}>
            • This quote is valid for 14 days from the date above. After this date, availability cannot be guaranteed.
          </Text>
          <Text style={s.note}>
            • To proceed, sign and return the Service Agreement, then pay the deposit via bank transfer.
          </Text>
          <Text style={s.note}>
            • Limited bookings are accepted each year to ensure quality. Secure your date early.
          </Text>

        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>JNguyen Co. · Photography &amp; Videography · Canberra ACT</Text>
          <Text style={s.footerText}>johnny.nguyen@jnguyen.co · jnguyen.co</Text>
        </View>

      </Page>
    </Document>
  );
}

// ─── Package deliverable lists ─────────────────────────────────────────────────
export const PACKAGE_DELIVERABLES: Record<string, string[]> = {
  "Mini Wedding / Elopement": [
    "1 Photographer & 1 Videographer (up to 4 hours)",
    "200–350 professionally edited images",
    "3–5 minute cinematic highlight film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Online gallery via Google Drive",
  ],
  "Full Day Essential": [
    "1 Photographer & 1 Videographer (up to 8 hours)",
    "400–600 professionally edited images",
    "5–7 minute cinematic highlight film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Full ceremony coverage",
    "Online gallery via Google Drive",
  ],
  "Full Day Premium": [
    "2 Photographers & 2 Videographers (up to 13 hours)",
    "700–1,000 professionally edited images",
    "6–8 minute cinematic film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Full ceremony coverage",
    "Full speeches coverage",
    "Online gallery via Google Drive",
  ],
  "Hourly Photography": [
    "1 Photographer",
    "80–150 professionally edited images per hour",
    "Online gallery via Google Drive (delivered within 1–2 weeks)",
  ],
  "Hourly Photo + Video": [
    "1 Photographer & 1 Videographer",
    "80–150 professionally edited images per hour",
    "Short event highlight (1–3 min)",
    "Online gallery via Google Drive (delivered within 2–3 weeks)",
  ],
};

export const DEFAULT_DELIVERABLES = [
  "Professional photography and/or videography as agreed",
  "Fully edited images and/or film delivered via Google Drive",
  "Online gallery access",
];

// ─── Export function ───────────────────────────────────────────────────────────
export async function generateQuotePDF(data: QuoteData): Promise<Buffer> {
  return renderToBuffer(<QuoteDoc d={data} />) as Promise<Buffer>;
}
