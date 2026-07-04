import type { BookingStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { BookingsSummaryFilters } from "@/components/BookingsSummaryFilters";
import { BookingsChart } from "@/components/dashboard/BookingsChart";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { authOptions } from "@/auth";
import { prisma } from "@/server/db";
import { toBookingRow } from "@/server/booking-row";

function parseSummaryStatus(raw: string | undefined): BookingStatus | undefined {
  if (raw === undefined || raw === "") return "APPROVED";
  if (raw === "all") return undefined;
  if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(raw)) {
    return raw as BookingStatus;
  }
  return "APPROVED";
}


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
          <div className="mx-auto w-full max-w-md">
            <img
              src="/branding/svr-logo.png"
              alt="SVR — Service Vehicle Request"
              width={384}
              height={256}
              className="mx-auto h-auto w-full max-w-[340px]"
              loading="eager"
              decoding="async"
            />
            <div className="mt-4 text-base font-semibold tracking-tight text-black">
              DEPARTMENT OF AGRARIAN REFORM · MARINDUQUE
            </div>
            <p className="mt-2 text-sm text-zinc-600">Service Vehicle Request (SVR) system</p>
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

              <BookingsTable rows={booked.map(toBookingRow)} emptyMessage={emptyMessage} />
              <p className="mt-3 text-xs text-zinc-500">Tip: click a row to view booking details.</p>
            </div>
    </div>
  );
}
