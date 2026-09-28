"use client";

import Link from "next/link";
import { Home, Menu } from "lucide-react";
import { useMobileNav } from "./MobileNavContext";

// Fallback mobile header for dashboard pages that don't render a TopBar.
// Without it those pages have no way to open the nav drawer on small screens.
export function MobileHeader() {
  const { setOpen, topBarCount } = useMobileNav();
  if (topBarCount > 0) return null;

  return (
    <header
      className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between shrink-0"
      style={{ background: "white", borderBottom: "1px solid #c0d5d6" }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="-ml-1 p-1.5 rounded-lg text-brand-navy hover:bg-brand-pale-blue/30"
      >
        <Menu size={20} />
      </button>
      <Link
        href="/"
        className="text-xs font-bold tracking-[0.14em] uppercase"
        style={{ color: "#083a4f" }}
      >
        JNGUYEN CO.
      </Link>
      <Link
        href="/"
        aria-label="Go to dashboard"
        className="-mr-1 p-1.5 rounded-lg text-brand-navy hover:bg-brand-pale-blue/30"
      >
        <Home size={20} />
      </Link>
    </header>
  );
}
