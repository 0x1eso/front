// World War 1936 historical catalogue (ww78 section 7B): which catalogue ship
// each 1936 ship and slip is. "Exact" names a ship of the entry's own class;
// "like" one that stands in on a sister or near-sister design. Destroyers and
// submarines have no names in START_NAVY, so they go by class and generation
// and are always stand-ins. What isn't here stays a generic ship: a poor fit in
// size or era (Hermes as Courageous, a 1917 C class as Leander), or a class
// mismatch (the Kirovs are heavy cruisers on the slips, light in the catalogue).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import { shipNameKey } from "../ShipNames";
import { START_NAVY } from "../StartNavy";
import type { HistCountry } from "./Types";

interface FleetMap {
  /** Entry id → names (without the country prefix) of that class. */
  exact: Readonly<Record<string, readonly string[]>>;
  /** Entry id → names standing in on it. */
  like: Readonly<Record<string, readonly string[]>>;
  /** `cls_gen` of the unnamed 1936 ships → entry id. */
  numbered: Readonly<Record<string, string>>;
  /** `cls_gen` of the unnamed lines → entry id. */
  lines: Readonly<Record<string, string>>;
}

export const START_FLEET_MAP: Readonly<Record<HistCountry, FleetMap>> = {
  GBR: {
    exact: {
      gbr_bb_nelson: ["nelson", "rodney"],
      gbr_bb_qe: ["queen_elizabeth", "barham", "valiant", "warspite", "malaya"],
      gbr_bc_hood: ["hood"],
      gbr_cv_courageous: ["courageous", "glorious"],
      gbr_cv_ark_royal: ["ark_royal"],
      gbr_ca_norfolk: ["norfolk", "dorsetshire"],
      gbr_cl_leander: ["leander", "achilles", "neptune", "orion", "ajax"],
      gbr_cl_southampton: [
        "newcastle",
        "southampton",
        "sheffield",
        "glasgow",
        "birmingham",
      ],
    },
    like: {
      gbr_bb_qe: [
        "resolution",
        "ramillies",
        "royal_sovereign",
        "revenge",
        "royal_oak",
      ],
      gbr_bc_hood: ["repulse", "renown"],
      gbr_cv_courageous: ["furious"],
      gbr_ca_norfolk: [
        "cumberland",
        "suffolk",
        "london",
        "devonshire",
        "shropshire",
        "sussex",
        "kent",
        "cornwall",
        "berwick",
        "york",
        "exeter",
        "hawkins",
        "frobisher",
        "effingham",
      ],
      gbr_cl_leander: [
        "arethusa",
        "galatea",
        "apollo",
        "amphion",
        "penelope",
        "aurora",
      ],
    },
    numbered: { dd_1: "gbr_dd_w", ss_1: "gbr_ss_s" },
    lines: { dd_2: "gbr_dd_tribal", ss_2: "gbr_ss_t" },
  },
  USA: {
    exact: {
      usa_colorado: ["colorado", "maryland", "west_virginia"],
      usa_lexington: ["lexington", "saratoga"],
      usa_yorktown: ["yorktown", "enterprise"],
      usa_omaha: [
        "omaha",
        "milwaukee",
        "cincinnati",
        "raleigh",
        "richmond",
        "concord",
        "trenton",
        "detroit",
        "memphis",
        "marblehead",
      ],
      usa_brooklyn: [
        "savannah",
        "nashville",
        "brooklyn",
        "boise",
        "phoenix",
        "philadelphia",
        "honolulu",
      ],
      usa_northampton: [
        "northampton",
        "chester",
        "louisville",
        "chicago",
        "houston",
        "augusta",
      ],
    },
    like: {
      usa_colorado: [
        "tennessee",
        "california",
        "new_mexico",
        "mississippi",
        "idaho",
        "pennsylvania",
        "arizona",
        "nevada",
        "oklahoma",
        "new_york",
        "texas",
        "arkansas",
      ],
      usa_yorktown: ["ranger"],
      usa_northampton: [
        "pensacola",
        "salt_lake_city",
        "portland",
        "indianapolis",
        "new_orleans",
        "astoria",
        "minneapolis",
        "tuscaloosa",
        "san_francisco",
        "quincy",
        "vincennes",
        "wichita",
      ],
    },
    numbered: { dd_1: "usa_clemson" },
    lines: {},
  },
  JPN: {
    exact: {
      jpn_nagato: ["nagato", "mutsu"],
      jpn_kongo: ["kongo", "hiei", "haruna", "kirishima"],
      jpn_akagi: ["akagi"],
      jpn_soryu: ["soryu"],
      jpn_nagara: ["nagara", "isuzu", "natori", "yura", "kinu", "abukuma"],
      jpn_takao: ["takao", "atago", "maya", "chokai"],
      jpn_furutaka: ["furutaka", "kako"],
      jpn_tone: ["tone", "chikuma"],
    },
    like: {
      jpn_nagato: ["ise", "hyuga", "fuso", "yamashiro"],
      jpn_akagi: ["kaga"],
      jpn_nagara: [
        "sendai",
        "jintsu",
        "naka",
        "kuma",
        "tama",
        "kiso",
        "kitakami",
        "oi",
        "tenryu",
        "tatsuta",
        "yubari",
      ],
      jpn_takao: ["myoko", "nachi", "haguro", "ashigara"],
      jpn_furutaka: ["aoba", "kinugasa"],
    },
    numbered: { dd_1: "jpn_minekaze", dd_2: "jpn_fubuki" },
    lines: { dd_2: "jpn_fubuki", ss_2: "jpn_kd6" },
  },
  FRA: {
    exact: {
      fra_bretagne: ["bretagne", "provence", "lorraine"],
      fra_richelieu: ["richelieu"],
      fra_dunkerque: ["dunkerque", "strasbourg"],
      fra_algerie: ["algerie"],
      fra_duquesne: ["duquesne", "tourville"],
      fra_emile_bertin: ["emile_bertin"],
      fra_galissonniere: [
        "la_galissonniere",
        "jean_de_vienne",
        "marseillaise",
        "georges_leygues",
        "gloire",
        "montcalm",
      ],
      fra_bearn: ["bearn"],
    },
    like: {
      fra_bretagne: ["courbet", "paris"],
      fra_duquesne: ["foch", "dupleix", "colbert", "suffren"],
      fra_emile_bertin: ["duguay_trouin", "primauguet", "lamotte_picquet"],
    },
    numbered: {
      dd_1: "fra_bourrasque",
      dd_2: "fra_fantasque",
      ss_1: "fra_redoutable",
    },
    lines: {},
  },
  ITA: {
    exact: {
      ita_cavour_rebuilt: ["conte_di_cavour", "giulio_cesare"],
      ita_littorio: ["littorio", "vittorio_veneto"],
      ita_zara: ["zara", "fiume", "gorizia", "pola"],
      ita_trento: ["trento", "trieste"],
      ita_di_giussano: [
        "alberto_di_giussano",
        "alberico_da_barbiano",
        "bartolomeo_colleoni",
        "giovanni_delle_bande_nere",
      ],
      ita_duca_d_aosta: ["duca_d_aosta", "eugenio_di_savoia"],
    },
    like: {
      ita_cavour_rebuilt: ["caio_duilio", "andrea_doria"],
      ita_trento: ["bolzano"],
      ita_di_giussano: ["luigi_cadorna", "armando_diaz"],
      ita_duca_d_aosta: [
        "montecuccoli",
        "attendolo",
        "duca_degli_abruzzi",
        "giuseppe_garibaldi",
      ],
    },
    numbered: { dd_1: "ita_sauro", ss_1: "ita_settembrini" },
    lines: {},
  },
  DEU: {
    exact: {
      deu_scharnhorst: ["scharnhorst", "gneisenau"],
      deu_hipper: ["admiral_hipper"],
      deu_deutschland: ["deutschland", "admiral_scheer", "admiral_graf_spee"],
      deu_koenigsberg: ["koenigsberg", "koeln", "karlsruhe"],
    },
    like: { deu_koenigsberg: ["leipzig", "nuernberg", "emden"] },
    numbered: { dd_1: "deu_z1934", ss_2: "deu_u_ii" },
    lines: {},
  },
  SUN: {
    exact: {
      sun_gangut: ["marat", "oktyabrskaya_revolyutsiya", "parizhskaya_kommuna"],
    },
    like: {},
    numbered: {
      dd_1: "sun_gnevny",
      ss_1: "sun_m_class",
      ss_2: "sun_shch",
    },
    lines: { dd_2: "sun_leningrad", ss_2: "sun_shch" },
  },
};

export interface StartShipPick {
  entry: string;
  exact: boolean;
}

const NAME_PICKS = new Map<string, StartShipPick>();
for (const [tag, m] of Object.entries(START_FLEET_MAP)) {
  const prefix = `${tag.toLowerCase()}_`;
  const add = (o: FleetMap["exact"], exact: boolean) => {
    for (const [entry, names] of Object.entries(o)) {
      for (const n of names) NAME_PICKS.set(prefix + n, { entry, exact });
    }
  };
  add(m.exact, true);
  add(m.like, false);
}

/** The entry of a 1936 ship: its name key, or null for a numbered one. */
export function startShipPick(
  country: HistCountry,
  cls: ShipClass,
  gen: number,
  name: string | null,
): StartShipPick | null {
  if (name !== null) return NAME_PICKS.get(name) ?? null;
  const entry = START_FLEET_MAP[country].numbered[`${cls}_${gen}`];
  return entry === undefined ? null : { entry, exact: false };
}

/** The entry of a 1936 line: its first ship's name key, or null for a numbered line. */
export function startLinePick(
  country: HistCountry,
  cls: ShipClass,
  gen: number,
  name: string | null,
): StartShipPick | null {
  if (name !== null) return NAME_PICKS.get(name) ?? null;
  const entry = START_FLEET_MAP[country].lines[`${cls}_${gen}`];
  return entry === undefined ? null : { entry, exact: false };
}

/** The unnamed 1936 ships of a class: the first numbers of its sequence. */
function numberedAtStart(tag: CountryTag, cls: ShipClass): number {
  const def = START_NAVY.find((d) => d.tag === tag);
  return (
    def?.ships.filter((s) => s.cls === cls && s.name === undefined).length ?? 0
  );
}

/**
 * Whether a ship shows `entry` only as a stand-in: a named ship the table has
 * as "like", or a numbered ship of 1936 (a ship built later is the real thing).
 */
export function shipIsStandIn(
  tag: CountryTag,
  cls: ShipClass,
  nameIdx: number,
  entry: string,
): boolean {
  if (nameIdx < 0) {
    if (!(tag in START_FLEET_MAP) || -nameIdx > numberedAtStart(tag, cls)) {
      return false;
    }
    return Object.values(START_FLEET_MAP[tag as HistCountry].numbered).includes(
      entry,
    );
  }
  const key = shipNameKey(tag, cls, nameIdx);
  const pick = key === null ? undefined : NAME_PICKS.get(key);
  return pick !== undefined && pick.entry === entry && !pick.exact;
}
