import { getUser, unauthorized } from "@/lib/auth";
import { byHandle, cheer, follow, profileOf } from "@/lib/social";

export async function POST(req: Request) {
  const u = await getUser(); if (!u) return unauthorized();
  if (!u.verified) return Response.json({ error: "Connect a wallet (sign in) to use social features" }, { status: 403 });
  const { action, handle, emoji, msg } = await req.json();
  const hit = byHandle(String(handle ?? ""));
  if (!hit || !hit[1].public) return Response.json({ error: "No such player" }, { status: 404 });
  const to = hit[0];
  let err: string | null;
  if (action === "follow" || action === "unfollow") err = follow(u.owner, to, action === "follow");
  else if (action === "cheer") err = profileOf(u.owner) ? cheer(u.owner, to, emoji, msg) : "Pick a handle first so they know who cheered";
  else err = "Unknown action";
  if (err) return Response.json({ error: err }, { status: 400 });
  return Response.json({ ok: true });
}
