/**
 * Runs once when the Next.js server starts (Node runtime).
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  if (
    process.env.RESEND_API_KEY?.trim() &&
    !process.env.NEXTAUTH_URL?.trim() &&
    !process.env.AUTH_URL?.trim()
  ) {
    console.warn(
      "[svr/booking] Production: RESEND_API_KEY is set but NEXTAUTH_URL / AUTH_URL is missing. Verification links fall back to VERCEL_URL or localhost."
    );
  }
}
