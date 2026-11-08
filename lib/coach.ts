import type { HabitMemory, NudgeStyle, Tone } from "./types";
const TONES: Tone[] = ["drill", "gentle", "pirate"];

/** Pick the tone followed most often by a kept window; try an untested tone first (min 2 observations). */
export function chooseTone(mems: HabitMemory[]): { tone: Tone; why: string } {
  const st = TONES.map((t) => { const ms = mems.filter((m) => m.tone === t && (m.result === "kept" || m.result === "missed")); return { t, n: ms.length, r: ms.length ? ms.filter((m) => m.result === "kept").length / ms.length : 0 }; });
  const fresh = st.find((x) => x.n < 2);
  if (fresh) return { tone: fresh.t, why: `${fresh.t} has fewer than 2 outcomes, so it gets a try.` };
  const best = [...st].sort((a, b) => b.r - a.r)[0];
  return { tone: best.t, why: `${best.t} was followed by a kept window ${Math.round(best.r * 100)}% of the time (${best.n} cases).` };
}

const LINES: Record<Tone, Record<NudgeStyle, string>> = {
  drill: { reminder: "{h}: on the clock. Move it.", firm: "{h}: no excuses. Do it today.", accountability: "{h}: your contact gets told if you slip. Move.", schedule_shift: "{h}: you keep failing this day. New day, no excuses." },
  gentle: { reminder: "Friendly nudge about {h}.", firm: "{h} matters to you. Today would be a good day.", accountability: "{h}: maybe let a friend know so they can cheer you on.", schedule_shift: "{h} keeps landing on a hard day. Want to try a different one?" },
  pirate: { reminder: "Arr, {h} be waitin', matey.", firm: "Ye'll walk the plank if {h} stays undone!", accountability: "I'll tell the crew if {h} stays undone!", schedule_shift: "{h} be cursed on this day. Sail on another!" },
};
export const nudgeText = (tone: Tone, style: NudgeStyle, habit: string) => LINES[tone][style].replace("{h}", habit);

/** Answer a coach question from recalled records only; every claim cites its records. */
export function askCoach(q: string, mems: HabitMemory[]) {
  const ws = mems.filter((m) => m.window !== "rule-change" && (m.result === "kept" || m.result === "missed"));
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const miss = ws.filter((m) => m.result === "missed");
  if (!ws.length) return { answer: "I have no window records yet, so I can't say anything.", cited: [] as HabitMemory[] };
  if (/why|miss|fail|slip/i.test(q) && miss.length) {
    const by = new Array(7).fill(0); miss.forEach((m) => by[m.weekday]++);
    const d = by.indexOf(Math.max(...by));
    const reasons = miss.map((m) => m.reason).filter((r): r is string => !!r && !r.startsWith("rule saved"));
    const rep = reasons.length ? ` Reasons you gave: ${[...new Set(reasons)].slice(0, 3).join("; ")}.` : "";
    return { answer: `${by[d]} of ${miss.length} misses fell on ${days[d]}.${rep}`, cited: miss.slice(-5) };
  }
  const rate = Math.round((ws.filter((m) => m.result === "kept").length / ws.length) * 100);
  return { answer: `You kept ${rate}% of ${ws.length} recorded windows.`, cited: ws.slice(-5) };
}
