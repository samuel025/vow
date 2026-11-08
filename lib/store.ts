import fs from "node:fs";
import type { HabitRule } from "./types";
const F = "data/rules.json";
export function getRules(): HabitRule[] { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch { return []; } }
export function setRules(r: HabitRule[]) { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(F, JSON.stringify(r, null, 2)); }
export const ownerOf = (r: HabitRule) => (r.owner ?? process.env.SUI_ADDRESS ?? "").toLowerCase();
export const rulesOf = (owner: string) => getRules().filter((r) => ownerOf(r) === owner);
export const ownedRule = (id: string, owner: string) => getRules().find((r) => r.id === id && ownerOf(r) === owner);
