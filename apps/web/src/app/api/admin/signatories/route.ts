import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const MAX_SIG_CHARS = 500_000; // signature images are wider; allow a bit more than avatars

const PatchSchema = z.object({
  role: z.enum(["APPROVER", "NOTED_BY"]),
  name: z.string().trim().min(1).max(160).optional(),
  position: z.string().trim().min(1).max(160).optional(),
  signature: z
    .string()
    .max(MAX_SIG_CHARS, "Signature image is too large.")
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Unsupported image format.")
    .nullable()
    .optional()
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const items = await prisma.signatory.findMany({ orderBy: { role: "asc" } });
  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 }
    );
  }

  const { role, ...rest } = parsed.data;
  const data: { name?: string; position?: string; signature?: string | null } = {};
  if (rest.name !== undefined) data.name = rest.name;
  if (rest.position !== undefined) data.position = rest.position;
  if (rest.signature !== undefined) data.signature = rest.signature;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES", message: "Nothing to update." }, { status: 400 });
  }

  const item = await prisma.signatory.update({ where: { role }, data });
  return NextResponse.json({ ok: true, item });
}
