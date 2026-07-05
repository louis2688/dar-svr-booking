import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

/**
 * POST /api/requests/:id/requestor — admin-only inline edit of the requestor
 * name from the print view. Deliberately narrow (name only) so it skips the
 * full CreateRequestSchema/lead-time checks that the general PATCH runs.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { requestorName?: unknown } | null;
  const name = typeof body?.requestorName === "string" ? body.requestorName.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Requestor name required (max 120)." }, { status: 400 });
  }

  try {
    await prisma.bookingRequest.update({ where: { id }, data: { requestorName: name } });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND", message: "Request not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, requestorName: name });
}
