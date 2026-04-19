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

  const adminId = resolvedAdmin.userId;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.bookingRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          adminNotes,
          decidedById: adminId,
          decidedAt: new Date()
        }
      });

      if (result.count === 0) {
        throw new Prisma.PrismaClientKnownRequestError("Only PENDING requests can be approved.", {
          code: "P2025",
          clientVersion: Prisma.prismaVersion.client
        });
      }

      return tx.bookingRequest.findUniqueOrThrow({
        where: { id },
        include: { vehicle: true, passengers: true }
      });
    });

    return NextResponse.json({
      ...updated,
      message: "Approved"
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "INVALID_STATUS", message: "Only PENDING requests can be approved." },
          { status: 422 }
        );
      }
      if (error.code === "P2002") {
        // Unique constraint violation -> same start time already booked (approved)
        const reqRow = await prisma.bookingRequest.findUnique({
          where: { id },
          select: { vehicleId: true, date: true, startTime: true }
        });
        return NextResponse.json(
          {
            error: "START_TIME_ALREADY_BOOKED",
            message: "Vehicle is already booked for this date and start time.",
            vehicleId: reqRow?.vehicleId,
            date: reqRow?.date?.toISOString().slice(0, 10),
            startTime: reqRow?.startTime
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
