// app/(dashboard)/contractors/[id]/page.tsx — Contractor detail page
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, Edit, CalendarDays } from "lucide-react";
import { GenerateContractButton } from "./GenerateContractButton";
import { DeleteContractorButton } from "../DeleteContractorButton";

type Params = { params: { id: string } };

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Other",
};

export async function generateMetadata({ params }: Params) {
  const supabase = await createClient();
  const { data } = await supabase.from("contractors").select("first_name, last_name").eq("id", params.id).single();
  return { title: data ? `${data.first_name} ${data.last_name} — Contractors` : "Contractor" };
}

export default async function ContractorDetailPage({ params }: Params) {
  const ownerUserId = await getOwnerUserId();
  const supabase = await createClient();

  const { data: contractor, error } = await supabase
    .from("contractors")
    .select("*")
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !contractor) notFound();

  const { data: assignments } = await supabase
    .from("booking_contractors")
    .select("id, role, agreed_rate, confirmed, paid, bookings (id, event_date, service_type, status)")
    .eq("contractor_id", params.id);

  return (
    <>
      <TopBar
        title={`${contractor.first_name} ${contractor.last_name}`}
        subtitle="Contractor Profile"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">

        <Link href="/contractors" className="inline-flex items-center gap-1.5 text-sm text-brand-teal hover:text-brand-navy">
          <ArrowLeft size={15} /> All Contractors
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: contact info ─────────────────── */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-brand-navy">
                    {contractor.first_name} {contractor.last_name}
                  </h2>
                  <p className="text-sm text-brand-teal">{ROLE_LABELS[contractor.role] ?? contractor.role}</p>
                </div>
                <Link href={`/contractors/${contractor.id}/edit`} className="btn-secondary py-1 text-xs">
                  <Edit size={13} /> Edit
                </Link>
              </div>

              <div className="space-y-2.5">
                {contractor.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={14} className="text-brand-teal shrink-0" />
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${contractor.email}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal break-all">
                      {contractor.email}
                    </a>
                  </div>
                )}
                {contractor.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={14} className="text-brand-teal shrink-0" />
                    <a href={`tel:${contractor.phone}`} className="hover:text-brand-teal">
                      {formatPhone(contractor.phone)}
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-brand-pale-blue">
                <span className={contractor.is_active ? "badge badge-confirmed" : "badge badge-cancelled"}>
                  {contractor.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Rate / engagement summary */}
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                Engagement
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rate</span>
                  <span className="font-semibold">
                    {contractor.default_rate != null
                      ? `${formatCurrency(contractor.default_rate)}${contractor.rate_type === "HOURLY" ? "/hr" : contractor.rate_type === "PER_PROJECT" ? "/project" : ""}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Start date</span>
                  <span className="font-semibold">{formatDate(contractor.start_date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Added</span>
                  <span className="font-semibold">{formatDate(contractor.created_at)}</span>
                </div>
                {contractor.contract_generated_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last agreement generated</span>
                    <span className="font-semibold">{formatDate(contractor.contract_generated_at)}</span>
                  </div>
                )}
              </div>
              {contractor.notes && (
                <div className="mt-3 pt-3 border-t border-brand-pale-blue">
                  <p className="text-xs text-brand-teal font-semibold uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{contractor.notes}</p>
                </div>
              )}
            </div>

            <GenerateContractButton contractorId={contractor.id} />

            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-3">Danger zone — this cannot be undone.</p>
              <DeleteContractorButton
                contractorId={contractor.id}
                contractorName={`${contractor.first_name} ${contractor.last_name}`}
                variant="button"
              />
            </div>
          </div>

          {/* ── Right column: booking assignments ────────── */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-brand-pale-blue">
                <h3 className="font-semibold text-brand-navy flex items-center gap-2">
                  <CalendarDays size={16} className="text-brand-teal" /> Booking Assignments
                </h3>
              </div>
              {!assignments || assignments.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">
                  Not assigned to any bookings yet.
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Date</th>
                      <th className="table-header">Service</th>
                      <th className="table-header">Role</th>
                      <th className="table-header text-right">Agreed Rate</th>
                      <th className="table-header">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a: any) => (
                      <tr key={a.id} className="table-row">
                        <td className="table-cell">
                          <Link href={`/bookings/${a.bookings?.id}`} className="font-medium hover:text-brand-teal">
                            {formatDate(a.bookings?.event_date)}
                          </Link>
                        </td>
                        <td className="table-cell text-sm text-gray-600">{a.bookings?.service_type ?? "—"}</td>
                        <td className="table-cell text-sm text-gray-600">{ROLE_LABELS[a.role] ?? a.role}</td>
                        <td className="table-cell text-right font-semibold text-sm">{formatCurrency(a.agreed_rate)}</td>
                        <td className="table-cell">
                          <span className={a.paid ? "badge badge-confirmed" : "badge badge-pending"}>
                            {a.paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
