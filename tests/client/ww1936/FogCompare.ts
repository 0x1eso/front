// Final review M6: everything the fog answers, asked of two models over the
// same game view — the incremental FogModel and the old full rebuild
// (FogModelReference) — and the first difference, if any. The equivalence
// test calls it after every tick (and WwClientPerf over a recorded game).
import type { FogModel } from "../../../src/client/hud/ww1936/FogModel";
import type { GameView } from "../../../src/client/view/GameView";
import type { WwLandView } from "../../../src/client/view/WwLandView";
import type { FogModelReference } from "./FogModelReference";

/** Counts of what the comparisons met (so a test can say the run covered it). */
export interface FogCoverage {
  ticks: number;
  shown: number;
  hidden: number;
  ghosts: number;
  sightings: number;
  movingSightings: number;
  fleetsShown: number;
  fleetsHidden: number;
  battles: number;
  bands: number[];
}

export function newCoverage(): FogCoverage {
  return {
    ticks: 0,
    shown: 0,
    hidden: 0,
    ghosts: 0,
    sightings: 0,
    movingSightings: 0,
    fleetsShown: 0,
    fleetsHidden: 0,
    battles: 0,
    bands: [0, 0, 0, 0],
  };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The sightings map (private in both models): id → record, in the map's order. */
function sightings(f: object): [number, unknown][] {
  return [...(f as { seen: Map<number, unknown> }).seen.entries()];
}

/**
 * The old WwLandView.tokenXY, verbatim (closure and all), on the view's
 * own arrival ticks: tokenXYInto must give the same numbers.
 */
function oldTokenXY(
  view: WwLandView,
  a: Parameters<WwLandView["tokenXY"]>[0],
  tick: number,
): [number, number] | null {
  const armyTick = (view as unknown as { armyTick: Map<number, number> })
    .armyTick;
  if (
    a.region === 0 ||
    (a.move !== null && (a.move.from === 0 || a.move.to === 0))
  ) {
    return null;
  }
  const w = view.scenario.width;
  const at = (region: number): [number, number] => {
    const t = view.scenario.centerTile(region);
    return [t % w, Math.floor(t / w)];
  };
  if (a.move === null) return at(a.region);
  const since = Math.max(0, tick - (armyTick.get(a.id) ?? tick));
  const p = Math.min(1000, a.move.progPm + a.move.stepPm * since) / 1000;
  const [x0, y0] = at(a.move.from);
  const [x1, y1] = at(a.move.to);
  return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p];
}

/**
 * Asks both models every question the screens ask, for every army, fleet,
 * battle, zone, region, country and side the view holds. Null when every
 * answer is the same, else the first difference.
 */
export function compareFog(
  view: GameView,
  next: FogModel,
  ref: FogModelReference,
  cov: FogCoverage = newCoverage(),
): string | null {
  const diff = (what: string, a: unknown, b: unknown): string | null =>
    same(a, b)
      ? null
      : `tick ${view.ticks()}: ${what}: new ${JSON.stringify(a)} old ${JSON.stringify(b)}`;
  cov.ticks++;
  // The stamp first, as the passes ask it: both rebuild here.
  let d = diff("stamp", next.stamp(), ref.stamp());
  if (d !== null) return d;
  d =
    diff("fogOff", next.fogOff(), ref.fogOff()) ??
    diff("me", next.me(), ref.me());
  if (d !== null) return d;

  const land = view.wwLand?.() ?? null;
  const navy = view.wwNavy?.() ?? null;
  const air = view.wwAir?.() ?? null;
  const sc = view.worldWarScenario?.() ?? null;
  const tick = view.ticks();
  const ids = new Set<number>();
  for (const a of land?.armies.values() ?? []) {
    ids.add(a.id);
    const xy = land!.tokenXY(a, tick);
    d = diff(`tokenXY ${a.id}`, xy, oldTokenXY(land!, a, tick));
    if (d !== null) return d;
  }
  // Ids the view no longer has (removed armies) and one it never had.
  for (const id of sightings(ref)) ids.add(id[0]);
  ids.add(999_999);
  for (const id of ids) {
    const a = next.armyView(id);
    d = diff(`armyView ${id}`, a, ref.armyView(id));
    if (d !== null) return d;
    if (land?.armies.has(id)) {
      if (a.visible) {
        cov.shown++;
        cov.bands[a.composition ? 3 : a.template ? 2 : a.general ? 1 : 0]++;
      } else cov.hidden++;
    }
  }
  d = diff("ghosts", next.ghosts(), ref.ghosts());
  if (d !== null) return d;
  cov.ghosts += ref.ghosts().length;
  const seenNew = sightings(next);
  const seenOld = sightings(ref);
  d = diff("sightings", seenNew, seenOld);
  if (d !== null) return d;
  cov.sightings += seenOld.length;
  for (const [id] of seenOld) {
    if (land?.armies.get(id)?.move) cov.movingSightings++;
  }

  for (const f of navy?.fleets.values() ?? []) {
    const v = next.fleetView(f.id);
    d = diff(`fleetView ${f.id}`, v, ref.fleetView(f.id));
    if (d !== null) return d;
    if (v.visible) cov.fleetsShown++;
    else cov.fleetsHidden++;
  }
  d = diff("fleetView none", next.fleetView(999_999), ref.fleetView(999_999));
  if (d !== null) return d;

  for (const b of land?.battles.values() ?? []) {
    cov.battles++;
    d =
      diff(
        `landBattleVisible ${b.region}`,
        next.landBattleVisible(b.region, b.attacker, b.defender),
        ref.landBattleVisible(b.region, b.attacker, b.defender),
      ) ??
      diff(
        `battleEnemyLabel ${b.region}`,
        [
          next.battleEnemyLabel(b.region, 0),
          next.battleEnemyLabel(b.region, 1),
        ],
        [ref.battleEnemyLabel(b.region, 0), ref.battleEnemyLabel(b.region, 1)],
      );
    if (d !== null) return d;
  }
  for (const b of navy?.battles.values() ?? []) {
    const nb = b as { attacker: number; defender: number; zone: number };
    d = diff(
      `navalBattleVisible ${nb.zone}`,
      next.navalBattleVisible(nb.attacker, nb.defender, nb.zone),
      ref.navalBattleVisible(nb.attacker, nb.defender, nb.zone),
    );
    if (d !== null) return d;
  }
  for (const z of air?.zones.values() ?? []) {
    for (const s of z.sides) {
      d = diff(
        `zoneSorties ${z.sr} ${s.side}`,
        next.zoneSorties(z.sr, s.side),
        ref.zoneSorties(z.sr, s.side),
      );
      if (d !== null) return d;
    }
  }

  const countries = sc === null ? 8 : sc.countries.length + 1;
  const factions = view.wwPolitics?.()?.global?.factions ?? [];
  for (let id = 0; id <= countries; id++) {
    const ask = (f: FogModel | FogModelReference) => [
      [0, 1, 2, 3].map((dm) => [f.levelOf(id, dm), f.bandOf(id, dm)]),
      [0, 1, 2, 3].map((dm) => f.countLabel(id, 137, dm)),
      f.countLabel(id, 241),
      f.planesSeen(id, 57),
      f.previewEnemyValue(83, id),
      f.troopsLabel(id, 345_678),
      f.countryView(id),
      f.mineSideView(id),
      f.launchSiteShown(id, 1 + (id % 12)),
    ];
    d = diff(`country ${id}`, ask(next), ask(ref));
    if (d !== null) return d;
  }
  for (const fc of factions) {
    const side = 100_000 + fc.idx;
    d = diff(`side ${side}`, next.mineSideView(side), ref.mineSideView(side));
    if (d !== null) return d;
  }
  const regions = sc === null ? 0 : sc.maxRegionId();
  for (let r = 1; r <= regions; r++) {
    const nv = next.regionView(r);
    const ov = ref.regionView(r);
    d = diff(
      `regionView ${r}`,
      [nv.buildings, nv.label(29)],
      [ov.buildings, ov.label(29)],
    );
    if (d !== null) return d;
  }
  return null;
}
