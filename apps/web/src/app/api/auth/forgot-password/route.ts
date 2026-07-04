import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicAppUrl } from "@/server/mail-config";
import { createPasswordResetToken } from "@/server/password-reset";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const Schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Generic message either way — don't reveal whether the email exists.
  const generic = {
    ok: true,
    message: "If that email has an account, a password reset link has been prepared."
  };

  if (!user) {
    return NextResponse.json(generic);
  }

  const { token } = await createPasswordResetToken(email);
  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  // Email delivery is not reliably configured here (shared Resend sender), so expose the
  // link in the UI when the same fallback flag used for verification is enabled.
  const exposeLink = process.env.NODE_ENV === "development" || process.env.EMAIL_VERIFICATION_LINK_IN_UI === "1";

  return NextResponse.json({
    ...generic,
    ...(exposeLink ? { resetUrl } : {})
  });
}
