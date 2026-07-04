import { NextResponse } from "next/server";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

/**
 * POST /api/requests/:id/cancel — soft-cancel (status -> CANCELLED).
 * Owner may cancel their own PENDING/APPROVED request; admin may cancel any.
 * Already-finalized requests (REJECTED/CANCELLED) can't be cancelled again.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const { id } = await ctx.params;
  const isAdmin = me.role === "ADMIN";

  const existing = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { requestedById: true, status: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Request not found." }, { status: 404 });
  }
  if (!isAdmin && existing.requestedById !== me.userId) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Forbidden." }, { status: 403 });
  }

  // Re-assert status inside the update's where-clause (not just the read above) so a
  // concurrent approve/reject/cancel on the same row can't be silently clobbered —
  // updateMany + count===0 is how the sibling reject route handles this same race.
  const result = await prisma.bookingRequest.updateMany({
    where: { id, status: { in: ["PENDING", "APPROVED"] } },
    data: {
      status: "CANCELLED",
      ...(isAdmin ? { decidedById: me.userId, decidedAt: new Date() } : {})
    }
  });

  if (result.count === 0) {
    return NextResponse.json(
      {
        error: "INVALID_STATUS",
        message: "Only pending or approved requests can be cancelled. It may have just been decided elsewhere — refresh and try again."
      },
      { status: 409 }
    );
  }

  const updated = await prisma.bookingRequest.findUnique({
    where: { id },
    include: { vehicle: true, passengers: true }
  });
  return NextResponse.json({ ok: true, item: updated });
}
