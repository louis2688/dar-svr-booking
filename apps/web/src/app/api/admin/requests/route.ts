import { NextResponse } from "next/server";
import { BookingStatusSchema } from "@svr/shared";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

export async function GET(req: Request) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusResult = BookingStatusSchema.safeParse(url.searchParams.get("status") ?? "PENDING");
  const vehicleId = url.searchParams.get("vehicleId");

  if (!statusResult.success) {
    return NextResponse.json({ error: "BAD_REQUEST", issues: statusResult.error.issues }, { status: 400 });
  }

  const items = await prisma.bookingRequest.findMany({
    where: {
      status: statusResult.data,
      ...(vehicleId ? { vehicleId } : {})
    },
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, passengers: true, requestedBy: true }
  });

  return NextResponse.json({ items });
}
