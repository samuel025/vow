// Poller: node --env-file=.env --import tsx scripts/watch.ts [minutes]  (or: npx tsx --env-file=.env scripts/watch.ts 30)
// Requires the app running and VOW_CRON_SECRET set in .env. Checks every wallet's vows.
const mins = Number(process.argv[2] ?? 30);
const secret = process.env.VOW_CRON_SECRET;
if (!secret) { console.error("Set VOW_CRON_SECRET in .env (any long random string) and restart the app."); process.exit(1); }
const tick = async () => {
  try {
    const r = await (await fetch("http://localhost:3000/api/run", { method: "POST", headers: { "x-vow-cron": secret } })).json();
    console.log(new Date().toISOString(), r.error ?? "ok", r.owners ?? 0, "wallet(s) checked");
  } catch (e) { console.log("tick failed", String(e)); }
};
tick(); setInterval(tick, mins * 60_000);
