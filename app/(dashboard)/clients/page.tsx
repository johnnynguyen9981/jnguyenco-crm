// app/(dashboard)/clients/page.tsx — Client list page
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, formatPhone } from "@/lib/utils";
import Link from "next/link";
import { Plus, Search, ArrowRight, Users } from "lucide-react";
import { DeleteClientButton } from "./DeleteClientButton";

export const metadata = { title: "Clients — JNguyen Co. CRM" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerUserId = await getOwnerUserId();

  const search = searchParams.search?.trim() ?? "";
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit  = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("clients")
    .select(`
      id, first_name, last_name, email, phone, referral_source,
      instagram_handle, created_at,
      bookings(id, status, event_date, service_type)
    `, { count: "exact" })
    .eq("owner_id", ownerUserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: clients, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <>
      <TopBar title="Clients" subtitle={`${count ?? 0} total clients`} />

      <div className="flex-1 p-6 space-y-4 overflow-auto">

        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Search */}
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

          <Link href="/clients/new" className="btn-primary whitespace-nowrap">
            <Plus size={15} /> Add Client
          </Link>
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          {!clients || clients.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={36} className="mx-auto mb-3 text-brand-pale-blue" />
              <p className="font-medium">
                {search ? `No clients match "${search}"` : "No clients yet"}
              </p>
              {!search && (
                <Link href="/clients/new" className="btn-primary mt-4 inline-flex">
                  <Plus size={15} /> Add your first client
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
                      <th className="table-header">Email</th>
                      <th className="table-header hidden sm:table-cell">Phone</th>
                      <th className="table-header hidden lg:table-cell">Bookings</th>
                      <th className="table-header hidden md:table-cell">Referred by</th>
                      <th className="table-header hidden lg:table-cell">Added</th>
                      <th className="table-header w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c: any) => {
                      const bookingCount = c.bookings?.length ?? 0;
                      const latestBooking = c.bookings?.sort(
                        (a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
                      )[0];

                      return (
                        <tr key={c.id} className="table-row">
                          <td className="table-cell">
                            <Link
                              href={`/clients/${c.id}`}
                              className="font-semibold text-brand-navy hover:text-brand-teal"
                            >
                              {c.first_name} {c.last_name}
                            </Link>
                            {c.instagram_handle && (
                              <p className="text-xs text-gray-400">@{c.instagram_handle}</p>
                            )}
                          </td>
                          <td className="table-cell text-sm">
                            <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${c.email}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal">
                              {c.email}
                            </a>
                          </td>
                          <td className="table-cell hidden sm:table-cell text-sm text-gray-500">
                            {formatPhone(c.phone)}
                          </td>
                          <td className="table-cell hidden lg:table-cell">
                            <span className="text-sm text-gray-600">
                              {bookingCount > 0
                                ? `${bookingCount} booking${bookingCount > 1 ? "s" : ""}`
                                : <span className="text-gray-400">None yet</span>
                              }
                            </span>
                          </td>
                          <td className="table-cell hidden md:table-cell">
                            {c.referral_source ? (
                              <span className="badge badge-contracted text-xs">
                                {c.referral_source.replace(/_/g, " ").toLowerCase()
                                  .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="table-cell hidden lg:table-cell text-sm text-gray-500">
                            {formatDate(c.created_at)}
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1">
                              <Link href={`/clients/${c.id}`}>
                                <ArrowRight size={15} className="text-brand-teal" />
                              </Link>
                              <DeleteClientButton
                                clientId={c.id}
                                clientName={`${c.first_name} ${c.last_name}`}
                                variant="icon"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-brand-pale-blue">
                  <p className="text-xs text-gray-500">
                    Showing {offset + 1}–{Math.min(offset + limit, count ?? 0)} of {count} clients
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/clients?page=${page - 1}${search ? `&search=${search}` : ""}`}
                        className="btn-secondary py-1 text-xs"
                      >
                        ← Prev
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`/clients?page=${page + 1}${search ? `&search=${search}` : ""}`}
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
