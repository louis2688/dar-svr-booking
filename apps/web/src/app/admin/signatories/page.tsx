"use client";

import { useEffect, useRef, useState } from "react";

type Signatory = { role: string; name: string; position: string; signature: string | null };

const LABELS: Record<string, string> = { APPROVER: "Approved by", NOTED_BY: "Noted by" };

/** Resize a signature image to a max width, keep aspect, return a data URL. */
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
  // PNG preserves transparency if the source has it.
  return canvas.toDataURL("image/png");
}

function SignatoryCard({ item, onSaved }: { item: Signatory; onSaved: (s: Signatory) => void }) {
  const [name, setName] = useState(item.name);
  const [position, setPosition] = useState(item.position);
  const [signature, setSignature] = useState<string | null>(item.signature);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Choose an image file." });
      return;
    }
    try {
      setSignature(await fileToSignatureDataUrl(file));
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: "Could not read that image." });
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/signatories", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: item.role, name: name.trim(), position: position.trim(), signature })
    });
    const json = (await res.json().catch(() => null)) as { message?: string; item?: Signatory } | null;
    setSaving(false);
    if (!res.ok) {
      setMsg({ ok: false, text: json?.message ?? "Could not save." });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    if (json?.item) onSaved(json.item);
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-lg font-semibold">{LABELS[item.role] ?? item.role}</div>

      <div className="mt-4 grid gap-3">
        <div>
          <label className="text-sm font-medium">Name</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Position</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Signature image</label>
          <div className="mt-1 flex items-center gap-4">
            <div className="flex h-16 w-40 items-center justify-center rounded-lg border bg-zinc-50">
              {signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signature} alt="" className="max-h-14 max-w-[150px] object-contain" />
              ) : (
                <span className="text-xs text-zinc-400">No signature</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50">
                Upload signature
              </button>
              {signature ? (
                <button type="button" onClick={() => setSignature(null)} className="text-left text-xs font-medium text-red-700 hover:underline">
                  Remove signature
                </button>
              ) : null}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">A transparent PNG works best (shows over the signature line on the form).</p>
        </div>
      </div>

      {msg ? <div className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div> : null}

      <div className="mt-4">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function SignatoriesPage() {
  const [items, setItems] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/signatories");
      const json = (await res.json().catch(() => null)) as { items?: Signatory[]; error?: string } | null;
      if (!res.ok) setError(json?.error ?? "Failed to load.");
      else setItems(json?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold">Signatories</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Names, positions, and signature images printed on the vehicle request form.
        </p>

        {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

        <div className="mt-6 grid gap-6">
          {loading ? (
            <div className="text-sm text-zinc-600">Loading...</div>
          ) : (
            items.map((it) => (
              <SignatoryCard
                key={it.role}
                item={it}
                onSaved={(s) => setItems((prev) => prev.map((p) => (p.role === s.role ? s : p)))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
