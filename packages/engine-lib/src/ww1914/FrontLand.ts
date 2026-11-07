import {
  GW_FRONT_START,
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
    oder: {
      entente: [
        "konigsberg",
        "gumbinnen",
        "masuria",
        "tannenberg",
        "memel",
        "lemberg",
        "tarnopol",
        "stanislau",
        "czernowitz",
        "przemysl",
        "gorlice",
        "tarnow",
        "krakow",
        "posen",
        "thorn",
        "kattowitz",
        "breslau",
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
      central: [
        "riga",
        "dvinsk",
        "rovno",
        "bucharest",
        "ploesti",
        "craiova",
        "constanta",
      ],
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
      entente: ["rodosto", "edirne", "constantinople", "izmit"],
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
};

/** Every place a theatre's lines can move. */
export function frontPlaces(t: GwTheatre): GwPlace[] {
  return Object.values(GW_FRONT_LAND[t]).flatMap((l) => [
    ...(l.central ?? []),
    ...(l.entente ?? []),
  ]);
}

/** Who holds what with a theatre's line at index `line`: place -> side. */
export function frontLandAt(t: GwTheatre, line: number): Map<GwPlace, GwSide> {
  const start = GW_FRONT_START[t];
  const out = new Map<GwPlace, GwSide>();
  const step = line >= start ? 1 : -1;
  for (let i = start; ; i += step) {
    const land = GW_FRONT_LAND[t][GW_LINES[t][i]];
    for (const p of land?.central ?? []) out.set(p, "central");
    for (const p of land?.entente ?? []) out.set(p, "entente");
    if (i === line) return out;
  }
}
