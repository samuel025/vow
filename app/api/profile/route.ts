import { getUser, unauthorized } from "@/lib/auth";
import { profileOf, setProfile } from "@/lib/social";

export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  if (!u.verified) return Response.json({ error: "Connect a wallet (sign in) to join the community" }, { status: 403 });
  const { handle, public: pub } = await req.json();
  const err = setProfile(u.owner, handle, pub !== false);
  if (err) return Response.json({ error: err }, { status: 400 });
  return Response.json(profileOf(u.owner));
}
