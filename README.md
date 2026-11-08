# Vow

**The chain is the judge. Memory shapes the nudge.**

Vow is a habit coach for your money. You make a vow ("send at least 5 SUI to my savings address every Friday"). Vow checks whether you kept it by reading **real Sui mainnet transactions** through the **Tatum** gateway, remembers your streaks, misses and what nudges worked in **Walrus Memory**, and uses that history to choose the next nudge.

Built for the Tatum × Walrus *Total Recall* hackathon (Track 2: Smart Agents for Real Life, plus Best Walrus Memory).

- **No self-reports.** A week is *kept* or *missed* from transaction data, with the digests as proof. If the chain can't be reached the window is *unverified*, never silently missed.
- **No custody.** Vow only reads the chain. It never signs, holds or moves funds.
- **Memory that changes behaviour.** The nudge style and tone are chosen from recalled records, and a "Why this nudge?" panel cites the records behind each choice.

## How it works

```
 your vows ──▶ chain watcher ──▶ verifier ──▶ memory writer ──▶ nudge engine
 (rules)       Tatum Sui         kept/missed/   Walrus Memory     picks style + tone
               GraphQL           unverified     (+ local mirror)  from past outcomes
                                 + tx digests                          │
        dashboard · sticker album · ghost race · buddy pings ◀─────────┘
```

| Part | Where | What it does |
|---|---|---|
| Chain watcher | `lib/tatum.ts` | Fetches the wallet's recent sent transactions (balance changes, Move calls) from Tatum's Sui GraphQL gateway, bounded to the gateway's retention window. |
| Verifier | `lib/verifier.ts` | Deterministic, no LLM, ever. Four habit types: **recurring save**, **spend cap**, **quiet hours**, **recurring stake**. Outputs kept / missed / unverified with evidence digests. |
| Memory | `lib/memory.ts` | Writes one short record per window to Walrus Memory (background job), mirrors locally so the UI is instant, and recalls with a cache and timeout. |
| Nudge engine | `lib/nudge.ts`, `lib/coach.ts` | Per-style kept rate from history; tries untested styles first; proposes moving the window when misses cluster on one weekday. Tone (drill, gentle, pirate) is chosen the same way. |
| Game layer | `lib/game.ts`, `lib/streak.ts` | Streaks, freezes, XP and levels, weekly quest, sticker album, ghost race. All derived from verified windows. |
| Buddy pings | `lib/buddy.ts` | Opt-in accountability messages (see below). |

### Wallet sign-in and the squad

- **Connect wallet.** Sign in with any Sui wallet (Slush etc.) via the Wallet Standard. You sign one off-chain message to prove ownership: not a transaction, no gas, no funds move. The server verifies the signature (including zkLogin accounts) and sets a signed httpOnly session cookie. Every wallet has its own vows, memory and stickers; nobody can read or change another wallet's vows.
- **Guest and demo modes.** Paste any address to browse read-only in a private sandbox, or open the `.env` demo wallet. Neither can use the social features, because ownership isn't proven.
- **Squad (social).** Pick a handle, opt in to the public leaderboard, follow players, see how their vows are going, and send them cheers (5 stickers + 80 chars, rate-limited). Public profiles at `/u/<handle>` show level, streaks, stickers and the kept/missed strip. Never amounts, tokens, destinations or addresses. Any simulated demo history is labelled.

### Fun layer

- **Streaks and freezes.** Earn a freeze per 4-window streak and spend it to forgive a miss. Freezes are memory records.
- **XP and levels.** +10 per kept window, +20 per sticker, bonus for your best streak, +30 for beating the ghost.
- **Sticker album.** Collectible stickers earned from real behaviour, from *First Win* to *Ghostbuster*, plus one per habit type.
- **Weekly quest.** Built from your weak spot, e.g. "Beat your Thursday record".
- **Ghost race.** Your latest windows race the windows before them, rebuilt from memory.
- **Ask your coach.** Ask anything about a habit in plain language. With an AI key it answers from your recalled records only and cites them; without one it falls back to a rule-based answer.
- **Say your vow.** Type "save 20 USDC to 0x… every Thursday" and an AI model drafts the rule for you to review. Output is validated field by field and nothing is saved until you confirm.
- **Receipts card.** `/api/receipts` renders a shareable PNG of the week.
- **Buddy pings.** Tell an accountability buddy when you miss (opt-in per habit).

### Buddy pings and privacy

Messages contain only the **habit name, the result, your streak and the window date**. Never amounts, tokens or addresses. Auto-pings are off unless you tick the box on a vow; every message (sent or previewed) appears word for word in the Buddy inbox. Channels: share manually (default, no setup), Telegram bot, or a public HTTPS Discord/Slack webhook (localhost and private hosts are rejected).

Walrus Memory namespaces are public on chain and the relayer sees plaintext, so memory records hold habit names, results and styles only. Wallet addresses are already public.

## Quick start

Requirements: Node 20+ and npm.

```bash
npm install
cp .env.example .env      # then fill in your keys
npm run dev               # http://localhost:3000
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `TATUM_API_KEY` | yes | Tatum gateway key (sent as `x-api-key`) |
| `SUI_ADDRESS` | no | Optional demo wallet shown behind the "Open demo wallet" button. Real users connect their own wallet. |
| `MEMWAL_PRIVATE_KEY` | for live memory | Walrus Memory delegate key |
| `MEMWAL_ACCOUNT_ID` | for live memory | `MemWalAccount` object id on Sui |
| `MEMWAL_SERVER_URL` | no | Relayer URL (default `https://relayer.memory.walrus.xyz`) |
| `MEMWAL_NAMESPACE` | no | Namespace for records (default `vow`). Use a fresh one for a clean demo. |
| `VOW_OWNER_NAME` | no | How buddy messages refer to you |
| `TELEGRAM_BOT_TOKEN` | no | Enables Telegram delivery for buddy pings |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | no | Enables AI coach answers and vow drafting (Claude if set, else Gemini). Without one, the coach is rule-based and vows use the form. |

Without the Walrus keys Vow runs on a local mirror only. Without a Tatum key every window shows *unverified*.

### Using it

1. **Make a vow** from a template, or build your own. The form previews your vow in plain English.
2. **Check chain.** The last *completed* window is verified against your transactions.
3. Open **Proof** (`/proof`) to see your Walrus blobs with storage end epoch and expiry.
4. Add a **buddy**, miss a window, tell your coach why, collect stickers.

Units: amounts are in human units (SUI = 1e9 MIST, USDC = 1e6). For a non-SUI token, enter the full coin type (`0x…::usdc::USDC`).

### Where AI is (and isn't) used

The model **never decides a result**. Kept / missed / unverified, streaks, XP and nudge choice are all deterministic code over chain data and memory. The model only (1) phrases coach answers from the recalled records you hand it, with `[n]` citations that are resolved back to real records, and (2) drafts a vow from a sentence. When AI is enabled, your question or sentence and the relevant record summaries (habit names, results, weekdays, reasons you typed) are sent to the provider; no addresses or amounts are included in coach prompts.

## Verifying it yourself

1. Pick a transaction from your wallet in the last few days (Tatum serves a limited history window) and note its digest on Suiscan.
2. Create a matching vow. For a *recurring save*, the destination must be an address that received the token in that transaction, with a weekday whose window contains it.
3. Click **Check chain**. The vow should be **kept** with that digest as evidence.
4. Raise the amount above what was received. It should flip to **missed**.
5. Put a wrong `TATUM_API_KEY` in `.env`, restart and check again. The window should be **unverified**, not missed.

The checker only judges the last completed window, so a transaction sent today counts tomorrow.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Dev server / production build |
| `npx tsx scripts/bench.ts` | Simulated-user benchmark: memory-guided vs fixed nudging |
| `npx tsx --env-file=.env scripts/watch.ts 30` | Poller that checks every wallet's vows every 30 minutes (app running, `VOW_CRON_SECRET` set) |
| `npx tsx scripts/walrus-check.mts` | Relayer health, a test write, and your namespace's blobs with end epochs |

### Benchmark (simulated)

200 simulated users over 12 weeks, each with hidden per-weekday and per-style response rates. Memory-guided nudging reached a **64.0%** kept rate against **55.0%** for a fixed reminder. This is simulation only and says nothing about real behaviour change. The "Seed demo history" button fills **simulated** history (clearly labelled, local only, never written to Walrus) so the dashboard has something to show; verification itself always runs on real chain data.

## Known limits

- **Short Tatum history.** The gateway only serves recent Sui history, so old windows can't be re-derived. Vow persists observations as it sees them; poll regularly.
- **Sui mainnet, four rule types.** Deliberate MVP scope. Data is stored in local JSON files, so this is a demo-scale multi-user app, not a production database.
- **Shared Walrus delegate key.** All wallets' memory records are written with the app's one delegate key into one namespace, so record text (habit names, results) is public on Walrus.
- **Walrus writes take seconds** and run in the background. If one fails it is logged and the record stays in the local mirror.
- **Memory expiry.** Walrus blobs have an end epoch. The Proof page shows each one; extend before it lapses.
- **Local storage.** Rules, the local mirror and the buddy outbox live in `data/` (git-ignored).
- Behaviour claims come from a simulated user, not real users.

## Project layout

```
app/                 Next.js app (dashboard, /proof) and API routes (rules, run, overview, buddy, coach, freeze, seed, receipts, memory)
lib/                 verifier, nudge + coach, memory, tatum, streak, game, buddy, store
scripts/             benchmark, poller, Walrus check
data/                local state (git-ignored)
```

Built with Next.js, TypeScript, Tailwind, `@mysten-incubation/memwal` (Walrus Memory) and Tatum's Sui gateway.
