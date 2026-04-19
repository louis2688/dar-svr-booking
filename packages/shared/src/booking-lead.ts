/** Minimum lead time before the chosen start time (Manila). */
export const BOOKING_LEAD_MS = 60 * 60 * 1000;

const MANILA_TZ = "Asia/Manila";

/**
 * Today (or `d`) as YYYY-MM-DD in Manila. Uses `formatToParts` so separators are never locale-dependent
 * (some engines return slashes from `format()`, which breaks API query validation and string compares).
 */
export function manilaDateKeyFromDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && mo && day) return `${y}-${mo}-${day}`;
  return fmt.format(d).replace(/\//g, "-").slice(0, 10);
}

/** Current Manila calendar month as YYYY-MM (for month pickers and availability API). */
export function manilaYearMonthKeyFromDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit"
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (y && m) return `${y}-${m}`;
  return manilaDateKeyFromDate(d).slice(0, 7);
}

/** UTC instant when `timeHm` (HH:mm) occurs on `dateKey` (YYYY-MM-DD) in Manila. */
export function bookingTimeUtcMs(dateKey: string, timeHm: string): number {
  const [y, mo, day] = dateKey.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+08:00`;
  return new Date(iso).getTime();
}

/**
 * True when the booking date/time satisfies the lead-time rule (Manila).
 * Past calendar dates are never allowed. Future dates allow any configured time.
 */
export function isBookingLeadTimeSatisfied(
  dateKey: string,
  timeHm: string,
  now: Date = new Date()
): boolean {
  const todayKey = manilaDateKeyFromDate(now);
  if (dateKey < todayKey) return false;
  if (dateKey > todayKey) return true;

  const startMs = bookingTimeUtcMs(dateKey, timeHm);
  return startMs >= now.getTime() + BOOKING_LEAD_MS;
}

export const BOOKING_TOO_SOON_MESSAGE =
  "Choose today or a future date, and allow at least 1 hour before your selected start time (Asia/Manila).";
