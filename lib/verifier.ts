import type { HabitRule, Tx, Window, WindowResult } from "./types";
import { normCoin } from "./tatum";

const DAY = 86_400_000;

/** Weekly window ending at `now`'s week boundary in the rule's timezone (Mon-start weeks are overkill; use rolling 7 days ending on the rule weekday). */
export function windowFor(rule: HabitRule, anchorMs: number): Window {
  const off = rule.tzOffsetMinutes * 60_000;
  if (rule.type === "quiet_hours") {
    const local = anchorMs + off;
    const dayStart = Math.floor(local / DAY) * DAY - off;
    return { start: dayStart, end: dayStart + DAY, label: new Date(dayStart + off).toISOString().slice(0, 10) };
  }
  const local = anchorMs + off;
  const dayStart = Math.floor(local / DAY) * DAY - off;
  const dow = new Date(local).getUTCDay();
  const target = rule.weekday ?? 5;
  const daysBack = (dow - target + 7) % 7;
  const end = dayStart - daysBack * DAY + DAY; // end of the target weekday
  const start = end - 7 * DAY;
  return { start, end, label: new Date(end - DAY + off).toISOString().slice(0, 10) };
}

const inWin = (t: Tx, w: Window) => t.timestampMs >= w.start && t.timestampMs < w.end;
const norm = (a?: string) => (a ?? "").toLowerCase();
/** Raw chain units per 1 token: SUI = 1e9, USDC/USDT-style = 1e6. */
export const unit = (token: string) => (token === "SUI" ? 1e9 : /usdc|usdt/i.test(token) ? 1e6 : 1e9);
const matchCoin = (rule: HabitRule, c: string) =>
  rule.token === "SUI" ? c === "0x2::sui::SUI" : normCoin(c) === normCoin(rule.token);

export function verify(rule: HabitRule, txs: Tx[], w: Window, user: string, complete = true): WindowResult {
  const sent = txs.filter((t) => norm(t.sender) === norm(user) && inWin(t, w));
  const base = { ruleId: rule.id, window: w };
  switch (rule.type) {
    case "recurring_save": {
      const hits = sent.filter((t) =>
        t.balanceChanges.some((b) => norm(b.owner) === norm(rule.destination) && matchCoin(rule, b.coinType) && b.amount >= rule.amount * unit(rule.token)));
      if (hits.length) return { ...base, result: "kept", evidence: hits.map((t) => t.digest) };
      return { ...base, result: complete ? "missed" : "unverified", evidence: [] };
    }
    case "spend_cap": {
      const hits = sent.filter((t) => t.balanceChanges.some((b) => norm(b.owner) === norm(rule.destination) && b.amount > 0));
      return { ...base, result: hits.length <= rule.amount ? (complete ? "kept" : "unverified") : "missed", evidence: hits.map((t) => t.digest) };
    }
    case "quiet_hours": {
      const off = rule.tzOffsetMinutes * 60_000;
      const s = rule.quietStart ?? 0, e = rule.quietEnd ?? 5;
      const bad = sent.filter((t) => {
        const h = new Date(t.timestampMs + off).getUTCHours();
        return s <= e ? h >= s && h < e : h >= s || h < e;
      });
      if (bad.length) return { ...base, result: "missed", evidence: bad.map((t) => t.digest) };
      return { ...base, result: complete ? "kept" : "unverified", evidence: [] };
    }
    case "recurring_stake": {
      const hits = sent.filter((t) => t.commands.some((c) => c.includes("request_add_stake")));
      if (hits.length) return { ...base, result: "kept", evidence: hits.map((t) => t.digest) };
      return { ...base, result: complete ? "missed" : "unverified", evidence: [] };
    }
  }
}
