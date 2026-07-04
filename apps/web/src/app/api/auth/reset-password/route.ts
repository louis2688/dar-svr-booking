import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { consumeResetToken, emailForResetToken } from "@/server/password-reset";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").max(128)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const email = await emailForResetToken(parsed.data.token);
  if (!email) {
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    await consumeResetToken(parsed.data.token);
    return NextResponse.json({ error: "INVALID_TOKEN", message: "Account not found." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await consumeResetToken(parsed.data.token);

  return NextResponse.json({ ok: true, message: "Password reset. You can sign in with your new password." });
}
