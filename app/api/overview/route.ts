import { connection } from "next/server";
import { rulesOf } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
import { recall } from "@/lib/memory";
import { levelOf, overviewFor } from "@/lib/game";
import { pingCount } from "@/lib/buddy";

export async function GET() {
  await connection();
  const u = await getUser(); if (!u) return unauthorized();
  const rules = await Promise.all(rulesOf(u.owner).map(async (r) => overviewFor(r, (await recall(r.id)).map((x) => x.mem), pingCount(r.id))));
  const xp = rules.reduce((a, r) => a + r.xp, 0);
  return Response.json({ rules, total: levelOf(xp) });
}
