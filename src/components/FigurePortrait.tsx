import { Check } from "lucide-react";
import { rating, type Figure } from "../core/engine";
export function Avatar({
  figure,
  large = false,
}: {
  figure: Figure;
  large?: boolean;
}) {
  const color = figure.id.includes("rey")
    ? "#38e8ff"
    : figure.id === "titan"
      ? "#6f9bff"
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
export function FigureCard({
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
