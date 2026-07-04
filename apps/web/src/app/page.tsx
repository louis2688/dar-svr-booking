import type { BookingStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { BookingsSummaryFilters } from "@/components/BookingsSummaryFilters";
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

function summarySubtitle(
  status: BookingStatus | undefined,
  count: number,
  q: string
) {
  const label =
    status === undefined
      ? "All statuses"
      : status === "APPROVED"
        ? "Approved bookings"
        : `${status.charAt(0)}${status.slice(1).toLowerCase()} bookings`;
  const qNote = q ? ` · Search: “${q}”` : "";
  return `${label} (latest ${count} rows)${qNote}.`;
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

  const statusFilter = parseSummaryStatus(params.status?.trim());
  const qRaw = params.q?.trim() ?? "";

  const where: Prisma.BookingRequestWhereInput = {};
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

  const booked = await prisma.bookingRequest.findMany({
    where,
    orderBy: { date: "asc" },
    take: 100,
    include: { vehicle: true }
  });

  const emptyMessage =
    statusFilter === "APPROVED" && !qRaw
      ? "No approved bookings yet."
      : "No bookings match the current filters.";

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">DAR - SVR Booking</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Service Vehicle Request system with scheduled start times, admin approval, and printable forms.
        </p>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-zinc-500">Signed in as:</span>{" "}
                <span className="font-medium break-all">{session?.user?.email ?? "Guest"}</span>
              </div>
              <Link
                className="inline-flex shrink-0 items-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                href="/request"
              >
                Create request
              </Link>
            </div>
            <div className="mt-2">
              <span className="text-zinc-500">Role:</span>{" "}
              <span className="font-medium">{role ?? "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Bookings summary</div>
              <div className="mt-1 text-sm text-zinc-600">
                {summarySubtitle(statusFilter, booked.length, qRaw)}
              </div>
            </div>
            <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Manila timestamps use 24-hour time (HH:MM:SS).
            </div>
          </div>

          <Suspense
            fallback={
              <div className="mt-4 h-[76px] animate-pulse rounded-lg bg-zinc-100 sm:h-[52px]" />
            }
          >
            <BookingsSummaryFilters />
          </Suspense>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3">Control no</th>
                  <th className="py-2 pr-3">Vehicle</th>
                  <th className="py-2 pr-3">Trip date</th>
                  <th className="py-2 pr-3">Start time</th>
                  <th className="py-2 pr-3">Requestor</th>
                  <th className="py-2 pr-3">Destination</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {booked.length === 0 ? (
                  <tr className="border-t">
                    <td className="py-4 text-zinc-600" colSpan={7}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  booked.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="py-3 pr-3 font-medium">{b.controlNo}</td>
                      <td className="py-3 pr-3">
                        {b.vehicle ? (
                          <>
                            {b.vehicle.name}
                            {b.vehicle.plateNo ? <span className="text-zinc-500"> ({b.vehicle.plateNo})</span> : null}
                          </>
                        ) : (
                          <span className="text-zinc-500">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{b.date.toISOString().slice(0, 10)}</td>
                      <td className="py-3 pr-3">{formatBookingTimeLabel(b.startTime)}</td>
                      <td className="py-3 pr-3">{b.requestorName}</td>
                      <td className="py-3 pr-3">{b.destination}</td>
                      <td className="py-3 whitespace-nowrap">{formatManilaDateTime(b.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
