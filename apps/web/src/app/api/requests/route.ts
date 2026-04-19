import { NextResponse } from "next/server";
import { CreateRequestSchema } from "@svr/shared";
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

  const controlMonthKey = manilaYearMonthKey(new Date());
  const controlDate = monthKeyToUTCDateFirstOfMonth(controlMonthKey);

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const counter = await tx.controlCounter.upsert({
          where: { controlDate },
          create: { controlDate, lastSeq: 1 },
          update: { lastSeq: { increment: 1 } }
        });

        const controlNo = formatControlNo(controlMonthKey, counter.lastSeq);

        const reqRow = await tx.bookingRequest.create({
          data: {
            controlNo,
            controlDate,
            monthlySeq: counter.lastSeq,
            vehicleId: input.vehicleId,
            date: bookingDate,
            startTime: input.startTime,
            destination: input.destination,
            purpose: input.purpose,
            timeText: input.timeText,
            requestorName: input.requestorName,
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
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to create request"
      },
      { status: 500 }
    );
  }
}
