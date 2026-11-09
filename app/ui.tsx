"use client";
import { useState } from "react";

export async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j;
}

export function Btn({ busy, children, fill, ...p }: { busy?: boolean; fill?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} aria-busy={busy} disabled={busy || p.disabled} className={`btn ${fill ? "btn-fill" : ""} ${p.className ?? ""}`}>{busy && <span className="spin" />}{children}</button>;
}

export function Sticker({ icon, color, size = 48, title }: { icon: string; color: string; size?: number; title?: string }) {
  return <span title={title} className="sticker" style={{ background: color, width: size, height: size, fontSize: size * 0.5 }}>{icon}</span>;
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const say = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 4000); };
  const node = toast && <div role="status" className="fixed right-4 top-14 z-50 pill px-4 py-2 text-sm" style={{ background: toast.err ? "#e8412c" : "#ffc2d6" }}>{toast.msg}</div>;
  return { say, node };
}

/** busy-flag wrapper so every button shows a spinner while its request runs */
export function useAct(say: (m: string, e?: boolean) => void) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); if (ok) say(ok); } catch (e: any) { say(e.message ?? String(e), true); }
    setBusy((b) => ({ ...b, [key]: false }));
  };
  return { busy, act };
}
