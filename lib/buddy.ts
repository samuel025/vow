import fs from "node:fs";
import type { HabitRule } from "./types";

const F = "data/outbox.json";
export type Kind = "test" | "miss" | "ask";
export interface Ping {
  id: string; at: string; ruleId: string; ruleName: string; buddy: string; kind: Kind; window?: string;
  text: string; status: "sent" | "preview" | "failed"; detail: string; links?: { telegram: string; whatsapp: string; email: string };
}

export const outbox = (): Ping[] => { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch { return []; } };
const saveOutbox = (p: Ping[]) => { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(F, JSON.stringify(p.slice(-200), null, 2)); };
export const pingCount = (ruleId: string) => outbox().filter((p) => p.ruleId === ruleId).length;
export const alreadyPinged = (ruleId: string, kind: Kind, window: string) => outbox().some((p) => p.ruleId === ruleId && p.kind === kind && p.window === window);

/** Privacy by design: habit name, result and streak only. Never amounts, tokens or addresses. */
export function message(rule: HabitRule, kind: Kind, streak: number, window?: string) {
  const me = process.env.VOW_OWNER_NAME || "Your friend";
  const b = rule.buddy!.name;
  if (kind === "test") return `Hi ${b}! ${me} picked you as their Vow accountability buddy for "${rule.name}". You'll only hear about misses and check-ins, never amounts or addresses.`;
  if (kind === "miss") return `${me} missed "${rule.name}" for the ${window} window${streak ? ` (their streak was ${streak})` : ""}. A quick "you've got this" would help.`;
  return `${me} is working on "${rule.name}" (streak ${streak}). Hold them to it this week?`;
}

/** Server-side fetches of user-supplied URLs: https only, no local or private hosts. */
export function safeWebhook(u: string) {
  try {
    const x = new URL(u); const h = x.hostname.toLowerCase();
    if (x.protocol !== "https:") return false;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "::1" || h.startsWith("[")) return false;
    return true;
  } catch { return false; }
}

export async function ping(rule: HabitRule, kind: Kind, streak: number, window?: string): Promise<Ping> {
  const b = rule.buddy!;
  const text = message(rule, kind, streak, window);
  const e = encodeURIComponent(text);
  const base: Ping = { id: crypto.randomUUID(), at: new Date().toISOString(), ruleId: rule.id, ruleName: rule.name, buddy: b.name, kind, window, text, status: "preview", detail: "No delivery channel configured; saved as a preview.",
    links: { telegram: `https://t.me/share/url?url=%20&text=${e}`, whatsapp: `https://wa.me/?text=${e}`, email: `mailto:?subject=${encodeURIComponent("Vow check-in")}&body=${e}` } };
  try {
    if (b.channel === "telegram" && b.target) {
      const tok = process.env.TELEGRAM_BOT_TOKEN;
      if (!tok) base.detail = "Set TELEGRAM_BOT_TOKEN to deliver via Telegram; saved as a preview.";
      else {
        const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: b.target, text }) });
        base.status = r.ok ? "sent" : "failed"; base.detail = r.ok ? "Delivered via Telegram." : `Telegram ${r.status}: the buddy must message the bot first.`;
      }
    } else if (b.channel === "webhook" && b.target) {
      if (!safeWebhook(b.target)) { base.status = "failed"; base.detail = "Webhook must be a public https URL."; }
      else {
        const r = await fetch(b.target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: text, text }) });
        base.status = r.ok ? "sent" : "failed"; base.detail = r.ok ? "Delivered to webhook." : `Webhook responded ${r.status}.`;
      }
    } else base.detail = "Share it yourself with the buttons below.";
  } catch (err) { base.status = "failed"; base.detail = String(err); }
  saveOutbox([...outbox(), base]);
  return base;
}
