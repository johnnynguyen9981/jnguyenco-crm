// POST /api/bookings/[id]/sign-request
// Generates an e-signature token, saves it to the booking,
// and emails the client a unique signing link.
//
// Body { delivery: "link" } skips the email and just returns the link, so it
// can be shared another way (Messenger, Instagram, SMS). This is also the only
// option for clients with no email on file — they enter one when signing.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { contractSigningRequestHtml } from "@/lib/google/gmail";
import { apiSuccess, apiError, formatDate, getAppUrl } from "@/lib/utils";
import crypto from "crypto";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const bookingId = params.id;

  let delivery: "email" | "link" = "email";
  try {
    const body = await req.json();
    if (body?.delivery === "link") delivery = "link";
  } catch { /* no body — default to email */ }

  // Fetch booking with client + package
  const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select(`
            id, event_date, contract_signed_at,
                  contract_sign_token, contract_sign_expires_at,
                  clients (id, first_name, last_name, email),
                        packages (name)
                            `)
      .eq("id", bookingId)
      .eq("owner_id", user.id)
      .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  const client = booking.clients as any;
  const pkg    = booking.packages as any;

  if (delivery === "email" && !client?.email) {
    return apiError("Client has no email address on file. Use \"Copy Signing Link\" to share it another way.");
  }
  if (booking.contract_signed_at) return apiError("Contract is already signed.", 409);

  // Copying the link again must not break one already pasted into a chat,
  // so link mode reuses a still-valid token. Email mode always mints a fresh
  // one (the "Resend" path, for when the original link couldn't be opened).
  const existingValid =
    delivery === "link" &&
    booking.contract_sign_token &&
    booking.contract_sign_expires_at &&
    new Date(booking.contract_sign_expires_at) > new Date();

  // Generate a secure random token (32 hex bytes = 64 chars)
  const token   = existingValid ? booking.contract_sign_token! : crypto.randomBytes(32).toString("hex");
  const expires = existingValid
    ? new Date(booking.contract_sign_expires_at!)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Save token to booking. contract_sent_at is written separately, only
  // after the email actually sends (below) — otherwise a failed send still
  // leaves the booking showing the contract as sent.
  const { error: updateErr } = await supabase
      .from("bookings")
      .update({
              contract_sign_token:      token,
              contract_sign_expires_at: expires.toISOString(),
      })
      .eq("id", bookingId)
      .eq("owner_id", user.id);

  if (updateErr) return apiError("Failed to save signing token: " + updateErr.message, 500);

  if (delivery === "link") {
    // Nothing to send — the link is shared manually, so it counts as sent now.
    await supabase
        .from("bookings")
        .update({ contract_sent_at: new Date().toISOString() })
        .eq("id", bookingId)
        .eq("owner_id", user.id);

    return apiSuccess({
          message:      "Signing link ready to share",
          signing_url:  `${getAppUrl()}/sign/${token}`,
          expires_at:   expires.toISOString(),
    });
  }

  // Build the public signing URL
  const appUrl    = getAppUrl();
  const signingUrl = `${appUrl}/sign/${token}`;
  const expiresDate = expires.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const clientName = `${client.first_name} ${client.last_name}`;
  const packageName = pkg?.name ?? "Photography & Videography Package";

  // Send the signing link email via GoDaddy SMTP
  try {
        await sendEmailViaSMTP({
                to:      client.email,
                subject: "Please Sign Your Contract — JNguyen Co.",
                html:    contractSigningRequestHtml({
                          clientName,
                          eventDate:   formatDate(booking.event_date),
                          packageName,
                          signingUrl,
                          expiresDate,
                }),
        });
  } catch (emailErr: any) {
        console.error("[sign-request] Email send failed:", emailErr);
        return apiError("Token saved but email failed to send: " + emailErr.message, 500);
  }

  // Email sent successfully — now it's safe to mark the contract as sent.
  await supabase
      .from("bookings")
      .update({ contract_sent_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("owner_id", user.id);

  return apiSuccess({
        message:      "Signing link sent to " + client.email,
        signing_url:  signingUrl,
        expires_at:   expires.toISOString(),
  });
}
