export const BALANCE = {
  health: 100,
  energy: 50,
  momentum: 0,
  max: 100,
  recovery: 10,
  reversalCost: 20,
  reversalThreshold: 16,
  reversalDamage: 6,
  reversalMomentum: 15,
  attackMomentum: 15,
  victimMomentum: 10,
  kickoutMomentum: 15,
  moves: [
    { label: "Ataque rápido", energy: 0, momentum: 0, damage: 8, pinBonus: 0 },
    {
      label: "Movimiento técnico",
      energy: 10,
      momentum: 0,
      damage: 12,
      pinBonus: 0,
    },
    {
      label: "Movimiento fuerte",
      energy: 20,
      momentum: 0,
      damage: 18,
      pinBonus: 0,
    },
    {
      label: "Movimiento personal",
      energy: 30,
      momentum: 50,
      damage: 24,
      pinBonus: 10,
    },
    { label: "Remate", energy: 40, momentum: 100, damage: 32, pinBonus: 20 },
  ],
} as const;
export type Figure = {
  id: string;
  wrestler: string;
  era: string;
  outfit: string;
  collection: string;
  edition: string;
  rarity: string;
  photo?: string;
  audio?: string;
  base: number;
  collectionBonus: number;
  rarityBonus: number;
  style: string;
  moves: string[];
  demo?: boolean;
};
export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
export const rating = (f: Figure) =>
  clamp(f.base + f.collectionBonus + f.rarityBonus);
export type Fighter = {
  figure: Figure;
  health: number;
  energy: number;
  momentum: number;
};
export type Phase =
  "roll" | "choose" | "defend" | "pin" | "finished" | "abandoned";
export type Replay = {
  id: string;
  attacker: Figure;
  defender: Figure;
  move: string;
  damage: number;
  defenderHealth: number;
  status: "unavailable" | "queued" | "processing" | "ready" | "failed";
  videoUrl?: string;
};
export type Event = {
  revision: number;
  round: number;
  kind: string;
  text: string;
};
export type Match = {
  id: string;
  fighters: [Fighter, Fighter];
  phase: Phase;
  round: number;
  revision: number;
  rng: number;
  attacker?: number;
  move?: number;
  dice?: [number, number];
  reversalDie?: number;
  pinRoll?: number;
  pinThreshold?: number;
  winner?: number;
  events: Event[];
  replays: Replay[];
  createdAt: string;
  endedAt?: string;
};
export type Action =
  | { type: "roll" }
  | { type: "move"; index: number }
  | { type: "defend"; attempt: boolean }
  | { type: "pin"; attempt: boolean }
  | { type: "abandon" };
export type Random = () => number;
export function seeded(seed: number): Random {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function createMatch(
  a: Figure,
  b: Figure,
  seed = crypto.getRandomValues(new Uint32Array(1))[0],
): Match {
  return {
    id: crypto.randomUUID(),
    fighters: [a, b].map((figure) => ({
      figure: structuredClone(figure),
      health: BALANCE.health,
      energy: BALANCE.energy,
      momentum: BALANCE.momentum,
    })) as [Fighter, Fighter],
    phase: "roll",
    round: 1,
    revision: 0,
    rng: seed >>> 0,
    events: [],
    replays: [],
    createdAt: new Date().toISOString(),
  };
}
export function missing(f: Fighter, index: number): string[] {
  const c = BALANCE.moves[index];
  if (!c) return ["Carta inválida"];
  return [
    ...(f.energy < c.energy ? [`${c.energy - f.energy} energía`] : []),
    ...(f.momentum < c.momentum ? [`${c.momentum - f.momentum} impulso`] : []),
  ];
}
export function pinThreshold(health: number, move: number) {
  return Math.round(
    clamp(
      5 + 0.6 * (100 - clamp(health)) + BALANCE.moves[move].pinBonus,
      5,
      90,
    ) * 100,
  );
}
// Optimistic revision checks make a resolved action idempotent, including after reload.
export function transition(
  current: Match,
  action: Action,
  expectedRevision: number,
  random?: Random,
): Match {
  if (
    expectedRevision !== current.revision ||
    current.phase === "finished" ||
    current.phase === "abandoned"
  )
    return current;
  const valid =
    action.type === "abandon" ||
    (action.type === "roll" && current.phase === "roll") ||
    (action.type === "move" &&
      current.phase === "choose" &&
      Number.isInteger(action.index) &&
      action.index >= 0 &&
      action.index < 5 &&
      missing(current.fighters[current.attacker!], action.index).length ===
        0) ||
    (action.type === "defend" &&
      current.phase === "defend" &&
      (!action.attempt ||
        current.fighters[1 - current.attacker!].energy >=
          BALANCE.reversalCost)) ||
    (action.type === "pin" && current.phase === "pin");
  if (!valid) return current;
  const m = structuredClone(current);
  m.revision++;
  const die = (sides: number) => {
    let n: number;
    if (random) {
      n = random();
      if (n < 0 || n >= 1 || !Number.isFinite(n))
        throw new Error("RNG fuera de rango");
    } else {
      m.rng = (Math.imul(1664525, m.rng) + 1013904223) >>> 0;
      n = m.rng / 4294967296;
    }
    return Math.floor(n * sides) + 1;
  };
  const log = (kind: string, text: string) =>
    m.events.push({ revision: m.revision, round: m.round, kind, text });
  const name = (i: number) => m.fighters[i].figure.wrestler;
  const next = () => {
    for (const f of m.fighters) f.energy = clamp(f.energy + BALANCE.recovery);
    m.round++;
    m.phase = "roll";
    m.move = undefined;
    log(
      "recovery",
      "Ambos recuperan hasta 10 de energía. Siguiente intercambio.",
    );
  };
  if (action.type === "abandon") {
    m.phase = "abandoned";
    m.endedAt = new Date().toISOString();
    log("abandon", "Lucha abandonada. Sin ganador.");
  }
  if (action.type === "roll") {
    m.dice = [die(20), die(20)];
    m.reversalDie = undefined;
    m.pinRoll = undefined;
    m.pinThreshold = undefined;
    const totals = m.dice.map(
      (d, i) => d + Math.floor(rating(m.fighters[i].figure) / 10),
    );
    log(
      "roll",
      m.fighters
        .map(
          (f, i) =>
            `${f.figure.wrestler}: d20 ${m.dice![i]} + ${Math.floor(rating(f.figure) / 10)} = ${totals[i]}`,
        )
        .join(" · "),
    );
    if (totals[0] === totals[1])
      log("tie", "Empate. Repetid los dados; los recursos no cambian.");
    else {
      m.attacker = totals[0] > totals[1] ? 0 : 1;
      m.phase = "choose";
      log("initiative", `${name(m.attacker)} tiene la oportunidad de atacar.`);
    }
  }
  if (action.type === "move") {
    m.move = action.index;
    const a = m.fighters[m.attacker!],
      c = BALANCE.moves[m.move];
    a.energy -= c.energy;
    a.momentum -= c.momentum;
    m.phase = "defend";
    log(
      "cost",
      `${name(m.attacker!)} elige ${a.figure.moves[m.move]}: −${c.energy} energía, −${c.momentum} impulso. Costos consumidos.`,
    );
  }
  if (action.type === "defend") {
    const ai = m.attacker!,
      di = 1 - ai,
      a = m.fighters[ai],
      d = m.fighters[di],
      c = BALANCE.moves[m.move!];
    let reversed = false;
    if (action.attempt) {
      d.energy -= BALANCE.reversalCost;
      m.reversalDie = die(20);
      reversed = m.reversalDie >= BALANCE.reversalThreshold;
      log(
        "reversal",
        `${name(di)} gasta 20 energía. Reversal: d20 ${m.reversalDie}; necesita 16–20. ${reversed ? "¡Éxito!" : "Fallo."}`,
      );
    }
    if (reversed) {
      a.health = clamp(a.health - BALANCE.reversalDamage);
      d.momentum = clamp(d.momentum + BALANCE.reversalMomentum);
      log(
        "impact",
        `${name(ai)} recibe 6 daño; ${name(di)} gana 15 impulso. Sin cuenta ni reembolso.`,
      );
      next();
    } else {
      d.health = clamp(d.health - c.damage);
      a.momentum = clamp(a.momentum + BALANCE.attackMomentum);
      d.momentum = clamp(d.momentum + BALANCE.victimMomentum);
      m.phase = "pin";
      log(
        "impact",
        `${a.figure.moves[m.move!]} conecta: ${c.damage} daño. Salud de ${name(di)}: ${d.health}. Impulso: atacante +15, defensor +10 (máximo 100).`,
      );
      m.replays.push({
        id: `${m.id}-${m.revision}`,
        attacker: a.figure,
        defender: d.figure,
        move: a.figure.moves[m.move!],
        damage: c.damage,
        defenderHealth: d.health,
        status: "unavailable",
      });
    }
  }
  if (action.type === "pin") {
    if (action.attempt) {
      const d = m.fighters[1 - m.attacker!];
      m.pinThreshold = pinThreshold(d.health, m.move!);
      m.pinRoll = die(10000);
      const win = m.pinRoll <= m.pinThreshold;
      log(
        "pin",
        `Cuenta: ${(m.pinThreshold / 100).toFixed(2)}% · umbral ${m.pinThreshold}/10000 · tirada ${m.pinRoll}. ${win ? "¡1, 2, 3!" : "¡Se libera! +15 impulso para el defensor."}`,
      );
      if (win) {
        m.winner = m.attacker;
        m.phase = "finished";
        m.endedAt = new Date().toISOString();
        log("victory", `¡${name(m.winner!)} gana por cuenta de tres!`);
      } else {
        d.momentum = clamp(d.momentum + BALANCE.kickoutMomentum);
        next();
      }
    } else {
      log(
        "skip-pin",
        "El atacante decide continuar sin intentar cuenta. Sin bono de liberación.",
      );
      next();
    }
  }
  return m;
}
