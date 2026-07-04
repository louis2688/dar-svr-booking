"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type BookingRow = {
  id: string;
  controlNo: string;
  vehicleName: string | null;
  plateNo: string | null;
  dateStr: string;
  startTimeLabel: string;
  requestorName: string;
  destination: string;
  createdLabel: string;
  status: string;
  requestedById: string | null;
};

const STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-zinc-100 text-zinc-700 border-zinc-200"
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        STATUS_CHIP[status] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"
      ].join(" ")}
    >
      {status.charAt(0)}
      {status.slice(1).toLowerCase()}
    </span>
  );
}

export function BookingsTable(props: {
  rows: BookingRow[];
  emptyMessage: string;
  /** Current viewer — determines which action buttons show per row. */
  currentUserId?: string | null;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Local copy so cancel/delete can update the row instantly; re-synced whenever
  // the parent passes a new filtered/refetched row set (e.g. status/search change).
  const [rows, setRows] = useState(props.rows);
  useEffect(() => {
    setRows(props.rows);
  }, [props.rows]);

  function openDetail(id: string) {
    router.push(`/requests/${id}/print`);
  }

  function openEdit(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    router.push(`/bookings/${id}/edit`);
  }

  async function cancelBooking(e: React.MouseEvent, id: string, controlNo: string) {
    e.stopPropagation();
    if (!window.confirm(`Cancel booking ${controlNo}? This can't be undone.`)) return;
    setBusyId(id);
    const res = await fetch(`/api/requests/${id}/cancel`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    setBusyId(null);
    if (!res.ok) {
      alert(json?.message ?? "Failed to cancel request.");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)));
  }

  async function deleteBooking(e: React.MouseEvent, id: string, controlNo: string) {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete booking ${controlNo}? This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    setBusyId(null);
    if (!res.ok) {
      alert(json?.message ?? "Failed to delete request.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[1050px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Control no</th>
            <th className="px-3 py-2.5 font-medium">Vehicle</th>
            <th className="px-3 py-2.5 font-medium">Trip date</th>
            <th className="px-3 py-2.5 font-medium">Start time</th>
            <th className="px-3 py-2.5 font-medium">Requestor</th>
            <th className="px-3 py-2.5 font-medium">Destination</th>
            <th className="px-3 py-2.5 font-medium">Created</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t">
              <td className="px-3 py-4 text-zinc-600" colSpan={9}>
                {props.emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((b) => {
              const canEdit = Boolean(props.isAdmin);
              const canCancel = Boolean(props.isAdmin && (b.status === "PENDING" || b.status === "APPROVED"));
              const canDelete = Boolean(props.isAdmin);
              const busy = busyId === b.id;

              return (
                <tr
                  key={b.id}
                  onClick={() => openDetail(b.id)}
                  onKeyDown={(e) => {
                    // Let Enter/Space on a focused action button (Edit/Cancel/Delete)
                    // activate that button instead of being hijacked into row navigation.
                    if ((e.target as HTMLElement).closest("button, a")) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(b.id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open booking ${b.controlNo}`}
                  className="cursor-pointer border-t border-zinc-100 outline-none transition hover:bg-emerald-50/40 focus-visible:bg-emerald-50/60"
                >
                  <td className="px-3 py-3 font-semibold text-emerald-800">{b.controlNo}</td>
                  <td className="px-3 py-3">
                    {b.vehicleName ? (
                      <span className="inline-flex items-center gap-1.5">
                        {b.vehicleName}
                        {b.plateNo ? (
                          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                            {b.plateNo}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-zinc-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{b.dateStr}</td>
                  <td className="px-3 py-3">{b.startTimeLabel}</td>
                  <td className="px-3 py-3">{b.requestorName}</td>
                  <td className="px-3 py-3">{b.destination}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{b.createdLabel}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={b.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {canEdit ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => openEdit(e, b.id)}
                          className="rounded-lg border bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => cancelBooking(e, b.id, b.controlNo)}
                          className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => deleteBooking(e, b.id, b.controlNo)}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      ) : null}
                      {!canEdit && !canCancel && !canDelete ? <span className="text-xs text-zinc-400">—</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
