"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Mode = "signin" | "signup";

const REMEMBER_EMAIL_KEY = "svr-booking-remember-email";

type SignupDone = {
  emailSent: boolean;
  /** Present when email was not sent but server exposes a one-time verify URL (dev / explicit env). */
  fallbackVerificationUrl?: string;
};

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedBanner = searchParams.get("verified") === "1";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState<SignupDone | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  /** Longer session + prefilled email next visit (password is never stored). */
  const [rememberMe, setRememberMe] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const signupParam = searchParams.get("signup");
  const modeParam = searchParams.get("mode");
  useEffect(() => {
    if (signupParam === "1" || modeParam === "signup") {
      setMode("signup");
    }
  }, [signupParam, modeParam]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function setModeAndClearError(next: Mode) {
    setMode(next);
    setError(null);
    setResendNote(null);
    setShowResend(false);
    if (next === "signin") {
      setConfirmPassword("");
    }
  }

  async function onResendVerification() {
    setError(null);
    setResendNote(null);
    const nextEmail = (emailRef.current?.value ?? email).toLowerCase().trim();
    const nextPassword = passwordRef.current?.value ?? password;
    if (!nextEmail || !nextPassword) {
      setError("Enter your email and password to resend the verification link.");
      return;
    }

    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: nextEmail, password: nextPassword })
    });

    setResendNote(
      "If your email and password are correct and your account is still unverified, a new message has been sent when email delivery is configured."
    );
  }

  async function onSubmit() {
    setError(null);
    setResendNote(null);
    setShowResend(false);
    setLoading(true);

    const nextEmail = (emailRef.current?.value ?? email).toLowerCase().trim();
    const nextPassword = passwordRef.current?.value ?? password;
    if (!nextEmail || !nextPassword) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      if (nextPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      if (nextPassword !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }

      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword })
      });

      const regBody = (await regRes.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        hint?: string;
        detail?: string;
        needsVerification?: boolean;
        emailSent?: boolean;
        fallbackVerificationUrl?: string;
      };

      if (regRes.status === 409) {
        setError(
          (typeof regBody.message === "string" && regBody.message.trim()) ||
            "An account with this email already exists."
        );
        setLoading(false);
        return;
      }

      if (!regRes.ok) {
        const line =
          (typeof regBody.message === "string" && regBody.message.trim()) ||
          (typeof regBody.hint === "string" && regBody.hint.trim()) ||
          "Could not create account. Please try again.";
        const tail = regBody.detail ? ` (${regBody.detail})` : "";
        setError(`${line}${tail}`);
        setLoading(false);
        return;
      }

      const regJson = regBody;
      if (regJson.needsVerification) {
        setSignupDone({
          emailSent: Boolean(regJson.emailSent),
          ...(typeof regJson.fallbackVerificationUrl === "string"
            ? { fallbackVerificationUrl: regJson.fallbackVerificationUrl }
            : {})
        });
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }
    }

    const res = await signIn("credentials", {
      email: nextEmail,
      password: nextPassword,
      remember: rememberMe ? "true" : "false",
      redirect: false
    });

    if (res?.error) {
      if (res.error === "UNVERIFIED_EMAIL") {
        setShowResend(true);
        setError(
          "Verify your email before signing in. Check your inbox for the link, or use “Resend verification email” below."
        );
        setLoading(false);
        return;
      }

      const hintRes = await fetch("/api/auth/check-unverified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword })
      });
      const hintJson = (await hintRes.json().catch(() => ({}))) as { unverified?: boolean };

      if (hintJson.unverified) {
        setShowResend(true);
        setError(
          "Verify your email before signing in. Check your inbox for the link, or use “Resend verification email” below."
        );
      } else {
        setShowResend(false);
        setError(
          "Invalid email or password. If the database was recently reset, create your account again or ask an admin to run the seed (ADMIN_EMAIL / ADMIN_PASSWORD)."
        );
      }
      setLoading(false);
      return;
    }

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, nextEmail);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }

    router.push("/");
    setLoading(false);
  }

  const title = mode === "signin" ? "Sign in" : "Create account";
  const subtitle =
    mode === "signin"
      ? "Use your assigned account."
      : "Register as a standard user to submit and track requests.";
  const primaryLabel = loading
    ? mode === "signin"
      ? "Signing in..."
      : "Creating account..."
    : mode === "signin"
      ? "Sign in"
      : "Sign up";

  if (signupDone) {
    return (
      <div className="min-h-dvh bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-sm rounded-xl border bg-white p-6">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {signupDone.emailSent
              ? "We sent a verification link to your address. Open it to activate your account, then sign in here."
              : signupDone.fallbackVerificationUrl
                ? "Email delivery is not configured on this server, so nothing was sent to your inbox. Use the verification button below to finish setup."
                : "Your account was created, but this server could not send email. Configure outbound mail (see below) or ask an administrator."}
          </p>
          {!signupDone.emailSent && !signupDone.fallbackVerificationUrl ? (
            <p className="mt-3 text-xs text-amber-800">
              Automatic email is not configured on this server (missing <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code>). Ask your
              administrator to add Resend credentials, or check server logs for the verification URL.
            </p>
          ) : null}
          {!signupDone.emailSent && signupDone.fallbackVerificationUrl ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm">
              <p className="font-medium text-emerald-900">Verify without email (this screen only)</p>
              <p className="mt-1 text-xs text-emerald-800">
                For production inboxes, set <code className="rounded bg-emerald-100 px-1">RESEND_API_KEY</code> and{" "}
                <code className="rounded bg-emerald-100 px-1">EMAIL_FROM</code> in environment variables.
              </p>
              <Link
                href={signupDone.fallbackVerificationUrl}
                className="mt-3 inline-flex w-full justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Open verification link
              </Link>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={() => {
                setSignupDone(null);
                setMode("signin");
                setError(null);
              }}
            >
              Go to sign in
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              onClick={onResendVerification}
            >
              Resend verification email
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Resend uses your password on file—enter it in the field below if you cleared it, then click again.
          </p>
          <div className="mt-4 space-y-2 border-t pt-4">
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ref={emailRef}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <label className="mt-2 block text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
              autoComplete="current-password"
            />
          </div>
          {resendNote ? <p className="mt-3 text-xs text-zinc-600">{resendNote}</p> : null}
          <p className="mt-6 text-center text-sm text-zinc-600">
            Wrong place?{" "}
            <Link className="font-medium text-zinc-900 underline" href="/">
              Home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-6">
        <img
          src="/branding/svr-logo.png"
          alt="SVR Booking"
          width={384}
          height={256}
          className="mx-auto mb-5 h-16 w-auto object-contain"
        />
        {verifiedBanner ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Email verified. You can sign in below.
          </div>
        ) : null}

        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm font-medium">
          <button
            type="button"
            className={[
              "flex-1 rounded-md py-2 transition",
              mode === "signin" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            ].join(" ")}
            onClick={() => setModeAndClearError("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={[
              "flex-1 rounded-md py-2 transition",
              mode === "signup" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            ].join(" ")}
            onClick={() => setModeAndClearError("signup")}
          >
            Sign up
          </button>
        </div>

        <h1 className="mt-6 text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>

        <div className="mt-6 space-y-3">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ref={emailRef}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" ? (
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
            ) : null}
          </div>

          {mode === "signup" ? (
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          ) : null}

          {mode === "signin" ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="mt-1 rounded border-zinc-300"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>
                <span className="font-medium text-zinc-900">Remember me on this device</span>
                <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                  Stays signed in longer and saves your email here only—never your password.
                </span>
              </span>
            </label>
          ) : null}

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {mode === "signin" && showResend ? (
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={onResendVerification}
            >
              Resend verification email
            </button>
          ) : null}

          {resendNote && !signupDone ? <p className="text-xs text-zinc-600">{resendNote}</p> : null}

          <button
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            type="button"
            disabled={loading}
            onClick={onSubmit}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-zinc-50 px-6 py-12">
          <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center text-sm text-zinc-600">Loading…</div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
