// P6 lane W1 (plan Task 7): floating harbours (spec §16.6).
//
// harbor_deploy puts a floating harbour from the stock into a coastal
// region we control (naval base 2 or less, our side's supremacy of 50% or
// more in its harbour zone's sea region): `world.harbors` [region, owner,
// since day]. It works as a level-5 sea hub for 60 days, then fades by
// 1/60 a day to nothing on day 120, when the common day takes it away
// (sooner if the region falls to another side). P4 reads its level through
// the foundation's NavyAirHooks.beachheadCapacity.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { HARBOR_DAYS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  harborBlock,
  HarborInput,
  harborLevelMilli,
} from "@openfront/engine-lib/ww1936/WorldRules";
import type { WwDepth } from "./WwDepth";

const HARBOR_KEY = equipKey("floating_harbor", 1);

/** The floating harbour's hub level at `region`, milli (0 none). */
export function harborLevelOf(d: WwDepth, region: number): number {
  const h = d.world.harbors;
  if (h.length === 0) return 0;
  for (const x of h) {
    if (x[0] === region) {
      return harborLevelMilli(Math.max(0, d.lastCommonDay - x[2]));
    }
  }
  return 0;
}

/** What harborBlock judges for `id` deploying at `region` (the screens build the same). */
export function harborInputOf(
  d: WwDepth,
  id: number,
  region: number,
): HarborInput {
  const sc = d.ww.scenario;
  const econ = d.ww.economy;
  const navy = d.ww.navy;
  const zone = sc.region(region) === undefined ? 0 : sc.harborOf(region);
  const sr = zone === 0 ? 0 : sc.zoneSr(zone);
  const ce = econ.country(id);
  return {
    controls: (d.ww.land.controller[region] ?? 0) === id,
    coastal: zone !== 0,
    navalBase: econ.buildingArray("naval_base")[region] ?? 0,
    supremacyPm: sr === 0 ? 0 : navy.supremacy(navy.sideOf(id), sr),
    stock: ce?.stock[HARBOR_KEY] ?? 0,
    tech: ce?.researched.has("floating_harbor_1") ?? false,
    deployed: d.world.harbors.some((x) => x[0] === region),
  };
}

/** harbor_deploy {region}. */
export function issueHarbor(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "harbor_deploy" }>,
): WwOrderBlock | null {
  const block = harborBlock(harborInputOf(d, id, o.region));
  if (block !== null) return block;
  const ce = d.ww.economy.country(id)!;
  ce.stock[HARBOR_KEY] -= 1;
  d.ww.economy.markCountryDirty(id);
  const h = d.world.harbors;
  h.push([o.region, id, Math.max(0, d.lastCommonDay)]);
  h.sort((a, b) => a[0] - b[0]);
  d.markCountry(id);
  d.markGlobal();
  return null;
}

/** The common day: a harbour 120 days old, or in a region another side took, goes. */
export function dayCommonHarbors(d: WwDepth, day: number): void {
  const h = d.world.harbors;
  if (h.length === 0) return;
  const land = d.ww.land;
  const keep = h.filter(
    ([region, owner, since]) =>
      day - since < HARBOR_DAYS &&
      land.sameSide(owner, land.controller[region] ?? 0),
  );
  if (keep.length !== h.length) {
    d.world.harbors = keep;
    d.markGlobal();
  }
}
