import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendVerificationEmail, verificationLinkUrl } from "@/server/mail";
import { upsertVerificationToken } from "@/server/email-verification";
import { prisma } from "@/server/db";

const BodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128)
});

export const runtime = "nodejs";

/**
 * Resend verification email. Requires correct password so the endpoint cannot be used to probe accounts.
 */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: true });
  }

  if (user.emailVerified || user.role !== Role.USER) {
    return NextResponse.json({ ok: true });
  }

  const { token } = await upsertVerificationToken(email);
  const verifyUrl = verificationLinkUrl(token);
  await sendVerificationEmail(email, verifyUrl);

  return NextResponse.json({ ok: true });
}
