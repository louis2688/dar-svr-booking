"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchVerifyEmail } from "./verify-email-request";

function mapVerifyError(data: {
  error?: string;
  hint?: string;
  detail?: string;
} | null): string {
  const code = data?.error;
  if (code === "INVALID_OR_EXPIRED_TOKEN") {
    return "This link is invalid or has expired (or was already used). Sign in with your password and use “Resend verification email”, or sign up again.";
  }
  if (code === "USER_NOT_FOUND") {
    return "No account matches this verification link. Sign up again or contact support.";
  }
  if (code === "INVALID_INPUT") {
    return "The verification link looks broken. Copy the full URL from your email or request a new email.";
  }
  if (code === "VERIFY_FAILED" || data?.hint) {
    const parts = ["Verification could not be completed."];
    if (data?.hint) parts.push(data.hint);
    if (data?.detail) parts.push(`(${data.detail})`);
    return parts.join(" ");
  }
  return "Verification failed. Try again or request a new email.";
}

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [phase, setPhase] = useState<"loading" | "error">(() => (token ? "loading" : "error"));
  const [errorMsg, setErrorMsg] = useState(() => (token ? "" : "Missing verification link."));

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    void (async () => {
      const result = await fetchVerifyEmail(token);

      if (cancelled) return;

      if (result.ok) {
        router.replace("/login?verified=1");
        return;
      }

      setPhase("error");
      setErrorMsg(mapVerifyError(result.body));
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center">
        <p className="text-sm text-red-700">{errorMsg}</p>
        <Link
          className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center text-sm text-zinc-600">
        Verifying your email…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center">
      <p className="text-sm text-red-700">{errorMsg}</p>
      <Link
        className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        href="/login"
      >
        Back to sign in
      </Link>
    </div>
  );
}
