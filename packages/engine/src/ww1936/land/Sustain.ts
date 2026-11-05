// World War 1936 P2: reinforcement, upgrades, attrition and experience (P2
// spec §5.1, §5.3, §5.4, §6.2): a country's day of training, its
// divisions by id, its army experience and its generals. disbandDivision
// is the foundation's (one path for the equipment back to the stock).
import {
  DS_HIST,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  MOVE_NONE,
  NEED_GROUP_COUNT,
  TPL_HOSPITAL,
  WW_EXP_PER_DAY,
  WW_UPGRADE_PM,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { HOSPITAL_ATTRITION_PCT } from "@openfront/engine-lib/ww1936/CombatRules";
import { breakdownPpm } from "@openfront/engine-lib/ww1936/hist/Wear";
import {
  isTankGroup,
  oldInfoOf,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  drawEquip,
  drawManpower,
  drawOrderOf,
  drawTemplateEquip,
  returnDivisionEquip,
  returnEquip,
} from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { designLossMilli } from "./Battles";
import { dailyGenerals } from "./GeneralsRun";
import { atSea } from "./SeaLift";
import {
  applySlots,
  dailyTraining,
  reinforceCap,
  TYPE_SLOTS,
} from "./Training";
import type { WwLand } from "./WwLand";

/** Spec §5.3: daily attrition below this supply rate, ‰. */
export const ATTRITION_SUPPLY_PM = 500;
/** Spec §5.3, §11.5: 1% a day (ppm) without supply or encircled. */
export const ATTRITION_CUT_PPM = 10_000;
/**
 * Whether a division fought since its country's last day (spec §5.4
 * "전투에 참가한 날"): lastFight is the tick of its last round. The
 * country's day comes on tick k = smallID % 7 of each day, before that
 * tick's battles, so the window is from yesterday's tick k (its rounds
 * came after yesterday's step) up to today's tick k, not included. Every
 * round counts once, whatever tick of the day it fell on (Task 11: a
 * k ≥ 1 country used to miss the rounds of yesterday's tail).
 */
export function foughtTest(
  smallID: number,
  day: number,
  prepEndTick: number,
): (lastFight: number) => boolean {
  const k = smallID % WW_DAY_SPLIT;
  const to = dayStartTick(day, prepEndTick) + k;
  const from = day <= 0 ? 0 : dayStartTick(day - 1, prepEndTick) + k;
  return (lastFight) => lastFight >= from && lastFight < to;
}

/** Spec §5.1, §5.3, §5.4, §6.2 dates and experience: the country's day. */
export function dailySustain(land: WwLand, smallID: number, day: number): void {
  const cl = land.country(smallID);
  const ce = land.econ.country(smallID);
  if (cl === null || ce === null) return;
  // Spec §5.1: training, then one message for the day's new divisions.
  const ready = dailyTraining(land, cl, ce);
  cl.readyToday = ready;
  if (ready > 0) {
    land.message(smallID, "events_display.ww1936_division_ready", {
      count: ready,
    });
  }
  // Spec §5.3, §5.4: the divisions in id order (the oldest fill first).
  const fought = foughtTest(smallID, day, land.ww.prepEndTick());
  const t = land.divisions;
  // (No division is added or removed below: the country's row list holds.)
  // P6 hook (D, spec §4.6): the armies' reinforcement priority first; the
  // rest of the day (attrition, experience) touches no stock, so it may run
  // in row order after.
  const order = land.depthHooks.reinforceOrder(smallID);
  // The generation swap's plan, once for the country's day (null: nothing
  // old is held where better stock waits; no division row is touched).
  const plan = swapPlanOf(land, ce, smallID);
  if (order !== null) {
    for (const id of order) {
      const r = t.rowOf(id);
      if (r < 0 || t.owner[r] !== smallID || t.encircled[r] !== 0) continue;
      reinforce(land, ce, r);
      upgrade(land, ce, r);
      if (plan !== null) swapOld(land, ce, r, plan);
    }
  }
  // P6 (spec §21.2, §4.5): division experience gain and the army's medal.
  const xpPct =
    (ce.stats as Partial<Record<WwStatKey, number>>).divXpGainPct ?? 0;
  for (const r of land.rowsOf(smallID)) {
    if (order === null && t.encircled[r] === 0) {
      reinforce(land, ce, r);
      upgrade(land, ce, r);
      if (plan !== null) swapOld(land, ce, r, plan);
    }
    attrition(land, r, day);
    if (fought(t.lastFight[r])) {
      const pct = xpPct + land.depthHooks.medalXpPct(t.army[r]);
      const add =
        pct === 0
          ? WW_EXP_PER_DAY
          : Math.max(0, Math.floor((WW_EXP_PER_DAY * (100 + pct)) / 100));
      t.exp[r] = Math.min(1000, t.exp[r] + add);
    }
  }
  // Spec §6.2: the generals' dates and experience.
  dailyGenerals(land, cl, ce, day, fought);
}

/**
 * Spec §5.3 reinforcement: the missing men and equipment, at most 10% of
 * the need × supply ‰ a day, equipment newest generation first. New men
 * dilute experience (`exp × old / new`; a field hospital halves the cut).
 */
export function reinforce(land: WwLand, ce: CountryEconomy, r: number): void {
  const t = land.divisions;
  // P4 (lane I/C): a division on a convoy gets no men or equipment until it
  // lands (HOI4: no reinforcement at sea).
  if (atSea(land, r)) return;
  const supply = t.supply[r];
  if (supply <= 0) return;
  // Men, need and flags read only the template def and the stats.
  const s = land.templateNumbersOf(r);
  const cap = dayCap(ce, supply);
  const men = t.men[r];
  const add = Math.min(s.men - men, cap(s.men), ce.manpower);
  if (add > 0 && drawManpower(ce, add)) {
    const exp = t.exp[r];
    const cut = exp - Math.floor((exp * men) / (men + add));
    // ww107: the hospital's half, as far as its gear goes.
    const kept = Math.floor(
      ((cut - Math.floor(cut / 2)) * land.companyPm(r, TPL_HOSPITAL)) / 1000,
    );
    t.exp[r] = exp - cut + kept;
    land.setMen(r, men + add);
  }
  const slots = REINFORCE_SLOTS;
  slots.set(t.equipOf(r));
  // P6 (plan decision 7): need groups, the country's slot numbers.
  drawTemplateEquip(ce, slots, s.need, land.keyStatsOf(t.owner[r]), cap);
  applySlots(land, r, slots);
}

/** The day's reinforcement cap of a division at `supply` (reinforcePct included). */
function dayCap(ce: CountryEconomy, supply: number): (need: number) => number {
  // P6 (spec §21.2): reinforcePct speeds the day's share.
  const rPct =
    (ce.stats as Partial<Record<WwStatKey, number>>).reinforcePct ?? 0;
  return reinforceCap(
    rPct === 0 ? supply : Math.floor((supply * Math.max(0, 100 + rPct)) / 100),
  );
}

/** A tank need group where old equipment may be swapped: its old slots (lowest score first) and the non-old slots. */
interface SwapGroup {
  group: number;
  old: number[];
  fresh: number[];
}

/**
 * The generation swap's plan for a country's day: the tank need groups
 * with an old key (more than TANK_OLD_PCT below the group's best) and
 * non-old stock to swap it for. Null when there is none — the common day —
 * and then nothing else is done (no division row is read).
 */
export function swapPlanOf(
  land: WwLand,
  ce: CountryEconomy,
  smallID: number,
): SwapGroup[] | null {
  const ks = land.keyStatsOf(smallID);
  const info = oldInfoOf(ks, ce.researched);
  let out: SwapGroup[] | null = null;
  const order = drawOrderOf(ks);
  for (let g = 0; g < NEED_GROUP_COUNT; g++) {
    if (!isTankGroup(g)) continue;
    const list = order[g];
    let hasOld = false;
    for (let k = 0; k < list.length && !hasOld; k++) {
      hasOld = info.old[list[k]] === 1;
    }
    if (!hasOld) continue;
    const fresh = list.filter(
      (j) => info.old[j] === 0 && ce.stock[GROUND_EQUIP_KEYS[j]] > 0,
    );
    if (fresh.length === 0) continue;
    // (The draw order, lowest score first for the old ones.)
    const old = list.filter((j) => info.old[j] === 1).reverse();
    (out ??= []).push({ group: g, old, fresh });
  }
  return out;
}

/**
 * The automatic generation swap (reinforcement's pace, per need group): a
 * division holding old equipment takes non-old equipment from the stock,
 * the best first, and the old goes back to the stock. Skipped at sea and
 * without supply, as reinforcement is; a battle does not stop it. Non-old
 * equipment is never swapped for slightly better.
 */
export function swapOld(
  land: WwLand,
  ce: CountryEconomy,
  r: number,
  plan: readonly SwapGroup[],
): void {
  if (atSea(land, r)) return;
  const t = land.divisions;
  const supply = t.supply[r];
  if (supply <= 0) return;
  const s = land.templateNumbersOf(r);
  const cap = dayCap(ce, supply);
  const base = r * GROUND_SLOTS;
  for (const p of plan) {
    const need = s.need[p.group];
    if (need <= 0) continue;
    let budget = cap(need);
    for (const jo of p.old) {
      if (budget <= 0) break;
      for (const jf of p.fresh) {
        const want = Math.min(budget, t.equip[base + jo]);
        if (want <= 0) break;
        const got = drawEquip(ce, GROUND_EQUIP_KEYS[jf], want);
        if (got <= 0) continue;
        land.addEquip(r, jf, got);
        returnEquip(ce, GROUND_EQUIP_KEYS[jo], got);
        land.addEquip(r, jo, -got);
        budget -= got;
      }
    }
  }
}

/** reinforce's copy of a division's slots (filled before each use). */
const REINFORCE_SLOTS = new Int32Array(GROUND_SLOTS);

/**
 * Spec §5.3 upgrade: per type, up to 5% of the need a day of a newer
 * generation from the stock replaces as many of the oldest the division
 * holds, which go back to their own generation's key.
 */
export function upgrade(land: WwLand, ce: CountryEconomy, r: number): void {
  // Nor new equipment at sea (as reinforce).
  if (atSea(land, r)) return;
  const t = land.divisions;
  // The need reads only the template def and the stats.
  const s = land.templateNumbersOf(r);
  const base = r * GROUND_SLOTS;
  TYPE_SLOTS.forEach((list, i) => {
    // The tanks change generation by score, in swapOld (not by year here).
    if (isTankGroup(i)) return;
    if (s.need[i] <= 0 || list.length < 2) return;
    let budget = Math.ceil((s.need[i] * WW_UPGRADE_PM) / 1000);
    for (let hi = list.length - 1; hi >= 1 && budget > 0; hi--) {
      for (let lo = 0; lo < hi && budget > 0; lo++) {
        const n = Math.min(
          budget,
          t.equip[base + list[lo].slot],
          ce.stock[list[hi].key],
        );
        if (n <= 0) continue;
        const got = drawEquip(ce, list[hi].key, n);
        land.addEquip(r, list[hi].slot, got);
        returnEquip(ce, list[lo].key, got);
        land.addEquip(r, list[lo].slot, -got);
        budget -= got;
      }
    }
  });
}

/**
 * Spec §5.3, §10, §11.5 attrition, ppm of men and of every equipment slot:
 * below 50% supply `(500 − supply) / 500 × 1%`, encircled 1% (ww84: no
 * weather; ww98: less with a field hospital). The remainders build up in lossMen / lossEq (milli) as HP
 * losses do; nothing goes back, the men lost are dead.
 */
export function attritionPpm(land: WwLand, r: number, day: number): number {
  const t = land.divisions;
  let ppm = 0;
  if (t.encircled[r] !== 0) ppm = ATTRITION_CUT_PPM;
  else if (t.supply[r] < ATTRITION_SUPPLY_PM) {
    ppm = Math.floor(
      ((ATTRITION_SUPPLY_PM - Math.max(0, t.supply[r])) * ATTRITION_CUT_PPM) /
        ATTRITION_SUPPLY_PM,
    );
  }
  // ww98: a field hospital keeps a quarter of it.
  const hospitalPm = ppm > 0 ? land.companyPm(r, TPL_HOSPITAL) : 0;
  return (
    ppm -
    Math.floor(
      ((ppm - Math.floor((ppm * HOSPITAL_ATTRITION_PCT) / 100)) * hospitalPm) /
        1000,
    )
  );
}

/**
 * ww61, reliability: catalogue equipment (DS_HIST rows) wears out while its
 * division moves. ppm of the slot a day, from the entry's reliability: 0.5 %
 * at 70 %, 0.175 % at 83 %, nothing from 90 %. Static keys and designer
 * designs carry no DS_HIST flag and do not wear. The loss is taken from the
 * holder and refilled by reinforcement from the stock (or refit).
 */
function attrition(land: WwLand, r: number, day: number): void {
  const ppm = attritionPpm(land, r, day);
  const t = land.divisions;
  const moving = t.mode[r] !== MOVE_NONE && !atSea(land, r);
  if (ppm <= 0 && !moving) return;
  const men = t.men[r];
  if (ppm > 0 && men > 0) {
    t.lossMen[r] += Math.floor((men * ppm) / 1000);
    const lost = Math.min(men, Math.floor(t.lossMen[r] / 1000));
    t.lossMen[r] -= lost * 1000;
    if (lost > 0) {
      land.setMen(r, men - lost);
      land.noteCasualties(t.owner[r], lost, lost);
    }
  }
  const base = r * GROUND_SLOTS;
  // P6: a design slot loses by its reliability.
  const ks = land.keyStatsOf(t.owner[r]);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const have = t.equip[base + j];
    if (have <= 0) continue;
    const o = j * KS_FIELDS;
    const wear =
      moving && (ks.stats[o + KS.flags] & DS_HIST) !== 0
        ? breakdownPpm(ks.stats[o + KS.relPm])
        : 0;
    if (ppm <= 0 && wear === 0) continue;
    t.lossEq[base + j] +=
      designLossMilli(ks, j, Math.floor((have * ppm) / 1000)) +
      Math.floor((have * wear) / 1000);
    const lost = Math.min(have, Math.floor(t.lossEq[base + j] / 1000));
    t.lossEq[base + j] -= lost * 1000;
    if (lost > 0) land.addEquip(r, j, -lost);
  }
}

/** Disband (spec §5.3): men and equipment back, then the division goes. Orders call it. */
export function disbandDivision(land: WwLand, row: number): void {
  const ce = land.econ.country(land.divisions.owner[row]);
  if (ce !== null) {
    returnDivisionEquip(
      ce,
      land.divisions.equipOf(row),
      land.divisions.men[row],
    );
  }
  land.killDivision(row, false);
}
