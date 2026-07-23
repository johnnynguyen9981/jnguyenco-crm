// app/(dashboard)/contractors/page.tsx — Contractor list page
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Plus, Search, ArrowRight, Briefcase } from "lucide-react";
import { DeleteContractorButton } from "./DeleteContractorButton";

export const metadata = { title: "Contractors — JNguyen Co. CRM" };

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Other",
};

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const supabase = await createClient();
  const ownerUserId = await getOwnerUserId();

  const search = searchParams.search?.trim() ?? "";
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit  = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("contractors")
    .select(
      "id, first_name, last_name, email, phone, role, rate_type, default_rate, is_active, created_at",
      { count: "exact" }
    )
    .eq("owner_id", ownerUserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: contractors, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <>
      <TopBar title="Contractors" subtitle={`${count ?? 0} total contractors`} />

      <div className="flex-1 p-6 space-y-4 overflow-auto">

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <form method="GET" className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Search by name or email..."
                className="input pl-9"
              />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
          </form>

          <Link href="/contractors/new" className="btn-primary whitespace-nowrap">
            <Plus size={15} /> Add Contractor
          </Link>
        </div>

        <div className="card p-0 overflow-hidden">
          {!contractors || contractors.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Briefcase size={36} className="mx-auto mb-3 text-brand-pale-blue" />
              <p className="font-medium">
                {search ? `No contractors match "${search}"` : "No contractors yet"}
              </p>
              {!search && (
                <Link href="/contractors/new" className="btn-primary mt-4 inline-flex">
                  <Plus size={15} /> Add your first contractor
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Name</th>
                      <th className="table-header">Role</th>
                      <th className="table-header hidden sm:table-cell">Email</th>
                      <th className="table-header hidden md:table-cell">Phone</th>
                      <th className="table-header hidden lg:table-cell">Rate</th>
                      <th className="table-header">Status</th>
                      <th className="table-header hidden lg:table-cell">Added</th>
                      <th className="table-header w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractors.map((c: any) => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell">
                          <Link
                            href={`/contractors/${c.id}`}
                            className="font-semibold text-brand-navy hover:text-brand-teal"
                          >
                            {c.first_name} {c.last_name}
                          </Link>
                        </td>
                        <td className="table-cell text-sm text-gray-600">
                          {ROLE_LABELS[c.role] ?? c.role}
                        </td>
                        <td className="table-cell hidden sm:table-cell text-sm">
                          {c.email ? (
                            <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${c.email}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal">
                              {c.email}
                            </a>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-cell hidden md:table-cell text-sm text-gray-500">
                          {formatPhone(c.phone)}
                        </td>
                        <td className="table-cell hidden lg:table-cell text-sm text-gray-600">
                          {c.default_rate != null
                            ? `${formatCurrency(c.default_rate)}${c.rate_type === "HOURLY" ? "/hr" : c.rate_type === "PER_PROJECT" ? "/project" : ""}`
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-cell">
                          <span className={c.is_active ? "badge badge-confirmed" : "badge badge-cancelled"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="table-cell hidden lg:table-cell text-sm text-gray-500">
                          {formatDate(c.created_at)}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <Link href={`/contractors/${c.id}`}>
                              <ArrowRight size={15} className="text-brand-teal" />
                            </Link>
                            <DeleteContractorButton
                              contractorId={c.id}
                              contractorName={`${c.first_name} ${c.last_name}`}
                              variant="icon"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-brand-pale-blue">
                  <p className="text-xs text-gray-500">
                    Showing {offset + 1}–{Math.min(offset + limit, count ?? 0)} of {count} contractors
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/contractors?page=${page - 1}${search ? `&search=${search}` : ""}`}
                        className="btn-secondary py-1 text-xs"
                      >
                        ← Prev
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`/contractors?page=${page + 1}${search ? `&search=${search}` : ""}`}
                        className="btn-secondary py-1 text-xs"
                      >
                        Next →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
