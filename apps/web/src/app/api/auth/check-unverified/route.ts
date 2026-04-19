import { NextResponse } from "next/server";
import { z } from "zod";

import { checkCredentials } from "@/server/credentials-verify";

const BodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128)
});

/**
 * After a failed credentials sign-in, clarifies whether the password was correct but email is still unverified.
 */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ unverified: false }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  const result = await checkCredentials(email, password);
  if (result.ok) {
    return NextResponse.json({ unverified: false });
  }
  if (result.reason === "unverified") {
    return NextResponse.json({ unverified: true });
  }
  return NextResponse.json({ unverified: false });
}
