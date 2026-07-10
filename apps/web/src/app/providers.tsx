"use client";

import { SessionProvider } from "next-auth/react";

export function Providers(props: { children: React.ReactNode }) {
  // ponytail: refetchOnWindowFocus (default true) hits /api/auth/session -> a DB
  // query for the avatar -> re-renders the whole shell every alt-tab back. Session
  // rarely changes mid-session, so skip it; the periodic interval below still
  // catches real changes (e.g. role change) within 5 minutes.
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={5 * 60}>
      {props.children}
    </SessionProvider>
  );
}

