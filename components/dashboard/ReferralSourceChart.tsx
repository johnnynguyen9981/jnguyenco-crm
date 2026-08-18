// components/dashboard/ReferralSourceChart.tsx
// Pure-SVG donut chart — no charting library dependency, renders server-side.
// Shows the percentage breakdown of "How did you hear about us?" across all clients.

export interface ReferralSegment {
  label: string;
  count: number;
  color: string;
}

export function ReferralSourceChart({ segments }: { segments: ReferralSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  const size = 168;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0ece7"
          strokeWidth={strokeWidth}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total > 0 &&
            segments.map((s) => {
              if (s.count === 0) return null;
              const pct = s.count / total;
              const dash = pct * circumference;
              const gap = circumference - dash;
              const offset = -cumulative * circumference;
              cumulative += pct;
              return (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${s.label}: ${Math.round(pct * 100)}%`}</title>
                </circle>
              );
            })}
        </g>
      </svg>

      <div className="flex-1 w-full space-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-gray-600 truncate">{s.label}</span>
              </div>
              <span className="font-semibold text-brand-navy shrink-0 ml-3">
                {`${pct}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
