import { getRules, rulesOf, ownerOf } from "@/lib/store";
import { addrOf, getUser, unauthorized } from "@/lib/auth";
import { fetchSent } from "@/lib/tatum";
import { verify, windowFor } from "@/lib/verifier";
import { chooseNudge } from "@/lib/nudge";
import { recall, remember } from "@/lib/memory";
import { lastTone, lastNudges, setLastNudge } from "@/lib/state";
import { chooseTone, nudgeText } from "@/lib/coach";
import { streakInfo } from "@/lib/streak";
import { alreadyPinged, ping } from "@/lib/buddy";

/** One agent tick: fetch chain evidence, verify the latest window per rule, write memory, choose next nudge. */
async function runFor(owner: string) {
  const user = addrOf(owner);
  let txs: Awaited<ReturnType<typeof fetchSent>> = [], complete = true, error: string | undefined;
  try { txs = await fetchSent(user); } catch (e) { complete = false; error = String(e); }
  const out = [];
  for (const rule of rulesOf(owner).filter((r) => !r.paused)) {
    const w = windowFor(rule, Date.now() - 86_400_000); // last completed window
    const res = verify(rule, txs, w, user, complete);
    const past = (await recall(rule.id)).map((r) => r.mem);
    const already = past.some((m) => m.window === w.label && m.result !== "unverified");
    if (res.result !== "unverified" && !already) {
      await remember({ ruleId: rule.id, ruleName: rule.name, window: w.label, weekday: new Date(w.end - 1).getUTCDay(), result: res.result, nudge: lastNudges()[rule.id], tone: lastTone(rule.id) });
    }
    const fresh = res.result !== "unverified" && !already;
    const all = [...past, ...(fresh ? [{ ruleId: rule.id, ruleName: rule.name, window: w.label, weekday: new Date(w.end - 1).getUTCDay(), result: res.result, nudge: lastNudges()[rule.id] }] : [])];
    const nudge = chooseNudge(all, new Date(Date.now()).getUTCDay());
    const tone = chooseTone(past);
    setLastNudge(rule.id, nudge.style, tone.tone);
    const streak = streakInfo(all);
    // user-set escalation: tell the buddy on a miss (opt-in, once per window)
    let buddyPing;
    if (rule.buddy?.auto && res.result === "missed" && !alreadyPinged(rule.id, "miss", w.label)) {
      buddyPing = await ping(rule, "miss", streakInfo(past).current, w.label);
    }
    out.push({ buddyPing, rule, window: w, result: res, nudge, tone, text: nudgeText(tone.tone, nudge.style, rule.name), streak: { current: streak.current, best: streak.best, freezes: streak.freezes } });
  }
  return { error, results: out };
}

export async function POST(req: Request) {
  // poller (scripts/watch.ts): runs every wallet's checks when it presents the shared secret
  const cron = process.env.VOW_CRON_SECRET;
  if (cron && req.headers.get("x-vow-cron") === cron) {
    const owners = [...new Set(getRules().map(ownerOf).filter((o) => o && !o.startsWith("demo:")))];
    for (const o of owners) await runFor(o);
    return Response.json({ owners: owners.length });
  }
  const u = await getUser(); if (!u) return unauthorized();
  return Response.json(await runFor(u.owner));
}
