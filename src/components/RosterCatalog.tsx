import { useState } from "react";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import {
  divisions,
  roster,
  searchRoster,
  type RosterEntry,
} from "../core/roster";
export function RosterCatalog({
  onRegister,
}: {
  onRegister: (entry: RosterEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const entries = searchRoster(query, division);
  return (
    <section className="roster-catalog" aria-label="Roster compartido">
      <div className="catalog-intro">
        <div>
          <span className="eyebrow">DE LEYENDAS A LA NUEVA GENERACIÓN</span>
          <h2>ELIGE TU PRÓXIMA FIGURA</h2>
        </div>
        <span className="catalog-total">
          {roster.length}
          <small>CONTENDIENTES</small>
        </span>
      </div>
      <p className="catalog-note">
        Tu roster, listo para jugar. Registra una edición para añadir foto,
        colección y valoración propias. Las plantillas empiezan en 80: es un
        valor provisional del juego, no una calificación oficial.
      </p>
      <div className="catalog-filters">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Buscar en el roster"
            placeholder="Buscar luchador o luchadora…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="division-select">
          DIVISIÓN
          <select
            aria-label="Filtrar división del roster"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="all">Todas las divisiones</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="roster-result-count" role="status">
        {entries.length} de {roster.length} contendientes
      </div>
      <div className="catalog-grid">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`catalog-card division-${entry.division}`}
          >
            <div className="catalog-number">
              {String(roster.indexOf(entry) + 1).padStart(3, "0")}
              <ArrowUpRight size={15} />
            </div>
            <span className="catalog-monogram" aria-hidden="true">
              {entry.name
                .replace(/\([^)]*\)|"[^\"]*"/g, "")
                .trim()
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="eyebrow">
              {divisions.find((d) => d.id === entry.division)?.short}
            </span>
            <h3>{entry.name}</h3>
            <span className="template-label">EDICIÓN POR REGISTRAR</span>
            <button
              className="secondary"
              onClick={() => onRegister(entry)}
              aria-label={`Registrar figura de ${entry.name}`}
            >
              <Plus size={15} /> Registrar figura
            </button>
          </article>
        ))}
      </div>
      {!entries.length && (
        <div className="empty">
          <h3>No encontramos ese nombre</h3>
          <p>Prueba otra búsqueda o elige todas las divisiones.</p>
          <button
            className="secondary"
            onClick={() => {
              setQuery("");
              setDivision("all");
            }}
          >
            Mostrar todo el roster
          </button>
        </div>
      )}
      <p className="disclaimer">
        Listado proporcionado por el propietario; no es un inventario verificado
        de Mattel. «Roddy Piper» y «Rowdy Roddy Piper» se agrupan como el mismo
        nombre. Mankind y Mick Foley, y las versiones clásica y moderna de Rey,
        conservan sus propias entradas. Sin fotografías oficiales incluidas.
      </p>
    </section>
  );
}
