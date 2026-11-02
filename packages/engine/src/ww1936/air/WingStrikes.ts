// World War 1936 air overhaul (ww8), lane C: what a wing does when it gets
// there (design §4, §5). Lane B's stepWings calls deliverSortie at the end
// of a bombing, port strike, naval strike or air supply station (after the
// anti-air of the bombers) and accrueStation each tick of a patrol or recon.
// A delivery is `load` days of sorties at once (WingRules.loadCenti), so it
// reuses the old day's formulas with milli-sorties = flyMilli × load.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirRaidReport,
  type Wing,
  WP_GROUND,
  WP_REARM,
  WW_AIR_BOMB_LUCK_PCT,
  WW_AIR_REPORT_MERGE_DAYS,
  WW_AIR_REPORT_ROWS,
  WW_AIR_SUPPLY_PER_SORTIE_MILLI,
  WW_BOMB_CLASSES,
  WW_BOMB_FUEL_MILLI_PER_POINT,
  WW_BOMB_POINTS_PER_GROUND_PLANE,
  WW_BOMB_WS_DIV,
} from "@openfront/engine-api/ww1936/AirTypes";
import { DS_RECON } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { bombDamageMilli } from "@openfront/engine-lib/ww1936/AirRules";
import {
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { RECON_CAMERA_X } from "@openfront/engine-lib/ww1936/SeaAirRules";
import {
  P_AIR_BOMB,
  raidRepairDays,
  stationCentiPerDay,
  wingXpLoadPm,
} from "@openfront/engine-lib/ww1936/WingRules";
import { nightMods } from "../depth/AirExtras";
import { buildingIndex, effectiveLevel } from "../economy/Buildings";
import { buildingSpeedPct } from "../economy/Construction";
import { repairCostMilli } from "../economy/Repairs";
import {
  type EffectTally,
  enemyOfSide,
  newTally,
  portShipsFor,
  portsOf,
  seaShipsFor,
  type Sortie,
  strike,
} from "./AirEffects";
import {
  apportion,
  bombableRegions,
  bombTableOf,
  damageRegion,
  factoriesStopped,
  sideMembersOf,
  tableWeight,
} from "./Bombing";
import { oldestFirst } from "./DesignPlanes";
import { wingStats } from "./Sorties";
import { wingPlanes, wingSide, type WwAir, type ZoneAirState } from "./WwAir";

// ---- Start values (lane H tunes) ----

/** A port strike's bomb points from its naval attack, %: the ships are its main target. */
export const WW_PORT_STRIKE_POINTS_PCT = 50;
/** The city class: damage ×this/100, and the war support ring takes the points ×WW_CITY_WS_X. */
export const WW_CITY_DAMAGE_PCT = 50;
export const WW_CITY_WS_X = 2;
/** The ships' anti-air at sea and in port, planes lost a point of AA (the old day's SHIP_AA_LOSS_*). */
const AA_PER_CENTI_SEA = 3;
const AA_PER_CENTI_PORT = 5;

const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_PORT = AIR_MISSIONS.indexOf("port_strike");
const M_NAVAL = AIR_MISSIONS.indexOf("naval_strike");
const M_SUPPLY = AIR_MISSIONS.indexOf("air_supply");
const M_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const M_RECON = AIR_MISSIONS.indexOf("recon");
const T_NAVAL_BOMBER = AIR_TYPES.indexOf("naval_bomber");
const OIL = RESOURCE_IDS.indexOf("oil");
const CLS_FUEL = WW_BOMB_CLASSES.indexOf("fuel");
const CLS_CITY = WW_BOMB_CLASSES.indexOf("city");
const CLS_AIRFIELD = WW_BOMB_CLASSES.indexOf("airfield");
const CLS_PORT = WW_BOMB_CLASSES.indexOf("port");

type Zone = NonNullable<ReturnType<WwAir["ww"]["scenario"]["sr"]>>;

/**
 * The end of a wing's station on strategic_bombing, port_strike,
 * naval_strike or air_supply: the delivery, after lane B took the bombers'
 * anti-air over the target. `loadCenti` is the delivery's size in days of
 * sorties ×100 (WingRules.loadCenti). The ships' own anti-air (naval and
 * port strikes) is taken here, inside the strike.
 */
export function deliverSortie(
  air: WwAir,
  w: Wing,
  loadCenti: number,
  tick: number,
): void {
  const sc = air.ww.scenario;
  const s = sc.sr(w.flySr);
  if (s === undefined || w.flyMilli <= 0 || wingPlanes(w) <= 0) return;
  const idx = sc.srIdxOf(w.flySr);
  const z = air.zoneState[idx];
  const load = Math.floor((loadCenti * wingXpLoadPm(w.xpMilli)) / 1000);
  const x: Sortie = {
    d: w,
    side: wingSide(air, w),
    gen: 1,
    milli: Math.floor((w.flyMilli * load) / 100),
    stats: wingStats(air, w),
  };
  if (x.milli <= 0) return;
  const day = air.ww.day(tick);
  const fx = newTally();
  switch (w.flyMission) {
    case M_BOMB:
      bombRun(air, w, s, x, tick, day, load, fx);
      break;
    case M_PORT:
      portRun(air, w, s, x, tick, day, load, fx);
      break;
    case M_NAVAL:
      navalRun(air, w, s, z, x, tick, load, fx);
      break;
    case M_SUPPLY:
      supplyRun(air, w, s, z, x);
      break;
    default:
      return;
  }
  flushTally(air, z, fx, day);
  air.markZone(idx);
}

// ---- Stations that add up (patrol, recon) ----

/**
 * One tick on station on naval_patrol or recon: the zone's sums for today.
 * A tick on station is flyMilli ÷ (ticks on station a day), so a day on
 * station at the reference distance adds what the old day's sorties did.
 */
export function accrueStation(air: WwAir, w: Wing, tick: number): void {
  void tick;
  if (w.flyMilli <= 0) return;
  const sc = air.ww.scenario;
  const idx = sc.srIdxOf(w.flySr);
  if (idx < 0) return;
  const mission = AIR_MISSIONS[w.flyMission];
  if (mission === undefined) return;
  const perDay = stationCentiPerDay(AIR_TYPES[w.type], mission);
  if (perDay <= 0) return;
  const per = Math.floor((w.flyMilli * 100) / perDay);
  if (per <= 0) return;
  const t = air.zoneState[idx].today;
  const ce = air.econ.country(w.owner);
  if (w.flyMission === M_PATROL) {
    const pat = ce?.stats.navalPatrolPct ?? 0;
    const s0 = (w.type === T_NAVAL_BOMBER ? 3 : 1) * per;
    addTo(
      t.navalSearch,
      w.owner,
      pat === 0 ? s0 : Math.floor((s0 * Math.max(0, 100 + pat)) / 100),
    );
    addTo(t.navalAsw, w.owner, per);
  } else if (w.flyMission === M_RECON) {
    if (sc.sr(w.flySr)?.kind !== "land") return;
    let milli = per;
    // A camera design's planes count again (RECON_CAMERA_X).
    const n = wingPlanes(w);
    w.dcounts.forEach((c, i) => {
      if (c <= 0 || n <= 0) return;
      const flags = air.ww.depth.designStatsOf(w.owner, "plane", i + 1)?.flags;
      if (((flags ?? 0) & DS_RECON) !== 0) {
        milli += Math.floor((per * c * (RECON_CAMERA_X - 1)) / n);
      }
    });
    const pct = ce?.stats.reconPct ?? 0;
    milli = Math.floor((milli * Math.max(0, 100 + pct)) / 100);
    addTo(t.recon, wingSide(air, w), milli);
  }
}

function addTo(m: Map<number, number>, k: number, v: number): void {
  if (v !== 0) m.set(k, (m.get(k) ?? 0) + v);
}

// ---- Strategic bombing (design §5.1) ----

/** What one run did to one region. */
interface RunHit {
  victim: number;
  region: number;
  /** Points after anti-air: the war support ring's. */
  after: number;
  /** BUILDING_IDS index → damage milli added. */
  stopped: Map<number, number>;
  fuelMilli: number;
  shipsHit: number;
  groundPlanes: number;
}

function hasOil(air: WwAir, region: number): boolean {
  return (air.ww.scenario.region(region)?.res[OIL] ?? 0) > 0;
}

function bombRun(
  air: WwAir,
  w: Wing,
  s: Zone,
  x: Sortie,
  tick: number,
  day: number,
  load: number,
  fx: EffectTally,
): void {
  if (s.kind !== "land") return;
  const econ = air.econ;
  const land = air.land;
  const pct = econ.country(w.owner)?.stats.stratBombPct ?? 0;
  const lit = Math.floor(
    (Math.floor((x.milli * x.stats.strat) / 1000) * Math.max(0, 100 + pct)) /
      100,
  );
  const night = Math.floor(
    (lit * nightMods(air.ww.depth, w.id).bombBp) / 10_000,
  );
  // The run's luck: 100 ± WW_AIR_BOMB_LUCK_PCT, seeded by wing and tick.
  const luck =
    100 -
    WW_AIR_BOMB_LUCK_PCT +
    (wwRoll(air.ww.politics.seed, P_AIR_BOMB, w.id, tick) %
      (2 * WW_AIR_BOMB_LUCK_PCT + 1));
  const points = Math.floor((Math.floor(night / 100) * luck) / 100);
  if (points <= 0) return;
  const cls = WW_BOMB_CLASSES[w.cls] ?? "auto";
  const members = sideMembersOf(land, x.side);
  const targets = bombableRegions(air, w.flySr).filter((r) => {
    const c = land.controller[r] ?? 0;
    if (c === 0 || !members.some((m) => land.isEnemy(m, c))) return false;
    return (
      cls === "auto" ||
      tableWeight(econ, r, bombTableOf(cls, hasOil(air, r))) > 0
    );
  });
  if (targets.length === 0) return;
  const hits: RunHit[] = [];
  // The tapped region first; what it cannot take goes on to the zone's others.
  const first = targets.includes(w.hit) ? w.hit : 0;
  let left = points;
  if (first !== 0) {
    left = bombRegion(air, w, x, first, left, cls, hits, fx, tick, load);
  }
  if (left > 0) {
    const rest = targets.filter((r) => r !== first);
    const share = apportion(
      left,
      rest.map((r) => tableWeight(econ, r, bombTableOf(cls, hasOil(air, r)))),
    );
    rest.forEach((r, i) => {
      if (share[i] > 0) {
        bombRegion(air, w, x, r, share[i], cls, hits, fx, tick, load);
      }
    });
  }
  if (hits.length === 0) return;
  let given = 0;
  for (const h of hits) given += h.after;
  air.bombPointsTotal += given;
  addTo(fx.bomb, w.owner, points);
  const slot = ((day % 30) + 30) % 30;
  const ws = WW_BOMB_CLASSES.indexOf(cls) === CLS_CITY ? WW_CITY_WS_X : 1;
  for (const h of hits) {
    const c = air.country(h.victim);
    if (c !== null && h.after > 0) {
      c.bombTaken[slot] += h.after * ws;
      air.markCountry(h.victim);
    }
    writeReport(air, w, h, day, WW_BOMB_CLASSES.indexOf(cls), ws);
  }
}

/** The damage a region took, by building index, over `table`. */
function damageSnapshot(
  air: WwAir,
  region: number,
  table: readonly (readonly [string, number])[],
): Map<number, number> {
  const n = BUILDING_IDS.length;
  const out = new Map<number, number>();
  for (const [b] of table) {
    const i = buildingIndex(b as (typeof BUILDING_IDS)[number]);
    out.set(i, air.econ.damage[region * n + i] ?? 0);
  }
  return out;
}

function damageSince(
  air: WwAir,
  region: number,
  before: ReadonlyMap<number, number>,
): Map<number, number> {
  const n = BUILDING_IDS.length;
  const out = new Map<number, number>();
  for (const [i, was] of before) {
    const d = (air.econ.damage[region * n + i] ?? 0) - was;
    if (d > 0) out.set(i, d);
  }
  return out;
}

/** Hits one region with `points`; returns the points it could not take (the damage cap). */
function bombRegion(
  air: WwAir,
  w: Wing,
  x: Sortie,
  region: number,
  points: number,
  cls: (typeof WW_BOMB_CLASSES)[number],
  hits: RunHit[],
  fx: EffectTally,
  tick: number,
  load: number,
): number {
  const econ = air.econ;
  const victim = air.land.controller[region] ?? 0;
  const table = bombTableOf(cls, hasOil(air, region));
  const aa = effectiveLevel(econ, region, "anti_air");
  const taken = econ.country(victim)?.stats.bombDamageTakenPct ?? 0;
  const ci = WW_BOMB_CLASSES.indexOf(cls);
  const after = Math.floor((points * (1000 - Math.min(400, 80 * aa))) / 1000);
  let dmg = bombDamageMilli(points, aa, taken);
  if (ci === CLS_CITY) dmg = Math.floor((dmg * WW_CITY_DAMAGE_PCT) / 100);
  const before = damageSnapshot(air, region, table);
  const fBefore = factoriesStopped(econ, region);
  const done = damageRegion(econ, region, dmg, table);
  const h: RunHit = {
    victim,
    region,
    after,
    stopped: damageSince(air, region, before),
    fuelMilli: 0,
    shipsHit: 0,
    groundPlanes: 0,
  };
  air.raidNotes.note(
    air,
    victim,
    w.owner,
    region,
    factoriesStopped(econ, region) - fBefore,
    0,
    done,
  );
  const ce = econ.country(victim);
  if (ci === CLS_FUEL && ce !== null && after > 0) {
    const take = Math.min(ce.fuelMilli, after * WW_BOMB_FUEL_MILLI_PER_POINT);
    if (take > 0) {
      ce.fuelMilli -= take;
      h.fuelMilli = take;
      econ.markCountryDirty(victim);
    }
  }
  if (ci === CLS_AIRFIELD && after > 0) {
    h.groundPlanes = groundLosses(
      air,
      region,
      x.side,
      Math.floor(after / WW_BOMB_POINTS_PER_GROUND_PLANE),
      w.owner,
    );
  }
  if (ci === CLS_PORT && after > 0) {
    const { ships, portOf, baseAaMilli } = portShipsFor(air, x.side, [region]);
    h.shipsHit = shipsStruck(
      air,
      x,
      ships,
      portOf,
      baseAaMilli,
      fx,
      tick,
      load,
      150,
      AA_PER_CENTI_PORT,
    );
  }
  hits.push(h);
  return dmg > 0 && done < dmg ? Math.floor((points * (dmg - done)) / dmg) : 0;
}

/**
 * Planes on the ground at `region` (ground or rearm phase) of the sides at
 * war with `side` lose `n`, by planes, the oldest first. Returns the planes lost.
 */
function groundLosses(
  air: WwAir,
  region: number,
  side: number,
  n: number,
  by: number,
): number {
  if (n <= 0) return 0;
  const ids: number[] = [];
  for (const w of air.wings.values()) {
    if (w.base !== region) continue;
    if (w.phase !== WP_GROUND && w.phase !== WP_REARM) continue;
    if (
      !enemyOfSide(air, side, w.volunteerFor !== 0 ? w.volunteerFor : w.owner)
    )
      continue;
    ids.push(w.id);
  }
  if (ids.length === 0) return 0;
  ids.sort((a, b) => a - b);
  const share = apportion(
    n,
    ids.map((id) => wingPlanes(air.wings.get(id)!)),
  );
  let lost = 0;
  ids.forEach((id, i) => {
    const w = air.wings.get(id)!;
    if (share[i] <= 0) return;
    const out = oldestFirst(
      air.ww.depth,
      w.owner,
      AIR_TYPES[w.type],
      w.counts,
      w.dcounts,
      share[i],
    );
    const counts = out.slots === null ? out.gens : [...out.gens, ...out.slots];
    const got = air.shootDown(id, counts, by);
    air.planesLostTotal += got;
    lost += got;
  });
  return lost;
}

// ---- Ships: port and naval strikes (design §4.2) ----

/** Strikes `ships`; returns how many took damage. */
function shipsStruck(
  air: WwAir,
  x: Sortie,
  ships: readonly number[],
  portOf: ReadonlyMap<number, number> | undefined,
  baseAaMilli: number,
  fx: EffectTally,
  tick: number,
  load: number,
  hitPm: number,
  aaPerCenti: number,
): number {
  if (ships.length === 0) return 0;
  const t = air.navy.ships;
  const hp = ships.map((id) => t.hp[t.rowOf(id)]);
  strike(
    air,
    [x],
    ships,
    hitPm,
    aaPerCenti,
    baseAaMilli,
    fx,
    tick,
    portOf,
    load,
  );
  let n = 0;
  ships.forEach((id, i) => {
    const r = t.rowOf(id);
    if (r < 0 || t.hp[r] < hp[i]) n++;
  });
  return n;
}

function portRun(
  air: WwAir,
  w: Wing,
  s: Zone,
  x: Sortie,
  tick: number,
  day: number,
  load: number,
  fx: EffectTally,
): void {
  const sc = air.ww.scenario;
  const all = portsOf(air, s);
  const ports = all.includes(w.hit) ? [w.hit] : all;
  const { ships, portOf, baseAaMilli } = portShipsFor(air, x.side, ports);
  const struck = shipsStruck(
    air,
    x,
    ships,
    portOf,
    baseAaMilli,
    fx,
    tick,
    load,
    150,
    AA_PER_CENTI_PORT,
  );
  addTo(air.zoneState[sc.srIdxOf(w.flySr)].today.navalStrike, w.owner, x.milli);
  // The naval base takes bomb damage too.
  const econ = air.econ;
  const land = air.land;
  const pct = econ.country(w.owner)?.stats.navalStrikePct ?? 0;
  const naval = Math.floor(
    (Math.floor((x.milli * x.stats.naval) / 1000) * Math.max(0, 100 + pct)) /
      100,
  );
  const points = Math.floor((naval * WW_PORT_STRIKE_POINTS_PCT) / 10_000);
  if (points <= 0) return;
  const table = bombTableOf("port", false);
  const members = sideMembersOf(land, x.side);
  const targets = ports.filter((r) => {
    const c = land.controller[r] ?? 0;
    return (
      c !== 0 &&
      members.some((m) => land.isEnemy(m, c)) &&
      tableWeight(econ, r, table) > 0
    );
  });
  const share = apportion(
    points,
    targets.map((r) => tableWeight(econ, r, table)),
  );
  targets.forEach((r, i) => {
    if (share[i] <= 0) return;
    const victim = land.controller[r] ?? 0;
    const aa = effectiveLevel(econ, r, "anti_air");
    const taken = econ.country(victim)?.stats.bombDamageTakenPct ?? 0;
    const before = damageSnapshot(air, r, table);
    const done = damageRegion(
      econ,
      r,
      bombDamageMilli(share[i], aa, taken),
      table,
    );
    const h: RunHit = {
      victim,
      region: r,
      after: Math.floor((share[i] * (1000 - Math.min(400, 80 * aa))) / 1000),
      stopped: damageSince(air, r, before),
      fuelMilli: 0,
      shipsHit: struck,
      groundPlanes: 0,
    };
    air.raidNotes.note(air, victim, w.owner, r, 0, struck > 0 ? 1 : 0, done);
    const c = air.country(victim);
    if (c !== null && h.after > 0) {
      c.bombTaken[((day % 30) + 30) % 30] += h.after;
      air.markCountry(victim);
    }
    writeReport(air, w, h, day, CLS_PORT, 1);
  });
}

function navalRun(
  air: WwAir,
  w: Wing,
  s: Zone,
  z: ZoneAirState,
  x: Sortie,
  tick: number,
  load: number,
  fx: EffectTally,
): void {
  if (s.kind !== "sea") return;
  const only = w.hit > SEA_ZONE_BASE && s.members.includes(w.hit) ? w.hit : 0;
  const ships = seaShipsFor(air, s, x.side, only);
  addTo(z.today.navalStrike, w.owner, x.milli);
  shipsStruck(
    air,
    x,
    ships,
    undefined,
    0,
    fx,
    tick,
    load,
    100,
    AA_PER_CENTI_SEA,
  );
}

// ---- Air supply (design §4.3) ----

function supplyRun(
  air: WwAir,
  w: Wing,
  s: Zone,
  z: ZoneAirState,
  x: Sortie,
): void {
  if (s.kind !== "land") return;
  const land = air.land;
  let pool = Math.floor((x.milli * WW_AIR_SUPPLY_PER_SORTIE_MILLI) / 1000);
  if (pool <= 0) return;
  const side = x.side;
  const todays = new Map<number, [number, number, number]>();
  for (const row of z.today.airSupply) {
    todays.set(row[0] * 4096 + row[1], [row[0], row[1], row[2]]);
  }
  const short: {
    r: number;
    first: number;
    enc: number;
    pm: number;
    need: number;
  }[] = [];
  for (const r of s.members) {
    const c = land.controller[r] ?? 0;
    // A band still being taken counts as the taker's.
    const taker = land.bandTaker[r] ?? 0;
    const ours =
      (c !== 0 && land.sideOf(c) === side) ||
      (taker !== 0 && land.sideOf(taker) === side);
    if (!ours) continue;
    let had = 0;
    for (const [br, bs, m] of z.airSupply) if (br === r && bs === side) had = m;
    const ground = Math.max(0, land.supplyMilli[r] - had);
    const use = land.useMilli[r];
    const need = use - ground - (todays.get(r * 4096 + side)?.[2] ?? 0);
    if (use <= 0 || need <= 0) continue;
    short.push({
      r,
      first: r === w.hit ? 0 : 1,
      enc: land.encircled[r],
      pm: Math.floor((ground * 1000) / use),
      need,
    });
  }
  // The named region, then the encircled, then the lowest supply share.
  short.sort(
    (a, b) => a.first - b.first || b.enc - a.enc || a.pm - b.pm || a.r - b.r,
  );
  for (const p of short) {
    if (pool <= 0) break;
    const give = Math.min(pool, p.need);
    const key = p.r * 4096 + side;
    const row = todays.get(key);
    if (row === undefined) todays.set(key, [p.r, side, give]);
    else row[2] += give;
    pool -= give;
  }
  z.today.airSupply = [...todays.values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
}

// ---- The zone's results, the reports (design §5.2) ----

/** Today's result row (column 3 bomb points, 4 naval damage) and the 30-day rings. */
function flushTally(
  air: WwAir,
  z: ZoneAirState,
  fx: EffectTally,
  day: number,
): void {
  const slot = ((day % 30) + 30) % 30;
  for (const [owner, v] of fx.bomb) {
    const c = air.country(owner);
    if (c === null) continue;
    c.tally[2][slot] += v;
    air.markCountry(owner);
  }
  for (const [owner, v] of fx.sunk) {
    const c = air.country(owner);
    if (c === null) continue;
    c.tally[3][slot] += v;
    air.markCountry(owner);
  }
  const owners = new Set<number>([...fx.bomb.keys(), ...fx.naval.keys()]);
  for (const owner of [...owners].sort((a, b) => a - b)) {
    let row = z.today.result.get(owner);
    if (row === undefined) z.today.result.set(owner, (row = [0, 0, 0, 0, 0]));
    while (row.length < 5) row.push(0);
    row[3] += fx.bomb.get(owner) ?? 0;
    row[4] += fx.naval.get(owner) ?? 0;
  }
}

/** The days to mend a hit at the victim's pace today (its free factories). */
function repairDaysOf(air: WwAir, h: RunHit): number {
  const ce = air.econ.country(h.victim);
  if (ce === null || h.stopped.size === 0) return 0;
  let cost = 0;
  for (const [bi, m] of h.stopped) cost += repairCostMilli(BUILDING_IDS[bi], m);
  const given = Math.max(1000, Math.min(15_000, ce.totals.freeCivMilli));
  const b = BUILDING_IDS[Math.min(...h.stopped.keys())];
  const speed = projectSpeedPct({
    building: b,
    infra: air.econ.infraEff[h.region],
    tech: ce.stats,
    law: ce.law(),
    buildingPct: buildingSpeedPct(ce, b),
  });
  return raidRepairDays(cost, constructionProgress(given, speed));
}

/** A raid report row in both countries' lists, merged into a same-target row inside the window. */
function writeReport(
  air: WwAir,
  w: Wing,
  h: RunHit,
  day: number,
  cls: number,
  wsX: number,
): void {
  const stopped = [...h.stopped];
  const wsBp = Math.floor((h.after * wsX) / WW_BOMB_WS_DIV);
  const repair = repairDaysOf(air, h);
  const owners = w.owner === h.victim ? [w.owner] : [w.owner, h.victim];
  for (const owner of owners) {
    const c = air.country(owner);
    if (c === null) continue;
    const rows = c.reports;
    const i = rows.findIndex(
      (r) =>
        r.attacker === w.owner &&
        r.victim === h.victim &&
        r.region === h.region &&
        r.cls === cls &&
        day - r.day < WW_AIR_REPORT_MERGE_DAYS,
    );
    const r: AirRaidReport =
      i >= 0
        ? rows.splice(i, 1)[0]
        : {
            day,
            attacker: w.owner,
            victim: h.victim,
            region: h.region,
            cls,
            raids: 0,
            planes: 0,
            lost: 0,
            points: 0,
            stopped: [],
            fuelMilli: 0,
            shipsHit: 0,
            groundPlanes: 0,
            wsBp: 0,
            repairDays: 0,
          };
    r.day = day;
    r.raids += 1;
    r.planes += wingPlanes(w);
    r.points += h.after;
    r.fuelMilli += h.fuelMilli;
    r.shipsHit += h.shipsHit;
    r.groundPlanes += h.groundPlanes;
    r.wsBp += wsBp;
    const m = new Map<number, number>(r.stopped);
    for (const [bi, v] of stopped) m.set(bi, (m.get(bi) ?? 0) + v);
    r.stopped = [...m].sort((a, b) => a[0] - b[0]);
    r.repairDays = Math.max(r.repairDays, repair);
    rows.push(r);
    while (rows.length > WW_AIR_REPORT_ROWS) rows.shift();
    air.markCountry(owner);
  }
}

/**
 * Planes a raid lost to the defence (lane B's anti-air over the target),
 * added to the newest matching report row's `lost`. Call after deliverSortie.
 */
export function noteRaidLost(
  air: WwAir,
  attacker: number,
  victim: number,
  region: number,
  cls: number,
  n: number,
): void {
  if (n <= 0) return;
  for (const owner of attacker === victim ? [attacker] : [attacker, victim]) {
    const c = air.country(owner);
    if (c === null) continue;
    for (let i = c.reports.length - 1; i >= 0; i--) {
      const r = c.reports[i];
      if (
        r.attacker === attacker &&
        r.victim === victim &&
        r.region === region &&
        r.cls === cls
      ) {
        r.lost += n;
        air.markCountry(owner);
        break;
      }
    }
  }
}

/**
 * The planes a raid lost to the defence, onto its report's `lost`. Lane C
 * (w8-C commit cee7a54d0 has the real one; take that file at the merge).
 */
export function noteRaidLost(
  air: WwAir,
  attacker: number,
  victim: number,
  region: number,
  cls: number,
  n: number,
): void {
  void air;
  void attacker;
  void victim;
  void region;
  void cls;
  void n;
}
