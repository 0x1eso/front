// World War 1936 P6 lane S (plan Task 6 Step 4, spec §10): raids —
// paratroopers, commandos and precision bombing — on one building of an
// enemy's region. The raiding division leaves its army for an idle one of
// its own while it prepares; on the ready day one seeded roll
// (wwRoll(seed, P_RAID, uid), milli‰) decides: the target loses levels (a
// facility 15% of its project, a dam is destroyed), the raiders lose
// strength. A no-strike region is never a target.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  FACILITY_IDS,
  RAID_KINDS,
  RaidKind,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  MOVE_NONE,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { P_RAID } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  RAID_BOMBER_LOSS_PCT,
  RAID_FACILITY_CUT_MILLI,
  RAID_FACILITY_INTEL,
  RAID_FAIL_LOSS_PM,
  RAID_MIN_BOMBERS,
  RAID_MIN_CONVOYS,
  RAID_MIN_TRANSPORTS,
  RAID_ROUTE_SUP_PM,
  RAID_SUCCESS_LOSS_PM,
  raidBlock,
  raidExpLevel,
  RaidInput,
  raidLevelCut,
  raidPrepDays,
  raidSuccessPm,
  raidTargetOk,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { transportStock } from "../air/Paradrop";
import { effectiveLevel } from "../economy/Buildings";
import { damageDivisions } from "../land/SeaLift";
import type { Army } from "../land/WwLand";
import { freeConvoysOf } from "../navy/Convoys";
import { enemySupPm } from "./Atomic";
import { destroyDam } from "./Dams";
import { facilityKindAt, runAt } from "./Projects";
import type { WwDepth } from "./WwDepth";

type RaidOrder = Extract<DepthOrder, { kind: "raid" }>;
type Raid = WwDepth["raids"][number];

const BOMBER_TYPES: readonly number[] = [
  AIR_TYPES.indexOf("strat_bomber"),
  AIR_TYPES.indexOf("bomber"),
];
const FACILITIES: ReadonlySet<BuildingId> = new Set(FACILITY_IDS);

/** Spec §10 raid_bomb: our strategic and tactical bombers deployed over a zone. */
export function raidBombersIn(d: WwDepth, id: number, sr: number): number {
  const air = d.ww.air;
  let n = 0;
  for (const depId of air.deploymentsIn(sr)) {
    const dep = air.deployments.get(depId);
    if (dep === undefined || dep.owner !== id) continue;
    if (!BOMBER_TYPES.includes(dep.type)) continue;
    for (const c of dep.counts) n += c;
    for (const c of dep.dcounts) n += c;
  }
  return n;
}

/** The building stands in the region (a dam: standing, level > 0). */
function buildingStands(d: WwDepth, region: number, b: BuildingId): boolean {
  if (b === "dam") {
    const dam = d.ww.scenario.damOf(region);
    return dam >= 0 && (d.world.damLevel[dam] ?? 0) > 0;
  }
  return (d.ww.economy.buildingArray(b)[region] ?? 0) > 0;
}

/** A division mostly of `kinds` battalions (more than half). */
function mostlyOf(
  d: WwDepth,
  owner: number,
  row: number,
  kinds: readonly string[],
): boolean {
  const land = d.ww.land;
  const bats =
    land.templateOf(owner, land.divisions.template[row])?.def.battalions ?? [];
  if (bats.length === 0) return false;
  const n = bats.filter((b) => kinds.includes(b)).length;
  return n * 2 > bats.length;
}

/** The sea route of a commando raid: our port's zone to the target's, our side's supremacy ≥ 30% all the way. */
function commandoRouteOk(
  d: WwDepth,
  id: number,
  from: number,
  target: number,
): boolean {
  const sc = d.ww.scenario;
  const navy = d.ww.navy;
  const a = sc.harborOf(from);
  const b = sc.harborOf(target);
  if (a === 0 || b === 0 || !navy.isPort(from)) return false;
  const path = seaPath(sc, [a], [b], navy.passable(id, false));
  if (path === null) return false;
  const side = navy.sideOf(id);
  const srs = [...new Set(path.zones.map((z) => sc.zoneSr(z)))];
  return srs.every((sr) => navy.supremacy(side, sr) >= RAID_ROUTE_SUP_PM);
}

/** The general of a division's army has the commando trait (spec §4.2). */
function commandoGeneral(d: WwDepth, owner: number, row: number): boolean {
  const land = d.ww.land;
  const army = land.divisions.army[row];
  const g = land.country(owner)?.generals.find((x) => x.army === army);
  return g !== undefined && (g.traits & traitBit("commando")) !== 0;
}

export interface RaidAsk {
  input: RaidInput;
  prepDays: number;
  /** The raiders' region (a division's; a deployment's base). */
  from: number;
}

/**
 * Spec §10: a raid's view for the shared judge (raidBlock) — the unit,
 * its reach, the target building in an enemy's region, and the intel on
 * the target region's controller (never an arbitrary enemy).
 */
export function raidAskOf(
  d: WwDepth,
  id: number,
  kind: RaidKind,
  unit: number,
  target: number,
  building: BuildingId,
  except = 0,
): RaidAsk {
  const ww = d.ww;
  const land = ww.land;
  const sc = ww.scenario;
  const ctl = land.controller[target] ?? 0;
  const facilityTarget = FACILITIES.has(building);
  const targetOk =
    sc.region(target) !== undefined &&
    ctl > 0 &&
    land.isEnemy(id, ctl) &&
    raidTargetOk(kind, building) &&
    buildingStands(d, target, building);
  let unitOk = false;
  let reachOk = false;
  let from = 0;
  let commando = false;
  if (kind === "raid_bomb") {
    const dep = ww.air.deployments.get(unit);
    const sr = sc.regionSr(target);
    unitOk =
      dep !== undefined &&
      dep.owner === id &&
      dep.sr === sr &&
      BOMBER_TYPES.includes(dep.type);
    reachOk = sr > 0 && raidBombersIn(d, id, sr) >= RAID_MIN_BOMBERS;
    from = dep?.base ?? 0;
  } else {
    const t = land.divisions;
    const r = t.rowOf(unit);
    if (r >= 0 && t.owner[r] === id) {
      from = t.region[r];
      const busy = d.raids.some(
        (x) => x.uid !== except && x.unit === unit && x.kind !== 2,
      );
      unitOk =
        !busy &&
        t.battle[r] === 0 &&
        t.mode[r] === MOVE_NONE &&
        mostlyOf(
          d,
          id,
          r,
          kind === "raid_para" ? ["paratrooper"] : ["marine", "mountain"],
        );
      commando = commandoGeneral(d, id, r);
      if (kind === "raid_para") {
        reachOk =
          effectiveLevel(ww.economy, from, "air_base") >= 1 &&
          transportStock(ww.air, id) >= RAID_MIN_TRANSPORTS &&
          sc.kmBetween(sc.centerTile(from), sc.centerTile(target)) <=
            ww.air.planeStatsOf(id, "transport_plane", 1).rangeKm;
      } else {
        reachOk =
          freeConvoysOf(ww.navy, id) >= RAID_MIN_CONVOYS &&
          commandoRouteOk(d, id, from, target);
      }
    }
  }
  return {
    input: {
      kind,
      unitOk,
      targetOk,
      reachOk,
      running: d.raids.filter((x) => x.owner === id && x.uid !== except).length,
      intelClose: ctl > 0 && d.intelOf(id, ctl, 0) >= RAID_FACILITY_INTEL,
      facilityTarget,
      noStrike: d.noStrike(target),
    },
    prepDays: raidPrepDays(kind, commando),
    from,
  };
}

/** The raiding division's army: idle, not on auto, stopped where it stands. */
function holdArmy(d: WwDepth, a: Army): void {
  a.order = idleOrder();
  a.path = [];
  a.auto = false;
  a.pending = true;
  d.ww.land.markArmy(a.id);
}

/**
 * Spec §10 raid: the raiders prepare. A division leaves its army for an
 * idle army of its own (or holds its own when it is alone in it).
 */
export function issueRaid(
  d: WwDepth,
  id: number,
  o: RaidOrder,
  tick: number,
): WwOrderBlock | null {
  if (d.ww.scenario.region(o.target) === undefined) return "bad_region";
  const ask = raidAskOf(d, id, o.raid, o.unit, o.target, o.building);
  const block = raidBlock(ask.input);
  if (block !== null) return block;
  const land = d.ww.land;
  if (o.raid !== "raid_bomb") {
    const t = land.divisions;
    const r = t.rowOf(o.unit);
    const a = land.armies.get(t.army[r]);
    if (a === undefined || a.divisions.length > 1) {
      const own = land.newArmy(id);
      if (own === null) return "too_many_armies";
      land.moveToArmy(o.unit, own);
      holdArmy(d, own);
    } else {
      holdArmy(d, a);
    }
  }
  d.raids.push({
    uid: d.uid(),
    owner: id,
    kind: RAID_KINDS.indexOf(o.raid),
    unit: o.unit,
    target: o.target,
    building: BUILDING_IDS.indexOf(o.building),
    readyDay: d.ww.day(tick) + ask.prepDays,
  });
  d.markCountry(id);
  return null;
}

/** raid_cancel: the raid ends unflown; its division rejoins an army. */
export function cancelRaid(
  d: WwDepth,
  id: number,
  uid: number,
): WwOrderBlock | null {
  const raid = d.raids.find((x) => x.uid === uid && x.owner === id);
  if (raid === undefined) return "bad_index";
  d.raids = d.raids.filter((x) => x !== raid);
  if (raid.kind !== 2) rejoin(d, id, raid.unit);
  d.markCountry(id);
  return null;
}

/**
 * Spec §10: the division comes back to the nearest army of ours (by the
 * km between its region and the army's; ties: the smaller id) — the one
 * it left, as it never moved. An army with a general (its own, which it
 * held alone) keeps it.
 */
function rejoin(d: WwDepth, id: number, divId: number): void {
  const land = d.ww.land;
  const t = land.divisions;
  const r = t.rowOf(divId);
  if (r < 0) return;
  const own = land.armies.get(t.army[r]);
  if (own === undefined) return;
  const hasGeneral =
    land.country(id)?.generals.some((g) => g.army === own.id) ?? false;
  if (hasGeneral) return;
  const sc = d.ww.scenario;
  const at = t.region[r];
  let best: Army | null = null;
  let bestKm = 0;
  for (const a of land.armiesOf(id).sort((x, y) => x.id - y.id)) {
    if (a.id === own.id || a.divisions.length === 0) continue;
    const km = sc.regionKm(at, land.armyRegion(a));
    if (best === null || km < bestKm) {
      best = a;
      bestKm = km;
    }
  }
  if (best !== null) land.moveToArmy(divId, best);
}

/** The common day: the raids whose preparation ends today go in, in order. */
export function processRaids(d: WwDepth, day: number, tick: number): void {
  if (d.raids.length === 0) return;
  const due = d.raids.filter((x) => x.readyDay <= day);
  if (due.length === 0) return;
  d.raids = d.raids.filter((x) => x.readyDay > day);
  for (const raid of due) resolveRaid(d, raid, day, tick);
}

function resolveRaid(d: WwDepth, raid: Raid, day: number, tick: number): void {
  void day;
  const ww = d.ww;
  const land = ww.land;
  const econ = ww.economy;
  const sc = ww.scenario;
  const kind = RAID_KINDS[raid.kind];
  const building = BUILDING_IDS[raid.building];
  const owner = raid.owner;
  d.markCountry(owner);
  if (kind === undefined || building === undefined) return;
  const ask = raidAskOf(
    d,
    owner,
    kind,
    raid.unit,
    raid.target,
    building,
    raid.uid,
  );
  const division = kind !== "raid_bomb";
  // The target no longer holds (peace, the building gone, the raiders
  // gone): the raid is off, the division rejoins whole.
  if (
    !ww.isActor(owner) ||
    ask.input.noStrike ||
    !ask.input.targetOk ||
    (division
      ? land.divisions.rowOf(raid.unit) < 0
      : ww.air.deployments.get(raid.unit)?.owner !== owner)
  ) {
    if (division) rejoin(d, owner, raid.unit);
    return;
  }
  const ctl = land.controller[raid.target];
  const t = land.divisions;
  const row = division ? t.rowOf(raid.unit) : -1;
  const enemyDivision = land
    .rowsIn(raid.target)
    .some((r) => land.isEnemy(owner, land.fightOwner(r)));
  const pm = raidSuccessPm(raid.kind as 0 | 1 | 2, {
    expLevel: row >= 0 ? raidExpLevel(t.exp[row]) : 0,
    aa: effectiveLevel(econ, raid.target, "anti_air"),
    supPm: enemySupPm(d, owner, sc.regionSr(raid.target)),
    enemyDivision,
    coastalFort: effectiveLevel(econ, raid.target, "coastal_fort"),
    bombers: raidBombersIn(d, owner, sc.regionSr(raid.target)),
  });
  const roll = wwRoll(ww.politics.seed, P_RAID, raid.uid) % 1_000_000;
  let hit = 0;
  if (roll < pm * 1000) {
    hit = raidHit(d, owner, kind, raid.target, building, tick);
    if (division) {
      damageDivisions(land, [raid.unit], RAID_SUCCESS_LOSS_PM);
      rejoin(d, owner, raid.unit);
    }
  } else if (division) {
    // Cut off from our side: the division is lost.
    const r = t.rowOf(raid.unit);
    if (r >= 0 && !land.sameSide(owner, land.controller[t.region[r]] ?? 0)) {
      land.killDivision(r, true);
    } else {
      damageDivisions(land, [raid.unit], RAID_FAIL_LOSS_PM);
      rejoin(d, owner, raid.unit);
    }
  } else {
    loseBombers(d, raid.unit, ctl);
  }
  d.message(owner, "ww1936_raid_result", { n: hit, region: raid.target });
  if (ctl > 0) {
    d.message(ctl, "ww1936_raid_result", { n: hit, region: raid.target });
    d.markCountry(ctl);
  }
  d.addFx({
    kind: "raid",
    region: raid.target,
    from: ask.from > 0 ? ask.from : raid.target,
    owner,
    tick,
  });
}

/**
 * Spec §10 success: a facility's project loses 15% (a nuclear lab making
 * bombs, its bomb), a dam is destroyed (W1's floods), any other building
 * loses 2 levels (precision bombing: 1). Returns the buildings hit.
 */
function raidHit(
  d: WwDepth,
  owner: number,
  kind: RaidKind,
  target: number,
  building: BuildingId,
  tick: number,
): number {
  const ww = d.ww;
  const ctl = ww.land.controller[target] ?? 0;
  if (FACILITIES.has(building)) {
    const c = d.country(ctl);
    if (c === null || facilityKindAt(d, target) < 0) return 0;
    const run = runAt(c, target);
    if (run !== undefined) {
      run.progressMilli = Math.max(
        0,
        run.progressMilli - RAID_FACILITY_CUT_MILLI,
      );
    } else {
      const lab = c.proj.atomic.find((x) => x[0] === target);
      if (lab !== undefined) {
        lab[1] = Math.max(0, lab[1] - RAID_FACILITY_CUT_MILLI);
      }
    }
    return 1;
  }
  if (building === "dam") {
    const dam = ww.scenario.damOf(target);
    if (dam < 0) return 0;
    destroyDam(d, dam, owner, tick);
    return 1;
  }
  const have = ww.economy.buildingArray(building)[target] ?? 0;
  const n = Math.min(have, raidLevelCut(kind));
  if (n > 0) ww.economy.addBuilding(target, building, -n);
  return n;
}

/** Spec §10: a failed precision raid costs the deployment a tenth of its planes. */
function loseBombers(d: WwDepth, depId: number, by: number): void {
  const air = d.ww.air;
  const dep = air.deployments.get(depId);
  if (dep === undefined) return;
  let total = 0;
  for (const c of dep.counts) total += c;
  let left = Math.floor((total * RAID_BOMBER_LOSS_PCT) / 100);
  const counts = dep.counts.map(() => 0);
  for (let g = dep.counts.length - 1; g >= 0 && left > 0; g--) {
    const take = Math.min(left, dep.counts[g]);
    counts[g] = take;
    left -= take;
  }
  air.shootDown(depId, counts, by);
}
