// POST /api/enquire — Public enquiry submission (no auth required)
// Creates client + inquiry booking in Supabase, sends emails to client and photographer.
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmailViaSMTP } from "@/lib/email/smtp";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Map event type label to service_type enum
function toServiceType(label: string): "WEDDING" | "EVENT" | "PORTRAIT" {
  const l = label.toLowerCase();
  if (l.includes("wedding") || l.includes("elopement")) return "WEDDING";
  if (l.includes("portrait"))                           return "PORTRAIT";
  return "EVENT";
}

// Notification email to photographer
function buildNotificationHtml(d: Record<string, string>): string {
  const name    = (d.first_name + " " + d.last_name).trim();
  const partner = d.partner_first ? (d.partner_first + " " + d.partner_last).trim() : null;
  const pkg     = d.selected_package ? d.selected_package.replace(/_/g, " ") : "Not selected";
  const services= d.services_required || "Not specified";
  const budget  = d.budget_range      || "Not specified";

  return [
    "<div style='font-family:sans-serif;max-width:600px;color:#1a1a1a'>",
    "<div style='background:#083a4f;padding:20px 24px;border-radius:8px 8px 0 0'>",
    "<p style='color:#a58d66;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px'>JNguyen Co.</p>",
    "<h1 style='color:#fff;font-size:18px;margin:0'>New Enquiry Received</h1>",
    "</div>",
    "<div style='background:#fff;border:1px solid #e8e3dd;border-top:none;padding:24px;border-radius:0 0 8px 8px'>",
    "<table style='width:100%;border-collapse:collapse;font-size:14px'>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666;width:160px'>Name</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8;font-weight:600'>" + name + "</td></tr>",
    partner ? "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Partner</td><td style='padding:8px 0;border-bottom:1px solid #f0ece8;font-weight:600'>" + partner + "</td></tr>" : "",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Email</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'><a href='mailto:" + (d.email||"") + "'>" + (d.email||"-") + "</a></td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Phone</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + (d.phone||"-") + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Event Type</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + (d.event_type||"-") + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Event Date</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + (d.event_date||"-") + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Venue</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + [d.venue_name, d.venue_suburb].filter(Boolean).join(", ") + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Guests</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + (d.guest_count||"-") + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Package Interest</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + pkg + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Services</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + services + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Budget</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + budget + "</td></tr>",
    "<tr><td style='padding:8px 0;border-bottom:1px solid #f0ece8;color:#666'>Referral</td>",
    "<td style='padding:8px 0;border-bottom:1px solid #f0ece8'>" + [d.referral_source, d.referral_notes].filter(Boolean).join(" — ") + "</td></tr>",
    d.special_requests ? "<tr><td style='padding:8px 0;color:#666;vertical-align:top'>Special Requests</td><td style='padding:8px 0'>" + d.special_requests + "</td></tr>" : "",
    "</table>",
    "<div style='margin-top:20px;padding-top:16px;border-top:1px solid #e8e3dd'>",
    "<a href='" + (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/clients' style='display:inline-block;background:#083a4f;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none'>View in CRM</a>",
    "</div>",
    "</div>",
    "</div>",
  ].join("");
}

// Confirmation email to client
function buildConfirmationHtml(firstName: string, email: string): string {
  return [
    "<div style='font-family:sans-serif;max-width:600px;color:#1a1a1a'>",
    "<div style='background:#083a4f;padding:20px 24px;border-radius:8px 8px 0 0'>",
    "<p style='color:#a58d66;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px'>JNguyen Co.</p>",
    "<h1 style='color:#fff;font-size:18px;margin:0'>We have received your enquiry!</h1>",
    "</div>",
    "<div style='background:#fff;border:1px solid #e8e3dd;border-top:none;padding:24px;border-radius:0 0 8px 8px'>",
    "<p style='font-size:14px;line-height:1.6'>Hi " + firstName + ",</p>",
    "<p style='font-size:14px;line-height:1.6'>",
    "Thank you for reaching out! I have received your enquiry and will review your details.",
    " You can expect to hear back from me within <strong>24-48 hours</strong> with a personalised quote.",
    "</p>",
    "<div style='background:#f7f4f1;border-left:3px solid #a58d66;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0'>",
    "<p style='font-size:13px;color:#555;margin:0'>",
    "In the meantime, feel free to browse my portfolio on Instagram or reach out directly at ",
    "<a href='mailto:johnny.nguyen@jnguyen.co' style='color:#407e8c'>johnny.nguyen@jnguyen.co</a>.",
    "</p>",
    "</div>",
    "<p style='font-size:14px;line-height:1.6'>Looking forward to capturing your special moments,</p>",
    "<p style='font-size:14px;font-weight:700;color:#083a4f;margin:4px 0'>Johnny Nguyen</p>",
    "<p style='font-size:12px;color:#888;margin:2px 0'>JNguyen Co. — Wedding & Event Photography & Videography</p>",
    "<p style='font-size:12px;color:#888;margin:2px 0'>Canberra, Australia</p>",
    "<p style='font-size:12px;margin:8px 0 0'>",
    "<a href='mailto:johnny.nguyen@jnguyen.co' style='color:#407e8c;text-decoration:none'>johnny.nguyen@jnguyen.co</a>",
    "</p>",
    "</div>",
    "</div>",
  ].join("");
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const firstName = (body.first_name ?? "").trim();
  const lastName  = (body.last_name  ?? "").trim();
  const email     = (body.email      ?? "").trim();

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "First name, last name and email are required." }, { status: 400 });
  }

  const admin = adminClient();

  // 1. Create client record
  const { data: client, error: clientErr } = await admin
    .from("clients")
    .insert({
      first_name:       firstName,
      last_name:        lastName,
      email,
      phone:            body.phone            || null,
      instagram_handle: body.instagram_handle || null,
      referral_source:  body.referral_source  || null,
      referral_notes:   body.referral_notes   || null,
      partner_first:    body.partner_first    || null,
      partner_last:     body.partner_last     || null,
      partner_email:    body.partner_email    || null,
      partner_phone:    body.partner_phone    || null,
      // Public enquiries get no owner_id — will be claimed by photographer on first view
    })
    .select("id")
    .single();

  if (clientErr || !client) {
    console.error("Client insert error:", clientErr);
    return NextResponse.json({ error: "Failed to save your enquiry. Please try again." }, { status: 500 });
  }

  // 2. Create inquiry booking (if event date or type provided)
  if (body.event_date || body.event_type) {
    const serviceType = toServiceType(body.event_type ?? "");
    const noteParts: string[] = [];
    if (body.event_type)          noteParts.push("Event type: " + body.event_type);
    if (body.guest_count)          noteParts.push("Est. guests: " + body.guest_count);
    if (body.selected_package)     noteParts.push("Package interest: " + body.selected_package.replace(/_/g, " "));
    if (body.services_required)    noteParts.push("Services: " + body.services_required);
    if (body.budget_range)         noteParts.push("Budget: " + body.budget_range);
    if (body.referral_source)      noteParts.push("Referral: " + body.referral_source + (body.referral_notes ? " — " + body.referral_notes : ""));

    await admin.from("bookings").insert({
      client_id:        client.id,
      service_type:     serviceType,
      status:           "INQUIRY",
      event_date:       body.event_date        || null,
      event_start_time: body.event_start_time  || null,
      event_end_time:   body.event_end_time    || null,
      venue_name:       body.venue_name        || null,
      venue_address:    body.venue_suburb      || null,
      special_requests: body.special_requests  || null,
      internal_notes:   noteParts.length ? noteParts.join("\n") : null,
    });
  }

  // 3. Send notification to photographer (non-fatal)
  try {
    const notifyTo = process.env.SMTP_USER ?? "johnny.nguyen@jnguyen.co";
    await sendEmailViaSMTP({
      to:      notifyTo,
      subject: "New Enquiry: " + firstName + " " + lastName + (body.event_date ? " — " + body.event_date : ""),
      html:    buildNotificationHtml(body),
    });
  } catch (e) {
    console.error("Notification email failed:", e);
  }

  // 4. Send confirmation to client (non-fatal)
  try {
    await sendEmailViaSMTP({
      to:      email,
      subject: "Enquiry received — JNguyen Co.",
      html:    buildConfirmationHtml(firstName, email),
    });
  } catch (e) {
    console.error("Confirmation email failed:", e);
  }

  return NextResponse.json({ success: true, clientId: client.id });
}
