"use client";

import type { BookingStatus } from "@prisma/client";

import { formatBookingTimeLabel } from "@svr/shared";

import { formatManilaDateTime } from "@/server/time";

export type PrintableBookingRequest = {
  controlNo: string;
  status: BookingStatus;
  date: Date;
  startTime: string;
  destination: string;
  purpose: string;
  timeText?: string | null;
  requestorName: string;
  createdAt: Date;
  vehicle: { name: string; plateNo?: string | null };
  passengers: { fullName: string }[];
};

export function BookingPrintDocument(props: { req: PrintableBookingRequest }) {
  const { req } = props;
  const tripDate = req.date.toISOString().slice(0, 10);
  const createdAtText = formatManilaDateTime(req.createdAt);

  return (
    <div className="min-h-dvh bg-zinc-100 p-6 text-zinc-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .paper { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="paper mx-auto max-w-3xl rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Service Vehicle Request</div>
            <div className="mt-1 text-2xl font-semibold">{req.controlNo}</div>
          </div>
          <div className="text-right text-sm">
            <div>
              <span className="text-zinc-500">Trip date:</span>{" "}
              <span className="font-medium">{tripDate}</span>
            </div>
            <div>
              <span className="text-zinc-500">Start time:</span>{" "}
              <span className="font-medium">{formatBookingTimeLabel(req.startTime)}</span>
            </div>
            <div className="mt-1">
              <span className="text-zinc-500">Created:</span>{" "}
              <span className="font-medium">{createdAtText}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="text-xs text-zinc-500">Vehicle</div>
              <div className="font-medium">
                {req.vehicle.name}
                {req.vehicle.plateNo ? ` (${req.vehicle.plateNo})` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Requestor</div>
              <div className="font-medium">{req.requestorName}</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500">Destination</div>
            <div className="font-medium">{req.destination}</div>
          </div>

          <div>
            <div className="text-xs text-zinc-500">Purpose of travel</div>
            <div className="whitespace-pre-wrap font-medium">{req.purpose}</div>
          </div>

          {req.timeText ? (
            <div>
              <div className="text-xs text-zinc-500">Time</div>
              <div className="font-medium">{req.timeText}</div>
            </div>
          ) : null}

          <div>
            <div className="text-xs text-zinc-500">Passengers</div>
            {req.passengers.length ? (
              <ol className="mt-1 list-decimal pl-5">
                {req.passengers.map((p, idx) => (
                  <li key={`${p.fullName}-${idx}`} className="font-medium">
                    {p.fullName}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="font-medium">—</div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="border-t pt-2 text-xs text-zinc-500">
              Requested by
              <div className="mt-8 text-sm font-medium text-zinc-900">Signature</div>
            </div>
            <div className="border-t pt-2 text-xs text-zinc-500">
              Approved by
              <div className="mt-8 text-sm font-medium text-zinc-900">Signature</div>
            </div>
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Status: <span className="font-medium text-zinc-900">{req.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
