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

const PER_PAGE_OPTIONS = [5, 10, 15, 25, 50];

export default async function BookingsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; per?: string; page?: string }>;
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

  const ORDER_BY: Record<string, Prisma.BookingRequestOrderByWithRelationInput[]> = {
    recent: [{ createdAt: "desc" }],
    oldest: [{ createdAt: "asc" }],
    requestor: [{ requestorName: "asc" }, { createdAt: "desc" }],
    destination: [{ destination: "asc" }, { createdAt: "desc" }],
    status: [{ status: "asc" }, { createdAt: "desc" }]
  };
  const sortKey = params.sort && params.sort in ORDER_BY ? params.sort : "recent";
  const perRaw = Number(params.per);
  const perPage = PER_PAGE_OPTIONS.includes(perRaw) ? perRaw : 10;
  const total = await prisma.bookingRequest.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const booked = await prisma.bookingRequest.findMany({
    where,
    orderBy: ORDER_BY[sortKey],
    skip: (page - 1) * perPage,
    take: perPage,
    include: { vehicle: true }
  });

  // Preserve active filters in pager links.
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (qRaw) q.set("q", qRaw);
    if (sortKey !== "recent") q.set("sort", sortKey);
    if (perPage !== 10) q.set("per", String(perPage));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/bookings?${s}` : "/bookings";
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{isAdmin ? "All Bookings" : "My Bookings"}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {total} booking{total === 1 ? "" : "s"} · click a row to view details.
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
            <BookingsSummaryFilters defaultStatus="all" withSort />
          </Suspense>
          <BookingsTable
            rows={booked.map(toBookingRow)}
            emptyMessage="No bookings match the current filters."
            currentUserId={session.userId}
            isAdmin={isAdmin}
          />
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="rounded-lg border bg-white px-3 py-1.5 font-medium hover:bg-zinc-50">
                    ← Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={pageHref(page + 1)} className="rounded-lg border bg-white px-3 py-1.5 font-medium hover:bg-zinc-50">
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
