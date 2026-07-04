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
  vehicleId?: string | null;
  vehicle?: { id: string; name: string; plateNo?: string | null } | null;
  passengers?: { id: string; fullName: string }[];
};

type Vehicle = { id: string; name: string; plateNo?: string | null };

type RequestsResponse = {
  error?: string;
  message?: string;
  items?: RequestRow[];
};

export default function AdminPage() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** requestId -> vehicleId chosen in the picker (admin assigns before approval). */
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Seed pickers from pre-assigned vehicles, but only ids the picker can actually display
      (inactive/removed vehicles are not in the options — seeding them would look blank
      while keeping Approve enabled). */
  function seedAssignments(rows: RequestRow[], selectable: Vehicle[]) {
    const allowed = new Set(selectable.map((v) => v.id));
    setAssignments((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!next[r.id] && r.vehicleId && allowed.has(r.vehicleId)) next[r.id] = r.vehicleId;
      }
      return next;
    });
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/requests?status=PENDING");
    const json = (await res.json().catch(() => null)) as RequestsResponse | null;
    if (!res.ok) {
      setError(json?.error ?? "Failed to load requests");
      setItems([]);
    } else {
      const rows = json?.items ?? [];
      setItems(rows);
      seedAssignments(rows, vehicles);
    }
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      const [reqRes, vehRes] = await Promise.all([
        fetch("/api/admin/requests?status=PENDING"),
        fetch("/api/vehicles")
      ]);
      const reqJson = (await reqRes.json().catch(() => null)) as RequestsResponse | null;
      const vehJson = (await vehRes.json().catch(() => null)) as { items?: Vehicle[] } | null;
      if (ignore) return;

      if (!reqRes.ok) {
        setError(reqJson?.error ?? "Failed to load requests");
        setItems([]);
      } else {
        const rows = reqJson?.items ?? [];
        setItems(rows);
        seedAssignments(rows, vehJson?.items ?? []);
      }
      setVehicles(vehJson?.items ?? []);
      setLoading(false);
    }

    void loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  async function approve(id: string) {
    const vehicleId = assignments[id];
    if (!vehicleId) {
      alert("Assign a vehicle first — user requests have no vehicle until you choose one.");
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/${id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId })
    });
    const json = (await res.json().catch(() => null)) as RequestsResponse | null;
    setBusyId(null);
    if (!res.ok) {
      alert(json?.message ?? json?.error ?? "Approval failed");
      return;
    }
    refresh();
  }

  async function reject(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/${id}/reject`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as RequestsResponse | null;
    setBusyId(null);
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
            <p className="mt-1 text-sm text-zinc-600">
              Assign a vehicle to each pending request, then approve or reject.
            </p>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm text-zinc-500">{r.controlNo}</div>
                    <div className="mt-1 text-base font-semibold">
                      {new Date(r.date).toISOString().slice(0, 10)} ({formatBookingTimeLabel(r.startTime)})
                      {r.vehicle?.name ? ` — ${r.vehicle.name}` : ""}
                    </div>
                    {!r.vehicleId ? (
                      <div className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        No vehicle yet — assign below
                      </div>
                    ) : null}
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

                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-600">Vehicle (admin assigns)</label>
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm sm:w-56"
                        value={assignments[r.id] ?? ""}
                        onChange={(e) =>
                          setAssignments((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        disabled={busyId === r.id}
                      >
                        <option value="">Select vehicle…</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                            {v.plateNo ? ` (${v.plateNo})` : ""}
                          </option>
                        ))}
                      </select>
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
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        disabled={busyId === r.id || !assignments[r.id]}
                        title={!assignments[r.id] ? "Assign a vehicle first" : undefined}
                        onClick={() => approve(r.id)}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                        disabled={busyId === r.id}
                        onClick={() => reject(r.id)}
                      >
                        Reject
                      </button>
                    </div>
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
