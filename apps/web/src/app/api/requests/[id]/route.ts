import { NextResponse } from "next/server";
import { CreateRequestSchema } from "@svr/shared";
import { Prisma } from "@prisma/client";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { dateKeyToUTCDateMidnight } from "@/server/time";

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
 * PATCH /api/requests/:id — edit an existing booking.
 * - Owner (non-admin): may edit only their own request while it is PENDING.
 *   Vehicle assignment stays admin-only, same as create.
 * - Admin: may edit any request regardless of status, including reassigning
 *   the vehicle. If the (possibly new) vehicle/date/startTime combination
 *   collides with another APPROVED booking, the edit is rejected (409) —
 *   editing must never silently create a double-booking.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const { id } = await ctx.params;
  const isAdmin = me.role === "ADMIN";

  const loaded = await loadOwned(id, me.userId, isAdmin);
  if (!loaded.ok) {
    return NextResponse.json({ error: "NOT_FOUND", message: loaded.message }, { status: loaded.status });
  }
  const existing = loaded.reqRow;

  if (!isAdmin && existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "LOCKED", message: "Only pending requests can be edited. Cancel it and submit a new one instead." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const bookingDate = dateKeyToUTCDateMidnight(input.date);

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
        // Guard against double-booking: if this request is (or is being made) APPROVED
        // and has a vehicle, no OTHER approved booking may hold the same slot.
        if (existing.status === "APPROVED" && vehicleId) {
          const clash = await tx.bookingRequest.findFirst({
            where: {
              id: { not: id },
              vehicleId,
              date: bookingDate,
              startTime: input.startTime,
              status: "APPROVED"
            },
            select: { id: true }
          });
          if (clash) {
            throw Object.assign(new Error("Vehicle is already booked for this date and start time."), {
              appCode: "START_TIME_ALREADY_BOOKED" as const
            });
          }
        }

        await tx.passenger.deleteMany({ where: { requestId: id } });

        return tx.bookingRequest.update({
          where: { id },
          data: {
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
    const appCode = (error as { appCode?: string })?.appCode;
    if (appCode === "START_TIME_ALREADY_BOOKED") {
      return NextResponse.json({ error: appCode, message: (error as Error).message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
