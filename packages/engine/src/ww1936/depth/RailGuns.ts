// P6 lane W1 (plan Task 7): railway guns (spec §16.5).
//
// An army takes up to 2 guns from the stock (railgun_assign) and gives
// them back (railgun_return). In a battle its divisions attack, each gun
// fires 6 hits a round (centi 600, beside close air support) when one of
// those divisions attacks from a region with railway level 2 or more, and
// cuts the fort level its divisions meet by 1 (at most 2). Guns rest on a
// poorer railway. When the army goes (W1 review 3, P2's removeArmy hook),
// its guns are lost if its last division fell in battle or stood in a
// region another side holds; otherwise (merged, disbanded at home) they go
// back to the stock. The mirror `world.railGuns` [army, owner, guns, last
// region] follows the armies daily.
// Sensitivity: no railway gun fires on a no-strike region.
//
// The battle reads are per round (P2's hook): an empty mirror answers at
// once, and only the armies holding guns are looked at.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { WW_MAX_RAILGUNS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { ROLE_ATTACK } from "@openfront/engine-api/ww1936/LandTypes";
import {
  railGunFortCut as fortCutOf,
  railGunHitsCenti,
} from "@openfront/engine-lib/ww1936/WorldRules";
import { effectiveLevel } from "../economy/Buildings";
import type { Army } from "../land/WwLand";
import type { WwDepth } from "./WwDepth";

const GUN_KEY = equipKey("railway_gun", 1);

/**
 * Centi-hits of railway guns for `side` in the battle at `region` this
 * round: each attacking army of the side with guns, when one of its
 * divisions there attacks from a region with railway 2 or more.
 */
export function railGunHits(d: WwDepth, region: number, side: number): number {
  if (d.world.railGuns.length === 0) return 0;
  const land = d.ww.land;
  const b = land.battles.get(region);
  if (b === undefined || b.attackers.length === 0) return 0;
  if (d.noStrike(region)) return 0;
  const t = land.divisions;
  let hits = 0;
  let counted: number[] | null = null;
  for (const id of b.attackers) {
    const row = t.rowOf(id);
    if (row < 0 || land.divisionSide(row) !== side) continue;
    const a = land.armies.get(t.army[row]);
    if (a === undefined || a.railGuns <= 0) continue;
    if (counted !== null && counted.includes(a.id)) continue;
    const rail = effectiveLevel(d.ww.economy, t.region[row], "rail");
    const h = railGunHitsCenti(a.railGuns, rail);
    if (h <= 0) continue;
    hits += h;
    (counted ??= []).push(a.id);
  }
  return hits;
}

/** The fort levels the army's railway guns cut at `region` (attacker). */
export function railGunFortCut(
  d: WwDepth,
  armyId: number,
  region: number,
): number {
  if (d.world.railGuns.length === 0) return 0;
  const land = d.ww.land;
  const a = land.armies.get(armyId);
  if (a === undefined || a.railGuns <= 0) return 0;
  if (d.noStrike(region)) return 0;
  return fortCutOf(a.railGuns, bestAttackRail(d, a, region));
}

/** The best railway level an attacking division of `a` attacks `region` from; -1 none. */
function bestAttackRail(d: WwDepth, a: Army, region: number): number {
  const t = d.ww.land.divisions;
  let best = -1;
  for (const id of a.divisions) {
    const row = t.rowOf(id);
    if (row < 0 || t.battle[row] !== region || t.role[row] !== ROLE_ATTACK) {
      continue;
    }
    best = Math.max(best, effectiveLevel(d.ww.economy, t.region[row], "rail"));
  }
  return best;
}

/** railgun_assign {army, count} and railgun_return {army}. */
export function issueRailGun(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "railgun_assign" | "railgun_return" }>,
): WwOrderBlock | null {
  const land = d.ww.land;
  const econ = d.ww.economy;
  const a = land.armies.get(o.army);
  const ce = econ.country(id);
  if (a === undefined || a.owner !== id || ce === null) return "no_army";
  if (o.kind === "railgun_assign") {
    if (
      !Number.isInteger(o.count) ||
      o.count < 1 ||
      a.railGuns + o.count > WW_MAX_RAILGUNS ||
      (ce.stock[GUN_KEY] ?? 0) < o.count
    ) {
      return "railgun_limit";
    }
    ce.stock[GUN_KEY] -= o.count;
    a.railGuns += o.count;
  } else {
    if (a.railGuns <= 0) return "railgun_limit";
    ce.stock[GUN_KEY] = (ce.stock[GUN_KEY] ?? 0) + a.railGuns;
    a.railGuns = 0;
  }
  econ.markCountryDirty(id);
  land.markArmy(a.id);
  setMirror(d, a);
  d.markCountry(id);
  return null;
}

/** The army's row of the mirror again (removed when it holds no gun). */
function setMirror(d: WwDepth, a: Army): void {
  const m = d.world.railGuns;
  const at = m.findIndex((x) => x[0] === a.id);
  if (a.railGuns <= 0) {
    if (at >= 0) m.splice(at, 1);
    return;
  }
  const region = d.ww.land.armyRegion(a);
  const row: [number, number, number, number] = [
    a.id,
    a.owner,
    a.railGuns,
    region > 0 ? region : at >= 0 ? m[at][3] : 0,
  ];
  if (at >= 0) m[at] = row;
  else {
    m.push(row);
    m.sort((x, y) => x[0] - y[0]);
  }
}

/**
 * W1 review 3 (spec §16.5): the army is gone. Its guns are lost when its
 * last division was destroyed in battle or stood in a region another side
 * holds; else they go back to the owner's stock.
 */
export function railGunsOfRemovedArmy(
  d: WwDepth,
  owner: number,
  armyId: number,
  guns: number,
  destroyed: boolean,
  region: number,
): void {
  const m = d.world.railGuns;
  const at = m.findIndex((x) => x[0] === armyId);
  if (at >= 0) m.splice(at, 1);
  const land = d.ww.land;
  const lost =
    destroyed ||
    (region > 0 && !land.sameSide(owner, land.controller[region] ?? 0));
  if (!lost && guns > 0) {
    const ce = d.ww.economy.country(owner);
    if (ce !== null) {
      ce.stock[GUN_KEY] = (ce.stock[GUN_KEY] ?? 0) + guns;
      d.ww.economy.markCountryDirty(owner);
    }
  }
  d.markCountry(owner);
}

/**
 * The common day (spec §16.5): the mirror follows the armies' guns,
 * owners and regions (a gone army's row went with it, removeArmy's hook).
 */
export function dayCommonRailGuns(d: WwDepth): void {
  const m = d.world.railGuns;
  if (m.length === 0) return;
  const land = d.ww.land;
  const next: [number, number, number, number][] = [];
  for (const [armyId, , , last] of m) {
    const a = land.armies.get(armyId);
    if (a === undefined || a.railGuns <= 0) continue;
    const region = land.armyRegion(a);
    next.push([armyId, a.owner, a.railGuns, region > 0 ? region : last]);
  }
  d.world.railGuns = next;
}
