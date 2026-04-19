const MANILA_TZ = "Asia/Manila";

export function manilaDateKey(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  // en-CA produces YYYY-MM-DD
  return fmt.format(d);
}

export function manilaYearMonthKey(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit"
  });
  // en-CA with year+month only can be "YYYY-MM" in some runtimes; build it from parts to be safe.
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (!y || !m) {
    // Fallback: use the YYYY-MM from a YYYY-MM-01 string
    return manilaDateKey(d).slice(0, 7);
  }
  return `${y}-${m}`;
}

export function monthKeyToUTCDateFirstOfMonth(monthKey: string): Date {
  // We store "month bucket" as UTC midnight of the 1st of that YYYY-MM in the local key.
  const [y, m] = monthKey.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

export function dateKeyToUTCDateMidnight(dateKey: string): Date {
  // We store "date-only" fields as UTC midnight for that dateKey.
  // Display/formatting should always be done using Asia/Manila for control numbers.
  const [y, m, day] = dateKey.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0));
}

export function formatControlNo(yearMonthKey: string, seq: number): string {
  // YYYY-MM-0000
  const padded = String(seq).padStart(4, "0");
  return `${yearMonthKey}-${padded}`;
}

export function formatManilaDateTime(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(date);
  const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value;

  const y = pick("year");
  const m = pick("month");
  const day = pick("day");
  const hh = pick("hour");
  const mm = pick("minute");
  const ss = pick("second");

  // Prefer stable assembly; fallback to Intl string normalization if parsing fails.
  if (y && m && day && hh && mm && ss) {
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  return fmt.format(date).replace("T", " ").replace(", ", " ");
}

