import type { Figure, Match } from "./engine";
export type Preferences = { muted: boolean; reducedMotion: boolean };
export type SaveData = {
  version: 1;
  figures: Figure[];
  active: Match | null;
  history: Match[];
  preferences: Preferences;
};
export interface StorageAdapter {
  load(): SaveData | null;
  save(data: SaveData): void;
}
export const STORAGE_KEY = "figuremania.v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
function isFigure(v: unknown): v is Figure {
  if (!object(v)) return false;
  return (
    [
      "id",
      "wrestler",
      "era",
      "outfit",
      "collection",
      "edition",
      "rarity",
      "style",
    ].every((k) => typeof v[k] === "string") &&
    ["base", "collectionBonus", "rarityBonus"].every((k) => finite(v[k])) &&
    Array.isArray(v.moves) &&
    v.moves.length === 5 &&
    v.moves.every((m) => typeof m === "string") &&
    ["photo", "audio"].every(
      (k) =>
        v[k] === undefined ||
        (typeof v[k] === "string" &&
          String(v[k]).startsWith(
            k === "photo" ? "data:image/" : "data:audio/",
          )),
    )
  );
}
function isMatch(v: unknown): v is Match {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !["roll", "choose", "defend", "pin", "finished", "abandoned"].includes(
      String(v.phase),
    ) ||
    !Number.isInteger(v.revision) ||
    !Number.isInteger(v.round) ||
    !finite(v.rng)
  )
    return false;
  if (
    !Array.isArray(v.fighters) ||
    v.fighters.length !== 2 ||
    !v.fighters.every(
      (f) =>
        object(f) &&
        isFigure(f.figure) &&
        ["health", "energy", "momentum"].every(
          (k) => finite(f[k]) && Number(f[k]) >= 0 && Number(f[k]) <= 100,
        ),
    )
  )
    return false;
  if (
    !Array.isArray(v.events) ||
    !v.events.every(
      (e) =>
        object(e) &&
        typeof e.text === "string" &&
        typeof e.kind === "string" &&
        finite(e.round) &&
        finite(e.revision),
    ) ||
    !Array.isArray(v.replays)
  )
    return false;
  if (
    ["choose", "defend", "pin"].includes(String(v.phase)) &&
    v.attacker !== 0 &&
    v.attacker !== 1
  )
    return false;
  if (
    ["defend", "pin"].includes(String(v.phase)) &&
    (!Number.isInteger(v.move) || Number(v.move) < 0 || Number(v.move) > 4)
  )
    return false;
  if (
    v.phase === "choose" &&
    (!Array.isArray(v.dice) || v.dice.length !== 2 || !v.dice.every(finite))
  )
    return false;
  if (v.phase === "finished" && v.winner !== 0 && v.winner !== 1) return false;
  return typeof v.createdAt === "string";
}
export function validateSaveData(data: unknown): asserts data is SaveData {
  if (
    !object(data) ||
    data.version !== 1 ||
    !Array.isArray(data.figures) ||
    !data.figures.every(isFigure) ||
    !Array.isArray(data.history) ||
    !data.history.every(isMatch) ||
    !(data.active === null || isMatch(data.active)) ||
    !object(data.preferences) ||
    typeof data.preferences.muted !== "boolean" ||
    typeof data.preferences.reducedMotion !== "boolean"
  )
    throw new Error("Formato de guardado no compatible");
}
export class LocalAdapter implements StorageAdapter {
  constructor(
    private storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  ) {}
  load() {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const media = parsed._media || {};
    const data = JSON.parse(raw, (key, value) => {
      if (
        (key === "photo" || key === "audio") &&
        object(value) &&
        typeof value.$media === "string"
      ) {
        if (typeof media[value.$media] !== "string")
          throw new Error("Archivo multimedia ausente");
        return media[value.$media];
      }
      return value;
    });
    delete data._media;
    validateSaveData(data);
    return data;
  }
  save(data: SaveData) {
    // Store each media blob once, even when figures appear in match snapshots and replays.
    // One localStorage write atomically persists state and media together.
    const media: Record<string, string> = {},
      ids = new Map<string, string>();
    const body = JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (
          (key === "photo" || key === "audio") &&
          typeof value === "string" &&
          value.startsWith("data:")
        ) {
          let id = ids.get(value);
          if (!id) {
            id = String(ids.size);
            ids.set(value, id);
            media[id] = value;
          }
          return { $media: id };
        }
        return value;
      }),
    );
    this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...body, _media: media }),
    );
  }
}
