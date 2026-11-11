import {
  GW_FRONT_START,
  GW_LINE_STEP,
  GW_LINES,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";

export interface GwLineLand {
  readonly central?: readonly GwPlace[];
  readonly entente?: readonly GwPlace[];
}

/**
 * What a side holds for standing on a named line, beyond what the lines
 * between it and the theatre's start gave it. The start line's own entry
 * goes to its side when the theatre opens. A place belongs to one theatre.
 * A line named after a town means the town has fallen.
 */
export const GW_FRONT_LAND: Readonly<
  Record<GwTheatre, Readonly<Record<string, GwLineLand>>>
> = {
  west: {
    rhine: {
      entente: ["metz", "strasbourg", "mulhouse", "saarbrucken", "rhineland"],
    },
    hindenburg: {
      central: [
        "liege",
        "namur",
        "arlon",
        "brussels",
        "antwerp",
        "ghent",
        "ostend",
        "mons",
        "maubeuge",
        "sedan",
        "lille",
        "cambrai",
        "saint_quentin",
        "laon",
      ],
    },
    somme: { central: ["ypres", "arras", "peronne", "soissons"] },
    aisne: { central: ["reims", "compiegne", "amiens"] },
    marne: {
      central: [
        "chalons",
        "verdun",
        "meaux",
        "beauvais",
        "bar_le_duc",
        "calais",
        "nancy",
      ],
    },
    paris: { central: ["paris", "melun", "epinal", "belfort"] },
  },
  east: {
    // Listed in the order the ground is reached: a third of the list falls
    // with each step of the line, so the map does not jump (frontLandAt).
    oder: {
      entente: [
        "gumbinnen",
        "tarnopol",
        "lemberg",
        "stanislau",
        "czernowitz",
        "memel",
        "masuria",
        "przemysl",
        "tannenberg",
        "gorlice",
        "tarnow",
        "posen",
        "krakow",
        "kattowitz",
        "breslau",
        "thorn",
        "konigsberg",
      ],
    },
    vistula: {
      central: ["lodz", "kalisz", "czestochowa", "kielce", "plock"],
    },
    warsaw: {
      central: [
        "warsaw",
        "radom",
        "lublin",
        "chelm",
        "siedlce",
        "lomza",
        "bialystok",
        "suwalki",
      ],
    },
    riga: {
      central: [
        "kovno",
        "vilna",
        "grodno",
        "brest_litovsk",
        "baranovichi",
        "windau",
        "mitau",
        "lutsk",
        "telsiai",
        "siauliai",
        "panevezys",
        "marijampole",
      ],
    },
    dvina: {
      central: ["riga", "dvinsk", "rovno", "bucharest", "ploesti", "craiova"],
    },
    kiev: {
      central: ["kiev", "zhitomir", "minsk", "vitebsk", "kamenets", "vinnitsa"],
    },
  },
  balkan: {
    belgrade: { central: ["belgrade", "valjevo"] },
    nis: {
      central: [
        "kragujevac",
        "uzice",
        "nis",
        "zajecar",
        "pristina",
        "pec",
        "cetinje",
      ],
    },
    salonika: {
      central: ["skopje", "bitola", "scutari", "durazzo", "valona"],
    },
  },
  italy: {
    trentino: { entente: ["gorizia", "trieste", "trento"] },
    piave: { central: ["udine", "belluno"] },
    adige: { central: ["treviso", "venice", "vicenza", "verona"] },
  },
  caucasus: {
    erzurum: { entente: ["bayazid", "erzurum"] },
    trabzon: { entente: ["trabzon", "erzincan"] },
    van: { entente: ["van", "bitlis"] },
  },
  straits: {
    gallipoli: { entente: ["gallipoli"] },
    narrows: { entente: ["canakkale"] },
    constantinople: {
      entente: ["rodosto", "constantinople", "izmit"],
    },
  },
  mesopotamia: {
    basra: { entente: ["basra"] },
    kut: { entente: ["kut"] },
    baghdad: { entente: ["baghdad"] },
    mosul: { entente: ["mosul", "arbil"] },
  },
  palestine: {
    gaza: { entente: ["gaza"] },
    jerusalem: { entente: ["jerusalem", "amman"] },
    damascus: { entente: ["damascus", "beirut"] },
  },
  sea: {},
  colonies: {
    togo: { entente: ["togo"] },
    kamerun: { entente: ["kamerun"] },
    southwest: { entente: ["windhoek"] },
    east_africa: { entente: ["dar_es_salaam"] },
  },
  // ww171 phase 4: the new fronts, from places the old ones left free (Edirne
  // from the Straits, Constanța from the east). Lines named in
  // GW_FRONT_BARE have no place on the map to change hands.
  alps: {
    dauphine: { central: ["marseille"] },
    rhone: { central: ["lyon", "le_creusot"] },
  },
  danube: {
    moldavia: { central: ["iasi"] },
    brasso: { entente: ["brasso", "nagyszeben"] },
    kolozsvar: { entente: ["kolozsvar", "nagyvarad", "temesvar"] },
  },
  thrace: {
    salonika: { central: ["salonika"] },
    dedeagach: { central: ["dedeagach", "plovdiv"] },
    edirne: { entente: ["edirne"] },
  },
  low_countries: {
    cologne: { entente: ["cologne"] },
    aachen: { entente: ["aachen"] },
    amsterdam: { central: ["amsterdam"] },
  },
  dobruja: {
    varna: { entente: ["varna"] },
    constanta: { central: ["constanta"] },
  },
  persia: {},
};

/**
 * Lines of the new fronts with no place on the map to change hands: the
 * ground is there, the regions aren't (Piedmont, the Danube delta, Persia).
 */
export const GW_FRONT_BARE: Readonly<
  Partial<Record<GwTheatre, readonly string[]>>
> = {
  alps: ["po"],
  dobruja: ["delta"],
  persia: ["baghdad_road", "hamadan", "tabriz"],
};

/** Every place a theatre's lines can move. */
export function frontPlaces(t: GwTheatre): GwPlace[] {
  return Object.values(GW_FRONT_LAND[t]).flatMap((l) => [
    ...(l.central ?? []),
    ...(l.entente ?? []),
  ]);
}

/**
 * Who holds what with a theatre's line at index `line`: place -> side.
 * `step` (-2..2, default 0) is how far the front has gone on past that line,
 * away from the start, towards the next one (negative: towards the lower
 * index). The next line's places fall a share at a time, in list order, so a
 * line of seventeen places does not change hands in one chapter.
 * `salient` (-2..2, ww173) is what small moves bit past that: one place each,
 * + for the end a rising line favours. Places only: the line stays.
 */
export function frontLandAt(
  t: GwTheatre,
  line: number,
  step = 0,
  salient = 0,
): Map<GwPlace, GwSide> {
  const start = GW_FRONT_START[t];
  const out = new Map<GwPlace, GwSide>();
  const dir = line >= start ? 1 : -1;
  for (let i = start; ; i += dir) {
    const land = GW_FRONT_LAND[t][GW_LINES[t][i]];
    for (const p of land?.central ?? []) out.set(p, "central");
    for (const p of land?.entente ?? []) out.set(p, "entente");
    if (i === line) break;
  }
  if (step !== 0) {
    const next = GW_FRONT_LAND[t][GW_LINES[t][line + Math.sign(step)]];
    for (const side of ["central", "entente"] as const) {
      const list = next?.[side] ?? [];
      for (const p of list.slice(0, shareOf(list, step))) out.set(p, side);
    }
  }
  if (salient !== 0) bite(out, t, line, step, salient);
  return out;
}

/** Places of a line's list a step past it has taken. */
const shareOf = (list: readonly GwPlace[], step: number) =>
  Math.ceil((list.length * Math.abs(step)) / GW_LINE_STEP);

/**
 * A salient's places: going on away from the start, the next of the next
 * line's list; coming back, the last taken go back to their owners.
 */
function bite(
  out: Map<GwPlace, GwSide>,
  t: GwTheatre,
  line: number,
  step: number,
  salient: number,
): void {
  const start = GW_FRONT_START[t];
  const way = Math.sign(salient);
  const k = Math.abs(salient);
  const away = step !== 0 ? Math.sign(step) : Math.sign(line - start);
  const entry = (i: number) => GW_FRONT_LAND[t][GW_LINES[t][i] ?? ""];
  if (away === 0 || way === away) {
    const next = entry(line + way);
    for (const side of ["central", "entente"] as const) {
      const list = next?.[side] ?? [];
      const n = step === 0 ? 0 : shareOf(list, step);
      for (const p of list.slice(n, n + k)) out.set(p, side);
    }
    return;
  }
  const own = step === 0 ? entry(line) : entry(line + Math.sign(step));
  for (const side of ["central", "entente"] as const) {
    const list = own?.[side] ?? [];
    const n = step === 0 ? list.length : shareOf(list, step);
    for (const p of list.slice(Math.max(0, n - k), n)) out.delete(p);
  }
}
