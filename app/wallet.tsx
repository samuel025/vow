"use client";
import { useEffect, useState } from "react";
import { getWallets } from "@mysten/wallet-standard";
import { api, Btn, useAct, useToast } from "./ui";

export interface Me { address: string; verified: boolean; demo: boolean; handle: string | null }

export function useMe() {
  const [state, setState] = useState<{ me: Me | null; demoAvailable: boolean } | undefined>(undefined);
  const refresh = () => api("/api/auth", "GET").then((r) => setState({ me: r.user, demoAvailable: r.demoAvailable })).catch(() => setState({ me: null, demoAvailable: false }));
  useEffect(() => { refresh(); }, []);
  return { loading: state === undefined, me: state?.me ?? null, demoAvailable: !!state?.demoAvailable, refresh };
}

function useSuiWallets() {
  const [wallets, setWallets] = useState<any[]>([]);
  useEffect(() => {
    const reg = getWallets();
    const upd = () => setWallets(reg.get().filter((w: any) => "standard:connect" in w.features && ("sui:signPersonalMessage" in w.features || "sui:signMessage" in w.features)));
    upd();
    const a = reg.on("register", upd), b = reg.on("unregister", upd);
    return () => { a(); b(); };
  }, []);
  return wallets;
}

async function signIn(wallet: any) {
  const { accounts } = await wallet.features["standard:connect"].connect();
  const acc = accounts.find((a: any) => a.chains?.some((c: string) => c.startsWith("sui:"))) ?? accounts.find((a: any) => /^0x[0-9a-fA-F]{64}$/.test(a.address));
  if (!acc) throw new Error("That wallet has no Sui account. Switch it to a Sui account or use another wallet.");
  const address = acc.address.toLowerCase();
  const { message } = await api("/api/auth", "POST", { action: "nonce", address });
  const f = wallet.features["sui:signPersonalMessage"] ?? wallet.features["sui:signMessage"]; // older wallets only have signMessage
  const { signature } = await (f.signPersonalMessage ?? f.signMessage)({ message: new TextEncoder().encode(message), account: acc });
  await api("/api/auth", "POST", { action: "login", address, message, signature });
}

/** Connect-wallet panel: real wallet sign-in, or read-only guest / demo. */
export function ConnectPanel({ demoAvailable, onDone }: { demoAvailable: boolean; onDone: () => void }) {
  const wallets = useSuiWallets();
  const { say, node } = useToast();
  const { busy, act } = useAct(say);
  const [addr, setAddr] = useState("");
  return (
    <div className="card bg-white" style={{ borderRadius: 32 }}>
      {node}
      <h3 className="display text-4xl">Connect wallet</h3>
      <p className="mt-3 text-sm opacity-80">You sign one message to prove the wallet is yours. It is <b>not a transaction</b>: no gas, no funds move, and Vow can never spend from your wallet.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {wallets.map((w) => (
          <Btn key={w.name} fill busy={busy[w.name]} onClick={() => act(w.name, async () => { await signIn(w); onDone(); })}>
            {w.icon && <img src={w.icon} alt="" width={18} height={18} />}{busy[w.name] ? "WAITING FOR WALLET…" : `CONNECT ${w.name.toUpperCase()}`}
          </Btn>))}
        {wallets.length === 0 && <p className="rounded-2xl border border-ink bg-cream p-3 text-sm">No Sui-capable wallet extension detected. Install any wallet that supports Sui (Slush, Backpack, Suiet, Phantom, Nightly, OKX…), enable its Sui account, and refresh. Or browse as a guest below.</p>}
      </div>
      {demoAvailable && (
        <div className="mt-5 rounded-3xl border border-ink p-4" style={{ background: "#ffc2d6" }}>
          <div className="font-bold">Just looking? Try the demo</div>
          <p className="mt-1 text-xs">No wallet needed. You get your own private sandbox with sample vows on a real mainnet wallet. Click Check chain, seed history, break things. It won&apos;t affect anyone else.</p>
          <Btn fill className="mt-3" busy={busy.demo} onClick={() => act("demo", async () => { await api("/api/auth", "POST", { action: "demo" }); onDone(); })}>TRY THE DEMO</Btn>
        </div>)}
      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-bold">Browse any address read-only</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs opacity-70">Guests get a private sandbox for any address they paste. Guests can&apos;t use the community features (profiles, follows, cheers) because ownership isn&apos;t proven.</p>
          <div className="flex flex-wrap gap-2">
            <input className="pill min-w-[260px] flex-1 px-4 py-2 text-sm" placeholder="0x… (full Sui address)" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
            <Btn busy={busy.guest} onClick={() => act("guest", async () => { await api("/api/auth", "POST", { action: "guest", address: addr }); onDone(); })}>BROWSE AS GUEST</Btn>
          </div>
        </div>
      </details>
    </div>
  );
}

export function WalletChip({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const { say } = useToast();
  const { busy, act } = useAct(say);
  const label = me.handle ? `@${me.handle}` : `${me.address.slice(0, 6)}…${me.address.slice(-4)}`;
  return (
    <span className="flex items-center gap-2">
      <span className="pill px-3 py-2 text-xs" title={me.address}>{me.verified ? "✓ " : me.demo ? "DEMO · " : "GUEST · "}{label}</span>
      <Btn busy={busy.out} onClick={() => act("out", async () => { await api("/api/auth", "POST", { action: "logout" }); onLogout(); })}>DISCONNECT</Btn>
    </span>
  );
}
