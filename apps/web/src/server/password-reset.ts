import { randomBytes } from "node:crypto";

import { prisma } from "@/server/db";

const TOKEN_BYTES = 32;
export const RESET_TOKEN_HOURS = 2;
/** Prefix keeps reset tokens from clobbering email-verification tokens (same table). */
const RESET_PREFIX = "pwreset:";

export function resetIdentifier(email: string) {
  return `${RESET_PREFIX}${email.toLowerCase().trim()}`;
}

/** Issue a fresh single-use reset token for an email; invalidates any prior reset token. */
export async function createPasswordResetToken(email: string) {
  const identifier = resetIdentifier(email);
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expires = new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000);
  await prisma.verificationToken.create({ data: { identifier, token, expires } });
  return { token, expires };
}

/** Returns the email a valid, unexpired reset token belongs to (else null). Consumes nothing. */
export async function emailForResetToken(token: string): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;
  if (!row.identifier.startsWith(RESET_PREFIX)) return null;
  if (row.expires.getTime() < Date.now()) return null;
  return row.identifier.slice(RESET_PREFIX.length);
}

export async function consumeResetToken(token: string) {
  await prisma.verificationToken.deleteMany({ where: { token } });
}
