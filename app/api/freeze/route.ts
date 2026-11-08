import { recall, remember } from "@/lib/memory";
import { streakInfo } from "@/lib/streak";
import { ownedRule } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  const { ruleId } = await req.json();
  if (!ownedRule(ruleId, u.owner)) return Response.json({ error: "Not your vow" }, { status: 403 });
  const s = streakInfo((await recall(ruleId)).map((r) => r.mem));
  if (!s.freezes || !s.lastMiss) return Response.json({ error: "no freeze available or nothing to forgive" }, { status: 400 });
  await remember({ ...s.lastMiss, result: "kept", reason: "FREEZE used to forgive a miss", nudge: undefined, tone: undefined });
  return Response.json({ ok: true });
}
