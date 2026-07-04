"use client";

import type { BookingStatus } from "@prisma/client";

import { formatBookingTimeLabel } from "@svr/shared";

export type SignatoryInfo = { name: string; position: string; signature?: string | null };

/** Fallback signatories if none are passed (matches the seeded records). */
const DEFAULT_APPROVER: SignatoryInfo = { name: "JOHN PAOLO M. LLANES", position: "Administrative Officer IV" };
const DEFAULT_NOTED: SignatoryInfo = { name: "ROSAVILLA M. DAVALOS, JD", position: "Chief Administrative Officer" };

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
  decidedByName?: string | null;
  notedBy?: string | null;
};

function splitTimeWindow(timeText: string | null | undefined, fallbackFrom: string) {
  const raw = (timeText ?? "").trim();
  if (raw) {
    const parts = raw.split(/\s*[-–—]\s*|\s+to\s+/i);
    if (parts.length >= 2) return { from: parts[0].trim(), to: parts.slice(1).join(" ").trim() };
    return { from: raw, to: "" };
  }
  return { from: fallbackFrom, to: "" };
}

function Line({ children }: { children?: React.ReactNode }) {
  return (
    <span className="min-w-0 flex-1 border-b border-zinc-900 px-1 text-center font-medium">{children || " "}</span>
  );
}

/** Greedy word-wrap into exactly 2 lines (approx chars/line for this field's width). */
function wrapTwoLines(text: string, charsPerLine = 62): [string, string] {
  const t = (text ?? "").trim();
  if (t.length <= charsPerLine) return [t, ""];
  const words = t.split(/\s+/);
  let line1 = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line1 ? `${line1} ${words[i]}` : words[i];
    if (next.length > charsPerLine && line1) break;
    line1 = next;
  }
  const line2 = words.slice(i).join(" ");
  return [line1, line2];
}

/** Two stacked underlined rows — long text (e.g. Purpose) wraps onto its own second line. */
function TwoLineField({ label, text }: { label: React.ReactNode; text: string }) {
  const [line1, line2] = wrapTwoLines(text);
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="w-24 shrink-0 font-medium">{label}</div>
        <Line>{line1}</Line>
      </div>
      <div className="flex items-end gap-2">
        <div className="w-24 shrink-0" />
        <Line>{line2}</Line>
      </div>
    </div>
  );
}

/** Label + signature image (over the line) + printed name + position. */
function SignatureBlock(props: { label: string; person: SignatoryInfo; uppercase?: boolean }) {
  const { label, person } = props;
  return (
    <div className="text-[10px] text-zinc-500">
      {label}
      <div className="relative mt-1 h-11">
        {person.signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.signature}
            alt=""
            className="absolute bottom-0 left-1/2 max-h-11 max-w-[180px] -translate-x-1/2 object-contain"
          />
        ) : null}
      </div>
      <div className={`border-t pt-1 text-sm font-semibold text-zinc-900 ${props.uppercase ? "uppercase" : ""}`}>
        {person.name}
      </div>
      <div className="text-[10px] font-normal text-zinc-500">{person.position}</div>
    </div>
  );
}

function FormCopy({
  req,
  approver,
  noted
}: {
  req: PrintableBookingRequest;
  approver: SignatoryInfo;
  noted: SignatoryInfo;
}) {
  const tripDate = req.date.toISOString().slice(0, 10);
  const plateNo = req.vehicle?.plateNo ?? "";
  const { from, to } = splitTimeWindow(req.timeText, formatBookingTimeLabel(req.startTime));

  return (
    <div className="form-copy text-[11px] leading-tight text-zinc-900">
      <div className="text-center">
        <div>Department of Agrarian Reform</div>
        <div className="font-bold">PROVINCIAL AGRARIAN REFORM OFFICE</div>
        <div>Tanza, Boac, Marinduque</div>
        <div className="mt-2 font-bold tracking-wide">REQUEST OF VEHICLE</div>
      </div>

      <div className="mt-2 flex justify-end">
        <div className="text-right">
          <div>
            Control No.: <span className="font-medium underline underline-offset-2">{req.controlNo}</span>
          </div>
          <div className="ml-auto mt-6 w-52 border-t border-zinc-900" />
          <div className="text-[10px]">Date</div>
        </div>
      </div>

      <div className="mt-1">
        <div className="font-bold">{req.requestorName}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-x-1 leading-6">
        <span>It is requested that I be allowed to use the service vehicle with Plate No.</span>
        <span className="inline-block min-w-[90px] border-b border-zinc-900 px-1 text-center font-medium">
          {plateNo || " "}
        </span>
        <span>on</span>
        <span className="inline-block min-w-[90px] border-b border-zinc-900 px-1 text-center font-medium">
          {tripDate}
        </span>
        <span>.</span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-end gap-2">
          <div className="w-24 shrink-0 font-medium">DESTINATION:</div>
          <Line>{req.destination}</Line>
        </div>
        <TwoLineField label={<>PURPOSE&nbsp;&nbsp;&nbsp;&nbsp;:</>} text={req.purpose} />
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

      <div className="mt-6 flex justify-end">
        <div className="text-center text-[10px]">
          <div className="ml-auto w-56 border-t border-zinc-900" />
          <div className="mt-0.5">
            Signature of Employee Above
            <br />
            Printed Name
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-8">
        <SignatureBlock label="Approved by:" person={approver} uppercase />
        <SignatureBlock label="Noted by:" person={noted} uppercase />
      </div>
    </div>
  );
}

export function BookingPrintDocument(props: {
  req: PrintableBookingRequest;
  approver?: SignatoryInfo | null;
  noted?: SignatoryInfo | null;
}) {
  const { req } = props;
  const approver = props.approver ?? DEFAULT_APPROVER;
  const noted = props.noted ?? DEFAULT_NOTED;

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

      <div className="sheet mx-auto w-[7.5in] max-w-full rounded-xl border bg-white p-[0.4in] shadow-sm">
        <FormCopy req={req} approver={approver} noted={noted} />

        <div className="cut-line my-5 flex items-center gap-2 text-[9px] text-zinc-400">
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
          ✂ cut here
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
        </div>

        <FormCopy req={req} approver={approver} noted={noted} />
      </div>
    </div>
  );
}
