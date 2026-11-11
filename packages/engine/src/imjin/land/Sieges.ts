// Imjin sieges (ww175 design §5 "Sieges", ww177 merge 1): a fort region
// (walled town, mountain fortress, or any region with a fort) whose every
// land neighbour the enemy holds is under siege. It eats its grain, then
// its garrison's morale (organisation) falls each day; besiegers with guns
// breach a fort level every 3 × level days, others starve it out. Battles
// for it are fought against the walls (LandRound's storm numbers).
import { ROW_MIX_OF } from "@openfront/engine-lib/imjin/LandRound";
import {
  fortLevelOf,
  type SiegeChoice,
  siegeDay,
  STARVING_MORALE,
  terrainRow,
} from "@openfront/engine-lib/imjin/LandRules";
import { regionTerrain } from "@openfront/engine-lib/imjin/Terrain";
import { effectiveLevel } from "../../ww1936/economy/Buildings";
import type { ImjinSiege, WwImjin } from "../WwImjin";

/** Grain a fort holds, days (design §5: "days shown"). */
export const SIEGE_GRAIN_DAYS = 30;

/** The fort level a region fights with (0: none). */
export function imjinFortLevel(im: WwImjin, region: number): number {
  const s = im.st.sieges.find((x) => x.region === region);
  if (s !== undefined) return s.fort;
  const t = regionTerrain(im.ww.scenario, region);
  const lv = effectiveLevel(im.ww.economy, region, "fort");
  return t === "walled" || t === "fortress" || lv > 0 ? fortLevelOf(t, lv) : 0;
}

/** True when every land neighbour of `region` is held by an enemy of `owner`. */
function surrounded(im: WwImjin, region: number, owner: number): boolean {
  const land = im.ww.land;
  const nb = im.ww.scenario.regionNeighbours(region);
  if (nb.length === 0) return false;
  for (const n of nb) {
    if (!land.isEnemy(owner, land.controller[n])) return false;
  }
  return true;
}

/** The besiegers have guns (a cannon row in their army). */
function besiegersHaveGuns(
  im: WwImjin,
  region: number,
  owner: number,
): boolean {
  const land = im.ww.land;
  for (const n of im.ww.scenario.regionNeighbours(region)) {
    const c = land.controller[n];
    if (!land.isEnemy(owner, c)) continue;
    const tag = im.ww.scenario.tagOfSmallId(c);
    if (tag !== undefined && (ROW_MIX_OF[tag]?.cannon ?? 0) > 0) return true;
  }
  return false;
}

/** One day of every siege: start, eat, breach or starve, end. */
export function siegeDays(im: WwImjin, day: number): void {
  const ww = im.ww;
  const land = ww.land;
  const t = land.divisions;
  const out: ImjinSiege[] = [];
  for (const r of ww.scenario.landRegions) {
    const owner = land.controller[r.id];
    if (owner === 0) continue;
    const fort = imjinFortLevel(im, r.id);
    let s = im.st.sieges.find((x) => x.region === r.id && x.owner === owner);
    if (fort <= 0 && s === undefined) continue;
    if (!surrounded(im, r.id, owner)) continue;
    if (s === undefined) {
      s = {
        region: r.id,
        owner,
        sinceDay: day,
        grainDays: SIEGE_GRAIN_DAYS,
        fort,
        breachDays: 0,
        morale: 1000,
      };
      im.stats.sieges++;
    } else {
      const terrain = terrainRow(regionTerrain(ww.scenario, r.id));
      const choice: SiegeChoice = besiegersHaveGuns(im, r.id, owner)
        ? "breach"
        : "starve";
      const n = siegeDay(
        {
          grainDays: s.grainDays,
          fort: s.fort,
          breachDays: s.breachDays,
          morale: s.morale,
        },
        choice,
        choice === "breach",
        false,
        terrain,
      );
      s = { ...s, ...n };
      // Hunger: the garrison's organisation falls with the morale.
      if (s.grainDays === 0) {
        for (const row of land.rowsIn(r.id)) {
          if (t.owner[row] !== owner) continue;
          const cut = Math.floor((land.orgMaxOf(row) * STARVING_MORALE) / 1000);
          t.org[row] = Math.max(0, t.org[row] - cut);
          land.markArmy(t.army[row]);
        }
      }
    }
    out.push(s);
  }
  out.sort((a, b) => a.region - b.region);
  im.st.sieges = out;
}
