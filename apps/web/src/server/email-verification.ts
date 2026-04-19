import { randomBytes } from "node:crypto";

import { prisma } from "@/server/db";

const TOKEN_BYTES = 32;
/** Verification links expire after this many hours */
export const VERIFICATION_TOKEN_HOURS = 48;

export function generateVerificationSecret() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function upsertVerificationToken(identifier: string) {
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const token = generateVerificationSecret();
  const expires = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier, token, expires }
  });

  return { token, expires };
}
