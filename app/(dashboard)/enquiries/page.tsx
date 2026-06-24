import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Enquiries — JNguyen Co. CRM" };

export default async function EnquiriesPage() {
  const supabase = await createClient();

  // Fetch clients with no owner_id — these are public form submissions
  const { data: enquiries } = await supabase
    .from("clients")
    .select(`
      id, first_name, last_name, email, phone, created_at, referral_source,
      bookings(id, status, event_date, service_type, venue_name, venue_address, special_requests, internal_notes)
    `)
    .is("owner_id", null)
    .order("created_at", { ascending: false });

  return (
    <>
      <TopBar title="Enquiries" subtitle={`${enquiries?.length ?? 0} pending`} />

      <div className="flex-1 p-6 overflow-auto">
        {!enquiries?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Inbox size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No pending enquiries</p>
            <p className="text-gray-400 text-sm mt-1">New form submissions will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {enquiries.map((enq) => {
              const booking = enq.bookings?.[0];
              return (
                <Link
                  key={enq.id}
                  href={`/enquiries/${enq.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition-all p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">
                          {enq.first_name} {enq.last_name}
                        </p>
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                          New Enquiry
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{enq.email}</p>
                      {booking && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                          {booking.service_type && <span>📸 {booking.service_type}</span>}
                          {booking.event_date   && <span>📅 {formatDate(booking.event_date)}</span>}
                          {booking.venue_name   && <span>📍 {booking.venue_name}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(enq.created_at)}</span>
                      <ArrowRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
