// P6 lane W1 (plan Task 7): coal, energy and power plants (spec §16.2).
//
// Demand is every usable factory: civilian (those on consumer goods too),
// military and dockyards, less the bombed-out ones and the occupation
// share (P1's totals; an exile's virtual factories draw nothing). Supply is
// the coal P1 handed out first (its allocation serves the refineries' 2
// each before the energy, plan decision 22) × 3, the hydro of the
// controlled regions × 2, the power plants × 6, the working dams of the
// controlled regions, the content's extra and (controller ruling, W1 fix
// round 1) a domestic base for every controlled region with infrastructure,
// capped at the demand (EnergyRules.energyBase). The ratio is read as
// yesterday's value on the next P1 turn (mech.energyPm, plan decision 22).
//
// A map without the scenario v5 columns (version < 5: the P1–P5 test maps)
// has no coal, hydro or dams at all; there the system is off and every
// answer is neutral (spec §16.1 reads a v4 file as 0s, and an all-zero
// supply would otherwise halve every country's output).
import {
  COAL_PER_REFINERY,
  DAM_ENERGY,
  DAMS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  coalWanted,
  energyBase,
  energyRatioPm,
  energySupply,
} from "@openfront/engine-lib/ww1936/EnergyRules";
import { DAM_FROM } from "@openfront/engine-lib/ww1936/WorldRules";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

const COAL = RESOURCE_IDS.indexOf("coal");
const URANIUM = RESOURCE_IDS.indexOf("uranium");
/** Spec §16.2: one shortage notice a month at most. */
export const SHORTAGE_NOTE_DAYS = 30;
/** DAM_FROM as day indexes, DAMS order (-Infinity: working from the start). */
const DAM_FROM_DAY: readonly number[] = DAMS.map((dam) => {
  const from = DAM_FROM[dam];
  return from === undefined ? -Infinity : dayOfDate(from);
});

/** Spec §16.1: the energy system runs only on a map with the v5 columns. */
export function energyOn(d: WwDepth): boolean {
  return d.ww.scenario.data.version >= 5;
}

export interface EnergyParts {
  demand: number;
  /** Coal P1 handed out first (the refineries' share included). */
  coalGot: number;
  /** Of it, the coal that goes to the energy (after the refineries' 2 each). */
  coal: number;
  /** Hydro units of the controlled regions (× ENERGY_PER_HYDRO). */
  hydro: number;
  /** Working power plants (× ENERGY_PER_PLANT). */
  plants: number;
  /** Energy of the standing dams the country controls (DAM_ENERGY, from their dates). */
  dams: number;
  /** The content's energy effects. */
  extra: number;
  /** The domestic base: controlled regions with infrastructure, capped at the demand. */
  base: number;
  refineries: number;
  supply: number;
}

/**
 * The parts of a country's energy on `day` (spec §16.2), with the coal of
 * its last P1 allocation (lastPriorityGot). Before P1's first turn (and
 * whenever P1 handed out nothing) the same share from its totals: what the
 * allocation takes first of the coal it has.
 */
export function energyParts(d: WwDepth, id: number, day: number): EnergyParts {
  const econ = d.ww.economy;
  const sc = d.ww.scenario;
  const demand = energyDemand(d, id);
  let hydro = 0;
  let built = 0;
  for (const r of econ.regionsOf(id)) {
    hydro += sc.hydroOf(r);
    // Bombed-out infrastructure counts as the level left (P4's infraEff).
    if ((econ.infraEff[r] ?? 0) >= 1) built++;
  }
  const base = energyBase(demand, built);
  const plants = econ.countryBuildings(id, "power_plant");
  const refineries = econ.countryBuildings(id, "synthetic_refinery");
  const dams = damEnergyOf(d, id, day);
  const extra = d.country(id)?.mech.energyExtra ?? 0;
  const got = d.lastPriorityGot.get(id);
  let coalGot: number;
  if (got !== undefined) {
    coalGot = got[COAL] ?? 0;
  } else {
    coalGot = Math.min(
      coalAvailable(d, id),
      coalWanted(demand, hydro, plants, dams, extra, refineries, base),
    );
  }
  const coal = Math.max(0, coalGot - COAL_PER_REFINERY * refineries);
  return {
    demand,
    coalGot,
    coal,
    hydro,
    plants,
    dams,
    extra,
    base,
    refineries,
    supply: energySupply(coal, hydro, plants, dams, extra, base),
  };
}

/** P1's coal of the day: output less exports plus imports (never below 0). */
export function coalAvailable(d: WwDepth, id: number): number {
  return resourceAvailable(d, id, COAL);
}

function resourceAvailable(d: WwDepth, id: number, k: number): number {
  const t = d.ww.economy.country(id)?.totals;
  if (t === undefined) return 0;
  return Math.max(0, t.produced[k] - t.exported[k] + t.imported[k]);
}

/** Energy of the dams `id` controls that stand (level 1) and work by `day`. */
function damEnergyOf(d: WwDepth, id: number, day: number): number {
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  let n = 0;
  d.world.damLevel.forEach((lv, i) => {
    const r = sc.damRegion[i] ?? 0;
    if (lv <= 0 || r <= 0 || econ.controllerOf(r) !== id) return;
    if (day < DAM_FROM_DAY[i]) return;
    n += DAM_ENERGY[i] ?? 0;
  });
  return n;
}

/** The country's energy ratio for tomorrow (mech.energyPm); a notice a month while short. */
export function dailyEnergy(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  const pm = energyOn(d)
    ? energyRatioPm(energyDemand(d, id), energyParts(d, id, day).supply)
    : 1000;
  if (pm !== c.mech.energyPm) {
    c.mech.energyPm = pm;
    d.markCountry(id);
  }
  if (pm < 1000 && day - c.mech.shortageNoteDay >= SHORTAGE_NOTE_DAYS) {
    c.mech.shortageNoteDay = day;
    d.message(id, "ww1936_energy_shortage", { pct: Math.floor(pm / 10) });
  }
}

/** Coal the energy and the refineries want today (taken before the lines). */
export function coalDemand(d: WwDepth, id: number): number {
  if (!energyOn(d)) return 0;
  const p = energyParts(d, id, Math.max(0, d.lastCommonDay));
  return coalWanted(
    p.demand,
    p.hydro,
    p.plants,
    p.dams,
    p.extra,
    p.refineries,
    p.base,
  );
}

/** The energy effect (spec §18.3): energy added for good. */
export function applyEnergyEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "energy" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth;
  const c = d.country(actor);
  if (c === null) return;
  c.mech.energyExtra += e.amount;
  d.markCountry(actor);
}

/**
 * Review E6: the country's energy demand today (spec §16.2), the energy
 * screen's number: P1's usable civilian (consumer goods' included),
 * military and dockyards (bombed-out ones and the occupation share out),
 * less an exile's virtual factories. 0 with the system off.
 */
export function energyDemand(d: WwDepth, id: number): number {
  const ce = d.ww.economy.country(id);
  if (ce === null || !energyOn(d)) return 0;
  const t = ce.totals;
  const eg = d.ww.endgame;
  const virtual = eg.isExile(id) ? eg.econAdjust(id).virtualMil : 0;
  return Math.max(0, t.civ + t.mil - virtual + t.dock);
}

export interface EnergyView {
  demand: number;
  /** Coal that goes to the energy (units, × ENERGY_PER_COAL). */
  coal: number;
  /** Hydro units (× ENERGY_PER_HYDRO). */
  hydro: number;
  /** Power plants (× ENERGY_PER_PLANT). */
  plants: number;
  /** Dam energy (added as it is). */
  dams: number;
  ratioPm: number;
  /** The content's energy (added as it is). */
  extra: number;
  /** The domestic base (added as it is). */
  base: number;
  /** P1 resources do not pile up: the day's coal and uranium (output less exports plus imports). */
  coalStock: number;
  uraniumStock: number;
}

/** The screen's energy block (WwDepthDetail.energy, spec §16.2, §20.8). */
export function energyView(d: WwDepth, id: number): EnergyView {
  const p = energyOn(d)
    ? energyParts(d, id, Math.max(0, d.lastCommonDay))
    : null;
  return {
    demand: p?.demand ?? 0,
    coal: p?.coal ?? 0,
    hydro: p?.hydro ?? 0,
    plants: p?.plants ?? 0,
    dams: p?.dams ?? 0,
    ratioPm: d.country(id)?.mech.energyPm ?? 1000,
    extra: p?.extra ?? 0,
    base: p?.base ?? 0,
    coalStock: resourceAvailable(d, id, COAL),
    uraniumStock: resourceAvailable(d, id, URANIUM),
  };
}
