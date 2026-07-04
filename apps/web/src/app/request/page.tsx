"use client";

import {
  BOOKING_TIME_OPTIONS,
  BOOKING_TOO_SOON_MESSAGE,
  formatBookingTimeLabel,
  isBookingLeadTimeSatisfied,
  manilaDateKeyFromDate,
  manilaYearMonthKeyFromDate,
  type BookingTime
} from "@svr/shared";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Vehicle = { id: string; name: string; plateNo?: string | null };
type AvailabilityDay = { date: string; bookedTimes: string[] };
type VehiclesResponse = { items?: Vehicle[] };
type AvailabilityResponse = { days?: AvailabilityDay[] };
type SubmitResult = { controlNo: string; id: string };

function ymKeyManila(d: Date) {
  return manilaYearMonthKeyFromDate(d);
}

/** Gregorian days in month as YYYY-MM-DD (matches server date keys). */
function monthDays(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    days.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  const first = new Date(Date.UTC(y, m - 1, 1));
  const weekday0 = first.getUTCDay(); // 0=Sun
  return { days, weekday0 };
}

export default function RequestPage() {
  const { data: session } = useSession();
  const router = useRouter();
  // Only admins pick the vehicle. Users submit without one; the admin assigns it at approval.
  const isAdmin = (session as { role?: string } | null)?.role === "ADMIN";

  const [now, setNow] = useState(() => new Date());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [month, setMonth] = useState(() => ymKeyManila(new Date()));
  const [availability, setAvailability] = useState<Record<string, AvailabilityDay>>({});

  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<BookingTime>(BOOKING_TIME_OPTIONS[0]);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [timeText, setTimeText] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [notedBy, setNotedBy] = useState("");
  const [passengersText, setPassengersText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  /** Synchronous double-click guard: `submitting` state only disables the button after a
      re-render, so two fast taps can both enter submit(). The ref blocks the second
      immediately. */
  const submitLockRef = useRef(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Separate from form errors: availability loads in the background when a vehicle exists. */
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) {
        if (res.status === 401) {
          setError("You must be signed in to load vehicles. Please login, then refresh this page.");
        } else {
          setError("Failed to load vehicles.");
        }
        return;
      }
      const json = (await res.json()) as VehiclesResponse;
      setVehicles(json.items ?? []);
      if (json.items?.[0]?.id) setVehicleId((current) => current || json.items?.[0]?.id || "");
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !vehicleId) return;
    let cancelled = false;
    (async () => {
      setAvailabilityError(null);
      const res = await fetch(`/api/availability?vehicleId=${encodeURIComponent(vehicleId)}&month=${encodeURIComponent(month)}`);
      const json = (await res.json().catch(() => null)) as
        | AvailabilityResponse
        | { error?: string; issues?: { message?: string }[] }
        | null;
      if (cancelled) return;
      if (!res.ok) {
        const detail =
          json && "issues" in json && json.issues?.length
            ? json.issues.map((i) => i.message).filter(Boolean).join(" ")
            : json && "error" in json && typeof json.error === "string"
              ? json.error
              : null;
        setAvailabilityError(
          res.status === 401
            ? "Sign in to see which times are already approved for this vehicle."
            : detail
              ? `Could not load availability: ${detail}`
              : `Could not load availability (HTTP ${res.status}).`
        );
        setAvailability({});
        return;
      }
      const map: Record<string, AvailabilityDay> = {};
      for (const d of (json as AvailabilityResponse).days ?? []) {
        map[d.date] = d;
      }
      setAvailability(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, vehicleId, month]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const manilaTodayKey = useMemo(() => manilaDateKeyFromDate(now), [now]);
  const minMonth = manilaTodayKey.slice(0, 7);

  useEffect(() => {
    if (month < minMonth) setMonth(minMonth);
  }, [month, minMonth]);

  useEffect(() => {
    if (date && date < manilaTodayKey) setDate("");
  }, [date, manilaTodayKey]);

  const cal = useMemo(() => monthDays(month), [month]);

  const selectableTimes = useMemo(() => {
    if (!date) return [];
    const booked = availability[date]?.bookedTimes ?? [];
    return BOOKING_TIME_OPTIONS.filter(
      (t) => isBookingLeadTimeSatisfied(date, t, now) && !booked.includes(t)
    );
  }, [date, availability, now]);

  useEffect(() => {
    if (!date || selectableTimes.length === 0) return;
    if (!selectableTimes.includes(startTime)) {
      setStartTime(selectableTimes[0]);
    }
  }, [date, selectableTimes, startTime]);

  function dayStatus(d: string) {
    const day = availability[d];
    const n = day?.bookedTimes.length ?? 0;
    if (n === 0) return "free";
    if (n >= BOOKING_TIME_OPTIONS.length) return "full";
    return "partial";
  }

  const selectionValid = Boolean(date && selectableTimes.includes(startTime));
  const noTimesLeft = Boolean(date && selectableTimes.length === 0);

  async function submit() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const passengers = passengersText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(isAdmin && vehicleId ? { vehicleId } : {}),
        date,
        startTime,
        destination,
        purpose,
        timeText: timeText || undefined,
        requestorName,
        notedBy: notedBy.trim() || undefined,
        passengers
      })
    });

    const json = (await res.json().catch(() => null)) as
      | { message?: string; issues?: { message?: string }[]; controlNo?: string; id?: string }
      | null;
    if (!res.ok) {
      const fromIssues = json?.issues?.find((i) => i.message)?.message;
      setError(json?.message ?? fromIssues ?? "Failed to submit request.");
    } else if (json?.controlNo && json?.id) {
      setResult({ controlNo: json.controlNo, id: json.id });
    }
    setSubmitting(false);
    submitLockRef.current = false;
  }

  /** "Yes, add another": clear trip fields for a fresh request (requestor name kept). */
  function startAnotherRequest() {
    setResult(null);
    setError(null);
    setDate("");
    setStartTime(BOOKING_TIME_OPTIONS[0]);
    setDestination("");
    setPurpose("");
    setTimeText("");
    setPassengersText("");
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold">Create Service Vehicle Request</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {isAdmin
            ? "Select a vehicle, pick a trip date and start time (Manila), then fill out details. Same-day bookings need at least 1 hour before the chosen time. Past calendar days cannot be selected. Approved bookings for the selected vehicle and month appear in the calendar as soon as a vehicle is chosen."
            : "Pick a trip date and start time (Manila), then fill out details. Same-day bookings need at least 1 hour before the chosen time. The admin assigns a vehicle to your request when it is approved."}
        </p>

        {availabilityError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {availabilityError}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}{" "}
            <a className="font-medium underline" href="/login">
              Go to login
            </a>
          </div>
        ) : null}

        {result ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-emerald-200 bg-white p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <h2 className="mt-3 text-lg font-semibold">Request submitted</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Control no: <span className="font-semibold text-zinc-900">{result.controlNo}</span>
            </p>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-zinc-500">
                The admin will assign a vehicle when your request is approved.
              </p>
            ) : null}
            <a
              className="mt-4 inline-flex rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href={`/requests/${result.id}/print`}
              target="_blank"
              rel="noreferrer"
            >
              Print / Save PDF
            </a>
            <div className="mt-6 border-t pt-4">
              <p className="text-sm font-medium">Add another request?</p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  onClick={startAnotherRequest}
                >
                  Yes, add another
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                  onClick={() => router.push("/")}
                >
                  No, go to homepage
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            {!isAdmin ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <span className="font-medium">Vehicle assignment:</span> the admin chooses the vehicle for your trip
                when approving this request — you only pick the date, time, and trip details.
              </div>
            ) : (
            <>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Vehicle</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  disabled={vehicles.length === 0}
                >
                  {vehicles.length === 0 ? <option value="">No vehicles available</option> : null}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.plateNo ? ` (${v.plateNo})` : ""}
                    </option>
                  ))}
                </select>
                {vehicles.length === 0 ? (
                  <div className="mt-2 text-xs text-zinc-600">
                    Ask an admin to add vehicles in{" "}
                    <a className="font-medium underline" href="/admin/vehicles">
                      Admin → Manage vehicles
                    </a>
                    .
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Month</label>
                <input
                  className="mt-1 rounded-lg border px-3 py-2 text-sm"
                  type="month"
                  min={minMonth}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
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
                const isPastDay = d < manilaTodayKey;
                const status = dayStatus(d);
                const isSelected = d === date;
                const bookedCount = availability[d]?.bookedTimes.length ?? 0;
                const color = isPastDay
                  ? "bg-zinc-100 border-zinc-200 text-zinc-400"
                  : status === "full"
                    ? "bg-red-50 border-red-200 text-red-900"
                    : status === "partial"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900";

                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isPastDay}
                    className={[
                      "aspect-square rounded-lg border text-sm font-medium",
                      color,
                      isPastDay ? "cursor-not-allowed opacity-70" : "",
                      isSelected ? "ring-2 ring-zinc-900" : !isPastDay ? "hover:ring-2 hover:ring-zinc-300" : ""
                    ].join(" ")}
                    onClick={() => {
                      if (!isPastDay) setDate(d);
                    }}
                  >
                    {Number(d.slice(-2))}
                    <div className="mt-1 text-[10px] leading-tight text-zinc-600">
                      {bookedCount}/{BOOKING_TIME_OPTIONS.length}
                    </div>
                  </button>
                );
              })}
            </div>
            </>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="text-sm font-medium">Trip date</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  min={manilaTodayKey}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium">Start time</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value as BookingTime)}
                >
                  {BOOKING_TIME_OPTIONS.map((opt) => {
                    const booked = date ? (availability[date]?.bookedTimes.includes(opt) ?? false) : false;
                    const tooSoon = date ? !isBookingLeadTimeSatisfied(date, opt, now) : false;
                    const disabled = !date || tooSoon || booked;
                    return (
                      <option key={opt} value={opt} disabled={disabled}>
                        {formatBookingTimeLabel(opt)}
                        {booked ? " (booked)" : tooSoon ? " (within 1 hour)" : ""}
                      </option>
                    );
                  })}
                </select>
                {date && noTimesLeft ? (
                  <div className="mt-1 text-xs text-amber-700">
                    No start times left for this day with the 1-hour rule and current approvals. Pick another date.
                  </div>
                ) : null}
                {date && !noTimesLeft && !selectionValid ? (
                  <div className="mt-1 text-xs text-amber-700">{BOOKING_TOO_SOON_MESSAGE}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">Requestor name</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={requestorName}
                  onChange={(e) => setRequestorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destination</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Purpose of travel</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Travel window (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                  placeholder="e.g., 8:00 AM - 5:00 PM"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Noted by (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={notedBy}
                  onChange={(e) => setNotedBy(e.target.value)}
                  placeholder="Name of endorser / immediate supervisor"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Passengers (one per line)</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={5}
                  value={passengersText}
                  onChange={(e) => setPassengersText(e.target.value)}
                />
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                disabled={
                  (isAdmin && (vehicles.length === 0 || !vehicleId)) ||
                  !date ||
                  !destination ||
                  !purpose ||
                  !requestorName ||
                  !selectionValid ||
                  submitting
                }
                onClick={submit}
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
