// World War 1936 P3: what politics asks of the land war (P3 spec §16.3,
// §17; plan decisions 18, 19). Lane D (Task 5) finishes the stubs; the
// generals' functions are the foundation's.
import {
  GeneralDef,
  GENERALS,
  generalServes,
} from "@openfront/engine-lib/ww1936/Generals";
import { dmzRegions } from "../politics/Spirits";
import type { WwLand } from "./WwLand";

/**
 * Plan decision 18: control moves now (the victory-point tile with it).
 * Foundation body: every tile at once, like P2's capture stub; lane D moves
 * the rest by the spread budget.
 */
export function transferRegionPeaceful(
  land: WwLand,
  region: number,
  to: number,
  tick: number,
): void {
  land.setController(region, to, tick, false);
  const p = land.mg.playerBySmallID(to);
  if (!p.isPlayer()) return;
  for (const t of land.scenario.regionTiles(region)) {
    if (land.mg.ownerID(t) !== to) p.conquer(t);
  }
}

export function evictDivisions(
  land: WwLand,
  region: number,
  owner: number,
): void {}

export function evictArmies(land: WwLand, owner: number, from: number): void {}

export function endBattlesBetween(land: WwLand, a: number, b: number): void {}

export function transferCountryUnits(
  land: WwLand,
  from: number,
  to: number,
  mode: "transfer" | "disband",
): void {}

/** P3 spec §9.2 {dmz}: `smallID`'s armies may not enter its demilitarised regions. */
export function dmzBlocks(
  land: WwLand,
  smallID: number,
  region: number,
): boolean {
  return dmzRegions(land.ww.politics, smallID).includes(region);
}

/** Spec §1.4 (purges): the general leaves its army and serves nowhere until restored. */
export function removeGeneral(land: WwLand, id: string): void {
  land.ww.politics.removedGenerals.add(id);
  const n = GENERALS.findIndex((g) => g.id === id) + 1;
  if (n === 0) return;
  for (const cl of land.countries()) {
    const g = cl.generals.find((x) => x.id === n);
    if (g === undefined || g.army === 0) continue;
    const a = land.armies.get(g.army);
    if (a !== undefined) {
      a.general = 0;
      land.markArmy(a.id);
    }
    g.army = 0;
    land.markCountry(cl.smallID);
  }
}

export function restoreGeneral(land: WwLand, id: string): void {
  land.ww.politics.removedGenerals.delete(id);
}

/** Plan decision 19: P2 dates, not purged, not an advisor right now. */
export function generalAvailable(
  land: WwLand,
  def: GeneralDef,
  day: number,
): boolean {
  const pol = land.ww.politics;
  return (
    generalServes(def, day) &&
    !pol.generalRemoved(def.id) &&
    !pol.advisorHolds(def.id)
  );
}
