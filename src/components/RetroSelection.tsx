import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { rating, type Figure } from "../core/engine";
import { divisions, isRosterTemplate, normalize, roster } from "../core/roster";
import { Avatar } from "./FigurePortrait";
export function RetroSelection({
  figures,
  onStart,
  onBack,
}: {
  figures: Figure[];
  onStart: (a: Figure, b: Figure) => void;
  onBack: () => void;
}) {
  const [source, setSource] = useState<"collection" | "roster">(
    figures.length >= 2 ? "collection" : "roster",
  );
  const [selected, setSelected] = useState<[string, string]>([
    figures[0]?.id ?? roster[0].id,
    figures[1]?.id ?? roster[1].id,
  ]);
  const [confirmed, setConfirmed] = useState<[boolean, boolean]>([
    false,
    false,
  ]);
  const [queries, setQueries] = useState<[string, string]>(["", ""]);
  const [filters, setFilters] = useState<[string, string]>(["all", "all"]);
  const all = [...figures, ...roster.map((r) => r.figure)];
  const chosen = selected.map((id) => all.find((f) => f.id === id)!);
  const choose = (player: number, id: string) => {
    setSelected(
      (v) => v.map((s, i) => (i === player ? id : s)) as [string, string],
    );
    setConfirmed(
      (v) => v.map((s, i) => (i === player ? false : s)) as [boolean, boolean],
    );
  };
  const setSourceAndReset = (value: "collection" | "roster") => {
    setSource(value);
    setQueries(["", ""]);
    setFilters(["all", "all"]);
    const list = value === "collection" ? figures : roster.map((r) => r.figure);
    setSelected([list[0]?.id ?? "", list[1]?.id ?? list[0]?.id ?? ""]);
    setConfirmed([false, false]);
  };
  const ready =
    chosen.every(Boolean) &&
    selected[0] !== selected[1] &&
    confirmed.every(Boolean);
  return (
    <section className="retro-selection section">
      <div className="selection-title">
        <div>
          <span className="eyebrow">UN DISPOSITIVO · DOS JUGADORES</span>
          <h1>
            SELECCIÓN <span>INDIVIDUAL</span>
          </h1>
        </div>
        <span className="match-type">
          SIN MÁNAGER
          <br />
          <b>
            1P <i>vs</i> 2P
          </b>
        </span>
      </div>
      <div className="selection-options">
        <div className="roster-tabs">
          <button
            className={source === "collection" ? "active" : ""}
            onClick={() => setSourceAndReset("collection")}
          >
            MIS FIGURAS <span>{figures.length}</span>
          </button>
          <button
            className={source === "roster" ? "active" : ""}
            onClick={() => setSourceAndReset("roster")}
          >
            ROSTER WWE <span>{roster.length}</span>
          </button>
        </div>
        <p>
          {source === "roster"
            ? "Plantillas jugables · valoración provisional 80 · ediciones por definir"
            : "Tus ediciones, tus fotos y tus movimientos"}
        </p>
      </div>
      <div className="player-select-grid">
        {[0, 1].map((player) => {
          const figure = chosen[player];
          const opponent = selected[1 - player];
          const list = (
            source === "collection"
              ? figures
              : roster
                  .filter(
                    (r) =>
                      filters[player] === "all" ||
                      r.division === filters[player],
                  )
                  .map((r) => r.figure)
          ).filter((f) => {
            const entry = roster.find((r) => r.id === f.id);
            return normalize(
              [f.wrestler, f.edition, ...(entry?.aliases ?? [])].join(" "),
            ).includes(normalize(queries[player]));
          });
          return (
            <article
              key={player}
              className={`player-select player-${player + 1} ${confirmed[player] ? "is-ready" : ""}`}
              aria-label={`Selección jugador ${player + 1}`}
            >
              <div className="player-label">
                <b>{player + 1}P</b>
                <span>
                  {confirmed[player] ? (
                    <>
                      <Check size={14} /> LISTO
                    </>
                  ) : (
                    "ELIGE TU LUCHADOR"
                  )}
                </span>
              </div>
              <div className="player-frame">
                <div className="player-name">
                  <small>{figure?.era ?? "EL RING TE ESPERA"}</small>
                  <h2>{figure?.wrestler ?? "Sin seleccionar"}</h2>
                </div>
                <div className="player-browser">
                  <div className="name-list-pane">
                    <label className="player-search">
                      <Search size={14} />
                      <input
                        aria-label={`Buscar jugador ${player + 1}`}
                        placeholder="Buscar…"
                        value={queries[player]}
                        onChange={(e) =>
                          setQueries(
                            (v) =>
                              v.map((q, i) =>
                                i === player ? e.target.value : q,
                              ) as [string, string],
                          )
                        }
                      />
                    </label>
                    {source === "roster" && (
                      <select
                        aria-label={`División jugador ${player + 1}`}
                        value={filters[player]}
                        onChange={(e) =>
                          setFilters(
                            (v) =>
                              v.map((q, i) =>
                                i === player ? e.target.value : q,
                              ) as [string, string],
                          )
                        }
                      >
                        <option value="all">Todas las divisiones</option>
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.short}
                          </option>
                        ))}
                      </select>
                    )}
                    <ChevronUp className="list-arrow" size={16} />
                    <div
                      className="fighter-name-list"
                      role="group"
                      aria-label={`Luchadores jugador ${player + 1}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowDown" && e.key !== "ArrowUp")
                          return;
                        e.preventDefault();
                        const available = list.filter((f) => f.id !== opponent);
                        const current = available.findIndex(
                          (f) => f.id === selected[player],
                        );
                        const direction = e.key === "ArrowDown" ? 1 : -1;
                        const nextIndex =
                          current < 0
                            ? direction > 0
                              ? 0
                              : available.length - 1
                            : (current + direction + available.length) %
                              available.length;
                        const next = available[nextIndex];
                        if (next) {
                          choose(player, next.id);
                          const target =
                            e.currentTarget.querySelector<HTMLButtonElement>(
                              `[data-figure-id="${CSS.escape(next.id)}"]`,
                            );
                          target?.focus({ preventScroll: true });
                          target?.scrollIntoView({
                            block: "nearest",
                            inline: "nearest",
                          });
                        }
                      }}
                    >
                      {list.map((f) => (
                        <button
                          key={f.id}
                          data-figure-id={f.id}
                          tabIndex={f.id === selected[player] ? 0 : -1}
                          className={
                            f.id === selected[player] ? "name-selected" : ""
                          }
                          aria-pressed={f.id === selected[player]}
                          disabled={f.id === opponent}
                          onClick={() => choose(player, f.id)}
                        >
                          <span>{f.wrestler}</span>
                          {source === "collection" && (
                            <small>{f.edition}</small>
                          )}
                          {f.id === opponent && <small>EN EL OTRO LADO</small>}
                        </button>
                      ))}
                      {!list.length && (
                        <p className="no-fighters">
                          Sin resultados. Cambia la búsqueda o división.
                        </p>
                      )}
                    </div>
                    <ChevronDown className="list-arrow" size={16} />
                    <span className="list-counter">
                      {list.length} CONTENDIENTES
                    </span>
                  </div>
                  <div className="portrait-pane">
                    {figure && (
                      <>
                        <Avatar figure={figure} />
                        <div className="portrait-overlay">
                          <span>
                            {figure.photo
                              ? "FOTO DE TU FIGURA"
                              : "ILUSTRACIÓN · SIN FOTO"}
                          </span>
                          <b>
                            {rating(figure)}
                            <small>
                              VALORACIÓN
                              {isRosterTemplate(figure) ? " PROVISIONAL" : ""}
                            </small>
                          </b>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="retro-stats">
                  <div>
                    <b>VAL</b>
                    <div className="retro-stat-track">
                      <i style={{ width: `${figure ? rating(figure) : 0}%` }} />
                    </div>
                    <span>{figure ? rating(figure) : "—"}</span>
                  </div>
                  <div>
                    <b>EDICIÓN</b>
                    <span className="edition-value">
                      {figure?.edition ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="special-move">
                  <small>MOVIMIENTO PERSONAL / REMATE</small>
                  <strong>
                    {figure
                      ? `${figure.moves[3]} / ${figure.moves[4]}`
                      : "Selecciona un luchador"}
                  </strong>
                </div>
                <button
                  className="confirm-fighter"
                  disabled={!figure || selected[player] === opponent}
                  onClick={() =>
                    setConfirmed(
                      (v) =>
                        v.map((c, i) => (i === player ? !c : c)) as [
                          boolean,
                          boolean,
                        ],
                    )
                  }
                >
                  {confirmed[player] ? (
                    <>
                      <Check size={18} /> LISTO · CAMBIAR
                    </>
                  ) : (
                    <>
                      CONFIRMAR {player + 1}P <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
        <span className="retro-vs" aria-hidden="true">
          VS
        </span>
      </div>
      <div className="selection-actions">
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div>
          <p className="ready-instruction" role="status">
            {ready
              ? "AMBOS LISTOS. ES HORA DE ENTRAR AL RING."
              : "Elige y confirma un contendiente en cada panel."}
          </p>
          <button
            className="primary big"
            disabled={!ready}
            onClick={() => onStart(chosen[0], chosen[1])}
          >
            HACER LAS ENTRADAS <ArrowRight size={20} />
          </button>
        </div>
      </div>
      <div className="console-controls">
        <span>
          <i>↑↓</i> EXPLORAR
        </span>
        <span>
          <i>●</i> CONFIRMAR JUGADOR
        </span>
        <span>
          <i>×</i> VOLVER
        </span>
        <small>
          Toca los nombres para seleccionar · Sin ventajas por posición
        </small>
      </div>
    </section>
  );
}
