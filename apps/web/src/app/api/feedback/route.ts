import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/server/db";

const CATEGORIES = ["General", "Bug", "Idea", "Other"];

/** POST /api/feedback — any signed-in user submits feedback. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { message?: unknown; rating?: unknown; category?: unknown }
    | null;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Please write a message (max 2000 characters)." }, { status: 400 });
  }
  const rating =
    typeof body?.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null;
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : null;

  await prisma.feedback.create({
    data: { message, rating, category, userId: session.userId, userEmail: session.user?.email ?? null }
  });
  return NextResponse.json({ ok: true });
}
