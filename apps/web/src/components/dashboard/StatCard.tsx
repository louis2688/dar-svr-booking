import type { ReactNode } from "react";

/** Points → smooth-ish SVG path across a fixed 100x32 viewBox. */
function sparkPath(values: number[], w = 100, h = 32, pad = 2) {
  if (values.length === 0) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [
    pad + i * step,
    pad + (h - pad * 2) * (1 - (v - min) / span)
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return { line, area };
}

export function StatCard(props: {
  title: string;
  value: number;
  series: number[];
  /** % change vs previous week; null when previous week had no data */
  deltaPct: number | null;
  icon?: ReactNode;
  /** invert=true → an increase is bad (rejected/cancelled) */
  invert?: boolean;
}) {
  const { deltaPct, invert } = props;
  const up = (deltaPct ?? 0) >= 0;
  const good = invert ? !up : up;
  const gradId = `spark-${props.title.replace(/\s+/g, "-").toLowerCase()}`;
  const stroke = good ? "#0f7a41" : "#dc2626";
  const { line, area } = sparkPath(props.series);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-400">
          {props.icon ?? (
            <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                d="M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
              />
            </svg>
          )}
        </span>
        {props.title}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold tracking-tight">{props.value}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {deltaPct === null ? (
              <span className="text-zinc-400">no data last week</span>
            ) : (
              <>
                <span
                  className={[
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                    good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  ].join(" ")}
                >
                  {up ? "↑" : "↓"} {Math.abs(deltaPct).toFixed(1)}%
                </span>
                <span className="text-zinc-400">from last week</span>
              </>
            )}
          </div>
        </div>
        <svg viewBox="0 0 100 32" className="h-10 w-24 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {area ? <path d={area} fill={`url(#${gradId})`} /> : null}
          {line ? <path d={line} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /> : null}
        </svg>
      </div>
    </div>
  );
}
