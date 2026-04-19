/**
 * Public base URL for links in outbound email (verification, etc.).
 * Prefer NEXTAUTH_URL in production so links match your deployment host.
 */
export function getPublicAppUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/** Log once per process if production might generate wrong links */
let warnedMissingPublicUrl = false;
export function warnIfPublicUrlLikelyWrong(): void {
  if (process.env.NODE_ENV !== "production" || warnedMissingPublicUrl) return;
  if (process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim()) return;
  warnedMissingPublicUrl = true;
  console.warn(
    "[svr/booking] Set NEXTAUTH_URL (or AUTH_URL) to your public site URL so verification emails use correct links."
  );
}
