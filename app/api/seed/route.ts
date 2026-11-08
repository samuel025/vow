import fs from "node:fs";
import { rulesOf } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
import { mulberry, randUser, simulate } from "@/lib/sim";
import { allLocal } from "@/lib/memory";

/** Seeds a clearly labelled SIMULATED history into the LOCAL mirror only (never Walrus), for the first rule. */
export async function POST() {
  const u = await getUser(); if (!u) return unauthorized();
  const rule = rulesOf(u.owner)[0]; if (!rule) return Response.json({ error: "create a rule first" }, { status: 400 });
  const { hist } = simulate(randUser(mulberry(7)), 8, "memory", mulberry(11));
  const recs = hist.map((m, i) => ({ id: `sim-${i}`, created_at: new Date().toISOString(),
    mem: { ...m, ruleId: rule.id, ruleName: rule.name, window: `0sim-w${String(Math.floor(i / 7)).padStart(2, "0")}-d${i % 7}`, simulated: true },
    text: "" }));
  recs.forEach((r) => (r.text = "VOW_HABIT(SIMULATED) " + JSON.stringify(r.mem)));
  fs.writeFileSync("data/memory.mock.json", JSON.stringify([...allLocal(), ...recs], null, 2));
  return Response.json({ seeded: recs.length });
}
