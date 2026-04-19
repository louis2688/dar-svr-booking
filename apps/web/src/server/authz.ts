import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/server/db";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false as const, session: null };
  }
  return { ok: true as const, session };
}

/**
 * Use for foreign keys to `User.id` and permission checks. JWT `session.userId` / `session.role`
 * can be stale after DB resets while the cookie still validates — DB lookup by email matches
 * the current user row after re-login.
 */
export async function resolveSessionDbUser(): Promise<
  | { ok: true; userId: string; role: Role }
  | { ok: false; status: 401; message: string }
> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true }
  });

  if (!user) {
    return {
      ok: false,
      status: 401,
      message: "Your session does not match an account in this database. Sign out, then sign in again."
    };
  }

  return { ok: true, userId: user.id, role: user.role };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.role !== "ADMIN") {
    return { ok: false as const, session: null };
  }
  return { ok: true as const, session };
}
