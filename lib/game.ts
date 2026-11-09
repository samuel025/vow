import type { HabitMemory, HabitRule } from "./types";
import { streakInfo } from "./streak";

const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
export const TITLES = ["Rookie", "Saver", "Streaker", "Habit Hero", "Vow Master", "Legend"];

export function levelOf(xp: number) {
  const lvl = Math.floor(Math.sqrt(xp / 40));
  const floor = lvl * lvl * 40, ceil = (lvl + 1) * (lvl + 1) * 40;
  return { level: lvl + 1, title: TITLES[Math.min(lvl, TITLES.length - 1)], into: xp - floor, span: ceil - floor, xp };
}

export interface Badge { id: string; name: string; hint: string; icon: string; color: string; earned: boolean }

export function badgesFor(rule: HabitRule, mems: HabitMemory[], pings = 0): Badge[] {
  const s = streakInfo(mems);
  const g = ghostFor(s.list);
  const kept = (m: HabitMemory) => m.result === "kept";
  const comeback = s.list.some((m, i) => i > 0 && s.list[i - 1].result === "missed" && kept(m));
  const honest = mems.some((m) => m.reason && !m.reason.startsWith("rule saved") && !m.reason.startsWith("FREEZE"));
  const froze = mems.some((m) => m.reason?.startsWith("FREEZE"));
  const typed: Badge = rule.type === "quiet_hours"
    ? { id: "night_owl", name: "Night Owl Tamed", hint: "Keep 3 quiet-hours windows", icon: "🦉", color: "#d4efd9", earned: s.kept >= 3 }
    : rule.type === "recurring_stake"
    ? { id: "staker", name: "Steady Staker", hint: "Keep 3 stake windows", icon: "🪙", color: "#ffc2d6", earned: s.kept >= 3 }
    : rule.type === "spend_cap"
    ? { id: "capped", name: "Cap Keeper", hint: "Stay under your cap 3 times", icon: "🧢", color: "#55db9c", earned: s.kept >= 3 }
    : { id: "saver", name: "Piggy Pro", hint: "Keep 3 saving windows", icon: "🐷", color: "#55db9c", earned: s.kept >= 3 };
  return [
    { id: "first", name: "First Win", hint: "Keep your first window", icon: "🚀", color: "#e8412c", earned: s.kept >= 1 },
    { id: "hat", name: "Hat-trick", hint: "3 kept in a row", icon: "🎩", color: "#7c5cff", earned: s.best >= 3 },
    { id: "fire", name: "On Fire", hint: "7 kept in a row", icon: "🔥", color: "#e8412c", earned: s.best >= 7 },
    { id: "comeback", name: "Comeback Kid", hint: "Keep a window right after a miss", icon: "💪", color: "#ffc2d6", earned: comeback },
    { id: "honest", name: "Honest Abe", hint: "Tell the coach why you missed", icon: "🗣️", color: "#d4efd9", earned: honest },
    { id: "ice", name: "Ice Cold", hint: "Use a streak freeze", icon: "🧊", color: "#ffe0cc", earned: froze },
    { id: "squad", name: "Squad Goals", hint: "Bring a buddy in on a habit", icon: "🤝", color: "#7c5cff", earned: !!rule.buddy && pings > 0 },
    { id: "ghost", name: "Ghostbuster", hint: "Beat your previous stretch in the ghost race", icon: "👻", color: "#d4efd9", earned: g?.status === "ahead" },
    typed,
  ];
}

export interface Ghost { n: number; me: Cell[]; ghost: Cell[]; meKept: number; ghostKept: number; meLabel: string; ghostLabel: string; status: "ahead" | "behind" | "tied" }
type Cell = { window: string; ok: boolean };

/** Your latest N windows race the N windows before them, rebuilt from memory. Needs at least 6 windows of history. */
export function ghostFor(list: HabitMemory[]): Ghost | null {
  const n = Math.min(8, Math.floor(list.length / 2));
  if (n < 3) return null;
  const cell = (m: HabitMemory): Cell => ({ window: m.window, ok: m.result === "kept" || !!m.reason?.startsWith("FREEZE") });
  const me = list.slice(-n).map(cell), ghost = list.slice(-2 * n, -n).map(cell);
  const meKept = me.filter((c) => c.ok).length, ghostKept = ghost.filter((c) => c.ok).length;
  const fmt = (c: Cell[]) => `${c[0].window.replace(/^0sim-/, "")} → ${c[c.length - 1].window.replace(/^0sim-/, "")}`;
  return { n, me, ghost, meKept, ghostKept, meLabel: fmt(me), ghostLabel: fmt(ghost), status: meKept > ghostKept ? "ahead" : meKept < ghostKept ? "behind" : "tied" };
}

export function questFor(mems: HabitMemory[]) {
  const s = streakInfo(mems);
  const miss = s.list.filter((m) => m.result === "missed" && !m.reason?.startsWith("FREEZE"));
  const by = new Array(7).fill(0); miss.forEach((m) => by[m.weekday]++);
  const d = by.indexOf(Math.max(...by));
  if (by[d] >= 2) return { title: `Beat your ${DAYS[d].slice(0, -1)} record`, detail: `${by[d]} of your ${miss.length} misses land on ${DAYS[d]}. Keep the next one.`, reward: 25 };
  return { title: `Reach a ${s.current + 1}-window streak`, detail: s.current ? `You're on ${s.current}. One more keeps the flame alive.` : "Keep the next window to start a flame.", reward: 15 };
}

export function overviewFor(rule: HabitRule, mems: HabitMemory[], pings = 0) {
  const s = streakInfo(mems);
  const badges = badgesFor(rule, mems, pings);
  const ghost = ghostFor(s.list);
  const xp = s.kept * 10 + s.best * 2 + badges.filter((b) => b.earned).length * 20 + (ghost?.status === "ahead" ? 30 : 0);
  return {
    rule,
    streak: { current: s.current, best: s.best, freezes: s.freezes, kept: s.kept, total: s.total },
    history: s.list.slice(-7).map((m) => ({ window: m.window, result: m.result, frozen: !!m.reason?.startsWith("FREEZE"), simulated: !!m.simulated })),
    badges, pings, xp, ghost, quest: questFor(mems), lastMiss: s.lastMiss ? { window: s.lastMiss.window } : null,
  };
}
