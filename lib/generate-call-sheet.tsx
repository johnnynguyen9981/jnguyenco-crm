/**
 * Server-side "Call Sheet" (Booking Confirmation for Crew) PDF generation
 * using @react-pdf/renderer. This is the operational, contractor-facing
 * companion to lib/generate-contractor-agreement.tsx (the legal Independent
 * Contractor Agreement) — it's what gets sent to a second photographer,
 * videographer, or other crew member once they're assigned to a specific
 * booking, so they know where to be, when, for how long, at what rate, and
 * what the shot list / special notes are. English only (operational doc,
 * not a legal document, so no bilingual requirement like the agreement).
 * Branded with JNguyen Co. brand colors and real logo — same visual system
 * as lib/generate-contract.tsx and lib/generate-contractor-agreement.tsx.
 */
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Svg, Path, Font,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Font registration ──────────────────────────────────────
// Font.register() itself never throws for a bad/missing path — it just
// records the family name -> source mapping. The actual file read happens
// later, lazily, the first time renderToBuffer() needs to embed that font's
// glyphs — which is outside this function entirely, so a missing file used
// to surface as an uncaught ENOENT deep inside rendering, failing the whole
// call sheet with no useful error. Checking existsSync first and simply not
// registering a font whose file isn't there means that family falls back to
// PDF's built-in Helvetica instead of crashing the request.
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const register = (family: string, file: string, fontWeight: number) => {
    const src = path.join(process.cwd(), "public", "fonts", file);
    if (!fs.existsSync(src)) {
      console.error(`[generate-call-sheet] Font file missing, falling back to Helvetica for "${family}":`, src);
      return;
    }
    try {
      Font.register({ family, fonts: [{ src, fontWeight }] });
    } catch (e) {
      console.error(`[generate-call-sheet] Font.register failed for "${family}":`, e);
    }
  };
  register("DMSerifDisplay", "DMSerifDisplay-Regular.woff", 400);
  register("Montserrat", "Montserrat-Regular.ttf", 400);
  register("Montserrat-SemiBold", "Montserrat-SemiBold.ttf", 600);
  fontsRegistered = true;
}
registerFonts();

// ─── Brand colours (matches lib/generate-contract.tsx) ──────
const NAVY      = "#4F210D";
const SAND      = "#864C2C";
const TEAL      = "#864C2C";
const PALE_BLUE = "#305B7E";
const CREAM_BG  = "#FAF9F6";
const MIDNIGHT_NAVY = "#071524";
const STEEL_BLUE    = "#1E3653";
const GREEN      = "#2E7D46";
const AMBER      = "#B5730A";

// ─── Logo (vector, embedded inline) ──────────────────────────
const LOGO_VIEWBOX = "0 0 2030.38 1627.14";
const JNguyenLogo = ({ width, height, fill }: { width: number; height: number; fill: string }) => (
  <Svg viewBox={LOGO_VIEWBOX} style={{ width, height }}>
    <Path fill={fill} d="M1338.7,590.11c-.3-13.45-1.13-25.89-2.79-38.03l-186.91,186.91-62.06-62.01,219.07-219.07c-10.05-20.98-23.11-44.74-39.86-73.15l-235.69,235.69-62.06-62.01,251.36-251.36c-11.36-19.06-23.98-40.3-37.21-62.54l-264.02,264.02-62.01-62.06,279.82-279.82c-36.82-62.1-72.24-121.81-92.69-156.4-8.14-13.71-27.98-13.71-36.08,0-19.8,33.42-53.48,90.3-88.99,150.09-49.92,84.21-103.35,174.2-126.51,212.67-23.15,38.6-39.78,68.84-51.61,95-22.19,48.96-27.72,83.6-28.16,131.69-.04,2.26-.04,4.53-.04,6.83,0,39.73,0,127.29,93.04,220.33,29.81,29.81,60.71,50.13,89.73,63.97,61.53,29.37,114.5,29.55,129.99,29.03l1.13-.09c15.14.52,66.02.35,125.72-27.02,30.24-13.88,62.75-34.73,94-65.97,93.04-93.04,93.04-180.6,93.04-220.33,0-5.61-.04-11.05-.22-16.36Z" />
    <Path fill={fill} d="M0,1495.43c11.2-1.07,20.46-4.34,27.8-9.8,7.33-5.47,12.93-14.54,16.8-27.2,3.86-12.67,5.8-29.94,5.8-51.8v-219.2c0-10.13-.74-17.46-2.2-22-1.47-4.53-4.27-7.6-8.4-9.2-4.14-1.6-10.6-2.66-19.4-3.2v-8c13.33.8,33.46,1.2,60.4,1.2s48.53-.4,63.2-1.2v8c-9.07.54-15.6,1.6-19.6,3.2-4,1.6-6.74,4.67-8.2,9.2-1.47,4.54-2.2,11.87-2.2,22v170.8c0,37.6-2.27,64.27-6.8,80-5.6,19.46-17.54,35.2-35.8,47.2-18.27,12-42.07,18-71.4,18v-8Z" />
    <Path fill={fill} d="M472,1153.03c-8.8,1.34-15.27,3.6-19.4,6.8-4.14,3.2-6.94,8.27-8.4,15.2-1.47,6.94-2.2,17.2-2.2,30.8v223.2l-9.6-.4-10.8.4-173.6-220v153.6c0,15.74.8,27.27,2.4,34.6,1.6,7.34,5.06,12.67,10.4,16,5.33,3.34,14,5.67,26,7v8c-10.4-.8-24.8-1.2-43.2-1.2-14.67,0-26.27.4-34.8,1.2v-8c8.8-1.33,15.26-3.6,19.4-6.8,4.13-3.2,6.93-8.26,8.4-15.2,1.46-6.93,2.2-17.2,2.2-30.8v-180c0-10.13-.74-17.46-2.2-22-1.47-4.53-4.27-7.6-8.4-9.2-4.14-1.6-10.6-2.66-19.4-3.2v-8c8.53.8,20.13,1.2,34.8,1.2,13.33,0,24.8-.4,34.4-1.2l154.8,190.8v-125.2c0-15.73-.8-27.26-2.4-34.6-1.6-7.33-5.07-12.66-10.4-16-5.34-3.33-14-5.66-26-7v-8c10.4.8,24.8,1.2,43.2,1.2,14.93,0,26.53-.4,34.8-1.2v8Z" />
    <Path fill={fill} d="M724.6,1146.22c11.33,4.54,22.46,10.94,33.4,19.2,3.2,2.4,5.86,3.6,8,3.6,2.66,0,4.8-1.93,6.4-5.8,1.6-3.86,2.8-9.93,3.6-18.2h9.2c-1.07,18.14-1.6,50.4-1.6,96.8h-9.2c-2.14-18.13-5.27-32.8-9.4-44-4.14-11.2-11-20.66-20.6-28.4-6.4-6.13-14.27-10.93-23.6-14.4-9.34-3.46-18.94-5.2-28.8-5.2-18.67,0-34.2,6.34-46.6,19-12.4,12.67-21.54,29.4-27.4,50.2-5.87,20.8-8.8,43.6-8.8,68.4,0,92.27,25.6,138.4,76.8,138.4,11.73,0,21.2-2.66,28.4-8,3.46-2.4,5.93-5.2,7.4-8.4,1.46-3.2,2.2-7.33,2.2-12.4v-39.2c0-12.53-1.07-21.66-3.2-27.4-2.14-5.73-5.94-9.66-11.4-11.8-5.47-2.13-14.07-3.46-25.8-4v-8c16.53.8,39.33,1.2,68.4,1.2,23.73,0,41.6-.4,53.6-1.2v8c-5.34.54-9.2,1.6-11.6,3.2s-4.07,4.67-5,9.2c-.94,4.54-1.4,11.87-1.4,22v79.2h-8c-.27-5.6-1.4-10.8-3.4-15.6-2-4.8-4.74-7.2-8.2-7.2-4.54,0-11.74,2.8-21.6,8.4-23.2,13.34-45.07,20-65.6,20-46.14,0-81.47-12.6-106-37.8-24.54-25.2-36.8-60.6-36.8-106.2,0-29.86,6.2-56.13,18.6-78.8,12.4-22.66,29.53-40.26,51.4-52.8,21.86-12.53,46.8-18.8,74.8-18.8,16.53,0,30.46,2.27,41.8,6.8Z" />
    <Path fill={fill} d="M1123.19,1153.03c-8.8,1.34-15.27,3.6-19.4,6.8-4.14,3.2-6.94,8.27-8.4,15.2-1.47,6.94-2.2,17.2-2.2,30.8v106c0,38.14-5.47,66.4-16.4,84.8-7.2,11.74-17.6,20.87-31.2,27.4-13.6,6.53-30.27,9.8-50,9.8-30.94,0-54.94-6.66-72-20-12.27-9.86-20.54-22.33-24.8-37.4-4.27-15.06-6.4-36.2-6.4-63.4v-125.6c0-10.13-.74-17.46-2.2-22-1.47-4.53-4.27-7.6-8.4-9.2-4.14-1.6-10.6-2.66-19.4-3.2v-8c13.6.8,34.4,1.2,62.4,1.2s48.93-.4,63.6-1.2v8c-9.6.54-16.6,1.6-21,3.2-4.4,1.6-7.4,4.67-9,9.2-1.6,4.54-2.4,11.87-2.4,22v150.8c0,28,4.06,48.6,12.2,61.8,8.13,13.2,22.46,19.8,43,19.8,26.66,0,45.46-9,56.4-27,10.93-18,16.4-43.53,16.4-76.6v-105.6c0-15.46-.94-26.93-2.8-34.4-1.87-7.46-5.47-12.86-10.8-16.2-5.34-3.33-13.74-5.66-25.2-7v-8c10.13.8,24.53,1.2,43.2,1.2,14.93,0,26.53-.4,34.8-1.2v8Z" />
    <Path fill={fill} d="M1417.19,1144.63v8c-12.27,5.07-25.07,20.54-38.4,46.4l-47.2,93.6v93.2c0,10.14.73,17.47,2.2,22,1.46,4.54,4.2,7.6,8.2,9.2s10.53,2.67,19.6,3.2v8c-14.4-.8-34.94-1.2-61.6-1.2-28.54,0-49.2.4-62,1.2v-8c8.8-.53,15.26-1.6,19.4-3.2,4.13-1.6,6.93-4.66,8.4-9.2,1.46-4.53,2.2-11.86,2.2-22v-67.6l-77.2-142.8c-8.27-14.93-16-22.4-23.2-22.4v-8.4c11.73,1.34,27.46,2,47.2,2,24.8,0,49.86-.66,75.2-2v8.4c-9.34,0-16.74.87-22.2,2.6-5.47,1.74-8.2,4.87-8.2,9.4,0,2.4.93,5.34,2.8,8.8l60.8,117.2,31.2-62.4c10.4-21.06,15.6-37.6,15.6-49.6,0-9.06-2.87-15.6-8.6-19.6-5.74-4-13.94-6.26-24.6-6.8v-8c18.13.8,34.8,1.2,50,1.2,12.26,0,22.4-.4,30.4-1.2Z" />
    <Path fill={fill} d="M1695.18,1428.22c-18.14-.8-48.67-1.2-91.6-1.2-58.14,0-101.6.4-130.4,1.2v-8c8.8-.53,15.26-1.6,19.4-3.2,4.13-1.6,6.93-4.66,8.4-9.2,1.46-4.53,2.2-11.86,2.2-22v-198.4c0-10.13-.74-17.46-2.2-22-1.47-4.53-4.27-7.6-8.4-9.2-4.14-1.6-10.6-2.66-19.4-3.2v-8c28.8.8,72.26,1.2,130.4,1.2,39.2,0,67.06-.4,83.6-1.2-1.87,22.14-2.8,41.87-2.8,59.2,0,11.74.4,20.8,1.2,27.2h-9.2c-4-28.53-11.2-48.53-21.6-60-10.4-11.46-25.07-17.2-44-17.2h-16.4c-8.27,0-14.27.67-18,2-3.74,1.34-6.27,3.94-7.6,7.8-1.34,3.87-2,10.07-2,18.6v99.2h12.8c14.13,0,24.86-5.2,32.2-15.6,7.33-10.4,12.46-22.8,15.4-37.2h9.2c-.8,11.2-1.2,23.74-1.2,37.6v19.2c0,13.6.8,32.54,2.4,56.8h-9.2c-5.6-35.2-21.87-52.8-48.8-52.8h-12.8v100.8c0,8.54.66,14.74,2,18.6,1.33,3.87,3.86,6.47,7.6,7.8,3.73,1.34,9.73,2,18,2h19.6c18.93,0,34.2-6.46,45.8-19.4,11.6-12.93,19.8-34.86,24.6-65.8h9.2c-.8,8.8-1.2,20-1.2,33.6,0,24.54.93,44.8,2.8,60.8Z" />
    <Path fill={fill} d="M2030.38,1153.03c-8.8,1.34-15.27,3.6-19.4,6.8-4.14,3.2-6.94,8.27-8.4,15.2-1.47,6.94-2.2,17.2-2.2,30.8v223.2l-9.6-.4-10.8.4-173.6-220v153.6c0,15.74.8,27.27,2.4,34.6,1.6,7.34,5.06,12.67,10.4,16,5.33,3.34,14,5.67,26,7v8c-10.4-.8-24.8-1.2-43.2-1.2-14.67,0-26.27.4-34.8,1.2v-8c8.8-1.33,15.26-3.6,19.4-6.8,4.13-3.2,6.93-8.26,8.4-15.2,1.46-6.93,2.2-17.2,2.2-30.8v-180c0-10.13-.74-17.46-2.2-22-1.47-4.53-4.27-7.6-8.4-9.2-4.14-1.6-10.6-2.66-19.4-3.2v-8c8.53.8,20.13,1.2,34.8,1.2,13.33,0,24.8-.4,34.4-1.2l154.8,190.8v-125.2c0-15.73-.8-27.26-2.4-34.6-1.6-7.33-5.07-12.66-10.4-16-5.34-3.33-14-5.66-26-7v-8c10.4.8,24.8,1.2,43.2,1.2,14.93,0,26.53-.4,34.8-1.2v8Z" />
    <Path fill={fill} d="M934.99,1533.84c-11.4-14.4-27.9-18.6-39-18.6-23.1,0-44.1,16.2-44.1,46.5s21.6,46.2,43.8,46.2c12.9,0,28.8-5.7,40.2-19.5v25.8c-13.5,9.9-27.9,12.9-39.6,12.9-38.7,0-66.6-27.6-66.6-65.1s28.2-66,66.6-66c19.8,0,32.7,7.8,38.7,12v25.8Z" />
    <Path fill={fill} d="M991.09,1561.74c0-37.8,27.9-65.7,66-65.7s66,27.9,66,65.7-28.2,65.4-66,65.4-66-27.6-66-65.4ZM1013.29,1561.74c0,30.6,21.6,46.2,43.8,46.2s43.8-15.9,43.8-46.2-21-46.5-43.8-46.5-43.8,16.2-43.8,46.5Z" />
    <Path fill={fill} d="M1199.88,1596.54c8.1,0,15,6.9,15,15s-6.9,15-15,15-15-6.9-15-15,6.9-15,15-15Z" />
  </Svg>
);

// ─── Data shape ──────────────────────────────────────────────
export interface CallSheetCrewMember {
  name: string;
  role: string; // already label-formatted
}

export interface CallSheetData {
  contractor_name: string;
  contractor_role: string;    // already label-formatted, e.g. "Photographer"
  contractor_email?: string | null;
  contractor_phone?: string | null;

  agreed_rate?: number | null;
  rate_type?: "HOURLY" | "PER_PROJECT" | null;
  confirmed: boolean;

  client_name: string;
  service_type: string;       // already label-formatted, e.g. "Wedding"
  package_name?: string | null;

  event_date: string;         // "YYYY-MM-DD"
  start_time?: string | null; // "HH:MM:SS" or "HH:MM"
  end_time?: string | null;

  venue_name?: string | null;
  venue_address?: string | null;

  shot_list?: string | null;
  special_requests?: string | null;

  crew: CallSheetCrewMember[]; // other crew on this booking (excludes this contractor)

  company_contact_name: string;
  company_contact_phone: string;
  company_contact_email: string;
}

// ─── Formatting helpers ──────────────────────────────────────
function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "TBC";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(timeStr?: string | null): string {
  if (!timeStr) return "TBC";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${period}`;
}

function fmtRate(amount?: number | null, rateType?: "HOURLY" | "PER_PROJECT" | null): string {
  if (amount == null) return "TBD — confirm with Johnny";
  const base = "$" + Number(amount).toLocaleString("en-AU");
  if (rateType === "HOURLY") return base + "/hr";
  if (rateType === "PER_PROJECT") return base + " (flat fee)";
  return base;
}

function generatedOn(): string {
  return new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Montserrat",
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
  rulePrimary:   { borderBottomWidth: 1.5, borderBottomColor: MIDNIGHT_NAVY, marginBottom: 1.5 },
  ruleAccent:    { borderBottomWidth: 0.5, borderBottomColor: TEAL, marginBottom: 10 },
  docTitle: {
    textAlign: "center",
    fontFamily: "DMSerifDisplay",
    fontSize: 15, color: NAVY, letterSpacing: 1.5, marginBottom: 2,
  },
  docSubtitle: { textAlign: "center", fontSize: 8, color: "#888", marginBottom: 12 },
  statusBadge: {
    alignSelf: "center",
    fontSize: 7.5,
    fontFamily: "Montserrat-SemiBold",
    color: "#fff",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: CREAM_BG, borderRadius: 5, padding: "10 14", marginBottom: 12,
    borderLeftWidth: 2.5, borderLeftColor: STEEL_BLUE, flexDirection: "row", justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 6.5, color: TEAL, fontFamily: "Montserrat-SemiBold", marginBottom: 2, letterSpacing: 0.5 },
  summaryValue: { fontSize: 9.5, color: NAVY, fontFamily: "Montserrat-SemiBold" },
  summarySub:   { fontSize: 7.5, color: "#666" },
  sectionRow:   { flexDirection: "row", alignItems: "center", marginTop: 11, marginBottom: 5 },
  sectionBar:   { width: 2.5, height: 12, backgroundColor: PALE_BLUE, marginRight: 6, borderRadius: 1.5 },
  sectionText:  { fontFamily: "DMSerifDisplay", fontSize: 13, color: NAVY, letterSpacing: 0.5 },
  body:    { lineHeight: 1.55, marginBottom: 3.5, color: "#1a2e3a" },
  field:   { flexDirection: "row", marginBottom: 4.5, alignItems: "flex-start" },
  label:   { fontFamily: "Montserrat-SemiBold", width: 130, flexShrink: 0, fontSize: 8, color: SAND },
  value:   { flex: 1, fontSize: 9, color: NAVY },
  divider: { borderBottomWidth: 0.5, borderBottomColor: PALE_BLUE, marginVertical: 6 },
  noteBox: { backgroundColor: CREAM_BG, borderRadius: 4, padding: "8 10", marginBottom: 4 },
  noteLabel: { fontSize: 7, fontFamily: "Montserrat-SemiBold", color: TEAL, marginBottom: 2, letterSpacing: 0.5 },
  noteText:  { fontSize: 8.5, lineHeight: 1.5, color: "#1a2e3a" },
  crewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f0ece7" },
  crewName: { fontSize: 8.5, fontFamily: "Montserrat-SemiBold", color: NAVY },
  crewRole: { fontSize: 8, color: "#777" },
  footer:      { position: "absolute", bottom: "0.7cm", left: "1.8cm", right: "1.8cm" },
  footerRule:  { borderTopWidth: 0.5, borderTopColor: PALE_BLUE, marginBottom: 3 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between" },
  footerLeft:  { fontSize: 6.5, color: "#aaa" },
  footerRight: { fontSize: 6.5, color: PALE_BLUE },
});

const Header = () => (
  <View fixed>
    <View style={s.header}>
      <JNguyenLogo width={75} height={60} fill={MIDNIGHT_NAVY} />
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
      <Text style={s.footerLeft}>JNguyen Co. Photography &amp; Videography · Canberra, Australia · johnny.nguyen@jnguyen.co · www.jnguyen.co</Text>
      <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
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

const CallSheetPage = ({ d }: { d: CallSheetData }) => {
  const dateStr  = fmtDate(d.event_date);
  const timeStr  = d.start_time
    ? `${fmtTime(d.start_time)} – ${d.end_time ? fmtTime(d.end_time) : "TBC"}`
    : "TBC";
  const venue = [d.venue_name, d.venue_address].filter(Boolean).join(" — ") || "TBC";

  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Footer />

      <Text style={s.docTitle}>BOOKING CONFIRMATION — CALL SHEET</Text>
      <Text style={s.docSubtitle}>Prepared for {d.contractor_name} · Generated {generatedOn()}</Text>

      <Text style={[
        s.statusBadge,
        { backgroundColor: d.confirmed ? GREEN : AMBER },
      ]}>
        {d.confirmed ? "CONFIRMED BOOKING" : "PENDING CONFIRMATION"}
      </Text>

      <View style={s.summaryCard}>
        <View>
          <Text style={s.summaryLabel}>YOUR ROLE</Text>
          <Text style={s.summaryValue}>{d.contractor_role}</Text>
        </View>
        <View>
          <Text style={s.summaryLabel}>EVENT DATE</Text>
          <Text style={s.summaryValue}>{dateStr}</Text>
        </View>
        <View>
          <Text style={s.summaryLabel}>CALL TIME</Text>
          <Text style={s.summaryValue}>{d.start_time ? fmtTime(d.start_time) : "TBC"}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.summaryLabel}>AGREED RATE</Text>
          <Text style={s.summaryValue}>{fmtRate(d.agreed_rate, d.rate_type)}</Text>
        </View>
      </View>

      <Text style={s.body}>
        Hi {d.contractor_name.split(" ")[0]}, here are the details for your upcoming shoot with JNguyen Co.
        Please review everything below and reach out if anything needs clarifying before the day.
      </Text>

      <Divider />

      <View wrap={false}>
        <Section title="Event Details" />
        <Field label="Client:"       value={d.client_name} />
        <Field label="Service Type:" value={d.service_type} />
        {d.package_name ? <Field label="Package:" value={d.package_name} /> : null}
        <Field label="Date:"         value={dateStr} />
        <Field label="Time:"         value={timeStr} />
        <Field label="Venue:"        value={venue} />
      </View>

      <Divider />

      <View wrap={false}>
        <Section title="Your Role &amp; Rate" />
        <Field label="Role:"          value={d.contractor_role} />
        <Field label="Agreed Rate:"   value={fmtRate(d.agreed_rate, d.rate_type)} />
        <Field label="Status:"        value={d.confirmed ? "Confirmed" : "Pending confirmation"} />
      </View>

      {(d.shot_list || d.special_requests) && (
        <View wrap={false}>
          <Divider />
          <Section title="Shot List &amp; Special Notes" />
          {d.shot_list && (
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>SHOT LIST / MUST-HAVE MOMENTS</Text>
              <Text style={s.noteText}>{d.shot_list}</Text>
            </View>
          )}
          {d.special_requests && (
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>SPECIAL NOTE</Text>
              <Text style={s.noteText}>{d.special_requests}</Text>
            </View>
          )}
        </View>
      )}

      {d.crew.length > 0 && (
        <View wrap={false}>
          <Divider />
          <Section title="Crew On This Booking" />
          <Text style={[s.body, { marginBottom: 6 }]}>You&apos;ll be working alongside:</Text>
          {d.crew.map((c, i) => (
            <View key={i} style={s.crewRow}>
              <Text style={s.crewName}>{c.name}</Text>
              <Text style={s.crewRole}>{c.role}</Text>
            </View>
          ))}
        </View>
      )}

      <View wrap={false}>
        <Divider />
        <Section title="On-the-Day Contact" />
        <Field label="Contact:" value={d.company_contact_name} />
        <Field label="Phone:"   value={d.company_contact_phone} />
        <Field label="Email:"   value={d.company_contact_email} />

        <Text style={[s.body, { marginTop: 14, color: "#666" }]}>
          Thanks for being part of the team — looking forward to working together on this one.
        </Text>
      </View>
    </Page>
  );
};

export async function generateCallSheetPDF(data: CallSheetData): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Call Sheet – ${data.contractor_name}`} author="JNguyen Co.">
      <CallSheetPage d={data} />
    </Document>
  ) as Promise<Buffer>;
}
