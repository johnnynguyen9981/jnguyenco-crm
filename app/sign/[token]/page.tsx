// Public e-signature page — no auth required.
// Accessible at: /sign/[token]
import { createServiceClient } from "@/lib/supabase/server";
import { SigningForm } from "./SigningForm";
import { formatDate } from "@/lib/utils";

interface Props {
  params: { token: string };
}

export default async function SignContractPage({ params }: Props) {
  const { token } = params;

  // Use service role (bypasses RLS) so unauthenticated clients can load the page
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, event_date, quoted_total, deposit_amount,
      contract_signed_at, contract_sign_expires_at,
      clients (first_name, last_name, email, partner_first, partner_last),
      packages (name)
    `)
    .eq("contract_sign_token", token)
    .single();

  // ── Invalid / expired / already signed ───────────────────────────────────
  if (!booking) {
    return <ErrorPage title="Link Not Found" message="This signing link is invalid or has already been used. Please contact JNguyen Co. for a new link." />;
  }

  if (new Date(booking.contract_sign_expires_at!) < new Date()) {
    return <ErrorPage title="Link Expired" message="This signing link has expired. Please contact JNguyen Co. to request a new one." />;
  }

  if (booking.contract_signed_at) {
    return (
      <SuccessPage
        clientName={`${(booking.clients as any).first_name}`}
        signedAt={new Date(booking.contract_signed_at).toLocaleString("en-AU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      />
    );
  }

  const client  = booking.clients as any;
  const pkg     = booking.packages as any;
  const deposit = booking.deposit_amount ?? Math.round((booking.quoted_total ?? 0) * 0.25);

  return (
    <div className="min-h-screen" style={{ background: "#f7f4f1" }}>
      {/* Header */}
      <div style={{ background: "#083a4f", padding: "20px 24px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/PNG/LetterHeadSand.png" alt="JNguyen Co." style={{ height: 52, width: "auto" }} />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 64px" }}>
        <h1 style={{ color: "#083a4f", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
          Photography &amp; Videography Contract
        </h1>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 28 }}>
          Please review the details below, then draw or type your signature to sign electronically.
        </p>

        {/* Booking summary */}
        <div style={{ background: "#fff", border: "1px solid #c0d5d6", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
          <h2 style={{ color: "#407e8c", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
            Booking Summary
          </h2>
          <Row label="Client" value={`${client.first_name} ${client.last_name}${client.partner_first ? " & " + client.partner_first + " " + (client.partner_last ?? "") : ""}`} />
          <Row label="Event Date" value={formatDate(booking.event_date)} />
          <Row label="Package" value={pkg?.name ?? "Photography & Videography"} />
          {booking.quoted_total != null && <Row label="Total Fee" value={`$${booking.quoted_total.toLocaleString()}`} />}
          <Row label="Deposit Due" value={`$${deposit.toLocaleString()}`} />
        </div>

        {/* Key terms */}
        <div style={{ background: "#fff", border: "1px solid #c0d5d6", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
          <h2 style={{ color: "#407e8c", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
            Key Terms
          </h2>
          <Term heading="Non-Refundable Deposit">
            A deposit of ${deposit.toLocaleString()} is required to secure your booking date. The deposit is non-refundable if the event is cancelled.
          </Term>
          <Term heading="Cancellation Policy">
            If the event is cancelled within 30 days of the date, 50% of the remaining balance is due. Within 14 days, the full balance is due.
          </Term>
          <Term heading="Force Majeure">
            If the photographer is unable to attend due to illness, accident, or other unforeseeable circumstances, a full refund will be provided or a substitute photographer arranged.
          </Term>
          <Term heading="Image Delivery">
            Edited images will be delivered via an online gallery within the agreed timeframe. RAW files are not included unless specifically agreed in writing.
          </Term>
          <Term heading="Copyright">
            JNguyen Co. retains copyright of all images. The client receives a personal-use licence. Commercial use requires written permission.
          </Term>
          <Term heading="Privacy">
            Images may be used by JNguyen Co. for portfolio and marketing purposes unless the client opts out in writing prior to the event.
          </Term>
          <p style={{ fontSize: 12, color: "#888", marginTop: 14 }}>
            The full contract was sent to {client.email}. By signing below you confirm you have read and agree to all terms.
          </p>
        </div>

        {/* Signature form */}
        <SigningForm
          token={token}
          clientName={`${client.first_name} ${client.last_name}`}
        />
      </div>
    </div>
  );
}

// ── Small layout helpers ────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0ede9", fontSize: 14 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ color: "#083a4f", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

function Term({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#083a4f" }}>{heading}</div>
      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f4f1", padding: 24 }}>
      <img src="/PNG/LetterHeadNavy.png" alt="JNguyen Co." style={{ height: 56, marginBottom: 32 }} />
      <div style={{ background: "#fff", border: "1px solid #f5c6cb", borderRadius: 8, padding: "28px 32px", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ color: "#083a4f", marginTop: 12 }}>{title}</h2>
        <p style={{ color: "#555", lineHeight: 1.7, marginTop: 8 }}>{message}</p>
        <a href="mailto:johnny.nguyen@jnguyen.co" style={{ color: "#407e8c", fontSize: 14 }}>
          johnny.nguyen@jnguyen.co
        </a>
      </div>
    </div>
  );
}

function SuccessPage({ clientName, signedAt }: { clientName: string; signedAt: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f4f1", padding: 24 }}>
      <img src="/PNG/LetterHeadNavy.png" alt="JNguyen Co." style={{ height: 56, marginBottom: 32 }} />
      <div style={{ background: "#fff", border: "1px solid #6fcf97", borderRadius: 8, padding: "28px 32px", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2 style={{ color: "#083a4f", marginTop: 12 }}>Contract Signed!</h2>
        <p style={{ color: "#555", lineHeight: 1.7, marginTop: 8 }}>
          Hi {clientName}, your contract was signed on {signedAt}.<br />
          A copy was emailed to you. We can't wait for your event!
        </p>
        <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>
          Questions? Email{" "}
          <a href="mailto:johnny.nguyen@jnguyen.co" style={{ color: "#407e8c" }}>
            johnny.nguyen@jnguyen.co
          </a>
        </p>
      </div>
    </div>
  );
}
