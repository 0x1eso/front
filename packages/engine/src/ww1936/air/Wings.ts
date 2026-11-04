// World War 1936 air overhaul (ww8), lane A: forming wings, refills, bases,
// field strips (design §3.1, §3.2). WwAir's tickWings and issueWingOrder
// call these in the wing model only.
import {
  AIR_TYPES,
  WING_FERRY_REST,
  WING_FORM_FRONT_KM,
  WING_NO_MISSION,
  WING_OVERRUN_LOSS_PCT,
  WING_REFORM_COOLDOWN_DAYS,
  WING_UPGRADE_PER_REARM,
  WP_BACK,
  WP_FERRY,
  WP_GROUND,
  WP_OUT,
  WP_STATION,
  WW_CAPTURED_BASE_DAMAGE_PM,
  WW_FIELD_STRIP_DAYS,
  WW_FIELD_STRIP_EFF_PM,
  WW_FIELD_STRIP_MAX,
  WW_MAX_WINGS,
  WW_WING_FORM_MIN,
  WW_WING_REFILL_PCT,
  WW_WING_RESERVE_MIN,
  WW_WING_RESERVE_PCT,
  type AirBaseUse,
  type Wing,
  type WingOrder,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  EQUIPMENT_GENS,
  equipKey,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { borderRegionsOf } from "@openfront/engine-lib/ww1936/FrontRules";
import {
  ferryTicks,
  wingFullOf,
  wingMaxPlanes,
  wingOrderBlock,
  xpAfterRefill,
} from "@openfront/engine-lib/ww1936/WingRules";
import { damageBuilding, damageOf } from "../economy/Buildings";
import type { CountryEconomy } from "../economy/WwEconomy";
import { fillDecks } from "../navy/Carriers";
import {
  airBaseRegions,
  carrierWings,
  deckSlotOf,
  drawDesignSlot,
  isCarrierWing,
  stockOf,
} from "./Deploy";
import { planeSources, swapOldPlanes } from "./DesignPlanes";
import { dailyGroups } from "./Groups";
import { noteWingRest } from "./WingXp";
import { deploymentStats, wingPlanes, wingSide, type WwAir } from "./WwAir";

/** WW_FIELD_STRIP_DAYS in ticks (a day is 7.5 ticks). */
const STRIP_TICKS = Math.floor((WW_FIELD_STRIP_DAYS * 15) / 2);

const AIRBORNE: ReadonlySet<number> = new Set([WP_OUT, WP_STATION, WP_BACK]);

// ---- Bases ----

/** Air bases and field strips (ready or not), ascending. */
function baseRegions(air: WwAir): number[] {
  const out = [...airBaseRegions(air)];
  if (air.strips.size === 0) return out;
  const have = new Set(out);
  for (const r of air.strips.keys()) if (!have.has(r)) out.push(r);
  return out.sort((a, b) => a - b);
}

/** A wing's own full size. */
export const wingFullSize = (w: Wing): number =>
  wingFullOf(AIR_TYPES[w.type], w.fullMax);

const baseLevel = (air: WwAir, region: number): number =>
  air.econ.buildingArray("air_base")[region] ?? 0;

/** The bases `side` controls that can be used (not bombed out), ascending. */
export function sideBases(air: WwAir, side: number): number[] {
  const land = air.land;
  const out: number[] = [];
  for (const r of baseRegions(air)) {
    const c = land.controller[r] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    if (air.baseUsable(r)) out.push(r);
  }
  return out;
}

/**
 * The base for a new wing: the usable one nearest by `dist` (ties: the
 * smaller region), 0 with none. A base holds any number of planes (w50).
 */
function pickBase(
  bases: readonly number[],
  dist: (region: number) => number,
): number {
  let best = 0;
  let bestKm = 0;
  for (const r of bases) {
    const km = dist(r);
    if (best === 0 || km < bestKm) {
      best = r;
      bestKm = km;
    }
  }
  return best;
}

const capitalKm = (air: WwAir, owner: number) => {
  const capital = air.ww.capitalRegion(owner);
  return (region: number) =>
    capital > 0 ? air.ww.scenario.regionKm(capital, region) : 0;
};

/**
 * Km from a base to where the country's war is: its side's regions touching an
 * enemy, or with no land front (an island at war) the enemy's own regions. Only
 * those within WING_FORM_FRONT_KM of the capital count, or with none the nearest
 * to it, so an ally's war on another continent doesn't draw the wing away. Null
 * in peace.
 */
function frontKm(
  air: WwAir,
  owner: number,
): ((region: number) => number) | null {
  const land = air.land;
  const sc = air.ww.scenario;
  let front = borderRegionsOf(land, owner, 0);
  if (front.length === 0) {
    front = sc.landRegions
      .map((r) => r.id)
      .filter((r) => land.isEnemy(owner, land.controller[r] ?? 0));
  }
  if (front.length === 0) return null;
  const capital = air.ww.capitalRegion(owner);
  if (capital > 0) {
    const near = front.filter(
      (f) => sc.regionKm(capital, f) <= WING_FORM_FRONT_KM,
    );
    if (near.length > 0) {
      front = near;
    } else {
      let best = front[0];
      for (const f of front) {
        if (sc.regionKm(capital, f) < sc.regionKm(capital, best)) best = f;
      }
      front = [best];
    }
  }
  return (region) => {
    let best = Number.MAX_SAFE_INTEGER;
    for (const f of front) best = Math.min(best, sc.regionKm(region, f));
    return best;
  };
}

/**
 * The base a wing leaving `from` goes to: the nearest usable base of its side
 * (ties: the smaller region), 0 with none.
 */
function nearestOpenBase(air: WwAir, w: Wing, from: number): number {
  const sc = air.ww.scenario;
  let best = 0;
  let bestKm = 0;
  for (const r of sideBases(air, wingSide(air, w))) {
    if (r === from) continue;
    const km = sc.regionKm(from, r);
    if (best === 0 || km < bestKm) {
      best = r;
      bestKm = km;
    }
  }
  return best;
}

// ---- Planes ----

/**
 * Draws up to `n` planes from the owner's stock into a wing, the newest
 * year first (design planes at their year); returns the planes drawn.
 */
export function drawInto(
  air: WwAir,
  ce: CountryEconomy,
  w: Wing,
  n: number,
): number {
  const t = AIR_TYPES[w.type];
  let left = n;
  for (const x of planeSources(air.ww.depth, w.owner, t)) {
    if (left <= 0) break;
    if (x.slot === 0) {
      const k = equipKey(t, x.gen);
      const take = Math.min(left, ce.stock[k]);
      if (take <= 0) continue;
      ce.stock[k] -= take;
      ce.planesDeployed[k] += take;
      w.counts[x.gen - 1] += take;
      left -= take;
    } else {
      const got = drawDesignSlot(ce, x.slot, left);
      w.dcounts[x.slot - 1] += got;
      left -= got;
    }
  }
  if (left < n) air.markWing(w.id);
  return n - left;
}

/**
 * Swaps up to `n` of the wing's old planes (more than TANK_OLD_PCT below
 * the best score of the type the country can field) for non-old planes in
 * stock, generations and design planes alike (planeRankOf), the old going
 * back to the stock; returns the planes swapped. A type with no old source
 * costs one memo read.
 */
function swapOld(air: WwAir, ce: CountryEconomy, w: Wing, n: number): number {
  const swapped = swapOldPlanes(
    air.ww.depth,
    ce,
    w.owner,
    AIR_TYPES[w.type],
    n,
    (x) => (x.slot === 0 ? w.counts[x.gen - 1] : w.dcounts[x.slot - 1]) ?? 0,
    (x, k) => {
      if (x.slot === 0) w.counts[x.gen - 1] += k;
      else w.dcounts[x.slot - 1] += k;
    },
  );
  if (swapped > 0) air.markWing(w.id);
  return swapped;
}

/** Fills a wing from the stock: at most `limit` planes. Returns the planes added. */
function refillWing(
  air: WwAir,
  ce: CountryEconomy,
  w: Wing,
  limit: number,
): number {
  const need = Math.min(limit, wingFullSize(w) - wingPlanes(w));
  if (need <= 0 || w.base <= 0) return 0;
  return drawInto(air, ce, w, need);
}

// ---- Forming ----

/**
 * Forms the country's new wings (design §3.1): per land type, while the
 * stock above the reserve (10 %, at least 50) fills a wing, or, for a type
 * with no wing at all, holds WW_WING_FORM_MIN. A disbanded type waits out
 * WING_REFORM_COOLDOWN_DAYS. A new wing goes to the base with room nearest
 * the front, and in peace nearest the capital: the country's own bases first,
 * then its side's.
 */
export function formWings(air: WwAir, owner: number, day: number): void {
  const c = air.country(owner);
  const ce = air.econ.country(owner);
  if (c === null || ce === null) return;
  const side = air.land.sideOf(owner);
  let bases: number[] | null = null;
  let own: number[] | null = null;
  let near: ((region: number) => number) | null = null;
  let count = 0;
  for (const w of air.wingsOf(owner)) if (!isCarrierWing(w)) count++;
  for (let ti = 0; ti < AIR_TYPES.length && count < WW_MAX_WINGS; ti++) {
    if (deckSlotOf(ti) >= 0 || day < c.reformDay[ti]) continue;
    const t = AIR_TYPES[ti];
    const max = wingMaxPlanes(t);
    let has = false;
    let inWings = 0;
    for (const w of air.wingsOf(owner)) {
      if (w.type !== ti || isCarrierWing(w) || w.volunteerFor !== 0) continue;
      has = true;
      inWings += wingPlanes(w);
    }
    let stock = stockOf(air, ce, owner, ti);
    const reserve = Math.max(
      WW_WING_RESERVE_MIN,
      Math.floor(((stock + inWings) * WW_WING_RESERVE_PCT) / 100),
    );
    while (count < WW_MAX_WINGS) {
      const free = stock - reserve;
      const need =
        free >= max ? max : !has && free >= WW_WING_FORM_MIN ? free : 0;
      if (need < WW_WING_FORM_MIN) break;
      bases ??= sideBases(air, side);
      near ??= frontKm(air, owner) ?? capitalKm(air, owner);
      own ??= bases.filter((r) => air.land.controller[r] === owner);
      let base = pickBase(own, near);
      if (base === 0) {
        // An ally's base only near the war (or with no base of its own: an exile).
        base = pickBase(
          own.length === 0
            ? bases
            : bases.filter((r) => near!(r) <= WING_FORM_FRONT_KM),
          near,
        );
      }
      if (base === 0) break;
      const no = c.nextWingNo[ti];
      const w = air.addWing({
        owner,
        type: ti,
        counts: new Array<number>(EQUIPMENT_GENS[t]).fill(0),
        base,
        nameNo: no,
        auto: air.ww.autoOn(owner, "air"),
      });
      c.nextWingNo[ti] = no + 1;
      air.markCountry(owner);
      const got = drawInto(air, ce, w, need);
      stock -= got;
      count++;
      has = true;
      if (got === 0) break;
    }
  }
}

/**
 * The country's turn (WwAir calls it on its id's day tick, for a country
 * that plays): the 30-day tally slots, the decks and carrier wings, the
 * wings' "yesterday" counters, a rested wing's refill, then forming.
 */
export function dailyWingCountry(
  air: WwAir,
  smallID: number,
  day: number,
): void {
  const c = air.country(smallID);
  if (c === null) return;
  const next = (((day + 1) % 30) + 30) % 30;
  c.tally[0][next] = 0;
  c.tally[1][next] = 0;
  fillDecks(air.navy, smallID);
  carrierWings(air, smallID);
  const ce = air.econ.country(smallID);
  dailyGroups(air, smallID, day);
  for (const w of air.wingsOf(smallID)) {
    if (w.base < 0) {
      if (w.nameNo === 0) {
        w.nameNo = c.nextWingNo[w.type]++;
        air.markWing(w.id);
      }
      noteWingRest(air, w, day);
      continue;
    }
    if (
      w.dayKills !== 0 ||
      w.dayLost !== 0 ||
      w.prevKills !== 0 ||
      w.prevLost !== 0
    ) {
      w.prevKills = w.dayKills;
      w.prevLost = w.dayLost;
      w.dayKills = 0;
      w.dayLost = 0;
      air.markWing(w.id);
    }
    if (w.phase === WP_GROUND && ce !== null) {
      const had = wingPlanes(w);
      const added = refillWing(air, ce, w, Number.MAX_SAFE_INTEGER);
      if (added > 0) w.xpMilli = xpAfterRefill(w.xpMilli, had, added);
    }
    noteWingRest(air, w, day); // lane D filters by phase
  }
  // A human's own wings stop forming once it has saved a template: the
  // templates draw the planes (w50).
  if (
    ce !== null &&
    !(c.templates.length > 0 && air.ww.isHumanControlled(smallID))
  ) {
    formWings(air, smallID, day);
  }
}

/** The start of the game (WwAir.start): every country forms its wings. */
export function formStartWings(air: WwAir): void {
  for (const c of air.countries()) {
    const p = air.mg.playerBySmallID(c.smallID);
    if (!p.isPlayer() || !air.ww.isActor(c.smallID)) continue;
    formWings(air, c.smallID, 0);
  }
}

/** A wing entering `rearm` (lane B calls it): refill and swap for newer planes. */
export function rearmWing(air: WwAir, w: Wing, tick: number): void {
  void tick;
  const ce = air.econ.country(w.owner);
  if (ce === null || w.base <= 0) return;
  const had = wingPlanes(w);
  const full = wingFullSize(w);
  const added = refillWing(
    air,
    ce,
    w,
    Math.floor((full * WW_WING_REFILL_PCT) / 100),
  );
  const swapped = swapOld(air, ce, w, WING_UPGRADE_PER_REARM);
  if (added + swapped > 0) {
    w.xpMilli = xpAfterRefill(w.xpMilli, had - swapped, added + swapped);
  }
}

/**
 * The base's share of a take-off's efficiency, ‰: WW_FIELD_STRIP_EFF_PM on a
 * strip, else 1000 (no capacity limit; the bomb damage is sortieEffPm's own
 * argument, WwAir.baseDamagePm).
 */
export function wingBaseEffPm(air: WwAir, w: Wing): number {
  if (w.base <= 0) return 1000;
  return baseLevel(air, w.base) === 0 && air.strips.has(w.base)
    ? WW_FIELD_STRIP_EFF_PM
    : 1000;
}

// ---- Moving, disbanding, strips ----

/** Sends a wing to `to`: breaks off any sortie, ferries, rests WING_FERRY_REST. */
function startFerry(air: WwAir, w: Wing, to: number, tick: number): void {
  const from = w.base;
  const km = from > 0 ? air.ww.scenario.regionKm(from, to) : 0;
  const ticks = ferryTicks(km, deploymentStats(air, w).speedKmh);
  w.phase = WP_FERRY;
  w.until = tick + ticks + WING_FERRY_REST;
  w.flyMilli = 0;
  w.leg = 0;
  w.hit = from;
  w.flySr = 0;
  w.flyMission = WING_NO_MISSION;
  w.lastFerryDay = air.ww.day(tick);
  air.setWingBase(w, to);
  air.markWing(w.id);
  // The row's target is the wing's hit, as on any flight: here the base it
  // left. Where it goes is the wing's base.
  air.noteFlight([
    w.id,
    WP_FERRY,
    w.until,
    ticks,
    0,
    WING_FERRY_REST,
    from,
    wingPlanes(w),
  ]);
}

/** Sends a grounded wing to `to` (a group's base): the same ferry as wing_base. */
export function ferryWing(air: WwAir, w: Wing, to: number, tick: number): void {
  startFerry(air, w, to, tick);
}

/** The base a group forms at: the owner's usable base nearest its front (the capital in peace). */
export function homeBase(air: WwAir, owner: number): number {
  const bases = sideBases(air, air.land.sideOf(owner));
  const own = bases.filter((r) => air.land.controller[r] === owner);
  const near = frontKm(air, owner) ?? capitalKm(air, owner);
  return pickBase(own.length > 0 ? own : bases, near);
}

/** wing_base: ferry the named wings to a base of their side with room for all of them. */
export function issueWingBase(
  air: WwAir,
  smallID: number,
  wings: readonly Wing[],
  order: Extract<WingOrder, { kind: "wing_base" }>,
  tick: number,
): WwOrderBlock | null {
  void smallID;
  const land = air.land;
  const region = order.base;
  const isBase = air.baseUsable(region);
  const ctl = land.controller[region] ?? 0;
  const moving: Wing[] = [];
  for (const w of wings) {
    if (w.base === region) continue;
    const planes = wingPlanes(w);
    const block = wingOrderBlock({
      order: "base",
      carrier: w.base < 0,
      isBase,
      ownSide: ctl !== 0 && land.sideOf(ctl) === wingSide(air, w),
      room: Number.MAX_SAFE_INTEGER,
      planes,
    });
    if (block !== null) return block;
    moving.push(w);
  }
  for (const w of moving) startFerry(air, w, region, tick);
  return null;
}

/** wing_disband: the planes go back to the stock; the type forms no new wing for a while. */
export function issueWingDisband(
  air: WwAir,
  smallID: number,
  wing: Wing,
  tick: number,
): WwOrderBlock | null {
  if (wing.base < 0) return "bad_air_mission";
  const c = air.country(smallID);
  if (c === null) return "dead";
  c.reformDay[wing.type] = air.ww.day(tick) + WING_REFORM_COOLDOWN_DAYS;
  air.removeWing(wing.id, true);
  return null;
}

/** An own division stands in the region or next to it. */
function armyNear(air: WwAir, owner: number, region: number): boolean {
  const land = air.land;
  const sc = air.ww.scenario;
  for (const r of [region, ...sc.regionNeighbours(region)]) {
    for (const row of land.rowsIn(r)) {
      if (land.divisions.owner[row] === owner) return true;
    }
  }
  return false;
}

/** air_field: a field strip on own land where an own army stands or is next to (ready in 5 days). */
export function issueAirField(
  air: WwAir,
  smallID: number,
  region: number,
  tick: number,
): WwOrderBlock | null {
  if (air.ww.scenario.region(region) === undefined) return "bad_region";
  const land = air.land;
  if ((land.controller[region] ?? 0) !== smallID) return "not_controlled";
  if (baseLevel(air, region) > 0) return "not_buildable";
  if (air.strips.has(region)) return "occupied";
  let mine = 0;
  for (const r of air.strips.keys()) if (land.controller[r] === smallID) mine++;
  if (mine >= WW_FIELD_STRIP_MAX) return "no_slots";
  if (!armyNear(air, smallID, region)) return "no_army";
  air.setStrip(region, tick + STRIP_TICKS);
  return null;
}

/**
 * A base's region changed hands (design §3.2). The strip is gone; a captured
 * air_base starts damaged. The wings there that are no longer on its side's
 * land: on the ground they lose WING_OVERRUN_LOSS_PCT and ferry to the
 * nearest base with room; in the air they land at that base; with none they
 * go back to the stock.
 */
export function onBaseControlChanged(
  air: WwAir,
  region: number,
  from: number,
  to: number,
  tick: number,
): void {
  const land = air.land;
  if (air.strips.has(region)) air.setStrip(region, -1);
  const level = baseLevel(air, region);
  if (
    level > 0 &&
    from !== 0 &&
    to !== 0 &&
    land.sideOf(from) !== land.sideOf(to)
  ) {
    const want = level * WW_CAPTURED_BASE_DAMAGE_PM;
    const have = damageOf(air.econ, region, "air_base");
    if (have < want) damageBuilding(air.econ, region, "air_base", want - have);
  }
  for (const id of [...air.wingsAtBase(region)]) {
    const w = air.wings.get(id);
    if (w === undefined) continue;
    if (to !== 0 && land.sideOf(to) === wingSide(air, w)) continue;
    if (!AIRBORNE.has(w.phase)) {
      const gens = w.counts.map((n) =>
        Math.floor((n * WING_OVERRUN_LOSS_PCT) / 100),
      );
      const designs = w.dcounts.map((n) =>
        Math.floor((n * WING_OVERRUN_LOSS_PCT) / 100),
      );
      air.shootDown(w.id, [...gens, ...designs], to);
    }
    const planes = wingPlanes(w);
    const dest = planes === 0 ? 0 : nearestOpenBase(air, w, region);
    if (dest === 0) {
      air.removeWing(w.id, true);
      if (planes > 0) {
        air.message(w.owner, "events_display.ww1936_wing_base_lost_stock", {
          region,
        });
      }
      continue;
    }
    if (AIRBORNE.has(w.phase)) air.setWingBase(w, dest);
    else startFerry(air, w, dest, tick);
    air.message(w.owner, "events_display.ww1936_wing_base_lost", { region });
  }
}

/**
 * A wing changes hands (a civil war): the new owner numbers it, its orders
 * are void and it lands (experience stays).
 */
export function handOverWing(air: WwAir, w: Wing, owner: number): void {
  air.setWingOwner(w, owner);
  const c = air.country(owner);
  if (c !== null) w.nameNo = c.nextWingNo[w.type]++;
  w.auto = false;
  w.group = 0;
  w.fullMax = 0;
  w.mission = WING_NO_MISSION;
  w.sr = 0;
  w.target = 0;
  w.follow = 0;
  w.escortOf = 0;
  w.cls = 0;
  w.phase = WP_GROUND;
  w.until = air.mg.ticks() + 1;
  w.flyMilli = 0;
  w.leg = 0;
  w.hit = 0;
  w.flySr = 0;
  w.flyMission = WING_NO_MISSION;
  air.markWing(w.id);
}

/**
 * The bases the country's screen lists: every base its side may use, with
 * or without its planes, and its ready field strips.
 */
export function baseUsesOf(air: WwAir, smallID: number): AirBaseUse[] {
  const land = air.land;
  const side = land.sideOf(smallID);
  const out: AirBaseUse[] = [];
  for (const r of baseRegions(air)) {
    const c = land.controller[r] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    const strip = baseLevel(air, r) === 0;
    if (strip && !air.baseUsable(r)) continue;
    out.push({
      region: r,
      used: air.baseUse(r),
      // w50: a base holds any number of planes; cap is no longer a limit.
      cap: 0,
      damagePm: air.baseDamagePm(r),
      ...(strip ? { strip: true } : {}),
    });
  }
  return out;
}

/**
 * air_volunteers in the wing model: `count` planes of `plane` from the
 * sender's stock form idle volunteer wings at the host side's bases nearest
 * `zone`; the sender orders them as any wing. Null when they formed.
 */
export function formVolunteerWings(
  air: WwAir,
  from: number,
  to: number,
  zone: number,
  plane: (typeof AIR_TYPES)[number],
  count: number,
): WwOrderBlock | null {
  const ce = air.econ.country(from);
  const c = air.country(from);
  if (ce === null || c === null) return "dead";
  const ti = AIR_TYPES.indexOf(plane);
  let wings = 0;
  for (const w of air.wingsOf(from)) if (!isCarrierWing(w)) wings++;
  if (wings >= WW_MAX_WINGS) return "too_many_wings";
  if (count > stockOf(air, ce, from, ti)) return "no_planes";
  const bases = sideBases(air, air.land.sideOf(to));
  const sc = air.ww.scenario;
  const max = wingMaxPlanes(plane);
  const base = pickBase(bases, (r) => sc.srKm(r, zone));
  if (base === 0) return "no_air_base";
  const plan: [number, number][] = [];
  for (let left = count; left > 0; ) {
    if (wings + plan.length >= WW_MAX_WINGS) return "too_many_wings";
    const take = Math.min(max, left);
    plan.push([base, take]);
    left -= take;
  }
  for (const [base, take] of plan) {
    const no = c.nextWingNo[ti];
    const w = air.addWing({
      owner: from,
      type: ti,
      counts: new Array<number>(EQUIPMENT_GENS[plane]).fill(0),
      base,
      volunteerFor: to,
      nameNo: no,
    });
    c.nextWingNo[ti] = no + 1;
    drawInto(air, ce, w, take);
  }
  return null;
}
