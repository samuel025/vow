import { remember } from "@/lib/memory";
import { ownedRule } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  const { ruleId, ruleName, window, weekday, reason } = await req.json();
  if (!ownedRule(ruleId, u.owner)) return Response.json({ error: "Not your vow" }, { status: 403 });
  await remember({ ruleId, ruleName, window, weekday, result: "missed", reason });
  return Response.json({ ok: true });
}
