import { Resend } from "resend";

import { getPublicAppUrl, warnIfPublicUrlLikelyWrong } from "@/server/mail-config";

export type SendResult =
  | { sent: true; messageId: string }
  | { sent: false; skippedReason: "no_api_key" | "invalid_from" | "invalid_recipient" | "provider_error"; logHint?: string };

let resendClient: Resend | null = null;

function stripEnvQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function getResend(): Resend | null {
  const keyRaw = process.env.RESEND_API_KEY;
  if (!keyRaw) return null;
  const key = stripEnvQuotes(keyRaw);
  if (!key) return null;
  if (!resendClient) {
    try {
      resendClient = new Resend(key);
    } catch (err) {
      console.error("[svr/booking] Failed to initialize Resend client:", err);
      return null;
    }
  }
  return resendClient;
}

/** Validate https? URL for email href (server-generated only). */
function assertHttpUrlForEmail(href: string): URL {
  const u = new URL(href);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Invalid verification URL protocol");
  }
  return u;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function verificationLinkUrl(token: string): string {
  const base = getPublicAppUrl();
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function normalizeFromHeader(from: string): string | null {
  let s = from.trim();
  // Strip accidental wrapping quotes from .env ("value" or 'value')
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.length === 0) return null;
  return s;
}

function parseRecipient(to: string): string | null {
  const email = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/**
 * Sends transactional verification email via Resend.
 * Does not log full verification URLs in production.
 */
export async function sendVerificationEmail(toRaw: string, verifyUrlRaw: string): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      try {
        assertHttpUrlForEmail(verifyUrlRaw);
      } catch {
        console.warn("[svr/booking] Invalid verification URL (dev)");
      }
      console.warn("[svr/booking] RESEND_API_KEY is not set; skipping send. Verification URL (dev only):", verifyUrlRaw);
    }
    return { sent: false, skippedReason: "no_api_key" };
  }

  warnIfPublicUrlLikelyWrong();

  let verifyUrl: URL;
  try {
    verifyUrl = assertHttpUrlForEmail(verifyUrlRaw);
  } catch {
    console.error("[svr/booking] Refusing to send email: invalid verification URL shape");
    return { sent: false, skippedReason: "provider_error", logHint: "invalid_verify_url" };
  }

  const to = parseRecipient(toRaw);
  if (!to) {
    return { sent: false, skippedReason: "invalid_recipient" };
  }

  const fromRaw = process.env.EMAIL_FROM?.trim() ?? "onboarding@resend.dev";
  const from = normalizeFromHeader(fromRaw);
  if (!from) {
    return { sent: false, skippedReason: "invalid_from" };
  }

  const hrefAttr = escapeHtml(verifyUrl.href);
  const subject = "Verify your SVR Booking account";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#18181b;background:#fafafa;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;">Verify your email</p>
      <p style="margin:0 0 20px;font-size:14px;color:#52525b;">Thanks for signing up for SVR Booking (DAR Marinduque). Confirm your email address to activate your account.</p>
      <p style="margin:0 0 24px;">
        <a href="${hrefAttr}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;">Verify email address</a>
      </p>
      <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;">Or paste this link into your browser:<br/>${hrefAttr}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">If you did not create an account, you can ignore this message.</p>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    "Verify your SVR Booking account",
    "",
    "Open this link to verify your email:",
    verifyUrl.href,
    "",
    "If you did not create an account, ignore this email."
  ].join("\n");

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
      tags: [{ name: "category", value: "verification" }]
    });

    if (error) {
      const hint = typeof error.message === "string" ? error.message : JSON.stringify(error);
      console.error("[svr/booking] Resend API error:", hint);
      return {
        sent: false,
        skippedReason: "provider_error",
        logHint: hint.slice(0, 500)
      };
    }

    const messageId = data?.id;
    if (!messageId) {
      console.error("[svr/booking] Resend returned no message id");
      return { sent: false, skippedReason: "provider_error", logHint: "no_message_id" };
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[svr/booking] Verification email queued:", { to, messageId });
    } else {
      console.info("[svr/booking] Verification email sent:", { toDomain: to.split("@")[1], messageId });
    }

    return { sent: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[svr/booking] Resend send exception:", msg);
    return { sent: false, skippedReason: "provider_error", logHint: msg.slice(0, 500) };
  }
}
