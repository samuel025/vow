import type { HabitMemory } from "./types";

const isWindow = (m: HabitMemory) => m.window !== "rule-change" && (m.result === "kept" || m.result === "missed");
const frozen = (m: HabitMemory) => m.reason?.startsWith("FREEZE");

export function streakInfo(mems: HabitMemory[]) {
  const ws = new Map<string, HabitMemory>();
  mems.filter(isWindow).forEach((m) => { const o = ws.get(m.window); if (!o || frozen(m) || o.result === "missed") ws.set(m.window, m); });
  const list = [...ws.values()].sort((a, b) => a.window.localeCompare(b.window));
  const ok = (m: HabitMemory) => m.result === "kept" || frozen(m);
  let cur = 0, best = 0, run = 0;
  for (const m of list) { run = ok(m) ? run + 1 : 0; best = Math.max(best, run); }
  for (let i = list.length - 1; i >= 0 && ok(list[i]); i--) cur++;
  const used = list.filter(frozen).length;
  const freezes = Math.max(0, Math.floor(best / 4) - used);
  const lastMiss = [...list].reverse().find((m) => m.result === "missed" && !frozen(m));
  return { current: cur, best, freezes, kept: list.filter((m) => m.result === "kept").length, total: list.length, lastMiss, list };
}
