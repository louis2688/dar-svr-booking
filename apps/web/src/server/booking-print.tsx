"use client";

import type { BookingStatus } from "@prisma/client";

import { formatBookingTimeLabel } from "@svr/shared";

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

/** Split a "8:00 AM - 5:00 PM" travel window into FROM / TO parts. */
function splitTimeWindow(timeText: string | null | undefined, fallbackFrom: string) {
  const raw = (timeText ?? "").trim();
  if (raw) {
    const parts = raw.split(/\s*[-–—]\s*|\s+to\s+/i);
    if (parts.length >= 2) return { from: parts[0].trim(), to: parts.slice(1).join(" ").trim() };
    return { from: raw, to: "" };
  }
  return { from: fallbackFrom, to: "" };
}

function Line({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`min-w-0 flex-1 border-b border-zinc-900 px-1 text-center font-medium ${className}`}>
      {children || " "}
    </span>
  );
}

/** One copy of the official REQUEST OF VEHICLE form. Two stack on an 8.5x13 sheet. */
function FormCopy({ req }: { req: PrintableBookingRequest }) {
  const tripDate = req.date.toISOString().slice(0, 10);
  const plateNo = req.vehicle?.plateNo ?? "";
  const { from, to } = splitTimeWindow(req.timeText, formatBookingTimeLabel(req.startTime));

  return (
    <div className="form-copy text-[11px] leading-tight text-zinc-900">
      {/* Office header */}
      <div className="text-center">
        <div>Department of Agrarian Reform</div>
        <div className="font-bold">PROVINCIAL AGRARIAN REFORM OFFICE</div>
        <div>Tanza, Boac, Marinduque</div>
        <div className="mt-2 font-bold tracking-wide">REQUEST OF VEHICLE</div>
      </div>

      {/* Control No + Date (right) */}
      <div className="mt-2 flex justify-end">
        <div className="text-right">
          <div>
            Control No.: <span className="font-medium underline underline-offset-2">{req.controlNo}</span>
          </div>
          <div className="ml-auto mt-6 w-52 border-t border-zinc-900" />
          <div className="text-[10px]">Date</div>
        </div>
      </div>

      {/* Requestor */}
      <div className="mt-1">
        <div className="font-bold">{req.requestorName}</div>
      </div>

      {/* Request sentence */}
      <div className="mt-2 flex flex-wrap items-end gap-x-1 leading-6">
        <span>It is requested that I be allowed to use the service vehicle with Plate No.</span>
        <span className="inline-block min-w-[90px] border-b border-zinc-900 px-1 text-center font-medium">
          {plateNo || " "}
        </span>
        <span>on</span>
        <span className="inline-block min-w-[90px] border-b border-zinc-900 px-1 text-center font-medium">
          {tripDate}
        </span>
        <span>.</span>
      </div>

      {/* Fields */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-end gap-2">
          <div className="w-24 shrink-0 font-medium">DESTINATION:</div>
          <Line>{req.destination}</Line>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-24 shrink-0 font-medium">PURPOSE&nbsp;&nbsp;&nbsp;&nbsp;:</div>
          <Line>{req.purpose}</Line>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-24 shrink-0 font-medium">TIME&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
          <div className="flex min-w-0 flex-1 items-end gap-2">
            <span>FROM:</span>
            <Line>{from}</Line>
            <span>TO:</span>
            <Line>{to}</Line>
          </div>
        </div>
      </div>

      {/* Signature of employee (right) */}
      <div className="mt-8 flex justify-end">
        <div className="text-center text-[10px]">
          <div className="ml-auto w-56 border-t border-zinc-900" />
          <div className="mt-0.5">
            Signature of Employee Above
            <br />
            Printed Name
          </div>
        </div>
      </div>

      {/* Approved by / Noted by */}
      <div className="mt-4 grid grid-cols-2 gap-8">
        <div>
          <div>Approved by:</div>
          <div className="mt-7 font-bold uppercase">{APPROVER.name}</div>
          <div className="text-[10px]">{APPROVER.position}</div>
        </div>
        <div>
          <div>Noted by:</div>
          <div className="mt-7 font-bold uppercase">{NOTED_BY.name}</div>
          <div className="text-[10px]">{NOTED_BY.position}</div>
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
        @page { size: 8.5in 13in; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          .sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; width: auto !important; }
          .form-copy { break-inside: avoid; }
          .cut-line { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[7.5in] items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">Two copies per 8.5&quot; × 13&quot; (long/Folio) sheet.</span>
        <button
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Printable area of an 8.5x13 page (minus 0.5in margins ≈ 7.5in). Two stacked copies. */}
      <div className="sheet mx-auto w-[7.5in] max-w-full rounded-xl border bg-white p-[0.4in] shadow-sm">
        <FormCopy req={req} />

        <div className="cut-line my-5 flex items-center gap-2 text-[9px] text-zinc-400">
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
          ✂ cut here
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
        </div>

        <FormCopy req={req} />
      </div>
    </div>
  );
}
