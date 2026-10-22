// The World War 1936 P5 screens' tests: the politics fixture's fake game
// with a WwEndgameView fed fake endgame updates.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  WwEndgameData,
  WwOccView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { EndgameGame } from "../../../src/client/hud/ww1936/EndgameModel";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import { fakePolGame, type PolOptions } from "./PoliticsFixture";

/** An administered region's row (WwOccView), neutral but for `over`. */
export function occ(
  region: number,
  controller: CountryTag,
  over: Partial<WwOccView> = {},
): WwOccView {
  return {
    region,
    controller: ID(controller),
    resBp: 0,
    targetBp: 0,
    compBp: 0,
    needDeci: 0,
    supDeci: 0,
    factoryPct: 0,
    law: "occ_military",
    uprisingDays: 0,
    ...over,
  };
}

export interface EndOptions extends PolOptions {
  /** The endgame's update (news defaults to none). */
  endgame?: Partial<WwEndgameData>;
  /** Regions the land view shows held by another country: [region, tag]. */
  control?: [number, CountryTag][];
}

/**
 * The politics fixture's game with an endgame view fed `o.endgame`, typed
 * as what the endgame screens read (its players are partial fakes).
 */
export function fakeEndGame(o: EndOptions = {}) {
  const r = fakePolGame(o);
  for (const [region, tag] of o.control ?? []) {
    r.land.controller[region] = ID(tag);
  }
  const eg = new WwEndgameView();
  eg.apply({ news: [], ...o.endgame });
  const game = {
    ...r.game,
    wwEndgame: () => eg,
  } as unknown as EndgameGame;
  return { ...r, game, eg };
}
