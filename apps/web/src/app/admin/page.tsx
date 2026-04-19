"use client";

import { formatBookingTimeLabel } from "@svr/shared";
import { useEffect, useState } from "react";

type RequestRow = {
  id: string;
  controlNo: string;
  date: string;
  startTime: string;
  destination: string;
  purpose: string;
  requestorName: string;
  status: string;
  vehicle?: { name: string; plateNo?: string | null };
  passengers?: { id: string; fullName: string }[];
};

type RequestsResponse = {
  error?: string;
  message?: string;
  items?: RequestRow[];
};

export default function AdminPage() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/requests?status=PENDING");
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Failed to load requests");
      setItems([]);
    } else {
      setItems(json.items ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialRequests() {
      const res = await fetch("/api/admin/requests?status=PENDING");
      const json = (await res.json().catch(() => null)) as RequestsResponse | null;
      if (ignore) return;

      if (!res.ok) {
        setError(json?.error ?? "Failed to load requests");
        setItems([]);
      } else {
        setItems(json?.items ?? []);
      }
      setLoading(false);
    }

    void loadInitialRequests();

    return () => {
      ignore = true;
    };
  }, []);

  async function approve(id: string) {
    const res = await fetch(`/api/admin/requests/${id}/approve`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as RequestsResponse | null;
    if (!res.ok) {
      alert(json?.message ?? json?.error ?? "Approval failed");
      return;
    }
    refresh();
  }

  async function reject(id: string) {
    const res = await fetch(`/api/admin/requests/${id}/reject`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as RequestsResponse | null;
    if (!res.ok) {
      alert(json?.message ?? json?.error ?? "Rejection failed");
      return;
    }
    refresh();
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Admin approvals</h1>
            <p className="mt-1 text-sm text-zinc-600">Approve or reject pending vehicle requests.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href="/admin/vehicles"
            >
              Manage vehicles
            </a>
            <button
              className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="text-sm text-zinc-600">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-zinc-600">No pending requests.</div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-zinc-500">{r.controlNo}</div>
                    <div className="mt-1 text-base font-semibold">
                      {new Date(r.date).toISOString().slice(0, 10)} ({formatBookingTimeLabel(r.startTime)}) —{" "}
                      {r.vehicle?.name ?? "Vehicle"}
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Requestor:</span> {r.requestorName}
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">Destination:</span> {r.destination}
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">Purpose:</span> {r.purpose}
                    </div>
                    {r.passengers?.length ? (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Passengers:</span>{" "}
                        {r.passengers.map((p) => p.fullName).join(", ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <a
                      className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                      href={`/admin/requests/${r.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print
                    </a>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                      onClick={() => approve(r.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                      onClick={() => reject(r.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
