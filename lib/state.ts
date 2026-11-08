import fs from "node:fs";
import type { NudgeStyle, Tone } from "./types";
const F = "data/state.json";
type S = Record<string, NudgeStyle>;
export const lastNudges = (): S => { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch { return {}; } };
export function setLastNudge(ruleId: string, s: NudgeStyle, t?: Tone) { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(F, JSON.stringify({ ...lastNudges(), [ruleId]: s })); if (t) { let o: Record<string, Tone> = {}; try { o = JSON.parse(fs.readFileSync(TF, "utf8")); } catch {} fs.writeFileSync(TF, JSON.stringify({ ...o, [ruleId]: t })); } }

const TF = "data/tone.json";
export const lastTone = (id: string): Tone | undefined => { try { return JSON.parse(fs.readFileSync(TF, "utf8"))[id]; } catch { return undefined; } };
