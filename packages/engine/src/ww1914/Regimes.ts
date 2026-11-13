// Great War 1914: a country's form of government, and what becomes of it when
// the ladder reaches the top. One list per country: a later country adds a list.
import {
  GW_GAUGE_MAX,
  GwGauge,
  GwNationState,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_RULERS } from "@openfront/engine-lib/ww1914/RulerRows";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { GW_AUTHORITY } from "./AuthorityTable";
import { GW_GOV } from "./GovTable";
import type { GreatWar } from "./GreatWar";
import { onAppointed } from "./People";
import { regimeHope } from "./Strain";
import { defOf, news, reason, seatsOf, turn } from "./World";

export interface GwRegimeRow {
  readonly id: string;
  /** What the country becomes at the top of the ladder; null: nothing more. */
  readonly next: string | null;
  /** Where the ladder stands the day it begins. */
  readonly unrest: number;
  /** Gauges it begins with, where they were lower. */
  readonly floor: Readonly<Partial<Record<GwGauge, number>>>;
  /** Its first act is to ask for peace. */
  readonly seeksPeace: boolean;
  /** People it brings in, if the cast has them. */
  readonly appoint: readonly (readonly [string, GwOffice])[];
  /** A flag every seat of the country gets, for scenes to read. */
  readonly flag?: string;
  /** Old ministers it lets go; the office goes to the next in line. */
  readonly retires?: readonly string[];
  /**
   * ww207 (S2): a utopia's form that keeps the person at the desk, whatever
   * his ruler row's `regimes` say (Wilhelm in a parliamentary monarchy).
   */
  readonly keeps?: boolean;
  /**
   * ww207 (S2): a utopia's form that has no place for the person, whatever
   * his row says; only the tree's new head sits in it (decision 1B).
   */
  readonly removes?: boolean;
}

const form = (
  id: string,
  next: string | null,
  over: Partial<GwRegimeRow> = {},
): GwRegimeRow => ({
  id,
  next,
  unrest: 1,
  floor: { order: 2, morale: 2 },
  seeksPeace: false,
  appoint: [],
  ...over,
});

/** The first row is June 1914. */
export const GW_REGIMES: Readonly<
  Partial<Record<GwTag, readonly GwRegimeRow[]>>
> = {
  DEU: [
    form("empire", "republic"),
    form("republic", null, { seeksPeace: true, unrest: 2 }),
    // ww207: the utopias' forms. A parliamentary monarchy keeps Wilhelm; a
    // council republic has no place for him.
    form("deu_parl", "republic", { unrest: 0, floor: {}, keeps: true }),
    form("deu_soviet", null, { unrest: 0, floor: {}, removes: true }),
  ],
  GBR: [
    form("liberal", "coalition"),
    form("coalition", "war_cabinet", { flag: "f_coalition" }),
    form("war_cabinet", "national"),
    form("national", null),
    // ww207: a Labour government (Henderson's, the head of Labour's utopia).
    form("gbr_labour", null, { unrest: 0, floor: {}, removes: true }),
  ],
  AUH: [
    form("dual_monarchy", "federation"),
    form("karl", "federation", {
      unrest: 0,
      floor: {},
      appoint: [["auh_czernin", "foreign"]],
      flag: "w_auh_karl",
      retires: ["auh_krobatin"],
    }),
    form("ff_throne", "federation", {
      unrest: 0,
      floor: {},
      flag: "w_auh_ff_throne",
    }),
    form("federation", null, { unrest: 2 }),
    form("austria_republic", null, { unrest: 1 }),
    form("crown_remnant", null, { unrest: 1 }),
    // ww207: the utopias' forms. Both keep whoever reigns.
    form("auh_federal_crown", null, { unrest: 0, floor: {}, keeps: true }),
    form("auh_trial", null, { unrest: 0, floor: {}, keeps: true }),
  ],
  RUS: [
    form("tsar", "provisional"),
    form("crown", "provisional", { floor: { order: 2 } }),
    form("regency", "provisional", { unrest: 2 }),
    form("rep", null, { unrest: 2 }),
    form("provisional", null, {
      unrest: 2,
      appoint: [
        ["rus_lvov", "chancellor"],
        ["rus_milyukov", "foreign"],
        ["rus_kerensky", "war"],
      ],
      retires: ["rus_fredericks"],
    }),
    // ww207: the Bolsheviks' utopia; no place for the Tsar.
    form("rus_soviet", null, { unrest: 0, floor: {}, removes: true }),
  ],
  // France (ww166): the President stays whatever the form. `fra_union` is the
  // sacred union a scene declares, `fra_tiger` Clemenceau's government (the
  // consultations call it), `fra_defeat` a France that asks for peace.
  FRA: [
    form("fra_republic", "fra_defeat"),
    form("fra_union", "fra_defeat", {
      unrest: 0,
      floor: {},
      flag: "f_union_sacree",
    }),
    form("fra_tiger", "fra_defeat", {
      unrest: 0,
      floor: {},
      flag: "f_pm_clemenceau",
      appoint: [["fra_clemenceau", "chancellor"]],
    }),
    form("fra_defeat", null, { seeksPeace: true, unrest: 2 }),
    // ww207: Action française's utopia, the crown restored; the President goes.
    form("fra_crown", null, { unrest: 0, floor: {}, removes: true }),
  ],
};

export function regimeRow(n: GwNationState): GwRegimeRow | null {
  return GW_REGIMES[n.tag]?.find((r) => r.id === n.regime) ?? null;
}

export function firstRegime(tag: GwTag): string {
  return GW_REGIMES[tag]?.[0].id ?? "";
}

/** The bodies a form of government starts with. */
export function institutionsOf(regime: string): GwNationState["inst"] {
  return { ...(GW_AUTHORITY[regime] ?? GW_AUTHORITY[""]).inst };
}

/** A paper of the old order: a threat that ended, a ruler's life that did. */
function oldOrder(tag: GwTag, to: string, scene: string): boolean {
  // A head (ww208 1B) is no seat of the old order's person.
  const seated = (GW_RULERS[tag] ?? []).some(
    (r) =>
      r.head !== true && (r.regimes === undefined || r.regimes.includes(to)),
  );
  if (!seated && scene.includes("_life_")) return true;
  return GW_GOV.some(
    (r) =>
      r.tag === tag &&
      !r.regimes.includes(to) &&
      scene.startsWith(`gov_${r.id}_`),
  );
}

/** The country takes the form `to`. What it keeps of old bodies it keeps. */
export function changeRegime(gw: GreatWar, tag: GwTag, to: string): void {
  const n = gw.nation(tag);
  const row = GW_REGIMES[tag]?.find((r) => r.id === to);
  if (n === null || row === undefined || n.regime === to) return;
  n.regime = to;
  const old = n.inst;
  n.inst = institutionsOf(to);
  for (const k of Object.keys(n.inst) as (keyof typeof n.inst)[]) {
    const was = old[k];
    if (was !== undefined) n.inst[k] = Math.max(n.inst[k] ?? 0, was);
  }
  n.unrest = row.unrest;
  n.lowOrder = 0;
  for (const [g, v] of Object.entries(row.floor)) {
    const gauge = g as GwGauge;
    n.gauges[gauge] = Math.min(
      GW_GAUGE_MAX[gauge],
      Math.max(n.gauges[gauge], v ?? 0),
    );
  }
  for (const [id, office] of row.appoint) {
    const p = gw.person(id);
    const gone = ["dead", "exiled", "fallen", "crowned"];
    if (p === null || gone.includes(p.status)) continue;
    for (const q of gw.s.people) {
      if (q.office === office && defOf(q.id)?.tag === tag) q.office = null;
    }
    p.status = "active";
    p.office = office;
    onAppointed(gw, id);
  }
  for (const id of row.retires ?? []) {
    const p = gw.person(id);
    if (p !== null) p.office = null;
  }
  news(gw, `regime_${to}`, tag);
  turn(gw, `regime_${to}@${tag}`);
  regimeHope(gw, tag);
  for (const seat of seatsOf(gw, tag)) {
    reason(gw, seat, `regime_${to}`);
    seat.desk = seat.desk.filter((c) => !oldOrder(tag, to, c.scene));
    seat.scheduled = seat.scheduled.filter((q) => !oldOrder(tag, to, q.scene));
    if (row.flag !== undefined && !seat.flags.includes(row.flag)) {
      seat.flags.push(row.flag);
    }
  }
}

/** Successions that come by age, not by a ladder (design §3). */
export const GW_SUCCESSIONS: readonly {
  readonly tag: GwTag;
  /** Who comes next: the first of them still alive; the last needs no one. */
  readonly heirs: readonly {
    readonly person: string;
    readonly regime: string;
  }[];
  /** The first day it can come, and the span of days after it. */
  readonly from: string;
  readonly span: number;
  /** The scene the seat reads it in. */
  readonly scene: string;
}[] = [
  {
    tag: "AUH",
    heirs: [
      { person: "auh_ff", regime: "ff_throne" },
      { person: "auh_karl", regime: "karl" },
    ],
    // Design says 1915-18; the plan keeps the new reign long enough to play.
    from: "1915-07-01",
    span: 720,
    scene: "gw_succession_auh",
  },
];

const P_SUCCESSION = idHash("gw_succession");

const dayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return daysFromCivil(y, m, d);
};

/** The day this game's old emperor dies: the seed's, inside the row's range. */
export function successionDay(
  gw: GreatWar,
  row: (typeof GW_SUCCESSIONS)[number],
): number {
  return (
    dayOf(row.from) +
    (wwRoll(gw.s.seed, P_SUCCESSION, idHash(row.tag)) % row.span)
  );
}

/**
 * The old emperor is gone: the first heir still alive takes the throne and
 * the seat reads it next chapter. False when nobody is left to take it.
 */
export function succeed(
  gw: GreatWar,
  row: (typeof GW_SUCCESSIONS)[number],
): boolean {
  const heir = row.heirs.find((h) => {
    const p = gw.person(h.person);
    return p === null || p.status === "active";
  });
  if (heir === undefined) return false;
  const p = gw.person(heir.person);
  if (p !== null) {
    p.status = "crowned";
    p.office = null;
  }
  changeRegime(gw, row.tag, heir.regime);
  for (const seat of seatsOf(gw, row.tag)) {
    seat.scheduled.push({ scene: row.scene, chapter: gw.s.chapter + 1 });
  }
  return true;
}

/** The succession row of a country whose first regime it ends, if any. */
export function successionOf(
  gw: GreatWar,
  tag: GwTag,
): (typeof GW_SUCCESSIONS)[number] | null {
  const row = GW_SUCCESSIONS.find((r) => r.tag === tag);
  const n = gw.nation(tag);
  if (row === undefined || n === null || n.out) return null;
  return n.regime === GW_REGIMES[tag]?.[0].id ? row : null;
}

/**
 * Chapter step: age does what it does, war or no war. A seat's old emperor
 * dies only by his health on the ruler card (ww169, owner's 2B: Ruler.ts calls
 * `succeed`); the seed's day is for a country nobody plays.
 */
export function successionStep(gw: GreatWar): void {
  for (const row of GW_SUCCESSIONS) {
    if (seatsOf(gw, row.tag).length > 0) continue;
    if (successionOf(gw, row.tag) === null) continue;
    if (gw.s.day < successionDay(gw, row)) continue;
    succeed(gw, row);
  }
}
