import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const plateRaw = body?.plateNo;
  const plateNo =
    typeof plateRaw === "string" ? (plateRaw.trim() === "" ? null : plateRaw.trim()) : undefined;
  const active = typeof body?.active === "boolean" ? body.active : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Name cannot be empty." }, { status: 400 });
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(plateNo !== undefined ? { plateNo } : {}),
        ...(active !== undefined ? { active } : {})
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    throw e;
  }
}

/**
 * DELETE /api/vehicles/:id
 * - Default (no query): soft-delete — sets active=false (keeps historical bookings intact).
 * - permanent=1: hard-delete row (only allowed when there are zero booking requests for this vehicle).
 * - permanent=1&forceBookings=1: hard-delete vehicle AND delete all related booking requests (destructive).
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const permanent =
    url.searchParams.get("permanent") === "1" || url.searchParams.get("hard") === "1";
  const forceBookings =
    url.searchParams.get("forceBookings") === "1" || url.searchParams.get("force") === "1";

  if (permanent) {
    const bookingCount = await prisma.bookingRequest.count({ where: { vehicleId: id } });

    try {
      if (bookingCount > 0) {
        if (!forceBookings) {
          return NextResponse.json(
            {
              error: "HAS_BOOKINGS",
              message:
                "This vehicle cannot be permanently deleted because it has booking history. Remove is soft-delete only.",
              bookingCount
            },
            { status: 409 }
          );
        }

        await prisma.$transaction(async (tx) => {
          await tx.bookingRequest.deleteMany({ where: { vehicleId: id } });
          await tx.vehicle.delete({ where: { id } });
        });

        return NextResponse.json({ ok: true, deleted: true, deletedBookings: bookingCount });
      }

      await prisma.vehicle.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      throw e;
    }
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data: { active: false }
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    throw e;
  }
}
