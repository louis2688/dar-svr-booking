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
          role: user.role,
          remember
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        const remember = Boolean(user.remember);
        token.remember = remember;
        const ttl = remember ? MAX_SESSION_SECONDS : BRIEF_SESSION_SECONDS;
        token.exp = Math.floor(Date.now() / 1000) + ttl;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      session.role = token.role;
      return session;
    }
  }
};

export default NextAuth(authOptions);
