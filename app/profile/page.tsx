"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { InatConnect } from "@/components/InatConnect";
import { Lightbox } from "@/components/Lightbox";
import { NotificationsCard } from "@/components/NotificationsCard";
import { RevealCode } from "@/components/RevealCode";
import { useUserCode } from "@/lib/useUserCode";

export default function SettingsPage() {
  const { code, username, hasPassword, loading, setCode, setUsername, setHasPassword } =
    useUserCode();
  const [input, setInput] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [needPwForCode, setNeedPwForCode] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  // password protection
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  // server-stored nickname (null until loaded)
  const [serverNick, setServerNick] = useState<string | null>(null);
  const [nickDraft, setNickDraft] = useState<string | null>(null);
  const [nickSaved, setNickSaved] = useState(false);
  const [nickErr, setNickErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/user?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAvatarUrl(d.avatarUrl);
        setServerNick(d.nickname ?? null);
      });
  }, [code]);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !code) return;
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("code", code);
      const res = await fetch("/api/user/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) setAvatarUrl(data.avatarUrl);
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!code) return;
    setAvatarBusy(true);
    try {
      await fetch("/api/user/avatar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setAvatarUrl(null);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function savePassword(remove: boolean) {
    if (!code) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password: remove ? "" : pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setHasPassword(!!data.hasPassword);
      setPw("");
      setPwMsg(remove ? "Password removed." : "Password set.");
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setPwBusy(false);
    }
  }

  // null = not edited yet → show whatever the server has
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? username ?? "";
  const [nameSaved, setNameSaved] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setNameErr(null);
    setNameSaved(false);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, username: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setUsername(data.username);
      setNameDraft(null);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
      setNameErr(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  const nick = nickDraft ?? serverNick ?? "";

  async function saveNick(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setNickErr(null);
    setNickSaved(false);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, nickname: nick }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setServerNick(data.nickname ?? null);
      setNickDraft(null);
      setNickSaved(true);
      setTimeout(() => setNickSaved(false), 2000);
    } catch (e) {
      setNickErr(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/?code=${code}`;
    QRCode.toDataURL(url, { width: 260, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const res = await setCode(input, inputPw || undefined);
      setInput("");
      setInputPw("");
      setNeedPwForCode(false);
      setMsg(
        res.created
          ? `New empty log created for ${res.code}.`
          : `Switched to ${res.code}.`,
      );
    } catch (e) {
      if ((e as { needsPassword?: boolean }).needsPassword) {
        setNeedPwForCode(true);
        setErr(inputPw ? "Wrong password." : null);
      } else {
        setErr(e instanceof Error ? e.message : "Could not use that code");
      }
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted">
          Your login code is the key to your log. There&apos;s no recovery if
          you lose it — save it somewhere safe.
        </p>
      </header>

      <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        {avatarUrl ? (
          <button
            type="button"
            onClick={() => setAvatarZoom(true)}
            aria-label="View photo"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt="Your photo"
              className="h-16 w-16 rounded-full object-cover"
            />
          </button>
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-border text-2xl">
            👤
          </div>
        )}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Photo</h2>
          <p className="text-xs text-muted">Shown to your friends.</p>
          <div className="flex gap-3 pt-1 text-sm font-medium">
            <button
              onClick={() => avatarInput.current?.click()}
              disabled={avatarBusy}
              className="text-accent disabled:opacity-50"
            >
              {avatarBusy ? "…" : avatarUrl ? "Change" : "Upload"}
            </button>
            {avatarUrl && (
              <button
                onClick={removeAvatar}
                disabled={avatarBusy}
                className="text-muted disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={uploadAvatar}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Profile name</h2>
            <p className="text-xs text-muted">
              What friends see. Doesn&apos;t have to be unique.
            </p>
          </div>
          <form onSubmit={saveName} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder=""
              maxLength={24}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={name.trim() === (username ?? "")}
              className="rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {nameSaved ? "Saved ✓" : "Save"}
            </button>
          </form>
          {nameErr && (
            <p className="text-sm text-red-600 dark:text-red-400">{nameErr}</p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-semibold">Nickname</h2>
            <p className="text-xs text-muted">
              Optional. Shown in parentheses after your profile name
              {name.trim() ? (
                <>
                  {" "}
                  — friends see{" "}
                  <span className="font-medium text-foreground">
                    {name.trim()}
                    {nick.trim() ? ` (${nick.trim()})` : ""}
                  </span>
                </>
              ) : (
                "."
              )}
            </p>
          </div>
          <form onSubmit={saveNick} className="flex gap-2">
            <input
              value={nick}
              onChange={(e) => setNickDraft(e.target.value)}
              placeholder=""
              maxLength={16}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={nick.trim() === (serverNick ?? "")}
              className="rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {nickSaved ? "Saved ✓" : "Save"}
            </button>
          </form>
          {nickErr && (
            <p className="text-sm text-red-600 dark:text-red-400">{nickErr}</p>
          )}
        </div>
      </section>

      <NotificationsCard code={code} />

      <RevealCode
        value={code}
        loading={loading}
        label="Your log code"
        qr={qr}
        qrAlt="QR code for your log"
        helpText="Screenshot this QR, or copy the code. Scanning it on another phone opens your log there."
        note="Anyone with this code has full access to your log. Keep it private."
        autoHideSeconds={30}
      />

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Open a different log</h2>
        <form onSubmit={apply} className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="MOTH-XXXXXX"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
          />
          {needPwForCode && (
            <input
              type="password"
              autoFocus
              value={inputPw}
              onChange={(e) => setInputPw(e.target.value)}
              placeholder="Password for that log"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}
          <button
            type="submit"
            disabled={!input.trim() || (needPwForCode && !inputPw)}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Use this code
          </button>
        </form>
        {msg && <p className="text-sm text-accent">{msg}</p>}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <p className="text-xs text-muted">
          Switching changes which log this device shows. Your current log stays
          safe under its own code.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">
          Password {hasPassword && <span className="text-accent">· on</span>}
        </h2>
        <p className="text-xs text-muted">
          Optional. Asked only when your code is first used on a new device —
          never when opening the app on a device you&apos;ve already used.
        </p>
        {!hasPassword ? (
          <div className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => savePassword(false)}
              disabled={pw.length < 4 || pwBusy}
              className="rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              Set
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => savePassword(false)}
              disabled={pw.length < 4 || pwBusy}
              className="rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
            >
              Change
            </button>
            <button
              onClick={() => savePassword(true)}
              disabled={pwBusy}
              className="rounded-xl border border-border px-3 text-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-400"
            >
              Remove
            </button>
          </div>
        )}
        {pwMsg && <p className="text-sm text-accent">{pwMsg}</p>}
      </section>

      <InatConnect code={code} />

      {avatarZoom && avatarUrl && (
        <Lightbox
          src={avatarUrl}
          alt="Your photo"
          onClose={() => setAvatarZoom(false)}
        />
      )}
    </div>
  );
}
