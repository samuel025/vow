import type { HabitMemory, NudgeStyle } from "./types";

const STYLES: NudgeStyle[] = ["reminder", "firm", "accountability", "schedule_shift"];

export interface NudgeChoice { style: NudgeStyle; reason: string; cited: HabitMemory[]; proposeShift?: number; basis: "pattern" | "exploring"; recalled: number }

export function chooseNudge(memories: HabitMemory[], weekday: number): NudgeChoice {
  const relevant = memories.filter((m) => m.nudge && (m.result === "kept" || m.result === "missed"));
  const stats = STYLES.map((s) => {
    const ms = relevant.filter((m) => m.nudge === s);
    return { s, n: ms.length, rate: ms.length ? ms.filter((m) => m.result === "kept").length / ms.length : 0, ms };
  });
  const missesByDay = new Array(7).fill(0);
  memories.filter((m) => m.result === "missed").forEach((m) => missesByDay[m.weekday]++);
  const totalMiss = missesByDay.reduce((a, b) => a + b, 0);
  const worst = missesByDay.indexOf(Math.max(...missesByDay));
  const cluster = totalMiss >= 3 && missesByDay[worst] / totalMiss >= 0.6;

  const untested = stats.find((x) => x.n < 3 && x.s !== "schedule_shift");
  if (cluster && worst === weekday && stats.find((x) => x.s === "schedule_shift")!.n < 3) {
    const cited = memories.filter((m) => m.result === "missed" && m.weekday === worst);
    return { style: "schedule_shift", proposeShift: (worst + 6) % 7, cited, basis: "pattern", recalled: memories.length,
      reason: `${cited.length} of ${totalMiss} misses fall on the same weekday, so move the window.` };
  }
  const tested = stats.filter((x) => x.n >= 3).sort((a, b) => b.rate - a.rate);
  if (!tested.length || (untested && tested[0].rate < 0.6 && relevant.length < 9))
    return { style: untested?.s ?? "reminder", cited: [], basis: "exploring", recalled: memories.length, reason: "Fewer than 3 observations for some styles, so try one not yet tested." };
  const best = tested[0];
  return { style: best.s, cited: best.ms.slice(-5), basis: "pattern", recalled: memories.length,
    reason: `${best.s} was followed by a kept window ${Math.round(best.rate * 100)}% of the time (${best.n} cases).` };
}
