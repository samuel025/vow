import { readFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
for (const l of readFileSync(".env", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2]; }
const w = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY!, accountId: process.env.MEMWAL_ACCOUNT_ID!, serverUrl: process.env.MEMWAL_SERVER_URL || undefined, namespace: process.env.MEMWAL_NAMESPACE ?? "vow" });
console.log("health", await w.health());
const r = await w.rememberAndWait("VOW_HABIT healthcheck " + new Date().toISOString());
console.log("write", r);
const list: any = await w.listMemories({});

const v: any = await w.listMemories({ namespace: "vow" } as any);
console.log("VOW", (v.memories ?? []).filter((m: any) => m.namespace_id === "vow").map((m: any) => ({ blob: m.blob_id, end_epoch: m.end_epoch, expires_at: m.expires_at, status: m.status })));
