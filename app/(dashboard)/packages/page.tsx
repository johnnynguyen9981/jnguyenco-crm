// app/(dashboard)/packages/page.tsx — Packages list page
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { ArrowRight, Package as PackageIcon } from "lucide-react";

export const metadata = { title: "Packages — JNguyen Co. CRM" };

const SERVICE_TYPE_LABELS: Record<string, string> = {
  WEDDING:  "Wedding / Elopement",
  EVENT:    "Event",
  PORTRAIT: "Portrait Session",
};

function formatPrice(base_price: number | null, max_hours: number | null) {
  if (base_price == null) return "—";
  const amount = "$" + Number(base_price).toLocaleString("en-AU");
  return max_hours ? amount : amount + "/hr";
}

export default async function PackagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Packages are global shared data (not per-owner) — bypass RLS with the
  // service-role client, same as /api/packages.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: packages } = await admin
    .from("packages")
    .select("*")
    .order("service_type", { ascending: true })
    .order("base_price", { ascending: true });

  const grouped: Record<string, any[]> = {};
  for (const pkg of packages ?? []) {
    (grouped[pkg.service_type] ??= []).push(pkg);
  }

  return (
    <>
      <TopBar title="Packages" subtitle={`${packages?.length ?? 0} total packages`} />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="bg-brand-cream border border-brand-pale-blue rounded-lg px-4 py-3 text-sm text-gray-600">
          Editing a package&apos;s team, deliverables, or delivery timeline here updates every
          contract generated for that package going forward — no code changes needed.
        </div>

        {Object.entries(grouped).map(([serviceType, pkgs]) => (
          <div key={serviceType} className="card p-0 overflow-hidden">
            <h2 className="px-5 py-3 text-xs font-bold text-brand-teal uppercase tracking-widest border-b border-brand-pale-blue">
              {SERVICE_TYPE_LABELS[serviceType] ?? serviceType}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Price</th>
                    <th className="table-header hidden sm:table-cell">Team</th>
                    <th className="table-header hidden md:table-cell">Includes</th>
                    <th className="table-header">Status</th>
                    <th className="table-header w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pkgs.map((pkg) => (
                    <tr key={pkg.id} className="table-row">
                      <td className="table-cell">
                        <Link
                          href={`/packages/${pkg.id}/edit`}
                          className="font-semibold text-brand-navy hover:text-brand-teal"
                        >
                          {pkg.name}
                        </Link>
                      </td>
                      <td className="table-cell text-sm text-gray-600">
                        {formatPrice(pkg.base_price, pkg.max_hours)}
                      </td>
                      <td className="table-cell hidden sm:table-cell text-sm text-gray-500">
                        {pkg.team || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell hidden md:table-cell text-sm text-gray-600">
                        {[pkg.includes_photography && "Photo", pkg.includes_videography && "Video"]
                          .filter(Boolean).join(" + ") || "—"}
                      </td>
                      <td className="table-cell">
                        <span className={pkg.is_active ? "badge badge-confirmed" : "badge badge-cancelled"}>
                          {pkg.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="table-cell">
                        <Link href={`/packages/${pkg.id}/edit`}>
                          <ArrowRight size={15} className="text-brand-teal" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {(!packages || packages.length === 0) && (
          <div className="card text-center py-16 text-gray-400">
            <PackageIcon size={36} className="mx-auto mb-3 text-brand-pale-blue" />
            <p className="font-medium">No packages yet</p>
          </div>
        )}
      </div>
    </>
  );
}
