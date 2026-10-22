// World War 1936 P4: the invasion planner (P4 spec §17.4, §17.6). At war,
// every 10 days, a country with an enemy it cannot reach by land (or with
// a fifth of its divisions on no front) scores the enemy's coastal
// regions within an invasion's reach, drops those its fleets could not
// hold the route to (600‰), and readies an army for the best one: 3 to
// the invasion capacity divisions (marines first) gather in its nearest
// port and get army_invade; the navy AI covers the route (invasion
// support). Lane I sails a prepared invasion as soon as it can; one that
// stays stuck is cancelled (aiGiveUpInvasion), freeing the army for the
// next plan. After the landing the land AI carries on (its sea
// moves reach the new stretch through the captured port). The planner
// keeps no memory: the invasion records (lane I) and the armies' orders
// are its state, and it never reads another country's orders.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  MOVE_NONE,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  INVASION_STATES,
  WW_INVASION_MAX_KM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { divisionConvoys } from "@openfront/engine-lib/ww1936/ConvoyRules";
import {
  invasionCapacity,
  invasionPrepDays,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { convoysOf, effectiveLevel } from "../economy/Buildings";
import { aiSideStretches } from "../land/AiLand";
import { capitalRegion } from "../land/LandStartRun";
import { enemyDivisionsIn } from "../land/Movement";
import { divisionWeightCenti } from "../land/SeaLift";
import type { Army } from "../land/WwLand";
import {
  activeBeatTargets,
  AI_BEAT_FACTOR,
  AI_INVASION_SUP_PM,
  aiAtWar,
  aiEnemySeaView,
  aiJitterPm,
  aiSupPower,
  fleetCounts,
  fleetRole,
  fleetRows,
  seaReach,
  straitSig,
} from "./AiNavy";
import { invasionLaunchBlock } from "./Invasions";
import { navalPort, navalPortsOf } from "./Ports";
import type { WwNavy } from "./WwNavy";

/** Spec §17.4: an invasion army has at least this many divisions. */
export const AI_INVASION_MIN = 3;
/** 내 판단: an army of 3 would be merged back by the land AI's grouping (≤ 3); gather 4 or more. */
export const AI_INVASION_GATHER = 4;
/** Spec §17.4: with a land front, invade only when this share of divisions is on no front. */
export const AI_INVASION_SPARE_PCT = 20;
/** Spec §11.3: the launch needs this supremacy on every route region. */
export const AI_LAUNCH_SUP_PM = 500;
/** 내 판단: the walk to a port turns to rail beyond this (the land AI's AI_RAIL_MIN_KM). */
const RAIL_KM = 1000;

const READY = INVASION_STATES.indexOf("ready");

/** The AI's view of one invasion target (spec §17.4). */
export interface AiInvasionInput {
  target: number;
  /** The region's victory points. */
  vp: number;
  /** A working naval base. */
  port: boolean;
  /** The enemy's capital. */
  enemyCapital: boolean;
  /** An island with a naval or air base. */
  islandBase: boolean;
  /** Enemy divisions in the region and its land neighbours. */
  divisions: number;
  /** Sea km from our departure port. */
  routeKm: number;
  /** A landing history beat's window covers it (×10, spec §17.6). */
  beat?: boolean;
}

/** A scored target with the route supremacy we expect (ours ÷ the route's worst enemy). */
export interface AiInvasionCandidate extends AiInvasionInput {
  supPm: number;
}

/**
 * Pure (spec §17.4): (VP + port 5 + enemy capital 20 + island base 5) ×
 * 100 / (1 + enemy divisions × 3) / (1 + km / 1000), each step rounded
 * down; a beat ×10.
 */
export function aiInvasionScore(input: AiInvasionInput): number {
  const base =
    (input.vp +
      (input.port ? 5 : 0) +
      (input.enemyCapital ? 20 : 0) +
      (input.islandBase ? 5 : 0)) *
    100;
  const byDivisions = Math.floor(base / (1 + input.divisions * 3));
  const s = Math.floor(
    byDivisions / (1 + Math.floor(Math.max(0, input.routeKm) / 1000)),
  );
  return input.beat === true ? s * AI_BEAT_FACTOR : s;
}

/** Pure: the best target whose route we expect to hold at 600‰ (ties: the smaller region). */
export function aiInvasionPick(
  cands: readonly AiInvasionCandidate[],
): AiInvasionCandidate | null {
  let best: AiInvasionCandidate | null = null;
  let bestScore = 0;
  for (const c of cands) {
    if (c.supPm < AI_INVASION_SUP_PM) continue;
    const s = aiInvasionScore(c);
    if (s <= 0) continue;
    if (
      best === null ||
      s > bestScore ||
      (s === bestScore && c.target < best.target)
    ) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/** Spec §17.4: the expected supremacy, ours over ours plus the route's worst enemy, ‰. */
export function expectedSupPm(ours: number, enemyWorst: number): number {
  return ours <= 0 ? 0 : Math.floor((ours * 1000) / (ours + enemyWorst));
}

// ---- The engine side ----

/** The enemy's supremacy power by sea region (fleets present; docked at half). */
function enemySupBySr(navy: WwNavy, me: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const [sr, e] of aiEnemySeaView(navy, me)) out.set(sr, e.sup);
  return out;
}

/** The route's sea regions, port harbor to target harbor (null: no way). */
function routeSrs(
  navy: WwNavy,
  me: number,
  from: number,
  to: number,
): number[] | null {
  const sc = navy.scenario;
  const p = seaPath(
    sc,
    [sc.harborOf(from)],
    [sc.harborOf(to)],
    navy.passable(me, true),
  );
  if (p === null) return null;
  const out: number[] = [];
  for (const z of p.zones) {
    const sr = sc.zoneSr(z);
    if (sr !== 0 && !out.includes(sr)) out.push(sr);
  }
  return out;
}

/** An army standing still together, out of battle (its region), else 0. */
function standingRegion(navy: WwNavy, a: Army): number {
  const t = navy.land.divisions;
  let at = 0;
  for (const id of a.divisions) {
    const r = t.rowOf(id);
    if (r < 0 || t.mode[r] !== MOVE_NONE || t.battle[r] !== 0) return 0;
    if (at !== 0 && t.region[r] !== at) return 0;
    at = t.region[r];
  }
  return at;
}

/** A free army: idle (no front, plan, move, paradrop or invasion), standing still together. */
function freeArmy(navy: WwNavy, a: Army): boolean {
  return (
    a.divisions.length > 0 &&
    a.order.kind === "idle" &&
    standingRegion(navy, a) !== 0
  );
}

/** Lane AI review: a ready invasion that cannot sail is looked at again every this many days. */
export const AI_INVASION_REVIEW_DAYS = 30;

/** The review day of a country's stuck invasions (no memory: a fixed day of the cycle). */
export function aiInvasionReviewDue(smallID: number, day: number): boolean {
  return day % AI_INVASION_REVIEW_DAYS === smallID % AI_INVASION_REVIEW_DAYS;
}

/** Our battle fleets' and patrols' supremacy power (what can hold a route). */
function routePower(navy: WwNavy, me: number): number {
  let ours = 0;
  for (const f of navy.fleetsOf(me)) {
    const role = fleetRole(fleetCounts(navy, f));
    if (role === "main" || role === "patrol") {
      ours += aiSupPower(fleetRows(navy, f));
    }
  }
  return ours;
}

/**
 * Pure (lane AI review): whether a ready invasion that could not sail
 * today is given up — at once when it never will (the convoys it needs
 * exceed our whole stock, our whole navy cannot hold the route at 500‰,
 * or anything else: no war, no way, the army moved), else on the review
 * day when it is still stuck (support fleets had the preparation and up
 * to 30 days more to take the route).
 */
export function aiGiveUpInvasion(i: {
  block: WwOrderBlock;
  convoyStock: number;
  convoysNeed: number;
  expectedSupPm: number;
  reviewDay: boolean;
}): boolean {
  if (i.block === "no_convoys") {
    return i.convoyStock < i.convoysNeed || i.reviewDay;
  }
  if (i.block === "naval_supremacy_low") {
    return i.expectedSupPm < AI_LAUNCH_SUP_PM || i.reviewDay;
  }
  return true;
}

/**
 * Lane AI review: lane I sails a ready invasion as soon as it can (its
 * daily step runs before this one); one still waiting is cancelled
 * (aiGiveUpInvasion), so the army is free again and another landing can
 * be planned.
 */
function reviewReady(
  navy: WwNavy,
  me: number,
  day: number,
  tick: number,
): void {
  const ce = navy.econ.country(me);
  if (ce === null) return;
  let enemySup: Map<number, number> | null = null;
  let ours = -1;
  for (const inv of [...navy.invasions.values()]) {
    if (inv.owner !== me || inv.state !== READY) continue;
    const block = invasionLaunchBlock(navy, inv.army);
    if (block === null) continue;
    const a = navy.land.armies.get(inv.army);
    let need = 0;
    for (const id of a?.divisions ?? []) {
      need += divisionConvoys(divisionWeightCenti(navy.land, id));
    }
    let expected = 0;
    if (block === "naval_supremacy_low") {
      enemySup ??= enemySupBySr(navy, me);
      if (ours < 0) ours = routePower(navy, me);
      let worst = 0;
      for (const sr of routeSrs(navy, me, inv.from, inv.target) ?? []) {
        worst = Math.max(worst, enemySup.get(sr) ?? 0);
      }
      expected = expectedSupPm(ours, worst);
    }
    const giveUp = aiGiveUpInvasion({
      block,
      convoyStock: convoysOf(ce),
      convoysNeed: need,
      expectedSupPm: expected,
      reviewDay: aiInvasionReviewDue(me, day),
    });
    if (giveUp) {
      navy.issue(me, { kind: "invasion_cancel", army: inv.army }, tick, "ai");
    }
  }
}

/** Spec §17.1: the planning day (every 10 days at war). */
export function aiInvasionDue(smallID: number, day: number): boolean {
  return day % 10 === smallID % 10;
}

/** The country's AI day for invasions (an AI country only). */
export function aiInvasions(navy: WwNavy, smallID: number, day: number): void {
  const p = navy.mg.playerBySmallID(smallID);
  // P5 plan decision 7: a human controls it now.
  if (!p.isPlayer() || navy.ww.isHumanControlled(smallID)) return;
  const tick = navy.mg.ticks();
  reviewReady(navy, smallID, day, tick);
  if (!aiAtWar(navy, smallID)) return;
  if (!aiInvasionDue(smallID, day)) return;
  // One invasion at a time.
  for (const inv of navy.invasions.values()) if (inv.owner === smallID) return;
  const land = navy.land;
  const armies = land.armiesOf(smallID);
  if (armies.some((a) => a.order.kind === "invade")) return;
  planInvasion(navy, smallID, day, tick, armies);
}

function planInvasion(
  navy: WwNavy,
  me: number,
  day: number,
  tick: number,
  armies: readonly Army[],
): void {
  const land = navy.land;
  const ww = navy.ww;
  const sc = navy.scenario;
  // Our fleets' power that can hold a route (battle fleets and patrols).
  const ours = routePower(navy, me);
  if (ours <= 0) return;
  const enemies = ww.enemiesOf(me).filter((e) => land.isEnemy(me, e));
  const { comp } = aiSideStretches(land, me);
  // Spec §17.4: an enemy no land border reaches; else spare divisions.
  const touching = new Set<number>();
  for (const r of sc.landRegions) {
    if (comp[r.id] < 0) continue;
    for (const e of sc.edgesOf(r.id)) {
      const c = land.controller[e.to];
      if (c !== 0 && enemies.includes(c)) touching.add(c);
    }
  }
  const overseas = enemies.some((e) => !touching.has(e));
  if (!overseas) {
    let all = 0;
    let fronted = 0;
    for (const a of armies) {
      all += a.divisions.length;
      if (a.order.kind === "front" || a.order.kind === "plan") {
        fronted += a.divisions.length;
      }
    }
    if ((all - fronted) * 100 < all * AI_INVASION_SPARE_PCT) return;
  }
  // Departure ports: ours, in a stretch with free divisions to gather.
  const freeByComp = new Map<number, number>();
  for (const a of armies) {
    if (!freeArmy(navy, a)) continue;
    const c = comp[standingRegion(navy, a)] ?? -1;
    if (c >= 0)
      freeByComp.set(c, (freeByComp.get(c) ?? 0) + a.divisions.length);
  }
  const ports = navalPortsOf(ww, me).filter(
    (r) =>
      sc.harborOf(r) !== 0 &&
      !isNoStrike(sc, r) &&
      (freeByComp.get(comp[r] ?? -1) ?? 0) >= AI_INVASION_MIN,
  );
  if (ports.length === 0) return;
  const pass = navy.passable(me, true);
  const sig = straitSig(sc, pass);
  const dists = ports.map(
    (r) => seaReach(sc, [sc.harborOf(r)], pass, sig).dist,
  );
  const ce = navy.econ.country(me)!;
  // The beat window's preparation: an ordinary army's (not all marines).
  const prep = invasionPrepDays(ce.stats, ce.researched, false, false);
  const beats = activeBeatTargets(navy, me, day, "invade", prep);
  const capitals = new Set(enemies.map((e) => capitalRegion(land, e)));
  // Every enemy coastal region within reach, scored.
  const cands: (AiInvasionCandidate & { from: number })[] = [];
  for (const r of sc.landRegions) {
    const c = land.controller[r.id];
    if (!enemies.includes(c) || isNoStrike(sc, r.id)) continue;
    const harbor = sc.harborOf(r.id);
    if (harbor === 0) continue;
    let km = -1;
    let from = 0;
    dists.forEach((d, i) => {
      const k = d.get(harbor);
      if (k !== undefined && (km < 0 || k < km)) {
        km = k;
        from = ports[i];
      }
    });
    if (km < 0 || km > WW_INVASION_MAX_KM) continue;
    let divisions = enemyDivisionsIn(land, me, r.id);
    for (const n of sc.regionNeighbours(r.id)) {
      divisions += enemyDivisionsIn(land, me, n);
    }
    const island =
      r.island !== undefined &&
      (effectiveLevel(navy.econ, r.id, "naval_base") > 0 ||
        effectiveLevel(navy.econ, r.id, "air_base") > 0);
    cands.push({
      target: r.id,
      vp: r.vp,
      port: navalPort(ww, r.id),
      enemyCapital: capitals.has(r.id),
      islandBase: island,
      divisions,
      routeKm: km,
      beat: beats.has(r.id),
      supPm: 0,
      from,
    });
  }
  // The expected supremacy, for the best-scored first (each a sea path).
  const enemySup = enemySupBySr(navy, me);
  // The seed's ±5% only reorders close calls (variety across games).
  const seed = ww.politics.seed;
  const ranked = (c: AiInvasionCandidate) =>
    Math.floor((aiInvasionScore(c) * aiJitterPm(seed, me, c.target)) / 1000);
  cands.sort((a, b) => ranked(b) - ranked(a) || a.target - b.target);
  let pick: (AiInvasionCandidate & { from: number }) | null = null;
  for (const c of cands) {
    if (aiInvasionScore(c) <= 0) break;
    const srs = routeSrs(navy, me, c.from, c.target);
    if (srs === null) continue;
    let worst = 0;
    for (const sr of srs) worst = Math.max(worst, enemySup.get(sr) ?? 0);
    c.supPm = expectedSupPm(ours, worst);
    if (aiInvasionPick([c]) !== null) {
      pick = c;
      break;
    }
  }
  if (pick === null) return;
  const cap = invasionCapacity(ce.stats, ce.researched);
  // 내 판단: twice the defenders and four more, within the capacity.
  const need = Math.min(cap, 2 * pick.divisions + AI_INVASION_GATHER);
  readyArmy(navy, me, tick, armies, pick.from, pick.target, need, cap);
}

/** The marine template with the most divisions in `a`, and how many (spec §17.4: marines first). */
function marineCount(navy: WwNavy, me: number, a: Army): [number, number] {
  const land = navy.land;
  const cl = land.country(me);
  const t = land.divisions;
  let best = 0;
  let n = 0;
  for (const tpl of cl?.templates ?? []) {
    if (!tpl.def.battalions.includes("marine")) continue;
    let k = 0;
    for (const id of a.divisions) {
      const r = t.rowOf(id);
      if (r >= 0 && t.template[r] === tpl.id) k++;
    }
    if (k > n) {
      n = k;
      best = tpl.id;
    }
  }
  return [best, n];
}

/**
 * The invasion army: one standing in `port` invades (split to `need`
 * first when bigger than the capacity); else the free army of the port's
 * stretch with the most marines, then the nearest (ties: the bigger),
 * sends `need` divisions there (marines first) by rail or on foot.
 */
function readyArmy(
  navy: WwNavy,
  me: number,
  tick: number,
  armies: readonly Army[],
  port: number,
  target: number,
  need: number,
  cap: number,
): void {
  const land = navy.land;
  const sc = navy.scenario;
  const { comp } = aiSideStretches(land, me);
  const invade = (army: number) =>
    navy.issue(me, { kind: "army_invade", army, target }, tick, "ai");
  const split = (a: Army, count: number): number => {
    const [tpl, marines] = marineCount(navy, me, a);
    const id = land.nextArmyId;
    const order: WwOrder = {
      kind: "army_split",
      army: a.id,
      count: Math.min(
        WW_MAX_ARMY_DIVISIONS - 1,
        marines >= AI_INVASION_MIN ? Math.min(count, marines) : count,
      ),
      template: marines >= AI_INVASION_MIN ? tpl : 0,
    };
    if (land.issue(me, order, "ai") !== null) return 0;
    return land.armies.has(id) ? id : 0;
  };
  // Already there (or on its way) with no other order.
  const waiting = armies.find(
    (a) =>
      a.order.kind === "move" &&
      a.order.to === port &&
      a.divisions.length >= AI_INVASION_MIN,
  );
  if (waiting !== undefined) return;
  const here = armies
    .filter(
      (a) =>
        freeArmy(navy, a) &&
        standingRegion(navy, a) === port &&
        a.divisions.length >= AI_INVASION_MIN,
    )
    .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id)[0];
  if (here !== undefined) {
    if (here.divisions.length <= cap) {
      invade(here.id);
      return;
    }
    const id = split(here, need);
    if (id !== 0) invade(id);
    return;
  }
  const pool = armies
    .filter(
      (a) =>
        freeArmy(navy, a) &&
        comp[standingRegion(navy, a)] === comp[port] &&
        comp[port] >= 0,
    )
    .map((a) => ({
      a,
      marines: marineCount(navy, me, a)[1],
      km: sc.regionKm(standingRegion(navy, a), port),
    }))
    .sort(
      (x, y) =>
        Math.min(y.marines, need) - Math.min(x.marines, need) ||
        x.km - y.km ||
        y.a.divisions.length - x.a.divisions.length ||
        x.a.id - y.a.id,
    );
  const src = pool.find((x) => x.a.divisions.length >= AI_INVASION_MIN);
  if (src === undefined) return;
  let army = src.a.id;
  if (src.a.divisions.length > need) {
    army = split(src.a, need);
    if (army === 0) return;
  }
  const at = standingRegion(navy, src.a);
  if (at === port) {
    invade(army);
    return;
  }
  const rail =
    sc.regionKm(at, port) > RAIL_KM &&
    (land.econ.rail[at] ?? 0) >= 1 &&
    (land.econ.rail[port] ?? 0) >= 1;
  const move: WwOrder = {
    kind: rail ? "army_rail" : "army_move",
    army,
    region: port,
  };
  if (land.issue(me, move, "ai") !== null && rail) {
    land.issue(me, { kind: "army_move", army, region: port }, "ai");
  }
}
