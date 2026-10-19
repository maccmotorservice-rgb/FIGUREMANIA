import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Volume2,
  VolumeX,
  Zap,
  Shield,
  Swords,
  Trophy,
  History,
  BookOpen,
  Camera,
  Trash2,
  Check,
  Settings,
  Play,
  ChevronRight,
  RotateCcw,
  Download,
} from "lucide-react";
import {
  BALANCE,
  createMatch,
  missing,
  pinThreshold,
  rating,
  transition,
  type Figure,
  type Match,
  type Action,
} from "./core/engine";
import { demos } from "./core/demo";
import { LocalAdapter, validateSaveData, type SaveData } from "./core/storage";
import { replayAvailability } from "./core/integrations";
type Page =
  | "home"
  | "collection"
  | "select"
  | "entrance"
  | "combat"
  | "history"
  | "rules";
const adapter = new LocalAdapter();
const initial = (): SaveData => ({
  version: 1,
  figures: structuredClone(demos),
  active: null,
  history: [],
  preferences: {
    muted: true,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  },
});
function load() {
  try {
    return { data: adapter.load() || initial(), error: "" };
  } catch {
    return {
      data: initial(),
      error:
        "No se pudo leer el guardado. No se sobrescribirá sin tu confirmación; puedes descargar una copia.",
    };
  }
}
function Avatar({
  figure,
  large = false,
}: {
  figure: Figure;
  large?: boolean;
}) {
  const color = figure.id.includes("rey")
    ? "#bdff43"
    : figure.id === "titan"
      ? "#81a6d8"
      : "#fa637d";
  return figure.photo ? (
    <img
      className="figure-photo"
      src={figure.photo}
      alt={`${figure.wrestler}, ${figure.edition}`}
    />
  ) : (
    <svg
      className={`avatar ${large ? "large" : ""}`}
      viewBox="0 0 300 330"
      role="img"
      aria-label={`Ilustración original de luchador; ${figure.wrestler} sin foto`}
    >
      <defs>
        <linearGradient id={`g${figure.id}`} x2="1" y2="1">
          <stop stopColor={color} />
          <stop offset="1" stopColor="#20232b" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="130" r="110" fill={color} opacity=".035" />
      <path
        d="M45 330 65 220 106 192 122 179 176 179 194 194 235 220 256 330"
        fill={`url(#g${figure.id})`}
      />
      <path d="m100 330 10-103 40 35 40-35 14 103" fill="#141720" />
      <path d="m120 180 5-33h50l6 33-31 36z" fill="#96785f" />
      <path
        d="M107 103q2-57 43-59 43 3 44 59l-8 56-36 27-36-27z"
        fill={`url(#g${figure.id})`}
      />
      <path d="m113 97 29 16-6 12-18-9zm74 0-29 16 6 12 18-9z" fill="#10121b" />
      <path d="m141 141 9 8 9-8 9 18-18 9-18-9z" fill="#10121b" />
      <path
        d="m148 51 2 45 9-45m-46 21 29 24m45-24-29 24"
        fill="none"
        stroke="#e4ffb8"
        strokeWidth="4"
        opacity=".8"
      />
      <path d="m67 227 39 15-9 48-41-9m177-54-39 15 9 48 41-9" fill="#262b32" />
      <path d="m112 287 38-12 38 12-5 28h-66z" fill={color} />
      <path d="m139 289 11-6 11 6-2 14h-18z" fill="#181b24" />
    </svg>
  );
}
function FigureCard({
  figure,
  selected,
  onClick,
  index = 0,
}: {
  figure: Figure;
  selected?: boolean;
  onClick: () => void;
  index?: number;
}) {
  return (
    <button
      className={`figure-card tone-${index % 4} ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="card-top">
        <span className="tiny">{figure.style}</span>
        <span className="rating">
          {rating(figure)}
          <small>VAL</small>
        </span>
      </div>
      <Avatar figure={figure} />
      <div className="card-caption">
        <small>{figure.era}</small>
        <h3>{figure.wrestler}</h3>
        <span>{figure.edition}</span>
      </div>
      {selected && (
        <span className="selected-mark">
          <Check size={16} />
        </span>
      )}
    </button>
  );
}
function App() {
  const loaded = useRef(load());
  const [data, setData] = useState(loaded.current.data);
  const state = useRef(data);
  const [error, setError] = useState(loaded.current.error);
  const [page, setPage] = useState<Page>("home");
  const [picks, setPicks] = useState<string[]>([]);
  const [entry, setEntry] = useState(0);
  const [editor, setEditor] = useState<Figure | null>(null);
  const [detail, setDetail] = useState<Match | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const commit = (next: SaveData) => {
    if (loaded.current.error) {
      setError(
        "Primero descarga tu guardado anterior y confirma su reemplazo en el aviso.",
      );
      return false;
    }
    try {
      adapter.save(next);
      state.current = next;
      setData(next);
      setError("");
      return true;
    } catch {
      setError(
        "No se pudo guardar (almacenamiento lleno o bloqueado). La acción no se aplicó. Elimina archivos multimedia grandes o habilita almacenamiento y reintenta.",
      );
      return false;
    }
  };
  const notify = (s: string) => {
    setNotice(s);
    window.setTimeout(() => setNotice(""), 6000);
  };
  const navigate = (p: Page) => {
    audio.current?.pause();
    setAudioPlaying(false);
    setPage(p);
    setDetail(null);
    window.scrollTo(0, 0);
  };
  const sound = (kind: string) => {
    if (state.current.preferences.muted) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(
        kind === "finished" ? 660 : kind === "defend" ? 160 : 320,
        ctx.currentTime,
      );
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => void ctx.close();
    } catch {
      /* Optional sound must never block combat. */
    }
  };
  const act = (action: Action, revision: number) => {
    if (busyRef.current) return;
    const active = state.current.active;
    if (!active) return;
    const next = transition(active, action, revision);
    if (next === active) return;
    const history =
      next.phase === "finished" || next.phase === "abandoned"
        ? [next, ...state.current.history.filter((m) => m.id !== next.id)]
        : state.current.history;
    if (commit({ ...state.current, active: next, history })) {
      sound(next.phase === "finished" ? "finished" : action.type);
      busyRef.current = true;
      setBusy(true);
      window.setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
      }, 300);
    }
  };
  const newSelection = () => {
    if (
      data.active &&
      !["finished", "abandoned"].includes(data.active.phase) &&
      !confirm("Hay una lucha en curso. ¿Abandonarla para crear otra?")
    )
      return;
    if (data.active && !["finished", "abandoned"].includes(data.active.phase)) {
      const m = transition(
        data.active,
        { type: "abandon" },
        data.active.revision,
      );
      if (!commit({ ...data, active: m, history: [m, ...data.history] }))
        return;
    }
    setPicks([]);
    navigate("select");
  };
  const start = () => {
    const [a, b] = picks.map((id) => data.figures.find((f) => f.id === id)!);
    if (!a || !b) return;
    if (commit({ ...data, active: createMatch(a, b) })) {
      setEntry(0);
      navigate("entrance");
    }
  };
  const exportData = () => {
    const raw = loaded.current.error
      ? localStorage.getItem("figuremania.v1")
      : JSON.stringify(state.current, null, 2);
    const url = URL.createObjectURL(
      new Blob([raw || ""], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "figuremania-respaldo.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const restore = async (file: File) => {
    try {
      const candidate = JSON.parse(await file.text()) as SaveData;
      validateSaveData(candidate);
      if (!confirm("¿Reemplazar los datos locales con este respaldo?")) return;
      loaded.current.error = "";
      if (commit(candidate)) notify("Respaldo restaurado.");
    } catch {
      notify("El archivo no es un respaldo compatible.");
    }
  };
  const active = data.active;
  return (
    <div
      className={`app ${data.preferences.reducedMotion ? "reduce-motion" : ""}`}
    >
      <header>
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="FIGUREMANIA inicio"
        >
          <span className="brand-icon">
            F<span>▰</span>
          </span>
          <span>
            FIGURE<span>MANIA</span>
            <small>EL RING COBRA VIDA</small>
          </span>
        </button>
        <nav aria-label="Principal">
          {(
            [
              ["home", "Arena"],
              ["collection", "Colección"],
              ["history", "Historial"],
              ["rules", "Reglas"],
            ] as [Page, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              className={page === p ? "nav-active" : ""}
              onClick={() => navigate(p)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <span className="local">
            <i /> GUARDADO LOCAL
          </span>
          <button
            className="icon-button"
            title={data.preferences.muted ? "Activar audio" : "Silenciar audio"}
            aria-label={
              data.preferences.muted ? "Activar audio" : "Silenciar audio"
            }
            onClick={() => {
              audio.current?.pause();
              setAudioPlaying(false);
              commit({
                ...data,
                preferences: {
                  ...data.preferences,
                  muted: !data.preferences.muted,
                },
              });
            }}
          >
            {data.preferences.muted ? (
              <VolumeX size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Ajustes"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          {loaded.current.error && (
            <>
              <button onClick={exportData}>Descargar guardado anterior</button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Reemplazar el guardado ilegible por los datos de demostración?",
                    )
                  ) {
                    loaded.current.error = "";
                    commit(initial());
                  }
                }}
              >
                Reemplazar guardado
              </button>
            </>
          )}
        </div>
      )}
      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="live-dot" /> MULTIJUGADOR LOCAL · 2 JUGADORES
                </span>
                <h1>
                  TUS FIGURAS.
                  <br />
                  TU RING.
                  <br />
                  <em>TU LEYENDA.</em>
                </h1>
                <p>
                  Del estante al evento principal. Elige tus figuras,
                  <br className="desktop" /> lanza los dados y escribe tu propia
                  historia.
                </p>
                <div className="hero-actions">
                  <button className="primary big" onClick={newSelection}>
                    NUEVA LUCHA <ArrowRight size={20} />
                  </button>
                  {active &&
                    !["finished", "abandoned"].includes(active.phase) && (
                      <button
                        className="secondary"
                        onClick={() => navigate("combat")}
                      >
                        Continuar · intercambio {active.round}
                      </button>
                    )}
                </div>
                <div className="hero-meta">
                  <span>
                    <Swords size={16} /> Un dispositivo, dos rivales
                  </span>
                  <span>
                    <Shield size={16} /> Sin cuentas. Sin conexión.*
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="arena-lights" />
                <div className="arena-word">
                  MAIN
                  <br />
                  EVENT
                </div>
                <div className="hero-fighter">
                  <Avatar figure={demos[0]} large />
                </div>
                <div className="ring-rope rope-1" />
                <div className="ring-rope rope-2" />
                <div className="ring-rope rope-3" />
                <div className="hero-sticker">
                  <Zap size={21} />
                  <span>
                    EL COMBATE
                    <br />
                    <b>ESTÁ EN TUS MANOS</b>
                  </span>
                </div>
                <span className="art-caption">
                  FIGURAS REALES. RIVALIDADES SIN LÍMITES.
                </span>
              </div>
            </section>
            <section className="steps">
              <div>
                <span>01</span>
                <p>
                  <b>ELIGE TU FIGURA</b>
                  <small>Cada edición tiene su historia.</small>
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <b>TOMA EL CONTROL</b>
                  <small>Dados, estrategia y cinco movimientos.</small>
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <b>CONQUISTA EL RING</b>
                  <small>Solo una cuenta de tres decide.</small>
                </p>
              </div>
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">TU ROSTER</span>
                  <h2>
                    LISTOS PARA EL COMBATE
                    <span className="count">{data.figures.length}</span>
                  </h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("collection")}
                >
                  Ver colección <ArrowRight size={16} />
                </button>
              </div>
              <div className="figure-grid">
                {data.figures.slice(0, 4).map((f, i) => (
                  <FigureCard
                    key={f.id}
                    figure={f}
                    index={i}
                    onClick={() => {
                      setEditor(structuredClone(f));
                      navigate("collection");
                    }}
                  />
                ))}
              </div>
              <p className="disclaimer">
                ROSTER DE DEMOSTRACIÓN · Ediciones, rarezas y valoraciones
                ficticias para probar el juego. No son calificaciones oficiales
                ni precios.
              </p>
            </section>
            <section className="bottom-banner">
              <span className="banner-symbol">↗</span>
              <div>
                <span className="eyebrow">DE TU COLECCIÓN AL RING</span>
                <h3>Cada figura merece su momento.</h3>
                <p>
                  Añade tu edición, personaliza sus movimientos y hazla tuya.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => {
                  navigate("collection");
                  setEditor(blank());
                }}
              >
                <Plus size={17} /> Añadir figura
              </button>
            </section>
          </>
        )}
        {page === "collection" && (
          <section className="section">
            <PageTitle
              eyebrow="EL VESTIDOR"
              title="TU COLECCIÓN"
              description="No es solo un luchador. Es tu edición, tu historia y tus cinco movimientos."
            />
            <div className="toolbar">
              <span>
                {data.figures.length} figuras · valoraciones internas del juego
              </span>
              <button className="primary" onClick={() => setEditor(blank())}>
                <Plus size={18} /> Añadir figura
              </button>
            </div>
            <div className="figure-grid">
              {data.figures.map((f, i) => (
                <div key={f.id}>
                  <FigureCard
                    figure={f}
                    index={i}
                    onClick={() => setEditor(structuredClone(f))}
                  />
                  <div className="figure-info">
                    {f.demo ? "DEMO FICTICIA" : "TU FIGURA"} · {f.collection}
                    <button
                      className="text-button"
                      onClick={() => setEditor(structuredClone(f))}
                    >
                      Editar <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="info-box">
              <Camera size={20} />
              <p>
                Fotografía tu figura o sube una imagen en su ficha. El
                reconocimiento automático aún no está disponible; la selección
                es manual.
              </p>
            </div>
          </section>
        )}
        {page === "select" && (
          <section className="section">
            <PageTitle
              eyebrow="PREPARA EL EVENTO"
              title="CARA A CARA"
              description="Selecciona dos figuras. El orden marca jugador 1 y jugador 2; no concede ventajas."
            />
            <div className="selection-strip">
              {[0, 1].map((i) => {
                const f = data.figures.find((f) => f.id === picks[i]);
                return (
                  <div key={i}>
                    <span className="eyebrow">JUGADOR {i + 1}</span>
                    <h3>
                      {f ? `${f.wrestler} · ${rating(f)}` : "Elige una figura"}
                    </h3>
                    <p>
                      {f ? f.moves.join(" · ") : "Toca una tarjeta del roster"}
                    </p>
                  </div>
                );
              })}
              <span className="versus">VS</span>
            </div>
            <div className="figure-grid">
              {data.figures.map((f, i) => (
                <FigureCard
                  key={f.id}
                  figure={f}
                  index={i}
                  selected={picks.includes(f.id)}
                  onClick={() =>
                    setPicks(
                      picks.includes(f.id)
                        ? picks.filter((id) => id !== f.id)
                        : picks.length < 2
                          ? [...picks, f.id]
                          : [picks[0], f.id],
                    )
                  }
                />
              ))}
            </div>
            <div className="selection-actions">
              <button className="secondary" onClick={() => navigate("home")}>
                <ArrowLeft size={16} /> Volver
              </button>
              <button
                className="primary big"
                disabled={picks.length !== 2}
                onClick={start}
              >
                HACER LAS ENTRADAS <ArrowRight size={20} />
              </button>
            </div>
          </section>
        )}
        {page === "entrance" && active && (
          <section className="entrance">
            <span className="eyebrow">
              QUE SUENE LA CAMPANA · JUGADOR {entry + 1}
            </span>
            <div className="entry-art">
              <Avatar figure={active.fighters[entry].figure} />
              <span>{rating(active.fighters[entry].figure)}</span>
            </div>
            <h1>{active.fighters[entry].figure.wrestler}</h1>
            <p>
              {active.fighters[entry].figure.era} ·{" "}
              {active.fighters[entry].figure.edition}
            </p>
            <div className="center-actions">
              {active.fighters[entry].figure.audio ? (
                <button
                  className="secondary"
                  onClick={() => {
                    if (audioPlaying) {
                      audio.current?.pause();
                      setAudioPlaying(false);
                      return;
                    }
                    if (data.preferences.muted) {
                      notify(
                        "Activa el audio en la barra superior para escuchar la entrada.",
                      );
                      return;
                    }
                    audio.current = new Audio(
                      active.fighters[entry].figure.audio,
                    );
                    audio.current.onended = () => setAudioPlaying(false);
                    audio.current
                      .play()
                      .then(() => setAudioPlaying(true))
                      .catch(() =>
                        notify(
                          "No se pudo reproducir el audio. Puedes seguir jugando.",
                        ),
                      );
                  }}
                >
                  <Volume2 size={18} />
                  {audioPlaying ? "Pausar audio" : "Reproducir mi entrada"}
                </button>
              ) : (
                <span className="muted">Entrada sin audio configurado</span>
              )}
              <button
                className="primary big"
                onClick={() => {
                  audio.current?.pause();
                  setAudioPlaying(false);
                  if (entry === 0) setEntry(1);
                  else navigate("combat");
                }}
              >
                {entry === 0 ? "SIGUIENTE LUCHADOR" : "¡QUE EMPIECE LA LUCHA!"}{" "}
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        )}
        {page === "combat" && active && (
          <Combat
            match={active}
            busy={busy}
            act={act}
            onNew={newSelection}
            notify={notify}
            onRestart={() => {
              if (
                confirm(
                  "¿Reiniciar? La lucha actual se guardará como abandonada.",
                )
              ) {
                const old = transition(
                  active,
                  { type: "abandon" },
                  active.revision,
                );
                commit({
                  ...data,
                  active: createMatch(
                    active.fighters[0].figure,
                    active.fighters[1].figure,
                  ),
                  history: [
                    old,
                    ...data.history.filter((m) => m.id !== old.id),
                  ],
                });
              }
            }}
          />
        )}
        {page === "combat" && !active && (
          <section className="empty">
            <Swords size={48} />
            <h2>El ring te espera</h2>
            <button className="primary" onClick={newSelection}>
              Nueva lucha
            </button>
          </section>
        )}
        {page === "history" && (
          <section className="section">
            <PageTitle
              eyebrow="EL LIBRO DE RÉCORDS"
              title="HISTORIAL"
              description="Cada intercambio cuenta. Consulta luchas terminadas y el registro de sus decisiones."
            />
            {detail ? (
              <>
                <button className="text-button" onClick={() => setDetail(null)}>
                  <ArrowLeft size={16} /> Todas las luchas
                </button>
                <h3>
                  {detail.fighters.map((f) => f.figure.wrestler).join(" vs. ")}
                </h3>
                <EventLog match={detail} />
              </>
            ) : data.history.length ? (
              data.history.map((m) => (
                <button
                  key={m.id}
                  className="history-row"
                  onClick={() => setDetail(m)}
                >
                  <Trophy size={24} />
                  <div>
                    <b>
                      {m.fighters.map((f) => f.figure.wrestler).join(" vs. ")}
                    </b>
                    <small>
                      {m.winner !== undefined
                        ? `Ganador: ${m.fighters[m.winner].figure.wrestler}`
                        : "Abandonada · sin ganador"}{" "}
                      · {m.round} intercambios ·{" "}
                      {new Date(m.createdAt).toLocaleDateString("es")}
                    </small>
                  </div>
                  <ChevronRight />
                </button>
              ))
            ) : (
              <div className="empty">
                <History size={48} />
                <h3>Aún no hay rivalidades escritas</h3>
                <p>Tu primera lucha aparecerá aquí al terminar.</p>
              </div>
            )}
          </section>
        )}
        {page === "rules" && (
          <section className="section rules">
            <PageTitle
              eyebrow="CONOCE EL SISTEMA"
              title="LAS REGLAS DEL RING"
              description="Las figuras se mueven en tu ring real. La app resuelve las matemáticas, tú cuentas la historia."
            />
            <div className="rules-grid">
              <article>
                <h3>01 · Gana la iniciativa</h3>
                <p>
                  Ambos tiran d20 + ⌊valoración / 10⌋. El mayor ataca. Un empate
                  repite ambos dados sin cambiar recursos. Cada luchador empieza
                  con 100 salud, 50 energía y 0 impulso.
                </p>
              </article>
              <article>
                <h3>02 · Elige tu movimiento</h3>
                <p>
                  Cinco cartas persistentes. Los costos se pagan al elegir,
                  incluso si te revierten. El estilo solo es descriptivo.
                </p>
              </article>
              <article>
                <h3>03 · Arriesga un reversal</h3>
                <p>
                  El defensor ve la carta y puede gastar 20 energía. d20 de 16 a
                  20: 25% de éxito. Cancela el golpe, causa 6 daño y gana 15
                  impulso. No permite cuenta.
                </p>
              </article>
              <article>
                <h3>04 · Busca la cuenta de tres</h3>
                <p>
                  Solo tras conectar el golpe original. P = limitar(5 + 0,6 ×
                  (100 − salud del rival) + bono, 5, 90)%. Se tira un entero
                  1–10000 contra el umbral redondeado. Es una única tirada, no
                  tres.
                </p>
              </article>
              <article>
                <h3>05 · El combate continúa</h3>
                <p>
                  Golpe conectado: atacante +15 impulso y defensor +10. Si sale
                  de la cuenta, defensor +15 extra. Al terminar el intercambio
                  ambos +10 energía. Recursos entre 0 y 100. Salud cero no
                  termina la lucha.
                </p>
              </article>
              <article>
                <h3>06 · Tu colección, tus valores</h3>
                <p>
                  Valoración = limitar(base + bono colección + bono rareza, 0,
                  100). Valores ficticios internos. Sin sumisiones, pasivas,
                  descalificaciones ni ventajas ocultas.
                </p>
              </article>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Carta</th>
                    <th>Energía</th>
                    <th>Impulso</th>
                    <th>Daño</th>
                    <th>Bono cuenta</th>
                  </tr>
                </thead>
                <tbody>
                  {BALANCE.moves.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{c.energy}</td>
                      <td>{c.momentum}</td>
                      <td>{c.damage}</td>
                      <td>+{c.pinBonus}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="info-box">
              <BookOpen />
              <p>
                Reglas iniciales experimentales, no una afirmación de
                equilibrio. Consulta los resultados reproducibles y las
                limitaciones en la documentación del proyecto.
              </p>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span className="footer-brand">
          FIGUREMANIA <small>v0.1 · PRIMER ASALTO</small>
        </span>
        <p>Hecho para jugar con lo que ya tienes.</p>
        <span>*Una vez cargada la app · datos solo en este navegador</span>
      </footer>
      {editor && (
        <FigureEditor
          figure={editor}
          close={() => setEditor(null)}
          onSave={(f) => {
            const figures = data.figures.some((x) => x.id === f.id)
              ? data.figures.map((x) => (x.id === f.id ? f : x))
              : [...data.figures, f];
            if (commit({ ...data, figures })) setEditor(null);
          }}
          onDelete={() => {
            if (
              confirm(
                "¿Eliminar esta figura? Las luchas guardadas conservarán su copia.",
              )
            ) {
              if (
                commit({
                  ...data,
                  figures: data.figures.filter((f) => f.id !== editor.id),
                })
              )
                setEditor(null);
            }
          }}
          notify={notify}
        />
      )}
      {showSettings && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-heading">
              <h2 id="settings-title">Ajustes del ring</h2>
              <button
                className="icon-button"
                aria-label="Cerrar ajustes"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={data.preferences.reducedMotion}
                onChange={(e) =>
                  commit({
                    ...data,
                    preferences: {
                      ...data.preferences,
                      reducedMotion: e.target.checked,
                    },
                  })
                }
              />{" "}
              Reducir movimiento
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={data.preferences.muted}
                onChange={(e) => {
                  audio.current?.pause();
                  setAudioPlaying(false);
                  commit({
                    ...data,
                    preferences: {
                      ...data.preferences,
                      muted: e.target.checked,
                    },
                  });
                }}
              />{" "}
              Silenciar audio y efectos
            </label>
            <p>
              El guardado es local. Cambiar de dispositivo o borrar los datos
              del navegador elimina el acceso a tus partidas. Conserva un
              respaldo.
            </p>
            <button className="secondary" onClick={exportData}>
              <Download size={16} /> Exportar respaldo
            </button>
            <label className="file-label secondary">
              Importar respaldo
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void restore(file);
                  e.target.value = "";
                }}
              />
            </label>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function EventLog({ match }: { match: Match }) {
  return (
    <div className="event-log" aria-label="Registro de acciones">
      {[...match.events].reverse().map((e, i) => (
        <div key={`${e.revision}-${i}`}>
          <span>#{e.round.toString().padStart(2, "0")}</span>
          <p>{e.text}</p>
        </div>
      ))}
      {!match.events.length && (
        <p className="muted">El primer lanzamiento iniciará la historia.</p>
      )}
    </div>
  );
}
function Combat({
  match: m,
  busy,
  act,
  onNew,
  notify,
  onRestart,
}: {
  match: Match;
  busy: boolean;
  act: (a: Action, r: number) => void;
  onNew: () => void;
  notify: (s: string) => void;
  onRestart: () => void;
}) {
  const [log, setLog] = useState(false);
  const a = m.attacker ?? 0,
    d = 1 - a;
  const perform = (action: Action) => act(action, m.revision);
  if (m.phase === "finished" || m.phase === "abandoned")
    return (
      <section className="section result">
        <span className="eyebrow">
          {m.phase === "finished" ? "LA CAMPANA HA SONADO" : "FIN DE LA SESIÓN"}
        </span>
        <Trophy size={56} />
        <h1>
          {m.winner !== undefined ? "¡TENEMOS GANADOR!" : "LUCHA ABANDONADA"}
        </h1>
        {m.winner !== undefined && (
          <>
            <div className="winner-art">
              <Avatar figure={m.fighters[m.winner].figure} />
            </div>
            <h2>{m.fighters[m.winner].figure.wrestler}</h2>
            <p>
              {m.fighters[m.winner].figure.edition} · Victoria por cuenta de
              tres
            </p>
            <div className="final-count">
              1 <span>2</span> 3
            </div>
          </>
        )}
        <div className="result-stats">
          <div>
            <b>{m.round}</b>
            <small>INTERCAMBIOS</small>
          </div>
          <div>
            <b>
              {
                m.events.filter(
                  (e) => e.kind === "reversal" && e.text.includes("¡Éxito!"),
                ).length
              }
            </b>
            <small>REVERSALS EXITOSOS</small>
          </div>
          <div>
            <b>{m.replays.length}</b>
            <small>GOLPES CONECTADOS</small>
          </div>
        </div>
        <button className="primary big" onClick={onNew}>
          VOLVER AL RING <ArrowRight size={20} />
        </button>
        <h3>Así se escribió la lucha</h3>
        <EventLog match={m} />
      </section>
    );
  return (
    <section className="section combat">
      <div className="combat-heading">
        <div>
          <span className="eyebrow">COMBATE LOCAL</span>
          <h2>INTERCAMBIO {String(m.round).padStart(2, "0")}</h2>
        </div>
        <div>
          <button
            className="icon-button"
            title="Reiniciar lucha"
            aria-label="Reiniciar lucha"
            onClick={onRestart}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="text-button danger"
            onClick={() => {
              if (confirm("¿Abandonar esta lucha sin ganador?"))
                perform({ type: "abandon" });
            }}
          >
            Abandonar
          </button>
        </div>
      </div>
      <div className="scoreboard">
        {m.fighters.map((f, i) => (
          <article
            key={i}
            className={`fighter-panel ${m.phase !== "roll" && a === i ? "attacking" : ""}`}
          >
            <div className="fighter-head">
              <div className="mini-avatar">
                <Avatar figure={f.figure} />
              </div>
              <div>
                <small>
                  JUGADOR {i + 1} · {rating(f.figure)} VAL
                </small>
                <h3>{f.figure.wrestler}</h3>
                <p>{f.figure.edition}</p>
              </div>
              {m.phase !== "roll" && a === i && <Swords size={20} />}
            </div>
            <Resource label="Salud" value={f.health} kind="health" />
            <div className="secondary-resources">
              <Resource label="Energía" value={f.energy} kind="energy" />
              <Resource label="Impulso" value={f.momentum} kind="momentum" />
            </div>
          </article>
        ))}
        <span className="score-vs">VS</span>
      </div>
      <div
        className={`action-arena phase-${m.phase} ${m.phase === "roll" && m.events.slice(-3).some((e) => e.kind === "reversal" && e.text.includes("¡Éxito!")) ? "reversal-effect" : ""}`}
        key={`${m.round}-${m.phase}`}
        aria-live="polite"
      >
        {m.phase === "roll" && (
          <>
            <span className="eyebrow">
              {m.events.at(-1)?.kind === "tie"
                ? "EMPATE · SIN CAMBIO DE RECURSOS"
                : "LA INICIATIVA ESTÁ EN JUEGO"}
            </span>
            <h2>¿QUIÉN DA EL PRIMER GOLPE?</h2>
            <p>
              D20 + bono de valoración. El total más alto elige su movimiento.
            </p>
            <div className="dice-row">
              {m.fighters.map((f, i) => (
                <div key={i}>
                  <div className="die">{m.dice?.[i] ?? "?"}</div>
                  <span>+{Math.floor(rating(f.figure) / 10)} VAL</span>
                  {m.dice && (
                    <b>Total {m.dice[i] + Math.floor(rating(f.figure) / 10)}</b>
                  )}
                </div>
              ))}
            </div>
            <button
              className="primary big"
              disabled={busy}
              onClick={() => perform({ type: "roll" })}
            >
              LANZAR AMBOS DADOS <Zap size={20} />
            </button>
          </>
        )}
        {m.phase === "choose" && (
          <>
            <span className="eyebrow">
              TURNO DE {m.fighters[a].figure.wrestler.toUpperCase()}
            </span>
            <h2>ELIGE TU MOVIMIENTO</h2>
            <div className="initiative-result">
              {m.fighters.map((f, i) => (
                <span key={i}>
                  {f.figure.wrestler}: 🎲 {m.dice![i]} +{" "}
                  {Math.floor(rating(f.figure) / 10)} ={" "}
                  <b>{m.dice![i] + Math.floor(rating(f.figure) / 10)}</b>
                </span>
              ))}
            </div>
            <div className="move-grid">
              {BALANCE.moves.map((c, i) => {
                const lacks = missing(m.fighters[a], i);
                return (
                  <button
                    className={`move-card move-${i}`}
                    key={i}
                    disabled={!!lacks.length || busy}
                    onClick={() => perform({ type: "move", index: i })}
                  >
                    <span className="tiny">{c.label}</span>
                    <strong>{m.fighters[a].figure.moves[i]}</strong>
                    <span className="move-damage">
                      {c.damage}
                      <small>DAÑO</small>
                    </span>
                    <span className="move-cost">
                      {c.energy} EN · {c.momentum} IMP
                    </span>
                    <small>
                      {lacks.length
                        ? `Falta: ${lacks.join(" y ")}`
                        : "Disponible"}
                    </small>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {m.phase === "defend" && (
          <>
            <span className="eyebrow">
              DECIDE {m.fighters[d].figure.wrestler.toUpperCase()}
            </span>
            <Shield className="action-icon" size={38} />
            <h2>¿TE ATREVES A REVERTIR?</h2>
            <p>
              <b>{m.fighters[a].figure.moves[m.move!]}</b> amenaza con{" "}
              {BALANCE.moves[m.move!].damage} de daño.
            </p>
            <p className="cost-note">
              Atacante ya pagó {BALANCE.moves[m.move!].energy} energía y{" "}
              {BALANCE.moves[m.move!].momentum} impulso. Sin reembolso.
            </p>
            <div className="center-actions">
              <button
                className="primary"
                disabled={busy || m.fighters[d].energy < 20}
                onClick={() => perform({ type: "defend", attempt: true })}
              >
                INTENTAR REVERSAL · 20 EN
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => perform({ type: "defend", attempt: false })}
              >
                Recibir el ataque
              </button>
            </div>
            <small>
              {m.fighters[d].energy < 20
                ? "No tienes 20 de energía. Solo puedes recibir el ataque."
                : "25% de éxito · d20 de 16 a 20 · 6 daño y +15 impulso si funciona"}
            </small>
          </>
        )}
        {m.phase === "pin" && (
          <>
            <span className="eyebrow">
              ¡IMPACTO! · {m.fighters[a].figure.moves[m.move!]}
            </span>
            <h2>¿BUSCAS LA CUENTA DE TRES?</h2>
            <p>
              {BALANCE.moves[m.move!].damage} daño · Rival con{" "}
              {m.fighters[d].health} salud · Impulso +15 / +10
            </p>
            {m.reversalDie !== undefined && (
              <p>
                Reversal fallido: d20 {m.reversalDie}. Daño original completo.
              </p>
            )}
            <div className="pin-chance">
              <b>
                {pinThreshold(m.fighters[d].health, m.move!) / 100}
                <span>%</span>
              </b>
              <small>PROBABILIDAD DE VICTORIA</small>
            </div>
            <p className="formula">
              5 + 0,6 × (100 − {m.fighters[d].health}) +{" "}
              {BALANCE.moves[m.move!].pinBonus} → umbral{" "}
              {pinThreshold(m.fighters[d].health, m.move!)}/10000
            </p>
            <div className="center-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => perform({ type: "pin", attempt: true })}
              >
                ¡A LA CUENTA! 1 · 2 · 3
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => perform({ type: "pin", attempt: false })}
              >
                Seguir sin cuenta
              </button>
            </div>
            <button
              className="text-button replay-button"
              onClick={() =>
                notify(
                  replayAvailability.message +
                    " El movimiento ya está registrado y su resultado no cambiará.",
                )
              }
            >
              <Play size={14} /> Repetición IA · No disponible
            </button>
          </>
        )}
      </div>
      <div className="last-event">
        {m.events.slice(-3).map((e, i) => (
          <p key={i}>{e.text}</p>
        ))}
      </div>
      <button className="text-button" onClick={() => setLog(!log)}>
        <History size={16} />
        {log ? "Ocultar" : "Ver"} registro completo ({m.events.length})
      </button>
      {log && <EventLog match={m} />}
    </section>
  );
}
function Resource({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: string;
}) {
  return (
    <div className={`resource ${kind}`}>
      <div>
        <span>{label}</span>
        <b>
          {value}
          <small>/100</small>
        </b>
      </div>
      <div
        className="bar"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
function blank(): Figure {
  return {
    id: crypto.randomUUID(),
    wrestler: "",
    era: "",
    outfit: "",
    collection: "",
    edition: "",
    rarity: "Común",
    base: 70,
    collectionBonus: 0,
    rarityBonus: 0,
    style: "Técnico",
    moves: BALANCE.moves.map((c) => c.label),
  };
}
function FigureEditor({
  figure,
  close,
  onSave,
  onDelete,
  notify,
}: {
  figure: Figure;
  close: () => void;
  onSave: (f: Figure) => void;
  onDelete: () => void;
  notify: (s: string) => void;
}) {
  const [f, setF] = useState(figure);
  const [loading, setLoading] = useState(false);
  const field = (key: keyof Figure, value: string | number) =>
    setF((v) => ({ ...v, [key]: value }));
  const media = async (file: File | undefined, type: "photo" | "audio") => {
    if (!file) return;
    if (!file.type.startsWith(type === "photo" ? "image/" : "audio/")) {
      notify("Elige un archivo del tipo correcto.");
      return;
    }
    if (file.size > (type === "photo" ? 3 : 2) * 1024 * 1024) {
      notify(
        `Archivo demasiado grande: máximo ${type === "photo" ? 3 : 2} MB. Usa archivos más pequeños para conservar espacio local.`,
      );
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      field(type, String(reader.result));
      setLoading(false);
    };
    reader.onerror = () => {
      setLoading(false);
      notify("No se pudo leer el archivo. Puedes continuar sin él.");
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FICHA DE FIGURA</span>
            <h2 id="editor-title">
              {figure.wrestler ? "EDITAR FIGURA" : "NUEVO CONTENDIENTE"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Cerrar editor"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (f.moves.some((m) => !m.trim())) return;
            onSave({ ...f, wrestler: f.wrestler.trim() });
          }}
        >
          <div className="editor-top">
            <div className="editor-avatar">
              <Avatar figure={f} />
            </div>
            <div>
              <label className="file-label secondary">
                <Camera size={16} /> Tomar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void media(e.target.files?.[0], "photo")}
                />
              </label>
              <label className="file-label secondary">
                Subir imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void media(e.target.files?.[0], "photo")}
                />
              </label>
              <small>
                Si la cámara no está disponible, sube una foto o conserva la
                ilustración. Máximo 3 MB.
              </small>
              {f.photo && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setF({ ...f, photo: undefined })}
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
          <div className="form-grid">
            {(
              [
                ["wrestler", "Luchador"],
                ["era", "Época"],
                ["outfit", "Atuendo"],
                ["collection", "Colección"],
                ["edition", "Edición"],
                ["rarity", "Rareza declarada"],
                ["style", "Estilo (descriptivo)"],
              ] as [keyof Figure, string][]
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={key === "wrestler" || key === "edition"}
                  maxLength={80}
                  value={String(f[key] ?? "")}
                  onChange={(e) => field(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="balance-editor">
            <h3>
              Valoración <strong>{rating(f)}</strong>
            </h3>
            <div className="form-grid three">
              {(
                [
                  ["base", "Valor base"],
                  ["collectionBonus", "Bono colección"],
                  ["rarityBonus", "Bono rareza"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={key === "base" ? 0 : -100}
                    max={100}
                    required
                    value={f[key]}
                    onChange={(e) => field(key, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
            <small>
              Base + bonos, limitado a 0–100. Valores del juego, no oficiales.
            </small>
          </div>
          <h3>Cinco movimientos</h3>
          {BALANCE.moves.map((c, i) => (
            <label key={i} className="move-input">
              {c.label}
              <input
                required
                maxLength={50}
                value={f.moves[i]}
                onChange={(e) =>
                  setF({
                    ...f,
                    moves: f.moves.map((m, j) =>
                      j === i ? e.target.value : m,
                    ),
                  })
                }
              />
              <small>
                {c.energy} energía · {c.momentum} impulso · {c.damage} daño
              </small>
            </label>
          ))}
          <label className="file-label secondary">
            <Volume2 size={16} />{" "}
            {f.audio ? "Cambiar audio de entrada" : "Añadir audio de entrada"}
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => void media(e.target.files?.[0], "audio")}
            />
          </label>
          {f.audio && (
            <button
              type="button"
              className="text-button"
              onClick={() => setF({ ...f, audio: undefined })}
            >
              Quitar audio
            </button>
          )}
          <small className="block muted">
            Audio aportado por ti, hasta 2 MB. Se reproduce con un toque en la
            entrada. No subas material sin permiso.
          </small>
          {f.demo && (
            <p className="disclaimer">
              Figura de demostración. Datos ficticios editables.
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="icon-button danger"
              onClick={onDelete}
              aria-label="Eliminar figura"
            >
              <Trash2 size={19} />
            </button>
            <button type="button" className="secondary" onClick={close}>
              Cancelar
            </button>
            <button
              className="primary"
              type="submit"
              disabled={loading || !f.wrestler.trim()}
            >
              Guardar figura <Check size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default App;
