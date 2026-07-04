import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveSessionDbUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

/** ~350KB cap on the stored data URL (client resizes to ~256px before upload). */
const MAX_IMAGE_CHARS = 350_000;

const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120).optional(),
  // data:image/...;base64,....  or null to remove the avatar.
  image: z
    .string()
    .max(MAX_IMAGE_CHARS, "Image is too large. Use a smaller photo.")
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Unsupported image format.")
    .nullable()
    .optional()
});

export async function GET() {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: me.status });
  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { id: true, name: true, email: true, image: true, role: true }
  });
  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  const me = await resolveSessionDbUser();
  if (!me.ok) return NextResponse.json({ error: "UNAUTHORIZED", message: me.message }, { status: me.status });

  const body = await req.json().catch(() => null);
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid profile data." },
      { status: 400 }
    );
  }

  const data: { name?: string; image?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.image !== undefined) data.image = parsed.data.image;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES", message: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: me.userId },
    data,
    select: { id: true, name: true, email: true, image: true, role: true }
  });

  return NextResponse.json({ ok: true, user });
}
