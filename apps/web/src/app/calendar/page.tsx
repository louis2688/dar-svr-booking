"use client";

import { BOOKING_TIME_OPTIONS, formatBookingTimeLabel } from "@svr/shared";
import { useEffect, useMemo, useState } from "react";

type Vehicle = { id: string; name: string; plateNo?: string | null };
type DayAvail = { date: string; bookedTimes: string[] };

/** Day cells (YYYY-MM-DD) for a month grid, plus the weekday offset of day 1. */
function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const weekday0 = first.getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return { weekday0, days };
}

function thisMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [month, setMonth] = useState(thisMonthKey());
  const [avail, setAvail] = useState<Record<string, DayAvail>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/vehicles");
      const json = (await res.json().catch(() => null)) as { items?: Vehicle[] } | null;
      const items = json?.items ?? [];
      setVehicles(items);
      if (items[0]) setVehicleId(items[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/availability?vehicleId=${vehicleId}&month=${month}`);
      const json = (await res.json().catch(() => null)) as { days?: DayAvail[] } | null;
      if (cancelled) return;
      const map: Record<string, DayAvail> = {};
      for (const d of json?.days ?? []) map[d.date] = d;
      setAvail(map);
      setSelected(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, month]);

  const cal = useMemo(() => monthDays(month), [month]);
  const total = BOOKING_TIME_OPTIONS.length;
  const selectedBooked = selected ? (avail[selected]?.bookedTimes ?? []) : [];

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold">Booking Calendar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Booked time slots across all requests (approved). Read-only — pick a vehicle and month, then a day to see its
          booked times.
        </p>

        <div className="mt-5 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-[220px] flex-col gap-1 text-sm">
              <span className="text-zinc-600">Vehicle</span>
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.plateNo ? ` (${v.plateNo})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Month</span>
              <input
                type="month"
                className="rounded-lg border px-3 py-2 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            {loading ? <span className="pb-2 text-xs text-zinc-400">Loading…</span> : null}
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-zinc-500">
                {d}
              </div>
            ))}
            {Array.from({ length: cal.weekday0 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {cal.days.map((d) => {
              const n = avail[d]?.bookedTimes.length ?? 0;
              const isSelected = d === selected;
              const color =
                n === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : n >= total
                    ? "bg-red-50 border-red-200 text-red-900"
                    : "bg-amber-50 border-amber-200 text-amber-900";
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={[
                    "aspect-square rounded-lg border text-sm font-medium",
                    color,
                    isSelected ? "ring-2 ring-zinc-900" : "hover:ring-2 hover:ring-zinc-300"
                  ].join(" ")}
                >
                  {Number(d.slice(-2))}
                  <div className="mt-1 text-[10px] leading-tight text-zinc-600">
                    {n}/{total}
                  </div>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="mt-5 rounded-xl border bg-zinc-50 p-4">
              <div className="text-sm font-semibold">{selected}</div>
              {selectedBooked.length === 0 ? (
                <p className="mt-1 text-sm text-zinc-500">No booked slots — all times open.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...selectedBooked]
                    .sort()
                    .map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                      >
                        {formatBookingTimeLabel(t)} · booked
                      </span>
                    ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
