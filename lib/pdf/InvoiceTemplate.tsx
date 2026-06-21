// lib/pdf/InvoiceTemplate.tsx
// Branded invoice PDF using @react-pdf/renderer
// Brand: Navy #083a4f · Sand #a58d66 · Pale Blue #c0d5d6 · Cream #e5e1dd
import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import type { InvoiceWithClient } from "@/lib/supabase/types";

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

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:      "Helvetica",
    fontSize:        10,
    color:           "#083a4f",
    backgroundColor: "#ffffff",
    padding:         48,
  },
  // Header
  header: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "flex-start",
    marginBottom:    36,
    paddingBottom:   24,
    borderBottomWidth: 2,
    borderBottomColor: "#083a4f",
  },
  brandBlock: {
    flexDirection: "column",
  },
  brandName: {
    fontSize:    22,
    fontFamily:  "Helvetica-Bold",
    color:       "#083a4f",
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 9,
    color:    "#407e8c",
    marginTop: 2,
  },
  brandContact: {
    fontSize:  8.5,
    color:     "#666",
    marginTop: 2,
  },
  invoiceBlock: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize:   20,
    fontFamily: "Helvetica-Bold",
    color:      "#a58d66",
  },
  invoiceNumber: {
    fontSize:  11,
    color:     "#083a4f",
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  invoiceMeta: {
    fontSize: 9,
    color:    "#666",
    marginTop: 2,
  },

  // Two-column info section
  infoRow: {
    flexDirection: "row",
    marginBottom:  28,
    gap:           24,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         "#407e8c",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom:  5,
  },
  infoText: {
    fontSize: 9.5,
    color:    "#333",
    lineHeight: 1.5,
  },
  infoBold: {
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
    fontSize:   10,
  },

  // Line items table
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection:   "row",
    backgroundColor: "#083a4f",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius:    3,
  },
  tableHeaderText: {
    fontSize:   8.5,
    fontFamily: "Helvetica-Bold",
    color:      "#c0d5d6",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection:     "row",
    paddingVertical:   8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e1dd",
  },
  tableRowAlt: {
    backgroundColor: "#f9f8f6",
  },
  cellDesc:  { flex: 4, fontSize: 9.5 },
  cellQty:   { flex: 1, fontSize: 9.5, textAlign: "center" },
  cellPrice: { flex: 1.5, fontSize: 9.5, textAlign: "right" },
  cellTotal: { flex: 1.5, fontSize: 9.5, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // Totals
  totalsSection: {
    alignItems: "flex-end",
    marginBottom: 32,
  },
  totalsTable: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    fontSize: 9.5,
    color:    "#555",
  },
  totalsValue: {
    fontSize:   9.5,
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: "#c0d5d6",
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#083a4f",
    borderRadius:    3,
    marginTop:       2,
  },
  grandTotalLabel: {
    fontSize:   10.5,
    fontFamily: "Helvetica-Bold",
    color:      "#c0d5d6",
  },
  grandTotalValue: {
    fontSize:   10.5,
    fontFamily: "Helvetica-Bold",
    color:      "#ffffff",
  },

  // Notes
  notesSection: {
    backgroundColor: "#e5e1dd",
    borderRadius:    5,
    padding:         14,
    marginBottom:    24,
  },
  notesLabel: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         "#407e8c",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom:  4,
  },
  notesText: {
    fontSize: 9.5,
    color:    "#555",
    lineHeight: 1.5,
  },

  // Payment details
  paymentBox: {
    borderWidth:  1,
    borderColor:  "#c0d5d6",
    borderRadius: 5,
    padding:      14,
    marginBottom: 32,
  },
  paymentLabel: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         "#407e8c",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom:  6,
  },
  paymentRow: {
    flexDirection: "row",
    marginBottom:  3,
  },
  paymentKey: {
    fontSize:   9.5,
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
    width:      100,
  },
  paymentVal: {
    fontSize: 9.5,
    color:    "#333",
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#c0d5d6",
    paddingTop:     12,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  footerText: {
    fontSize: 8,
    color:    "#888",
  },
  footerBrand: {
    fontSize:   8,
    fontFamily: "Helvetica-Bold",
    color:      "#a58d66",
  },

  // Status stamp
  stamp: {
    position:    "absolute",
    top:         96,
    right:       48,
    borderWidth: 3,
    borderRadius: 4,
    paddingVertical:   6,
    paddingHorizontal: 12,
    transform:   [{ rotate: "-12deg" }] as any,
  },
  stampPaid: {
    borderColor: "#16a34a",
  },
  stampOverdue: {
    borderColor: "#dc2626",
  },
  stampText: {
    fontSize:   13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  stampTextPaid: {
    color: "#16a34a",
  },
  stampTextOverdue: {
    color: "#dc2626",
  },
});

// ── Component ─────────────────────────────────────────────────────────────────
interface InvoiceTemplateProps {
  invoice:  InvoiceWithClient;
  abn?:     string;
  bankName?:    string;
  bsb?:         string;
  accountNumber?: string;
  accountName?:   string;
}

export function InvoiceTemplate({
  invoice,
  abn           = process.env.NEXT_PUBLIC_BUSINESS_ABN ?? "",
  bankName      = "Commonwealth Bank",
  bsb           = "XXX-XXX",
  accountNumber = "XXXXXXXXXX",
  accountName   = "JNguyen Co.",
}: InvoiceTemplateProps) {
  const client    = invoice.clients;
  const lineItems = invoice.invoice_line_items ?? [];
  const isPaid    = invoice.status === "PAID";
  const isOverdue = invoice.status === "OVERDUE";

  const formatAUD = (n: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

  const formatDateShort = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <Document
      title={`Invoice ${invoice.invoice_number} — JNguyen Co.`}
      author="JNguyen Co."
    >
      <Page size="A4" style={S.page}>

        {/* ── PAID / OVERDUE stamp ─────────────────────────── */}
        {isPaid && (
          <View style={[S.stamp, S.stampPaid]}>
            <Text style={[S.stampText, S.stampTextPaid]}>PAID</Text>
          </View>
        )}
        {isOverdue && (
          <View style={[S.stamp, S.stampOverdue]}>
            <Text style={[S.stampText, S.stampTextOverdue]}>OVERDUE</Text>
          </View>
        )}

        {/* ── HEADER ──────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.brandBlock}>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={{ width: 75, height: 60, marginBottom: 4 }} />
            ) : (
              <Text style={S.brandName}>JNguyen Co.</Text>
            )}
            <Text style={S.brandContact}>johnny.nguyen@jnguyen.co</Text>
            <Text style={S.brandContact}>https://www.jnguyen.co</Text>
            {abn && <Text style={S.brandContact}>ABN: {abn}</Text>}
          </View>
          <View style={S.invoiceBlock}>
            <Text style={S.invoiceTitle}>INVOICE</Text>
            <Text style={S.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={S.invoiceMeta}>Issued: {formatDateShort(invoice.issue_date)}</Text>
            <Text style={S.invoiceMeta}>Due:    {formatDateShort(invoice.due_date)}</Text>
          </View>
        </View>

        {/* ── BILL TO / BOOKING DETAILS ─────────────────── */}
        <View style={S.infoRow}>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Bill To</Text>
            <Text style={S.infoBold}>{client.first_name} {client.last_name}</Text>
            {client.email   && <Text style={S.infoText}>{client.email}</Text>}
            {client.address && <Text style={S.infoText}>{client.address}</Text>}
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Invoice Details</Text>
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ ...S.infoText, width: 80, fontFamily: "Helvetica-Bold" }}>Status:</Text>
              <Text style={S.infoText}>{invoice.status}</Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ ...S.infoText, width: 80, fontFamily: "Helvetica-Bold" }}>Amount Due:</Text>
              <Text style={{ ...S.infoText, fontFamily: "Helvetica-Bold" }}>
                {formatAUD(invoice.total_amount - invoice.amount_paid)}
              </Text>
            </View>
            {invoice.amount_paid > 0 && (
              <View style={{ flexDirection: "row" }}>
                <Text style={{ ...S.infoText, width: 80, fontFamily: "Helvetica-Bold" }}>Amount Paid:</Text>
                <Text style={{ ...S.infoText, color: "#16a34a" }}>{formatAUD(invoice.amount_paid)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── LINE ITEMS ────────────────────────────────── */}
        <View style={S.table}>
          {/* Header row */}
          <View style={S.tableHeader}>
            <Text style={{ ...S.tableHeaderText, ...S.cellDesc }}>Description</Text>
            <Text style={{ ...S.tableHeaderText, ...S.cellQty, textAlign: "center" }}>Qty</Text>
            <Text style={{ ...S.tableHeaderText, ...S.cellPrice, textAlign: "right" }}>Unit Price</Text>
            <Text style={{ ...S.tableHeaderText, ...S.cellTotal, textAlign: "right" }}>Total</Text>
          </View>

          {/* Data rows */}
          {lineItems.map((item, i) => (
            <View key={item.id} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={S.cellDesc}>{item.description}</Text>
              <Text style={S.cellQty}>{item.quantity}</Text>
              <Text style={S.cellPrice}>{formatAUD(item.unit_price)}</Text>
              <Text style={S.cellTotal}>{formatAUD(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ────────────────────────────────────── */}
        <View style={S.totalsSection}>
          <View style={S.totalsTable}>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Subtotal</Text>
              <Text style={S.totalsValue}>{formatAUD(invoice.subtotal)}</Text>
            </View>
            {invoice.gst_amount > 0 && (
              <View style={S.totalsRow}>
                <Text style={S.totalsLabel}>GST (10%)</Text>
                <Text style={S.totalsValue}>{formatAUD(invoice.gst_amount)}</Text>
              </View>
            )}
            <View style={S.totalsDivider} />
            <View style={S.grandTotalRow}>
              <Text style={S.grandTotalLabel}>TOTAL</Text>
              <Text style={S.grandTotalValue}>{formatAUD(invoice.total_amount)}</Text>
            </View>
            {invoice.amount_paid > 0 && (
              <>
                <View style={{ ...S.totalsRow, marginTop: 6 }}>
                  <Text style={S.totalsLabel}>Amount Paid</Text>
                  <Text style={{ ...S.totalsValue, color: "#16a34a" }}>({formatAUD(invoice.amount_paid)})</Text>
                </View>
                <View style={{ ...S.totalsRow, backgroundColor: "#e5e1dd", borderRadius: 3 }}>
                  <Text style={{ ...S.totalsLabel, fontFamily: "Helvetica-Bold" }}>Balance Due</Text>
                  <Text style={{ ...S.totalsValue, color: invoice.amount_paid >= invoice.total_amount ? "#16a34a" : "#083a4f" }}>
                    {formatAUD(Math.max(0, invoice.total_amount - invoice.amount_paid))}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── NOTES ─────────────────────────────────────── */}
        {invoice.notes && (
          <View style={S.notesSection}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* ── PAYMENT DETAILS ───────────────────────────── */}
        <View style={S.paymentBox}>
          <Text style={S.paymentLabel}>Payment Details</Text>
          <View style={S.paymentRow}>
            <Text style={S.paymentKey}>Bank:</Text>
            <Text style={S.paymentVal}>{bankName}</Text>
          </View>
          <View style={S.paymentRow}>
            <Text style={S.paymentKey}>BSB:</Text>
            <Text style={S.paymentVal}>{bsb}</Text>
          </View>
          <View style={S.paymentRow}>
            <Text style={S.paymentKey}>Account No.:</Text>
            <Text style={S.paymentVal}>{accountNumber}</Text>
          </View>
          <View style={S.paymentRow}>
            <Text style={S.paymentKey}>Account Name:</Text>
            <Text style={S.paymentVal}>{accountName}</Text>
          </View>
          <View style={{ ...S.paymentRow, marginTop: 4 }}>
            <Text style={S.paymentKey}>Reference:</Text>
            <Text style={{ ...S.paymentVal, fontFamily: "Helvetica-Bold" }}>{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* ── FOOTER ────────────────────────────────────── */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            Thank you for choosing JNguyen Co. · Canberra, ACT · johnny.nguyen@jnguyen.co · www.jnguyen.co
          </Text>
          <Text style={S.footerBrand}>JNguyen Co.</Text>
          <Text style={S.footerText}>
            Page 1 of 1 · {invoice.invoice_number}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
