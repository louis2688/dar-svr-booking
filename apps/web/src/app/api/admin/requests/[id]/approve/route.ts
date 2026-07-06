import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAdmin, resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const resolvedAdmin = await resolveSessionDbUser();
  if (!resolvedAdmin.ok) {
    return NextResponse.json({ error: "SESSION_STALE", message: resolvedAdmin.message }, { status: resolvedAdmin.status });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes : undefined;
  const bodyVehicleId =
    typeof body?.vehicleId === "string" && body.vehicleId.trim() ? body.vehicleId.trim() : undefined;

  const adminId = resolvedAdmin.userId;

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const reqRow = await tx.bookingRequest.findUnique({
          where: { id },
          select: { status: true, vehicleId: true, date: true, startTime: true }
        });

        if (!reqRow || reqRow.status !== "PENDING") {
          throw new Prisma.PrismaClientKnownRequestError("Only PENDING requests can be approved.", {
            code: "P2025",
            clientVersion: Prisma.prismaVersion.client
          });
        }

        // Vehicle is assigned by the admin: either sent with this approval or set earlier.
        const vehicleId = bodyVehicleId ?? reqRow.vehicleId;
        if (!vehicleId) {
          throw Object.assign(new Error("Assign a vehicle before approving this request."), {
            appCode: "VEHICLE_REQUIRED" as const
          });
        }

        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle || vehicle.active === false) {
          throw Object.assign(new Error("Selected vehicle does not exist or is inactive."), {
            appCode: "INVALID_VEHICLE" as const
          });
        }

        // Same-slot double-booking is intentionally allowed — a vehicle may hold
        // multiple bookings at the same date/start time.

        await tx.bookingRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            vehicleId,
            adminNotes,
            decidedById: adminId,
            decidedAt: new Date()
          }
        });

        return tx.bookingRequest.findUniqueOrThrow({
          where: { id },
          include: { vehicle: true, passengers: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({
      ...updated,
      message: "Approved"
    });
  } catch (error: unknown) {
    const appCode = (error as { appCode?: string })?.appCode;
    if (appCode === "VEHICLE_REQUIRED" || appCode === "INVALID_VEHICLE") {
      return NextResponse.json(
        { error: appCode, message: (error as Error).message },
        { status: 422 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "INVALID_STATUS", message: "Only PENDING requests can be approved." },
          { status: 422 }
        );
      }
      // Serializable transaction conflict: a concurrent approval raced this one.
      if (error.code === "P2034") {
        return NextResponse.json(
          {
            error: "APPROVAL_CONFLICT",
            message: "Another approval was processed at the same time. Refresh and try again."
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Approval failed"
      },
      { status: 500 }
    );
  }
}
