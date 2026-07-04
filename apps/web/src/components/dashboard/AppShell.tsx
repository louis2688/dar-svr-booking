"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const COLLAPSE_KEY = "svr-sidebar-collapsed";

function Icon(props: { d: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" d={props.d} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  request: "M12 5v14M5 12h14",
  approvals: "M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 13l2 2 4-4",
  vehicles: "M5 16l1.5-6A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 2l1.5 6M5 16h14M5 16a1.5 1.5 0 1 0 2 1.5M19 16a1.5 1.5 0 1 1-2 1.5M9 11h6",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0"
} as const;

/** Routes that render bare (no dashboard chrome). */
function isBareRoute(pathname: string | null) {
  if (!pathname) return true;
  if (pathname === "/login" || pathname.startsWith("/verify-email") || pathname.startsWith("/reset-password")) return true;
  if (pathname.includes("/print")) return true;
  return false;
}

function titleFor(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/request")) return "New Request";
  if (pathname.startsWith("/admin/vehicles")) return "Vehicles";
  if (pathname.startsWith("/admin")) return "Approvals";
  return "SVR Booking";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const role = (data as { role?: string } | null)?.role;
  const email = data?.user?.email ?? null;
  const avatar = data?.user?.image ?? null;
  const displayName = data?.user?.name ?? null;
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const items = useMemo(() => {
    const base: { href: string; label: string; icon: string }[] = [
      { href: "/", label: "Dashboard", icon: ICONS.dashboard },
      { href: "/request", label: "New Request", icon: ICONS.request }
    ];
    if (role === "ADMIN") {
      base.push({ href: "/admin", label: "Approvals", icon: ICONS.approvals });
      base.push({ href: "/admin/vehicles", label: "Vehicles", icon: ICONS.vehicles });
    }
    base.push({ href: "/profile", label: "Profile", icon: ICONS.profile });
    return base;
  }, [role]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function onLogout() {
    setDrawerOpen(false);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  // Signed-out, auth screens, and print pages render without the shell.
  if (!email || isBareRoute(pathname)) {
    return <>{children}</>;
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`);
  }

  function NavLinks(props: { collapsed: boolean; onNavigate?: () => void }) {
    return (
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={props.onNavigate}
              title={props.collapsed ? it.label : undefined}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                props.collapsed ? "justify-center" : "",
                active ? "bg-emerald-50 text-emerald-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              ].join(" ")}
            >
              <Icon d={it.icon} />
              {!props.collapsed ? <span className="truncate">{it.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex min-h-dvh bg-zinc-50">
      {/* Desktop sidebar — persistent + collapsible */}
      <aside
        className={[
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-zinc-200/70 bg-white px-3 py-4 transition-[width] duration-200 lg:flex",
          mounted && collapsed ? "w-[68px]" : "w-56"
        ].join(" ")}
      >
        <Link href="/" className={`flex items-center px-1 ${collapsed ? "justify-center" : ""}`} aria-label="SVR Booking home">
          <img
            src="/branding/svr-logo.png"
            alt="SVR"
            width={384}
            height={256}
            decoding="async"
            className={collapsed ? "h-9 w-auto max-w-full object-contain" : "h-14 w-auto object-contain"}
          />
        </Link>

        <div className="mt-6 flex-1">
          <NavLinks collapsed={collapsed} />
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
            />
          </svg>
          {!collapsed ? "Collapse" : null}
        </button>

        <div className="border-t border-zinc-100 pt-3">
          {!collapsed ? <div className="truncate px-3 text-xs text-zinc-500">{email}</div> : null}
          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className={[
              "mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50",
              collapsed ? "justify-center" : ""
            ].join(" ")}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
              <path fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            </svg>
            {!collapsed ? "Logout" : null}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 flex h-dvh w-64 max-w-[80%] flex-col border-r border-zinc-200 bg-white px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between px-1">
              <Link href="/" className="flex items-center" onClick={() => setDrawerOpen(false)} aria-label="SVR Booking home">
                <img src="/branding/svr-logo.png" alt="SVR" width={384} height={256} decoding="async" className="h-12 w-auto object-contain" />
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
              >
                <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-5 flex-1">
              <NavLinks collapsed={false} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="border-t border-zinc-100 pt-3">
              <div className="truncate px-3 text-xs text-zinc-500">{email}</div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-zinc-200/70 bg-white/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 lg:hidden"
            >
              <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{titleFor(pathname)}</h1>
          </div>
          <Link href="/profile" className="flex shrink-0 items-center gap-2 rounded-full sm:gap-3" aria-label="Profile settings">
            <span className="hidden max-w-[180px] truncate text-sm text-zinc-600 sm:inline">
              {displayName || email}
            </span>
            {avatar ? (
              <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white sm:h-9 sm:w-9">
                {(displayName || email || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
