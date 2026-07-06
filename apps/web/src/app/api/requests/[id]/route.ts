import { NextResponse } from "next/server";
import { CreateRequestSchema } from "@svr/shared";
import { Prisma } from "@prisma/client";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { dateKeyToUTCDateMidnight, monthKeyToUTCDateFirstOfMonth } from "@/server/time";

async function loadOwned(id: string, userId: string, isAdmin: boolean) {
  const reqRow = await prisma.bookingRequest.findUnique({
    where: { id },
    include: { vehicle: true, passengers: true }
  });
  if (!reqRow) return { ok: false as const, status: 404, message: "Request not found." };
  if (!isAdmin && reqRow.requestedById !== userId) {
    return { ok: false as const, status: 403, message: "Forbidden." };
  }
  return { ok: true as const, reqRow };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const { id } = await ctx.params;
  const loaded = await loadOwned(id, me.userId, me.role === "ADMIN");
  if (!loaded.ok) {
    return NextResponse.json({ error: "NOT_FOUND", message: loaded.message }, { status: loaded.status });
  }
  return NextResponse.json({ item: loaded.reqRow });
}

/**
 * PATCH /api/requests/:id — edit an existing booking. Admin-only: owners can
 * no longer self-edit their own request regardless of status.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  if (me.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Only admins can edit bookings." }, { status: 403 });
  }
  const isAdmin = true;

  const { id } = await ctx.params;

  const loaded = await loadOwned(id, me.userId, isAdmin);
  if (!loaded.ok) {
    return NextResponse.json({ error: "NOT_FOUND", message: loaded.message }, { status: loaded.status });
  }
  const existing = loaded.reqRow;

  const body = await req.json().catch(() => null);
  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const bookingDate = dateKeyToUTCDateMidnight(input.date);

  // Admin may re-number a booking (e.g. correcting a backfilled past booking
  // to match the printed paper form). Only applied when actually different.
  const newControlNo = input.controlNo && input.controlNo !== existing.controlNo ? input.controlNo : null;

  // Vehicle stays admin-only, same rule as create; owners can never set/change it here.
  // Distinguish "omitted" (undefined -> keep existing) from an explicit `null`
  // (admin deliberately clearing the assignment) -- `??` alone can't tell those apart.
  const vehicleId = isAdmin
    ? input.vehicleId !== undefined
      ? input.vehicleId
      : existing.vehicleId
    : existing.vehicleId;

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.active === false) {
      return NextResponse.json(
        { error: "INVALID_VEHICLE", message: "Selected vehicle does not exist or is inactive." },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        // Same-slot double-booking is intentionally allowed — no clash guard.

        // Re-numbering: keep controlDate/monthlySeq consistent with the new
        // number and keep that month's counter at/above the manual seq so
        // future auto-generated numbers can't collide with it.
        if (newControlNo) {
          const rowControlDate = monthKeyToUTCDateFirstOfMonth(newControlNo.slice(0, 7));
          // Numeric part only; a trailing letter (e.g. 0229A) is a variant marker.
          const rowSeq = parseInt(newControlNo.slice(8), 10);
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
        }

        await tx.passenger.deleteMany({ where: { requestId: id } });

        return tx.bookingRequest.update({
          where: { id },
          data: {
            ...(newControlNo
              ? {
                  controlNo: newControlNo,
                  controlDate: monthKeyToUTCDateFirstOfMonth(newControlNo.slice(0, 7)),
                  monthlySeq: parseInt(newControlNo.slice(8), 10)
                }
              : {}),
            vehicleId,
            date: bookingDate,
            startTime: input.startTime,
            destination: input.destination,
            purpose: input.purpose,
            timeText: input.timeText ?? null,
            requestorName: input.requestorName,
            passengers: { create: input.passengers.map((fullName: string) => ({ fullName })) }
          },
          include: { vehicle: true, passengers: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({ ok: true, item: updated });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "CONTROL_NO_TAKEN", message: "That control number is already used by another booking." },
          { status: 409 }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND", message: "Request not found." }, { status: 404 });
      }
      // Serializable transaction conflict: a concurrent edit/approve raced this one.
      if (error.code === "P2034") {
        return NextResponse.json(
          {
            error: "EDIT_CONFLICT",
            message: "Another change was processed on this request at the same time. Refresh and try again."
          },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Failed to update request" },
      { status: 500 }
    );
  }
}
