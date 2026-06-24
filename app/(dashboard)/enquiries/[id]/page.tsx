import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { AcceptEnquiryButton } from "./AcceptEnquiryButton";
import { DeclineEnquiryButton } from "./DeclineEnquiryButton";

export const metadata = { title: "Enquiry Detail — JNguyen Co. CRM" };

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-40 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

export default async function EnquiryDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: enq } = await supabase
    .from("clients")
    .select(`
      id, first_name, last_name, email, phone, instagram_handle,
      referral_source, referral_notes, partner_first, partner_last,
      partner_email, partner_phone, created_at, owner_id,
      bookings(
        id, status, event_date, event_start_time, event_end_time,
        service_type, venue_name, venue_address, special_requests, internal_notes
      )
    `)
    .eq("id", params.id)
    .single();

  if (!enq) notFound();

  // Already accepted — show differently
  const isAccepted = !!enq.owner_id;
  const booking = enq.bookings?.[0];

  // Parse internal_notes back into readable fields
  const notes: Record<string, string> = {};
  booking?.internal_notes?.split("\n").forEach((line: string) => {
    const [k, ...rest] = line.split(": ");
    if (k && rest.length) notes[k.trim()] = rest.join(": ").trim();
  });

  return (
    <>
      <TopBar
        title={`${enq.first_name} ${enq.last_name}`}
        subtitle={isAccepted ? "Accepted — now a client" : "Pending enquiry"}
        backHref="/enquiries"
        backLabel="Enquiries"
      />

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl space-y-4">

          {/* Status banner */}
          {!isAccepted && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-800">New enquiry — awaiting your review</p>
                <p className="text-xs text-amber-600 mt-0.5">Accept to add this person to your Clients list. Decline to remove the enquiry.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <DeclineEnquiryButton clientId={enq.id} />
                <AcceptEnquiryButton clientId={enq.id} userId={user!.id} bookingId={booking?.id} />
              </div>
            </div>
          )}

          {isAccepted && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3">
              <p className="text-sm font-semibold text-green-800">Accepted — this person is now in your Clients list.</p>
            </div>
          )}

          {/* Contact details */}
          <Section title="Contact Details">
            <Row label="Name"  value={`${enq.first_name} ${enq.last_name}`} />
            <Row label="Email" value={enq.email} />
            <Row label="Phone" value={enq.phone} />
            <Row label="Instagram" value={enq.instagram_handle} />
            <Row label="How they found you" value={[enq.referral_source, enq.referral_notes].filter(Boolean).join(" — ")} />
          </Section>

          {/* Partner */}
          {enq.partner_first && (
            <Section title="Partner / Spouse">
              <Row label="Name"  value={`${enq.partner_first} ${enq.partner_last ?? ""}`} />
              <Row label="Email" value={enq.partner_email} />
              <Row label="Phone" value={enq.partner_phone} />
            </Section>
          )}

          {/* Event details */}
          {booking && (
            <Section title="Event Details">
              <Row label="Event Type"    value={notes["Event type"] ?? booking.service_type} />
              <Row label="Date"          value={booking.event_date ? formatDate(booking.event_date) : null} />
              <Row label="Start Time"    value={booking.event_start_time} />
              <Row label="End Time"      value={booking.event_end_time} />
              <Row label="Venue"         value={booking.venue_name} />
              <Row label="Location"      value={booking.venue_address} />
              <Row label="Est. Guests"   value={notes["Est. guests"]} />
            </Section>
          )}

          {/* Package & budget */}
          {(notes["Package interest"] || notes["Services"] || notes["Budget"]) && (
            <Section title="Package Interest">
              <Row label="Package"  value={notes["Package interest"]} />
              <Row label="Services" value={notes["Services"]} />
              <Row label="Budget"   value={notes["Budget"]} />
              <Row label="Referral" value={notes["Referral"]} />
            </Section>
          )}

          {/* Special requests */}
          {booking?.special_requests && (
            <Section title="Special Requests / Notes">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{booking.special_requests}</p>
            </Section>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400 text-right pb-4">
            Submitted {new Date(enq.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
          </div>

        </div>
      </div>
    </>
  );
}
