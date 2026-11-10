"use client";
import { useEffect, useMemo, useState } from "react";
import { DemoGuide } from "./demo-guide";
import { ConnectPanel, WalletChip, useMe, type Me } from "./wallet";

/* ---------- helpers ---------- */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WASH = ["#55db9c", "#d4efd9", "#ffe0cc", "#ffc2d6"];
const CONFETTI = ["#7c5cff", "#55db9c", "#d4efd9", "#e8412c", "#ffc2d6", "#3d2bb5"];

const blank = { id: "", name: "", type: "recurring_save", token: "SUI", amount: "5", destination: "", weekday: 5, quietStart: 0, quietEnd: 5, tzOffsetMinutes: 60, escalation: ["reminder", "firm"], buddyName: "", buddyChannel: "manual", buddyTarget: "", buddyAuto: false };

const TEMPLATES = [
  { icon: "🐷", label: "Save every week", f: { name: "Weekly saver", type: "recurring_save", amount: "5", weekday: 5 } },
  { icon: "🦉", label: "No late-night sends", f: { name: "Quiet nights", type: "quiet_hours", amount: "0", quietStart: 0, quietEnd: 5 } },
  { icon: "🧢", label: "Cap my sends", f: { name: "Send cap", type: "spend_cap", amount: "2", weekday: 0 } },
  { icon: "🪙", label: "Stake every week", f: { name: "Weekly stake", type: "recurring_stake", amount: "5", weekday: 1 } },
];

function sentence(f: any) {
  const tok = f.token === "SUI" || !f.token ? "SUI" : "tokens";
  const d = f.destination ? `${f.destination.slice(0, 6)}…${f.destination.slice(-4)}` : "your destination";
  switch (f.type) {
    case "recurring_save": return `Send at least ${f.amount || "…"} ${tok} to ${d} every ${DAYS[f.weekday]}.`;
    case "spend_cap": return `Send at most ${f.amount || "…"} time(s) a week to ${d}.`;
    case "quiet_hours": return `No outgoing transactions between ${f.quietStart}:00 and ${f.quietEnd}:00.`;
    default: return `Stake at least ${f.amount || "…"} SUI every ${DAYS[f.weekday]}.`;
  }
}

async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j;
}

function Btn({ busy, children, fill, ...p }: { busy?: boolean; fill?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} aria-busy={busy} disabled={busy || p.disabled} className={`btn ${fill ? "btn-fill" : ""} ${p.className ?? ""}`}>
      {busy && <span className="spin" />}{children}
    </button>
  );
}

/* the signature motif: a chain ("the chain is the judge"), flat links drawn with an ink outline + colour fill */
function Ribbon({ className = "" }: { className?: string }) {
  const cols = ["#7c5cff", "#ffc2d6", "#55db9c", "#ffc2d6", "#7c5cff"];
  return (
    <svg viewBox="0 0 1040 150" className={className} aria-hidden style={{ transform: "rotate(-5deg)", opacity: 0.55 }}>
      {cols.map((c, i) => (
        <g key={i}>
          <rect x={i * 200 + 14} y="30" width="162" height="90" rx="45" fill="none" stroke="#17142e" strokeWidth="28" />
          <rect x={i * 200 + 14} y="30" width="162" height="90" rx="45" fill="none" stroke={c} strokeWidth="18" />
        </g>))}
      {cols.slice(0, 4).map((c, i) => (
        <g key={i}>
          <rect x={i * 200 + 164} y="36" width="52" height="78" rx="26" fill={c} stroke="#17142e" strokeWidth="5" />
          <rect x={i * 200 + 176} y="50" width="8" height="40" rx="4" fill="#fffaf0" opacity=".7" />
        </g>))}
    </svg>
  );
}

function Sticker({ icon, color, size = 56, rot = 0, className = "", title }: { icon: string; color: string; size?: number; rot?: number; className?: string; title?: string }) {
  return <span title={title} className={`sticker ${className}`} style={{ background: color, width: size, height: size, fontSize: size * 0.5, transform: `rotate(${rot}deg)` }}>{icon}</span>;
}

/* ---------- page ---------- */
function Dashboard({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [ov, setOv] = useState<any>(null);          // overview: rules + gamification
  const [run, setRun] = useState<any>(null);        // last chain check
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [chat, setChat] = useState<Record<string, any>>({});
  const [input, setInput] = useState<Record<string, string>>({});
  const [burst, setBurst] = useState(0);
  const [inbox, setInbox] = useState<any[]>([]);
  const [say_, setSay] = useState(""); // plain-English vow text
  const [race, setRace] = useState(0); // bump to replay the ghost race animation
  const loadInbox = () => api("/api/buddy", "GET").then(setInbox).catch(() => {});

  const say = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 4000); };
  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); if (ok) say(ok); } catch (e: any) { say(e.message ?? String(e), true); }
    setBusy((b) => ({ ...b, [key]: false }));
  };
  const load = async () => setOv(await api("/api/overview", "GET"));
  useEffect(() => { loadInbox(); load().catch(() => setOv({ rules: [], total: { level: 1, title: "Rookie", into: 0, span: 40, xp: 0 } })); }, []);

  const rules: any[] = ov?.rules ?? [];
  const resultFor = (id: string) => run?.results?.find((y: any) => y.rule.id === id);

  const save = () => act("save", async () => {
    if (!form.name.trim()) throw new Error("Give your vow a name");
    if (!(Number(form.amount) >= 0)) throw new Error("Amount must be a number");
    if ((form.type === "recurring_save" || form.type === "spend_cap") && !/^0x[0-9a-fA-F]{6,}$/.test(form.destination)) throw new Error("Destination must be a Sui address starting with 0x");
    const { buddyName, buddyChannel, buddyTarget, buddyAuto, ...rest } = form;
    const buddy = buddyName.trim() ? { name: buddyName.trim(), channel: buddyChannel, target: buddyTarget.trim() || undefined, auto: !!buddyAuto } : undefined;
    await api("/api/rules", "POST", { ...rest, buddy, id: form.id || undefined, amount: Number(form.amount), weekday: Number(form.weekday), quietStart: Number(form.quietStart), quietEnd: Number(form.quietEnd) });
    setForm(blank); await load();
  }, form.id ? "Vow updated" : "Vow made. Now check the chain!");

  const remove = (id: string) => act(`del:${id}`, async () => { await api("/api/rules", "DELETE", { id }); setRun(null); await load(); }, "Vow deleted");
  const tick = () => act("tick", async () => {
    const r = await api("/api/run", "POST"); setRun(r); await load();
    if (r.results?.some((x: any) => x.result.result === "kept")) setBurst(Date.now());
    const pinged = r.results?.filter((x: any) => x.buddyPing);
    if (pinged?.length) { say(`Buddy pinged: ${pinged.map((x: any) => x.rule.buddy.name).join(", ")}`); loadInbox(); }
  }, "Chain checked");
  const seed = () => act("seed", async () => { await api("/api/seed", "POST"); await load(); }, "Simulated history seeded (local only)");
  const freeze = (id: string) => act(`freeze:${id}`, async () => { await api("/api/freeze", "POST", { ruleId: id }); await load(); setBurst(Date.now()); }, "Freeze used. Streak saved!");
  const reason = (x: any) => act(`reason:${x.rule.id}`, async () => {
    await api("/api/reason", "POST", { ruleId: x.rule.id, ruleName: x.rule.name, window: x.window.label, weekday: new Date(x.window.end - 1).getUTCDay(), reason: input[`reason:${x.rule.id}`] });
    setInput((i) => ({ ...i, [`reason:${x.rule.id}`]: "" })); await load();
  }, "Reason saved to memory (+ a sticker?)");
  const askReal = (id: string) => act(`ask:${id}`, async () => {
    const a = await api("/api/coach", "POST", { ruleId: id, q: input[`ask:${id}`] ?? "" });
    setChat((c) => ({ ...c, [id]: a }));
  });

  const pingBuddy = (id: string, kind: "test" | "ask") => act(`ping:${id}`, async () => {
    const p = await api("/api/buddy", "POST", { ruleId: id, kind });
    await Promise.all([load(), loadInbox()]);
    say(p.status === "sent" ? `Sent to your buddy` : p.status === "failed" ? `Failed: ${p.detail}` : `Saved as preview. ${p.detail}`, p.status === "failed");
  });

  const draft = () => act("draft", async () => {
    const r = await api("/api/parse-vow", "POST", { text: say_ });
    setForm((f: any) => ({ ...blank, ...r.draft, id: f.id, buddyName: f.buddyName, buddyChannel: f.buddyChannel, buddyTarget: f.buddyTarget, buddyAuto: f.buddyAuto }));
    say(r.needsDestination ? "Drafted! Add the destination address, then seal it." : "Drafted! Check the details, then seal it.");
  });

  const t = ov?.total;
  const album = useMemo(() => {
    const m = new Map<string, any>();
    rules.forEach((r) => r.badges.forEach((b: any) => { const o = m.get(b.id); if (!o || b.earned) m.set(b.id, b); }));
    return [...m.values()];
  }, [rules]);
  const earnedCount = album.filter((b) => b.earned).length;

  const f = (k: string) => ({ value: form[k], onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });
  const needsDest = form.type === "recurring_save" || form.type === "spend_cap";
  const needsDay = form.type !== "quiet_hours";

  return (
    <>
      {/* confetti when something is kept */}
      {burst > 0 && <div key={burst} aria-hidden>{Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 97) % 100}%`, background: CONFETTI[i % 6], animationDelay: `${(i % 9) * 60}ms`, transform: `rotate(${i * 40}deg)` }} />))}</div>}
      {me.demo && <DemoGuide tick={tick} seed={seed} busy={busy} />}
      {toast && <div role="status" className="fixed right-4 top-14 z-50 pill px-4 py-2 text-sm" style={{ background: toast.err ? "#e8412c" : "#ffc2d6" }}>{toast.msg}</div>}

      <div className="marquee"><div>{Array(8).fill("The chain is the judge · Memory shapes the nudge · Keep your vow · ").join("")}</div></div>

      <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <span className="pill grid h-11 w-11 place-items-center text-lg">V</span>
        <div className="hidden gap-1 sm:flex">
          <a className="pill px-4 py-2 text-xs" href="#habits">HABITS</a>
          <a className="pill px-4 py-2 text-xs" href="#album">STICKERS</a>
          <a className="pill px-4 py-2 text-xs" href="#new">NEW VOW</a>
          <a className="pill px-4 py-2 text-xs" href="#inbox">BUDDIES</a>
          <a className="pill px-4 py-2 text-xs" href="/people">SQUAD</a>
          <a className="pill px-4 py-2 text-xs" href="/proof">PROOF</a>
          <a className="pill px-4 py-2 text-xs" href="/api/receipts" target="_blank">RECEIPTS</a>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <WalletChip me={me} onLogout={onLogout} />
          <Btn fill busy={busy.tick} onClick={tick}>{busy.tick ? "CHECKING CHAIN…" : "CHECK CHAIN"}</Btn>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden" style={{ background: "#ffe0cc" }}>
        <Ribbon className="pointer-events-none absolute -left-10 top-6 w-[130%] max-w-none sm:top-0" />
        <div className="relative mx-auto grid max-w-[1440px] gap-8 px-4 pb-14 pt-10 sm:px-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h1 className="display text-[clamp(110px,22vw,300px)]" style={{ textShadow: "6px 6px 0 var(--cream)" }}>Vow</h1>
            <p className="card mt-6 max-w-md bg-white !p-4 text-2xl font-bold leading-tight" style={{ borderRadius: 24 }}>Make a money vow. The chain proves it. Your coach remembers.</p>
            <ol className="mt-4 flex flex-wrap gap-2 text-xs font-bold tracking-wider">
              {["1 · MAKE A VOW", "2 · CHECK THE CHAIN", "3 · COLLECT STICKERS"].map((s) => <li key={s} className="pill px-3 py-2">{s}</li>)}
            </ol>
          </div>

          {/* player card */}
          <div className="card self-end" style={{ background: "#fff", borderRadius: 40 }}>
            {!t ? <div className="sk h-28" /> : <>
              <div className="flex items-center gap-3">
                <Sticker icon="★" color="#ffc2d6" size={64} rot={-8} className="pop" />
                <div>
                  <div className="text-xs font-bold tracking-widest opacity-60">LEVEL {t.level}</div>
                  <div className="display text-3xl" style={{ lineHeight: 1 }}>{t.title}</div>
                </div>
              </div>
              <div className="mt-4 h-5 overflow-hidden rounded-full border border-ink" role="progressbar" aria-valuenow={t.into} aria-valuemax={t.span}>
                <div className="h-full bg-blue transition-all" style={{ width: `${Math.max(4, (t.into / t.span) * 100)}%`, borderRight: "1px solid #000" }} />
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold"><span>{t.xp} XP</span><span>{t.span - t.into} XP to level {t.level + 1}</span></div>
              <div className="mt-3 text-xs opacity-70">+10 XP per kept window · +20 per sticker · streaks add bonus XP</div>
            </>}
          </div>
        </div>
        <Sticker icon="🚀" color="#e8412c" size={72} rot={14} className="absolute right-[8%] top-10 hidden lg:flex" />
        <Sticker icon="🪙" color="#ffc2d6" size={60} rot={-12} className="absolute right-[34%] top-24 hidden lg:flex" />
      </header>

      {/* HABITS */}
      <section id="habits" className="bg-white">
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-12 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="display text-6xl">Your vows</h2>
            <div className="flex gap-2">
              <Btn busy={busy.seed} onClick={seed}>{busy.seed ? "SEEDING…" : "SEED DEMO HISTORY"}</Btn>
            </div>
          </div>
          {run?.error && <p className="card text-sm" style={{ background: "#ffc2d6" }}>Couldn&apos;t reach the chain, so windows are marked <b>unverified</b>, not missed. ({run.error})</p>}

          {!ov && <div className="grid gap-4 md:grid-cols-2"><div className="sk h-72" /><div className="sk h-72" /></div>}
          {ov && rules.length === 0 && (
            <div className="card text-center" style={{ background: "#d4efd9" }}>
              <Sticker icon="🎯" color="#fff" size={72} rot={-6} />
              <p className="display mt-4 text-4xl" style={{ lineHeight: 1 }}>No vows yet</p>
              <p className="mt-2">Pick a template below to make your first one. It takes ten seconds.</p>
              <a href="#new" className="btn btn-fill mt-4">MAKE A VOW</a>
            </div>)}

          <div className="grid gap-5 md:grid-cols-2">
            {rules.map((o, idx) => {
              const r = o.rule, x = resultFor(r.id), s = o.streak;
              const slots = [...Array(Math.max(0, 7 - o.history.length)).fill(null), ...o.history];
              return (
                <article key={r.id} data-tour={idx === 0 ? "card" : undefined} className="card flex flex-col gap-4" style={{ background: WASH[idx % 4], borderRadius: idx % 2 ? 40 : 28 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-2xl font-bold leading-tight">{r.name}</h3>
                      <span className="pill mt-1 inline-block px-3 py-1 text-[11px] uppercase">{r.type.replace("_", " ")}</span>
                    </div>
                    <div className="text-center">
                      <div className="display text-6xl" style={{ lineHeight: 1 }}>{s.current}<span className="text-4xl">🔥</span></div>
                      <div className="text-[11px] font-bold tracking-widest">STREAK · BEST {s.best}</div>
                    </div>
                  </div>

                  {/* last 7 windows */}
                  <div>
                    <div className="mb-1 text-[11px] font-bold tracking-widest">LAST 7 WINDOWS</div>
                    <div className="flex gap-2">
                      {slots.map((h: any, i: number) => (
                        <span key={i} title={h ? `${h.window}: ${h.frozen ? "frozen" : h.result}${h.simulated ? " (simulated)" : ""}` : "no data yet"}
                          className="grid h-9 w-9 place-items-center rounded-full border border-ink text-sm font-bold"
                          style={{ background: !h ? "transparent" : h.frozen ? "#ffe0cc" : h.result === "kept" ? "#7c5cff" : "#e8412c", borderStyle: h ? "solid" : "dashed" }}>
                          {!h ? "" : h.frozen ? "🧊" : h.result === "kept" ? "✓" : "✕"}
                        </span>))}
                    </div>
                  </div>

                  {/* latest check */}
                  {x ? (
                    <div className="rounded-2xl border border-ink bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="pill px-3 py-1 text-xs" style={{ background: x.result.result === "kept" ? "#17142e" : x.result.result === "missed" ? "#e8412c" : "#fff", color: x.result.result === "kept" ? "#fff" : "#17142e", borderStyle: x.result.result === "unverified" ? "dashed" : "solid" }}>
                          {x.result.result === "kept" ? "KEPT ✓" : x.result.result === "missed" ? "MISSED" : "COULDN'T VERIFY"}
                        </span>
                        <span className="opacity-70">window {x.window.label}</span>
                      </div>
                      {x.result.explain && <p className="mt-2 text-xs leading-snug"><b>Verifier:</b> {x.result.explain}</p>}
                      {x.result.details?.length > 0 ? (
                        <details className="mt-2 text-xs" open>
                          <summary className="cursor-pointer font-bold">Transaction evidence ({x.result.details.length}) · open on Suiscan</summary>
                          <ul className="mt-1 space-y-1">{x.result.details.map((d: any) => (
                            <li key={d.digest}><a className="font-mono underline" target="_blank" rel="noreferrer" href={`https://suiscan.xyz/mainnet/tx/${d.digest}`}>{d.digest.slice(0, 10)}…</a> · {d.at} · {d.note}</li>))}</ul>
                        </details>
                      ) : x.result.evidence.length > 0 && <div className="mt-2 text-xs">Proof on chain: {x.result.evidence.map((d: string) => <a key={d} className="mr-2 underline" target="_blank" rel="noreferrer" href={`https://suiscan.xyz/mainnet/tx/${d}`}>{d.slice(0, 8)}…</a>)}</div>}
                      {x.memory && <p className="mt-2 text-[11px] opacity-80">🧠 Memory: recalled {x.nudge.recalled ?? 0} record(s) for this decision · {x.memory.wrote ? (x.memory.live ? "this window's outcome is being written to Walrus (background)" : "this window's outcome saved to the local mirror only (Walrus not configured)") : "this window was already recorded, nothing new written"}</p>}
                      <div className="mt-3 flex items-start gap-2">
                        <Sticker icon="🧠" color="#d4efd9" size={36} />
                        <div data-tour={idx === 0 ? "why" : undefined} className="rounded-2xl border border-ink px-3 py-2">
                          <span className="italic">“{x.text}”</span>
                          <details className="mt-1 text-xs"><summary className="cursor-pointer font-bold">Why this nudge?</summary>
                            <p className="mt-1"><span className="pill mr-1 px-2 py-0.5 text-[10px]" style={{ background: x.nudge.basis === "pattern" ? "#d4efd9" : "#ffc2d6" }}>{x.nudge.basis === "pattern" ? "LEARNED FROM YOUR HISTORY" : "EXPLORING · NOT ENOUGH DATA YET"}</span><b>Style: {x.nudge.style.replace("_", " ")}.</b> {x.nudge.reason}</p><p className="opacity-70">Tone: {x.tone.why}</p>
                            <ul className="ml-4 list-disc">{x.nudge.cited.map((m: any, i: number) => <li key={i}>{m.window}: {m.result}</li>)}</ul>
                          </details>
                        </div>
                      </div>
                      {x.result.result === "missed" && (
                        <div className="mt-3 flex gap-2">
                          <input className="field !py-2 text-sm" placeholder="Tell your coach why (stored in public memory; keep it general)" value={input[`reason:${r.id}`] ?? ""} onChange={(e) => setInput({ ...input, [`reason:${r.id}`]: e.target.value })} />
                          <Btn busy={busy[`reason:${r.id}`]} disabled={!input[`reason:${r.id}`]?.trim()} onClick={() => reason(x)}>SAVE</Btn>
                        </div>)}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-ink bg-white/60 p-3 text-sm">
                      {busy.tick ? "Reading the chain…" : <>Not checked yet. Hit <b>CHECK CHAIN</b> to see if you kept this one.</>}
                    </p>)}

                  {/* quest */}
                  <div className="flex items-center gap-3 rounded-2xl border border-ink bg-white p-3">
                    <Sticker icon="🎯" color="#ffc2d6" size={44} rot={-6} />
                    <div className="text-sm"><div className="font-bold">Quest: {o.quest.title}</div><div className="opacity-70">{o.quest.detail}</div></div>
                    <span className="pill ml-auto whitespace-nowrap px-2 py-1 text-[11px]">+{o.quest.reward} XP</span>
                  </div>

                  {/* ghost race */}
                  {o.ghost ? (
                    <div data-tour={idx === 0 ? "ghost" : undefined} className="rounded-2xl border border-ink bg-white p-3 text-sm" key={`${r.id}-${race}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">👻 Ghost race <span className="text-xs font-medium opacity-60">last {o.ghost.n} windows vs the {o.ghost.n} before</span></div>
                        <button className="underline text-xs font-bold" onClick={() => setRace((v) => v + 1)}>REPLAY</button>
                      </div>
                      {([["YOU", o.ghost.me, "#7c5cff", o.ghost.meKept], ["GHOST", o.ghost.ghost, "#d4efd9", o.ghost.ghostKept]] as const).map(([who, cells, color, kept]) => (
                        <div key={who} className="mt-2 flex items-center gap-2">
                          <span className="w-12 text-[11px] font-bold tracking-widest">{who}</span>
                          <div className="flex flex-1 gap-1">
                            {cells.map((c: any, i: number) => (
                              <span key={i} title={`${c.window}: ${c.ok ? "kept" : "missed"}`} className="pop h-6 flex-1 rounded-full border border-ink"
                                style={{ background: c.ok ? color : "#fff", opacity: who === "GHOST" ? 0.75 : 1, animationDelay: `${i * 140 + (who === "GHOST" ? 70 : 0)}ms`, animationFillMode: "backwards" }} />))}
                          </div>
                          <span className="w-9 text-right text-xs font-bold">{kept}/{o.ghost.n}</span>
                        </div>))}
                      <p className="mt-2 text-xs font-bold">
                        {o.ghost.status === "ahead" ? `👑 You're ahead by ${o.ghost.meKept - o.ghost.ghostKept}. Ghostbuster unlocked, +30 XP.` : o.ghost.status === "tied" ? "Dead heat. One more kept window breaks the tie." : `The ghost leads by ${o.ghost.ghostKept - o.ghost.meKept}. Keep your next windows to catch it.`}
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-ink bg-white/60 p-3 text-xs">👻 <b>Ghost race unlocks after 6 windows.</b> Your past self becomes the opponent.</p>
                  )}

                  {/* freeze */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="pill px-3 py-1 text-xs">🧊 {s.freezes} FREEZE{s.freezes === 1 ? "" : "S"}</span>
                    <Btn busy={busy[`freeze:${r.id}`]} disabled={!s.freezes || !o.lastMiss} onClick={() => freeze(r.id)} title={s.freezes ? "Forgive your last miss" : "Earn one by keeping 4 windows in a row"}>USE FREEZE</Btn>
                    {!s.freezes && <span className="text-xs opacity-70">Keep 4 in a row to earn one</span>}
                  </div>

                  {/* buddy */}
                  <div data-tour={idx === 0 ? "buddy" : undefined} className="rounded-2xl border border-ink bg-white p-3 text-sm">
                    {r.buddy ? (<>
                      <div className="flex flex-wrap items-center gap-2">
                        <Sticker icon="🤝" color="#7c5cff" size={36} />
                        <div className="font-bold">{r.buddy.name}<span className="ml-2 text-xs font-medium opacity-70">{r.buddy.channel === "manual" ? "share manually" : r.buddy.channel} · {r.buddy.auto ? "auto-pings on a miss" : "only when you ask"}</span></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Btn busy={busy[`ping:${r.id}`]} onClick={() => pingBuddy(r.id, "ask")}>ASK FOR A CHECK-IN</Btn>
                        <Btn busy={busy[`ping:${r.id}`]} onClick={() => pingBuddy(r.id, "test")}>SEND INTRO</Btn>
                      </div>
                    </>) : <p className="text-xs">🤝 <b>No buddy yet.</b> Add one by editing this vow. People keep vows when someone is watching.</p>}
                  </div>

                  {/* coach */}
                  <div data-tour={idx === 0 ? "coach" : undefined}>
                    <div className="flex gap-2">
                      <input className="field !py-2 text-sm" placeholder="Ask your coach anything about this habit…" value={input[`ask:${r.id}`] ?? ""}
                        onChange={(e) => setInput({ ...input, [`ask:${r.id}`]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && askReal(r.id)} />
                      <Btn busy={busy[`ask:${r.id}`]} onClick={() => askReal(r.id)}>ASK</Btn>
                    </div>
                    {chat[r.id] && <div className="mt-2 rounded-2xl border border-ink bg-white p-3 text-sm">{chat[r.id].mode === "llm" && <span className="pill mb-1 mr-2 inline-block px-2 py-0.5 text-[10px]" style={{ background: "#d4efd9" }}>✨ AI · FROM YOUR RECORDS</span>}{chat[r.id].answer}
                      <ul className="ml-4 list-disc text-xs opacity-70">{chat[r.id].cited.map((m: any, i: number) => <li key={i}>{m.window}: {m.result}</li>)}</ul></div>}
                  </div>

                  <div className="mt-auto flex gap-2 pt-1">
                    <Btn onClick={() => { setForm({ ...blank, ...r, amount: String(r.amount), buddyName: r.buddy?.name ?? "", buddyChannel: r.buddy?.channel ?? "manual", buddyTarget: r.buddy?.target ?? "", buddyAuto: !!r.buddy?.auto }); document.getElementById("new")?.scrollIntoView({ behavior: "smooth" }); }}>EDIT</Btn>
                    <Btn busy={busy[`del:${r.id}`]} onClick={() => remove(r.id)}>DELETE</Btn>
                  </div>
                </article>);
            })}
          </div>
        </div>
      </section>

      {/* STICKER ALBUM */}
      <section id="album" style={{ background: "#d4efd9" }}>
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="display text-6xl">Sticker album</h2>
            <span className="pill px-4 py-2 text-xs">{earnedCount} / {album.length || 7} COLLECTED</span>
          </div>
          <p className="mt-2 max-w-xl text-sm">Every sticker is earned from real, chain-verified behaviour. Grey ones are still up for grabs.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {(album.length ? album : Array(7).fill(null)).map((b: any, i: number) => b ? (
              <div key={b.id} className="flex flex-col items-center gap-2 rounded-3xl border border-ink bg-white p-4 text-center">
                <Sticker icon={b.icon} color={b.color} size={72} rot={(i % 2 ? 1 : -1) * 6} className={b.earned ? "pop" : "locked"} />
                <div className="text-sm font-bold">{b.name}</div>
                <div className="text-xs opacity-70">{b.earned ? "Collected!" : b.hint}</div>
              </div>) : <div key={i} className="sk h-40" />)}
          </div>
        </div>
      </section>

      {/* NEW VOW */}
      <section id="new" style={{ background: "#e8dcc8" }}>
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="display text-6xl">{form.id ? "Edit vow" : "Make a vow"}</h2>
            <p className="mt-3 text-sm">Start from a template, then tweak. Vow only reads the chain. It never moves your money.</p>
            <div className="card mt-4 !p-4" style={{ background: "#fff", borderRadius: 24 }}>
              <div className="text-[11px] font-bold tracking-widest">✨ OR JUST SAY IT</div>
              <div className="mt-2 flex gap-2">
                <input className="field !py-2 text-sm" maxLength={500} placeholder="e.g. Save 20 USDC to 0x… every Thursday" value={say_} onChange={(e) => setSay(e.target.value)} onKeyDown={(e) => e.key === "Enter" && say_.trim() && draft()} />
                <Btn busy={busy.draft} disabled={!say_.trim()} onClick={draft}>{busy.draft ? "DRAFTING…" : "DRAFT IT"}</Btn>
              </div>
              <p className="mt-2 text-xs opacity-70">An AI model turns your sentence into a draft for you to review. Nothing is saved until you seal it. Your sentence is sent to the AI provider.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {TEMPLATES.map((tp) => <button key={tp.label} className="btn" onClick={() => setForm({ ...blank, ...tp.f, id: form.id })}><span>{tp.icon}</span>{tp.label.toUpperCase()}</button>)}
            </div>
            <div className="card mt-6" style={{ background: "#fff" }}>
              <div className="text-[11px] font-bold tracking-widest opacity-60">YOUR VOW, IN PLAIN ENGLISH</div>
              <p className="mt-1 text-2xl font-bold leading-tight">{sentence(form)}</p>
            </div>
          </div>

          <div className="card space-y-3" style={{ background: "#fff", borderRadius: 40 }}>
            <label className="block text-xs font-bold tracking-widest">NAME<input className="field mt-1 font-medium" placeholder="e.g. Friday savings" {...f("name")} /></label>
            <p className="-mt-2 text-[11px] opacity-70">The name and each week&apos;s result are written to Walrus Memory, which is public. Keep it generic. Amounts, tokens and addresses are never stored there.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold tracking-widest">TYPE
                <select className="field mt-1 font-medium" {...f("type")}>
                  <option value="recurring_save">Recurring save</option><option value="spend_cap">Spend cap</option>
                  <option value="quiet_hours">Quiet hours</option><option value="recurring_stake">Recurring stake</option>
                </select></label>
              <label className="block text-xs font-bold tracking-widest">{form.type === "spend_cap" ? "MAX SENDS / WEEK" : form.type === "quiet_hours" ? "—" : "AMOUNT"}
                <input className="field mt-1 font-medium" inputMode="decimal" disabled={form.type === "quiet_hours"} {...f("amount")} /></label>
            </div>
            {form.type !== "quiet_hours" && form.type !== "recurring_stake" && (
              <label className="block text-xs font-bold tracking-widest">TOKEN
                <input className="field mt-1 font-medium" placeholder="SUI, or a full coin type 0x…::usdc::USDC" {...f("token")} /></label>)}
            {needsDest && <label className="block text-xs font-bold tracking-widest">DESTINATION ADDRESS
              <input className="field mt-1 font-medium" placeholder="0x…" {...f("destination")} /></label>}
            {needsDay && <label className="block text-xs font-bold tracking-widest">WEEKLY WINDOW ENDS ON
              <select className="field mt-1 font-medium" {...f("weekday")}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>}
            {form.type === "quiet_hours" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold tracking-widest">FROM (HOUR)<input className="field mt-1 font-medium" type="number" min={0} max={23} {...f("quietStart")} /></label>
                <label className="block text-xs font-bold tracking-widest">TO (HOUR)<input className="field mt-1 font-medium" type="number" min={1} max={24} {...f("quietEnd")} /></label>
              </div>)}
            <fieldset className="rounded-2xl border border-ink p-3" style={{ background: "#ffe0cc" }}>
              <legend className="px-2 text-xs font-bold tracking-widest">🤝 ACCOUNTABILITY BUDDY (OPTIONAL)</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold tracking-widest">BUDDY&apos;S NAME<input className="field mt-1 font-medium" placeholder="e.g. Ada" {...f("buddyName")} /></label>
                <label className="block text-xs font-bold tracking-widest">HOW TO REACH THEM
                  <select className="field mt-1 font-medium" {...f("buddyChannel")}>
                    <option value="manual">I&apos;ll share it myself</option><option value="telegram">Telegram bot</option><option value="webhook">Discord / Slack webhook</option>
                  </select></label>
              </div>
              {form.buddyChannel !== "manual" && <label className="mt-3 block text-xs font-bold tracking-widest">{form.buddyChannel === "telegram" ? "TELEGRAM CHAT ID OR @USERNAME" : "WEBHOOK URL (HTTPS)"}
                <input className="field mt-1 font-medium" {...f("buddyTarget")} /></label>}
              <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.buddyAuto} onChange={(e) => setForm({ ...form, buddyAuto: e.target.checked })} />
                <span>Tell my buddy automatically when I miss a window.</span></label>
              <p className="mt-2 text-xs opacity-70">Your buddy sees only the habit name, the result and your streak. Never amounts, tokens or addresses.</p>
            </fieldset>
            <div className="flex gap-2 pt-2">
              <Btn fill busy={busy.save} onClick={save} className="flex-1">{busy.save ? "SAVING…" : form.id ? "UPDATE VOW" : "SEAL THE VOW"}</Btn>
              {form.id && <Btn onClick={() => setForm(blank)}>CANCEL</Btn>}
            </div>
          </div>
        </div>
      </section>

      {/* BUDDY INBOX */}
      <section id="inbox" style={{ background: "#ffc2d6" }}>
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
          <h2 className="display text-6xl">Buddy inbox</h2>
          <p className="mt-2 max-w-xl text-sm">Everything sent (or previewed) to your buddies, word for word, so nothing leaves your control unseen.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {inbox.length === 0 && <p className="card bg-white text-sm">No pings yet. Add a buddy to a vow and send an intro.</p>}
            {inbox.map((p) => (
              <div key={p.id} className="card space-y-2 bg-white !p-4" style={{ borderRadius: 20 }}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="pill px-3 py-1" style={{ background: p.status === "sent" ? "#17142e" : p.status === "failed" ? "#e8412c" : "#fff", color: p.status === "sent" ? "#fff" : "#17142e", borderStyle: p.status === "preview" ? "dashed" : "solid" }}>{p.status.toUpperCase()}</span>
                  <span>to {p.buddy}</span><span className="opacity-60">· {p.kind === "miss" ? "miss alert" : p.kind === "ask" ? "check-in request" : "intro"} · {p.ruleName}</span>
                </div>
                <p className="text-sm">“{p.text}”</p>
                <p className="text-xs opacity-60">{p.detail}</p>
                {p.status === "preview" && p.links && <div className="flex flex-wrap gap-2">
                  <a className="btn" target="_blank" href={p.links.telegram}>TELEGRAM</a><a className="btn" target="_blank" href={p.links.whatsapp}>WHATSAPP</a><a className="btn" href={p.links.email}>EMAIL</a></div>}
              </div>))}
          </div>
        </div>
      </section>

      <footer className="bg-ink px-4 py-6 text-center text-xs font-bold tracking-widest text-cream">
        VERIFIED ON SUI VIA TATUM · REMEMBERED IN WALRUS MEMORY · <a className="underline" href="/proof">SEE THE PROOF</a>
      </footer>
    </>
  );
}

/* ---------- gate: connect a wallet first ---------- */
export default function Home() {
  const { me, loading, demoAvailable, refresh } = useMe();
  if (loading) return <main className="mx-auto max-w-[900px] px-4 py-24"><div className="sk h-64" /></main>;
  if (me) return <Dashboard key={me.address + me.demo} me={me} onLogout={refresh} />;
  return (
    <>
      <div className="marquee"><div>{Array(8).fill("The chain is the judge · Memory shapes the nudge · Keep your vow · ").join("")}</div></div>
      <header className="relative overflow-hidden" style={{ background: "#ffe0cc" }}>
        <Ribbon className="pointer-events-none absolute -left-10 top-6 w-[130%] max-w-none sm:top-0" />
        <div className="relative mx-auto grid max-w-[1100px] gap-8 px-4 pb-16 pt-12 sm:px-8 lg:grid-cols-[1fr_460px]">
          <div>
            <h1 className="display text-[clamp(110px,22vw,260px)]" style={{ textShadow: "6px 6px 0 var(--cream)" }}>Vow</h1>
            <p className="card mt-6 max-w-md bg-white !p-4 text-2xl font-bold leading-tight" style={{ borderRadius: 24 }}>Make a money vow. The chain proves it. Your coach remembers.</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs font-bold tracking-wider">
              {["READ-ONLY · NEVER MOVES FUNDS", "NO SELF-REPORTING", "FRIENDS CAN CHEER YOU ON"].map((x) => <li key={x} className="pill px-3 py-2">{x}</li>)}
            </ul>
          </div>
          <div className="self-end"><ConnectPanel demoAvailable={demoAvailable} onDone={refresh} /></div>
        </div>
      </header>
      <p className="mx-auto max-w-[1100px] px-4 py-6 text-sm sm:px-8"><a className="underline" href="/people">See the community leaderboard</a></p>
    </>
  );
}
