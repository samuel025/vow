import { connection } from "next/server";
import { ADDR, addrOf, challenge, checkChallenge, endSession, getUser, startSession } from "@/lib/auth";
import { profileOf } from "@/lib/social";
import { getRules, ownerOf, setRules } from "@/lib/store";
import { cloneLocal } from "@/lib/memory";

export async function GET() {
  await connection();
  const user = await getUser();
  return Response.json({ user: user && { address: user.address, verified: user.verified, demo: !!user.demo, handle: user.verified ? profileOf(user.owner)?.handle ?? null : null }, demoAvailable: ADDR.test((process.env.SUI_ADDRESS ?? "").toLowerCase()) });
}

async function verifySig(message: string, signature: string, address: string) {
  const { verifyPersonalMessageSignature } = await import("@mysten/sui/verify");
  const bytes = new TextEncoder().encode(message);
  try { return (await verifyPersonalMessageSignature(bytes, signature, { address })).toSuiAddress(); }
  catch (e) {
    // zkLogin accounts (e.g. "Sign in with Google" in Slush) need a node to check the proof
    const { SuiGraphQLClient } = await import("@mysten/sui/graphql");
    const client = new SuiGraphQLClient({ url: "https://graphql.mainnet.sui.io/graphql", network: "mainnet" });
    try { return (await verifyPersonalMessageSignature(bytes, signature, { address, client })).toSuiAddress(); }
    catch { throw e; }
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "").toLowerCase();
  switch (body.action) {
    case "nonce":
      if (!ADDR.test(address)) return Response.json({ error: "That doesn't look like a Sui address" }, { status: 400 });
      return Response.json({ message: challenge(address).message });
    case "login": {
      const { message, signature } = body as { message: string; signature: string };
      if (!ADDR.test(address) || typeof message !== "string" || typeof signature !== "string") return Response.json({ error: "Bad sign-in request" }, { status: 400 });
      if (!checkChallenge(address, message)) return Response.json({ error: "Sign-in expired. Try again." }, { status: 400 });
      let signer: string;
      try { signer = await verifySig(message, signature, address); } catch (e) { console.error("sig verify failed:", String(e)); return Response.json({ error: "Couldn't verify that signature" }, { status: 401 }); }
      if (signer.toLowerCase() !== address) return Response.json({ error: "Signature doesn't match that wallet" }, { status: 401 });
      await startSession({ address, verified: true });
      return Response.json({ ok: true });
    }
    case "guest":
      if (!ADDR.test(address)) return Response.json({ error: "Paste a full Sui address (0x + 64 hex characters)" }, { status: 400 });
      await startSession({ address, verified: false });
      return Response.json({ ok: true });
    case "demo": {
      const d = (process.env.SUI_ADDRESS ?? "").toLowerCase();
      if (!ADDR.test(d)) return Response.json({ error: "No demo wallet configured" }, { status: 400 });
      const sid = crypto.randomUUID().slice(0, 8), owner = `demo:${d}:${sid}`;
      // private sandbox: a copy of the demo wallet's vows (and their local history), so judges can edit and delete freely
      const mine = getRules().filter((r) => ownerOf(r) === d);
      const copies = mine.map((r) => ({ ...r, id: crypto.randomUUID(), owner, buddy: undefined }));
      mine.forEach((r, i) => cloneLocal(r.id, copies[i].id, r.name));
      if (copies.length) setRules([...getRules(), ...copies]);
      await startSession({ address: d, verified: false, demo: true, sid });
      return Response.json({ ok: true });
    }
    case "logout": await endSession(); return Response.json({ ok: true });
    default: return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
