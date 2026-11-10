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

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "?");
const fmtAmt = (raw: number, token: string) => `${+(raw / unit(token)).toFixed(4)} ${token === "SUI" ? "SUI" : token.split("::").pop()}`;

export function verify(rule: HabitRule, txs: Tx[], w: Window, user: string, complete = true): WindowResult {
  const sent = txs.filter((t) => norm(t.sender) === norm(user) && inWin(t, w));
  const off = rule.tzOffsetMinutes * 60_000;
  const local = (ms: number) => new Date(ms + off).toISOString().slice(0, 16).replace("T", " ");
  const span = `${local(w.start)} → ${local(w.end)} (UTC${rule.tzOffsetMinutes >= 0 ? "+" : ""}${rule.tzOffsetMinutes / 60})`;
  const base = { ruleId: rule.id, window: w, checked: sent.length };
  const cant = { ...base, result: "unverified" as const, evidence: [], explain: `Couldn't fetch chain data for ${span}, so this window can't be judged. It is not counted as a miss.` };
  const tok = rule.token === "SUI" ? "SUI" : rule.token.split("::").pop();
  switch (rule.type) {
    case "recurring_save": {
      const got = (t: Tx) => t.balanceChanges.find((b) => norm(b.owner) === norm(rule.destination) && matchCoin(rule, b.coinType) && b.amount >= rule.amount * unit(rule.token));
      const hits = sent.filter(got);
      if (hits.length) return { ...base, result: "kept", evidence: hits.map((t) => t.digest),
        details: hits.map((t) => ({ digest: t.digest, at: local(t.timestampMs), note: `${fmtAmt(got(t)!.amount, rule.token)} received by ${short(rule.destination)}` })),
        explain: `Rule: at least ${rule.amount} ${tok} from your wallet to ${short(rule.destination)} during ${span}. Found ${hits.length} qualifying transaction(s).` };
      if (!complete) return cant;
      return { ...base, result: "missed", evidence: [], explain: `Rule: at least ${rule.amount} ${tok} to ${short(rule.destination)} during ${span}. Checked ${sent.length} transaction(s) sent from your wallet in that window; none delivered enough.` };
    }
    case "spend_cap": {
      const hits = sent.filter((t) => t.balanceChanges.some((b) => norm(b.owner) === norm(rule.destination) && b.amount > 0));
      const details = hits.map((t) => ({ digest: t.digest, at: local(t.timestampMs), note: `send to ${short(rule.destination)}` }));
      if (hits.length > rule.amount) return { ...base, result: "missed", evidence: hits.map((t) => t.digest), details, explain: `Rule: at most ${rule.amount} send(s) to ${short(rule.destination)} during ${span}. Found ${hits.length}.` };
      if (!complete) return cant;
      return { ...base, result: "kept", evidence: hits.map((t) => t.digest), details, explain: `Rule: at most ${rule.amount} send(s) to ${short(rule.destination)} during ${span}. Found ${hits.length}, within the cap. Only this wallet is visible to Vow.` };
    }
    case "quiet_hours": {
      const s = rule.quietStart ?? 0, e = rule.quietEnd ?? 5;
      const bad = sent.filter((t) => {
        const h = new Date(t.timestampMs + off).getUTCHours();
        return s <= e ? h >= s && h < e : h >= s || h < e;
      });
      if (bad.length) return { ...base, result: "missed", evidence: bad.map((t) => t.digest),
        details: bad.map((t) => ({ digest: t.digest, at: local(t.timestampMs), note: `sent inside quiet hours` })),
        explain: `Rule: no transactions sent from your wallet between ${s}:00 and ${e}:00 on ${w.label}. Found ${bad.length}.` };
      if (!complete) return cant;
      return { ...base, result: "kept", evidence: [], explain: `Rule: nothing sent between ${s}:00 and ${e}:00 on ${w.label}. Checked ${sent.length} transaction(s) that day; none fell in quiet hours.` };
    }
    case "recurring_stake": {
      const hits = sent.filter((t) => t.commands.some((c) => c.includes("request_add_stake")));
      if (hits.length) return { ...base, result: "kept", evidence: hits.map((t) => t.digest),
        details: hits.map((t) => ({ digest: t.digest, at: local(t.timestampMs), note: "0x3::sui_system::request_add_stake call" })),
        explain: `Rule: a staking call (request_add_stake) from your wallet during ${span}. Found ${hits.length}.` };
      if (!complete) return cant;
      return { ...base, result: "missed", evidence: [], explain: `Rule: a staking call during ${span}. Checked ${sent.length} transaction(s); none called request_add_stake.` };
    }
  }
}
