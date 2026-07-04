"use client";

import { useEffect, useState } from "react";

const MIN_VISIBLE_MS = 850;

/**
 * Full-screen DAR logo pulse while the app finishes loading — only below `md`
 * (Tailwind breakpoint). Hidden on tablet/desktop via `md:hidden`.
 */
export function MobileOpeningSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const started = Date.now();

    function scheduleHide() {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => setVisible(false), wait);
    }

    if (document.readyState === "complete") {
      scheduleHide();
    } else {
      window.addEventListener("load", scheduleHide, { once: true });
    }
  }, []);

  return (
    <div
      aria-hidden="true"
      className={[
        "mobile-opening-splash md:hidden",
        "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-zinc-50 transition-opacity duration-500 ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      ].join(" ")}
    >
      <img
        src="/branding/svr-logo.png"
        alt=""
        width={180}
        height={120}
        className="dar-opening-logo h-[120px] w-auto max-w-[60vw] object-contain"
        decoding="async"
      />
      <p className="sr-only">Loading</p>
      <div className="flex gap-1.5" aria-hidden>
        <span className="dar-dot h-2 w-2 rounded-full bg-zinc-400" />
        <span className="dar-dot h-2 w-2 rounded-full bg-zinc-400" />
        <span className="dar-dot h-2 w-2 rounded-full bg-zinc-400" />
      </div>
    </div>
  );
}
