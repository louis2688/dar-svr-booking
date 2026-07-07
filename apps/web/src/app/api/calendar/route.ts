import { NextResponse } from "next/server";

import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1))
  };
}

/**
 * GET /api/calendar?month=YYYY-MM[&vehicleId=...] — approved bookings for the
 * month, grouped by day, with vehicle labels. Omit vehicleId for all vehicles.
 * Read-only; any signed-in user may view.
 */
export async function GET(req: Request) {
  const sess = await requireUser();
  if (!sess.ok) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? "";
  const vehicleId = url.searchParams.get("vehicleId") || undefined;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Expected month=YYYY-MM." }, { status: 400 });
  }

  const { start, end } = monthRange(month);
  const rows = await prisma.bookingRequest.findMany({
    where: {
      status: "APPROVED",
      date: { gte: start, lt: end },
      ...(vehicleId ? { vehicleId } : {})
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      date: true,
      startTime: true,
      controlNo: true,
      vehicle: { select: { name: true, plateNo: true } }
    }
  });

  const byDay = new Map<string, { startTime: string; controlNo: string; vehicleName: string; plateNo: string | null }[]>();
  for (const r of rows) {
    const d = r.date.toISOString().slice(0, 10);
    const list = byDay.get(d) ?? [];
    list.push({
      startTime: r.startTime,
      controlNo: r.controlNo,
      vehicleName: r.vehicle?.name ?? "—",
      plateNo: r.vehicle?.plateNo ?? null
    });
    byDay.set(d, list);
  }

  return NextResponse.json({
    month,
    days: Array.from(byDay.entries()).map(([date, bookings]) => ({ date, bookings }))
  });
}
