import fs from "node:fs";
import type { HabitMemory } from "./types";

const FILE = "data/memory.mock.json";
const PREFIX = "VOW_HABIT ";

interface Rec { id: string; text: string; mem: HabitMemory; created_at: string }

function local(): Rec[] { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } }
function save(r: Rec[]) { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(r, null, 2)); }

/** Copy a rule's local records to another rule id (demo sandboxes). Local mirror only, never Walrus. */
export function cloneLocal(fromRuleId: string, toRuleId: string, toName: string) {
  const all = local();
  const copies = all.filter((r) => r.mem.ruleId === fromRuleId).map((r) => { const mem = { ...r.mem, ruleId: toRuleId, ruleName: toName }; return { ...r, id: crypto.randomUUID(), mem, text: toText(mem) }; });
  if (copies.length) save([...all, ...copies]);
}

export const isLive = () => !!process.env.MEMWAL_PRIVATE_KEY && !!process.env.MEMWAL_ACCOUNT_ID;

async function client() {
  const { MemWal } = await import("@mysten-incubation/memwal");
  return MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY!, serverUrl: process.env.MEMWAL_SERVER_URL || undefined, accountId: process.env.MEMWAL_ACCOUNT_ID!,
    namespace: process.env.MEMWAL_NAMESPACE ?? "vow",
  });
}

export const toText = (m: HabitMemory) =>
  `${PREFIX}${JSON.stringify(m)}`;

/** Write a habit record. The local mirror is written immediately; the Walrus write runs in the background (the relayer takes seconds). */
export async function remember(m: HabitMemory) {
  const rec: Rec = { id: crypto.randomUUID(), text: toText(m), mem: m, created_at: new Date().toISOString() };
  save([...local(), rec]);
  if (isLive()) {
    void (async () => {
      try { await (await client()).remember(rec.text); remoteClear(); }
      catch (e) { console.error("walrus write failed, kept in local mirror:", String(e)); }
    })();
  }
  return rec.id;
}

type RemoteRec = { id: string; mem: HabitMemory; key: string };
let remoteAll: { at: number; recs: RemoteRec[] } | null = null;
let inflight: Promise<RemoteRec[]> | null = null;
const remoteClear = () => { remoteAll = null; };
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** One Walrus recall for the whole namespace, shared by every rule, cached 5 min, 3 s timeout. */
function remoteRecall(): Promise<RemoteRec[]> {
  if (remoteAll && Date.now() - remoteAll.at < 5 * 60_000) return Promise.resolve(remoteAll.recs);
  inflight ??= (async () => {
    try {
      const { results } = await withTimeout((await client()).recall({ query: PREFIX.trim(), limit: 100 }), 3000);
      const recs = results.filter((r) => r.text.startsWith(PREFIX)).flatMap((r) => {
        try { return [{ id: r.blob_id, mem: JSON.parse(r.text.slice(PREFIX.length)) as HabitMemory, key: r.text }]; } catch { return []; }
      });
      remoteAll = { at: Date.now(), recs };
      return recs;
    } catch { remoteAll = { at: Date.now() - 4 * 60_000, recs: remoteAll?.recs ?? [] }; return remoteAll.recs; } // retry in ~1 min
    finally { inflight = null; }
  })();
  return inflight;
}

/** Local mirror (instant) merged with Walrus recall (cached 5 min, 3 s timeout). */
export async function recall(ruleId: string): Promise<{ id: string; mem: HabitMemory }[]> {
  const loc = local().filter((r) => r.mem.ruleId === ruleId).map((r) => ({ id: r.id, mem: r.mem, key: r.text }));
  const live = isLive() ? (await remoteRecall()).filter((r) => r.mem.ruleId === ruleId) : [];
  const seen = new Set<string>(), out = [];
  for (const r of [...live, ...loc]) if (!seen.has(r.key)) { seen.add(r.key); out.push({ id: r.id, mem: r.mem }); }
  return out;
}

export const allLocal = () => local();

/** Remote proof: metadata of this namespace's memories on Walrus (blob id, end epoch, expiry). */
export async function remoteProof() {
  if (!isLive()) return [];
  const ns = process.env.MEMWAL_NAMESPACE ?? "vow";
  const v: any = await (await client()).listMemories({ namespace: ns } as any);
  return (v.memories ?? []).filter((m: any) => m.namespace_id === ns).map((m: any) => ({ blob_id: m.blob_id, end_epoch: m.end_epoch, expires_at: m.expires_at, status: m.status }));
}
