// World War 1936 P2: reinforcement, upgrades, attrition and experience (P2
// spec §5.1, §5.3, §5.4, §6.2): a country's day of training, its
// divisions by id, its army experience and its generals. disbandDivision
// is the foundation's (one path for the equipment back to the stock).
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  MOVE_NONE,
  TPL_HOSPITAL,
  traitBit,
  WW_ARMY_XP_MAX_MILLI,
  WW_EXP_PER_DAY,
  WW_UPGRADE_PM,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { WEATHER } from "@openfront/engine-lib/ww1936/Weather";
import {
  drawEquip,
  drawManpower,
  drawTemplateEquip,
  returnDivisionEquip,
  returnEquip,
} from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { designLossMilli } from "./Battles";
import { dailyGenerals, generalOf } from "./GeneralsRun";
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
 * Task 11 balance (controller ruling 1; HOI4: weather attrition hits units
 * that move, fight or lack supply, a trickle otherwise): a division resting
 * in full supply takes this share of the day's weather attrition, %.
 */
export const WEATHER_ATTRITION_IDLE_PCT = 25;
/** Spec §5.4: army experience a day, milli (a major twice), and per division that fought (at most 5 a day). */
export const ARMY_XP_DAY_MILLI = 100;
export const ARMY_XP_FIGHT_MILLI = 50;
export const ARMY_XP_FIGHT_MAX_MILLI = 5_000;

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
  let foughtN = 0;
  // (No division is added or removed below: the country's row list holds.)
  // P6 hook (D, spec §4.6): the armies' reinforcement priority first; the
  // rest of the day (attrition, experience) touches no stock, so it may run
  // in row order after.
  const order = land.depthHooks.reinforceOrder(smallID);
  if (order !== null) {
    for (const id of order) {
      const r = t.rowOf(id);
      if (r < 0 || t.owner[r] !== smallID || t.encircled[r] !== 0) continue;
      reinforce(land, ce, r);
      upgrade(land, ce, r);
    }
  }
  // P6 (spec §21.2, §4.5): division experience gain and the army's medal.
  const xpPct =
    (ce.stats as Partial<Record<WwStatKey, number>>).divXpGainPct ?? 0;
  for (const r of land.rowsOf(smallID)) {
    if (order === null && t.encircled[r] === 0) {
      reinforce(land, ce, r);
      upgrade(land, ce, r);
    }
    attrition(land, r, day);
    if (fought(t.lastFight[r])) {
      const pct = xpPct + land.depthHooks.medalXpPct(t.army[r]);
      const add =
        pct === 0
          ? WW_EXP_PER_DAY
          : Math.max(0, Math.floor((WW_EXP_PER_DAY * (100 + pct)) / 100));
      t.exp[r] = Math.min(1000, t.exp[r] + add);
      foughtN++;
    }
  }
  // Spec §5.4: army experience.
  const gain =
    (ce.major ? 2 : 1) * ARMY_XP_DAY_MILLI +
    Math.min(ARMY_XP_FIGHT_MAX_MILLI, ARMY_XP_FIGHT_MILLI * foughtN) +
    ce.stats.armyXpMilli;
  cl.armyXpMilli = Math.max(
    0,
    Math.min(WW_ARMY_XP_MAX_MILLI, cl.armyXpMilli + gain),
  );
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
  // P6 (spec §21.2): reinforcePct speeds the day's share.
  const rPct =
    (ce.stats as Partial<Record<WwStatKey, number>>).reinforcePct ?? 0;
  const cap = reinforceCap(
    rPct === 0 ? supply : Math.floor((supply * Math.max(0, 100 + rPct)) / 100),
  );
  const men = t.men[r];
  const add = Math.min(s.men - men, cap(s.men), ce.manpower);
  if (add > 0 && drawManpower(ce, add)) {
    const exp = t.exp[r];
    const cut = exp - Math.floor((exp * men) / (men + add));
    t.exp[r] =
      exp - ((s.flags & TPL_HOSPITAL) !== 0 ? Math.floor(cut / 2) : cut);
    land.setMen(r, men + add);
  }
  const slots = REINFORCE_SLOTS;
  slots.set(t.equipOf(r));
  // P6 (plan decision 7): need groups, the country's slot numbers.
  drawTemplateEquip(ce, slots, s.need, land.keyStatsOf(t.owner[r]), cap);
  applySlots(land, r, slots);
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
 * below 50% supply `(500 − supply) / 500 × 1%`, encircled 1%, plus the
 * day's weather in its region (a winter specialist halves snow and frost,
 * a desert fox ignores heat; a division at rest in full supply takes a
 * quarter of it, Task 11). The remainders build up in lossMen / lossEq
 * (milli) as HP losses do; nothing goes back, the men lost are dead.
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
  const reg = t.region[r];
  const w = land.weatherOn(reg, day);
  let wpm = WEATHER[w].attritionPm * 1000;
  if (wpm > 0) {
    const army = land.armies.get(t.army[r]);
    const traits =
      army === undefined ? 0 : (generalOf(land, army)?.traits ?? 0);
    if (
      (w === "snow" || w === "frozen") &&
      (traits & traitBit("winter_specialist")) !== 0
    ) {
      wpm = Math.floor(wpm / 2);
    }
    if (w === "heat" && (traits & traitBit("desert_fox")) !== 0) wpm = 0;
    // Task 11 (ruling 1): full only on the move, in a battle or short of
    // supply; a quarter at rest in full supply.
    const exposed =
      t.mode[r] !== MOVE_NONE || t.battle[r] !== 0 || t.supply[r] < 1000;
    if (!exposed) wpm = Math.floor((wpm * WEATHER_ATTRITION_IDLE_PCT) / 100);
  }
  return ppm + wpm;
}

function attrition(land: WwLand, r: number, day: number): void {
  const ppm = attritionPpm(land, r, day);
  if (ppm <= 0) return;
  const t = land.divisions;
  const men = t.men[r];
  if (men > 0) {
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
    t.lossEq[base + j] += designLossMilli(
      ks,
      j,
      Math.floor((have * ppm) / 1000),
    );
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
