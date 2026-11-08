import fs from "node:fs";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Wallet sign-in. The user signs a one-time message with their Sui wallet (no transaction, no gas, no funds move),
 * the server verifies the signature and sets a signed, httpOnly session cookie.
 *  - verified: proved ownership of the address → can use social features
 *  - guest:    pasted an address (read-only, own sandbox, no social)
 *  - demo:     opens the wallet configured in .env (read-only demo, no social)
 */
export interface User { address: string; owner: string; verified: boolean; demo?: boolean }

const COOKIE = "vow_session";
const DAY = 86_400_000;
export const ADDR = /^0x[0-9a-f]{64}$/;

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const f = "data/auth-secret.txt";
  try { return fs.readFileSync(f, "utf8"); } catch {}
  const s = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const mac = (s: string) => crypto.createHmac("sha256", secret()).update(s).digest("base64url");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function seal(payload: object) { const b = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${b}.${mac(b)}`; }
function unseal<T>(tok: string | undefined): T | null {
  if (!tok) return null;
  const [b, m] = tok.split(".");
  if (!b || !m || !same(m, mac(b))) return null;
  try { return JSON.parse(Buffer.from(b, "base64url").toString()); } catch { return null; }
}

/** One-time sign-in message. The nonce is a signed timestamp, valid for 5 minutes. */
export function challenge(address: string) {
  const issued = Date.now(), nonce = `${issued}.${crypto.randomBytes(8).toString("hex")}`;
  return { nonce, message: `Sign in to Vow\nThis only proves you own the wallet. It is not a transaction and costs nothing.\nAddress: ${address}\nNonce: ${nonce}.${mac(`${address}|${nonce}`)}` };
}
export function checkChallenge(address: string, message: string) {
  const m = /^Sign in to Vow\n[^\n]*\nAddress: (0x[0-9a-f]{64})\nNonce: (\d+)\.([0-9a-f]+)\.(.+)$/.exec(message);
  if (!m || m[1] !== address) return false;
  const nonce = `${m[2]}.${m[3]}`;
  return Date.now() - Number(m[2]) < 5 * 60_000 && Number(m[2]) <= Date.now() && same(m[4], mac(`${address}|${nonce}`));
}

export async function startSession(u: { address: string; verified: boolean; demo?: boolean; sid?: string }) {
  (await cookies()).set(COOKIE, seal({ ...u, exp: Date.now() + 7 * DAY }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400, secure: process.env.NODE_ENV === "production",
  });
}
export async function endSession() { (await cookies()).delete(COOKIE); }

export async function getUser(): Promise<User | null> {
  const s = unseal<{ address: string; verified: boolean; demo?: boolean; sid?: string; exp: number }>((await cookies()).get(COOKIE)?.value);
  if (!s || s.exp < Date.now() || !ADDR.test(s.address)) return null;
  // verified: own namespace. demo: a private sandbox per visitor, cloned from the .env wallet. guest: private sandbox, can't touch anyone else's data.
  const owner = s.verified ? s.address : s.demo ? `demo:${s.address}:${s.sid ?? "x"}` : `guest:${s.address}`;
  return { address: s.address, owner, verified: !!s.verified, demo: s.demo };
}

/** The chain address behind an owner key (verified address, guest:<addr> or demo:<addr>:<sid>). */
export const addrOf = (owner: string) => owner.match(/0x[0-9a-f]{64}/)?.[0] ?? owner;

export const unauthorized = () => Response.json({ error: "Connect your wallet first" }, { status: 401 });
