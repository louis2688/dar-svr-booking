import type { BookingStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { BookingsSummaryFilters } from "@/components/BookingsSummaryFilters";
import { BookingsChart } from "@/components/dashboard/BookingsChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { authOptions } from "@/auth";
import { prisma } from "@/server/db";
import { formatManilaDateTime } from "@/server/time";
import { formatBookingTimeLabel } from "@svr/shared";

function parseSummaryStatus(raw: string | undefined): BookingStatus | undefined {
  if (raw === undefined || raw === "") return "APPROVED";
  if (raw === "all") return undefined;
  if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(raw)) {
    return raw as BookingStatus;
  }
  return "APPROVED";
}

const STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-zinc-100 text-zinc-700 border-zinc-200"
};

/** Weekly counts (oldest → newest) for the sparkline + week-over-week delta. */
function weeklySeries(rows: { createdAt: Date; status: BookingStatus }[], status: BookingStatus, weeks = 8) {
  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const buckets = new Array(weeks).fill(0);
  for (const r of rows) {
    if (r.status !== status) continue;
    const age = now - r.createdAt.getTime();
    const idx = weeks - 1 - Math.floor(age / WEEK);
    if (idx >= 0 && idx < weeks) buckets[idx] += 1;
  }
  const thisWeek = buckets[weeks - 1];
  const lastWeek = buckets[weeks - 2];
  const deltaPct = lastWeek === 0 ? (thisWeek > 0 ? 100 : null) : ((thisWeek - lastWeek) / lastWeek) * 100;
  return { series: buckets, deltaPct };
}

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const role = session?.role;
  const isAuthed = Boolean(session?.userId);

  if (!isAuthed) {
    return (
      <div className="min-h-dvh bg-zinc-50 text-zinc-900">
        <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-full max-w-md">
            <div className="mx-auto w-full max-w-[320px]">
              {/* SVG via <img> (Next/Image blocks SVG by default without extra config) */}
              <img
                src="/branding/dar.svg"
                alt="Department of Agrarian Reform (DAR) seal"
                width={490}
                height={490}
                className="mx-auto h-auto w-full max-w-[320px]"
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="mt-6 text-lg font-semibold tracking-tight text-black">
              DEPARTMENT OF AGRARIAN REFORM
              <br />
              MARINDUQUE
            </div>
            <p className="mt-6 text-sm text-zinc-600">Service Vehicle Request (SVR) system</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Link
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                href="/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                href="/login?signup=1"
              >
                Sign up
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = role === "ADMIN";
  // Users see their own bookings; admins see everything.
  const scope: Prisma.BookingRequestWhereInput = isAdmin ? {} : { requestedById: session?.userId };

  const statusFilter = parseSummaryStatus(params.status?.trim());
  const qRaw = params.q?.trim() ?? "";

  const where: Prisma.BookingRequestWhereInput = { ...scope };
  if (statusFilter !== undefined) {
    where.status = statusFilter;
  }
  if (qRaw) {
    where.OR = [
      { controlNo: { contains: qRaw, mode: "insensitive" } },
      { requestorName: { contains: qRaw, mode: "insensitive" } },
      { destination: { contains: qRaw, mode: "insensitive" } },
      { vehicle: { name: { contains: qRaw, mode: "insensitive" } } },
      { vehicle: { plateNo: { contains: qRaw, mode: "insensitive" } } }
    ];
  }

  const now = new Date();
  const year = now.getFullYear();
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 3600 * 1000);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [booked, statusCounts, recentRows, yearRows] = await Promise.all([
    prisma.bookingRequest.findMany({
      where,
      orderBy: { date: "asc" },
      take: 100,
      include: { vehicle: true }
    }),
    prisma.bookingRequest.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true }
    }),
    prisma.bookingRequest.findMany({
      where: { ...scope, createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, status: true }
    }),
    prisma.bookingRequest.findMany({
      where: { ...scope, date: { gte: yearStart, lt: yearEnd } },
      select: { date: true, status: true }
    })
  ]);

  const countOf = (s: BookingStatus) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  const cards = (["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map((s) => ({
    status: s,
    count: countOf(s),
    ...weeklySeries(recentRows, s)
  }));

  const approvedByMonth = new Array(12).fill(0);
  const cancelledByMonth = new Array(12).fill(0);
  for (const r of yearRows) {
    const m = r.date.getUTCMonth();
    if (r.status === "APPROVED") approvedByMonth[m] += 1;
    else if (r.status === "REJECTED" || r.status === "CANCELLED") cancelledByMonth[m] += 1;
  }

  const emptyMessage =
    statusFilter === "APPROVED" && !qRaw
      ? "No approved bookings yet."
      : "No bookings match the current filters.";

  return (
    <div className="px-4 py-5 sm:px-6">
      {/* Stat cards + chart */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard title="Pending Bookings" value={cards[0].count} series={cards[0].series} deltaPct={cards[0].deltaPct} />
                <StatCard title="Approved Bookings" value={cards[1].count} series={cards[1].series} deltaPct={cards[1].deltaPct} />
                <StatCard title="Rejected Bookings" value={cards[2].count} series={cards[2].series} deltaPct={cards[2].deltaPct} invert />
                <StatCard title="Cancelled Bookings" value={cards[3].count} series={cards[3].series} deltaPct={cards[3].deltaPct} invert />
              </div>
              <BookingsChart year={year} approved={approvedByMonth} cancelled={cancelledByMonth} />
            </div>

            {/* Bookings table */}
            <div className="mt-6 rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{isAdmin ? "All Bookings" : "My Bookings"}</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Latest {booked.length} rows · Manila timestamps (24-hour).
                  </div>
                </div>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                  href="/request"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Add Booking
                </Link>
              </div>

              <Suspense
                fallback={<div className="mt-4 h-[76px] animate-pulse rounded-lg bg-zinc-100 sm:h-[52px]" />}
              >
                <BookingsSummaryFilters />
              </Suspense>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                      <th className="rounded-l-lg px-3 py-2.5 font-medium">Control no</th>
                      <th className="px-3 py-2.5 font-medium">Vehicle</th>
                      <th className="px-3 py-2.5 font-medium">Trip date</th>
                      <th className="px-3 py-2.5 font-medium">Start time</th>
                      <th className="px-3 py-2.5 font-medium">Requestor</th>
                      <th className="px-3 py-2.5 font-medium">Destination</th>
                      <th className="px-3 py-2.5 font-medium">Created</th>
                      <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booked.length === 0 ? (
                      <tr className="border-t">
                        <td className="px-3 py-4 text-zinc-600" colSpan={8}>
                          {emptyMessage}
                        </td>
                      </tr>
                    ) : (
                      booked.map((b) => (
                        <tr key={b.id} className="border-t border-zinc-100">
                          <td className="px-3 py-3 font-semibold">{b.controlNo}</td>
                          <td className="px-3 py-3">
                            {b.vehicle ? (
                              <span className="inline-flex items-center gap-1.5">
                                {b.vehicle.name}
                                {b.vehicle.plateNo ? (
                                  <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                                    {b.vehicle.plateNo}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-zinc-400">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-3">{b.date.toISOString().slice(0, 10)}</td>
                          <td className="px-3 py-3">{formatBookingTimeLabel(b.startTime)}</td>
                          <td className="px-3 py-3">{b.requestorName}</td>
                          <td className="px-3 py-3">{b.destination}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{formatManilaDateTime(b.createdAt)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={[
                                "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                STATUS_CHIP[b.status] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"
                              ].join(" ")}
                            >
                              {b.status.charAt(0)}
                              {b.status.slice(1).toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </div>
  );
}
