// World War 1936 P4: air deployments, bases and refills (P4 spec §13).
// Lane A1 (Task 7). A deployment group is (owner, zone, type, mission,
// volunteer host): one record per base it uses, the same target on every
// record. A group whose planes found no base keeps one empty record on
// base 0 (it waits and tries again on the country's day). Carrier wings
// are records on base −(ship id) that mirror their carrier's deck (spec
// §13.4): they never touch the stock, the deck holds the planes.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirOrder,
  CARRIER_AIR_TYPES,
  WW_MAX_DEPLOYMENTS,
} from "@openfront/engine-api/ww1936/AirTypes";
import { WW_PLANE_DESIGN_SLOTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_STATES,
  SHIP_CLASSES,
  WW_SPOT_FULL_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { airDeployBlock } from "@openfront/engine-lib/ww1936/AirRules";
import { designPlaneP4, returnDesignPlanes } from "../depth/Designs";
import { drawPlanes, returnPlanes } from "../economy/Buildings";
import type { CountryEconomy } from "../economy/WwEconomy";
import { fillDecks } from "../navy/Carriers";
import {
  deckDesignCounts,
  designSlotsFor,
  oldestFirst,
  planeSources,
} from "./DesignPlanes";
import { Deployment, deploymentPlanes, deploymentSide, WwAir } from "./WwAir";

const MISSION_SUP = AIR_MISSIONS.indexOf("air_superiority");
const MISSION_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
const MISSION_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const CV = SHIP_CLASSES.indexOf("cv");
/** Spec §13.4: a carrier "on its mission" flies: at sea, on station, sortied or in battle. */
const FLYING_STATES: ReadonlySet<number> = new Set(
  (["on_station", "sortie", "battle"] as const).map((s) =>
    FLEET_STATES.indexOf(s),
  ),
);

// P6 hook (W2, E): the depth fields take WwAir.addDeployment's defaults.
type GroupProto = Omit<
  Deployment,
  "id" | "counts" | "base" | "lossRest" | "dcounts" | "night" | "ace"
>;

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/** A carrier wing's record (spec §13.4): its base is −(ship id). */
export function isCarrierWing(d: Deployment): boolean {
  return d.base < 0;
}

/** The deck slot of a carrier plane type (DECK_SLOTS: 3 types × 3 generations), −1 for any other type. */
export function deckSlotOf(type: number): number {
  return (CARRIER_AIR_TYPES as readonly string[]).indexOf(AIR_TYPES[type]);
}

/**
 * Spec §13.4: what a carrier wing flies today: its carrier's deck of its
 * type while the carrier is out on its mission in the wing's zone, else
 * null (sunk, docked, moving or gone elsewhere).
 */
export function carrierWingDeck(air: WwAir, d: Deployment): number[] | null {
  const navy = air.navy;
  const r = navy.ships.rowOf(-d.base);
  const slot = deckSlotOf(d.type);
  if (r < 0 || slot < 0) return null;
  const f = navy.fleets.get(navy.ships.fleet[r]);
  if (
    f === undefined ||
    f.docked !== 0 ||
    !FLYING_STATES.has(f.state) ||
    air.ww.scenario.zoneSr(f.zone) !== d.sr
  ) {
    return null;
  }
  const deck = navy.ships.deckOf(r);
  return [deck[slot * 3], deck[slot * 3 + 1], deck[slot * 3 + 2]];
}

/**
 * P6 (lane E): the design planes a carrier wing flies today, per design
 * slot (the deck's design planes of its type): null when its carrier does
 * not fly (carrierWingDeck) or carries none.
 */
export function carrierWingDeckD(air: WwAir, d: Deployment): number[] | null {
  const r = air.navy.ships.rowOf(-d.base);
  if (r < 0 || carrierWingDeck(air, d) === null) return null;
  return deckDesignCounts(air.ww.depth, d.owner, r, AIR_TYPES[d.type]);
}

/**
 * A carrier wing's losses off its carrier's deck (the record mirrors the
 * deck): `gens` per generation of its type, P6 (lane E) `slots` per
 * design slot off the deck's design planes.
 */
export function takeOffDeck(
  air: WwAir,
  d: Deployment,
  gens: readonly number[],
  slots: readonly number[] | null,
): void {
  const navy = air.navy;
  const r = navy.ships.rowOf(-d.base);
  const slot = deckSlotOf(d.type);
  if (r < 0 || slot < 0) return;
  const deck = navy.ships.deckOf(r);
  gens.forEach((c, g) => {
    deck[slot * 3 + g] = Math.max(0, deck[slot * 3 + g] - c);
  });
  if (slots !== null) {
    const deckD = navy.ships.deckDOf(r);
    slots.forEach((c, s) => {
      deckD[s] = Math.max(0, deckD[s] - c);
    });
  }
  navy.markFleet(navy.ships.fleet[r]);
}

/** P6 (lane E): a design slot's stock key. */
const designKey = (slot: number) => equipKey("plane_design", slot);

/** P6 (lane E): moves up to `n` planes of design slot `slot` from the stock onto the deployed ledger. */
function drawDesignSlot(ce: CountryEconomy, slot: number, n: number): number {
  const k = designKey(slot);
  const take = Math.max(0, Math.min(n, ce.stock[k]));
  ce.stock[k] -= take;
  ce.planesDeployed[k] += take;
  return take;
}

/** The planes of P4 type `type` in `owner`'s stock: its generations and (P6) its designs flying as it. */
function stockOf(
  air: WwAir,
  ce: CountryEconomy,
  owner: number,
  type: number,
): number {
  const t = AIR_TYPES[type];
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) n += ce.stock[equipKey(t, g)];
  for (const s of designSlotsFor(air.ww.depth, owner, t)) {
    n += ce.stock[designKey(s)];
  }
  return n;
}

/** A group's land-based records, by id. */
function groupOf(
  air: WwAir,
  owner: number,
  sr: number,
  type: number,
  mission: number,
  volunteerFor: number,
): Deployment[] {
  const out: Deployment[] = [];
  for (const id of air.deploymentsIn(sr)) {
    const d = air.deployments.get(id)!;
    if (
      d.owner === owner &&
      d.type === type &&
      d.mission === mission &&
      d.volunteerFor === volunteerFor &&
      !isCarrierWing(d)
    ) {
      out.push(d);
    }
  }
  return out;
}

/** The land-based records of a country (WW_MAX_DEPLOYMENTS counts these). */
function recordsUsed(air: WwAir, owner: number): number {
  let n = 0;
  for (const d of air.deployments.values()) {
    if (d.owner === owner && !isCarrierWing(d)) n++;
  }
  return n;
}

/**
 * Derived (Task 15's perf pass): the regions with an air base, ascending,
 * until a building changes — basesInRange scanned every region on each
 * call.
 */
const baseRegionsMemo = new WeakMap<WwAir, { ver: number; list: number[] }>();

function airBaseRegions(air: WwAir): readonly number[] {
  const ver = air.econ.buildVer;
  const hit = baseRegionsMemo.get(air);
  if (hit !== undefined && hit.ver === ver) return hit.list;
  const levels = air.econ.buildingArray("air_base");
  const list: number[] = [];
  for (let r = 1; r < levels.length; r++) if (levels[r] !== 0) list.push(r);
  baseRegionsMemo.set(air, { ver, list });
  return list;
}

/**
 * Spec §13.3: the working air bases `side` controls whose center is within
 * `rangeKm` of zone `sr`, nearest first (ties: the smaller region),
 * whatever room they have left.
 */
export function basesInRange(
  air: WwAir,
  side: number,
  sr: number,
  rangeKm: number,
): { base: number; km: number }[] {
  const sc = air.ww.scenario;
  const land = air.land;
  const levels = air.econ.buildingArray("air_base");
  const out: { base: number; km: number }[] = [];
  for (const r of airBaseRegions(air)) {
    if (levels[r] === 0 || sc.region(r) === undefined) continue;
    const c = land.controller[r] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    if (air.baseCapacity(r) <= 0) continue;
    const km = sc.srKm(r, sr);
    if (km <= rangeKm) out.push({ base: r, km });
  }
  out.sort((a, b) => a.km - b.km || a.base - b.base);
  return out;
}

/** The longest range among the generations a country has of `type` (stock or in `group`); generation 1's with none. */
function bestRange(
  air: WwAir,
  owner: number,
  ce: CountryEconomy,
  type: number,
  group: readonly Deployment[],
): number {
  const t = AIR_TYPES[type];
  let best = air.planeStatsOf(owner, t, 1).rangeKm;
  for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) {
    const has =
      ce.stock[equipKey(t, g)] > 0 || group.some((d) => d.counts[g - 1] > 0);
    if (has) best = Math.max(best, air.planeStatsOf(owner, t, g).rangeKm);
  }
  // P6 (lane E): the design slots flying as the type, in stock or out.
  const depth = air.ww.depth;
  for (const s of designSlotsFor(depth, owner, t)) {
    const has =
      ce.stock[designKey(s)] > 0 || group.some((d) => d.dcounts[s - 1] > 0);
    const km = has ? (designPlaneP4(depth, owner, s, t)?.rangeKm ?? 0) : 0;
    best = Math.max(best, km);
  }
  return best;
}

/** The group's record at `base`, or a new one (null at the record cap). */
function recordAt(
  air: WwAir,
  group: Deployment[],
  proto: GroupProto,
  base: number,
): Deployment | null {
  const hit = group.find((d) => d.base === base);
  if (hit !== undefined) return hit;
  // An empty record waiting on base 0 takes the first base it finds.
  const waiting = group.find((d) => d.base === 0 && deploymentPlanes(d) === 0);
  if (waiting !== undefined) {
    air.setDeploymentBase(waiting, base);
    return waiting;
  }
  if (recordsUsed(air, proto.owner) >= WW_MAX_DEPLOYMENTS) return null;
  const d = air.addDeployment({
    ...proto,
    counts: new Array<number>(EQUIPMENT_GENS[AIR_TYPES[proto.type]]).fill(0),
    base,
    lossRest: 0,
  });
  group.push(d);
  return d;
}

/** P6 (lane E): a source's range (a generation's P4 range, a design's own). */
function sourceRange(
  air: WwAir,
  owner: number,
  t: (typeof AIR_TYPES)[number],
  x: { gen: number; slot: number },
): number {
  return x.slot === 0
    ? air.planeStatsOf(owner, t, x.gen).rangeKm
    : (designPlaneP4(air.ww.depth, owner, x.slot, t)?.rangeKm ?? 0);
}

/**
 * Spec §13.2–§13.3: places up to `need` planes of the group from the stock,
 * the newest generation first, each generation into the bases in its range
 * nearest first while they have room (one record a base). P6 (lane E,
 * spec §5.2.4): the design slots flying as the type join the order by
 * year (planeSources) and fill `dcounts`, each from its own slot.
 */
function placeFromStock(
  air: WwAir,
  ce: CountryEconomy,
  group: Deployment[],
  proto: GroupProto,
  side: number,
  need: number,
): void {
  const t = AIR_TYPES[proto.type];
  for (const x of planeSources(air.ww.depth, proto.owner, t)) {
    if (need <= 0) break;
    const k = x.slot === 0 ? equipKey(t, x.gen) : designKey(x.slot);
    if (ce.stock[k] <= 0) continue;
    const range = sourceRange(air, proto.owner, t, x);
    for (const { base } of basesInRange(air, side, proto.sr, range)) {
      if (need <= 0 || ce.stock[k] <= 0) break;
      const room = air.baseCapacity(base) - air.baseUse(base);
      const put = Math.min(need, ce.stock[k], room);
      if (put <= 0) continue;
      const d = recordAt(air, group, proto, base);
      if (d === null) continue;
      if (x.slot === 0) {
        // The newer generations are out of stock or found no room in their
        // (longer) range, so the newest-first draw takes this generation.
        const got = drawPlanes(ce, t, put);
        got.forEach((n, i) => (d.counts[i] += n));
        need -= sum(got);
      } else {
        const got = drawDesignSlot(ce, x.slot, put);
        d.dcounts[x.slot - 1] += got;
        need -= got;
      }
      air.markDeployment(d.id);
    }
  }
}

/** Spec §13.2: planes back to the stock, the oldest generation first, the farthest base first. */
function returnToStock(
  air: WwAir,
  ce: CountryEconomy,
  group: readonly Deployment[],
  n: number,
): void {
  if (group.length === 0 || n <= 0) return;
  const t = AIR_TYPES[group[0].type];
  const owner = group[0].owner;
  const depth = air.ww.depth;
  const sc = air.ww.scenario;
  const km = (d: Deployment) => (d.base > 0 ? sc.srKm(d.base, d.sr) : 0);
  const order = [...group].sort(
    (a, b) => km(b) - km(a) || b.base - a.base || a.id - b.id,
  );
  // P6 (lane E): the design slots at their year (oldest first, as P4's
  // generations); without design planes out, P4's order.
  const designs = group.some((d) => d.dcounts.some((c) => c > 0));
  const src = designs
    ? planeSources(depth, owner, t).reverse()
    : [...Array(EQUIPMENT_GENS[t]).keys()].map((i) => ({
        gen: i + 1,
        slot: 0,
      }));
  for (const x of src) {
    if (n <= 0) break;
    for (const d of order) {
      if (x.slot === 0) {
        const g = x.gen;
        const take = Math.min(n, d.counts[g - 1]);
        if (take <= 0) continue;
        const back = new Array<number>(d.counts.length).fill(0);
        back[g - 1] = take;
        d.counts[g - 1] -= take;
        returnPlanes(ce, t, back);
        n -= take;
      } else {
        const take = Math.min(n, d.dcounts[x.slot - 1]);
        if (take <= 0) continue;
        const back = new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0);
        back[x.slot - 1] = take;
        d.dcounts[x.slot - 1] -= take;
        returnDesignPlanes(depth, owner, back);
        n -= take;
      }
      air.markDeployment(d.id);
      if (n <= 0) break;
    }
  }
}

/**
 * Sets the group's target on every record and drops its empty records,
 * keeping one (on base 0) while the target is above 0.
 */
function settleGroup(air: WwAir, group: Deployment[], target: number): void {
  for (const d of group) {
    if (d.target !== target) {
      d.target = target;
      air.markDeployment(d.id);
    }
  }
  const empty = group.filter((d) => deploymentPlanes(d) === 0);
  const keep = target > 0 && empty.length === group.length ? empty[0] : null;
  for (const d of empty) {
    if (d === keep) {
      air.setDeploymentBase(d, 0);
      continue;
    }
    // Empty: removing it moves no plane.
    air.removeDeployment(d.id, true);
  }
}

/** Spec §13.2: brings an own group to `target` (draws or returns planes). */
function setGroupTarget(
  air: WwAir,
  owner: number,
  sr: number,
  type: number,
  mission: number,
  target: number,
): void {
  const ce = air.econ.country(owner);
  if (ce === null) return;
  const group = groupOf(air, owner, sr, type, mission, 0);
  const proto: GroupProto = {
    owner,
    sr,
    type,
    mission,
    target,
    auto: false,
    volunteerFor: 0,
  };
  let now = 0;
  for (const d of group) now += deploymentPlanes(d);
  if (now < target) {
    if (group.length === 0 && recordsUsed(air, owner) < WW_MAX_DEPLOYMENTS) {
      // The record that holds the target while it waits for room.
      group.push(
        air.addDeployment({
          ...proto,
          counts: new Array<number>(EQUIPMENT_GENS[AIR_TYPES[type]]).fill(0),
          base: 0,
          lossRest: 0,
        }),
      );
    }
    placeFromStock(air, ce, group, proto, air.land.sideOf(owner), target - now);
  } else if (now > target) {
    returnToStock(air, ce, group, now - target);
  }
  settleGroup(air, group, target);
  air.markCountry(owner);
}

/**
 * air_deploy / air_recall / air_auto (spec §13.2). The judge is engine-lib
 * airDeployBlock, the one the zone card asks; a deployment takes effect at
 * once (what fits), the rest waits for the country's day.
 */
export function issueAirOrder(
  air: WwAir,
  smallID: number,
  order: AirOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const s = air.ww.scenario.sr(order.sr);
  if (s === undefined) return "bad_zone";
  switch (order.kind) {
    case "air_deploy": {
      const ce = air.econ.country(smallID);
      if (ce === null) return "dead";
      const type = AIR_TYPES.indexOf(order.type);
      const mission = AIR_MISSIONS.indexOf(order.mission);
      const group = groupOf(air, smallID, order.sr, type, mission, 0);
      // P6 (lane E): the designs flying as the type count, in stock or out.
      let have = stockOf(air, ce, smallID, type);
      for (const d of group) have += deploymentPlanes(d);
      const range = bestRange(air, smallID, ce, type, group);
      const block = airDeployBlock({
        sr: order.sr,
        srKind: s.kind,
        type: order.type,
        mission: order.mission,
        count: order.count,
        have,
        // A group already out only changes its count.
        deploymentsUsed: group.length > 0 ? 0 : recordsUsed(air, smallID),
        anyBaseInRange:
          basesInRange(air, air.land.sideOf(smallID), order.sr, range).length >
          0,
      });
      if (block !== null) return block;
      setGroupTarget(air, smallID, order.sr, type, mission, order.count);
      return null;
    }
    case "air_recall": {
      const type =
        order.type === undefined ? -1 : AIR_TYPES.indexOf(order.type);
      const groups = new Map<number, Deployment>();
      for (const id of air.deploymentsIn(order.sr)) {
        const d = air.deployments.get(id)!;
        if (d.owner !== smallID || d.volunteerFor !== 0 || isCarrierWing(d)) {
          continue;
        }
        if (type >= 0 && d.type !== type) continue;
        const key = d.type * 100 + d.mission;
        if (!groups.has(key)) groups.set(key, d);
      }
      for (const d of groups.values()) {
        setGroupTarget(air, smallID, order.sr, d.type, d.mission, 0);
      }
      return null;
    }
    case "air_auto": {
      const c = air.country(smallID);
      if (c === null) return "dead";
      const zones = c.autoZones.filter((z) => z !== order.sr);
      if (order.on) zones.push(order.sr);
      c.autoZones = zones.sort((a, b) => a - b);
      return null;
    }
  }
}

/**
 * Spec §13.3: a base lost to the other side or short of room (bomb
 * damage): the country's planes over its room go to its other bases in
 * range, the rest back to the stock (never lost).
 */
function rebase(air: WwAir, owner: number, ce: CountryEconomy): void {
  const land = air.land;
  const depth = air.ww.depth;
  const own = air
    .deploymentsOf(owner)
    .filter((d) => d.base > 0 && deploymentPlanes(d) > 0);
  for (const d of own) {
    const base = d.base;
    const c = land.controller[base] ?? 0;
    const lost = c === 0 || land.sideOf(c) !== deploymentSide(air, d);
    const all = deploymentPlanes(d);
    const over = lost
      ? all
      : Math.min(all, air.baseUse(base) - air.baseCapacity(base));
    if (over <= 0) continue;
    // The planes leaving: the oldest first (the newest keep the farthest
    // reach); P6 (lane E): the design slots at their year.
    const t = AIR_TYPES[d.type];
    const out = oldestFirst(depth, owner, t, d.counts, d.dcounts, over);
    const leaving = out.gens;
    leaving.forEach((n, i) => (d.counts[i] -= n));
    const leavingD = out.slots;
    leavingD?.forEach((n, s) => (d.dcounts[s] -= n));
    air.markDeployment(d.id);
    const group = groupOf(air, owner, d.sr, d.type, d.mission, d.volunteerFor);
    const proto: GroupProto = {
      owner,
      sr: d.sr,
      type: d.type,
      mission: d.mission,
      target: d.target,
      auto: d.auto,
      volunteerFor: d.volunteerFor,
    };
    const side = deploymentSide(air, d);
    const back = new Array<number>(d.counts.length).fill(0);
    const backD = new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0);
    // Newest first, each source in its own range (P4: generation by generation).
    const src =
      leavingD === null
        ? [...Array(leaving.length).keys()]
            .reverse()
            .map((i) => ({ gen: i + 1, slot: 0 }))
        : planeSources(depth, owner, t);
    for (const x of src) {
      let n = x.slot === 0 ? leaving[x.gen - 1] : leavingD![x.slot - 1];
      if (n <= 0) continue;
      const range = sourceRange(air, owner, t, x);
      for (const { base: b } of basesInRange(air, side, d.sr, range)) {
        if (n <= 0) break;
        if (b === base) continue;
        const put = Math.min(n, air.baseCapacity(b) - air.baseUse(b));
        if (put <= 0) continue;
        const to = recordAt(air, group, proto, b);
        if (to === null) continue;
        if (x.slot === 0) to.counts[x.gen - 1] += put;
        else to.dcounts[x.slot - 1] += put;
        air.markDeployment(to.id);
        n -= put;
      }
      if (x.slot === 0) back[x.gen - 1] = n;
      else backD[x.slot - 1] = n;
    }
    // A design slot no longer flying as the type: back to the stock.
    leavingD?.forEach((n, s) => {
      if (n > 0 && !src.some((x) => x.slot === s + 1)) backD[s] += n;
    });
    if (sum(back) > 0) returnPlanes(ce, t, back);
    if (sum(backD) > 0) returnDesignPlanes(depth, owner, backD);
    settleGroup(air, group, d.target);
  }
}

/** Spec §13.2 "매일 채우기": every group short of its target draws from the stock. */
function refill(air: WwAir, owner: number, ce: CountryEconomy): void {
  const seen = new Set<string>();
  for (const d of air.deploymentsOf(owner)) {
    if (isCarrierWing(d)) continue;
    const key = `${d.sr}:${d.type}:${d.mission}:${d.volunteerFor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groupOf(air, owner, d.sr, d.type, d.mission, d.volunteerFor);
    let now = 0;
    for (const x of group) now += deploymentPlanes(x);
    if (now >= d.target) continue;
    // P6 (lane E): the designs flying as the type refill it too.
    if (stockOf(air, ce, owner, d.type) === 0) continue;
    const proto: GroupProto = {
      owner,
      sr: d.sr,
      type: d.type,
      mission: d.mission,
      target: d.target,
      auto: d.auto,
      volunteerFor: d.volunteerFor,
    };
    placeFromStock(
      air,
      ce,
      group,
      proto,
      deploymentSide(air, d),
      d.target - now,
    );
    settleGroup(air, group, d.target);
  }
}

/** Whether `owner`'s side has spotted an enemy fleet in sea region `sr` (N1's spotting). */
function spottedEnemyIn(air: WwAir, owner: number, sr: number): boolean {
  const navy = air.navy;
  const i = air.ww.scenario.srIdxOf(sr);
  if (i < 0) return false;
  const spot = navy.srState[i].spot.get(air.land.sideOf(owner));
  if (spot === undefined) return false;
  for (const [fleet, pm] of spot) {
    if (pm < WW_SPOT_FULL_PM) continue;
    const f = navy.fleets.get(fleet);
    if (f !== undefined && air.land.isEnemy(owner, f.owner)) return true;
  }
  return false;
}

/**
 * Spec §13.4: the carrier wings. Every carrier out on its mission puts its
 * deck in the air over its sea region: carrier fighters on air
 * superiority, the others on naval strike when our side has spotted an
 * enemy fleet there, else on naval patrol. The records mirror the decks.
 */
function carrierWings(air: WwAir, owner: number): void {
  const navy = air.navy;
  const t = navy.ships;
  const sc = air.ww.scenario;
  const want = new Map<
    string,
    {
      ship: number;
      sr: number;
      type: number;
      mission: number;
      counts: number[];
      /** P6 (lane E): the deck's design planes of the type, per slot. */
      dcounts: number[] | null;
    }
  >();
  for (const f of navy.fleetsOf(owner)) {
    if (f.docked !== 0 || !FLYING_STATES.has(f.state)) continue;
    const sr = sc.zoneSr(f.zone);
    if (sr === 0) continue;
    let strike: boolean | null = null;
    for (const ship of f.ships) {
      const r = t.rowOf(ship);
      if (r < 0 || t.cls[r] !== CV) continue;
      const deck = t.deckOf(r);
      CARRIER_AIR_TYPES.forEach((ct, slot) => {
        const counts = [deck[slot * 3], deck[slot * 3 + 1], deck[slot * 3 + 2]];
        const dcounts = deckDesignCounts(air.ww.depth, owner, r, ct);
        if (sum(counts) === 0 && dcounts === null) return;
        let mission = MISSION_SUP;
        if (ct !== "cv_fighter") {
          strike ??= spottedEnemyIn(air, owner, sr);
          mission = strike ? MISSION_STRIKE : MISSION_PATROL;
        }
        const type = AIR_TYPES.indexOf(ct);
        want.set(`${ship}:${type}`, {
          ship,
          sr,
          type,
          mission,
          counts,
          dcounts,
        });
      });
    }
  }
  for (const d of air.deploymentsOf(owner)) {
    if (!isCarrierWing(d)) continue;
    const key = `${-d.base}:${d.type}`;
    const w = want.get(key);
    if (w === undefined || w.sr !== d.sr) {
      // The deck keeps its planes: the record goes without touching the stock.
      d.counts.fill(0);
      d.dcounts.fill(0);
      air.removeDeployment(d.id, true);
      continue;
    }
    want.delete(key);
    const wd = w.dcounts;
    if (
      d.mission !== w.mission ||
      d.counts.some((c, i) => c !== w.counts[i]) ||
      d.dcounts.some((c, s) => c !== (wd?.[s] ?? 0))
    ) {
      d.mission = w.mission;
      d.counts = [...w.counts];
      if (wd !== null) d.dcounts = [...wd];
      else d.dcounts.fill(0);
      d.target = sum(w.counts) + (wd === null ? 0 : sum(wd));
      air.markDeployment(d.id);
    }
  }
  const rest = [...want.values()].sort(
    (a, b) => a.ship - b.ship || a.type - b.type,
  );
  for (const w of rest) {
    air.addDeployment({
      owner,
      sr: w.sr,
      type: w.type,
      mission: w.mission,
      counts: w.counts,
      target: sum(w.counts) + (w.dcounts === null ? 0 : sum(w.dcounts)),
      base: -w.ship,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
      ...(w.dcounts === null ? {} : { dcounts: w.dcounts }),
    });
  }
}

/**
 * The country's air day (spec §13.2–§13.4): ① re-basing off lost or
 * bombed bases, ② refills from the stock, ③ the docked carriers' decks
 * (N2's fillDecks), ④ the wings of the carriers at sea. It also opens
 * tomorrow's slot of its 30-day shot-down and lost tallies.
 */
export function dailyAirCountry(
  air: WwAir,
  smallID: number,
  day: number,
): void {
  const ce = air.econ.country(smallID);
  const c = air.country(smallID);
  if (ce === null || c === null) return;
  const next = (((day + 1) % 30) + 30) % 30;
  c.tally[0][next] = 0;
  c.tally[1][next] = 0;
  rebase(air, smallID, ce);
  refill(air, smallID, ce);
  fillDecks(air.navy, smallID);
  carrierWings(air, smallID);
}
