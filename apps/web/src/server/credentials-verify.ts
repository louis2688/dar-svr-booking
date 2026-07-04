import { Role, type User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/server/db";

export type CredentialsCheck =
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unverified"; userId: string; email: string | null }
  | { ok: true; user: Pick<User, "id" | "email" | "name" | "role" | "image"> };

/**
 * Validates password and whether the account may sign in with credentials.
 * ADMIN may sign in even if emailVerified is null (safety valve; seed sets verified).
 */
export async function checkCredentials(emailRaw: string, password: string): Promise<CredentialsCheck> {
  const email = emailRaw.toLowerCase().trim();
  if (!email || !password) return { ok: false, reason: "invalid" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return { ok: false, reason: "invalid" };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { ok: false, reason: "invalid" };

  if (!user.emailVerified && user.role !== Role.ADMIN) {
    return { ok: false, reason: "unverified", userId: user.id, email: user.email };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, image: user.image }
  };
}
