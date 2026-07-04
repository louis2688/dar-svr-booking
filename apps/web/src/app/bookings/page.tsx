import type { BookingStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { BookingsSummaryFilters } from "@/components/BookingsSummaryFilters";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { authOptions } from "@/auth";
import { prisma } from "@/server/db";
import { toBookingRow } from "@/server/booking-row";

function parseStatus(raw: string | undefined): BookingStatus | undefined {
  if (raw === undefined || raw === "" || raw === "all") return undefined; // default: all on this page
  if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(raw)) return raw as BookingStatus;
  return undefined;
}

export default async function BookingsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-sm text-zinc-600">
          Please{" "}
          <Link href="/login" className="font-medium underline">
            sign in
          </Link>{" "}
          to view bookings.
        </p>
      </div>
    );
  }

  const isAdmin = session.role === "ADMIN";
  const scope: Prisma.BookingRequestWhereInput = isAdmin ? {} : { requestedById: session.userId };

  const statusFilter = parseStatus(params.status?.trim());
  const qRaw = params.q?.trim() ?? "";

  const where: Prisma.BookingRequestWhereInput = { ...scope };
  if (statusFilter !== undefined) where.status = statusFilter;
  if (qRaw) {
    where.OR = [
      { controlNo: { contains: qRaw, mode: "insensitive" } },
      { requestorName: { contains: qRaw, mode: "insensitive" } },
      { destination: { contains: qRaw, mode: "insensitive" } },
      { vehicle: { name: { contains: qRaw, mode: "insensitive" } } },
      { vehicle: { plateNo: { contains: qRaw, mode: "insensitive" } } }
    ];
  }

  const booked = await prisma.bookingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { vehicle: true }
  });

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{isAdmin ? "All Bookings" : "My Bookings"}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {booked.length} booking{booked.length === 1 ? "" : "s"} · click a row to view details.
            </p>
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

        <div className="mt-5 rounded-xl border bg-white p-5">
          <Suspense fallback={<div className="h-[76px] animate-pulse rounded-lg bg-zinc-100 sm:h-[52px]" />}>
            <BookingsSummaryFilters defaultStatus="all" />
          </Suspense>
          <BookingsTable rows={booked.map(toBookingRow)} emptyMessage="No bookings match the current filters." />
        </div>
      </div>
    </div>
  );
}
