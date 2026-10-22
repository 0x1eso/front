// P6 lane W1 (plan Task 7): scorched earth (spec §16.7).
//
// scorch {region}: the legal owner who controls the region, an enemy
// division in it or next to it (or an enemy controlling a neighbour), 10
// political power and stability −1% (P3's paths); it burns 3 days later
// (`world.scorchQueue` [region, owner, day]) unless the region was lost
// meanwhile (the common day drops the entry then; the order was given, so
// its price is not refunded — the brief and spec name no refund). Burning: half the
// civilian factories, military factories and dockyards go (rounded down),
// infrastructure −2, railway −2, the supply hub 0, the dam destroyed
// (§16.4), the region's resources −50% for 180 days; both sides are told.
// Sensitivity: never on the no-strike list (scorchBlock's first check).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  SCORCH_DAYS,
  SCORCH_PP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SCORCH,
  scorchBlock,
  ScorchInput,
} from "@openfront/engine-lib/ww1936/WorldRules";
import { payPp } from "../politics/PayPp";
import { destroyDam } from "./Dams";
import type { WwDepth } from "./WwDepth";

const FACTORIES: readonly BuildingId[] = ["civ", "mil", "dock"];

/** Enemies of `id` with a division in `region` or a neighbour, or controlling a neighbour; ascending. */
export function threatsTo(d: WwDepth, id: number, region: number): number[] {
  const land = d.ww.land;
  const out: number[] = [];
  const add = (x: number) => {
    if (x > 0 && x !== id && !out.includes(x) && land.isEnemy(id, x)) {
      out.push(x);
    }
  };
  const near = [region, ...d.ww.scenario.regionNeighbours(region)];
  for (const r of near) {
    if (r !== region) add(land.controller[r] ?? 0);
    for (const row of land.rowsIn(r)) add(land.fightOwner(row));
  }
  return out.sort((a, b) => a - b);
}

/** What scorchBlock judges for `id` scorching `region` (the screens build the same). */
export function scorchInputOf(
  d: WwDepth,
  id: number,
  region: number,
): ScorchInput {
  const pol = d.ww.politics;
  const known = d.ww.scenario.region(region) !== undefined;
  return {
    legalOwner: known && (pol.legalOwner[region] ?? 0) === id,
    controls: known && (d.ww.land.controller[region] ?? 0) === id,
    enemyAdjacent: known && threatsTo(d, id, region).length > 0,
    pp: Math.floor((pol.country(id)?.ppMilli ?? 0) / 1000),
    queued: d.world.scorchQueue.some((x) => x[0] === region),
    noStrike: d.noStrike(region),
  };
}

/** scorch {region}: pays and queues the burning (3 days). */
export function issueScorch(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "scorch" }>,
  tick: number,
): WwOrderBlock | null {
  const block = scorchBlock(scorchInputOf(d, id, o.region));
  if (block !== null) return block;
  const pol = d.ww.politics;
  if (!payPp(pol, id, SCORCH_PP)) return "no_pp";
  // P3's stability effect (EffectsPol "stability"): the base, clamped.
  const c = pol.country(id)!;
  c.stabBaseBp = Math.max(
    0,
    Math.min(10_000, c.stabBaseBp + SCORCH.stabilityBp),
  );
  pol.markCountry(id);
  const q = d.world.scorchQueue;
  q.push([o.region, id, d.ww.day(tick) + SCORCH_DAYS]);
  q.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
  d.markCountry(id);
  return null;
}

/** The burning (the queue's day has come and the owner still holds the region). */
export function scorchNow(
  d: WwDepth,
  region: number,
  owner: number,
  tick: number,
): void {
  const land = d.ww.land;
  if ((land.controller[region] ?? 0) !== owner || d.noStrike(region)) return;
  const econ = d.ww.economy;
  const day = d.ww.day(tick);
  for (const b of FACTORIES) {
    const n = econ.buildingArray(b)[region] ?? 0;
    const k = Math.floor((n * SCORCH.destroyPct) / 100);
    if (k > 0) econ.addBuilding(region, b, -k);
  }
  const infra = Math.min(SCORCH.infraCut, econ.infra[region] ?? 0);
  if (infra > 0) econ.addBuilding(region, "infra", -infra);
  const rail = Math.min(SCORCH.railCut, econ.rail[region] ?? 0);
  if (rail > 0) econ.addBuilding(region, "rail", -rail);
  const hub = econ.hub[region] ?? 0;
  if (hub > 0) econ.addBuilding(region, "supply_hub", -hub);
  const dam = d.ww.scenario.damOf(region);
  if (dam >= 0) destroyDam(d, dam, owner, tick);
  // 180 days, the last one inclusive.
  const until = day + SCORCH.resourceDays - 1;
  setUntil(d.world.exhaustedUntil, region, until);
  setUntil(d.world.scorchedUntil, region, until);
  const told = [owner, ...threatsTo(d, owner, region)];
  for (const x of told) d.message(x, "ww1936_scorched", { region });
  d.markCountry(owner);
  d.markGlobal();
}

/** A [region, until] list's row for `region` set to `until`, region order kept. */
function setUntil(
  list: [number, number][],
  region: number,
  until: number,
): void {
  const at = list.findIndex((x) => x[0] === region);
  if (at >= 0) list[at][1] = Math.max(list[at][1], until);
  else {
    list.push([region, until]);
    list.sort((a, b) => a[0] - b[0]);
  }
}

/**
 * The common day: an entry whose region its owner no longer controls is
 * cancelled (spec §16.7); one whose day has come burns. Queue order.
 */
export function dayCommonScorch(d: WwDepth, day: number, tick: number): void {
  const q = d.world.scorchQueue;
  if (q.length === 0) return;
  const land = d.ww.land;
  const due: [number, number][] = [];
  const keep: [number, number, number][] = [];
  for (const x of q) {
    const [region, owner, at] = x;
    if ((land.controller[region] ?? 0) !== owner) {
      d.markCountry(owner);
      continue;
    }
    if (at <= day) due.push([region, owner]);
    else keep.push(x);
  }
  d.world.scorchQueue = keep;
  for (const [region, owner] of due) scorchNow(d, region, owner, tick);
}
