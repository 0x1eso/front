// Great War 1914 (ww200 §2, §4): what the land of 1914 is worth, and each
// country's character. A place's `ind` (works, mines, yards) and `grain`
// (fields) are 0..3, by its group, with a few places of their own (Lille and
// the iron of Lorraine, Škoda at Pilsen, the Ukrainian ports). Whoever holds a
// place counts it (engine/ww1914/Economy.ts), at a discount if it isn't its
// own. The character turns worth into points a year (100 = a gauge step a
// year) and holds what the land doesn't: grain by sea, the towns' mouths.
// Numbers only: a tune lane changes these, nothing else.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACES,
  type GwPlace,
  type GwPlaceGroup,
} from "@openfront/engine-api/ww1914/GwPlaces";

export interface GwPlaceWorth {
  readonly ind: number;
  readonly grain: number;
}

const w = (ind: number, grain: number): GwPlaceWorth => ({ ind, grain });

/** Each place of a group is worth this; a group with no row is `w(0, 1)`. */
export const GW_ECON_GROUPS: Readonly<
  Partial<Record<GwPlaceGroup, GwPlaceWorth>>
> = {
  // Germany: the Ruhr and Rhine, Saxony, Upper Silesia; the grain of the east.
  rhineland: w(3, 1),
  germany: w(2, 1),
  silesia: w(3, 1),
  alsace_lorraine: w(2, 1),
  west_prussia: w(0, 2),
  east_prussia: w(0, 3),
  posen: w(0, 3),
  schleswig: w(0, 1),
  colonies: w(0, 0),
  // Britain: the works at home; the Empire's food comes by sea (imports).
  britain: w(3, 1),
  ireland: w(0, 2),
  canada: w(0, 0),
  australia: w(0, 0),
  india: w(0, 0),
  south_africa: w(0, 0),
  new_zealand: w(0, 0),
  egypt: w(0, 1),
  sudan: w(0, 0),
  malaya: w(0, 0),
  burma: w(0, 0),
  british_west_africa: w(0, 0),
  british_east_africa: w(0, 0),
  // France: Paris, Lyon, Le Creusot; the north's fields (its works below).
  france: w(1, 2),
  western_front: w(0, 2),
  algeria: w(0, 1),
  tunisia: w(0, 0),
  west_africa: w(0, 0),
  madagascar: w(0, 0),
  indochina: w(0, 0),
  // Russia: the two capitals and the Urals; the black earth.
  russia: w(2, 1),
  urals: w(2, 0),
  ukraine: w(0, 3),
  russian_poland: w(0, 2),
  west_russia: w(0, 2),
  bessarabia: w(0, 2),
  volga: w(0, 2),
  baltic: w(0, 1),
  siberia: w(0, 1),
  turkestan: w(0, 1),
  north_russia: w(0, 0),
  far_east: w(0, 0),
  // Austria-Hungary: Bohemia's works; Hungary's grain.
  bohemia: w(1, 1),
  moravia: w(1, 1),
  austria: w(1, 1),
  hungary: w(1, 3),
  banat: w(0, 3),
  transylvania: w(0, 1),
  upper_hungary: w(0, 1),
  croatia: w(0, 2),
  galicia: w(0, 2),
  bukovina: w(0, 2),
  trieste: w(0, 0),
  bosnia: w(0, 1),
  trentino: w(0, 1),
  dalmatia: w(0, 0),
  // Italy: the Po valley.
  italy: w(1, 2),
  piave: w(0, 2),
  libya: w(0, 0),
  italian_east_africa: w(0, 0),
  // The Ottoman Empire: Anatolia's fields.
  straits: w(0, 1),
  anatolia: w(0, 2),
  hejaz: w(0, 0),
  // The small and the neutral.
  belgium: w(2, 1),
  flanders: w(1, 1),
  congo: w(0, 0),
  romania: w(0, 3),
  bulgaria: w(0, 2),
  serbia: w(0, 2),
  america: w(2, 3),
  alaska: w(0, 0),
  hawaii: w(0, 0),
  philippines: w(0, 0),
  japan: w(1, 1),
  netherlands: w(2, 1),
  east_indies: w(0, 0),
};

/** Places worth more or less than their group. */
export const GW_ECON_PLACES: Readonly<Partial<Record<GwPlace, GwPlaceWorth>>> =
  {
    // The French north: textiles and coal at Lille, the Nord and Pas-de-Calais
    // basin, the iron of Lorraine by Nancy and Briey (ww200 §4 F: "most of its
    // iron, much of its coal").
    lille: w(3, 1),
    arras: w(2, 1),
    cambrai: w(1, 2),
    maubeuge: w(1, 1),
    sedan: w(1, 1),
    saint_quentin: w(1, 2),
    nancy: w(2, 1),
    calais: w(1, 1),
    paris: w(3, 1),
    lyon: w(2, 1),
    le_creusot: w(3, 0),
    brest: w(0, 1),
    // Germany.
    heligoland: w(0, 0),
    berlin: w(3, 0),
    hamburg: w(2, 0),
    kattowitz: w(3, 0),
    // Britain.
    scapa_flow: w(0, 0),
    // Russia.
    petrograd: w(3, 0),
    kiev: w(1, 3),
    odessa: w(1, 3),
    sevastopol: w(1, 1),
    warsaw: w(2, 1),
    lodz: w(2, 1),
    riga: w(2, 1),
    // Austria-Hungary: Škoda at Pilsen, Vienna, Budapest, the oil of Galicia.
    pilsen: w(3, 0),
    prague: w(2, 1),
    vienna: w(2, 0),
    budapest: w(1, 3),
    krakow: w(1, 1),
    gorlice: w(1, 1),
    trieste: w(1, 0),
    pola: w(1, 0),
    pressburg: w(1, 1),
    // Italy, the Ottoman Empire, the Balkans.
    venice: w(1, 1),
    verona: w(1, 1),
    constantinople: w(2, 0),
    ploesti: w(2, 2),
    bucharest: w(1, 3),
    sofia: w(1, 2),
    belgrade: w(1, 2),
    kragujevac: w(1, 2),
    liege: w(3, 0),
    antwerp: w(2, 0),
    tokyo: w(2, 1),
  };

const PLAIN = w(0, 1);

/** What a place is worth. */
export function placeWorth(p: GwPlace): GwPlaceWorth {
  return (
    GW_ECON_PLACES[p] ?? GW_ECON_GROUPS[GW_PLACES[p].group as never] ?? PLAIN
  );
}

/** The groups whose grain is Hungary's: it holds it back (`hungary` < 2). */
export const GW_HUNGARIAN_GRAIN: readonly GwPlaceGroup[] = [
  "hungary",
  "banat",
  "transylvania",
  "upper_hungary",
  "croatia",
] as GwPlaceGroup[];

/** A country's character: points a year (100 = a gauge step a year). */
export interface GwEconRow {
  /** Shells a year its own 1914 land makes, all of it held. */
  readonly shells: number;
  /** Percent more industry once mobilised after the first shell crisis. */
  readonly mob: number;
  /** Bread a year its own 1914 fields give, the year round, all held. */
  readonly farms: number;
  /** Bread a year the towns and the army eat, at war. */
  readonly eaters: number;
  /** Bread a year that comes by sea, at war, before a blockade or U-boats. */
  readonly imports: number;
  /** Bread a year lost with no men left on the farms (manpower 0). */
  readonly labour: number;
  /** Bread a year the railways lose, from this month of war (RUS, OTT). */
  readonly rail?: { readonly loss: number; readonly from: number };
  /** Money (gauge points a year) of trade at war, before a blockade. */
  readonly trade: number;
  /** Percent of the plain shells a front burns for each band (its guns). */
  readonly guns: number;
}

const PLAIN_ROW: GwEconRow = {
  shells: 200,
  mob: 50,
  farms: 300,
  eaters: 320,
  imports: 40,
  labour: 100,
  trade: 0,
  guns: 50,
};

export const GW_ECON_ROWS: Readonly<Partial<Record<GwTag, GwEconRow>>> = {
  DEU: {
    shells: 750,
    mob: 40,
    farms: 510,
    eaters: 620,
    imports: 260,
    labour: 160,
    trade: 30,
    guns: 100,
  },
  GBR: {
    shells: 480,
    mob: 100,
    farms: 175,
    eaters: 760,
    imports: 700,
    labour: 60,
    trade: 20,
    guns: 80,
  },
  FRA: {
    shells: 700,
    mob: 70,
    farms: 760,
    eaters: 570,
    imports: 120,
    labour: 160,
    trade: 10,
    guns: 100,
  },
  RUS: {
    shells: 400,
    mob: 100,
    farms: 740,
    eaters: 560,
    imports: 0,
    labour: 140,
    rail: { loss: 90, from: 12 },
    trade: 0,
    guns: 70,
  },
  AUH: {
    shells: 420,
    mob: 50,
    farms: 760,
    eaters: 540,
    imports: 40,
    labour: 140,
    trade: 0,
    guns: 80,
  },
  ITA: {
    ...PLAIN_ROW,
    shells: 260,
    farms: 240,
    imports: 150,
    eaters: 380,
    guns: 70,
  },
  OTT: {
    ...PLAIN_ROW,
    shells: 150,
    farms: 380,
    eaters: 360,
    imports: 0,
    rail: { loss: 100, from: 18 },
  },
  BGR: { ...PLAIN_ROW, shells: 90, farms: 150, eaters: 160, imports: 0 },
  SRB: { ...PLAIN_ROW, shells: 140, farms: 260, eaters: 280, imports: 0 },
};

export const econRow = (tag: GwTag): GwEconRow =>
  GW_ECON_ROWS[tag] ?? PLAIN_ROW;

/** Per unit of worth, for a country with no 1914 land of that kind. */
const PLAIN_IND = 40;
const PLAIN_GRAIN = 15;

let own1914: Map<string, { ind: number; grain: number }> | null = null;

/** Each country's own 1914 land, by worth. */
function ownWorth(tag: GwTag): { ind: number; grain: number } {
  if (own1914 === null) {
    own1914 = new Map();
    for (const p of Object.keys(GW_PLACES) as GwPlace[]) {
      const o = GW_PLACES[p].owner;
      const v = own1914.get(o) ?? { ind: 0, grain: 0 };
      const x = placeWorth(p);
      own1914.set(o, { ind: v.ind + x.ind, grain: v.grain + x.grain });
    }
  }
  return own1914.get(tag) ?? { ind: 0, grain: 0 };
}

/**
 * Points a year one unit of worth gives this country: its character over its
 * own 1914 land, so all of its land gives its row's rates.
 */
export function econPerUnit(tag: GwTag): { ind: number; grain: number } {
  const row = econRow(tag);
  const own = ownWorth(tag);
  return {
    ind: own.ind > 0 ? Math.trunc(row.shells / own.ind) : PLAIN_IND,
    grain: own.grain > 0 ? Math.trunc(row.farms / own.grain) : PLAIN_GRAIN,
  };
}

/** The rest of the step's numbers, the same for everyone. */
export const GW_ECON = {
  /** Points a year a gauge below its peace level refills: a step in 6 months. */
  peaceRefill: 200,
  /** Shells a year a front burns, for each band of the country's army on it. */
  frontPerBand: 55,
  /** Percent of that fired at shells 0..3: rationed when short, free when full. */
  fireAt: [70, 90, 110, 130],
  /** Percent of the eaters' bread eaten at bread 0..3: rationing to plenty. */
  eatAt: [70, 95, 110, 135],
  /** Money a year a full treasury (gauge 3) spends on war orders, at war. */
  fullSpend: 150,
  /** Percent of the works' shells a year that come back as taxes (money). */
  worksMoney: 40,
  /** More where its end's strain is at least `strainHigh`. */
  frontStrained: 80,
  strainHigh: 60,
  /** Shells a year lost at a blockade of `blockadeShells` or more. */
  blockadeShells: 7,
  blockadeShellsLoss: 120,
  /** Percent of a place an annexed one counts; less a quarter a resist step. */
  annexPct: 75,
  /** Percent an occupied place counts by how hard it is ruled, 0..3. */
  occupyPct: [35, 50, 67, 75],
  /** Percent a place on a live front line counts. */
  frontPct: 50,
  /** Percent own works lose for each rung of unrest. */
  unrestPct: 10,
  /** Percent of Hungary's grain it holds back while `hungary` is below 2. */
  hungaryHeld: 30,
  /** Months after the first shell crisis before industry mobilises, 4..8. */
  mobMonths: 6,
  /** Money points a year for each worth (`ind` + `grain`) of land gained. */
  landMoney: 4,
  /** And for each worth of its own 1914 land lost. */
  landLost: 2,
  /** Percent of the fields' yield Aug-Oct, Nov-Jan, Feb-Jul (a year's 100). */
  seasonPct: [150, 110, 70],
  /** Bad harvest: percent of the roll; good from `goodFrom`. */
  badPct: 22,
  badYield: 60,
  goodFrom: 80,
  /** A new state's tribute is this percent of its worth, a vassal's this. */
  clientTribute: 33,
  vassalTribute: 50,
} as const;
