"use client";

import type { BookingStatus } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";

import { formatBookingTimeLabel } from "@svr/shared";

export type SignatoryInfo = { name: string; position: string; signature?: string | null };
type SignatoryRole = "APPROVER" | "NOTED_BY";

/** Resize an uploaded signature image to a max width, keep aspect, return a data URL. */
async function fileToSignatureDataUrl(file: File, maxW = 500): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(maxW / bmp.width, 1);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

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

/** Always two stacked underlined rows for Purpose — long text wraps onto the
    second row; short text leaves it blank so there's always room to write a
    continuation by hand on a printed copy. */
function TwoLineField({ label, text }: { label: React.ReactNode; text: string }) {
  const [line1, line2] = wrapTwoLines(text);
  return (
    <div className="space-y-2">
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

/** Label + signature image (over the line) + printed name + position.
    When `editable`, the signature area itself is clickable — admins upload a
    signature right from the print view, no separate settings page needed. */
function SignatureBlock(props: {
  label: string;
  person: SignatoryInfo;
  role: SignatoryRole;
  uppercase?: boolean;
  editable: boolean;
  onUpdated: (role: SignatoryRole, signature: string | null) => void;
}) {
  const { label, person, editable } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Choose an image file.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await fileToSignatureDataUrl(file);
      const res = await fetch("/api/admin/signatories", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: props.role, signature: dataUrl })
      });
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setErr(json?.message ?? "Upload failed.");
      } else {
        props.onUpdated(props.role, dataUrl);
      }
    } catch {
      setErr("Could not read that image.");
    }
    setBusy(false);
  }

  return (
    <div className="text-[10px] text-zinc-500">
      {label}
      <div
        className={[
          "relative mt-1 h-11",
          editable ? "no-print cursor-pointer rounded transition hover:bg-emerald-50" : ""
        ].join(" ")}
        onClick={editable && !busy ? () => fileRef.current?.click() : undefined}
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : undefined}
        title={editable ? "Click to upload signature" : undefined}
      >
        {person.signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.signature}
            alt=""
            className="pointer-events-none absolute bottom-0 left-1/2 max-h-11 max-w-[180px] -translate-x-1/2 object-contain"
          />
        ) : editable ? (
          <span className="no-print absolute inset-0 flex items-center justify-center text-center text-[9px] leading-tight text-emerald-700">
            {busy ? "Uploading…" : "+ Click to upload signature"}
          </span>
        ) : null}
        {editable ? (
          <input ref={fileRef} type="file" accept="image/*" className="no-print hidden" onChange={onPick} />
        ) : null}
      </div>
      {err ? <div className="no-print text-[9px] text-red-600">{err}</div> : null}
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
  noted,
  editable,
  onUpdated
}: {
  req: PrintableBookingRequest;
  approver: SignatoryInfo;
  noted: SignatoryInfo;
  editable: boolean;
  onUpdated: (role: SignatoryRole, signature: string | null) => void;
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
        <SignatureBlock
          label="Approved by:"
          person={approver}
          role="APPROVER"
          uppercase
          editable={editable}
          onUpdated={onUpdated}
        />
        <SignatureBlock
          label="Noted by:"
          person={noted}
          role="NOTED_BY"
          uppercase
          editable={editable}
          onUpdated={onUpdated}
        />
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
  const { data: session } = useSession();
  const isAdmin = (session as { role?: string } | null)?.role === "ADMIN";

  const [approver, setApprover] = useState<SignatoryInfo>(props.approver ?? DEFAULT_APPROVER);
  const [noted, setNoted] = useState<SignatoryInfo>(props.noted ?? DEFAULT_NOTED);

  function handleUpdated(role: SignatoryRole, signature: string | null) {
    if (role === "APPROVER") setApprover((prev) => ({ ...prev, signature }));
    else setNoted((prev) => ({ ...prev, signature }));
  }

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
        <span className="text-xs text-zinc-500">
          Two copies per 8.5&quot; × 13&quot; (long/Folio) sheet.
          {isAdmin ? " Click a signature box below to upload/replace it." : ""}
        </span>
        <button
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="sheet mx-auto w-[7.5in] max-w-full rounded-xl border bg-white p-[0.4in] shadow-sm">
        <FormCopy req={req} approver={approver} noted={noted} editable={isAdmin} onUpdated={handleUpdated} />

        <div className="cut-line my-5 flex items-center gap-2 text-[9px] text-zinc-400">
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
          ✂ cut here
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
        </div>

        <FormCopy req={req} approver={approver} noted={noted} editable={isAdmin} onUpdated={handleUpdated} />
      </div>
    </div>
  );
}
