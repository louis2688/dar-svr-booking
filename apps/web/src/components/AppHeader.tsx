"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

function DarMark(props: { className?: string }) {
  return (
    <img
      src="/branding/dar.svg"
      alt=""
      width={36}
      height={36}
      className={props.className ?? "h-9 w-9 shrink-0 object-contain"}
      decoding="async"
      aria-hidden
    />
  );
}

function NavLink(props: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === props.href || pathname?.startsWith(`${props.href}/`);
  return (
    <Link
      className={[
        "shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-bold text-black sm:px-3",
        active ? "text-emerald-700" : "hover:text-zinc-600"
      ].join(" ")}
      href={props.href}
    >
      {props.label}
    </Link>
  );
}

export function AppHeader() {
  const router = useRouter();
  const { data } = useSession();
  const role = (data as any)?.role as string | undefined;
  const email = data?.user?.email ?? null;
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const base: { href: string; label: string }[] = [];
    if (email) {
      base.push({ href: "/request", label: "Request" });
    }
    if (role === "ADMIN") {
      base.push({ href: "/admin", label: "Admin" });
      base.push({ href: "/admin/vehicles", label: "Vehicles" });
    }
    return base;
  }, [role, email]);

  async function onLogout() {
    setOpen(false);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex shrink-0 rounded-lg p-1 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label="SVR Booking home"
          >
            <DarMark />
          </Link>
          {items.length > 0 ? (
            <nav
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-none sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
              aria-label="Main"
            >
              {items.map((it) => (
                <NavLink key={it.href} href={it.href} label={it.label} />
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {email ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex items-center justify-center rounded-lg bg-transparent p-2 text-black hover:bg-zinc-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                onClick={() => setOpen((v) => !v)}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth={3}
                    d="M5 7h14M5 12h14M5 17h14"
                  />
                </svg>
              </button>
              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white p-2 shadow-sm">
                  <div className="px-2 py-2 text-xs text-zinc-500">
                    Signed in as <span className="font-medium text-zinc-900">{email}</span>
                    {role ? <span className="ml-1">({role})</span> : null}
                  </div>
                  <div className="h-px bg-zinc-100" />
                  <button
                    type="button"
                    className="block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                    onClick={onLogout}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              className="rounded-lg border border-black bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-50"
              href="/login"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

