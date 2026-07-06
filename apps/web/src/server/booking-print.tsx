"use client";

import type { BookingStatus } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

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
  id: string;
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

function formatManilaDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

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

/** Greedy word-wrap into as many lines as the text needs (approx chars/line
    for this field's width). Always returns at least one line. */
function wrapLines(text: string, charsPerLine = 62): string[] {
  const t = (text ?? "").trim();
  if (!t) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of t.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Underlined rows for Purpose — one line normally, wrapping onto extra
    underlined rows only when the text exceeds a row's width. */
function MultiLineField({ label, text }: { label: React.ReactNode; text: string }) {
  return (
    <div className="space-y-2">
      {wrapLines(text).map((ln, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="w-24 shrink-0 font-medium">{i === 0 ? label : <span />}</div>
          <Line>{ln}</Line>
        </div>
      ))}
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
    <div className="text-[12px] text-zinc-500">
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
          <span className="no-print absolute inset-0 flex items-center justify-center text-center text-[11px] leading-tight text-emerald-700">
            {busy ? "Uploading…" : "+ Click to upload signature"}
          </span>
        ) : null}
        {editable ? (
          <input ref={fileRef} type="file" accept="image/*" className="no-print hidden" onChange={onPick} />
        ) : null}
      </div>
      {err ? <div className="no-print text-[11px] text-red-600">{err}</div> : null}
      <div className={`border-t pt-1 text-center text-[16px] font-semibold text-zinc-900 ${props.uppercase ? "uppercase" : ""}`}>
        {person.name}
      </div>
      <div className="text-center text-[12px] font-normal text-zinc-500">{person.position}</div>
    </div>
  );
}

/** Requestor's printed name. Admin gets an inline input on the print view; on
    blur it saves back to the booking (syncs to booking details). Everyone else
    (and the printed page) sees plain text over the line — blank if unset. */
function RequestorNameField({
  value,
  editable,
  onSave
}: {
  value: string;
  editable: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(value), [value]);

  async function commit() {
    const next = v.trim();
    if (!next || next === value.trim()) return;
    setBusy(true);
    await onSave(next);
    setBusy(false);
  }

  if (!editable) {
    return <div className="min-h-[1.25rem] text-[16px] font-semibold uppercase">{value}</div>;
  }
  return (
    <input
      value={v}
      disabled={busy}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      placeholder="Requestor name"
      className="w-full border-0 bg-transparent text-center text-[16px] font-semibold uppercase outline-none placeholder:normal-case placeholder:text-zinc-400"
    />
  );
}

/** Control number. Admin gets an inline input on the print view; on blur it
    saves back to the booking (syncs to the bookings lists). Everyone else sees
    the number as underlined text. Malformed input reverts without saving. */
function ControlNoField({
  value,
  editable,
  onSave
}: {
  value: string;
  editable: boolean;
  onSave: (controlNo: string) => Promise<void>;
}) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(value), [value]);

  async function commit() {
    const next = v.trim();
    if (next === value.trim()) return;
    if (!/^\d{4}-\d{2}-\d{4}[A-Za-z]?$/.test(next)) {
      setV(value);
      return;
    }
    setBusy(true);
    await onSave(next);
    setBusy(false);
  }

  if (!editable) {
    return <span className="font-medium underline underline-offset-2">{value}</span>;
  }
  return (
    <input
      value={v}
      disabled={busy}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      placeholder="YYYY-MM-0000"
      className="w-28 border-b border-zinc-900 bg-transparent text-center font-medium outline-none"
    />
  );
}

function FormCopy({
  req,
  controlNo,
  requestorName,
  approver,
  noted,
  editable,
  onUpdated,
  onRequestorSave,
  onControlSave
}: {
  req: PrintableBookingRequest;
  controlNo: string;
  requestorName: string;
  approver: SignatoryInfo;
  noted: SignatoryInfo;
  editable: boolean;
  onUpdated: (role: SignatoryRole, signature: string | null) => void;
  onRequestorSave: (name: string) => Promise<void>;
  onControlSave: (controlNo: string) => Promise<void>;
}) {
  const tripDate = req.date.toISOString().slice(0, 10);
  const plateNo = req.vehicle?.plateNo ?? "";
  const { from, to } = splitTimeWindow(req.timeText, formatBookingTimeLabel(req.startTime));

  return (
    <div className="form-copy text-[13px] leading-tight text-zinc-900">
      <div className="text-center">
        <div>Department of Agrarian Reform</div>
        <div className="font-bold">PROVINCIAL AGRARIAN REFORM OFFICE</div>
        <div>Tanza, Boac, Marinduque</div>
        <div className="mt-2 font-bold tracking-wide">REQUEST OF VEHICLE</div>
      </div>

      <div className="mt-2 flex justify-end">
        <div className="text-right">
          <div>
            Control No.: <ControlNoField value={controlNo} editable={editable} onSave={onControlSave} />
          </div>
          <div className="ml-auto mt-6 w-40 border-b border-zinc-900 pb-0.5 text-center font-medium">
            {formatManilaDate(req.createdAt)}
          </div>
          <div className="ml-auto w-40 text-center text-[12px]">Date</div>
        </div>
      </div>

      <div className="mt-1">
        {/* Requesting officer + position — fixed for now, made dynamic later. NOT the requestor. */}
        <div className="font-bold uppercase">JOHN PAOLO M. LLANES</div>
        <div className="text-[12px]">Administrative Officer IV</div>
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
        <MultiLineField label={<>PURPOSE&nbsp;&nbsp;&nbsp;&nbsp;:</>} text={req.purpose} />
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
        <div className="w-72 max-w-full text-center text-[12px]">
          <RequestorNameField value={requestorName} editable={editable} onSave={onRequestorSave} />
          <div className="border-t border-zinc-900" />
          <div className="mt-0.5">Requestor Name</div>
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
  const [requestorName, setRequestorName] = useState(req.requestorName);
  const [controlNo, setControlNo] = useState(req.controlNo);

  function handleUpdated(role: SignatoryRole, signature: string | null) {
    if (role === "APPROVER") setApprover((prev) => ({ ...prev, signature }));
    else setNoted((prev) => ({ ...prev, signature }));
  }

  async function saveRequestor(name: string) {
    const res = await fetch(`/api/requests/${req.id}/requestor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestorName: name })
    });
    if (res.ok) setRequestorName(name);
    else alert("Could not save requestor name.");
  }

  async function saveControlNo(next: string) {
    const res = await fetch(`/api/requests/${req.id}/control`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ controlNo: next })
    });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    if (res.ok) setControlNo(next);
    else alert(json?.message ?? "Could not save control number.");
  }

  return (
    <div className="print-root min-h-dvh bg-zinc-100 p-6 text-zinc-900">
      <style>{`
        /* Folio / long bond: 8.5in x 13in. Tight margin so the two copies fill
           the page with little wasted space. */
        @page { size: 8.5in 13in; margin: 0.3in; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; height: 100% !important; min-height: 0 !important; }
          /* Fill the printable page height and split it between the two copies
             so the sheet occupies the whole page instead of the top half. */
          .print-root { height: 100% !important; min-height: 0 !important; padding: 0 !important; }
          .sheet {
            box-shadow: none !important; border: none !important; padding: 0 !important;
            max-width: none !important; width: auto !important;
            height: 100% !important; display: flex !important; flex-direction: column !important;
          }
          /* Each copy fills its half and spreads its own content top-to-bottom
             (header up top, signatories near the cut line) — no dead gap. */
          .form-copy {
            flex: 1 1 0 !important;
            display: flex !important; flex-direction: column !important; justify-content: space-between !important;
            break-inside: avoid;
          }
          .cut-line { flex: 0 0 auto; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[7.5in] items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          Two copies per 8.5&quot; × 13&quot; (long/Folio) sheet.
          {isAdmin ? " Click a signature box below to upload/replace it." : ""}
        </span>
        <button
          className="rounded-lg bg-zinc-900 px-3 py-2 text-[16px] font-medium text-white hover:bg-zinc-800"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="sheet mx-auto w-[7.5in] max-w-full rounded-xl border bg-white p-[0.4in] shadow-sm">
        <FormCopy req={req} controlNo={controlNo} requestorName={requestorName} approver={approver} noted={noted} editable={isAdmin} onUpdated={handleUpdated} onRequestorSave={saveRequestor} onControlSave={saveControlNo} />

        <div className="cut-line my-5 flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
          ✂ cut here
          <span className="h-px flex-1 border-t border-dashed border-zinc-300" />
        </div>

        <FormCopy req={req} controlNo={controlNo} requestorName={requestorName} approver={approver} noted={noted} editable={isAdmin} onUpdated={handleUpdated} onRequestorSave={saveRequestor} onControlSave={saveControlNo} />
      </div>
    </div>
  );
}
