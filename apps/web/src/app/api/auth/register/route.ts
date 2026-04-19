import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { upsertVerificationToken } from "@/server/email-verification";
import { sendVerificationEmail, verificationLinkUrl } from "@/server/mail";
import { prisma } from "@/server/db";

const RegisterBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128)
});

/** Prisma + bcrypt + Resend require Node (not Edge). */
export const runtime = "nodejs";

/** Same convention as `prisma/seed.cjs`: matches `ADMIN_EMAIL` → ADMIN + verified (no inbox step). */
function matchesEnvAdminEmail(email: string): boolean {
  const configured = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  return Boolean(configured && email === configured);
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = RegisterBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const asAdminEmail = matchesEnvAdminEmail(email);

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.emailVerified) {
    return NextResponse.json(
      {
        error: "EMAIL_IN_USE",
        message:
          "This email is already registered. Use the “Sign in” tab (not “Sign up”) with the same password. " +
          (asAdminEmail
            ? "To set the admin role, from `apps/web` run `npm run db:seed` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (email and password must match this account), or set `User.role` to `ADMIN` in your database for this email."
            : "If you forgot your password, an admin must reset it in the database for now.")
      },
      { status: 409 }
    );
  }

  try {
    if (existing && existing.role === Role.USER && !existing.emailVerified) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          ...(asAdminEmail ? { role: Role.ADMIN, emailVerified: new Date() } : {})
        }
      });
    } else if (!existing) {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: asAdminEmail ? Role.ADMIN : Role.USER,
          ...(asAdminEmail ? { emailVerified: new Date() } : {})
        }
      });
    } else {
      return NextResponse.json(
        {
          error: "EMAIL_IN_USE",
          message:
            "This email is already in use with a different account state. Try “Sign in”, or contact support."
        },
        { status: 409 }
      );
    }

    if (asAdminEmail) {
      return NextResponse.json({
        ok: true,
        needsVerification: false,
        emailSent: false,
        message: "Admin account created. You can sign in now."
      });
    }

    const { token } = await upsertVerificationToken(email);
    const verifyUrl = verificationLinkUrl(token);
    const mailResult = await sendVerificationEmail(email, verifyUrl);

    const exposeFallbackLink =
      !mailResult.sent &&
      (process.env.NODE_ENV === "development" ||
        process.env.EMAIL_VERIFICATION_LINK_IN_UI === "1");

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      emailSent: mailResult.sent,
      ...(exposeFallbackLink ? { fallbackVerificationUrl: verifyUrl } : {})
    });
  } catch (err) {
    console.error("[api/auth/register]", err);

    const isDev = process.env.NODE_ENV === "development";
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const rawTarget = err.meta?.target as string | string[] | undefined;
      const targets = Array.isArray(rawTarget) ? rawTarget : rawTarget ? [rawTarget] : [];
      if (targets.includes("email")) {
        return NextResponse.json(
          {
            error: "EMAIL_IN_USE",
            message: "An account with this email already exists. Try signing in instead."
          },
          { status: 409 }
        );
      }
    }

    let hint: string | undefined;
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2022" || message.includes("emailVerified")) {
        hint =
          "Database is out of date: run migrations (e.g. npx prisma migrate deploy) so the schema matches this app version.";
      }
    } else if (/P1001|Can't reach database server|EHOSTUNREACH|ECONNREFUSED/i.test(message)) {
      hint = "Cannot reach the database. Check DATABASE_URL and that PostgreSQL accepts connections.";
    } else if (/does not exist|Unknown column|Unknown argument.*emailVerified|column.*emailVerified/i.test(message)) {
      hint =
        "Database schema does not match this deployment. Apply Prisma migrations and run prisma generate.";
    }

    const userMessage =
      hint ??
      "Something went wrong while creating your account. Please try again in a moment. If it keeps failing, contact support.";

    return NextResponse.json(
      {
        error: "CREATE_FAILED",
        message: userMessage,
        ...(hint ? { hint } : {}),
        ...(isDev ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}
