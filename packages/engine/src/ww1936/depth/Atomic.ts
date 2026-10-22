// World War 1936 P6 lane S (plan Task 6 Step 2, spec §9.4–§9.6): the
// atomic bomb — the drop order, the zone's queue (interception by the
// enemy's air superiority, one seeded roll), and the effects: buildings,
// divisions, ships in port, war support, the surrender line, tension, the
// region's "nuked" year, its dam, the news. Tiles and terrain never change
// (Review Focus 5), and a no-strike region is never struck.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  equipKey,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { P_NUKE_INTERCEPT } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  NUKE_INTERCEPT_BOMBERS,
  nukeDropBlock,
  NukeDropInput,
  nukeInterceptPm,
  nukeOutcome,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { deploymentPlanes, deploymentSide } from "../air/WwAir";
import { damageBuilding, effectiveLevel } from "../economy/Buildings";
import { damageDivisions } from "../land/SeaLift";
import { addTension } from "../politics/Tension";
import { destroyDam } from "./Dams";
import type { WwDepth } from "./WwDepth";

const ATOMIC_KEY = equipKey("atomic_bomb", 1);
const BALLISTIC_KEY = equipKey("ballistic_rocket", 1);
const BALLISTIC = SPECIAL_PROJECTS.indexOf("sp_ballistic");
const STRAT = AIR_TYPES.indexOf("strat_bomber");
const M_STRAT = AIR_MISSIONS.indexOf("strategic_bombing");
const clampBp = (v: number) => Math.max(0, Math.min(10_000, v));

// ---- Shared reads (the rockets and raids use them too) ----

/** P4 A1's worst enemy air superiority over a zone for `owner`'s side, ‰ (its last day). */
export function enemySupPm(d: WwDepth, owner: number, sr: number): number {
  const i = d.ww.scenario.srIdxOf(sr);
  if (i < 0) return 0;
  const z = d.ww.air.zoneState[i];
  return z?.enemySup.get(d.ww.land.sideOf(owner)) ?? 0;
}

/**
 * Spec §9.5: the deployments of `owner`'s side over `sr` that carry the
 * bomb — strategic bombers (static or their design) on strategic bombing —
 * the owner's first, then the side's, by id.
 */
function nukeBomberDeployments(d: WwDepth, owner: number, sr: number) {
  const air = d.ww.air;
  const side = d.ww.land.sideOf(owner);
  const out = [];
  for (const id of air.deploymentsIn(sr)) {
    const dep = air.deployments.get(id);
    if (dep === undefined || dep.type !== STRAT || dep.mission !== M_STRAT) {
      continue;
    }
    if (deploymentSide(air, dep) !== side) continue;
    out.push(dep);
  }
  return out.sort(
    (a, b) =>
      Number(a.owner !== owner) - Number(b.owner !== owner) || a.id - b.id,
  );
}

/** Spec §9.5: our side's strategic bombers on strategic bombing over `sr`. */
export function nukeBombersIn(d: WwDepth, owner: number, sr: number): number {
  let n = 0;
  for (const dep of nukeBomberDeployments(d, owner, sr)) {
    n += deploymentPlanes(dep);
  }
  return n;
}

/**
 * Our working rocket site nearest to `target`'s center (km between the
 * centers; ties: the smaller region), {site: 0, km: -1} when we have none.
 */
export function nearestRocketSite(
  d: WwDepth,
  id: number,
  target: number,
): { site: number; km: number } {
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  const to = sc.centerTile(target);
  let site = 0;
  let km = -1;
  for (const r of [...econ.regionsOf(id)].sort((a, b) => a - b)) {
    if (d.ww.land.controller[r] !== id) continue;
    if (effectiveLevel(econ, r, "rocket_site") < 1) continue;
    const k = sc.kmBetween(sc.centerTile(r), to);
    if (km < 0 || k < km) {
      km = k;
      site = r;
    }
  }
  return { site, km };
}

/** Spec §9.5: nuke_drop's view of the target for the shared judge (nukeDropBlock). */
export function nukeDropInputOf(
  d: WwDepth,
  id: number,
  region: number,
  rocket: boolean,
): NukeDropInput {
  const land = d.ww.land;
  const ce = d.ww.economy.country(id);
  const ctl = land.controller[region] ?? 0;
  const sr = d.ww.scenario.regionSr(region);
  return {
    stock: ce?.stock[ATOMIC_KEY] ?? 0,
    atWar: ctl > 0 && land.isEnemy(id, ctl),
    bombersInZone: sr > 0 && !rocket ? nukeBombersIn(d, id, sr) : 0,
    nukesOn: d.nukesOn(),
    rocket,
    ballisticDone: d.projectDone(id, BALLISTIC),
    rocketKm: rocket ? nearestRocketSite(d, id, region).km : -1,
    ballisticStock: ce?.stock[BALLISTIC_KEY] ?? 0,
    noStrike: d.noStrike(region),
  };
}

// ---- The order ----

/** Spec §9.5 nuke_drop: the bomb (and a rocket) leave the stock; the drop waits for the zone's day. */
export function issueNukeDrop(
  d: WwDepth,
  id: number,
  region: number,
  rocket: boolean,
  tick: number,
): WwOrderBlock | null {
  const sc = d.ww.scenario;
  if (sc.region(region) === undefined) return "bad_region";
  const block = nukeDropBlock(nukeDropInputOf(d, id, region, rocket));
  if (block !== null) return block;
  const ce = d.ww.economy.country(id);
  if (ce === null) return "dead";
  ce.stock[ATOMIC_KEY] -= 1;
  if (rocket) ce.stock[BALLISTIC_KEY] -= 1;
  d.ww.economy.markCountryDirty(id);
  d.nukeQueue.push({
    owner: id,
    region,
    zone: sc.regionSr(region),
    rocket,
    day: d.ww.day(tick),
  });
  d.markCountry(id);
  return null;
}

// ---- The zone's day ----

/**
 * The day's drops over the zone (after W2's air day), in order. A drop
 * whose target no longer holds (the war over, the bombers gone, a lost
 * rocket site) is lost without a word. A bomber drop is intercepted when
 * wwRoll(seed, P_NUKE_INTERCEPT, owner, day, region) falls under the
 * enemy superiority's chance (milli‰, pre-flight A13): 10 bombers and the
 * bomb are lost, both countries hear of it.
 */
export function processNukeQueue(
  d: WwDepth,
  zone: number,
  day: number,
  tick: number,
): void {
  if (d.nukeQueue.length === 0) return;
  const mine = d.nukeQueue.filter((e) => e.zone === zone);
  if (mine.length === 0) return;
  d.nukeQueue = d.nukeQueue.filter((e) => e.zone !== zone);
  d.markGlobal();
  for (const e of mine) {
    if (!d.ww.isActor(e.owner)) continue;
    // The bomb (and the rocket) left the stock with the order.
    const ask = nukeDropInputOf(d, e.owner, e.region, e.rocket);
    ask.stock = 1;
    if (e.rocket) ask.ballisticStock = 1;
    if (nukeDropBlock(ask) !== null) continue;
    if (!e.rocket) {
      const pm = nukeInterceptPm(enemySupPm(d, e.owner, zone));
      const roll =
        wwRoll(d.ww.politics.seed, P_NUKE_INTERCEPT, e.owner, day, e.region) %
        1_000_000;
      if (roll < pm * 1000) {
        intercepted(d, e.owner, e.region, zone, tick);
        continue;
      }
    }
    applyNuke(d, e.owner, e.region, tick, e.rocket);
  }
}

/** Spec §9.5: an intercepted drop — 10 bombers lost (ours first), a line to both, its fx. */
function intercepted(
  d: WwDepth,
  owner: number,
  region: number,
  zone: number,
  tick: number,
): void {
  const air = d.ww.air;
  const victim = d.ww.land.controller[region] ?? 0;
  const deps = nukeBomberDeployments(d, owner, zone);
  const from = deps[0]?.base ?? 0;
  let left = NUKE_INTERCEPT_BOMBERS;
  for (const dep of deps) {
    if (left <= 0) break;
    // Newest generations first (the loss counts per generation).
    const counts = dep.counts.map(() => 0);
    for (let g = dep.counts.length - 1; g >= 0 && left > 0; g--) {
      const take = Math.min(left, dep.counts[g]);
      counts[g] = take;
      left -= take;
    }
    air.shootDown(dep.id, counts, victim);
  }
  d.message(owner, "ww1936_nuke_intercepted", { region });
  if (victim > 0) d.message(victim, "ww1936_nuke_intercepted", { region });
  d.addFx({
    kind: "nuke_intercepted",
    region,
    from: from > 0 ? from : region,
    owner,
    tick,
  });
  d.markCountry(owner);
}

/**
 * Spec §9.5 effects on region R, exactly nukeOutcome's numbers: a quarter
 * of its civilian and military factories and dockyards gone, every other
 * building of R damaged 800 milli each (capped at all stopped); divisions
 * in R lose 60% (P2's HP loss) and all their organisation, those next door
 * 15% (never in a no-strike region); ships in R's port lose half their
 * HP; the victim's war support base −15 points and its surrender line 10
 * lower (at most 30, nukeCutPp), its war allies −5 points; tension +10 by
 * the dropper; R nuked for 365 days; R's dam destroyed; world news and the
 * strike's fx. Tiles, their owners and the terrain stay as they are.
 */
export function applyNuke(
  d: WwDepth,
  owner: number,
  region: number,
  tick: number,
  rocket = false,
): void {
  // Sensitivity (decision 34): never a no-strike region, whatever calls.
  if (d.noStrike(region)) return;
  const ww = d.ww;
  const econ = ww.economy;
  const land = ww.land;
  const sc = ww.scenario;
  const pol = ww.politics;
  if (sc.region(region) === undefined) return;
  const victim = land.controller[region] ?? 0;
  const vc = victim > 0 ? d.country(victim) : null;
  const out = nukeOutcome(
    econ.civ[region] ?? 0,
    econ.mil[region] ?? 0,
    econ.dock[region] ?? 0,
    vc?.proj.nukedCount ?? 0,
  );
  // 1. The factories that are gone, then the damage to what stands.
  if (out.destroy.civ > 0) econ.addBuilding(region, "civ", -out.destroy.civ);
  if (out.destroy.mil > 0) econ.addBuilding(region, "mil", -out.destroy.mil);
  if (out.destroy.dock > 0) {
    econ.addBuilding(region, "dock", -out.destroy.dock);
  }
  for (const b of BUILDING_IDS) {
    // The dam is destroyed below (W1's floods).
    if (b === "dam") continue;
    const n = econ.buildingArray(b)[region] ?? 0;
    if (n > 0) damageBuilding(econ, region, b, n * out.damageMilliPerBuilding);
  }
  // 2. The divisions in R and next door, the ships in R's port.
  const t = land.divisions;
  const idsIn = (r: number) => land.rowsIn(r).map((row) => t.id[row]);
  const inR = idsIn(region);
  damageDivisions(land, inR, out.divisionLossPct * 10);
  for (const id of inR) {
    const row = t.rowOf(id);
    if (row < 0) continue;
    t.org[row] = 0;
    land.touchDivision(row);
    land.markArmy(t.army[row]);
  }
  for (const n of [...sc.regionNeighbours(region)].sort((a, b) => a - b)) {
    // Sensitivity (decision 34): the blast never reaches a no-strike region.
    if (d.noStrike(n)) continue;
    damageDivisions(land, idsIn(n), out.neighbourLossPct * 10);
  }
  const navy = ww.navy;
  for (const f of [...navy.fleets.values()].sort((a, b) => a.id - b.id)) {
    if (f.docked !== region) continue;
    for (const sid of f.ships) {
      const row = navy.ships.rowOf(sid);
      if (row < 0) continue;
      const hp = navy.ships.hp[row];
      navy.ships.hp[row] = hp - Math.floor((hp * out.portShipHpPct) / 100);
    }
    navy.markFleet(f.id);
  }
  // 3. The victim's war support and surrender line; its war allies.
  if (victim > 0) {
    const pc = pol.country(victim);
    if (pc !== null) {
      pc.wsBaseBp = clampBp(pc.wsBaseBp + out.warSupportBp);
      pol.markCountry(victim);
    }
    if (vc !== null) vc.proj.nukedCount += 1;
    const eg = ww.endgame;
    const w = eg.war(eg.warOfPair(owner, victim));
    const s = w === null ? -1 : eg.sideIndex(w, victim);
    if (w !== null && s !== -1) {
      for (const m of [...w.sides[s].members].sort((a, b) => a.id - b.id)) {
        if (m.id === victim || m.state !== "active") continue;
        const ac = pol.country(m.id);
        if (ac === null) continue;
        ac.wsBaseBp = clampBp(ac.wsBaseBp + out.alliesWarSupportBp);
        pol.markCountry(m.id);
      }
    }
    d.markCountry(victim);
    econ.markCountryDirty(victim);
  }
  // 4. Tension, as the P3 effect: the dropper's.
  addTension(pol, owner, out.tensionPct * 100);
  // 5. The nuked year (W1's region status reads it), the dam.
  d.markNuked(region, ww.day(tick) + out.nukedDays);
  const dam = sc.damOf(region);
  if (dam >= 0) destroyDam(d, dam, owner, tick);
  // 6. World news: facts only, no casualty figures (decision 34).
  const params = { countryTag: ww.tagOf(owner), region };
  d.news("news_nuke_dropped", params);
  d.messageAll("ww1936_nuke_dropped", params);
  const from = rocket
    ? nearestRocketSite(d, owner, region).site
    : (nukeBomberDeployments(d, owner, sc.regionSr(region))[0]?.base ?? 0);
  d.addFx({
    kind: "nuke",
    region,
    from: from > 0 ? from : region,
    owner,
    tick,
  });
  d.markCountry(owner);
  d.markGlobal();
}

/**
 * Spec §9.5 (3): how far the bombs that hit the country lower its
 * surrender line, percentage points (10 a bomb, at most 30). Positive:
 * P3's surrenderPct subtracts the depth cut (WwDepth.surrenderCutPp).
 */
export function nukeCutPp(d: WwDepth, id: number): number {
  const c = d.country(id);
  return c === null ? 0 : Math.min(30, 10 * c.proj.nukedCount);
}
