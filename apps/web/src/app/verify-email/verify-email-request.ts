export type VerifyEmailResult = {
  ok: boolean;
  status: number;
  body: { error?: string; hint?: string; detail?: string; ok?: boolean } | null;
};

/** One in-flight / completed verification per token (handles React Strict Mode double-mount). */
const flights = new Map<string, Promise<VerifyEmailResult>>();

export function fetchVerifyEmail(token: string): Promise<VerifyEmailResult> {
  let p = flights.get(token);
  if (!p) {
    p = (async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin"
      });
      const body = (await res.json().catch(() => null)) as VerifyEmailResult["body"];
      return { ok: res.ok, status: res.status, body };
    })();
    flights.set(token, p);
  }
  return p;
}
