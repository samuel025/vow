import { connection } from "next/server";
import { allLocal, isLive, remoteProof } from "@/lib/memory";
import { rulesOf } from "@/lib/store";
import { getUser } from "@/lib/auth";
export async function GET() {
  await connection();
  const u = await getUser();
  const mine = new Set(u ? rulesOf(u.owner).map((r) => r.id) : []);
  let remote: unknown[] = []; try { remote = await remoteProof(); } catch {}
  return Response.json({ live: isLive(), records: allLocal().filter((r) => mine.has(r.mem.ruleId)), remote });
}
