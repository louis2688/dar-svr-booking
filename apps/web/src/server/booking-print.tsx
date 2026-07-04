"use client";

import type { BookingStatus } from "@prisma/client";

import { formatBookingTimeLabel } from "@svr/shared";

import { formatManilaDateTime } from "@/server/time";

/** Fixed office signatories on the printed vehicle request form. */
const APPROVER = { name: "JOHN PAOLO M. LLANES", position: "Administrative Officer IV" };
const NOTED_BY = { name: "ROSAVILLA M. DAVALOS, JD", position: "Chief Administrative Officer" };

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
  vehicle: { name: string; plateNo?: string | null } | null;
  passengers: { fullName: string }[];
  /** Name of the admin who approved/decided; null while pending. */
  decidedByName?: string | null;
  /** Optional endorser name printed under the signature blocks. */
  notedBy?: string | null;
};

/** One request form. Two of these stack on a single 8.5x13 (Folio) sheet. */
function FormCopy({ req }: { req: PrintableBookingRequest }) {
  const tripDate = req.date.toISOString().slice(0, 10);
  const createdAtText = formatManilaDateTime(req.createdAt);

  return (
    <div className="form-copy">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Control Number</div>
          <div className="mt-0.5 text-xl font-semibold">{req.controlNo}</div>
        </div>
        <div className="text-right text-xs leading-5">
          <div>
            <span className="text-zinc-500">Trip date:</span>{" "}
            <span className="font-medium">{tripDate}</span>
          </div>
          <div>
            <span className="text-zinc-500">Start time:</span>{" "}
            <span className="font-medium">{formatBookingTimeLabel(req.startTime)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Created:</span>{" "}
            <span className="font-medium">{createdAtText}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <div className="text-[10px] text-zinc-500">Vehicle</div>
            <div className="font-medium">
              {req.vehicle
                ? `${req.vehicle.name}${req.vehicle.plateNo ? ` (${req.vehicle.plateNo})` : ""}`
                : "To be assigned by admin"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">Requestor</div>
            <div className="font-medium">{req.requestorName}</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-zinc-500">Destination</div>
          <div className="font-medium">{req.destination}</div>
        </div>

        <div>
          <div className="text-[10px] text-zinc-500">Purpose of travel</div>
          <div className="whitespace-pre-wrap font-medium">{req.purpose}</div>
        </div>

        {req.timeText ? (
          <div>
            <div className="text-[10px] text-zinc-500">Time</div>
            <div className="font-medium">{req.timeText}</div>
          </div>
        ) : null}

        <div>
          <div className="text-[10px] text-zinc-500">Passengers</div>
          {req.passengers.length ? (
            <ol className="mt-0.5 list-decimal pl-5">
              {req.passengers.map((p, idx) => (
                <li key={`${p.fullName}-${idx}`} className="font-medium leading-5">
                  {p.fullName}
                </li>
              ))}
            </ol>
          ) : (
            <div className="font-medium">—</div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-6">
          <div className="text-[10px] text-zinc-500">
            Requested by
            <div className="mt-7 border-t pt-1.5 text-sm font-semibold text-zinc-900">{req.requestorName}</div>
            <div className="text-[9px] font-normal text-zinc-500">Signature over printed name</div>
          </div>
          <div className="text-[10px] text-zinc-500">
            Approved by
            <div className="mt-7 border-t pt-1.5 text-sm font-semibold uppercase text-zinc-900">{APPROVER.name}</div>
            <div className="text-[9px] font-normal text-zinc-500">{APPROVER.position}</div>
          </div>
        </div>

        <div className="mt-4 max-w-[280px] text-[10px] text-zinc-500">
          Noted by
          <div className="mt-7 border-t pt-1.5 text-sm font-semibold uppercase text-zinc-900">{NOTED_BY.name}</div>
          <div className="text-[9px] font-normal text-zinc-500">{NOTED_BY.position}</div>
        </div>

        <div className="mt-3 text-[10px] text-zinc-500">
          Status: <span className="font-medium text-zinc-900">{req.status}</span>
        </div>
      </div>
    </div>
  );
}

export function BookingPrintDocument(props: { req: PrintableBookingRequest }) {
  const { req } = props;

  return (
    <div className="min-h-dvh bg-zinc-100 p-6 text-zinc-900">
      <style>{`
        /* Folio / long bond: 8.5in x 13in */
        @page { size: 8.5in 13in; margin: 0.4in; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          .sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; width: auto !important; }
          .form-copy { break-inside: avoid; }
          .cut-line { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[7.7in] items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">Two copies per 8.5&quot; × 13&quot; (long/Folio) sheet.</span>
        <button
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Sheet ~ printable area of an 8.5x13 page (minus margins). Two stacked copies. */}
      <div className="sheet mx-auto w-[7.7in] max-w-full rounded-xl border bg-white p-[0.35in] shadow-sm">
        <FormCopy req={req} />

        <div className="cut-line my-4 flex items-center gap-2 text-[9px] text-zinc-400">
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
          ✂ cut here
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
        </div>

        <FormCopy req={req} />
      </div>
    </div>
  );
}
