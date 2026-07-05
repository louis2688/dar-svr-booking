import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";
import { monthKeyToUTCDateFirstOfMonth } from "@/server/time";

/**
 * POST /api/requests/:id/control — admin-only inline edit of the control number
 * from the print view (mirrors the renumber path in the general PATCH). Keeps
 * controlDate/monthlySeq consistent and bumps that month's counter so future
 * auto-generated numbers can't collide.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { controlNo?: unknown } | null;
  const controlNo = typeof body?.controlNo === "string" ? body.controlNo.trim() : "";
  if (!/^\d{4}-\d{2}-\d{4}$/.test(controlNo)) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Expected control number YYYY-MM-0000." }, { status: 400 });
  }

  const rowControlDate = monthKeyToUTCDateFirstOfMonth(controlNo.slice(0, 7));
  const rowSeq = Number(controlNo.slice(8));

  try {
    await prisma.$transaction(async (tx) => {
      const counter = await tx.controlCounter.upsert({
        where: { controlDate: rowControlDate },
        create: { controlDate: rowControlDate, lastSeq: rowSeq },
        update: {}
      });
      if (counter.lastSeq < rowSeq) {
        await tx.controlCounter.update({ where: { controlDate: rowControlDate }, data: { lastSeq: rowSeq } });
      }
      await tx.bookingRequest.update({
        where: { id },
        data: { controlNo, controlDate: rowControlDate, monthlySeq: rowSeq }
      });
    });
  } catch (error) {
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
    }
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to update control number." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, controlNo });
}
