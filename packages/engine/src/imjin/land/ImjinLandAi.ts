// The Imjin War's land AI on the 1936 one (ww175 design §9, ww177 lane I5a).
// The 1936 AI (AiLand, AiInvasion) runs every army by the rules a player
// has; in an Imjin game it asks here, by state:
// - where its offensives aim (imjinAimVp: the targets on the way to the
//   chain's next city an enemy holds weigh more, the nearer the more);
// - which pockets it leaves to hunger (a castle or hiding ground it has
//   surrounded is starved, not stormed, until its grain is gone);
// - which of its regions it guards (imjinGuardVp: castles and passes);
// - before the war, where Japan's armies muster (imjinMuster: at the
//   strait's port, once the strike is near);
// - the drive (imjinDrive): its biggest fit army goes for the aim region
//   by region, by a player's direct attack, rests when worn and goes on;
// - Joseon's line once its court has fled (imjinHeldLine): it holds the
//   stretch nearest the court and gives up the rest (it falls back north).
// Nothing here is state: it reads the map, the controllers and Japan's
// readiness, so saves and replays see the same.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { ROLE_ATTACK } from "@openfront/engine-api/ww1936/LandTypes";
import {
  SEAT_ABROAD,
  SEAT_CAPITAL,
} from "@openfront/engine-lib/imjin/CourtRules";
import {
  AIM_CHAIN,
  aimBonusVp,
  aimCost,
  aimDistances,
  guardBonusVp,
  IMJIN_FEED_PCT,
} from "@openfront/engine-lib/imjin/LandAi";
import { regionTerrain } from "@openfront/engine-lib/imjin/Terrain";
import { leaveAttack } from "../../ww1936/land/Orders";
import type { Army, WwLand } from "../../ww1936/land/WwLand";
import { TRUCE_PHASE } from "../japan/ImjinJapan";
import { imjinFortLevel } from "./Sieges";

/** Ground where a cut-off garrison lies hidden (design §5 "Ambush"). */
const HIDING_GROUND: ReadonlySet<string> = new Set([
  "forest",
  "mountain",
  "pass",
  "marsh",
]);

/**
 * Design §5 "Sieges", the starve pick: an enemy castle, or hiding ground,
 * that `me`'s side has cut off on every side is left to its hunger (no
 * supply reaches it; a fort eats its grain) until a castle's grain is gone.
 */
export function imjinStarving(
  land: WwLand,
  me: number,
  region: number,
): boolean {
  const sc = land.scenario;
  const nb = sc.regionNeighbours(region);
  if (nb.length === 0) return false;
  for (const n of nb) if (!land.sameSide(me, land.controller[n])) return false;
  const im = land.ww.imjinWar;
  if (im === null) return false;
  const siege = im.st.sieges.find((x) => x.region === region);
  if (siege !== undefined) return siege.grainDays > 0;
  return (
    imjinFortLevel(im, region) > 0 ||
    HIDING_GROUND.has(regionTerrain(sc, region))
  );
}

/** Derived from the map only: the region id of each chain city, and the march costs to an aim. */
const cache = new WeakMap<
  WwLand,
  { ids: Map<string, number>; dist: Map<number, Int32Array> }
>();

function cacheOf(land: WwLand) {
  let c = cache.get(land);
  if (c === undefined) {
    const ids = new Map<string, number>();
    for (const r of land.scenario.landRegions) ids.set(r.name, r.id);
    c = { ids, dist: new Map() };
    cache.set(land, c);
  }
  return c;
}

/** The chain city `me` drives on now (0: none), by who holds the cities. */
export function imjinAim(land: WwLand, me: number): number {
  const chain = AIM_CHAIN[land.ww.tagOf(me) ?? ""];
  if (chain === undefined) return 0;
  const ids = cacheOf(land).ids;
  for (const name of chain) {
    const r = ids.get(name) ?? 0;
    if (r !== 0 && land.isEnemy(me, land.controller[r])) return r;
  }
  return 0;
}

/** The march cost from every region to `aim` (the map only: cached). */
export function imjinAimDistances(land: WwLand, aim: number): Int32Array {
  const c = cacheOf(land);
  let d = c.dist.get(aim);
  if (d === undefined) {
    const sc = land.scenario;
    d = aimDistances(
      sc.maxRegionId() + 1,
      aim,
      (r) => sc.regionNeighbours(r),
      (r) => aimCost(regionTerrain(sc, r)),
      (r) => sc.region(r) !== undefined,
    );
    c.dist.set(aim, d);
  }
  return d;
}

/**
 * The extra victory points an enemy region weighs as `me`'s target: the
 * nearer it lies to the aim by the cheapest march, the more (design §9:
 * Japan drives up the open roads; Ming comes to Pyongyang).
 */
export function imjinAimVp(land: WwLand, me: number, region: number): number {
  const aim = imjinAim(land, me);
  if (aim === 0) return 0;
  const d = imjinAimDistances(land, aim)[region];
  return d >= 1 << 30 ? 0 : aimBonusVp(d);
}

/**
 * Walls no siege has starved (design §5: the attacker at x0.5, the
 * defender at x1.5, on half the width): the AI's offensives leave them to
 * the siege (it surrounds them) and storms them once their grain is out.
 */
function unbrokenWalls(land: WwLand, region: number): boolean {
  const im = land.ww.imjinWar;
  if (im === null || imjinFortLevel(im, region) <= 0) return false;
  const siege = im.st.sieges.find((x) => x.region === region);
  return siege === undefined || siege.grainDays > 0;
}

/**
 * The targets of a drive (design §9: "a drive up the roads"): the pockets
 * left to starve, walls no siege has starved and attacks called off are
 * out; of the rest, only those nearer the aim than the
 * zone already stands, so an army goes on and leaves the pockets behind
 * it to the guards. All of the rest when none is nearer, or with no aim.
 */
export function imjinOnTheWay<T extends { region: number }>(
  land: WwLand,
  me: number,
  zone: readonly number[],
  regions: T[],
): T[] {
  regions = regions.filter(
    (r) =>
      !imjinStarving(land, me, r.region) &&
      !staleAttack(land, me, r.region) &&
      !unbrokenWalls(land, r.region),
  );
  const aim = imjinAim(land, me);
  if (aim === 0 || zone.length === 0) return regions;
  const d = imjinAimDistances(land, aim);
  let near = 1 << 30;
  for (const f of zone) near = Math.min(near, d[f]);
  const on = regions.filter((r) => d[r.region] < near);
  return on.length > 0 ? on : regions;
}

/**
 * Days an AI attack on one region goes on before it is called off, unless
 * the region is its aim (design §9: no scripted battles, and no army fed
 * for months into one wood or wall it can go round).
 */
export const IMJIN_ATTACK_PATIENCE_DAYS = 30;

/** A battle `me` attacks in `region` that has gone on past the patience. */
function staleAttack(land: WwLand, me: number, region: number): boolean {
  const b = land.battles.get(region);
  if (b === undefined || !land.sameSide(me, b.attLead)) return false;
  const ww = land.ww;
  const tick = land.mg.ticks();
  if (ww.inPrep(tick) || ww.inPrep(b.sinceTick)) return false;
  return ww.day(tick) - ww.day(b.sinceTick) > IMJIN_ATTACK_PATIENCE_DAYS;
}

/**
 * Calls off `a`'s attacks that have gone on past the patience (not on its
 * aim): its divisions leave them, as a player's would on a halt. True
 * when it did, and the plan should stop.
 */
export function imjinCallOff(
  land: WwLand,
  me: number,
  rows: readonly number[],
): boolean {
  const t = land.divisions;
  const aim = imjinAim(land, me);
  let off = false;
  for (const r of rows) {
    const x = t.battle[r];
    if (x === 0 || x === aim || t.role[r] !== ROLE_ATTACK) continue;
    if (!staleAttack(land, me, x)) continue;
    leaveAttack(land, r);
    off = true;
  }
  return off;
}

/** What a region's supply counts for in `me`'s planning, milli (IMJIN_FEED_PCT). */
export function imjinFeed(land: WwLand, me: number, feed: number): number {
  const pct = IMJIN_FEED_PCT[land.ww.tagOf(me) ?? ""] ?? 100;
  return Math.floor((feed * pct) / 100);
}

/** The extra worth of a region of ours as a guard post (castles, passes). */
export function imjinGuardVp(land: WwLand, region: number): number {
  return guardBonusVp(regionTerrain(land.scenario, region));
}

/** Japan's port facing Korea, where its armies muster for the landing. */
const MUSTER_PORT = "Nagoya";
/** The muster starts this much readiness short of the AI's strike bar. */
const MUSTER_LEAD = 150;

/**
 * Before the war (design §8 "Japan musters its daimyo"): once AI Japan's
 * readiness nears its strike bar, its idle field armies march to the
 * strait's port, so the landing can sail with the strike. True when the
 * army got an order.
 */
export function imjinMuster(
  land: WwLand,
  me: number,
  a: Army,
  issue: (o: WwOrder) => boolean,
): boolean {
  const jp = land.ww.japan;
  if (jp === null || land.ww.tagOf(me) !== "JPN") return false;
  const s = jp.state();
  if (s.warDay >= 0 && s.phase !== TRUCE_PHASE.broken) return false;
  if (s.readiness + MUSTER_LEAD < s.aiBar) return false;
  if (a.order.kind !== "idle" || a.divisions.length === 0) return false;
  const port = cacheOf(land).ids.get(MUSTER_PORT) ?? 0;
  if (port === 0 || land.controller[port] !== me) return false;
  if (land.armyRegion(a) === port) return false;
  return issue({ kind: "army_move", army: a.id, region: port });
}

/** Japan's corps that drive at once (doctrine §2). */
export const IMJIN_JPN_CORPS = 3;
/** The drive's spearhead has at least this many divisions. */
export const IMJIN_SPEAR_MIN = 4;

/**
 * What a castle costs the drive to take by assault, in march cost: walls
 * that a garrison holds and no siege has starved are gone round (the
 * siege picks, design §5: the drive surrounds them and lets them starve,
 * doctrine §7.3's investment); once the grain is out, or with nobody on
 * the walls, they are stormed. ww181: the odds no longer storm them (13
 * divisions fed into one gate at Gaeseong for four months, Anju for a
 * year): a garrison dug in behind walls holds whatever stands at the gate.
 */
export const IMJIN_WALL_DETOUR = 8;

/**
 * The drive's next region: the enemy region next to our side's land that
 * lies nearest the aim by the cheapest march, held walls counted at
 * IMJIN_WALL_DETOUR more (not a pocket left to starve; ties: the fewer
 * defenders, the smaller id). 0 when none.
 */
export function imjinNextStep(
  land: WwLand,
  me: number,
  aim: number,
  skip: readonly number[] = [],
): number {
  const sc = land.scenario;
  const im = land.ww.imjinWar;
  const d = imjinAimDistances(land, aim);
  let best = 0;
  let bestD = 1 << 30;
  let bestN = 0;
  for (const r of sc.landRegions) {
    const c = land.controller[r.id];
    if (!land.isEnemy(me, c) || d[r.id] >= 1 << 30) continue;
    if (skip.includes(r.id)) continue;
    if (
      !sc
        .regionNeighbours(r.id)
        .some((n) => land.sameSide(me, land.controller[n]))
    ) {
      continue;
    }
    if (imjinStarving(land, me, r.id)) continue;
    let n = 0;
    for (const row of land.rowsIn(r.id))
      if (land.isEnemy(me, land.divisions.owner[row])) n++;
    const walls = im !== null && n > 0 && unbrokenWalls(land, r.id);
    const cost = d[r.id] + (walls ? IMJIN_WALL_DETOUR : 0);
    if (
      cost < bestD ||
      (cost === bestD && (n < bestN || (n === bestN && r.id < best)))
    ) {
      best = r.id;
      bestD = cost;
      bestN = n;
    }
  }
  return best;
}

/** An army's organisation, ‰ of full. */
function orgPmOf(land: WwLand, a: Army): number {
  const t = land.divisions;
  let org = 0;
  let max = 0;
  for (const id of a.divisions) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    org += t.org[r];
    max += land.orgMaxOf(r);
  }
  return max === 0 ? 0 : Math.floor((org * 1000) / max);
}

/**
 * Design §9, the drive (Japan on Hanseong and Pyongyang, Ming on
 * Pyongyang): the country's spearhead, its biggest army fit to attack
 * (at its plan's re-attack organisation), takes the next region toward
 * the aim by a direct attack, all in, a player's order. The 1936 AI's stop
 * rules end it when it is worn; the next day it is fit again it goes on.
 * Its target moves on as the regions fall.
 */
export function imjinDrive(
  land: WwLand,
  me: number,
  armies: readonly Army[],
  reattackPm: number,
  issue: (o: WwOrder) => boolean,
): void {
  const aim = imjinAim(land, me);
  if (aim === 0) return;
  const t = land.divisions;
  const attacking = (a: Army) =>
    a.divisions.some((id) => {
      const r = t.rowOf(id);
      return r >= 0 && t.battle[r] !== 0 && t.role[r] === ROLE_ATTACK;
    });
  const order = (a: Army, step: number): WwOrder => ({
    kind: "army_direct" as const,
    army: a.id,
    targets: [step],
    favorable: false,
    allIn: true,
    advance: false,
    merge: true,
  });
  // ww177 P7b (doctrine §2): Japan marches its corps on separate roads,
  // up to three spearheads at once (Konishi, Katō, Kuroda); others one.
  const corps = land.scenario.tagOfSmallId(me) === "JPN" ? IMJIN_JPN_CORPS : 1;
  const spears = armies
    .filter((a) => a.order.kind === "plan" && a.order.direct === true)
    .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id)
    .slice(0, corps);
  const taken: number[] = [];
  for (const spear of spears) {
    if (attacking(spear)) {
      if (spear.order.kind === "plan" && spear.order.targets.length > 0)
        taken.push(spear.order.targets[0]);
      continue;
    }
    const step = imjinNextStep(land, me, aim, taken);
    if (step === 0) continue;
    taken.push(step);
    const on =
      spear.order.kind === "plan" &&
      spear.order.executing &&
      spear.order.targets[0] === step;
    if (!on && orgPmOf(land, spear) >= reattackPm) issue(order(spear, step));
  }
  if (spears.length >= corps) return;
  const cands = armies
    .filter(
      (a) =>
        !spears.includes(a) &&
        a.divisions.length >= IMJIN_SPEAR_MIN &&
        (a.order.kind === "front" ||
          a.order.kind === "plan" ||
          a.order.kind === "idle") &&
        !attacking(a) &&
        orgPmOf(land, a) >= reattackPm,
    )
    .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id);
  let more = corps - spears.length;
  for (const a of cands) {
    if (more <= 0) return;
    const step = imjinNextStep(land, me, aim, taken);
    if (step !== 0 && issue(order(a, step))) {
      taken.push(step);
      more--;
    }
  }
}

/**
 * Design §9, Joseon falls back to the north when beaten: once its court
 * has left the capital (JoseonMing's flight, by state), its armies give
 * up the capital and hold only the part of the front nearest the court's
 * seat (within one region of the nearest). Every other country, and Joseon before the flight,
 * holds its whole border.
 */
export function imjinHeldLine(
  land: WwLand,
  me: number,
  border: readonly number[],
): readonly number[] {
  const jm = land.ww.imjinJm;
  if (jm === null || land.ww.tagOf(me) !== "JOS") return border;
  if (jm.seat === SEAT_CAPITAL || jm.seat >= SEAT_ABROAD) return border;
  const seat = jm.seatRegion;
  if (seat === 0 || border.length === 0) return border;
  // Hops from the seat over our side's land.
  const sc = land.scenario;
  const hops = new Map<number, number>([[seat, 0]]);
  const queue = [seat];
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const v of sc.regionNeighbours(u)) {
      if (hops.has(v) || !land.sameSide(me, land.controller[v])) continue;
      hops.set(v, hops.get(u)! + 1);
      queue.push(v);
    }
  }
  const left = border.filter((r) => !imjinGivenUp(land, me, r));
  let near = 1 << 30;
  for (const r of left) near = Math.min(near, hops.get(r) ?? 1 << 30);
  if (near >= 1 << 30) return left;
  return left.filter((r) => (hops.get(r) ?? 1 << 30) <= near + 1);
}

/**
 * The capital a fled court has left (design §7: the king's flight): Joseon's
 * AI no longer holds or guards it; its armies go north with the court.
 */
export function imjinGivenUp(
  land: WwLand,
  me: number,
  region: number,
): boolean {
  const jm = land.ww.imjinJm;
  if (jm === null || land.ww.tagOf(me) !== "JOS") return false;
  if (jm.seat === SEAT_CAPITAL || jm.seat >= SEAT_ABROAD) return false;
  return region !== jm.seatRegion && region === land.ww.capitalRegion(me);
}

/** The region Joseon's guard holds first: the court's seat once it has fled, else the capital. */
export function imjinCourtSeat(
  land: WwLand,
  me: number,
  capital: number,
): number {
  const jm = land.ww.imjinJm;
  if (jm === null || land.ww.tagOf(me) !== "JOS") return capital;
  if (jm.seat === SEAT_CAPITAL || jm.seat >= SEAT_ABROAD) return capital;
  return jm.seatRegion !== 0 ? jm.seatRegion : capital;
}
