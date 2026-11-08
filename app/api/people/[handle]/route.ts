import { connection } from "next/server";
import { getUser } from "@/lib/auth";
import { byHandle, social, summaryFor } from "@/lib/social";

export async function GET(_: Request, ctx: { params: Promise<{ handle: string }> }) {
  await connection();
  const { handle } = await ctx.params;
  const u = await getUser(), v = u?.verified ? u : null;
  const hit = byHandle(handle);
  if (!hit || (!hit[1].public && v?.owner !== hit[0])) return Response.json({ error: "No such player" }, { status: 404 });
  const [o, p] = hit, S = social();
  return Response.json({
    handle: p.handle, public: p.public, ...(await summaryFor(o)),
    followers: S.follows.filter((f) => f.to === o).length,
    following: !!v && S.follows.some((f) => f.from === v.owner && f.to === o),
    cheers: S.cheers.filter((c) => c.to === o).length,
    isMe: v?.owner === o, signedIn: !!v,
    you: v && v.owner !== o ? await summaryFor(v.owner) : null,
  });
}
