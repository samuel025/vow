import fs from "node:fs";
import { rulesOf } from "./store";
import { recall } from "./memory";
import { levelOf, overviewFor } from "./game";

/** Social layer: handles, public/private, follows, cheers. Keyed by verified wallet (lowercase). Privacy: only names, streaks and results are ever public. */
const PF = "data/profiles.json", SF = "data/social.json";
export interface Profile { handle: string; public: boolean; at: string }
export interface Cheer { id: string; from: string; to: string; emoji: string; msg: string; at: string }
interface Social { follows: { from: string; to: string }[]; cheers: Cheer[] }

function rd<T>(f: string, d: T): T { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } }
function wr(f: string, v: unknown) { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); }
export const profiles = () => rd<Record<string, Profile>>(PF, {});
export const social = () => rd<Social>(SF, { follows: [], cheers: [] });
export const profileOf = (owner: string) => profiles()[owner];
export const byHandle = (h: string) => Object.entries(profiles()).find(([, p]) => p.handle === String(h).toLowerCase());
export const EMOJI = ["👏", "🔥", "💪", "🎉", "🫶"];

export function setProfile(owner: string, handle: string, pub: boolean): string | null {
  const h = String(handle).trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(h)) return "Handle: 3-20 letters, numbers or underscores";
  const all = profiles();
  if (Object.entries(all).some(([o, p]) => p.handle === h && o !== owner)) return "That handle is taken";
  wr(PF, { ...all, [owner]: { handle: h, public: !!pub, at: all[owner]?.at ?? new Date().toISOString() } });
  return null;
}

export function follow(from: string, to: string, on: boolean): string | null {
  if (from === to) return "You can't follow yourself";
  const s = social();
  const rest = s.follows.filter((f) => !(f.from === from && f.to === to));
  if (on) { if (rest.filter((f) => f.from === from).length >= 100) return "Following limit reached"; rest.push({ from, to }); }
  wr(SF, { ...s, follows: rest });
  return null;
}

export function cheer(from: string, to: string, emoji: string, msg: string): string | null {
  if (from === to) return "You can't cheer yourself";
  if (!EMOJI.includes(emoji)) return "Pick one of the cheer stickers";
  const s = social(), day = new Date().toISOString().slice(0, 10);
  const today = s.cheers.filter((c) => c.from === from && c.at.startsWith(day));
  if (today.filter((c) => c.to === to).length >= 3) return "That's 3 cheers for them today. Give it a rest!";
  if (today.length >= 20) return "Daily cheer limit reached";
  const clean = String(msg ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80);
  s.cheers.push({ id: crypto.randomUUID(), from, to, emoji, msg: clean, at: new Date().toISOString() });
  wr(SF, { ...s, cheers: s.cheers.slice(-2000) });
  return null;
}

/** Public-safe summary of a player: no amounts, tokens or addresses. */
export async function summaryFor(owner: string) {
  const ovs = await Promise.all(rulesOf(owner).map(async (r) => overviewFor(r, (await recall(r.id)).map((x) => x.mem), 0)));
  const xp = ovs.reduce((a, o) => a + o.xp, 0);
  const stick = new Map<string, { id: string; name: string; icon: string; color: string }>();
  ovs.forEach((o) => o.badges.filter((b) => b.earned).forEach((b) => stick.set(b.id, { id: b.id, name: b.name, icon: b.icon, color: b.color })));
  return {
    total: levelOf(xp),
    best: Math.max(0, ...ovs.map((o) => o.streak.best)),
    current: Math.max(0, ...ovs.map((o) => o.streak.current)),
    stickers: [...stick.values()],
    simulated: ovs.some((o) => o.history.some((h) => h.simulated)),
    vows: ovs.map((o) => ({ name: o.rule.name, type: o.rule.type, streak: o.streak, history: o.history.map((h) => ({ result: h.result, frozen: h.frozen })) })),
  };
}
