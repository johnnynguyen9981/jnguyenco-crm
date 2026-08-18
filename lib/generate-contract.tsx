/**
 * Server-side contract PDF generation using @react-pdf/renderer.
 * Branded with JNguyen Co. brand colors and real logo.
 */
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Svg, Path, Font,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Font registration ──────────────────────────────────────
// JNguyen Co. brand type system: DM Serif Display for headings/titles,
// Montserrat for body copy and labels. Both are embedded locally (rather
// than loaded from Google Fonts CDN) since react-pdf renders server-side.
// Montserrat's files here are merged (fonttools) Latin+Vietnamese glyph
// sets so any Vietnamese contractor/client names still render correctly.
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: "DMSerifDisplay",
      fonts: [{ src: path.join(process.cwd(), "public", "fonts", "DMSerifDisplay-Regular.woff"), fontWeight: 400 }],
    });
    Font.register({
      family: "Montserrat",
      fonts: [{ src: path.join(process.cwd(), "public", "fonts", "Montserrat-Regular.ttf"), fontWeight: 400 }],
    });
    Font.register({
      family: "Montserrat-SemiBold",
      fonts: [{ src: path.join(process.cwd(), "public", "fonts", "Montserrat-SemiBold.ttf"), fontWeight: 600 }],
    });
    fontsRegistered = true;
  } catch (e) {
    console.error("[generate-contract] Font registration failed, falling back to Helvetica:", e);
  }
}
registerFonts();

// ─── Brand colours — JNguyen Co. editorial brand system ────
// Kept the original variable names (NAVY/SAND/TEAL/PALE_BLUE/CREAM_BG) so
// every downstream style reference below is unaffected; only the hex
// values changed, remapped onto the new palette by role:
//   NAVY      -> Dark Chestnut/Espresso  (headings, high-emphasis text)
//   SAND/TEAL -> Warm Terracotta         (labels, subheads, sig highlights)
//   PALE_BLUE -> Muted Slate Blue        (dividers, subtle borders)
//   CREAM_BG  -> Feather White           (card/notice backgrounds)
const NAVY      = "#4F210D";
const SAND      = "#864C2C";
const TEAL      = "#864C2C";
const PALE_BLUE = "#305B7E";
const CREAM_BG  = "#FAF9F6";
// New additions, used for a handful of specific accents below:
const MIDNIGHT_NAVY = "#071524"; // strong header rule + logo fill
const STEEL_BLUE    = "#1E3653"; // summary card panel accent

// ─── Logo (vector, embedded inline) ─────────────────────────
// Rendered directly from the brand SVG's path data (public/Logo/LogoNavy.svg)
// rather than a rasterised PNG, so it stays crisp at any size and recolours
// cleanly to the new Midnight Navy brand ink with no extra image tooling.
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
    "Online gallery delivery via Google Drive (download link)",
    "Final delivery within 4–8 weeks after the event",
  ],
  pkg_combo: [
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
  // When true, overrides the standard 6.4 Model Release grant — Photographer
  // will NOT use this Client's Images for portfolio/website/social media/
  // marketing purposes. Set per-booking for clients who request privacy.
  no_portfolio_marketing_use?: boolean;
  // Explicit pricing — override package-derived values when supplied
  total_fee?: string | number;
  deposit_amount?: string | number;
  remaining_balance?: string | number;
  // Original package list price (set when a discount is applied so the contract can show both)
  list_price?: string | number;
  // Real package data pulled live from the `packages` table (preferred source —
  // set by fill-contract route whenever the booking has a package_id). When
  // present, this drives Section 3 directly instead of the legacy pkg_* +
  // hardcoded-table lookup below, so editing a package's team/deliverables/
  // timeline in the Packages admin page is reflected in the next contract
  // generated, with no code changes required.
  pkgData?: {
    hours?: number | null;
    fee?: number | null;
    images?: string | null;
    // Per-hour min/max photo counts for hourly (Event) packages — multiplied
    // by hoursBooked below to show the real total for this specific booking
    // instead of a generic "per hour" rate in Section 3's "What's Included".
    photoCountMin?: number | null;
    photoCountMax?: number | null;
    team?: string | null;
    deliverables?: string[] | null;
    timeline?: string[] | null;
  };
  // Actual hours booked for this booking (from bookings.hours_booked) —
  // distinct from pkgData.hours, which is a package's fixed max_hours and is
  // null for hourly/Event packages. Used to compute real deliverable totals.
  hoursBooked?: number | string | null;
}

// Legacy fallback per-hour photo counts (mirrors the live DB packages —
// see Packages admin) for the rare case a contract is generated before a
// booking/package_id exists (raw uploaded enquiry PDF path).
const LEGACY_HOURLY_PHOTO_RATE: Record<string, { min: number; max: number }> = {
  pkg_hourly: { min: 50, max: 80 },
  pkg_combo:  { min: 50, max: 80 },
};

function resolvePackage(d: EnquiryData) {
  if (d.pkgData) {
    return {
      key: null as string | null,
      hours: d.pkgData.hours ?? null,
      images: d.pkgData.images ?? null,
      photoCountMin: d.pkgData.photoCountMin ?? null,
      photoCountMax: d.pkgData.photoCountMax ?? null,
      fee: d.pkgData.fee ?? null,
      label: d.package_name || "Package",
      team: d.pkgData.team || null,
      deliverables: d.pkgData.deliverables && d.pkgData.deliverables.length ? d.pkgData.deliverables : null,
      timeline: d.pkgData.timeline && d.pkgData.timeline.length ? d.pkgData.timeline : null,
    };
  }
  // Legacy fallback — used only when no live DB package data is available
  // (e.g. a contract generated from a raw uploaded enquiry PDF before a
  // booking/package_id exists yet).
  for (const key of ["pkg_mini","pkg_full8","pkg_full13","pkg_hourly","pkg_combo","pkg_portrait","pkg_unsure"] as const) {
    if (d[key] === "Yes") {
      const rate = LEGACY_HOURLY_PHOTO_RATE[key];
      return {
        key,
        ...PACKAGES[key],
        photoCountMin: rate?.min ?? null,
        photoCountMax: rate?.max ?? null,
        team: PACKAGE_TEAM[key] ?? null,
        deliverables: PACKAGE_DELIVERABLES_LIST[key] ?? null,
        timeline: PACKAGE_TIMELINE[key] ?? null,
      };
    }
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
  contractTitle: {
    textAlign: "center", fontFamily: "DMSerifDisplay",
    fontSize: 11, color: NAVY, letterSpacing: 2, marginBottom: 2,
  },
  contractSubtitle: { textAlign: "center", fontSize: 7.5, color: "#888", marginBottom: 10 },
  summaryCard: {
    backgroundColor: CREAM_BG, borderRadius: 5, padding: "8 12", marginBottom: 10,
    borderLeftWidth: 2.5, borderLeftColor: STEEL_BLUE, flexDirection: "row", justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 6.5, color: TEAL, fontFamily: "Montserrat-SemiBold", marginBottom: 2, letterSpacing: 0.5 },
  summaryValue: { fontSize: 8.5, color: NAVY, fontFamily: "Montserrat-SemiBold" },
  summarySub:   { fontSize: 7, color: "#666" },
  summaryFee:   { fontSize: 13, color: NAVY, fontFamily: "Montserrat-SemiBold" },
  sectionRow:   { flexDirection: "row", alignItems: "center", marginTop: 9, marginBottom: 4 },
  sectionBar:   { width: 2.5, height: 12, backgroundColor: PALE_BLUE, marginRight: 6, borderRadius: 1.5 },
  sectionText:  { fontFamily: "DMSerifDisplay", fontSize: 13, color: NAVY, letterSpacing: 0.5 },
  subheading:   { fontFamily: "Montserrat-SemiBold", fontSize: 8.5, color: TEAL, marginTop: 5, marginBottom: 2 },
  body:    { lineHeight: 1.55, marginBottom: 3.5, color: "#1a2e3a" },
  bullet:  { marginLeft: 10, marginBottom: 2, lineHeight: 1.5 },
  field:   { flexDirection: "row", marginBottom: 3.5, alignItems: "flex-start" },
  label:   { fontFamily: "Montserrat-SemiBold", width: 145, flexShrink: 0, fontSize: 7.5, color: SAND },
  value:   { flex: 1, fontSize: 8.5, color: NAVY },
  divider: { borderBottomWidth: 0.5, borderBottomColor: PALE_BLUE, marginVertical: 6 },
  bankRow:   { flexDirection: "row", marginBottom: 2 },
  bankLabel: { width: 110, fontFamily: "Montserrat-SemiBold", fontSize: 8, color: SAND },
  bankValue: { fontSize: 8.5, color: NAVY },
  sigRow:    { flexDirection: "row", marginTop: 18, gap: 30 },
  sigBlock:  { flex: 1 },
  sigName:   { fontFamily: "Montserrat-SemiBold", fontSize: 8.5, color: NAVY, marginBottom: 2 },
  sigLine:   { borderBottomWidth: 0.75, borderBottomColor: NAVY, marginTop: 22, marginBottom: 3 },
  sigLabel:  { fontSize: 7, color: "#888" },
  footer:      { position: "absolute", bottom: "0.7cm", left: "1.8cm", right: "1.8cm" },
  footerRule:  { borderTopWidth: 0.5, borderTopColor: PALE_BLUE, marginBottom: 3 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between" },
  footerLeft:  { fontSize: 6.5, color: "#aaa" },
  footerRight: { fontSize: 6.5, color: PALE_BLUE },
  notice:     { backgroundColor: CREAM_BG, padding: "5 8", borderRadius: 3, marginVertical: 5 },
  noticeText: { fontSize: 7.5, color: "#555", lineHeight: 1.5 },
});

// ─── Header (fixed on all pages) ──────────────────────────
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
interface ContractDocProps {
  d: EnquiryData;
  signatureDataUri: string | null;
  clientSignatureDataUri?: string | null;
  clientSignedAt?: string | null;
}
const ContractDoc = ({ d, signatureDataUri, clientSignatureDataUri, clientSignedAt }: ContractDocProps) => {
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
  const hours      = pkg?.hours ?? null;        // fixed package duration (Wedding/Portrait) — null for hourly packages
  const images     = pkg?.images ?? null;
  const clientName = d.full_name || "—";

  // Hourly (Event) packages have no fixed `hours` — the real duration comes
  // from the booking itself (hours_booked). Multiply the package's per-hour
  // photo count by the actual hours booked so Section 3 shows a real total
  // for this booking (e.g. "200–320 images") instead of a generic per-hour rate.
  const bookedHours = d.hoursBooked != null && d.hoursBooked !== "" ? Number(d.hoursBooked) : null;
  const isHourlyPkg = hours == null;
  const photoMin = pkg?.photoCountMin ?? null;
  const photoMax = pkg?.photoCountMax ?? null;
  const computedImagesLine: string | null =
    isHourlyPkg && bookedHours != null && bookedHours > 0 && photoMin != null
      ? (photoMax != null && photoMax !== photoMin
          ? Math.round(photoMin * bookedHours) + "–" + Math.round(photoMax * bookedHours) + " professionally edited high-resolution images"
          : Math.round(photoMin * bookedHours) + "+ professionally edited high-resolution images")
      : null;

  // Pre-compute deliverable and timeline arrays (avoids complex ternaries in JSX)
  const deliverablesList: string[] = (() => {
    const rawBase =
      pkg?.deliverables && pkg.deliverables.length
        ? pkg.deliverables
        : images
          ? ["Delivery of " + images + " professionally edited high-resolution images",
             "Online gallery delivery via Google Drive (download link)"]
          : ["Online gallery delivery via Google Drive (download link)"];

    // When we've computed a real image total for this booking's actual hours,
    // drop the package's generic "per hour" rate bullet so the contract
    // doesn't show both the rate and the computed total side by side.
    const base = computedImagesLine
      ? rawBase.filter((line: string) => !(/\bper hour\b/i.test(line) && /\bimages?\b/i.test(line)))
      : rawBase;

    return computedImagesLine ? [computedImagesLine, ...base] : base;
  })();

  const timelineList: string[] =
    pkg?.timeline && pkg.timeline.length
      ? pkg.timeline
      : ["All deliverables to be mutually agreed in writing prior to the event"];

  const coverageHoursLabel = bookedHours != null
    ? bookedHours + " hour" + (bookedHours === 1 ? "" : "s")
    : null;

  const coverage = hours
    ? hours + " consecutive hours  ·  " + fmtTime(d.start_time) + " – " + fmtTime(d.end_time)
    : coverageHoursLabel
      ? coverageHoursLabel + "  ·  " + fmtTime(d.start_time) + " – " + fmtTime(d.end_time)
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
          <Text style={{ fontFamily: "Montserrat-SemiBold" }}>{clientName}</Text>
          {" (\"Client\") and "}
          <Text style={{ fontFamily: "Montserrat-SemiBold" }}>Johnny Nguyen</Text>
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
        {pkg?.team ? <Field label="Coverage Team:"    value={pkg.team} /> : null}
        {hours
          ? <Field label="Coverage Duration:" value={hours + " consecutive hours"} />
          : coverageHoursLabel
            ? <Field label="Coverage Duration:" value={coverageHoursLabel + " (hourly booking)"} />
            : null}

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
            All deliverables will be delivered via a private Google Drive download link once final payment has been cleared. Gallery passwords are not used — the link is shared directly and securely. The download link remains active for 3 months from the date of delivery, after which all files are permanently deleted. Please download and back up your files promptly. See Section 4 for full details.
          </Text>
        </View>

        <Divider />

        {/* 4 */}
        <Section title="4. Digital Delivery & Media Access" />
        <Text style={s.subheading}>4.1 Delivery Method</Text>
        <Text style={s.body}>
          All final deliverables — edited images (JPEG format) and highlight film (MP4 format) — will be
          delivered exclusively via a private shared Google Drive download link ("Gallery Link"). The Gallery
          Link will be issued to the Client at the email address provided in this Agreement once the full
          balance has been cleared. Gallery passwords are not used; the link is shared directly and securely.
        </Text>
        <Text style={s.subheading}>4.2 Access Window</Text>
        <Text style={s.body}>
          The Gallery Link will remain active for a period of three (3) calendar months from the date of
          actual delivery ("Access Period"). The Client is solely responsible for downloading all files
          before the Access Period expires. The Photographer will send a reminder notification to the
          Client's registered email address approximately 14 days prior to expiry as a courtesy; however,
          failure to send such reminder does not extend the Access Period or affect the Photographer's
          obligations under this Agreement.
        </Text>
        <Text style={s.subheading}>4.3 Permanent Deletion — No Recovery</Text>
        <Text style={s.body}>
          Upon expiry of the Access Period, the Gallery Link will be permanently disabled and all
          associated files will be permanently deleted from the Photographer's storage. The Photographer
          is under no obligation to retain, recover, re-upload or re-deliver any files after this date.
          No refund or compensation will be provided for files not downloaded within the Access Period,
          and no exceptions will be made regardless of the reason for non-download.
        </Text>
        <Text style={s.subheading}>4.4 Client Download Responsibility</Text>
        <Text style={s.body}>
          The Photographer strongly recommends that the Client download all delivered files immediately
          upon receipt of the Gallery Link and create at least one personal backup copy. The Photographer
          shall not be held liable for any loss of files resulting from: (a) the Client's failure to
          download within the Access Period; (b) third-party platform outages or changes to Google
          Drive's terms of service; or (c) any other circumstances outside the Photographer's reasonable
          control. It is the Client's sole responsibility to ensure files are saved and secured.
        </Text>
        <Text style={s.subheading}>4.5 Physical Media (USB) Add-On</Text>
        <Text style={s.body}>
          Clients who require deliverables on a physical USB drive may request this service at any time
          during the Access Period for a fee of $30 AUD (flat rate). USB delivery is by pickup only
          (Canberra, ACT) — no postal delivery is included in this fee. The USB will contain all final
          edited JPEGs and the MP4 highlight film at the same quality and resolution as the Gallery Link.
          USB requests made after the Access Period has expired cannot be fulfilled, as files will have
          been permanently deleted. To request a USB, contact the Photographer at
          johnny.nguyen@jnguyen.co prior to the Access Period expiry date.
        </Text>
        <Text style={s.subheading}>4.6 Delays</Text>
        <Text style={s.body}>
          In the event that circumstances beyond the Photographer's reasonable control — including
          illness, equipment failure, extreme weather, or third-party platform outages — cause a delay
          in delivery, the Photographer will notify the Client in writing as soon as practicable and
          provide a revised delivery date. The three-month Access Period will commence from the actual
          revised delivery date, not the originally scheduled delivery date.
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
        {d.no_portfolio_marketing_use ? (
          <>
            <Text style={s.body}>
              Client (on behalf of himself/herself and all persons whose likeness is captured
              during the Services) warrants that they have obtained consent from all attendees
              over the age of 18 and from the parent or guardian of any minors whose likeness
              may be captured, for Photographer's use of Images as set out in this Agreement.
            </Text>
            <View style={s.notice}>
              <Text style={s.noticeText}>
                By agreement with Client, Photographer will NOT use any Images from this
                engagement for Photographer's portfolio, website, social media, or any other
                marketing or promotional materials. Images will be used solely to produce and
                deliver Client's Work Product under this Agreement. This supersedes
                Photographer's standard portfolio/marketing licence for this booking only.
              </Text>
            </View>
          </>
        ) : (
          <Text style={s.body}>
            Client (on behalf of himself/herself and all persons whose likeness is captured
            during the Services) hereby grants Photographer an irrevocable, worldwide,
            royalty-free licence to use, display, publish and reproduce any Images containing
            Client's or any attendee's likeness for the purposes of Photographer's portfolio,
            website, social media, and general marketing and promotional materials. Client
            warrants that they have obtained consent from all attendees over the age of 18 and
            from the parent or guardian of any minors whose likeness may be captured.
          </Text>
        )}

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
        <Text style={s.body}>Articles 4 (Digital Delivery & Media Access), 10, 11, 12 and 13 will survive termination of this Agreement.</Text>
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
          <Text style={[s.bankValue, { fontFamily: "Montserrat-SemiBold", color: TEAL }]}>
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
    </Document>
  );
};

// ─── Export ────────────────────────────────────────────────
export async function generateContractPDF(
  data: EnquiryData,
  opts?: { clientSignatureDataUri?: string; clientSignedAt?: string }
): Promise<Buffer> {
  const sigPath = path.join(process.cwd(), "public", "signature.png");
  const sigDataUri = fs.existsSync(sigPath)
    ? "data:image/png;base64," + fs.readFileSync(sigPath).toString("base64")
    : null;
  return renderToBuffer(
    <ContractDoc
      d={data}
      signatureDataUri={sigDataUri}
      clientSignatureDataUri={opts?.clientSignatureDataUri}
      clientSignedAt={opts?.clientSignedAt}
    />
  ) as Promise<Buffer>;
}
