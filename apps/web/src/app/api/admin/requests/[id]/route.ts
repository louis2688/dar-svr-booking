import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

/** DELETE /api/admin/requests/:id — permanently delete a booking (admin only).
    Passengers cascade-delete automatically (Passenger.request onDelete: Cascade). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await prisma.bookingRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Request not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Failed to delete request" },
      { status: 500 }
    );
  }
}
