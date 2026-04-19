import { NextResponse } from "next/server";

import { requireAdmin, requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

export async function GET(req: Request) {
  const sessionRes = await requireUser();
  if (!sessionRes.ok) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const adminRes = await requireAdmin();
  const includeInactive =
    adminRes.ok && (url.searchParams.get("includeInactive") === "1" || url.searchParams.get("all") === "1");

  const items = await prisma.vehicle.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const plateNo = typeof body?.plateNo === "string" ? body.plateNo.trim() : undefined;
  if (!name) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const created = await prisma.vehicle.create({ data: { name, plateNo, active: true } });
  return NextResponse.json(created, { status: 201 });
}

