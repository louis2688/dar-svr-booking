import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128)
});

export async function POST(req: Request) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const body = await req.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { passwordHash: true }
  });
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "NO_PASSWORD", message: "This account has no password set." },
      { status: 400 }
    );
  }

  const currentOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentOk) {
    return NextResponse.json(
      { error: "WRONG_PASSWORD", message: "Current password is incorrect." },
      { status: 403 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: me.userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true, message: "Password updated." });
}
