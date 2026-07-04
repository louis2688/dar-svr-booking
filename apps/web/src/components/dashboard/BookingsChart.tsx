const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Diverging monthly bars: approved above the axis, cancelled/rejected below. */
export function BookingsChart(props: {
  year: number;
  approved: number[]; // 12 entries
  cancelled: number[]; // 12 entries
}) {
  const max = Math.max(...props.approved, ...props.cancelled, 1);
  const H = 96; // px per half

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold">Bookings Overview</div>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Cancelled / Rejected
          </span>
          <span className="rounded-lg border px-2.5 py-1 font-medium text-zinc-700">{props.year}</span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-[560px] items-stretch gap-1.5">
          {MONTHS.map((m, i) => {
            const a = props.approved[i] ?? 0;
            const c = props.cancelled[i] ?? 0;
            return (
              <div key={m} className="group relative flex flex-1 flex-col items-center">
                <div
                  className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white group-hover:block"
                  role="tooltip"
                >
                  {m}: {a} approved · {c} cancelled
                </div>
                <div className="flex w-full flex-col items-center" style={{ height: H }}>
                  <div className="mt-auto w-3/5 max-w-[22px] rounded-t-md bg-emerald-600 transition-all group-hover:bg-emerald-500"
                    style={{ height: `${(a / max) * 100}%`, minHeight: a > 0 ? 4 : 0 }} />
                </div>
                <div className="h-px w-full bg-zinc-200" />
                <div className="flex w-full flex-col items-center" style={{ height: H * 0.6 }}>
                  <div className="w-3/5 max-w-[22px] rounded-b-md bg-red-500 transition-all group-hover:bg-red-400"
                    style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 4 : 0 }} />
                </div>
                <div className="mt-2 text-[10px] text-zinc-500">{m}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
