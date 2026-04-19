import { NextResponse } from "next/server";

import { requireUser, resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

export async function GET() {
  const sessionRes = await requireUser();
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const resolvedUser = await resolveSessionDbUser();
  if (!resolvedUser.ok) {
    return NextResponse.json({ error: "SESSION_STALE", message: resolvedUser.message }, { status: resolvedUser.status });
  }

  const rows = await prisma.bookingRequest.findMany({
    where: { requestedById: resolvedUser.userId },
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, passengers: true }
  });

  return NextResponse.json({ items: rows });
}
