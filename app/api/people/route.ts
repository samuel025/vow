import { connection } from "next/server";
import { getUser } from "@/lib/auth";
import { profiles, social, summaryFor } from "@/lib/social";

export async function GET() {
  await connection();
  const u = await getUser();
  const v = u?.verified ? u : null;
  const P = profiles(), S = social();
  const sums = await Promise.all(Object.entries(P).filter(([, p]) => p.public).map(async ([o, p]) => ({ o, p, s: await summaryFor(o) })));
  const board = sums.map(({ o, p, s }) => ({
    handle: p.handle, total: s.total, best: s.best, current: s.current, stickers: s.stickers.length, vows: s.vows.length, simulated: s.simulated,
    followers: S.follows.filter((f) => f.to === o).length, following: !!v && S.follows.some((f) => f.from === v.owner && f.to === o), me: v?.owner === o,
  })).sort((a, b) => b.total.xp - a.total.xp);
  const followed = new Set(v ? S.follows.filter((f) => f.from === v.owner).map((f) => f.to) : []);
  const feed = sums.filter((x) => followed.has(x.o)).flatMap(({ p, s }) => s.vows.map((w) => ({ handle: p.handle, vow: w.name, streak: w.streak.current, last: w.history.at(-1)?.result ?? null })));
  const inbox = v ? S.cheers.filter((c) => c.to === v.owner).slice(-20).reverse().map((c) => ({ id: c.id, emoji: c.emoji, msg: c.msg, at: c.at, from: P[c.from]?.handle ?? "someone" })) : [];
  return Response.json({ me: v ? { handle: P[v.owner]?.handle ?? null, public: P[v.owner]?.public ?? false } : null, signedIn: !!u, board, feed, inbox });
}
