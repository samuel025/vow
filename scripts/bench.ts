import { mulberry, randUser, simulate } from "../lib/sim";
const N = 200, WEEKS = 12; const rnd = mulberry(42);
let m = 0, f = 0;
for (let i = 0; i < N; i++) { const u = randUser(rnd); m += simulate(u, WEEKS, "memory", rnd).keptRate; f += simulate(u, WEEKS, "fixed", rnd).keptRate; }
console.log(`SIMULATED, ${N} users x ${WEEKS} weeks\nmemory-guided kept rate: ${(m / N * 100).toFixed(1)}%\nfixed reminder kept rate: ${(f / N * 100).toFixed(1)}%`);
