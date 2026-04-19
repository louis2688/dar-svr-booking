import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";

const BodySchema = z.object({
  token: z.string().min(1).max(2048)
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const token = parsed.data.token.trim();

    const row = await prisma.verificationToken.findUnique({ where: { token } });
    if (!row) {
      return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
    }

    if (row.expires.getTime() < Date.now()) {
      await prisma.verificationToken.deleteMany({ where: { token } });
      return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
    }

    const email = row.identifier.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await prisma.verificationToken.deleteMany({ where: { token } });
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 400 });
    }

    if (user.emailVerified) {
      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      }),
      prisma.verificationToken.deleteMany({ where: { identifier: email } })
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/verify-email]", err);

    const isDev = process.env.NODE_ENV === "development";
    const message = err instanceof Error ? err.message : String(err);

    let hint: string | undefined;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2022" || message.includes("emailVerified"))
    ) {
      hint =
        "Database is out of date: run migrations (e.g. npx prisma migrate deploy) so User.emailVerified exists.";
    } else if (/does not exist|Unknown argument.*emailVerified|column/i.test(message)) {
      hint =
        "Database schema may be missing the emailVerified column. Deploy the latest Prisma migrations and regenerate the client.";
    }

    return NextResponse.json(
      {
        error: "VERIFY_FAILED",
        ...(hint ? { hint } : {}),
        ...(isDev ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}
