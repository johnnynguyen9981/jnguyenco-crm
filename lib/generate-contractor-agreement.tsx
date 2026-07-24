/**
 * Server-side Independent Contractor Agreement PDF generation using
 * @react-pdf/renderer. Used for business-services contractors hired on an
 * ongoing basis (e.g. a Photo Editor) — distinct from the client-facing
 * Photography Services Agreement in lib/generate-contract.tsx.
 * Branded with JNguyen Co. brand colors and real logo.
 *
 * Supports English, Vietnamese, or a bilingual (English + Vietnamese) PDF —
 * many of Johnny's contractors are Vietnamese-speaking. When both languages
 * are included, the English version is stated to govern in case of any
 * translation discrepancy (standard practice for bilingual contracts).
 *
 * NOTE: The Vietnamese text below is professional-register business/legal
 * Vietnamese, but was not reviewed by a certified legal translator. For a
 * contractor who will rely on the Vietnamese wording alone, it's worth having
 * a fluent/legal reviewer sanity-check it before first use.
 */
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Font registration ───────────────────────────────────────
// The PDF's default "Helvetica" is a standard-14 PDF font that only supports
// WinAnsi (Latin-1) characters — Vietnamese diacritics (ế, ộ, ạ, ư, Đ, etc.)
// silently render as the wrong glyph ("garbled" text) with it. Noto Sans has
// full Vietnamese coverage, so it's used for both the English and Vietnamese
// pages of this document (keeps the two pages visually consistent too).
// Subset .woff files live in public/fonts/ — see public/fonts/README (if
// present) for how to regenerate them from Fontsource if ever needed.
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: "NotoSans",
      fonts: [{ src: path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.woff"), fontWeight: 400 }],
    });
    Font.register({
      family: "NotoSans-Bold",
      fonts: [{ src: path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.woff"), fontWeight: 700 }],
    });
    fontsRegistered = true;
  } catch (e) {
    console.error("[generate-contractor-agreement] Font registration failed, falling back to Helvetica:", e);
  }
}
registerFonts();

export type ContractLanguage = "EN" | "VI" | "BOTH";

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

function fmt(amount: number | null | undefined, lang: "EN" | "VI"): string {
  if (amount == null) return lang === "VI" ? "Chưa xác định" : "TBD";
  const num = "$" + Number(amount).toLocaleString("en-AU");
  return lang === "VI" ? num + " AUD" : num;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function fmtDate(dateStr?: string | null, lang: "EN" | "VI" = "EN"): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return d + "/" + m + "/" + y;
}

function today(lang: "EN" | "VI") {
  return lang === "VI"
    ? new Date().toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontSize: 8.5,
    fontFamily: "NotoSans",
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
    textAlign: "center", fontFamily: "NotoSans-Bold",
    fontSize: 11, color: NAVY, letterSpacing: 2, marginBottom: 2,
  },
  contractSubtitle: { textAlign: "center", fontSize: 7.5, color: "#888", marginBottom: 10 },
  summaryCard: {
    backgroundColor: CREAM_BG, borderRadius: 5, padding: "8 12", marginBottom: 10,
    borderLeftWidth: 2.5, borderLeftColor: TEAL, flexDirection: "row", justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 6.5, color: TEAL, fontFamily: "NotoSans-Bold", marginBottom: 2, letterSpacing: 0.5 },
  summaryValue: { fontSize: 8.5, color: NAVY, fontFamily: "NotoSans-Bold" },
  summarySub:   { fontSize: 7, color: "#666" },
  sectionRow:   { flexDirection: "row", alignItems: "center", marginTop: 9, marginBottom: 4 },
  sectionBar:   { width: 2.5, height: 12, backgroundColor: TEAL, marginRight: 6, borderRadius: 1.5 },
  sectionText:  { fontFamily: "NotoSans-Bold", fontSize: 9.5, color: NAVY, letterSpacing: 0.5 },
  subheading:   { fontFamily: "NotoSans-Bold", fontSize: 8.5, color: TEAL, marginTop: 5, marginBottom: 2 },
  body:    { lineHeight: 1.55, marginBottom: 3.5, color: "#1a2e3a" },
  field:   { flexDirection: "row", marginBottom: 3.5, alignItems: "flex-start" },
  label:   { fontFamily: "NotoSans-Bold", width: 150, flexShrink: 0, fontSize: 7.5, color: SAND },
  value:   { flex: 1, fontSize: 8.5, color: NAVY },
  divider: { borderBottomWidth: 0.5, borderBottomColor: PALE_BLUE, marginVertical: 6 },
  sigRow:    { flexDirection: "row", marginTop: 18, gap: 30 },
  sigBlock:  { flex: 1 },
  sigName:   { fontFamily: "NotoSans-Bold", fontSize: 8.5, color: NAVY, marginBottom: 2 },
  sigLine:   { borderBottomWidth: 0.75, borderBottomColor: NAVY, marginTop: 22, marginBottom: 3 },
  sigLabel:  { fontSize: 7, color: "#888" },
  footer:      { position: "absolute", bottom: "0.7cm", left: "1.8cm", right: "1.8cm" },
  footerRule:  { borderTopWidth: 0.5, borderTopColor: PALE_BLUE, marginBottom: 3 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between" },
  footerLeft:  { fontSize: 6.5, color: "#aaa" },
  footerRight: { fontSize: 6.5, color: TEAL },
  notice:     { backgroundColor: CREAM_BG, padding: "5 8", borderRadius: 3, marginBottom: 8 },
  noticeText: { fontSize: 7.5, color: "#555", lineHeight: 1.5 },
  langTag: {
    alignSelf: "center", fontSize: 6.5, color: TEAL, letterSpacing: 1,
    fontFamily: "NotoSans-Bold", marginBottom: 4,
  },
});

// ─── Bilingual text bundle ───────────────────────────────────
type Strings = {
  langTag: string;
  headerTagline: string;
  headerCity: string;
  contractTitle: string;
  subtitlePrefix: string;
  summary: { contractor: string; role: string; rate: string; startDate: string };
  preambleOpen: string;
  preambleBetween: string;
  companyLegalName: string;
  preambleMid: string;
  preambleEnd: string;
  section1Title: string;
  section1Body: string;
  fieldRole: string;
  fieldStartDate: string;
  fieldDescription: string;
  descPhotoEditor: string;
  descGeneric: string;
  fieldNotes: string;
  sub11: string;
  body11: string;
  section2Title: string;
  fieldRate: string;
  payHourly: string;
  payProject: string;
  payTail: string;
  section3Title: string;
  body3: string;
  section4Title: string;
  body4: string;
  section5Title: string;
  sub51: string;
  body51: string;
  sub52: string;
  body52: string;
  sub53: string;
  body53: string;
  section6Title: string;
  body6: string;
  section7Title: string;
  fieldCompanyEmail: string;
  fieldContractorEmail: string;
  fieldContractorPhone: string;
  sub71: string;
  body71: string;
  sub72: string;
  body72: string;
  sub73: string;
  body73: string;
  signaturesTitle: string;
  signaturesBody: string;
  contractorLabel: string;
  companyLabel: string;
  nameLabelPrefix: string;
  companySignerName: string;
  signatureLabel: string;
  signatureDigitalLabel: string;
  dateLabel: string;
  footerLine: string;
  footerPage: (p: number, t: number) => string;
  bilingualNotice: string;
  roleLabels: Record<string, string>;
  rateSuffixHourly: string;
  rateSuffixProject: string;
};

const EN: Strings = {
  langTag: "ENGLISH VERSION",
  headerTagline: "Photography & Videography",
  headerCity: "Canberra, Australia",
  contractTitle: "INDEPENDENT CONTRACTOR AGREEMENT",
  subtitlePrefix: "Agreement Date: ",
  summary: { contractor: "CONTRACTOR", role: "ROLE", rate: "RATE", startDate: "START DATE" },
  preambleOpen: "THIS AGREEMENT is made as of ",
  preambleBetween: " between ",
  companyLegalName: "Johnny Nguyen, trading as JNguyen Co.",
  preambleMid: " (ABN 17 806 783 014) (\"Company\") and ",
  preambleEnd: " (\"Contractor\").",
  section1Title: "1. Engagement and Services",
  section1Body: "Company engages Contractor, and Contractor accepts the engagement, to provide the services described below (the \"Services\") on the terms of this Agreement.",
  fieldRole: "Role:",
  fieldStartDate: "Start Date:",
  fieldDescription: "Description of Services:",
  descPhotoEditor: "Post-production photo editing (culling, colour grading, retouching) of images captured by Company for its clients, delivered to Company's specifications and within agreed turnaround times.",
  descGeneric: "Services as directed by Company from time to time, consistent with the Contractor's role above.",
  fieldNotes: "Additional Scope Notes:",
  sub11: "1.1 Independent Contractor Status",
  body11: "Contractor is engaged as an independent contractor and not as an employee, agent, or partner of Company. Nothing in this Agreement creates an employment relationship. Contractor is responsible for their own income tax, GST (if registered), superannuation contributions, insurance, and any other statutory obligations arising from this engagement. Contractor is free to provide services to other clients, provided this does not conflict with Section 4 (Confidentiality) or create a conflict of interest with Company's business.",
  section2Title: "2. Payment Terms",
  fieldRate: "Rate:",
  payHourly: "Contractor will record hours worked and invoice Company at the hourly rate above. ",
  payProject: "Contractor will invoice Company the agreed flat fee per project upon completion and delivery of that project's work, unless otherwise agreed in writing. ",
  payTail: "Company will pay approved invoices within 14 days of receipt via bank transfer. Contractor is responsible for including GST on invoices if registered for GST. Rates may be varied by mutual written agreement (including email) at any time.",
  section3Title: "3. Ownership of Work Product",
  body3: "All images, edited files, project files, and any other material Contractor creates, edits, or delivers under this Agreement (\"Work Product\") are created as a work made for hire for Company to the fullest extent permitted by law. To the extent any Work Product is not automatically owned by Company, Contractor hereby assigns to Company, absolutely and irrevocably, all right, title and interest (including copyright and moral rights, to the extent capable of assignment or waiver under applicable law) in the Work Product. Contractor waives any moral rights in the Work Product to the extent permitted by law. Contractor may not use, retain, publish, or share any Work Product (including in a personal portfolio) without Company's prior written consent.",
  section4Title: "4. Confidentiality",
  body4: "Contractor will, in the course of this engagement, have access to confidential information including client photographs and footage, client personal information (names, contact details, addresses, event details), pricing, business processes, and other non-public business information of Company (\"Confidential Information\"). Contractor agrees to: (a) keep all Confidential Information strictly confidential and not disclose it to any third party; (b) use Confidential Information solely to perform the Services; (c) store client photographs/footage and any files securely and delete local copies once a project is delivered and accepted, unless otherwise agreed; and (d) not post, share, or publish any client images, footage, or personal information on social media, portfolios, or elsewhere without Company's prior written consent. This obligation survives termination of this Agreement indefinitely.",
  section5Title: "5. Term and Termination",
  sub51: "5.1 Term",
  body51: "This Agreement begins on the Start Date above and continues on an ongoing basis until terminated in accordance with this Section.",
  sub52: "5.2 Termination",
  body52: "Either party may terminate this Agreement at any time, for any reason, by giving the other party at least 14 days' written notice (including by email). Company may terminate immediately, without notice, if Contractor breaches Section 4 (Confidentiality) or Section 3 (Ownership of Work Product), or engages in conduct that Company reasonably considers harmful to its clients or reputation.",
  sub53: "5.3 Effect of Termination",
  body53: "On termination, Contractor will promptly deliver all completed and in-progress Work Product to Company, and will delete all copies of client images, footage, and Confidential Information from personal devices and accounts, other than a copy retained solely as required by law. Company will pay for all Services properly performed and invoiced up to the date of termination. Sections 3, 4, 6 and 7 survive termination.",
  section6Title: "6. Indemnity and Liability",
  body6: "Contractor agrees to indemnify Company against any loss, damage, or claim arising from Contractor's breach of this Agreement, negligence, or wilful misconduct in performing the Services. Neither party's liability under this Agreement will exceed the total amount paid or payable to Contractor in the 3 months preceding the event giving rise to the claim, except in the case of a breach of Section 4 (Confidentiality).",
  section7Title: "7. General",
  fieldCompanyEmail: "Company's Email:",
  fieldContractorEmail: "Contractor's Email:",
  fieldContractorPhone: "Contractor's Phone:",
  sub71: "7.1 Governing Law",
  body71: "This Agreement is governed by the laws of the Australian Capital Territory, Australia, and the parties submit to the exclusive jurisdiction of the courts of that territory.",
  sub72: "7.2 Amendment",
  body72: "This Agreement may only be amended by written agreement (including email) signed or confirmed by both parties.",
  sub73: "7.3 Entire Agreement",
  body73: "This Agreement constitutes the entire agreement between the parties regarding the Services and supersedes all prior discussions and understandings on this subject.",
  signaturesTitle: "Signatures",
  signaturesBody: "By signing below, both parties confirm they have read and agree to this Agreement.",
  contractorLabel: "Contractor",
  companyLabel: "Company",
  nameLabelPrefix: "Name: ",
  companySignerName: "Johnny Nguyen — JNguyen Co.",
  signatureLabel: "Signature",
  signatureDigitalLabel: "Signature (Digital)",
  dateLabel: "Date",
  footerLine: "JNguyen Co. Photography & Videography · Canberra, Australia · johnny.nguyen@jnguyen.co · www.jnguyen.co",
  footerPage: (p, t) => "Page " + p + " of " + t,
  bilingualNotice: "This Agreement is provided in English and Vietnamese for the Contractor's convenience. In the event of any inconsistency or conflict between the two versions, the English version shall prevail and is the sole legally binding version.",
  roleLabels: {
    PHOTOGRAPHER: "Photographer",
    VIDEOGRAPHER: "Videographer",
    BOTH: "Photographer & Videographer",
    PHOTO_EDITOR: "Photo Editor",
    OTHER: "Contractor",
  },
  rateSuffixHourly: " per hour",
  rateSuffixProject: " per project (flat fee, agreed per engagement)",
};

const VI: Strings = {
  langTag: "PHIÊN BẢN TIẾNG VIỆT",
  headerTagline: "Nhiếp ảnh & Quay phim",
  headerCity: "Canberra, Úc",
  contractTitle: "HỢP ĐỒNG NHÀ THẦU ĐỘC LẬP",
  subtitlePrefix: "Ngày lập hợp đồng: ",
  summary: { contractor: "NHÀ THẦU", role: "VAI TRÒ", rate: "MỨC PHÍ", startDate: "NGÀY BẮT ĐẦU" },
  preambleOpen: "HỢP ĐỒNG NÀY được lập vào ngày ",
  preambleBetween: " giữa ",
  companyLegalName: "Johnny Nguyen, kinh doanh dưới tên JNguyen Co.",
  preambleMid: " (ABN 17 806 783 014) (\"Công ty\") và ",
  preambleEnd: " (\"Nhà thầu\").",
  section1Title: "1. Phạm vi Công việc và Dịch vụ",
  section1Body: "Công ty giao cho Nhà thầu, và Nhà thầu đồng ý nhận, thực hiện các dịch vụ được mô tả dưới đây (\"Dịch vụ\") theo các điều khoản của Hợp đồng này.",
  fieldRole: "Vai trò:",
  fieldStartDate: "Ngày bắt đầu:",
  fieldDescription: "Mô tả Dịch vụ:",
  descPhotoEditor: "Biên tập hậu kỳ hình ảnh (chọn lọc, chỉnh màu, chỉnh sửa) đối với hình ảnh do Công ty chụp cho khách hàng của mình, bàn giao theo đúng yêu cầu của Công ty và trong thời hạn đã thống nhất.",
  descGeneric: "Các dịch vụ theo chỉ định của Công ty theo từng thời điểm, phù hợp với vai trò của Nhà thầu nêu trên.",
  fieldNotes: "Ghi chú Phạm vi Bổ sung:",
  sub11: "1.1 Tình trạng Nhà thầu Độc lập",
  body11: "Nhà thầu được thuê với tư cách là nhà thầu độc lập, không phải là nhân viên, đại diện hay đối tác của Công ty. Không có điều khoản nào trong Hợp đồng này tạo ra quan hệ lao động. Nhà thầu tự chịu trách nhiệm về thuế thu nhập cá nhân, thuế GST (nếu có đăng ký), các khoản đóng góp hưu trí (superannuation), bảo hiểm, và các nghĩa vụ pháp lý khác phát sinh từ việc hợp tác này. Nhà thầu có quyền cung cấp dịch vụ cho các khách hàng khác, miễn là không mâu thuẫn với Điều 4 (Bảo mật Thông tin) hoặc gây xung đột lợi ích với hoạt động kinh doanh của Công ty.",
  section2Title: "2. Điều khoản Thanh toán",
  fieldRate: "Mức phí:",
  payHourly: "Nhà thầu sẽ ghi nhận số giờ làm việc và xuất hóa đơn cho Công ty theo mức phí theo giờ nêu trên. ",
  payProject: "Nhà thầu sẽ xuất hóa đơn cho Công ty theo mức phí trọn gói đã thống nhất cho mỗi dự án sau khi hoàn thành và bàn giao công việc của dự án đó, trừ khi có thỏa thuận khác bằng văn bản. ",
  payTail: "Công ty sẽ thanh toán các hóa đơn đã được duyệt trong vòng 14 ngày kể từ ngày nhận được hóa đơn, qua chuyển khoản ngân hàng. Nhà thầu có trách nhiệm bao gồm thuế GST trên hóa đơn nếu đã đăng ký GST. Mức phí có thể được thay đổi theo thỏa thuận chung bằng văn bản (kể cả qua email) vào bất kỳ thời điểm nào.",
  section3Title: "3. Quyền sở hữu Sản phẩm Công việc",
  body3: "Tất cả hình ảnh, tệp đã chỉnh sửa, tệp dự án, và bất kỳ tài liệu nào khác mà Nhà thầu tạo ra, chỉnh sửa, hoặc bàn giao theo Hợp đồng này (\"Sản phẩm Công việc\") được xem là sản phẩm tạo ra để làm thuê (work made for hire) cho Công ty trong phạm vi tối đa được pháp luật cho phép. Trong trường hợp Sản phẩm Công việc không tự động thuộc quyền sở hữu của Công ty, Nhà thầu theo đây chuyển nhượng cho Công ty, một cách tuyệt đối và không thể hủy ngang, toàn bộ quyền, danh nghĩa và lợi ích (bao gồm bản quyền và quyền nhân thân, trong phạm vi có thể chuyển nhượng hoặc từ bỏ theo pháp luật hiện hành) đối với Sản phẩm Công việc. Nhà thầu từ bỏ mọi quyền nhân thân đối với Sản phẩm Công việc trong phạm vi pháp luật cho phép. Nhà thầu không được sử dụng, giữ lại, công bố, hoặc chia sẻ bất kỳ Sản phẩm Công việc nào (kể cả trong portfolio cá nhân) khi chưa có sự đồng ý bằng văn bản trước của Công ty.",
  section4Title: "4. Bảo mật Thông tin",
  body4: "Trong quá trình hợp tác, Nhà thầu sẽ được tiếp cận thông tin bảo mật bao gồm hình ảnh và video của khách hàng, thông tin cá nhân của khách hàng (tên, thông tin liên hệ, địa chỉ, chi tiết sự kiện), giá cả, quy trình kinh doanh, và các thông tin kinh doanh không công khai khác của Công ty (\"Thông tin Bảo mật\"). Nhà thầu đồng ý: (a) giữ bí mật tuyệt đối mọi Thông tin Bảo mật và không tiết lộ cho bất kỳ bên thứ ba nào; (b) chỉ sử dụng Thông tin Bảo mật để thực hiện Dịch vụ; (c) lưu trữ hình ảnh/video của khách hàng và các tệp liên quan một cách an toàn, và xóa các bản sao lưu trữ cục bộ sau khi dự án được bàn giao và chấp nhận, trừ khi có thỏa thuận khác; và (d) không đăng tải, chia sẻ, hoặc công bố bất kỳ hình ảnh, video, hoặc thông tin cá nhân nào của khách hàng trên mạng xã hội, portfolio, hoặc bất kỳ nơi nào khác khi chưa có sự đồng ý bằng văn bản trước của Công ty. Nghĩa vụ này vẫn có hiệu lực vô thời hạn sau khi Hợp đồng này chấm dứt.",
  section5Title: "5. Thời hạn và Chấm dứt Hợp đồng",
  sub51: "5.1 Thời hạn",
  body51: "Hợp đồng này có hiệu lực từ Ngày Bắt đầu nêu trên và tiếp tục trên cơ sở liên tục cho đến khi bị chấm dứt theo Điều này.",
  sub52: "5.2 Chấm dứt Hợp đồng",
  body52: "Mỗi bên có quyền chấm dứt Hợp đồng này vào bất kỳ thời điểm nào, vì bất kỳ lý do gì, bằng cách thông báo bằng văn bản (kể cả qua email) cho bên kia trước ít nhất 14 ngày. Công ty có quyền chấm dứt ngay lập tức, không cần thông báo trước, nếu Nhà thầu vi phạm Điều 4 (Bảo mật Thông tin) hoặc Điều 3 (Quyền sở hữu Sản phẩm Công việc), hoặc có hành vi mà Công ty cho rằng gây tổn hại đến khách hàng hoặc uy tín của Công ty.",
  sub53: "5.3 Hậu quả của việc Chấm dứt Hợp đồng",
  body53: "Khi Hợp đồng chấm dứt, Nhà thầu sẽ bàn giao ngay lập tức toàn bộ Sản phẩm Công việc đã hoàn thành và đang thực hiện cho Công ty, đồng thời xóa toàn bộ bản sao hình ảnh, video của khách hàng và Thông tin Bảo mật khỏi thiết bị và tài khoản cá nhân, ngoại trừ một bản sao được giữ lại theo yêu cầu của pháp luật. Công ty sẽ thanh toán cho tất cả Dịch vụ đã thực hiện đúng và đã xuất hóa đơn tính đến ngày chấm dứt. Các Điều 3, 4, 6 và 7 vẫn có hiệu lực sau khi Hợp đồng chấm dứt.",
  section6Title: "6. Bồi thường và Trách nhiệm Pháp lý",
  body6: "Nhà thầu đồng ý bồi thường cho Công ty đối với bất kỳ tổn thất, thiệt hại, hoặc khiếu nại nào phát sinh từ việc Nhà thầu vi phạm Hợp đồng này, có hành vi bất cẩn, hoặc cố ý sai phạm trong khi thực hiện Dịch vụ. Trách nhiệm pháp lý của mỗi bên theo Hợp đồng này sẽ không vượt quá tổng số tiền đã thanh toán hoặc phải thanh toán cho Nhà thầu trong 3 tháng trước thời điểm phát sinh khiếu nại, ngoại trừ trường hợp vi phạm Điều 4 (Bảo mật Thông tin).",
  section7Title: "7. Điều khoản Chung",
  fieldCompanyEmail: "Email của Công ty:",
  fieldContractorEmail: "Email của Nhà thầu:",
  fieldContractorPhone: "Số điện thoại của Nhà thầu:",
  sub71: "7.1 Luật Áp dụng",
  body71: "Hợp đồng này chịu sự điều chỉnh của pháp luật Lãnh thổ Thủ đô Úc (Australian Capital Territory), và các bên đồng ý chịu sự tài phán độc quyền của tòa án tại lãnh thổ đó.",
  sub72: "7.2 Sửa đổi",
  body72: "Hợp đồng này chỉ có thể được sửa đổi bằng thỏa thuận bằng văn bản (kể cả qua email) được ký hoặc xác nhận bởi cả hai bên.",
  sub73: "7.3 Toàn bộ Thỏa thuận",
  body73: "Hợp đồng này cấu thành toàn bộ thỏa thuận giữa các bên liên quan đến Dịch vụ và thay thế mọi thảo luận, hiểu biết trước đó về vấn đề này.",
  signaturesTitle: "Chữ ký",
  signaturesBody: "Bằng việc ký tên dưới đây, cả hai bên xác nhận đã đọc và đồng ý với Hợp đồng này.",
  contractorLabel: "Nhà thầu",
  companyLabel: "Công ty",
  nameLabelPrefix: "Tên: ",
  companySignerName: "Johnny Nguyen — JNguyen Co.",
  signatureLabel: "Chữ ký",
  signatureDigitalLabel: "Chữ ký (Điện tử)",
  dateLabel: "Ngày",
  footerLine: "JNguyen Co. Nhiếp ảnh & Quay phim · Canberra, Úc · johnny.nguyen@jnguyen.co · www.jnguyen.co",
  footerPage: (p, t) => "Trang " + p + " / " + t,
  bilingualNotice: "Hợp đồng này được cung cấp bằng tiếng Anh và tiếng Việt để thuận tiện cho Nhà thầu. Trong trường hợp có bất kỳ sự không nhất quán hoặc mâu thuẫn nào giữa hai phiên bản, bản tiếng Anh sẽ được ưu tiên áp dụng và là phiên bản duy nhất có giá trị pháp lý ràng buộc.",
  roleLabels: {
    PHOTOGRAPHER: "Nhiếp ảnh gia",
    VIDEOGRAPHER: "Quay phim",
    BOTH: "Nhiếp ảnh gia & Quay phim",
    PHOTO_EDITOR: "Biên tập ảnh",
    OTHER: "Nhà thầu",
  },
  rateSuffixHourly: " mỗi giờ",
  rateSuffixProject: " mỗi dự án (phí trọn gói, thỏa thuận theo từng công việc)",
};

const BUNDLES: Record<"EN" | "VI", Strings> = { EN, VI };

const Header = ({ t }: { t: Strings }) => (
  <View fixed>
    <View style={s.header}>
      {LOGO_DATA_URI ? (
        <Image src={LOGO_DATA_URI} style={{ width: 75, height: 60 }} />
      ) : (
        <Text style={{ fontSize: 14, fontFamily: "NotoSans-Bold", color: NAVY }}>JNguyen Co.</Text>
      )}
      <View style={{ flex: 1 }} />
      <View style={s.headerContact}>
        <Text style={s.headerTagline}>{t.headerTagline}</Text>
        <Text style={s.headerCity}>{t.headerCity}</Text>
        <Text style={s.headerEmail}>johnny.nguyen@jnguyen.co</Text>
        <Text style={s.headerEmail}>https://www.jnguyen.co</Text>
      </View>
    </View>
    <View style={s.rulePrimary} />
    <View style={s.ruleAccent} />
  </View>
);

const Footer = ({ t }: { t: Strings }) => (
  <View style={s.footer} fixed>
    <View style={s.footerRule} />
    <View style={s.footerRow}>
      <Text style={s.footerLeft}>{t.footerLine}</Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => t.footerPage(pageNumber, totalPages)}
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

interface AgreementPageProps {
  lang: "EN" | "VI";
  d: ContractorAgreementData;
  signatureDataUri: string | null;
  showLangTag: boolean;
  bilingualNotice: boolean;
}

const AgreementPage = ({ lang, d, signatureDataUri, showLangTag, bilingualNotice }: AgreementPageProps) => {
  const t = BUNDLES[lang];
  const roleLabel = t.roleLabels[d.role] ?? d.role;
  const rateLabel = d.rate_type === "HOURLY"
    ? fmt(d.rate_amount, lang) + t.rateSuffixHourly
    : fmt(d.rate_amount, lang) + t.rateSuffixProject;
  const name = d.contractor_name || "—";
  const dateStr = today(lang);

  return (
    <Page size="A4" style={s.page}>
      <Header t={t} />
      <Footer t={t} />

      {showLangTag && <Text style={s.langTag}>{t.langTag}</Text>}
      <Text style={s.contractTitle}>{t.contractTitle}</Text>
      <Text style={s.contractSubtitle}>{t.subtitlePrefix + dateStr}</Text>

      {bilingualNotice && (
        <View style={s.notice}>
          <Text style={s.noticeText}>{t.bilingualNotice}</Text>
        </View>
      )}

      <View style={s.summaryCard}>
        <View>
          <Text style={s.summaryLabel}>{t.summary.contractor}</Text>
          <Text style={s.summaryValue}>{name}</Text>
          <Text style={s.summarySub}>{d.email || ""}</Text>
        </View>
        <View>
          <Text style={s.summaryLabel}>{t.summary.role}</Text>
          <Text style={s.summaryValue}>{roleLabel}</Text>
        </View>
        <View>
          <Text style={s.summaryLabel}>{t.summary.rate}</Text>
          <Text style={s.summaryValue}>{rateLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.summaryLabel}>{t.summary.startDate}</Text>
          <Text style={s.summaryValue}>{fmtDate(d.start_date)}</Text>
        </View>
      </View>

      <Text style={s.body}>
        {t.preambleOpen + dateStr + t.preambleBetween}
        <Text style={{ fontFamily: "NotoSans-Bold" }}>{t.companyLegalName}</Text>
        {t.preambleMid}
        <Text style={{ fontFamily: "NotoSans-Bold" }}>{name}</Text>
        {t.preambleEnd}
      </Text>

      <Divider />

      {/* 1 */}
      <Section title={t.section1Title} />
      <Text style={s.body}>{t.section1Body}</Text>
      <Field label={t.fieldRole}      value={roleLabel} />
      <Field label={t.fieldStartDate} value={fmtDate(d.start_date)} />
      <Field label={t.fieldDescription} value={
        d.role === "PHOTO_EDITOR" ? t.descPhotoEditor : t.descGeneric
      } />
      {d.notes ? <Field label={t.fieldNotes} value={d.notes} /> : null}
      <Text style={s.subheading}>{t.sub11}</Text>
      <Text style={s.body}>{t.body11}</Text>

      <Divider />

      {/* 2 */}
      <Section title={t.section2Title} />
      <Field label={t.fieldRate} value={rateLabel} />
      <Text style={s.body}>
        {(d.rate_type === "HOURLY" ? t.payHourly : t.payProject) + t.payTail}
      </Text>

      <Divider />

      {/* 3 */}
      <Section title={t.section3Title} />
      <Text style={s.body}>{t.body3}</Text>

      <Divider />

      {/* 4 */}
      <Section title={t.section4Title} />
      <Text style={s.body}>{t.body4}</Text>

      <Divider />

      {/* 5 */}
      <Section title={t.section5Title} />
      <Text style={s.subheading}>{t.sub51}</Text>
      <Text style={s.body}>{t.body51}</Text>
      <Text style={s.subheading}>{t.sub52}</Text>
      <Text style={s.body}>{t.body52}</Text>
      <Text style={s.subheading}>{t.sub53}</Text>
      <Text style={s.body}>{t.body53}</Text>

      <Divider />

      {/* 6 */}
      <Section title={t.section6Title} />
      <Text style={s.body}>{t.body6}</Text>

      <Divider />

      {/* 7 */}
      <Section title={t.section7Title} />
      <Field label={t.fieldCompanyEmail}    value="johnny.nguyen@jnguyen.co" />
      <Field label={t.fieldContractorEmail} value={d.email || "—"} />
      <Field label={t.fieldContractorPhone} value={d.phone || "—"} />
      <Text style={s.subheading}>{t.sub71}</Text>
      <Text style={s.body}>{t.body71}</Text>
      <Text style={s.subheading}>{t.sub72}</Text>
      <Text style={s.body}>{t.body72}</Text>
      <Text style={s.subheading}>{t.sub73}</Text>
      <Text style={s.body}>{t.body73}</Text>

      <Divider />

      {/* Signatures */}
      <Section title={t.signaturesTitle} />
      <Text style={s.body}>{t.signaturesBody}</Text>
      <View style={s.sigRow}>
        <View style={s.sigBlock}>
          <Text style={[s.sigName, { color: TEAL }]}>{t.contractorLabel}</Text>
          <Text style={s.body}>{t.nameLabelPrefix + name}</Text>
          <View style={s.sigLine} />
          <Text style={s.sigLabel}>{t.signatureLabel}</Text>
          <View style={{ marginTop: 22 }} />
          <View style={s.sigLine} />
          <Text style={s.sigLabel}>{t.dateLabel}</Text>
        </View>
        <View style={s.sigBlock}>
          <Text style={[s.sigName, { color: TEAL }]}>{t.companyLabel}</Text>
          <Text style={s.body}>{t.nameLabelPrefix + t.companySignerName}</Text>
          {signatureDataUri ? (
            <Image
              src={signatureDataUri}
              style={{ width: 110, height: 50, objectFit: "contain", marginTop: 2 }}
            />
          ) : null}
          <View style={s.sigLine} />
          <Text style={s.sigLabel}>{signatureDataUri ? t.signatureDigitalLabel : t.signatureLabel}</Text>
          <View style={{ marginTop: 6 }} />
          <Text style={{ fontSize: 8.5, color: NAVY, marginBottom: 3 }}>{dateStr}</Text>
          <View style={[s.sigLine, { marginTop: 0 }]} />
          <Text style={s.sigLabel}>{t.dateLabel}</Text>
        </View>
      </View>
    </Page>
  );
};

interface AgreementDocProps {
  d: ContractorAgreementData;
  signatureDataUri: string | null;
  language: ContractLanguage;
}

const AgreementDoc = ({ d, signatureDataUri, language }: AgreementDocProps) => {
  const name = d.contractor_name || "—";
  const isBoth = language === "BOTH";
  return (
    <Document title={"Independent Contractor Agreement – " + name} author="JNguyen Co.">
      {(language === "EN" || isBoth) && (
        <AgreementPage
          lang="EN"
          d={d}
          signatureDataUri={signatureDataUri}
          showLangTag={isBoth}
          bilingualNotice={isBoth}
        />
      )}
      {(language === "VI" || isBoth) && (
        <AgreementPage
          lang="VI"
          d={d}
          signatureDataUri={signatureDataUri}
          showLangTag={isBoth}
          bilingualNotice={isBoth}
        />
      )}
    </Document>
  );
};

function getSignatureDataUri(): string | null {
  try {
    const sigPath = path.join(process.cwd(), "public", "signature.png");
    if (!fs.existsSync(sigPath)) return null;
    return "data:image/png;base64," + fs.readFileSync(sigPath).toString("base64");
  } catch {
    return null;
  }
}

export async function generateContractorAgreementPDF(
  data: ContractorAgreementData,
  language: ContractLanguage = "EN"
): Promise<Buffer> {
  const signatureDataUri = getSignatureDataUri();
  return renderToBuffer(
    <AgreementDoc d={data} signatureDataUri={signatureDataUri} language={language} />
  ) as Promise<Buffer>;
}
