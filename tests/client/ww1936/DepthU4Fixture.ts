// World War 1936 P6 lane U4 tests: a depth detail and a sea-map game with a
// WwDepthView around it (the real views, fed fake updates).
import type {
  WwDepthDetail,
  WwDepthSummary,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { REGION } from "../../ww1936/seaFixture";
import { seaGame, SeaOptions, seaRegion, SID } from "./SeaAirFixture";

export function depthSummary(
  tag: Parameters<typeof SID>[0],
  over: Partial<WwDepthSummary> = {},
): WwDepthSummary {
  return {
    smallID: SID(tag),
    gd: [-1, -1, -1],
    levels: new Array<number>(9).fill(0),
    cpMilli: 0,
    energyPm: 1000,
    mioSize: [0, 0, 0, 0, 0, 0],
    fieldMarshals: 0,
    atomicStage: 0,
    atomicStock: 0,
    agency: false,
    ...over,
  };
}

export function depthDetail(
  tag: Parameters<typeof SID>[0],
  over: Partial<WwDepthDetail> = {},
): WwDepthDetail {
  return {
    smallID: SID(tag),
    doctrine: {
      gd: [-1, -1, -1],
      gdLock: [],
      sub: [],
      subLock: [],
      masteryMilli: [],
      gainMilli: [],
    },
    command: {
      cpMilli: 0,
      cpGainMilli: 0,
      spirits: [],
      spiritLock: [],
      medalReady: [],
    },
    designs: [],
    mio: {
      arch: [-1, -1, -1, -1, -1, -1],
      fundsMilli: [0, 0, 0, 0, 0, 0],
      traits: [0, 0, 0, 0, 0, 0],
      size: [0, 0, 0, 0, 0, 0],
      points: [0, 0, 0, 0, 0, 0],
      investReady: [0, 0, 0, 0, 0, 0],
    },
    intel: {
      agency: false,
      upgrades: 0,
      upId: -1,
      upProgressPm: 0,
      operatives: [],
      operations: [],
      cryptoTarget: -1,
      cryptoPm: 0,
      cipher: 0,
      decrypt: 0,
      decrypted: [],
      networks: [],
    },
    projects: { running: [], done: 0, scientists: [], facilities: [] },
    market: { licencesIn: [], licencesOut: [], deals: [], listings: [] },
    mech: {
      cfocus: -1,
      cfocusLock: 0,
      cfocusOpen: false,
      congressBp: 0,
      bop: 0,
      bopBand: 2,
      treatyMember: false,
    },
    // W1's view: domestic base, extra supply and the two stocks too.
    energy: {
      demand: 0,
      coal: 0,
      hydro: 0,
      plants: 0,
      dams: 0,
      ratioPm: 1000,
      extra: 0,
      base: 0,
      coalStock: 0,
      uraniumStock: 0,
    },
    ...over,
  };
}

export interface DepthGameOptions extends SeaOptions {
  summary?: Partial<WwDepthSummary>;
  detail?: Partial<WwDepthDetail>;
  market?: NonNullable<Parameters<WwDepthView["apply"]>[0]["market"]>;
}

/** GBR at war with DEU, Berlin German, a depth view with my detail. */
export function depthGame(o: DepthGameOptions = {}) {
  const g = seaGame({
    wars: [["GBR", "DEU"]],
    regions: [seaRegion(REGION.berlin, { civ: 6, mil: 3, dock: 0 })],
    ...o,
  });
  const depth = new WwDepthView();
  depth.apply({
    countries: [depthSummary("GBR", o.summary)],
    details: [depthDetail("GBR", o.detail)],
    market: o.market,
    fx: [],
    news: [],
  });
  const game = { ...g.game, wwDepth: () => depth } as never;
  return { ...g, game, depth };
}
