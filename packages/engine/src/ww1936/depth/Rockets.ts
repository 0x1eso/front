// World War 1936 P6 lane S (plan Task 6 Step 3, spec §9.7): flying bombs
// and ballistic rockets. rocket_strike queues a volley from one of our
// rocket sites (level × 10 a day, in range, from the stock); the next
// common day fires the queue: the hits (flying bombs intercepted as an
// expected value, the milli remainder kept) are P4 strategic-bombing
// points on the target (4,000 = one building) and feed the victim's bomb
// fatigue; the victim gets one line a day.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  ROCKET_KINDS,
  ROCKET_POINTS,
  ROCKET_RANGE_KM,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { bombDamageMilli } from "@openfront/engine-lib/ww1936/AirRules";
import {
  rocketHits,
  rocketTargetBlock,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { damageRegion, factoriesStopped } from "../air/Bombing";
import { effectiveLevel } from "../economy/Buildings";
import { enemySupPm } from "./Atomic";
import type { WwDepth } from "./WwDepth";

/** The dayNotes kind of the rocket lines (WwDepth: 0 rocket hits). */
const NOTE_ROCKETS = 0;
/** Spec §9.7: a site fires its level × 10 rockets a day. */
const ROCKETS_PER_LEVEL = 10;

type RocketOrder = Extract<DepthOrder, { kind: "rocket_strike" }>;

/** A working rocket site's level for `id` (0: not ours or not working). */
function siteLevel(d: WwDepth, id: number, site: number): number {
  if (d.ww.land.controller[site] !== id) return 0;
  return effectiveLevel(d.ww.economy, site, "rocket_site");
}

/**
 * Spec §9.7 rocket_strike: never a no-strike target (first), then the
 * site (ours, working), the range between the centers, the war, the
 * site's rockets left today and the stock not yet promised to a volley.
 */
export function issueRocketStrike(
  d: WwDepth,
  id: number,
  o: RocketOrder,
  tick: number,
): WwOrderBlock | null {
  const sc = d.ww.scenario;
  const land = d.ww.land;
  if (sc.region(o.site) === undefined || sc.region(o.target) === undefined) {
    return "bad_region";
  }
  const kind = ROCKET_KINDS.indexOf(o.rocket);
  const km = sc.kmBetween(sc.centerTile(o.site), sc.centerTile(o.target));
  const block = rocketTargetBlock({
    km,
    rangeKm: ROCKET_RANGE_KM[kind],
    noStrike: d.noStrike(o.target),
  });
  if (block === "no_strike_region") return block;
  const level = siteLevel(d, id, o.site);
  if (level < 1) return "no_facility";
  if (block !== null) return block;
  const ctl = land.controller[o.target] ?? 0;
  if (!land.isEnemy(id, ctl)) return "not_at_war";
  const day = d.ww.day(tick);
  let firedToday = 0;
  let promised = 0;
  for (const e of d.rocketQueue) {
    if (e.owner !== id) continue;
    if (e.site === o.site && e.day === day) firedToday += e.count;
    if (e.kind === kind) promised += e.count;
  }
  if (firedToday + o.count > level * ROCKETS_PER_LEVEL) {
    return "raid_conditions";
  }
  const stock =
    d.ww.economy.country(id)?.stock[equipKey(ROCKET_KINDS[kind], 1)] ?? 0;
  if (stock - promised < o.count) return "raid_conditions";
  d.rocketQueue.push({
    owner: id,
    site: o.site,
    target: o.target,
    kind,
    count: o.count,
    day,
  });
  d.markCountry(id);
  return null;
}

/** The common day: every queued volley fires, in order; then one line to each victim. */
export function processRockets(d: WwDepth, day: number, tick: number): void {
  if (d.rocketQueue.length === 0) return;
  const queue = d.rocketQueue;
  d.rocketQueue = [];
  for (const e of queue) fireVolley(d, e, day, tick);
  flushRocketNotes(d);
}

function fireVolley(
  d: WwDepth,
  e: WwDepth["rocketQueue"][number],
  day: number,
  tick: number,
): void {
  const ww = d.ww;
  const land = ww.land;
  const econ = ww.economy;
  const c = d.country(e.owner);
  const ce = econ.country(e.owner);
  if (c === null || ce === null || !ww.isActor(e.owner)) return;
  // The target still holds: never a no-strike region, our site, the war.
  if (d.noStrike(e.target)) return;
  if (siteLevel(d, e.owner, e.site) < 1) return;
  const victim = land.controller[e.target] ?? 0;
  if (!land.isEnemy(e.owner, victim)) return;
  const kind = e.kind === 1 ? 1 : 0;
  const key = equipKey(ROCKET_KINDS[kind], 1);
  const fired = Math.min(e.count, ce.stock[key]);
  if (fired <= 0) return;
  ce.stock[key] -= fired;
  econ.markCountryDirty(e.owner);
  const h = rocketHits(
    kind,
    fired,
    enemySupPm(d, e.owner, ww.scenario.regionSr(e.target)),
    effectiveLevel(econ, e.target, "anti_air"),
    c.proj.rocketRest,
  );
  c.proj.rocketRest = h.restMilli;
  d.markCountry(e.owner);
  d.addFx({
    kind: "rocket",
    region: e.target,
    from: e.site,
    owner: e.owner,
    tick,
  });
  if (h.hits <= 0) return;
  // P4 §14.8's points: the anti-air already took its share of the flying
  // bombs (rocketHits), and nothing stops a ballistic rocket.
  const points = h.hits * ROCKET_POINTS[kind];
  const taken = econ.country(victim)?.stats.bombDamageTakenPct ?? 0;
  const before = factoriesStopped(econ, e.target);
  const done = damageRegion(econ, e.target, bombDamageMilli(points, 0, taken));
  const air = ww.air;
  const va = air.country(victim);
  if (va !== null) {
    va.bombTaken[((day % 30) + 30) % 30] += points;
    air.markCountry(victim);
  }
  air.bombPointsTotal += points;
  air.raidNotes.note(
    air,
    victim,
    e.owner,
    e.target,
    factoriesStopped(econ, e.target) - before,
    0,
    done,
  );
  noteHits(d, victim, e.target, h.hits);
}

function noteHits(d: WwDepth, to: number, region: number, n: number): void {
  const x = d.dayNotes.find(
    (y) => y[0] === to && y[1] === NOTE_ROCKETS && y[2] === region,
  );
  if (x !== undefined) x[4] += n;
  else d.dayNotes.push([to, NOTE_ROCKETS, region, 0, n]);
}

/**
 * The day's rocket rows are dropped here (the victim's line is the
 * air-raid notice, RaidNotes, which names the attacker).
 */
function flushRocketNotes(d: WwDepth): void {
  d.dayNotes = d.dayNotes.filter((x) => x[1] !== NOTE_ROCKETS);
}
