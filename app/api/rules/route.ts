import { getRules, setRules, rulesOf, ownerOf } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
import { remember } from "@/lib/memory";
import { safeWebhook } from "@/lib/buddy";
import type { HabitRule } from "@/lib/types";

export async function GET() { const u = await getUser(); if (!u) return unauthorized(); return Response.json(rulesOf(u.owner)); }

export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  const rule = (await req.json()) as HabitRule;
  rule.id ||= crypto.randomUUID();
  if (getRules().some((r) => r.id === rule.id && ownerOf(r) !== u.owner)) return Response.json({ error: "Not your vow" }, { status: 403 });
  rule.owner = u.owner;
  if (rule.buddy) {
    const b = rule.buddy;
    if (!b.name?.trim()) delete rule.buddy;
    else if (b.channel === "webhook" && !safeWebhook(b.target ?? "")) return Response.json({ error: "Webhook must be a public https URL" }, { status: 400 });
    else if (b.channel === "telegram" && !/^(-?\d+|@\w{4,})$/.test(b.target ?? "")) return Response.json({ error: "Telegram target must be a chat id or @username" }, { status: 400 });
    else if (b.channel === "manual") delete b.target;
  }
  setRules([...getRules().filter((r) => r.id !== rule.id), rule]);
  await remember({ ruleId: rule.id, ruleName: rule.name, window: "rule-change", weekday: rule.weekday ?? 0, result: "unverified", reason: `rule saved: ${rule.type}` });
  return Response.json(rule);
}

export async function DELETE(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  const { id } = await req.json();
  setRules(getRules().filter((r) => !(r.id === id && ownerOf(r) === u.owner)));
  return Response.json({ ok: true });
}
