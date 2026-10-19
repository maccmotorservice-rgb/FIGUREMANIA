import { BALANCE, type Figure } from "./engine";
// Names and divisions supplied by the owner. This is not an independently
// verified Mattel inventory. Edition, rarity and rating remain user-defined.
export const divisions = [
  {
    id: "legends",
    label: "Leyendas e íconos",
    short: "LEYENDAS",
    names: [
      "Hulk Hogan",
      "Stone Cold Steve Austin",
      "The Rock",
      "The Undertaker",
      "Triple H",
      'Bret "Hit Man" Hart',
      "Shawn Michaels",
      "Ultimate Warrior",
      "Ric Flair",
      "Macho Man Randy Savage",
      "Rowdy Roddy Piper",
      "Dusty Rhodes",
      "Mankind",
      "Kane",
      "Lex Luger",
      "Andre The Giant",
      "Razor Ramon",
      "Diesel",
      "Eddie Guerrero",
      "Rey Mysterio (Versiones Clásicas)",
      "Bruno Sammartino",
      "Ted DiBiase",
      'Jake "The Snake" Roberts',
      "Sgt. Slaughter",
      "Big Van Vader",
      "Mick Foley",
      "British Bulldog",
    ],
  },
  {
    id: "modern",
    label: "Superestrellas modernas",
    short: "ESTELARES",
    names: [
      "Roman Reigns",
      "Cody Rhodes",
      "Seth Rollins",
      "John Cena",
      "CM Punk",
      "Drew McIntyre",
      "Randy Orton",
      "Kevin Owens",
      "AJ Styles",
      "Sami Zayn",
      "Gunther",
      "Jey Uso",
      "Jimmy Uso",
      "Solo Sikoa",
      "Bobby Lashley",
      "LA Knight",
      "Damian Priest",
      "Finn Bálor",
      "Sheamus",
      "Shinsuke Nakamura",
      "Rey Mysterio",
      "Dominik Mysterio",
      "Logan Paul",
      "The Miz",
      "Kofi Kingston",
      "Xavier Woods",
      "Big E",
      "Braun Strowman",
      "Baron Corbin",
    ],
  },
  {
    id: "women",
    label: "División femenil",
    short: "FEMENIL",
    names: [
      "Rhea Ripley",
      "Charlotte Flair",
      "Bianca Belair",
      "Liv Morgan",
      "Iyo Sky",
      "Jade Cargill",
      "Kairi Sane",
      "Roxanne Perez",
      "Dakota Kai",
      "Becky Lynch",
      "Trish Stratus",
      "Lita",
      "Bayley",
      "Asuka",
      "Alexa Bliss",
      "Shayna Baszler",
      "Ronda Rousey",
      "Natalya",
      "Carmella",
      "Naomi",
      "Zelina Vega",
      "Shotzi",
      "Tiffany Stratton",
      "Alba Fyre",
      "Isla Dawn",
    ],
  },
  {
    id: "rising",
    label: "En ascenso, NXT y ex-alumnos",
    short: "NXT Y MÁS",
    names: [
      "Grayson Waller",
      "Austin Theory",
      "Bron Breakker",
      "Carmelo Hayes",
      "Ilja Dragunov",
      "Andrade",
      "Carlito",
      "Trick Williams",
      "Tony D'Angelo",
      "Wes Lee",
      "Dragon Lee",
      "Santos Escobar",
      "Cruz Del Toro",
      "Joaquin Wilde",
      "Ridge Holland",
      "Pete Dunne (Butch)",
      "Tyler Bate",
      "Otis",
      "Chad Gable",
      "Giovanni Vinci",
      "Ludwig Kaiser",
      "JD McDonagh",
      "Apollo Crews",
      "Cedric Alexander",
      'Ashante "The Adonis"',
      "Johnny Knoxville (Celebridad)",
    ],
  },
] as const;
export type RosterEntry = {
  id: string;
  name: string;
  division: string;
  aliases: string[];
  figure: Figure;
};
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const roster: RosterEntry[] = divisions.flatMap((division) =>
  division.names.map((name) => {
    const id = `roster-${division.id}-${normalize(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "")}`;
    const moves = BALANCE.moves.map((c) => c.label) as string[];
    if (name.startsWith("Rey Mysterio")) {
      moves[3] = "619";
      moves[4] = "Splash";
    }
    return {
      id,
      name,
      division: division.id,
      aliases: name === "Rowdy Roddy Piper" ? ["Roddy Piper"] : [],
      figure: {
        id,
        wrestler: name,
        era: division.label,
        outfit: "Por definir",
        collection: "Por definir",
        edition: "Edición por definir",
        rarity: "Por definir",
        base: 80,
        collectionBonus: 0,
        rarityBonus: 0,
        style: "Por definir",
        moves,
      },
    };
  }),
);
export const isRosterTemplate = (figure: Figure) =>
  figure.id.startsWith("roster-");
export function searchRoster(query: string, division = "all") {
  const q = normalize(query.trim());
  return roster.filter(
    (entry) =>
      (division === "all" || entry.division === division) &&
      normalize([entry.name, ...entry.aliases].join(" ")).includes(q),
  );
}
export function registerTemplate(entry: RosterEntry): Figure {
  return {
    ...structuredClone(entry.figure),
    id: crypto.randomUUID(),
    edition: "",
    collection: "",
    rarity: "Común",
  };
}
