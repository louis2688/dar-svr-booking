import { Suspense } from "react";

import { VerifyEmailClient } from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-12 text-zinc-900">
      <Suspense
        fallback={
          <div className="mx-auto max-w-sm rounded-xl border bg-white p-6 text-center text-sm text-zinc-600">
            Loading…
          </div>
        }
      >
        <VerifyEmailClient />
      </Suspense>
    </div>
  );
}
