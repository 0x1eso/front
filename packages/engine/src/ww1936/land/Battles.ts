// World War 1936 P2: battles, retreats, overruns, org recovery and
// entrenchment (P2 spec §9). STUB: Task 4 writes the bodies; the
// signatures are final.
import type { ModInput } from "@openfront/engine-lib/ww1936/CombatRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { WwLand } from "./WwLand";

/** Every running battle, one round, by region (spec §9.3). */
export function stepBattles(land: WwLand, tick: number): void {}

/** Division `div` (id) attacks region `region` (or defends it when it is its own): starts or joins the battle. */
export function joinBattle(land: WwLand, div: number, region: number): void {}

/** Org recovery (spec §9.8), every tick. */
export function stepRecovery(land: WwLand): void {}

/** Entrenchment (spec §9.8), the country's day. */
export function dailyEntrench(land: WwLand, smallID: number): void {}

/** Takes away HP damage as men and equipment (spec §5.5). */
export function applyHpLoss(land: WwLand, row: number, hpMilli: number): void {}

/** Spec §9.5: starts a retreat from the division's region, or destroys it when no friendly neighbour is left. */
export function retreatDivision(land: WwLand, row: number): void {}

const NEUTRAL_TECH = techTotals(new Set());

/**
 * What divisionMods needs for division `row` fighting over `region`
 * (attacking it, or defending it): its general, template flags, tech,
 * experience, readiness, the region's terrain and weather, the edge's
 * river and strait, the fort, its entrenchment, supply and encirclement
 * (pre-flight U11). The battles (battleMods) and the plans' predictions
 * (Plans.predictAttack) both call it. STUB: neutral values.
 */
export function modInputOf(
  land: WwLand,
  row: number,
  region: number,
  attacking: boolean,
): ModInput {
  return {
    attacking,
    genAtt: 0,
    genDef: 0,
    traits: 0,
    flags: 0,
    tech: NEUTRAL_TECH,
    exp: 0,
    planBp: 0,
    land: land.scenario.landOf(region),
    weather: "clear",
    river: 0,
    strait: false,
    fort: 0,
    entrench: 0,
    excessBp: 0,
    supplyPm: 1000,
    encircled: false,
  };
}
