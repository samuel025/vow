import { connection } from "next/server";
import { ownedRule, rulesOf } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
import { recall } from "@/lib/memory";
import { streakInfo } from "@/lib/streak";
import { outbox, ping, type Kind } from "@/lib/buddy";

export async function GET() {
  await connection();
  const u = await getUser(); if (!u) return unauthorized();
  const mine = new Set(rulesOf(u.owner).map((r) => r.id));
  return Response.json(outbox().filter((p) => mine.has(p.ruleId)).slice(-20).reverse());
}

export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  const { ruleId, kind } = (await req.json()) as { ruleId: string; kind: Kind };
  const rule = ownedRule(ruleId, u.owner);
  if (!rule?.buddy) return Response.json({ error: "Add a buddy to this vow first" }, { status: 400 });
  if (kind !== "test" && kind !== "ask") return Response.json({ error: "Unsupported ping" }, { status: 400 });
  const s = streakInfo((await recall(ruleId)).map((r) => r.mem));
  return Response.json(await ping(rule, kind, s.current));
}
