"use client";

import { useRouter } from "next/navigation";

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

export function BookingsTable(props: { rows: BookingRow[]; emptyMessage: string }) {
  const router = useRouter();

  function openDetail(id: string) {
    router.push(`/requests/${id}/print`);
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Control no</th>
            <th className="px-3 py-2.5 font-medium">Vehicle</th>
            <th className="px-3 py-2.5 font-medium">Trip date</th>
            <th className="px-3 py-2.5 font-medium">Start time</th>
            <th className="px-3 py-2.5 font-medium">Requestor</th>
            <th className="px-3 py-2.5 font-medium">Destination</th>
            <th className="px-3 py-2.5 font-medium">Created</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr className="border-t">
              <td className="px-3 py-4 text-zinc-600" colSpan={8}>
                {props.emptyMessage}
              </td>
            </tr>
          ) : (
            props.rows.map((b) => (
              <tr
                key={b.id}
                onClick={() => openDetail(b.id)}
                onKeyDown={(e) => {
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
