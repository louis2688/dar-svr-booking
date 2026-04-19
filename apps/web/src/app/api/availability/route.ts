import { NextResponse } from "next/server";
import { AvailabilityQuerySchema } from "@svr/shared";

import { prisma } from "@/server/db";

function monthRange(month: string) {
  const [y, m] = month.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = AvailabilityQuerySchema.safeParse({
    vehicleId: url.searchParams.get("vehicleId"),
    month: url.searchParams.get("month")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { vehicleId, month } = parsed.data;
  const { start, end } = monthRange(month);

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      vehicleId,
      status: "APPROVED",
      date: { gte: start, lt: end }
    },
    select: { date: true, startTime: true }
  });

  const byDay = new Map<string, { date: string; bookedTimes: string[] }>();
  for (const b of bookings) {
    const d = b.date.toISOString().slice(0, 10); // YYYY-MM-DD
    const cur = byDay.get(d) ?? { date: d, bookedTimes: [] as string[] };
    if (!cur.bookedTimes.includes(b.startTime)) {
      cur.bookedTimes.push(b.startTime);
    }
    byDay.set(d, cur);
  }

  return NextResponse.json({
    vehicleId,
    month,
    days: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
  });
}

