import { z } from "zod";

/** Half-hour steps from 12:00 AM (00:00) through 11:30 PM (23:30), Manila wall clock. */
function buildHalfHourTimes(): string[] {
  const out: string[] = [];
  for (let mins = 0; mins <= 23 * 60 + 30; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
}

const _bookingTimeOptions = buildHalfHourTimes();

export const BOOKING_TIME_OPTIONS = _bookingTimeOptions as unknown as readonly [string, ...string[]];

export type BookingTime = (typeof BOOKING_TIME_OPTIONS)[number];

export const BookingTimeSchema = z.enum(BOOKING_TIME_OPTIONS);

export function formatBookingTimeLabel(hm: string): string {
  const [hhRaw, mmRaw] = hm.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return hm;
  const iso = `2000-01-01T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+08:00`;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(iso));
}
