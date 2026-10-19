import { describe, it, expect } from "vitest";
import {
  BALANCE,
  clamp,
  rating,
  createMatch,
  transition,
  pinThreshold,
  missing,
  seeded,
  type Match,
} from "../src/core/engine";
import { demos } from "../src/core/demo";
import { LocalAdapter, type SaveData } from "../src/core/storage";
const setup = () => createMatch(demos[0], demos[1], 123);
function at(phase: Match["phase"], move = 2) {
  const m = setup();
  m.phase = phase;
  m.attacker = 0;
  m.move = move;
  return m;
}
const apply = (m: Match, a: Parameters<typeof transition>[1], r = () => 0) =>
  transition(m, a, m.revision, r);
describe("Motor FIGUREMANIA", () => {
  it("inicia con recursos correctos y estilos sin efecto", () => {
    const m = setup();
    expect(m.fighters.map((f) => [f.health, f.energy, f.momentum])).toEqual([
      [100, 50, 0],
      [100, 50, 0],
    ]);
    expect(m.phase).toBe("roll");
  });
  it("calcula valores demo 93 y 84, y limita valoración", () => {
    expect(demos.slice(0, 2).map(rating)).toEqual([93, 84]);
    expect(rating({ ...demos[0], base: 200 })).toBe(100);
    expect(clamp(-20)).toBe(0);
  });
  it("suma dados y bonos; mayor total gana", () => {
    const values = [0.1, 0.9];
    const m = apply(setup(), { type: "roll" }, () => values.shift()!);
    expect(m.dice).toEqual([3, 19]);
    expect(m.attacker).toBe(1);
    expect(m.phase).toBe("choose");
  });
  it("empate repite sin cambiar recursos", () => {
    const m = createMatch(demos[0], demos[0], 5);
    const n = apply(m, { type: "roll" });
    expect(n.phase).toBe("roll");
    expect(n.fighters).toEqual(m.fighters);
    expect(n.revision).toBe(1);
    expect(n.events.at(-1)?.kind).toBe("tie");
  });
  it.each([0, 1, 2, 3, 4])("carta %i paga costos inmediatamente", (index) => {
    const m = at("choose");
    m.fighters[0].energy = 100;
    m.fighters[0].momentum = 100;
    const n = apply(m, { type: "move", index });
    expect(n.fighters[0].energy).toBe(100 - BALANCE.moves[index].energy);
    expect(n.fighters[0].momentum).toBe(100 - BALANCE.moves[index].momentum);
    expect(n.phase).toBe("defend");
  });
  it("bloquea especiales y ataque rápido siempre disponible", () => {
    const m = at("choose");
    m.fighters[0].energy = 0;
    expect(missing(m.fighters[0], 0)).toEqual([]);
    expect(missing(m.fighters[0], 4)).toHaveLength(2);
    expect(apply(m, { type: "move", index: 4 })).toBe(m);
    expect(apply(m, { type: "move", index: -1 })).toBe(m);
    expect(apply(m, { type: "move", index: 1.5 })).toBe(m);
  });
  it("reversal exitoso cancela daño sin reembolso ni cuenta", () => {
    let m = at("choose");
    m = apply(m, { type: "move", index: 2 });
    const n = apply(m, { type: "defend", attempt: true }, () => 0.75);
    expect(n.reversalDie).toBe(16);
    expect(n.fighters[0].health).toBe(94);
    expect(n.fighters[1].health).toBe(100);
    expect(n.fighters[0].energy).toBe(40);
    expect(n.fighters[1].energy).toBe(40);
    expect(n.fighters.map((f) => f.momentum)).toEqual([0, 15]);
    expect(n.phase).toBe("roll");
    expect(n.replays).toHaveLength(0);
  });
  it("reversal fallido aplica ataque entero y ganancias originales", () => {
    const n = apply(at("defend"), { type: "defend", attempt: true }, () => 0.7);
    expect(n.reversalDie).toBe(15);
    expect(n.fighters.map((f) => f.health)).toEqual([100, 82]);
    expect(n.fighters.map((f) => f.momentum)).toEqual([15, 10]);
    expect(n.fighters[1].energy).toBe(30);
    expect(n.phase).toBe("pin");
  });
  it("hay exactamente cinco resultados exitosos entre veinte", () => {
    let successes = 0;
    for (let i = 0; i < 20; i++) {
      const n = apply(
        at("defend"),
        { type: "defend", attempt: true },
        () => i / 20,
      );
      if (n.phase === "roll") successes++;
    }
    expect(successes).toBe(5);
  });
  it("no permite reversal sin energía o contra otro reversal", () => {
    const m = at("defend");
    m.fighters[1].energy = 19;
    expect(apply(m, { type: "defend", attempt: true })).toBe(m);
    const n = apply(
      at("defend"),
      { type: "defend", attempt: true },
      () => 0.99,
    );
    expect(apply(n, { type: "defend", attempt: true })).toBe(n);
  });
  it("clampa daño, impulso y recuperación", () => {
    const m = at("defend", 4);
    m.fighters[1].health = 1;
    m.fighters.forEach((f) => {
      f.energy = 99;
      f.momentum = 99;
    });
    const n = apply(m, { type: "defend", attempt: false });
    expect(n.fighters[1].health).toBe(0);
    expect(n.fighters.map((f) => f.momentum)).toEqual([100, 100]);
    const p = apply(n, { type: "pin", attempt: false });
    expect(p.fighters.map((f) => f.energy)).toEqual([100, 100]);
  });
  it("salud cero no concede victoria automática", () => {
    const m = at("defend");
    m.fighters[1].health = 3;
    const n = apply(m, { type: "defend", attempt: false });
    expect(n.phase).toBe("pin");
    expect(n.winner).toBeUndefined();
    expect(n.fighters[1].health).toBe(0);
  });
  it("cuenta: ejemplo 73%, umbral exacto, límite y decimales", () => {
    expect(pinThreshold(20, 4)).toBe(7300);
    expect(pinThreshold(100, 0)).toBe(500);
    expect(pinThreshold(0, 4)).toBe(8500);
    expect(pinThreshold(99, 0)).toBe(560);
  });
  it("el borde 7300 gana y 7301 pierde", () => {
    const m = at("pin", 4);
    m.fighters[1].health = 20;
    const n = apply(m, { type: "pin", attempt: true }, () => 0.7299);
    expect(n.pinRoll).toBe(7300);
    expect(n.phase).toBe("finished");
    expect(n.winner).toBe(0);
    const p = apply(m, { type: "pin", attempt: true }, () => 0.73);
    expect(p.pinRoll).toBe(7301);
    expect(p.phase).toBe("roll");
    expect(p.fighters[1].momentum).toBe(15);
  });
  it("sin cuenta no hay bono de liberación", () => {
    const n = apply(at("pin"), { type: "pin", attempt: false });
    expect(n.fighters[1].momentum).toBe(0);
    expect(n.fighters.map((f) => f.energy)).toEqual([60, 60]);
  });
  it("rechaza revisiones duplicadas y fases incorrectas", () => {
    const m = setup();
    const n = apply(m, { type: "roll" }, () => 0.8);
    expect(transition(n, { type: "roll" }, m.revision)).toBe(n);
    expect(apply(m, { type: "pin", attempt: true })).toBe(m);
    expect(apply(m, { type: "move", index: 0 })).toBe(m);
  });
  it("persistencia conserva dados, RNG y revisión sin volver a tirar", () => {
    const db = new Map<string, string>();
    const store = new LocalAdapter({
      getItem: (k) => db.get(k) ?? null,
      setItem: (k, v) => {
        db.set(k, v);
      },
    });
    const m = transition(setup(), { type: "roll" }, 0);
    const data: SaveData = {
      version: 1,
      figures: demos,
      active: m,
      history: [],
      preferences: { muted: true, reducedMotion: false },
    };
    store.save(data);
    const restored = store.load()!.active!;
    expect(restored).toEqual(m);
    expect(transition(restored, { type: "roll" }, 0)).toBe(restored);
  });
  it("propaga error de almacenamiento para evitar pérdida silenciosa", () => {
    const store = new LocalAdapter({
      getItem: () => null,
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(() => store.save({} as SaveData)).toThrow("quota");
  });
  it("RNG reproducible y validación del inyectado", () => {
    const a = seeded(42),
      b = seeded(42);
    expect(Array.from({ length: 20 }, a)).toEqual(
      Array.from({ length: 20 }, b),
    );
    expect(() => apply(setup(), { type: "roll" }, () => 1)).toThrow();
  });
  it("partida completa preserva recursos y termina por cuenta con decisiones válidas", () => {
    let m = setup();
    for (let i = 0; i < 3000 && m.phase !== "finished"; i++) {
      if (m.phase === "roll") m = transition(m, { type: "roll" }, m.revision);
      else if (m.phase === "choose")
        m = transition(m, { type: "move", index: 0 }, m.revision);
      else if (m.phase === "defend")
        m = transition(m, { type: "defend", attempt: false }, m.revision);
      else if (m.phase === "pin")
        m = transition(m, { type: "pin", attempt: true }, m.revision);
      for (const f of m.fighters)
        for (const v of [f.health, f.energy, f.momentum]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
    }
    expect(m.phase).toBe("finished");
    expect(m.winner).toBeDefined();
  });
  it("abandono no asigna ganador y bloquea nuevas acciones", () => {
    const m = apply(setup(), { type: "abandon" });
    expect(m.phase).toBe("abandoned");
    expect(m.winner).toBeUndefined();
    expect(apply(m, { type: "roll" })).toBe(m);
  });
});

describe("Medios locales e integridad", () => {
  it("deduplica imágenes y audio, y restaura instantáneas sin perder medios", () => {
    const db = new Map<string, string>();
    const store = new LocalAdapter({
      getItem: (k) => db.get(k) ?? null,
      setItem: (k, v) => {
        db.set(k, v);
      },
    });
    const figure = {
      ...demos[0],
      photo: "data:image/png;base64,ABC",
      audio: "data:audio/mp3;base64,XYZ",
    };
    const m = createMatch(figure, figure, 1);
    const data: SaveData = {
      version: 1,
      figures: [figure],
      active: m,
      history: [m],
      preferences: { muted: true, reducedMotion: true },
    };
    store.save(data);
    const raw = [...db.values()][0];
    expect(raw.match(/data:image\/png/g)).toHaveLength(1);
    expect(raw.match(/data:audio\/mp3/g)).toHaveLength(1);
    expect(store.load()).toEqual(data);
  });
  it("rechaza guardados incompletos antes de usarlos en la interfaz", () => {
    const store = new LocalAdapter({
      getItem: () =>
        JSON.stringify({
          version: 1,
          figures: [{}],
          history: [],
          active: null,
          preferences: { muted: true, reducedMotion: false },
        }),
      setItem: () => {},
    });
    expect(() => store.load()).toThrow("Formato");
  });
});
