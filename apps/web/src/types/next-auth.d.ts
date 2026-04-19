import "next-auth";
import "next-auth/jwt";

type AppRole = "ADMIN" | "USER";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    /** Set only at credentials sign-in to tune session length (not exposed on Session). */
    remember?: boolean;
  }

  interface Session {
    userId?: string;
    role?: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: AppRole;
    remember?: boolean;
  }
}
