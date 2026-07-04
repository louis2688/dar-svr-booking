import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveSessionDbUser } from "@/server/authz";
import { upsertVerificationToken } from "@/server/email-verification";
import { sendVerificationEmail, verificationLinkUrl } from "@/server/mail";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const Schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(req: Request) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Enter a valid email." }, { status: 400 });
  }

  const newEmail = parsed.data.email.toLowerCase();

  const current = await prisma.user.findUnique({ where: { id: me.userId }, select: { email: true } });
  if (current?.email === newEmail) {
    return NextResponse.json({ error: "NO_CHANGE", message: "That is already your email." }, { status: 400 });
  }

  const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (taken && taken.id !== me.userId) {
    return NextResponse.json({ error: "EMAIL_IN_USE", message: "That email is already used by another account." }, { status: 409 });
  }

  try {
    // New email must be re-verified before it can be used to sign in (USER accounts).
    await prisma.user.update({
      where: { id: me.userId },
      data: { email: newEmail, emailVerified: null }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_IN_USE", message: "That email is already used by another account." }, { status: 409 });
    }
    throw err;
  }

  const { token } = await upsertVerificationToken(newEmail);
  const verifyUrl = verificationLinkUrl(token);
  const mail = await sendVerificationEmail(newEmail, verifyUrl);

  const exposeLink =
    !mail.sent && (process.env.NODE_ENV === "development" || process.env.EMAIL_VERIFICATION_LINK_IN_UI === "1");

  return NextResponse.json({
    ok: true,
    email: newEmail,
    emailSent: mail.sent,
    message: "Email updated. Verify the new address to keep signing in with it.",
    ...(exposeLink ? { fallbackVerificationUrl: verifyUrl } : {})
  });
}
