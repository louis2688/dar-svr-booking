"use client";

import { useState } from "react";

const CATEGORIES = ["General", "Bug", "Idea", "Other"] as const;

export default function FeedbackPage() {
  const [category, setCategory] = useState<string>("General");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, rating, message: message.trim() })
    });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(json?.message ?? "Could not send your feedback. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-xl rounded-xl border bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-3 text-lg font-semibold">Thanks for your feedback!</h1>
          <p className="mt-1 text-sm text-zinc-600">It helps us improve the app.</p>
          <button
            type="button"
            className="mt-5 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            onClick={() => {
              setDone(false);
              setMessage("");
              setRating(null);
              setCategory("General");
            }}
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold">Send feedback</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Found a problem, or have an idea? Tell us — it goes straight to the team.
        </p>

        <div className="mt-5 rounded-xl border bg-white p-5">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">How is your experience? (optional)</label>
              <div className="mt-1 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(rating === n ? null : n)}
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-lg",
                      rating && n <= rating
                        ? "border-amber-300 bg-amber-50 text-amber-500"
                        : "border-zinc-200 bg-white text-zinc-300 hover:text-amber-400"
                    ].join(" ")}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                rows={5}
                maxLength={2000}
                placeholder="What went well, what didn't, or what you'd like to see…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="mt-1 text-right text-xs text-zinc-400">{message.length}/2000</div>
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div>
              <button
                type="button"
                disabled={busy || message.trim().length === 0}
                onClick={submit}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
