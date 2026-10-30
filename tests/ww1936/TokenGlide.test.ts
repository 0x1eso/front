// World War 1936: what the army token's summary tells the screens while
// an army moves (P2 spec §6.1 token region, §15.2 moving tokens glide).
// The screens extrapolate a moving token from the summary's progPm and
// stepPm until the next summary, so a summary must neither stop a token
// that walks on (stepPm 0) nor put it on an edge far from its region.
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { MOVE_WALK } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "@openfront/engine/game/Game";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import { WwLandView } from "../../src/client/view/WwLandView";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  wwRunnerCapture,
} from "./util";

const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];

/** A region's center tile as [x, y] (where a standing token is drawn). */
function centerXY(g: Game, region: number): [number, number] {
  const sc = g.worldWar()!.scenario;
  const t = sc.centerTile(region);
  return [t % sc.width, Math.floor(t / sc.width)];
}

/**
 * Feeds the land updates not yet seen into `view` the way GameView does
 * and returns, per army, the largest distance (tiles) a token was moved
 * by an update: where the old summary had it at the update's tick against
 * where the new one puts it.
 */
function feed(
  view: WwLandView,
  updates: GameUpdateViewData[],
  from: number,
  jumps: Map<number, number>,
): number {
  for (let i = from; i < updates.length; i++) {
    const u = updates[i];
    for (const e of u.updates[GameUpdateType.WwLand]) {
      const before = new Map<number, [number, number] | null>();
      for (const a of e.data.armies) {
        const old = view.armies.get(a.id);
        if (old !== undefined) before.set(a.id, view.tokenXY(old, u.tick));
      }
      view.apply(e.data, u.tick);
      for (const a of e.data.armies) {
        const was = before.get(a.id);
        const now = view.tokenXY(a, u.tick);
        if (was === undefined || was === null || now === null) continue;
        const d = Math.hypot(now[0] - was[0], now[1] - was[1]);
        jumps.set(a.id, Math.max(jumps.get(a.id) ?? 0, d));
      }
    }
  }
  return updates.length;
}

describe("World War 1936: the army token's summary while it moves", () => {
  test("a token glides over every edge of a two-region move: no stop at a region, no jump", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const view = new WwLandView(g.worldWar()!.scenario);
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    // Berlin → (Warsaw or Munich) → Krakow, all German: two edges.
    takeRegion(g, 6, "DEU");
    takeRegion(g, 7, "DEU");
    const a = placeArmy(g, "DEU", 3, 2);
    step(runner);
    let seen = feed(view, updates, 0, new Map());
    const jumps = new Map<number, number>();
    const deu = byTag(g, "DEU").smallID();
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 7 })).toBe(
      null,
    );
    const regions = new Set<number>();
    let frozen = 0;
    let ticks = 0;
    while (ticks++ < 200) {
      step(runner);
      seen = feed(view, updates, seen, jumps);
      const s = view.armies.get(a.id)!;
      regions.add(s.region);
      // A summary of a token on an edge always carries its pace (and the
      // army card its arrival).
      if (
        s.move !== null &&
        s.move.from !== s.move.to &&
        (s.move.stepPm <= 0 || s.mine!.etaTicks < 0)
      ) {
        frozen++;
      }
      if (s.region === 7 && s.move === null) break;
    }
    expect(view.armies.get(a.id)!.region).toBe(7);
    // Berlin, a region between, Krakow.
    expect(regions.size).toBe(3);
    expect(frozen).toBe(0);
    // A step is about two tiles at the infantry's pace; a region is 40+.
    expect(jumps.get(a.id)!).toBeLessThan(5);
  });

  test("a division walking elsewhere does not pull the token off its region", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_POL);
    const g = runner.game;
    const l = land(g);
    const t = l.divisions;
    const view = new WwLandView(g.worldWar()!.scenario);
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    // Three divisions stand in Berlin; the army's fourth walks Munich → Berlin.
    const a = placeArmy(g, "DEU", 3, 4);
    const r = t.rowOf(a.divisions[3]);
    l.setDivisionRegion(r, 4);
    t.dest[r] = 4;
    step(runner);
    let seen = feed(view, updates, 0, new Map());
    startHopInto(l, t.rowOf(a.divisions[3]), 3, MOVE_WALK);
    const jumps = new Map<number, number>();
    for (let i = 0; i < 5; i++) {
      step(runner);
      seen = feed(view, updates, seen, jumps);
      const s = view.armies.get(a.id)!;
      expect(s.region).toBe(3);
      // The token stands on Berlin (no move of its own region's divisions).
      expect(s.move === null || s.move.from === s.region).toBe(true);
      expect(view.tokenXY(s, g.ticks())).toEqual(centerXY(g, 3));
    }
    expect(jumps.get(a.id) ?? 0).toBe(0);
  });
});
