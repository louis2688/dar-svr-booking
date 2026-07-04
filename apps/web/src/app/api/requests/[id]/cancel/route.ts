import { NextResponse } from "next/server";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

/**
 * POST /api/requests/:id/cancel — soft-cancel (status -> CANCELLED). Admin-only.
 * Already-finalized requests (REJECTED/CANCELLED) can't be cancelled again.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  if (me.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Only admins can cancel bookings." }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Request not found." }, { status: 404 });
  }

  // Re-assert status inside the update's where-clause (not just the read above) so a
  // concurrent approve/reject/cancel on the same row can't be silently clobbered —
  // updateMany + count===0 is how the sibling reject route handles this same race.
  const result = await prisma.bookingRequest.updateMany({
    where: { id, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED", decidedById: me.userId, decidedAt: new Date() }
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
