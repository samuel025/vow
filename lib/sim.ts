import type { HabitMemory, NudgeStyle } from "./types";
import { chooseNudge } from "./nudge";

const STYLES: NudgeStyle[] = ["reminder", "firm", "accountability"];
export interface SimUser { base: number[]; boost: Record<NudgeStyle, number> } // per-weekday keep prob + per-style lift

export function randUser(rnd: () => number): SimUser {
  const best = STYLES[Math.floor(rnd() * 3)];
  return { base: Array.from({ length: 7 }, () => 0.25 + rnd() * 0.3),
    boost: { reminder: 0.05, firm: 0.05, accountability: 0.05, schedule_shift: 0, [best]: 0.35 } as Record<NudgeStyle, number> };
}
const keep = (u: SimUser, d: number, s: NudgeStyle, rnd: () => number) => rnd() < Math.min(0.97, u.base[d] + u.boost[s]);

/** Run `weeks` daily windows; policy "memory" uses chooseNudge over history, "fixed" always sends `reminder`. */
export function simulate(u: SimUser, weeks: number, policy: "memory" | "fixed", rnd: () => number) {
  const hist: HabitMemory[] = []; let kept = 0, n = weeks * 7;
  for (let i = 0; i < n; i++) {
    const day = i % 7;
    const style = policy === "fixed" ? "reminder" : (chooseNudge(hist, day).style === "schedule_shift" ? "reminder" : chooseNudge(hist, day).style);
    const k = keep(u, day, style, rnd); if (k) kept++;
    hist.push({ ruleId: "sim", ruleName: "sim", window: `d${i}`, weekday: day, result: k ? "kept" : "missed", nudge: style, simulated: true });
  }
  return { keptRate: kept / n, hist };
}
export function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
