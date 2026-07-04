"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Me = { id: string; name: string | null; email: string | null; image: string | null; role: string };

/** Smallest allowed source dimension — rejects tiny/blurry uploads. */
const MIN_SOURCE_PX = 200;

/** Resize + center-crop an image file to a square data URL (keeps stored avatar small). */
async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  if (Math.min(bitmap.width, bitmap.height) < MIN_SOURCE_PX) {
    throw new Error(`Image is too small — use at least ${MIN_SOURCE_PX}×${MIN_SOURCE_PX}px.`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  const ratio = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * ratio;
  const h = bitmap.height * ratio;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function initialsOf(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  return src.slice(0, 1).toUpperCase();
}

export default function ProfilePage() {
  const { update } = useSession();

  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailVerifyUrl, setEmailVerifyUrl] = useState<string | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile");
      const json = (await res.json().catch(() => null)) as { user?: Me } | null;
      if (json?.user) {
        setMe(json.user);
        setName(json.user.name ?? "");
        setImage(json.user.image ?? null);
        setEmailInput(json.user.email ?? "");
      }
    })();
  }, []);

  async function changeEmail() {
    setEmailMsg(null);
    setEmailVerifyUrl(null);
    const next = emailInput.trim().toLowerCase();
    if (!next || next === (me?.email ?? "").toLowerCase()) {
      setEmailMsg({ ok: false, text: "Enter a different email." });
      return;
    }
    setSavingEmail(true);
    const res = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: next })
    });
    const json = (await res.json().catch(() => null)) as
      | { message?: string; fallbackVerificationUrl?: string }
      | null;
    setSavingEmail(false);
    if (!res.ok) {
      setEmailMsg({ ok: false, text: json?.message ?? "Could not update email." });
      return;
    }
    setMe((m) => (m ? { ...m, email: next } : m));
    setEmailMsg({ ok: true, text: json?.message ?? "Email updated. Verify the new address." });
    if (json?.fallbackVerificationUrl) setEmailVerifyUrl(json.fallbackVerificationUrl);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileMsg({ ok: false, text: "Please choose an image file." });
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setImage(dataUrl);
      setProfileMsg(null);
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Could not read that image." });
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), image })
    });
    const json = (await res.json().catch(() => null)) as { message?: string; user?: Me } | null;
    setSavingProfile(false);
    if (!res.ok) {
      setProfileMsg({ ok: false, text: json?.message ?? "Could not save profile." });
      return;
    }
    setProfileMsg({ ok: true, text: "Profile saved." });
    // Refresh the JWT so the shell avatar/name update without re-login.
    await update({ name: name.trim(), image });
  }

  async function changePassword() {
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    setSavingPw(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw })
    });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    setSavingPw(false);
    if (!res.ok) {
      setPwMsg({ ok: false, text: json?.message ?? "Could not change password." });
      return;
    }
    setPwMsg({ ok: true, text: "Password updated." });
    setCurPw("");
    setNewPw("");
    setConfirmPw("");
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-6 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold">Profile settings</h1>
        <p className="mt-1 text-sm text-zinc-600">Update your name, photo, and password.</p>

        {/* Profile card */}
        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-2xl font-bold text-white">
                  {initialsOf(name, me?.email ?? null)}
                </span>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Change photo
                </button>
                {image ? (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="text-left text-xs font-medium text-red-700 hover:underline"
                  >
                    Remove photo
                  </button>
                ) : null}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          {profileMsg ? (
            <div className={`mt-3 text-sm ${profileMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{profileMsg.text}</div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {savingProfile ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        {/* Email card */}
        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="text-lg font-semibold">Email address</div>
          <p className="mt-1 text-sm text-zinc-600">
            Your email is your sign-in ID. Changing it requires verifying the new address.
          </p>
          <div className="mt-4">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          {emailMsg ? (
            <div className={`mt-3 text-sm ${emailMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{emailMsg.text}</div>
          ) : null}
          {emailVerifyUrl ? (
            <a
              href={emailVerifyUrl}
              className="mt-3 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Verify new email
            </a>
          ) : null}
          <div className="mt-4">
            <button
              type="button"
              onClick={changeEmail}
              disabled={savingEmail || !emailInput.trim() || emailInput.trim().toLowerCase() === (me?.email ?? "").toLowerCase()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {savingEmail ? "Updating..." : "Update email"}
            </button>
          </div>
        </div>

        {/* Change password card */}
        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="text-lg font-semibold">Change password</div>
          <p className="mt-1 text-sm text-zinc-600">Enter your current password, then a new one.</p>
          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-sm font-medium">Current password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Confirm new password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {pwMsg ? (
            <div className={`mt-3 text-sm ${pwMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{pwMsg.text}</div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              onClick={changePassword}
              disabled={savingPw || !curPw || !newPw || !confirmPw}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {savingPw ? "Updating..." : "Update password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
