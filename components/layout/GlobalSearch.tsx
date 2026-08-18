"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, User, CalendarDays, Receipt, Briefcase } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof User }> = {
  client:     { label: "Clients",     icon: User },
  booking:    { label: "Bookings",    icon: CalendarDays },
  invoice:    { label: "Invoices",    icon: Receipt },
  contractor: { label: "Contractors", icon: Briefcase },
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K opens search from anywhere; Escape closes it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // Silently ignore — search is a convenience feature, not critical path.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Group results by type, preserving the API's ranking within each group.
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{
          border: "1px solid #c0d5d6",
          background: "#e5e1dd",
          color: "#407e8c",
        }}
        title="Search (⌘K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline text-xs" style={{ color: "#a58d66" }}>
          Search...
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: "rgba(8, 58, 79, 0.35)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-xl overflow-hidden"
            style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e1dd" }}>
              <Search size={16} style={{ color: "#407e8c" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients, bookings, invoices, contractors…"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: "#083a4f" }}
              />
              {loading && <Loader2 size={14} className="animate-spin" style={{ color: "#a58d66" }} />}
              <button onClick={() => setOpen(false)} aria-label="Close search">
                <X size={16} style={{ color: "#407e8c" }} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "#84868a" }}>
                  No results for "{query.trim()}"
                </p>
              )}

              {query.trim().length < 2 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "#84868a" }}>
                  Type at least 2 characters to search
                </p>
              )}

              {(Object.keys(grouped) as SearchResult["type"][]).map((type) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type} className="py-1">
                    <p
                      className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "#a58d66" }}
                    >
                      {meta.label}
                    </p>
                    {grouped[type].map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => goTo(r.href)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-brand-pale-blue/40 transition-colors"
                      >
                        <Icon size={16} style={{ color: "#407e8c" }} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#083a4f" }}>
                            {r.title}
                          </p>
                          <p className="text-xs truncate" style={{ color: "#84868a" }}>
                            {r.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
