// ww177 P6 (lane I6a): what Joseon's scenes and preparations do once picked
// (engine-lib/imjin/JoseonContent.ts, JOS_RESULTS). JoseonMing.readPicks
// takes each row's flag and calls this; Ming's meter and suspicion stay
// with JoseonMing. It says whether the row came about (ships join the fleet
// at the first base Joseon holds).
import type { JosResult } from "@openfront/engine-lib/imjin/JoseonContent";
import type { ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import { applyEffects, makeCtx } from "../ww1936/politics/Dispatch";
import type { WorldWar } from "../ww1936/WorldWar";
import { addFleet } from "./sea/SeaState";

export function applyJosResult(
  ww: WorldWar,
  jos: number,
  r: JosResult,
  tick: number,
): boolean {
  if (r.effects !== undefined && r.effects.length > 0) {
    applyEffects(makeCtx(ww.politics, jos, jos, 0, tick), r.effects);
  }
  // Ships with no base left to take them are lost, and nothing is told.
  if (r.ships !== undefined) {
    return addShips(ww, jos, r.ships.bases, r.ships.kinds);
  }
  return true;
}

/** A new squadron at the first listed base Joseon controls (none: lost). */
function addShips(
  ww: WorldWar,
  owner: number,
  bases: readonly string[],
  kinds: readonly (readonly [ShipKind, number])[],
): boolean {
  const im = ww.imjinWar;
  if (im === null) return false;
  const map = im.mg.map();
  for (const base of bases) {
    const region = ww.scenario.landRegions.find((x) => x.name === base);
    if (region === undefined) continue;
    if (ww.land.controller[region.id] !== owner) continue;
    const t = im.portTile(region.id);
    if (t < 0) continue;
    const ships: ShipKind[] = [];
    for (const [k, n] of kinds) for (let i = 0; i < n; i++) ships.push(k);
    addFleet(
      im.st.sea,
      owner,
      map.x(t) * MT + (MT >> 1),
      map.y(t) * MT + (MT >> 1),
      ships,
      { formation: "line" },
    );
    return true;
  }
  return false;
}
