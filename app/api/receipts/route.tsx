import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { rulesOf } from "@/lib/store";
import { getUser, unauthorized } from "@/lib/auth";
import { recall } from "@/lib/memory";
import { streakInfo } from "@/lib/streak";

export async function GET() {
  await connection();
  const u = await getUser(); if (!u) return unauthorized();
  const rules = rulesOf(u.owner);
  const rows = await Promise.all(rules.map(async (r) => ({ r, s: streakInfo((await recall(r.id)).map((x) => x.mem)) })));
  return new ImageResponse(
    (<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0b1020", color: "#fff", padding: 48, fontSize: 32 }}>
      <div style={{ fontSize: 56, fontWeight: 700 }}>Vow · weekly receipts</div>
      {rows.slice(0, 4).map(({ r, s }) => (
        <div key={r.id} style={{ display: "flex", marginTop: 28 }}>
          {r.name}: {s.kept}/{s.total} kept · streak {s.current} · best {s.best}
        </div>))}
      <div style={{ display: "flex", marginTop: "auto", fontSize: 22, opacity: 0.7 }}>
        {rows.flatMap(({ s }) => s.list.slice(-1).map((m) => m.window)).join(" · ")} · verified on Sui via Tatum, remembered in Walrus
      </div>
    </div>), { width: 1200, height: 630 });
}
