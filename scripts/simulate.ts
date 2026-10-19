import { writeFileSync, mkdirSync } from "node:fs";
import {
  BALANCE,
  createMatch,
  missing,
  pinThreshold,
  rating,
  transition,
  type Match,
  type Action,
} from "../src/core/engine";
import { demos } from "../src/core/demo";
type Strategy = "daño" | "remate" | "conservadora";
const N = 10000,
  LIMIT = 500;
function choose(m: Match, s: Strategy, pinPolicy = "siempre"): Action {
  const a = m.attacker ?? 0,
    d = 1 - a;
  if (m.phase === "roll") return { type: "roll" };
  if (m.phase === "choose") {
    const f = m.fighters[a];
    const available = [4, 3, 2, 1, 0].filter((i) => !missing(f, i).length);
    let index = available[0];
    if (s === "remate")
      index =
        f.momentum >= 100 && available.includes(4)
          ? 4
          : available.includes(1)
            ? 1
            : 0;
    if (s === "conservadora")
      index =
        available.find(
          (i) =>
            i <= 2 && BALANCE.moves[i].energy <= Math.max(0, f.energy - 20),
        ) ?? 0;
    return { type: "move", index };
  }
  if (m.phase === "defend") {
    const f = m.fighters[d];
    const attempt =
      s === "daño"
        ? f.energy >= 20
        : s === "remate"
          ? f.energy >= 60
          : f.energy >= 40 && f.health <= 50;
    return { type: "defend", attempt };
  }
  return {
    type: "pin",
    attempt:
      pinPolicy === "siempre" ||
      pinThreshold(m.fighters[d].health, m.move!) >= 5000,
  };
}
const results: Record<string, unknown>[] = [];
for (const [ra, rb] of [
  [84, 84],
  [93, 84],
  [95, 70],
]) {
  for (const [sa, sb, pa, pb] of [
    ["daño", "daño", "siempre", "siempre"],
    ["remate", "remate", "siempre", "siempre"],
    ["conservadora", "conservadora", "siempre", "siempre"],
    ["daño", "remate", "siempre", "siempre"],
    ["remate", "conservadora", "siempre", "siempre"],
    ["conservadora", "daño", "siempre", "siempre"],
    ["daño", "daño", "siempre", "≥50%"],
  ] as [Strategy, Strategy, string, string][]) {
    let winsA = 0,
      winsB = 0,
      censored = 0,
      reversalAttempts = 0,
      reversalSuccess = 0,
      finishers = 0,
      attacks = 0,
      rounds = 0,
      pins = 0;
    const durations: number[] = [];
    const positions = [
      { a: 0, b: 0 },
      { a: 0, b: 0 },
    ];
    for (let i = 0; i < N; i++) {
      const swap = i % 2 === 1;
      const fA = { ...demos[0], base: ra, collectionBonus: 0, rarityBonus: 0 },
        fB = { ...demos[1], base: rb, collectionBonus: 0, rarityBonus: 0 };
      let m = createMatch(
        swap ? fB : fA,
        swap ? fA : fB,
        (123456789 + Math.imul(i + 1, 2654435761)) >>> 0,
      );
      while (m.phase !== "finished" && m.round <= LIMIT) {
        const actor =
          m.phase === "defend" ? 1 - (m.attacker ?? 0) : (m.attacker ?? 0);
        const isA = actor === (swap ? 1 : 0);
        const action = choose(m, isA ? sa : sb, isA ? pa : pb);
        const next = transition(m, action, m.revision);
        if (action.type === "move") {
          attacks++;
          if (action.index === 4) finishers++;
        }
        if (action.type === "defend" && action.attempt) {
          reversalAttempts++;
          if (next.reversalDie! >= 16) reversalSuccess++;
        }
        if (action.type === "pin" && action.attempt) pins++;
        // Reporting counts above retain all relevant events; discard logs/replays only in simulation to bound memory.
        next.events = [];
        next.replays = [];
        m = next;
      }
      rounds += Math.min(m.round, LIMIT);
      if (m.phase !== "finished") censored++;
      else {
        durations.push(m.round);
        if (m.winner === (swap ? 1 : 0)) {
          winsA++;
          positions[swap ? 1 : 0].a++;
        } else {
          winsB++;
          positions[swap ? 1 : 0].b++;
        }
      }
    }
    durations.sort((a, b) => a - b);
    const r = {
      ratings: `${ra} vs ${rb}`,
      strategyA: sa,
      strategyB: sb,
      pinA: pa,
      pinB: pb,
      matches: N,
      winsA,
      winsB,
      censored,
      median: durations[Math.floor(durations.length * 0.5)] ?? null,
      p90: durations[Math.floor(durations.length * 0.9)] ?? null,
      reversalAttempts,
      reversalSuccess,
      reversalSuccessPercent: +(
        (100 * reversalSuccess) /
        Math.max(1, reversalAttempts)
      ).toFixed(2),
      reversalAttemptsPerExchange: +(reversalAttempts / rounds).toFixed(3),
      finishers,
      finishersPer100Attacks: +((100 * finishers) / attacks).toFixed(2),
      pins,
      positions,
    };
    results.push(r);
    console.log(JSON.stringify(r));
  }
}
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/simulation-results.json",
  JSON.stringify(
    {
      seedFormula:
        "123456789 + imul(i+1, 2654435761), uint32; same seeds for paired policies",
      matchesPerScenario: N,
      technicalLimit: LIMIT,
      results,
    },
    null,
    2,
  ),
);
let md =
  "# Simulaciones reproducibles\n\nReglas iniciales sin cambios. `npm run simulate`. Cada fila contiene 10 000 partidas; se alternan posiciones (5000 por orientación). Semillas y contadores exactos en `simulation-results.json`. Límite técnico 500 intercambios: no concede victoria. Duraciones en intercambios; percentiles solo de partidas terminadas.\n\n";
md +=
  "Estrategias: **daño** elige el mayor daño disponible y revierte con ≥20 energía. **remate** reserva impulso (no usa personal), usa técnico mientras ahorra, remata con 100 impulso y 40 energía; revierte con ≥60 energía. **conservadora** elige el mayor golpe normal conservando 20 energía y solo revierte con salud ≤50 y energía ≥40. Todas intentan cuenta salvo la variante ≥50%. Mismas semillas por fila para comparar políticas.\n\n";
md +=
  "| Valoraciones A/B | Estrategias A/B | Cuenta A/B | Victorias A/B | Mediana / P90 | Reversal intentos / éxitos | Remates | Sin terminar |\n|---|---|---|---|---|---|---|---|\n";
for (const r of results)
  md += `| ${r.ratings} | ${r.strategyA} / ${r.strategyB} | ${r.pinA} / ${r.pinB} | ${r.winsA} / ${r.winsB} | ${r.median} / ${r.p90} | ${r.reversalAttempts} / ${r.reversalSuccess} | ${r.finishers} | ${r.censored} |\n`;
md +=
  "\nLas frecuencias por intercambio, remates por 100 ataques y victorias separadas por posición están en el JSON. Estos resultados son evidencia de estas políticas; no prueban equilibrio ni dominancia universal.\n";
writeFileSync("docs/BALANCE.md", md);
