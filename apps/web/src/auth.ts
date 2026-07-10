import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
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
  // Use our own login page instead of NextAuth's unstyled default (which is what
  // shows when a provider like Google is clicked before it's configured).
  pages: { signIn: "/login" },
  jwt: {
    maxAge: MAX_SESSION_SECONDS
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
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
        // Deliberately omit `image` here: NextAuth would copy it into token.picture
        // (a cookie), and a data-URL avatar overflows request headers (HTTP 431).
        // The avatar is loaded from the DB in the session callback instead.
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
    async jwt({ token, user, trigger, session }) {
      // Never let an avatar ride in the JWT cookie (HTTP 431). Strip it on every pass,
      // which also shrinks any previously-issued oversized token on its next request.
      if ("picture" in token) delete (token as { picture?: unknown }).picture;
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.name = user.name ?? null;
        const remember = Boolean(user.remember);
        token.remember = remember;
        const ttl = remember ? MAX_SESSION_SECONDS : BRIEF_SESSION_SECONDS;
        token.exp = Math.floor(Date.now() / 1000) + ttl;
      }
      // Live refresh of name after a profile save via useSession().update({ name }).
      // NOTE: never store the avatar image here — the JWT rides in a cookie and a
      // data-URL avatar (~30KB) overflows request headers (HTTP 431). Avatar is read
      // from the DB in the session callback below instead.
      if (trigger === "update" && session && typeof (session as { name?: unknown }).name === "string") {
        token.name = (session as { name: string }).name;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      session.role = token.role;
      if (session.user) {
        session.user.name = (token.name as string | null) ?? undefined;
        // Avatar is read fresh from the DB so it never rides in the session cookie.
        if (token.userId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId },
            select: { image: true }
          });
          session.user.image = dbUser?.image ?? undefined;
        }
      }
      return session;
    }
  }
};

export default NextAuth(authOptions);
