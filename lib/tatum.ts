import type { Tx } from "./types";

const URL_ = process.env.TATUM_GRAPHQL_URL ?? "https://sui-mainnet.gateway.tatum.io/graphql";
let lowest = 0; // earliest checkpoint Tatum serves; learned from its out-of-range error

const Q = `query($a:SuiAddress!,$c:UInt53,$n:Int){ transactions(last:$n, filter:{sentAddress:$a, afterCheckpoint:$c}){ nodes{
  digest sender{address}
  effects{ status timestamp checkpoint{sequenceNumber} balanceChanges{ nodes{ owner{address} coinType{repr} amount } } }
  kind{ __typename ... on ProgrammableTransaction{ commands{ nodes{ __typename
    ... on MoveCallCommand{ function{ name module{ name package{ address } } } } } } } } } } }`;

async function gql(address: string, n: number) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.TATUM_API_KEY ?? "" },
    body: JSON.stringify({ query: Q, variables: { a: address, c: lowest, n } }),
  });
  if (!r.ok) throw new Error(`Tatum ${r.status}`);
  return r.json();
}

/** Canonical short form so "0x000..02::sui::SUI" equals "0x2::sui::SUI". */
export const normCoin = (c: string) => c.replace(/^0x0+([0-9a-f])/i, "0x$1");

/** Fetch recent transactions sent by `address`. Throws on failure so callers mark windows unverified. */
export async function fetchSent(address: string, n = 50): Promise<Tx[]> {
  let j = await gql(address, n);
  const msg: string | undefined = j.errors?.[0]?.extensions?.chain?.[0];
  const m = msg?.match(/lowest available checkpoint is (\d+)/);
  if (m) { lowest = Number(m[1]); j = await gql(address, n); }
  if (j.errors) throw new Error(j.errors[0].message);
  // failed transactions moved nothing (beyond gas) and never count as evidence
  return (j.data.transactions.nodes as any[]).filter((t) => t.effects?.status !== "FAILURE").map((t): Tx => ({
    digest: t.digest,
    checkpoint: String(t.effects?.checkpoint?.sequenceNumber ?? ""),
    timestampMs: Date.parse(t.effects?.timestamp),
    sender: t.sender?.address ?? address,
    balanceChanges: (t.effects?.balanceChanges?.nodes ?? []).map((b: any) => ({
      owner: b.owner?.address ?? "", coinType: normCoin(b.coinType.repr), amount: Number(b.amount) })),
    commands: (t.kind?.commands?.nodes ?? []).map((c: any) =>
      c.function ? `${c.function.module.package.address}::${c.function.module.name}::${c.function.name}` : c.__typename),
  }));
}
