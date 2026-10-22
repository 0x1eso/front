// P6 lane W1 (plan Task 7): dams and floods (spec §16.4).
//
// A destroyed dam (a raid, an atomic bomb, its owner's scorched earth)
// drops to level 0 and floods its region and the regions downstream for 60
// days: infrastructure −2 (not below 1, once a flood), supply −50% and the
// way in −30% (World.regionStatus). It sets the world flag `<damId>_destroyed`
// (pre-flight §C5: P3's set_gflag state, read by K3's
// nor_heavy_water_raid) and tells the world. Its repair is P1's `build dam`
// (the foundation's depthBuildBlock and onDamRepaired: level 1 again).
// Sensitivity: a dam on the no-strike list is never destroyed (there are
// none by data; the check is the rule's).
import { DAMS, FLOOD_DAYS } from "@openfront/engine-api/ww1936/DepthTypes";
import { FLOOD } from "@openfront/engine-lib/ww1936/WorldRules";
import { refreshRegionStatus } from "./World";
import type { WwDepth } from "./WwDepth";

/** A dam is destroyed: level 0, the world flag, floods, the news. */
export function destroyDam(
  d: WwDepth,
  dam: number,
  by: number,
  tick: number,
): void {
  if (dam < 0 || dam >= DAMS.length) return;
  if ((d.world.damLevel[dam] ?? 0) === 0) return;
  const sc = d.ww.scenario;
  const region = sc.damRegion[dam] ?? 0;
  if (region <= 0 || d.noStrike(region)) return;
  d.world.damLevel[dam] = 0;
  const day = d.ww.day(tick);
  // P3's set_gflag path (EffectsPol): the flag holds its day.
  const pol = d.ww.politics;
  pol.gflags.set(`${DAMS[dam]}_destroyed`, day);
  pol.markGlobal();
  floodRegions(d, [region, ...(sc.damDownstream[dam] ?? [])], day);
  refreshRegionStatus(d, day);
  const owner = d.ww.land.controller[region] ?? 0;
  d.news("news_dam_destroyed", { region });
  d.messageAll("ww1936_dam_destroyed", { region });
  d.addFx({ kind: "dam", region, from: by, owner, tick });
  // Its energy leaves the controller tomorrow; the screens now.
  if (owner > 0) d.markCountry(owner);
  d.markGlobal();
}

/**
 * Spec §16.4: each region floods until day + 60; a region not flooded yet
 * loses 2 infrastructure (not below 1) through P1, so the effective level
 * P2 reads follows (pre-flight §D). A flooded one only lasts longer.
 */
export function floodRegions(
  d: WwDepth,
  regions: readonly number[],
  day: number,
): void {
  const econ = d.ww.economy;
  const until = day + FLOOD_DAYS;
  const list = d.world.floodUntil;
  for (const r of [...new Set(regions)].sort((a, b) => a - b)) {
    if (r <= 0 || d.noStrike(r)) continue;
    const at = list.findIndex((x) => x[0] === r);
    if (at >= 0 && list[at][1] >= day) {
      list[at][1] = Math.max(list[at][1], until);
      continue;
    }
    if (at >= 0) list.splice(at, 1);
    list.push([r, until]);
    const infra = econ.infra[r] ?? 0;
    const cut = Math.min(FLOOD.infraCut, Math.max(0, infra - FLOOD.infraFloor));
    if (cut > 0) econ.addBuilding(r, "infra", -cut);
  }
  list.sort((a, b) => a[0] - b[0]);
}
