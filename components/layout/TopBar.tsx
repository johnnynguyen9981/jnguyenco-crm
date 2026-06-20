"use client";

import { Search } from "lucide-react";

// Flame mark for topbar avatar
function FlameMark({ size = 16, color = "#a58d66" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 1395 2048"
      aria-hidden
      style={{ height: size, width: "auto", display: "block", fill: color }}
    >
      <path d="M1394.51,1313.64c-.68-29.93-2.52-57.64-6.2-84.67l-416.08,416.08-138.14-138.05,487.67-487.67c-22.38-46.69-51.44-99.59-88.74-162.85l-524.67,524.67-138.14-138.05,559.55-559.55c-25.28-42.43-53.38-89.71-82.83-139.21l-587.74,587.74-138.05-138.14L944.04,371.05c-81.96-138.24-160.81-271.15-206.34-348.17-18.12-30.52-62.29-30.52-80.31,0-44.08,74.4-119.06,201.01-198.11,334.12-111.12,187.45-230.08,387.79-281.61,473.43-51.54,85.93-88.54,153.25-114.89,211.48C13.37,1150.89,1.07,1228.01.1,1335.05c-.1,5.04-.1,10.07-.1,15.21,0,88.45,0,283.36,207.12,490.48,66.36,66.36,135.14,111.6,199.76,142.41,136.98,65.39,254.88,65.78,289.36,64.62l2.52-.19c33.71,1.16,146.96.78,279.87-60.16,67.33-30.9,139.69-77.31,209.25-146.86,207.12-207.12,207.12-402.03,207.12-490.48,0-12.5-.1-24.61-.48-36.42Z" />
    </svg>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header
      className="h-16 px-6 flex items-center justify-between shrink-0"
      style={{
        background: "white",
        borderBottom: "1px solid #c0d5d6",
      }}
    >
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        {/* Thin gold accent */}
        <div className="h-6 w-0.5 rounded-full" style={{ background: "#a58d66" }} />
        <div>
          <h1
            className="text-base font-bold leading-tight tracking-tight"
            style={{ color: "#083a4f" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs leading-tight mt-0.5" style={{ color: "#407e8c" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: search + avatar */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            border: "1px solid #c0d5d6",
            background: "#e5e1dd",
            color: "#407e8c",
          }}
          title="Search"
        >
          <Search size={14} />
          <span className="hidden sm:inline text-xs" style={{ color: "#a58d66" }}>
            Search...
          </span>
        </button>

        {/* Avatar with flame mark */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "#083a4f" }}
        >
          <FlameMark size={16} color="#a58d66" />
        </div>
      </div>
    </header>
  );
}
