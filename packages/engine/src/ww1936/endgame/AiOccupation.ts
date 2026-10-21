// World War 1936 P5 lane O (plan Task 3): the occupation AI (spec §17.2;
// owner direction: varied laws — the historical table is a default the
// resistance can overturn). Every AI country's day after its occupation
// step: the law per legal owner every 30 days, garrison armies of its
// weakest divisions, garrison divisions in training, integration.
import {
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { OccupationLaw } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_INTEGRATE_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  type BattalionId,
  MOVE_ADVANCE,
  MOVE_RETREAT,
  MOVE_SEA,
  type SupportId,
  type TemplateDef,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  coveragePct,
  integrateCostPp,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { templateXpCost } from "@openfront/engine-lib/ww1936/TemplateStats";
import { aiPersonality } from "../economy/AiEconomy";
import { aiBorderDemand } from "../land/AiLand";
import { enemyDivisionsIn } from "../land/Movement";
import { leaveAttack, setGarrison, stopOrFinishEdge } from "../land/Orders";
import type { Army, WwLand } from "../land/WwLand";
import { needOf, rowSuppression } from "./Garrison";
import {
  integrateBlockOf,
  integrateRegion,
  setOccupationLaw,
} from "./Occupation";
import type { WwEndgame } from "./WwEndgame";

/** Spec §17.2: the laws are looked at every 30 days (day % 30 = smallID % 30). */
export const AI_OCC_LAW_DAYS = 30;
/** Average resistance from which, with the garrison under 70%, the AI goes civil, bp. */
export const AI_CIVIL_RES_BP = 5000;
export const AI_CIVIL_COVER_PCT = 70;
/** Average resistance under which an aggressor at war goes martial, bp. */
export const AI_MARTIAL_RES_BP = 2500;
/** Spec §17.2: garrison suppression wanted, % of the need (60 when the fronts need the troops). */
export const AI_GARRISON_PCT = 90;
export const AI_GARRISON_WAR_PCT = 60;
/** …when the front demand is over this share of all divisions, %. */
export const AI_FRONT_HEAVY_PCT = 80;
/** Over this share of the need the last garrison army goes back, %. */
export const AI_GARRISON_RELEASE_PCT = 110;
/** Spec §17.2: garrison divisions in training when the need passes half the suppression. */
export const AI_GARRISON_TRAIN_NEED_PCT = 50;
export const AI_GARRISON_TRAIN_SHARE_PCT = 20;
/** Spec §17.2: integration when the political power covers the cost and this much more. */
export const AI_INTEGRATE_SPARE_PP = 50;
/** Spec §17.2: the garrison division, six infantry battalions (+ military police). */
export const GARRISON_BATTALIONS = 6;
/** P2's training conditions (AiLand): men for two divisions, half a division's equipment. */
const TRAIN_MEN_FACTOR = 2;
const TRAIN_FILL_PM = 500;

export interface AiLawIn {
  /** Average resistance of the legal owner's administered regions, bp. */
  avgResBp: number;
  /** Their garrison coverage together, %. */
  coveragePct: number;
  aggressor: boolean;
  atWar: boolean;
  /** The historical table's law for this pair (historical AI), else null. */
  historical: OccupationLaw | null;
}

/**
 * Spec §17.2: heavy resistance with a short garrison → civil
 * administration (over the historical default too: varied outcomes);
 * else the historical default; else an aggressor at war with quiet land
 * → martial rule; else military government.
 */
export function aiOccupationLaw(i: AiLawIn): OccupationLaw {
  if (i.avgResBp >= AI_CIVIL_RES_BP && i.coveragePct < AI_CIVIL_COVER_PCT) {
    return "occ_civil";
  }
  if (i.historical !== null) return i.historical;
  if (i.avgResBp < AI_MARTIAL_RES_BP && i.aggressor && i.atWar) {
    return "occ_martial";
  }
  return "occ_military";
}

export function aiOccupationDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  void tick;
  if (
    eg.administeredOf(id).length === 0 &&
    garrisonArmies(eg, id).length === 0
  ) {
    return;
  }
  if (day % AI_OCC_LAW_DAYS === id % AI_OCC_LAW_DAYS) aiLaws(eg, id, day);
  aiGarrisons(eg, id);
  aiIntegrate(eg, id, day);
}

// ---- Laws ----

/** The first live row of OCCUPATION_DEFAULTS for (id, legal owner) (pre-flight O: table order). */
function historicalLaw(
  eg: WwEndgame,
  id: number,
  of: number,
  day: number,
): OccupationLaw | null {
  if (eg.mg.config().historicalAi() !== true) return null;
  const sc = eg.ww.scenario;
  for (const row of eg.ww.politics.content.occupationDefaults) {
    if (sc.smallIdOf(row.by) !== id || sc.smallIdOf(row.of) !== of) continue;
    if (row.until !== undefined && day >= dayOfDate(row.until)) continue;
    return row.law;
  }
  return null;
}

function aiLaws(eg: WwEndgame, id: number, day: number): void {
  const legal = eg.ww.politics.legalOwner;
  const byOwner = new Map<
    number,
    { res: number; n: number; need: number; sup: number }
  >();
  for (const r of eg.administeredOf(id)) {
    const of = legal[r] ?? 0;
    let g = byOwner.get(of);
    if (g === undefined)
      byOwner.set(of, (g = { res: 0, n: 0, need: 0, sup: 0 }));
    g.res += eg.resBp[r];
    g.n++;
    g.need += needOf(eg, id, r);
    g.sup += eg.supDeci[r];
  }
  const aggressor = aiPersonality(eg.ww.tagOf(id)) === "aggressor";
  const atWar = eg.ww.enemiesOf(id).length > 0;
  for (const of of [...byOwner.keys()].sort((a, b) => a - b)) {
    const g = byOwner.get(of)!;
    const want = aiOccupationLaw({
      avgResBp: Math.floor(g.res / g.n),
      coveragePct: coveragePct(g.sup, g.need),
      aggressor,
      atWar,
      historical: historicalLaw(eg, id, of, day),
    });
    if (want !== eg.occupationLawOf(id, of)) {
      setOccupationLaw(eg, id, of, want, day);
    }
  }
}

// ---- Garrisons ----

function garrisonArmies(eg: WwEndgame, id: number): Army[] {
  return eg.ww.land
    .armiesOf(id)
    .filter((a) => a.order.kind === "garrison")
    .sort((a, b) => a.id - b.id);
}

function armySuppression(land: WwLand, a: Army): number {
  let s = 0;
  for (const d of a.divisions) {
    const r = land.divisions.rowOf(d);
    if (r >= 0) s += rowSuppression(land, r);
  }
  return s;
}

/**
 * Spec §17.2 (P2 §14.3): the front demand of `id`'s own border regions
 * against its enemies at war is over AI_FRONT_HEAVY_PCT of its divisions
 * (P2's demand per border region, tenths of a division; an enemy region's
 * divisions shared among our regions touching it).
 */
function frontHeavy(eg: WwEndgame, id: number): boolean {
  const land = eg.ww.land;
  const sc = eg.ww.scenario;
  const enemies = new Set(eg.ww.enemiesOf(id));
  if (enemies.size === 0) return false;
  const border: number[] = [];
  const touching = new Map<number, number>();
  for (const reg of sc.landRegions) {
    if (land.controller[reg.id] !== id) continue;
    let any = false;
    for (const e of sc.edgesOf(reg.id)) {
      if (!enemies.has(land.controller[e.to])) continue;
      any = true;
      touching.set(e.to, (touching.get(e.to) ?? 0) + 1);
    }
    if (any) border.push(reg.id);
  }
  const facing = new Map<number, number>();
  let demand = 0;
  for (const b of border) {
    let milli = 0;
    let dirs = 0;
    for (const e of sc.edgesOf(b)) {
      const x = e.to;
      if (!enemies.has(land.controller[x])) continue;
      dirs++;
      let k = facing.get(x);
      if (k === undefined) facing.set(x, (k = enemyDivisionsIn(land, id, x)));
      milli += Math.floor((k * 1000) / touching.get(x)!);
    }
    demand += aiBorderDemand({
      facingMilli: milli,
      offensive: false,
      land: sc.landOf(b),
      dirs,
      fort: land.econ.fort[b] ?? 0,
    });
  }
  return demand * 100 > AI_FRONT_HEAVY_PCT * land.rowsOf(id).length * 10;
}

/** A division the AI may take into a garrison: free of fights, voyages, invasions, drops and volunteering. */
function garrisonable(land: WwLand, row: number): boolean {
  const t = land.divisions;
  if (t.id[row] === 0 || t.battle[row] !== 0) return false;
  const m = t.mode[row];
  if (m === MOVE_RETREAT || m === MOVE_ADVANCE || m === MOVE_SEA) return false;
  const a = land.armies.get(t.army[row]);
  if (a === undefined || a.volunteerFor > 0) return false;
  const k = a.order.kind;
  return k !== "garrison" && k !== "invade" && k !== "paradrop";
}

function isGarrisonDef(def: TemplateDef): boolean {
  return (
    def.battalions.length === GARRISON_BATTALIONS &&
    def.battalions.every((b) => b === "infantry") &&
    def.support.every((s) => s === "military_police")
  );
}

/**
 * Spec §17.2: garrison suppression up to AI_GARRISON_PCT of the need
 * (AI_GARRISON_WAR_PCT when the fronts want the troops): the lowest
 * quality divisions first — garrison divisions, then strength,
 * experience, cavalry first, id — into garrison armies (at most 24 each,
 * scope 0). Over AI_GARRISON_RELEASE_PCT, the last garrison army goes
 * back to P2 when the rest still covers the need. Then training.
 */
function aiGarrisons(eg: WwEndgame, id: number): void {
  const land = eg.ww.land;
  let need = 0;
  for (const r of eg.administeredOf(id)) need += needOf(eg, id, r);
  const armies = garrisonArmies(eg, id);
  const sups = armies.map((a) => armySuppression(land, a));
  const have = sups.reduce((x, y) => x + y, 0);
  const pct =
    need > 0 && frontHeavy(eg, id) ? AI_GARRISON_WAR_PCT : AI_GARRISON_PCT;
  const want = Math.ceil((need * pct) / 100);
  if (have < want) {
    formGarrisons(eg, id, armies, have, want);
  } else if (
    armies.length > 0 &&
    have * 100 > need * AI_GARRISON_RELEASE_PCT &&
    have - sups[sups.length - 1] >= want
  ) {
    const last = armies[armies.length - 1];
    land.issue(id, { kind: "army_halt", army: last.id }, "ai");
  }
  if (need > 0) aiGarrisonTraining(eg, id, need);
}

function formGarrisons(
  eg: WwEndgame,
  id: number,
  armies: Army[],
  have: number,
  want: number,
): number {
  const land = eg.ww.land;
  const t = land.divisions;
  const cl = land.country(id);
  if (cl === null) return have;
  const garrisonTpl = new Set(
    cl.templates.filter((x) => isGarrisonDef(x.def)).map((x) => x.id),
  );
  const cand: { row: number; s: number; key: number[] }[] = [];
  for (const row of land.rowsOf(id)) {
    if (!garrisonable(land, row)) continue;
    const s = rowSuppression(land, row);
    if (s <= 0) continue;
    const def = land.templateOf(id, t.template[row])?.def;
    const cavalry = def?.battalions.includes("cavalry") === true;
    cand.push({
      row,
      s,
      key: [
        garrisonTpl.has(t.template[row]) ? 0 : 1,
        land.strengthOf(row),
        t.exp[row],
        cavalry ? 0 : 1,
        t.id[row],
      ],
    });
  }
  cand.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) {
      if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
    }
    return 0;
  });
  let army: Army | null =
    armies.filter(
      (a) => a.order.enemy === 0 && a.divisions.length < WW_MAX_ARMY_DIVISIONS,
    )[0] ?? null;
  for (const c of cand) {
    if (have >= want) break;
    if (army === null || army.divisions.length >= WW_MAX_ARMY_DIVISIONS) {
      army = land.newArmy(id);
      if (army === null) break;
      setGarrison(land, army, 0);
    }
    leaveAttack(land, c.row);
    stopOrFinishEdge(land, c.row);
    land.moveToArmy(t.id[c.row], army);
    have += c.s;
  }
  return have;
}

/** The garrison template (made when missing: six infantry, military police with the tech); else the first template. */
function garrisonTemplate(eg: WwEndgame, id: number): number {
  const land = eg.ww.land;
  const cl = land.country(id);
  const ce = land.econ.country(id);
  if (cl === null || ce === null) return 0;
  const mp = ce.researched.has("military_police");
  const battalions: BattalionId[] = new Array<BattalionId>(
    GARRISON_BATTALIONS,
  ).fill("infantry");
  const support: SupportId[] = mp ? ["military_police"] : [];
  const def: TemplateDef = { name: "", battalions, support };
  let tpl = cl.templates.find((x) => isGarrisonDef(x.def));
  if (tpl !== undefined && mp && !tpl.def.support.includes("military_police")) {
    // The tech came: the garrison division gets its company (army XP allowing).
    land.issue(
      id,
      {
        kind: "template_save",
        template: tpl.id,
        base: 0,
        name: "",
        battalions,
        support,
      },
      "ai",
    );
  }
  if (tpl === undefined) {
    const first = cl.templates[0];
    const base =
      first !== undefined &&
      templateXpCost(first.def, def) < templateXpCost(null, def)
        ? first.id
        : 0;
    land.issue(
      id,
      {
        kind: "template_save",
        template: 0,
        base,
        name: "",
        battalions,
        support,
      },
      "ai",
    );
    tpl = cl.templates.find((x) => isGarrisonDef(x.def));
  }
  return tpl?.id ?? cl.templates[0]?.id ?? 0;
}

/**
 * Spec §17.2: while the need passes AI_GARRISON_TRAIN_NEED_PCT of all its
 * divisions' suppression, the AI keeps AI_GARRISON_TRAIN_SHARE_PCT of its
 * divisions (field and training) garrison divisions: one in the queue at
 * a time, with P2's men and equipment conditions, into a garrison army
 * with room.
 */
function aiGarrisonTraining(eg: WwEndgame, id: number, need: number): void {
  const land = eg.ww.land;
  const t = land.divisions;
  const cl = land.country(id);
  const ce = land.econ.country(id);
  if (cl === null || ce === null) return;
  let all = 0;
  for (const r of land.rowsOf(id)) all += rowSuppression(land, r);
  if (need * 100 <= all * AI_GARRISON_TRAIN_NEED_PCT) return;
  const tplId = garrisonTemplate(eg, id);
  if (tplId === 0) return;
  if (cl.training.some((e) => e.template === tplId && e.remaining > 0)) return;
  let total = 0;
  let mine = 0;
  for (const r of land.rowsOf(id)) {
    total++;
    if (t.template[r] === tplId) mine++;
  }
  for (const e of cl.training) {
    total += e.remaining;
    if (e.template === tplId) mine += e.remaining;
  }
  for (const x of cl.trainees) {
    total++;
    if (x.template === tplId) mine++;
  }
  if (mine * 100 >= AI_GARRISON_TRAIN_SHARE_PCT * (total + 1)) return;
  const s = land.templateStatsOf(id, tplId);
  if (s === null || ce.manpower < s.men * TRAIN_MEN_FACTOR) return;
  for (let i = 0; i < s.need.length; i++) {
    if (s.need[i] <= 0) continue;
    const type = EQUIPMENT_TYPES[i];
    let stock = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      stock += ce.stock[equipKey(type, g)];
    }
    if (Math.floor((stock * 1000) / s.need[i]) < TRAIN_FILL_PM) return;
  }
  const army = garrisonArmies(eg, id).find(
    (a) => a.divisions.length < WW_MAX_ARMY_DIVISIONS,
  );
  land.issue(
    id,
    {
      kind: "train",
      template: tplId,
      count: 1,
      army: army?.id ?? 0,
      region: 0,
    },
    "ai",
  );
}

// ---- Integration ----

/** Spec §17.2: integrable regions, most victory points first, while the power covers cost + 50. */
function aiIntegrate(eg: WwEndgame, id: number, day: number): void {
  const legal = eg.ww.politics.legalOwner;
  const sc = eg.ww.scenario;
  const regs = eg
    .administeredOf(id)
    .filter((r) => legal[r] === id && eg.compHigh[r] >= WW_INTEGRATE_DAYS)
    .sort((a, b) => (sc.region(b)?.vp ?? 0) - (sc.region(a)?.vp ?? 0) || a - b);
  for (const r of regs) {
    const pp = eg.ww.politics.country(id)?.ppMilli ?? 0;
    const cost = integrateCostPp(sc.region(r)?.vp ?? 0);
    if (pp < (cost + AI_INTEGRATE_SPARE_PP) * 1000) continue;
    if (integrateBlockOf(eg, id, r) !== null) continue;
    integrateRegion(eg, id, r, day);
  }
}
