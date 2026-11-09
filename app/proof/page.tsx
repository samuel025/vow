"use client";
import { useEffect, useState } from "react";

type Remote = { blob_id: string; end_epoch: number | null; expires_at: string | null; status: string };
type Rec = { id: string; text: string };

export default function Proof() {
  const [d, setD] = useState<{ live: boolean; records: Rec[]; remote: Remote[] } | null>(null);
  useEffect(() => { fetch("/api/memory").then((r) => r.json()).then(setD); }, []);
  const real = d?.records.filter((r) => !r.text.includes("SIMULATED")).length ?? 0;

  return (
    <main style={{ background: "#ffe0cc" }} className="min-h-screen">
      <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 sm:px-8">
        <a href="/" className="pill inline-block px-4 py-2 text-xs">← BACK TO VOW</a>
        <h1 className="display text-7xl">Memory proof</h1>
        {!d ? <div className="sk h-40" /> : <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="pill px-4 py-2" style={{ background: d.live ? "#17142e" : "#ffc2d6", color: d.live ? "#fffaf0" : "#17142e" }}>{d.live ? "WALRUS MEMORY · LIVE" : "LOCAL MOCK · SET MEMWAL KEYS TO GO LIVE"}</span>
            <span className="pill px-4 py-2">{d.remote.length} BLOBS ON WALRUS</span>
            <span className="pill px-4 py-2">{real} REAL RECORDS · {d.records.length - real} SIMULATED</span>
          </div>
          <section className="space-y-2">
            <h2 className="display text-3xl" style={{ lineHeight: 1 }}>On Walrus</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {d.remote.map((m) => (
                <div key={m.blob_id} className="card !p-4 text-xs" style={{ background: "#fffaf0", borderRadius: 20 }}>
                  <div className="break-all font-bold">{m.blob_id}</div>
                  <div className="mt-1 opacity-70">{m.status} · end epoch {m.end_epoch ?? "pending"} · expires {m.expires_at?.slice(0, 10) ?? "pending"}</div>
                </div>))}
              {d.remote.length === 0 && <p className="text-sm">Nothing on Walrus yet.</p>}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="display text-3xl" style={{ lineHeight: 1 }}>Local mirror</h2>
            {d.records.slice().reverse().map((r) => (
              <pre key={r.id} className="card !p-3 overflow-x-auto text-xs" style={{ background: r.text.includes("SIMULATED") ? "#d4efd9" : "#fffaf0", borderRadius: 16 }}>{r.text}</pre>))}
          </section>
        </>}
      </div>
    </main>
  );
}
