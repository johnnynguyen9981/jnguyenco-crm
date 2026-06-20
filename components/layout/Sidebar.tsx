"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays,
  FileText, FolderOpen, Settings, LogOut, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function FlameMark({ size = 40, color = "#a58d66" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 1395 2048"
      aria-hidden
      style={{ height: size, width: "auto", display: "block", flexShrink: 0, fill: color }}
    >
      <path d="M1394.51,1313.64c-.68-29.93-2.52-57.64-6.2-84.67l-416.08,416.08-138.14-138.05,487.67-487.67c-22.38-46.69-51.44-99.59-88.74-162.85l-524.67,524.67-138.14-138.05,559.55-559.55c-25.28-42.43-53.38-89.71-82.83-139.21l-587.74,587.74-138.05-138.14L944.04,371.05c-81.96-138.24-160.81-271.15-206.34-348.17-18.12-30.52-62.29-30.52-80.31,0-44.08,74.4-119.06,201.01-198.11,334.12-111.12,187.45-230.08,387.79-281.61,473.43-51.54,85.93-88.54,153.25-114.89,211.48C13.37,1150.89,1.07,1228.01.1,1335.05c-.1,5.04-.1,10.07-.1,15.21,0,88.45,0,283.36,207.12,490.48,66.36,66.36,135.14,111.6,199.76,142.41,136.98,65.39,254.88,65.78,289.36,64.62l2.52-.19c33.71,1.16,146.96.78,279.87-60.16,67.33-30.9,139.69-77.31,209.25-146.86,207.12-207.12,207.12-402.03,207.12-490.48,0-12.5-.1-24.61-.48-36.42Z" />
    </svg>
  );
}

const navItems = [
  { href: "/",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients",  label: "Clients",   icon: Users },
  { href: "/bookings", label: "Bookings",  icon: CalendarDays },
  { href: "/invoices",   label: "Invoices",       icon: FileText },
  { href: "/documents",  label: "Documents",      icon: FolderOpen },
  { href: "/forms",      label: "Forms / Templates", icon: ClipboardList },
  { href: "/settings",   label: "Settings",       icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen shrink-0 bg-brand-navy">

      {/* Brand mark */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <FlameMark size={36} color="#a58d66" />
          <div>
            <p className="text-white text-xs font-bold tracking-[0.14em] uppercase leading-snug">JNGUYEN</p>
            <p className="text-white text-xs font-bold tracking-[0.2em] uppercase leading-snug">CO.</p>
            <p className="text-brand-pale-blue text-[10px] tracking-widest uppercase mt-1">CRM</p>
          </div>
        </div>
        {/* Gold rule */}
        <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, #a58d66 0%, transparent 80%)" }} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/[0.07] hover:text-white/90"
              )}
            >
              {active && (
                <span className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-brand-sand" />
              )}
              <Icon size={16} className={cn("shrink-0", active ? "text-brand-sand" : "text-white/40")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick rates */}
      <div className="mx-3 mb-3 rounded-lg p-3 bg-white/5 border border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-sand mb-2">
          Quick Rates
        </p>
        <div className="space-y-1.5">
          {[
            ["Mini Wedding",   "$1,600"],
            ["Full Day Ess.",  "$3,200"],
            ["Full Day Prem.", "$4,800"],
            ["Event / Photo",  "$200/hr"],
          ].map(([label, price]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-white/50">{label}</span>
              <span className="text-white font-semibold">{price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider + Sign out */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                     text-sm font-medium text-white/45 hover:bg-white/[0.07] hover:text-white/85
                     transition-all duration-150"
        >
          <LogOut size={16} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
