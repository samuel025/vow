"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Btn, useAct, useToast } from "../ui";
import { ConnectPanel, WalletChip, useMe } from "../wallet";

export default function People() {
  const { me, loading, demoAvailable, refresh } = useMe();
  const [d, setD] = useState<any>(null);
  const [handle, setHandle] = useState("");
  const [pub, setPub] = useState(true);
  const { say, node } = useToast();
  const { busy, act } = useAct(say);
  const load = () => api("/api/people", "GET").then((r) => { setD(r); if (r.me?.handle) { setHandle((h) => h || r.me.handle); setPub(r.me.public); } }).catch(() => setD({ board: [], feed: [], inbox: [], me: null }));
  useEffect(() => { load(); }, [me?.address]);

  const verified = !!me?.verified;
  return (
    <>
      {node}
      <nav className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link className="pill grid h-11 w-11 place-items-center text-lg" href="/">V</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="pill px-4 py-2 text-xs" href="/">MY VOWS</Link>
          {me && <WalletChip me={me} onLogout={() => { refresh(); load(); }} />}
        </div>
      </nav>
      <header style={{ background: "#e9ccff" }}>
        <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
          <h1 className="display text-[clamp(64px,12vw,140px)]">Squad</h1>
          <p className="mt-4 max-w-xl text-xl font-bold">Players keep real vows, verified on-chain. Follow people, cheer them on, climb the board. Only habit names, streaks and results are ever public. Never amounts or addresses.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-10 px-4 py-10 sm:px-8">
        {!loading && !me && <ConnectPanel demoAvailable={demoAvailable} onDone={refresh} />}
        {me && !verified && <p className="pill px-4 py-3 text-sm">You&apos;re browsing as a {me.demo ? "demo" : "guest"}. Disconnect and connect a wallet to join the community.</p>}

        {verified && (
          <section className="card bg-white" style={{ background: "#dceeff" }}>
            <h2 className="display text-4xl">Your player card</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-xs font-bold tracking-wider">HANDLE
                <input className="field mt-1 w-64" placeholder="e.g. sam_saves" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={20} />
              </label>
              <label className="flex items-center gap-2 pb-3 text-sm font-bold"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Show me on the leaderboard</label>
              <Btn fill busy={busy.profile} onClick={() => act("profile", async () => { await api("/api/profile", "POST", { handle, public: pub }); await Promise.all([load(), refresh()]); }, "Saved")}>{d?.me?.handle ? "UPDATE" : "JOIN THE SQUAD"}</Btn>
              {d?.me?.handle && d.me.public && <Link className="btn" href={`/u/${d.me.handle}`}>VIEW MY PUBLIC PAGE</Link>}
            </div>
            <p className="mt-3 text-xs opacity-70">Public: your handle, level, streaks, stickers and the kept/missed strip of each vow. Not public: amounts, tokens, destinations, wallet address.</p>
          </section>
        )}

        <section>
          <h2 className="display text-5xl">Leaderboard</h2>
          {!d ? <div className="sk mt-4 h-40" /> : d.board.length === 0 ? <p className="mt-4 text-sm opacity-70">Nobody is on the board yet. Be the first!</p> : (
            <ol className="mt-4 space-y-3">
              {d.board.map((p: any, i: number) => (
                <li key={p.handle} className="card flex flex-wrap items-center gap-4 bg-white" style={{ borderRadius: 24, padding: 16, background: p.me ? "#ffd731" : "#fff" }}>
                  <span className="display text-4xl" style={{ width: 48 }}>{i + 1}</span>
                  <div className="min-w-[140px] flex-1">
                    <Link href={`/u/${p.handle}`} className="text-lg font-bold underline">@{p.handle}</Link>{p.me && <span className="ml-2 text-xs font-bold">(you)</span>}
                    <div className="text-xs opacity-70">Level {p.total.level} · {p.total.title}{p.simulated ? " · includes simulated demo data" : ""}</div>
                  </div>
                  <div className="text-sm font-bold">{p.total.xp} XP</div>
                  <div className="text-sm">🔥 best {p.best}</div>
                  <div className="text-sm">🏷️ {p.stickers}</div>
                  <div className="text-xs opacity-70">{p.followers} follower{p.followers === 1 ? "" : "s"}</div>
                  {verified && !p.me && (
                    <Btn busy={busy[`f:${p.handle}`]} onClick={() => act(`f:${p.handle}`, async () => { await api("/api/social", "POST", { action: p.following ? "unfollow" : "follow", handle: p.handle }); await load(); })}>{p.following ? "FOLLOWING ✓" : "FOLLOW"}</Btn>)}
                </li>))}
            </ol>)}
        </section>

        {verified && (
          <section>
            <h2 className="display text-5xl">Following</h2>
            {!d ? <div className="sk mt-4 h-24" /> : d.feed.length === 0 ? <p className="mt-4 text-sm opacity-70">Follow someone from the leaderboard to see how their vows are going.</p> : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.feed.map((f: any, i: number) => (
                  <li key={i} className="card bg-white" style={{ borderRadius: 24, padding: 16 }}>
                    <Link href={`/u/${f.handle}`} className="font-bold underline">@{f.handle}</Link>
                    <div className="mt-1 text-lg font-bold">{f.vow}</div>
                    <div className="text-sm">{f.last === "kept" ? "✅ kept last window" : f.last === "missed" ? "❌ missed last window" : "no verified window yet"} · 🔥 streak {f.streak}</div>
                  </li>))}
              </ul>)}
          </section>)}

        {verified && (
          <section>
            <h2 className="display text-5xl">Cheers for you</h2>
            {!d ? <div className="sk mt-4 h-24" /> : d.inbox.length === 0 ? <p className="mt-4 text-sm opacity-70">No cheers yet. Share your public page and ask a friend to cheer you on.</p> : (
              <ul className="mt-4 space-y-2">
                {d.inbox.map((c: any) => (
                  <li key={c.id} className="pill flex items-center gap-3 px-4 py-2 text-sm"><span className="text-2xl">{c.emoji}</span><b>@{c.from}</b><span className="opacity-80">{c.msg}</span></li>))}
              </ul>)}
          </section>)}
      </main>
    </>
  );
}
