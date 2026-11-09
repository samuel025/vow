"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Btn, Sticker, useAct, useToast } from "../../ui";
import { WalletChip, useMe } from "../../wallet";

const CHEERS = ["👏", "🔥", "💪", "🎉", "🫶"];
const CHIP: Record<string, string> = { kept: "#55db9c", missed: "#e8412c" };

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const { me, refresh } = useMe();
  const [d, setD] = useState<any>(undefined);
  const [msg, setMsg] = useState("");
  const [emoji, setEmoji] = useState("👏");
  const { say, node } = useToast();
  const { busy, act } = useAct(say);
  const load = () => api(`/api/people/${handle}`, "GET").then(setD).catch(() => setD(null));
  useEffect(() => { load(); }, [handle, me?.address]);

  if (d === undefined) return <main className="mx-auto max-w-[900px] px-4 py-16"><div className="sk h-64" /></main>;
  if (d === null) return <main className="mx-auto max-w-[900px] px-4 py-16"><h1 className="display text-6xl">No such player</h1><Link className="btn mt-6" href="/people">BACK TO THE SQUAD</Link></main>;

  const t = d.total;
  const share = () => act("share", async () => { await navigator.clipboard.writeText(location.href); }, "Link copied");
  return (
    <>
      {node}
      <nav className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link className="pill grid h-11 w-11 place-items-center text-lg" href="/">V</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="pill px-4 py-2 text-xs" href="/people">SQUAD</Link>
          {me && <WalletChip me={me} onLogout={() => { refresh(); load(); }} />}
        </div>
      </nav>
      <header style={{ background: "#ffc2d6" }}>
        <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-8">
          <h1 className="display text-[clamp(48px,10vw,110px)] break-all">@{d.handle}</h1>
          <p className="mt-3 text-xl font-bold">Level {t.level} · {t.title} · {t.xp} XP</p>
          <p className="mt-1 text-sm">🔥 best streak {d.best} · {d.followers} follower{d.followers === 1 ? "" : "s"} · {d.cheers} cheer{d.cheers === 1 ? "" : "s"} received{!d.public && " · private (only you can see this)"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn busy={busy.share} onClick={share}>COPY LINK</Btn>
            {d.signedIn && !d.isMe && (
              <Btn fill busy={busy.follow} onClick={() => act("follow", async () => { await api("/api/social", "POST", { action: d.following ? "unfollow" : "follow", handle: d.handle }); await load(); })}>{d.following ? "FOLLOWING ✓" : "FOLLOW"}</Btn>)}
          </div>
          {d.simulated && <p className="mt-3 text-xs font-bold">Includes clearly labelled simulated demo history.</p>}
        </div>
      </header>

      <main className="mx-auto max-w-[900px] space-y-10 px-4 py-10 sm:px-8">
        {d.you && (
          <section className="card" style={{ background: "#ffe0cc" }}>
            <h2 className="display text-3xl">You vs @{d.handle}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm font-bold">
              <div /><div>YOU</div><div>@{d.handle}</div>
              <div className="text-left">XP</div><div>{d.you.total.xp}</div><div>{t.xp}</div>
              <div className="text-left">Best streak</div><div>{d.you.best}</div><div>{d.best}</div>
              <div className="text-left">Stickers</div><div>{d.you.stickers.length}</div><div>{d.stickers.length}</div>
            </div>
            <p className="mt-3 text-sm">{d.you.total.xp > t.xp ? "You're ahead. Keep it up!" : d.you.total.xp < t.xp ? `${t.xp - d.you.total.xp} XP to catch up.` : "Dead even."}</p>
          </section>)}

        <section>
          <h2 className="display text-4xl">Vows</h2>
          {d.vows.length === 0 ? <p className="mt-3 text-sm opacity-70">No vows yet.</p> : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {d.vows.map((v: any, i: number) => (
                <li key={i} className="card bg-white" style={{ borderRadius: 24, padding: 16 }}>
                  <div className="text-lg font-bold">{v.name}</div>
                  <div className="text-sm">🔥 streak {v.streak.current} · best {v.streak.best} · {v.streak.kept}/{v.streak.total} kept</div>
                  <div className="mt-3 flex gap-1" aria-label="last windows">
                    {v.history.length === 0 ? <span className="text-xs opacity-60">no windows yet</span> : v.history.map((h: any, j: number) => (
                      <span key={j} title={h.frozen ? "frozen" : h.result} className="h-5 w-5 rounded-full border border-ink" style={{ background: h.frozen ? "#ffe0cc" : CHIP[h.result] ?? "#e8dcc8" }} />))}
                  </div>
                </li>))}
            </ul>)}
        </section>

        <section>
          <h2 className="display text-4xl">Stickers</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {d.stickers.length === 0 ? <p className="text-sm opacity-70">None earned yet.</p> : d.stickers.map((s: any) => <Sticker key={s.id} icon={s.icon} color={s.color} size={56} title={s.name} />)}
          </div>
        </section>

        {!d.isMe && (
          <section className="card" style={{ background: "#d4efd9" }}>
            <h2 className="display text-4xl">Cheer them on</h2>
            {!d.signedIn ? <p className="mt-3 text-sm">Connect a wallet on the <Link className="underline" href="/people">Squad page</Link> to send a cheer.</p> : (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">{CHEERS.map((c) => <button key={c} onClick={() => setEmoji(c)} aria-pressed={emoji === c} className="pill h-12 w-12 text-2xl" style={{ background: emoji === c ? "#ffc2d6" : "#fff" }}>{c}</button>)}</div>
                <input className="field" maxLength={80} placeholder="Say something nice (optional, 80 chars)" value={msg} onChange={(e) => setMsg(e.target.value)} />
                <Btn fill busy={busy.cheer} onClick={() => act("cheer", async () => { await api("/api/social", "POST", { action: "cheer", handle: d.handle, emoji, msg }); setMsg(""); await load(); }, "Cheer sent!")}>SEND CHEER</Btn>
              </div>)}
          </section>)}
      </main>
    </>
  );
}
