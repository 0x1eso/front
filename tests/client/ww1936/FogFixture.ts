// World War 1936 P6 (plan Task 12): the fog tests' game. Germany (me) at war
// with Poland on the test map: Poland holds regions 6 and 7 (6 touches
// Germany's 4) and 9 (touches nothing of Germany's). The fake game carries a
// real WwDepthView (Germany's intel row) and a switchable air view.
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import { FogModel } from "../../../src/client/hud/ww1936/FogModel";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { ID, scenario } from "./EconomyFixture";
import { army, fakeLandGame, LandOptions } from "./LandFixture";

export const NEAR = 6;
export const FAR = 9;

export interface FogOptions extends LandOptions {
  /** Germany's army intel level on Poland (0..100); the other domains follow `levels`. */
  level?: number;
  levels?: [number, number, number, number];
  spectator?: boolean;
}

export function fogGame(o: FogOptions = {}) {
  const base = fakeLandGame({
    ticks: 700,
    wars: [["DEU", "POL"]],
    landRegions: [FAR, 6, 7].map((id) => ({
      id,
      controller: ID("POL"),
      supplyMilli: 0,
      useMilli: 0,
      encircled: false,
      counts: [],
    })),
    ...o,
  });
  const depth = new WwDepthView();
  const cap = scenario.countries.length + 1;
  const setLevels = (lv: [number, number, number, number]) => {
    const row = new Array<number>(cap * 4).fill(0);
    for (let d = 0; d < 4; d++) row[ID("POL") * 4 + d] = lv[d];
    depth.apply({
      intel: [{ observer: ID("DEU"), row }],
      fx: [],
      news: [],
    });
  };
  const lv = o.level ?? 0;
  setLevels(o.levels ?? [lv, lv, lv, lv]);
  const state = {
    ticks: o.ticks ?? 700,
    superiority: 0,
    spectator: o.spectator ?? false,
    over: false,
  };
  const air = {
    version: 1,
    mySuperiority: () => state.superiority,
    zones: new Map(),
    deployments: new Map() as Map<
      number,
      { sr: number; mission: string; counts: number[] }
    >,
  };
  const game = {
    ...base.game,
    ticks: () => state.ticks,
    wwDepth: () => depth,
    wwNavy: () => null,
    wwAir: () => air,
    isSpectator: () => state.spectator,
    gameOver: () => state.over,
  };
  return { ...base, game, depth, state, air, setLevels, domain: ID_ARMY };
}

export function newFog(g: ReturnType<typeof fogGame>): FogModel {
  return new FogModel(g.game as never);
}

export { army, ID };
