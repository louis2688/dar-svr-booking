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
          status: "REJECTED",
          adminNotes,
          decidedById: adminId,
          decidedAt: new Date()
        }
      });

      if (result.count === 0) {
        throw new Prisma.PrismaClientKnownRequestError("Only PENDING requests can be rejected.", {
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
      message: "Rejected"
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: "Only PENDING requests can be rejected." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Rejection failed"
      },
      { status: 500 }
    );
  }
}
