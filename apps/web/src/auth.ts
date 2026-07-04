import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { checkCredentials } from "@/server/credentials-verify";
import { prisma } from "@/server/db";

/** Longest session cookie / JWT rolling window (must cover “remember me”). */
const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60;
/** Short browser session when “Remember me” is unchecked. */
const BRIEF_SESSION_SECONDS = 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: MAX_SESSION_SECONDS
  },
  jwt: {
    maxAge: MAX_SESSION_SECONDS
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const rememberRaw = String(credentials?.remember ?? "").toLowerCase();
        const remember = rememberRaw === "true" || rememberRaw === "1" || rememberRaw === "on";
        const result = await checkCredentials(email, password);
        if (!result.ok) {
          if (result.reason === "unverified") {
            throw new Error("UNVERIFIED_EMAIL");
          }
          return null;
        }

        const user = result.user;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role,
          remember
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.name = user.name ?? null;
        token.picture = user.image ?? null;
        const remember = Boolean(user.remember);
        token.remember = remember;
        const ttl = remember ? MAX_SESSION_SECONDS : BRIEF_SESSION_SECONDS;
        token.exp = Math.floor(Date.now() / 1000) + ttl;
      }
      // Live refresh after a profile save via useSession().update({ name, image }).
      if (trigger === "update" && session) {
        if (typeof (session as { name?: unknown }).name === "string") {
          token.name = (session as { name: string }).name;
        }
        if ("image" in (session as object)) {
          token.picture = (session as { image?: string | null }).image ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      session.role = token.role;
      if (session.user) {
        session.user.name = (token.name as string | null) ?? undefined;
        session.user.image = (token.picture as string | null) ?? undefined;
      }
      return session;
    }
  }
};

export default NextAuth(authOptions);
