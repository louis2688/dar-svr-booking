"use client";

import { BOOKING_TIME_OPTIONS, formatBookingTimeLabel, type BookingTime } from "@svr/shared";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Vehicle = { id: string; name: string; plateNo?: string | null };
type BookingDetail = {
  id: string;
  controlNo: string;
  status: string;
  vehicleId: string | null;
  date: string;
  startTime: string;
  destination: string;
  purpose: string;
  timeText: string | null;
  requestorName: string;
  passengers: { fullName: string }[];
};

export default function EditBookingPage() {
  const { data: session } = useSession();
  const isAdmin = (session as { role?: string } | null)?.role === "ADMIN";
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [controlNo, setControlNo] = useState("");
  const [status, setStatus] = useState("");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState<BookingTime>(BOOKING_TIME_OPTIONS[0]);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [timeText, setTimeText] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [passengersText, setPassengersText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/requests/${id}`);
      const json = (await res.json().catch(() => null)) as { item?: BookingDetail; message?: string } | null;
      if (!res.ok || !json?.item) {
        setLoadError(json?.message ?? "Could not load this request.");
        setLoading(false);
        return;
      }
      const b = json.item;
      setControlNo(b.controlNo);
      setStatus(b.status);
      setVehicleId(b.vehicleId ?? "");
      setDate(b.date.slice(0, 10));
      setStartTime(b.startTime as BookingTime);
      setDestination(b.destination);
      setPurpose(b.purpose);
      setTimeText(b.timeText ?? "");
      setRequestorName(b.requestorName);
      setPassengersText(b.passengers.map((p) => p.fullName).join("\n"));
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const res = await fetch("/api/vehicles?includeInactive=1");
      const json = (await res.json().catch(() => null)) as { items?: Vehicle[] } | null;
      setVehicles(json?.items ?? []);
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && status && status !== "PENDING") setLocked(true);
  }, [isAdmin, status]);

  async function save() {
    setSaving(true);
    setError(null);
    const passengers = passengersText.split("\n").map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // Always send vehicleId when admin (id or explicit null) so clearing the
        // dropdown actually unassigns the vehicle instead of being silently ignored.
        ...(isAdmin ? { vehicleId: vehicleId || null } : {}),
        date,
        startTime,
        destination,
        purpose,
        timeText: timeText || undefined,
        requestorName,
        passengers
      })
    });
    const json = (await res.json().catch(() => null)) as
      | { message?: string; issues?: { message?: string }[] }
      | null;
    setSaving(false);
    if (!res.ok) {
      const fromIssues = json?.issues?.find((i) => i.message)?.message;
      setError(json?.message ?? fromIssues ?? "Failed to save changes.");
      return;
    }
    router.push("/bookings");
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-sm text-zinc-600">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-sm text-red-600">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold">Edit request {controlNo}</h1>
        <p className="mt-1 text-sm text-zinc-600">Status: {status}</p>

        {locked ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            This request is no longer pending, so it can’t be edited. Cancel it from the bookings list and submit a
            new one if you need changes.
          </div>
        ) : (
          <div className="mt-6 rounded-xl border bg-white p-5">
            <div className="grid gap-3">
              {isAdmin ? (
                <div>
                  <label className="text-sm font-medium">Vehicle</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
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
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Trip date</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Start time</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value as BookingTime)}
                  >
                    {BOOKING_TIME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {formatBookingTimeLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Requestor name</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={requestorName}
                  onChange={(e) => setRequestorName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destination</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Purpose of travel</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Travel window (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                  placeholder="e.g., 8:00 AM - 5:00 PM"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Passengers (one per line)</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  value={passengersText}
                  onChange={(e) => setPassengersText(e.target.value)}
                />
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  disabled={saving || !date || !destination || !purpose || !requestorName}
                  onClick={save}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                  onClick={() => router.push("/bookings")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
