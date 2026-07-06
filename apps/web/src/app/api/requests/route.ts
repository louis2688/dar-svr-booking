import { NextResponse } from "next/server";
import { BOOKING_TOO_SOON_MESSAGE, CreateRequestSchema, isBookingLeadTimeSatisfied } from "@svr/shared";
import { Prisma } from "@prisma/client";

import { requireUser, resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  dateKeyToUTCDateMidnight,
  formatControlNo,
  manilaYearMonthKey,
  monthKeyToUTCDateFirstOfMonth
} from "@/server/time";

export async function POST(req: Request) {
  const sessionRes = await requireUser();
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const resolvedUser = await resolveSessionDbUser();
  if (!resolvedUser.ok) {
    return NextResponse.json({ error: "SESSION_STALE", message: resolvedUser.message }, { status: resolvedUser.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const bookingDate = dateKeyToUTCDateMidnight(input.date);

  // Only admins choose the vehicle. User submissions always start unassigned —
  // the admin picks the vehicle before approving. Enforced here regardless of payload.
  const isAdmin = resolvedUser.role === "ADMIN";

  // Lead-time / no-past-dates applies to regular users only. Admins may
  // backfill past bookings (recording trips that already happened).
  if (!isAdmin && !isBookingLeadTimeSatisfied(input.date, input.startTime)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", issues: [{ path: ["startTime"], message: BOOKING_TOO_SOON_MESSAGE }] },
      { status: 400 }
    );
  }
  const vehicleId = isAdmin ? (input.vehicleId ?? null) : null;

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.active === false) {
      return NextResponse.json(
        { error: "INVALID_VEHICLE", message: "Selected vehicle does not exist or is inactive." },
        { status: 400 }
      );
    }
  }

  // Double-submit guard: a rapid duplicate (double-tap, network retry) returns the
  // just-created row instead of minting a second control number.
  const recentDuplicate = await prisma.bookingRequest.findFirst({
    where: {
      requestedById: resolvedUser.userId,
      date: bookingDate,
      startTime: input.startTime,
      destination: input.destination,
      purpose: input.purpose,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 60_000) }
    },
    include: { passengers: true, vehicle: true }
  });
  if (recentDuplicate) {
    return NextResponse.json(recentDuplicate, { status: 200 });
  }

  const controlMonthKey = manilaYearMonthKey(new Date());
  const controlDate = monthKeyToUTCDateFirstOfMonth(controlMonthKey);

  // Admin backfill: honor the control number from the printed paper form.
  const manualControlNo = isAdmin && input.controlNo ? input.controlNo : null;

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        let controlNo: string;
        let rowControlDate: Date;
        let rowSeq: number;

        if (manualControlNo) {
          controlNo = manualControlNo;
          rowControlDate = monthKeyToUTCDateFirstOfMonth(manualControlNo.slice(0, 7));
          rowSeq = parseInt(manualControlNo.slice(8), 10);
          // Keep that month's counter at/above the manual seq so future
          // auto-generated numbers can't collide with it.
          const counter = await tx.controlCounter.upsert({
            where: { controlDate: rowControlDate },
            create: { controlDate: rowControlDate, lastSeq: rowSeq },
            update: {}
          });
          if (counter.lastSeq < rowSeq) {
            await tx.controlCounter.update({
              where: { controlDate: rowControlDate },
              data: { lastSeq: rowSeq }
            });
          }
        } else {
          const counter = await tx.controlCounter.upsert({
            where: { controlDate },
            create: { controlDate, lastSeq: 1 },
            update: { lastSeq: { increment: 1 } }
          });
          // Trailing letter cycles A..Z, advancing once per generated booking
          // (global, not per-month). Stored in a sentinel ControlCounter row so
          // no separate table/migration is needed. 1970-01 can't be a real
          // booking month, so it never clashes with a month bucket.
          const letterKey = new Date("1970-01-01T00:00:00.000Z");
          const letterCounter = await tx.controlCounter.upsert({
            where: { controlDate: letterKey },
            create: { controlDate: letterKey, lastSeq: 1 },
            update: { lastSeq: { increment: 1 } }
          });
          const letter = String.fromCharCode(65 + ((letterCounter.lastSeq - 1) % 26));
          controlNo = formatControlNo(controlMonthKey, counter.lastSeq) + letter;
          rowControlDate = controlDate;
          rowSeq = counter.lastSeq;
        }

        const reqRow = await tx.bookingRequest.create({
          data: {
            controlNo,
            controlDate: rowControlDate,
            monthlySeq: rowSeq,
            vehicleId,
            date: bookingDate,
            startTime: input.startTime,
            destination: input.destination,
            purpose: input.purpose,
            timeText: input.timeText,
            requestorName: input.requestorName,
            notedBy: input.notedBy ?? null,
            status: "PENDING",
            requestedById: resolvedUser.userId,
            passengers: {
              create: input.passengers.map((fullName: string) => ({ fullName }))
            }
          },
          include: { passengers: true, vehicle: true }
        });

        return reqRow;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "CONTROL_NO_TAKEN", message: "That control number is already used by another booking." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to create request"
      },
      { status: 500 }
    );
  }
}
