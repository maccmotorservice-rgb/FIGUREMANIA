import { describe, it, expect } from "vitest";
import {
  divisions,
  normalize,
  registerTemplate,
  roster,
  searchRoster,
} from "../src/core/roster";
import { createMatch, rating, transition } from "../src/core/engine";
import { LocalAdapter, type SaveData } from "../src/core/storage";
import { demos } from "../src/core/demo";
describe("Roster compartido y compatibilidad", () => {
  it("conserva las cuatro divisiones y 107 entradas sin IDs duplicados", () => {
    expect(divisions.map((d) => d.names.length)).toEqual([27, 29, 25, 26]);
    expect(roster).toHaveLength(107);
    expect(new Set(roster.map((r) => r.id)).size).toBe(107);
  });
  it("agrupa los dos nombres de Piper y conserva personas/versiones distintas", () => {
    expect(searchRoster("Roddy Piper")).toHaveLength(1);
    expect(searchRoster("Rey Mysterio")).toHaveLength(2);
    expect(searchRoster("Mankind")).toHaveLength(1);
    expect(searchRoster("Mick Foley")).toHaveLength(1);
  });
  it("busca sin tildes, por alias y por división", () => {
    expect(searchRoster("finn balor")[0].name).toBe("Finn Bálor");
    expect(searchRoster("Rhea", "women")).toHaveLength(1);
    expect(searchRoster("Rhea", "modern")).toHaveLength(0);
    expect(searchRoster("nombre inexistente")).toHaveLength(0);
    expect(normalize("ÍYO")).toBe("iyo");
  });
  it("cada plantilla es jugable con cinco cartas y valoración provisional uniforme", () => {
    for (const entry of roster) {
      expect(rating(entry.figure)).toBe(80);
      expect(entry.figure.moves).toHaveLength(5);
      expect(entry.figure.edition).toBe("Edición por definir");
      const m = createMatch(entry.figure, demos[0], 42);
      const n = transition(m, { type: "roll" }, 0);
      expect(n.revision).toBe(1);
      expect(entry.figure.demo).toBeUndefined();
    }
  });
  it("registrar una edición crea ID nuevo sin alterar la plantilla", () => {
    const entry = roster[0],
      a = registerTemplate(entry),
      b = registerTemplate(entry);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(entry.id);
    expect(a.edition).toBe("");
    a.moves[0] = "Mi ataque";
    expect(entry.figure.moves[0]).not.toBe(a.moves[0]);
  });
  it("abrir catálogo no requiere migrar ni reemplazar el guardado anterior", () => {
    const db = new Map<string, string>();
    const storage = new LocalAdapter({
      getItem: (k) => db.get(k) ?? null,
      setItem: (k, v) => {
        db.set(k, v);
      },
    });
    const m = createMatch(demos[0], demos[1], 8);
    m.fighters[0].health = 37;
    const old: SaveData = {
      version: 1,
      figures: demos,
      active: m,
      history: [],
      preferences: { muted: false, reducedMotion: true },
    };
    storage.save(old);
    searchRoster("Cody");
    expect(storage.load()).toEqual(old);
  });
});
