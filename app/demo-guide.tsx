"use client";
import { useState } from "react";
import { Btn } from "./ui";

interface Step { icon: string; title: string; what: string; target?: string; href?: string; action?: "seed" | "tick"; actionLabel?: string }

const STEPS: Step[] = [
  { icon: "🌱", title: "Seed some history", target: "#habits", action: "seed", actionLabel: "SEED HISTORY",
    what: "Fills the vow with 8 weeks of SIMULATED past results (clearly labelled, stored locally, never written to Walrus) so streaks, the ghost race and learned nudges have something to show. Real verification is unaffected." },
  { icon: "⛓️", title: "Check the chain", target: "#habits", action: "tick", actionLabel: "CHECK CHAIN NOW",
    what: "The core of Vow. It reads REAL Sui mainnet transactions (via Tatum) from the demo wallet and judges the last completed week: kept, missed, or unverified if the chain can't be reached. Each verdict lists the transaction digests as proof, and is saved to Walrus Memory." },
  { icon: "🃏", title: "Read a vow card", target: '[data-tour="card"]',
    what: "Streak and best streak, the last 7 windows as dots (colour = kept / missed / frozen), XP for this habit, and the quest of the week. Freeze (earned every 4-window streak) forgives one miss." },
  { icon: "💬", title: "Why this nudge?", target: '[data-tour="why"]',
    what: "The coach picks the next reminder style and tone from what worked before. Open this panel to see the exact memory records it cites. That's memory changing behaviour, with receipts." },
  { icon: "👻", title: "Ghost race", target: '[data-tour="ghost"]',
    what: "Your latest windows race the same number of windows before them, rebuilt from memory. Beat your past self to earn the Ghostbuster sticker and bonus XP. Hit REPLAY to watch it run." },
  { icon: "🧠", title: "Ask your coach", target: '[data-tour="coach"]',
    what: "Ask anything in plain language, e.g. \"Why do I miss on Fridays?\". With an AI key the answer comes from your recalled records only and cites them [1][2]. The model never decides a result." },
  { icon: "✍️", title: "Say your vow", target: "#new",
    what: "Type a sentence like \"save 20 USDC to 0x… every Thursday\" and press DRAFT IT. AI fills the form, you review it, nothing is saved until you seal it. Or just pick a template." },
  { icon: "🤝", title: "Buddy pings", target: '[data-tour="buddy"]',
    what: "Add an accountability buddy to a vow. They get a message when you miss: habit name, result and streak only, never amounts or addresses. Every message is shown word for word in the Buddy inbox." },
  { icon: "🏷️", title: "Stickers and levels", target: "#album",
    what: "Stickers are earned from real behaviour (First Win, On Fire, Comeback Kid…). XP comes from kept windows, streaks and stickers, and fills your level bar at the top." },
  { icon: "🧾", title: "See the proof", href: "/proof",
    what: "The Proof page lists the real blobs written to Walrus for this app, with storage end epoch and expiry. Open it in the same tab, then come back." },
  { icon: "👥", title: "Join the squad", href: "/people",
    what: "Connect your own wallet (Disconnect, then connect) to pick a handle, join the leaderboard, follow players and cheer them on. Demo mode can look but not join, because ownership isn't proven." },
];

export function DemoGuide({ tick, seed, busy }: { tick: () => void; seed: () => void; busy: Record<string, boolean> }) {
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const s = STEPS[i];

  const show = () => {
    if (!s.target) return;
    const el = document.querySelector<HTMLElement>(s.target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("tour-flash");
    setTimeout(() => el.classList.remove("tour-flash"), 2800);
  };
  const go = (n: number) => { setI(n); setTimeout(() => { const t = STEPS[n].target; if (t) { const el = document.querySelector<HTMLElement>(t); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("tour-flash"); setTimeout(() => el.classList.remove("tour-flash"), 2800); } } }, 50); };

  if (!open) return <button className="pill fixed bottom-4 right-4 z-40 px-4 py-3 text-sm" style={{ background: "#ffc2d6" }} onClick={() => setOpen(true)}>? DEMO GUIDE</button>;
  return (
    <aside aria-label="Demo guide" className="card fixed bottom-4 left-4 right-4 z-40 bg-white sm:left-auto sm:w-[380px]" style={{ borderRadius: 28, padding: 18, boxShadow: "none" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="pill px-3 py-1 text-xs" style={{ background: "#ffc2d6" }}>DEMO GUIDE · {i + 1}/{STEPS.length}</span>
        <button className="text-xs font-bold underline" onClick={() => setOpen(false)}>HIDE</button>
      </div>
      <h3 className="mt-3 flex items-center gap-2 text-xl font-bold"><span className="text-2xl">{s.icon}</span>{s.title}</h3>
      <p className="mt-2 text-sm leading-snug">{s.what}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.action === "seed" && <Btn fill busy={busy.seed} onClick={seed}>{s.actionLabel}</Btn>}
        {s.action === "tick" && <Btn fill busy={busy.tick} onClick={tick}>{s.actionLabel}</Btn>}
        {s.href && <a className="btn btn-fill" href={s.href}>OPEN</a>}
        {s.target && <Btn onClick={show}>SHOW ME WHERE</Btn>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Btn disabled={i === 0} onClick={() => go(i - 1)}>← BACK</Btn>
        <div className="flex gap-1" aria-hidden>{STEPS.map((_, n) => <span key={n} className="h-2 w-2 rounded-full border border-ink" style={{ background: n === i ? "#17142e" : n < i ? "#55db9c" : "#fff" }} />)}</div>
        {i < STEPS.length - 1 ? <Btn onClick={() => go(i + 1)}>NEXT →</Btn> : <Btn onClick={() => setOpen(false)}>DONE ✓</Btn>}
      </div>
    </aside>
  );
}
