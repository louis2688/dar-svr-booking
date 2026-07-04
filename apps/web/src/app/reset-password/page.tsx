"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (newPw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword: newPw })
    });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(json?.message ?? "Could not reset password.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-sm rounded-xl border bg-white p-6">
        <img src="/branding/svr-logo.png" alt="SVR" width={384} height={256} className="mx-auto mb-5 h-14 w-auto object-contain" />
        <h1 className="text-xl font-semibold">Reset password</h1>

        {!token ? (
          <p className="mt-2 text-sm text-red-600">Missing reset token. Use the link from your reset request.</p>
        ) : done ? (
          <div className="mt-4">
            <p className="text-sm text-emerald-700">Password reset. You can sign in with your new password.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex w-full justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Confirm new password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-zinc-50 px-6 py-12">
          <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center text-sm text-zinc-600">Loading…</div>
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
