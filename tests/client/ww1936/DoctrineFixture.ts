// World War 1936 P6 lane U1: a land game with a depth view — my country's
// doctrine and command detail, army groups — for the doctrine screens' tests.
import type {
  WwArmyGroupData,
  WwDepthDetail,
  WwDepthSummary,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { ID, LandOptions, fakeLandGame } from "./LandFixture";

export function depthDetail(
  smallID: number,
  over: {
    doctrine?: Partial<WwDepthDetail["doctrine"]>;
    command?: Partial<WwDepthDetail["command"]>;
  } = {},
): WwDepthDetail {
  return {
    smallID,
    doctrine: {
      gd: [-1, -1, -1],
      gdLock: [-1, -1, -1],
      sub: new Array<number>(9).fill(-1),
      subLock: new Array<number>(9).fill(-1),
      masteryMilli: new Array<number>(9).fill(0),
      gainMilli: new Array<number>(9).fill(0),
      ...over.doctrine,
    },
    command: {
      cpMilli: 34_000,
      cpGainMilli: 400,
      spirits: new Array<number>(7).fill(-1),
      spiritLock: new Array<number>(7).fill(-1),
      medalReady: [],
      ...over.command,
    },
    intel: {
      agency: false,
      upgrades: 0,
      upId: -1,
      upProgressPm: 0,
      operatives: [],
      operations: [],
      cryptoTarget: 0,
      cryptoPm: 0,
      cipher: 0,
      decrypt: 0,
      decrypted: [],
      networks: [],
    },
  } as unknown as WwDepthDetail;
}

export function depthSummary(
  smallID: number,
  over: Partial<WwDepthSummary> = {},
): WwDepthSummary {
  return {
    smallID,
    gd: [-1, -1, -1],
    levels: new Array<number>(9).fill(0),
    cpMilli: 34_000,
    energyPm: 1000,
    mioSize: [],
    fieldMarshals: 0,
    atomicStage: 0,
    atomicStock: 0,
    agency: false,
    ...over,
  };
}

export interface DoctrineOptions extends LandOptions {
  detail?: Parameters<typeof depthDetail>[1];
  summary?: Partial<WwDepthSummary>;
  groups?: WwArmyGroupData[];
}

export function doctrineGame(o: DoctrineOptions = {}) {
  const base = fakeLandGame({ ticks: 700, ...o });
  const me = ID(o.me === undefined ? "DEU" : (o.me ?? "DEU"));
  const depth = new WwDepthView();
  depth.apply({
    countries: [depthSummary(me, o.summary)],
    details: [depthDetail(me, o.detail)],
    armyGroups: o.groups ?? [],
    fx: [],
    news: [],
  });
  const game = {
    ...base.game,
    wwDepth: () => depth,
    wwNavy: () => null,
  };
  return { ...base, game, depth, me };
}
