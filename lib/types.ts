export type HabitType = "recurring_save" | "spend_cap" | "quiet_hours" | "recurring_stake";
export type Result = "kept" | "missed" | "unverified";
export type Tone = "drill" | "gentle" | "pirate";
export type NudgeStyle = "reminder" | "firm" | "accountability" | "schedule_shift";

export interface Buddy {
  name: string;
  channel: "manual" | "telegram" | "webhook";
  target?: string;   // telegram chat id, or https webhook URL
  auto: boolean;     // ping automatically when a window is missed (opt-in)
}

export interface HabitRule {
  id: string;
  type: HabitType;
  name: string;
  token: string;          // coin type or "SUI"
  amount: number;         // min amount (save/stake) or max count (cap)
  destination?: string;   // address for save / cap
  weekday?: number;       // 0=Sun..6=Sat (weekly window)
  quietStart?: number;    // hour 0-23 (quiet_hours)
  quietEnd?: number;
  tzOffsetMinutes: number;
  escalation: NudgeStyle[];
  paused?: boolean;
  buddy?: Buddy;
  owner?: string;         // lowercase wallet address (or guest:<addr>); missing = the .env wallet
}

export interface Tx {
  digest: string;
  checkpoint?: string;
  timestampMs: number;
  sender: string;
  balanceChanges: { owner: string; coinType: string; amount: number }[];
  commands: string[];     // e.g. "0x3::sui_system::request_add_stake"
}

export interface Window { start: number; end: number; label: string }

export interface WindowResult {
  ruleId: string;
  window: Window;
  result: Result;
  evidence: string[];
  explain?: string;                                   // plain-English reason for the verdict
  details?: { digest: string; at: string; note: string }[]; // per-transaction evidence
  checked?: number;                                   // sent transactions inspected in the window
}

export interface HabitMemory {
  ruleId: string;
  ruleName: string;
  window: string;
  weekday: number;
  result: Result;
  reason?: string;
  nudge?: NudgeStyle;   // nudge sent BEFORE this window; this record's result is its outcome
  tone?: Tone;
  simulated?: boolean;
}
