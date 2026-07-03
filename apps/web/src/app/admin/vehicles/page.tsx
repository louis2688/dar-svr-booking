"use client";

import { FormEvent, useEffect, useState } from "react";

type Vehicle = { id: string; name: string; plateNo?: string | null; active?: boolean };
type VehiclesResponse = { items?: Vehicle[]; error?: string; message?: string };

export default function AdminVehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/vehicles?includeInactive=1");
    const json = (await res.json().catch(() => null)) as VehiclesResponse | null;
    if (!res.ok) {
      setError(json?.error ?? json?.message ?? "Failed to load vehicles.");
      setItems([]);
    } else {
      setItems(json?.items ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vehicle name is required.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed, plateNo: plateNo.trim() || undefined })
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(json?.message ?? json?.error ?? "Failed to create vehicle.");
      setSaving(false);
      return;
    }

    setName("");
    setPlateNo("");
    setSaving(false);
    await load();
  }

  async function onUpdate(v: Vehicle, nextName: string, nextPlate: string) {
    setError(null);
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setError("Vehicle name cannot be empty.");
      return;
    }

    setBusyId(v.id);
    const res = await fetch(`/api/vehicles/${encodeURIComponent(v.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        plateNo: nextPlate.trim() === "" ? null : nextPlate.trim()
      })
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(json?.message ?? json?.error ?? "Failed to update vehicle.");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    await load();
  }

  async function onRemove(v: Vehicle) {
    const ok = window.confirm(`Remove "${v.name}" from the active list? Existing bookings are kept.`);
    if (!ok) return;

    setError(null);
    setBusyId(v.id);
    const res = await fetch(`/api/vehicles/${encodeURIComponent(v.id)}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(json?.message ?? json?.error ?? "Failed to remove vehicle.");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    await load();
  }

  async function onRestore(v: Vehicle) {
    setError(null);
    setBusyId(v.id);
    const res = await fetch(`/api/vehicles/${encodeURIComponent(v.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: true })
    });
    const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(json?.message ?? json?.error ?? "Failed to restore vehicle.");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    await load();
  }

  async function onPermanentDelete(v: Vehicle) {
    const ok = window.confirm(
      `Permanently delete "${v.name}" from the database?\n\nIf it has booking history, you'll be asked whether to delete those booking records too (destructive).`
    );
    if (!ok) return;

    setError(null);
    setBusyId(v.id);
    let res = await fetch(`/api/vehicles/${encodeURIComponent(v.id)}?permanent=1`, {
      method: "DELETE"
    });
    let json = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
      bookingCount?: number;
    } | null;

    if (res.status === 409 && json?.error === "HAS_BOOKINGS") {
      const count = json.bookingCount ?? 0;
      const okForce = window.confirm(
        `This vehicle has ${count} booking record(s).\n\nTo permanently delete the vehicle, those booking records must be deleted too.\n\nContinue and DELETE ALL related bookings for this vehicle?`
      );
      if (!okForce) {
        setBusyId(null);
        return;
      }

      res = await fetch(
        `/api/vehicles/${encodeURIComponent(v.id)}?permanent=1&forceBookings=1`,
        { method: "DELETE" }
      );
      json = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
        bookingCount?: number;
      } | null;
    }

    if (!res.ok) {
      setError(json?.message ?? json?.error ?? "Failed to permanently delete vehicle.");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    await load();
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Vehicles</h1>
            <p className="mt-1 text-sm text-zinc-600">Add vehicles to make them available for booking.</p>
          </div>
          <a className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" href="/admin">
            Back to approvals
          </a>
        </div>

        {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

        <div className="mt-6 grid gap-6">
          <form className="rounded-xl border bg-white p-4" onSubmit={onCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Vehicle name</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Service Van 1"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Plate no (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={plateNo}
                  onChange={(e) => setPlateNo(e.target.value)}
                  placeholder="e.g., ABC-1234"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Add vehicle"}
              </button>
              <button
                className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                type="button"
                onClick={load}
                disabled={loading || saving}
              >
                Refresh
              </button>
            </div>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">Vehicles</div>
            <p className="mt-1 text-xs text-zinc-600">
              Removed vehicles are hidden from booking, but historical requests remain linked.
            </p>
            <div className="mt-3 space-y-3">
              {loading ? (
                <div className="text-sm text-zinc-600">Loading...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-zinc-600">No vehicles yet.</div>
              ) : (
                items.map((v) => (
                  <VehicleEditorRow
                    key={v.id}
                    vehicle={v}
                    busy={busyId === v.id}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onRestore={onRestore}
                    onPermanentDelete={onPermanentDelete}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleEditorRow(props: {
  vehicle: Vehicle;
  busy: boolean;
  onUpdate: (v: Vehicle, name: string, plate: string) => void | Promise<void>;
  onRemove: (v: Vehicle) => void | Promise<void>;
  onRestore: (v: Vehicle) => void | Promise<void>;
  onPermanentDelete: (v: Vehicle) => void | Promise<void>;
}) {
  const { vehicle, busy } = props;
  const [editName, setEditName] = useState(vehicle.name);
  const [editPlate, setEditPlate] = useState(vehicle.plateNo ?? "");

  useEffect(() => {
    setEditName(vehicle.name);
    setEditPlate(vehicle.plateNo ?? "");
  }, [vehicle.id, vehicle.name, vehicle.plateNo]);

  const isActive = vehicle.active !== false;

  return (
    <div className={`rounded-lg border p-3 ${isActive ? "bg-white" : "bg-zinc-50"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <div className="min-w-0">
            <label className="text-xs font-medium text-zinc-600">Name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={busy || !isActive}
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs font-medium text-zinc-600">Plate no</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={editPlate}
              onChange={(e) => setEditPlate(e.target.value)}
              disabled={busy || !isActive}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
          {!isActive ? (
            <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-800">Inactive</span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">Active</span>
          )}

          {isActive ? (
            <>
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                disabled={busy}
                onClick={() => props.onUpdate(vehicle, editName, editPlate)}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => props.onRemove(vehicle)}
              >
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => props.onRestore(vehicle)}
            >
              Restore
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={busy}
            title="Permanently deletes the vehicle row if it has no bookings"
            onClick={() => props.onPermanentDelete(vehicle)}
          >
            Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}

