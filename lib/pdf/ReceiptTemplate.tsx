// lib/pdf/ReceiptTemplate.tsx
// Branded payment receipt PDF using @react-pdf/renderer
// Brand: Navy #083a4f · Sand #a58d66 · Pale Blue #c0d5d6 · Cream #e5e1dd
import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

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

const S = StyleSheet.create({
  page: {
    fontFamily:      "Helvetica",
    fontSize:        10,
    color:           "#083a4f",
    backgroundColor: "#ffffff",
    padding:         48,
  },

  // ── Header ──
  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    marginBottom:      32,
    paddingBottom:     20,
    borderBottomWidth: 2,
    borderBottomColor: "#083a4f",
  },
  brandContact: {
    fontSize: 8.5,
    color:    "#666",
    marginTop: 2,
  },
  receiptBlock: {
    alignItems: "flex-end",
  },
  receiptTitle: {
    fontSize:   20,
    fontFamily: "Helvetica-Bold",
    color:      "#a58d66",
  },
  receiptNumber: {
    fontSize:   11,
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
    marginTop:  4,
  },
  receiptMeta: {
    fontSize: 9,
    color:    "#666",
    marginTop: 2,
  },

  // ── Two-col info ──
  infoRow: {
    flexDirection: "row",
    marginBottom:  24,
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
    fontSize:   9.5,
    color:      "#333",
    lineHeight: 1.5,
  },
  infoBold: {
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
    fontSize:   10,
  },

  // ── Payment summary table ──
  table: {
    marginBottom: 28,
    borderWidth:  1,
    borderColor:  "#c0d5d6",
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection:     "row",
    backgroundColor:   "#083a4f",
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:      3,
  },
  tableHeaderText: {
    fontSize:      8.5,
    fontFamily:    "Helvetica-Bold",
    color:         "#c0d5d6",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection:     "row",
    paddingVertical:   9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e1dd",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowAlt: {
    backgroundColor: "#f9f8f6",
  },
  colLabel: { flex: 2, fontSize: 9.5, color: "#555" },
  colValue: { flex: 3, fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#083a4f" },

  // ── Total received ──
  totalBox: {
    backgroundColor: "#083a4f",
    borderRadius:    5,
    padding:         16,
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
    marginBottom:    28,
  },
  totalLabel: {
    fontSize:   12,
    fontFamily: "Helvetica-Bold",
    color:      "#c0d5d6",
  },
  totalValue: {
    fontSize:   16,
    fontFamily: "Helvetica-Bold",
    color:      "#ffffff",
  },

  // ── PAID IN FULL stamp ──
  stamp: {
    position:          "absolute",
    top:               90,
    right:             48,
    borderWidth:       3,
    borderColor:       "#16a34a",
    borderRadius:      4,
    paddingVertical:   6,
    paddingHorizontal: 12,
    transform:         [{ rotate: "-12deg" }] as any,
  },
  stampText: {
    fontSize:      13,
    fontFamily:    "Helvetica-Bold",
    color:         "#16a34a",
    letterSpacing: 2,
  },

  // ── Thank you box ──
  thankYouBox: {
    backgroundColor: "#e5e1dd",
    borderRadius:    5,
    padding:         14,
    marginBottom:    28,
    alignItems:      "center",
  },
  thankYouText: {
    fontSize:   11,
    fontFamily: "Helvetica-Bold",
    color:      "#083a4f",
    marginBottom: 3,
  },
  thankYouSub: {
    fontSize: 9,
    color:    "#555",
  },

  // ── Footer ──
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
});

// ── Types ──
export interface ReceiptData {
  receiptNumber:  string;     // e.g. REC-202507-ABC1
  issuedDate:     string;     // ISO date string
  paymentType:    string;     // 'DEPOSIT' | 'BALANCE' | 'EXTRA_SERVICE'
  amount:         number;
  paidDate:       string;     // ISO date string
  method?:        string;     // 'Bank Transfer', 'Cash', etc.
  reference?:     string;
  notes?:         string;
  // Booking
  eventType:      string;
  eventDate?:     string;
  packageName?:   string;
  totalQuoted?:   number;
  // Client
  clientFirstName: string;
  clientLastName:  string;
  clientEmail?:   string;
  // Computed
  isBalancePayment: boolean;
  abn?: string;
}

function formatAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function humanPaymentType(t: string) {
  switch (t) {
    case "DEPOSIT":       return "Deposit";
    case "BALANCE":       return "Balance Payment";
    case "EXTRA_SERVICE": return "Extra Service Payment";
    default:              return t;
  }
}

function humanMethod(m?: string) {
  if (!m) return "Bank Transfer";
  switch (m.toUpperCase()) {
    case "BANK_TRANSFER":
    case "EFT":
    case "TRANSFER":   return "Bank Transfer (EFT)";
    case "CASH":       return "Cash";
    case "PAYPAL":     return "PayPal";
    case "CARD":       return "Credit / Debit Card";
    default:           return m;
  }
}

// ── Component ──
export function ReceiptTemplate({ data, abn = process.env.NEXT_PUBLIC_BUSINESS_ABN ?? "" }: {
  data: ReceiptData;
  abn?: string;
}) {
  const rows = [
    { label: "Payment Type",   value: humanPaymentType(data.paymentType) },
    { label: "Payment Method", value: humanMethod(data.method) },
    { label: "Date Paid",      value: formatDate(data.paidDate) },
    ...(data.reference ? [{ label: "Reference / TXN", value: data.reference }] : []),
    ...(data.notes     ? [{ label: "Notes",            value: data.notes }]     : []),
  ];

  return (
    <Document title={`Receipt ${data.receiptNumber} — JNguyen Co.`} author="JNguyen Co.">
      <Page size="A4" style={S.page}>

        {/* PAID IN FULL stamp on balance payments */}
        {data.isBalancePayment && (
          <View style={S.stamp}>
            <Text style={S.stampText}>PAID IN FULL</Text>
          </View>
        )}

        {/* ── HEADER ── */}
        <View style={S.header}>
          <View>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={{ width: 75, height: 60, marginBottom: 4 }} />
            ) : (
              <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: "#083a4f" }}>JNguyen Co.</Text>
            )}
            <Text style={S.brandContact}>johnny.nguyen@jnguyen.co</Text>
            <Text style={S.brandContact}>https://www.jnguyen.co</Text>
            {abn && <Text style={S.brandContact}>ABN: {abn}</Text>}
          </View>
          <View style={S.receiptBlock}>
            <Text style={S.receiptTitle}>RECEIPT</Text>
            <Text style={S.receiptNumber}>{data.receiptNumber}</Text>
            <Text style={S.receiptMeta}>Issued: {formatDate(data.issuedDate)}</Text>
          </View>
        </View>

        {/* ── CLIENT + BOOKING INFO ── */}
        <View style={S.infoRow}>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Received From</Text>
            <Text style={S.infoBold}>{data.clientFirstName} {data.clientLastName}</Text>
            {data.clientEmail && <Text style={S.infoText}>{data.clientEmail}</Text>}
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Booking Details</Text>
            <Text style={S.infoText}>{data.eventType}</Text>
            {data.eventDate  && <Text style={S.infoText}>Event Date: {formatDate(data.eventDate)}</Text>}
            {data.packageName && <Text style={S.infoText}>Package: {data.packageName}</Text>}
            {data.totalQuoted != null && (
              <Text style={S.infoText}>Total Quoted: {formatAUD(data.totalQuoted)}</Text>
            )}
          </View>
        </View>

        {/* ── PAYMENT DETAIL TABLE ── */}
        <View style={S.table}>
          <View style={S.tableHeader}>
            <Text style={{ ...S.tableHeaderText, flex: 2 }}>Detail</Text>
            <Text style={{ ...S.tableHeaderText, flex: 3 }}>Information</Text>
          </View>
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={[
                S.tableRow,
                i % 2 === 1 ? S.tableRowAlt : {},
                i === rows.length - 1 ? S.tableRowLast : {},
              ]}
            >
              <Text style={S.colLabel}>{row.label}</Text>
              <Text style={S.colValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTAL RECEIVED ── */}
        <View style={S.totalBox}>
          <Text style={S.totalLabel}>AMOUNT RECEIVED</Text>
          <Text style={S.totalValue}>{formatAUD(data.amount)}</Text>
        </View>

        {/* ── THANK YOU ── */}
        <View style={S.thankYouBox}>
          <Text style={S.thankYouText}>
            {data.isBalancePayment
              ? "Thank you — your booking is now fully paid! 🎉"
              : "Thank you for your payment!"}
          </Text>
          <Text style={S.thankYouSub}>
            {data.isBalancePayment
              ? "We look forward to capturing your special moments. Don't hesitate to reach out with any questions."
              : "Your deposit secures your booking date. We'll be in touch with the next steps."}
          </Text>
        </View>

        {/* ── FOOTER ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            JNguyen Co. · Wedding & Event Photography · Canberra, ACT · www.jnguyen.co
          </Text>
          <Text style={S.footerBrand}>JNguyen Co.</Text>
          <Text style={S.footerText}>{data.receiptNumber}</Text>
        </View>

      </Page>
    </Document>
  );
}
