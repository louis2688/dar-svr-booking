"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Approved" },
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" }
] as const;

export function BookingsSummaryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const rawStatus = searchParams.get("status");
  const statusValue =
    rawStatus === null || rawStatus === ""
      ? "APPROVED"
      : rawStatus === "all"
        ? "all"
        : ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(rawStatus)
          ? rawStatus
          : "APPROVED";

  const qFromUrl = searchParams.get("q") ?? "";
  const [searchDraft, setSearchDraft] = useState(qFromUrl);
  const draftRef = useRef(searchDraft);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftRef.current = searchDraft;

  useEffect(() => {
    setSearchDraft(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const pushParams = (next: URLSearchParams) => {
    const s = next.toString();
    startTransition(() => {
      router.replace(s ? `?${s}` : "/", { scroll: false });
    });
  };

  const onStatusChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "APPROVED") {
      next.delete("status");
    } else {
      next.set("status", value);
    }
    pushParams(next);
  };

  const scheduleSearchPush = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const next = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : searchParams.toString()
      );
      const trimmed = draftRef.current.trim();
      if (trimmed === "") {
        next.delete("q");
      } else {
        next.set("q", trimmed);
      }
      pushParams(next);
    }, 320);
  };

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[200px] flex-col gap-1 text-sm">
        <span className="text-zinc-600">Status</span>
        <select
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60"
          value={statusValue}
          disabled={pending}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
        <span className="text-zinc-600">Search</span>
        <input
          type="search"
          placeholder="Control no., requestor, destination, vehicle…"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60"
          value={searchDraft}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            setSearchDraft(v);
            scheduleSearchPush();
          }}
        />
      </label>
    </div>
  );
}
