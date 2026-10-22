// A fake game for the P6 designer tests: techs, experience and saved designs.
import type {
  DesignDef,
  WwDesignSlotData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { DesignerGame } from "../../../src/client/hud/ww1936/DesignerModel";

export interface DesignerFake {
  techs?: readonly WwTechId[];
  armyXp?: number;
  designs?: WwDesignSlotData[];
  /** Licence requests waiting (from, to). */
  pendingLicences?: { from: number; to: number }[];
  /** Air force experience, whole points (lane D's detail.doctrine.xp[2]). */
  airXp?: number;
}

export function designerGame(o: DesignerFake = {}) {
  const techs = o.techs ?? WW_TECH_IDS;
  const designs = o.designs ?? [];
  const game = {
    myPlayer: () => ({ smallID: () => 1 }),
    wwEconomy: () => ({
      version: 1,
      detail: () => ({ researched: techs, lines: [], stock: [] }),
    }),
    wwDepth: () => ({
      version: 1,
      treatyData: { members: [], escalated: false, endDay: 0 },
      marketData: { pendingLicences: o.pendingLicences ?? [] },
      detail: () => ({
        designs,
        projects: { done: 0 },
        doctrine: { xp: [42, 30, o.airXp ?? 200] },
      }),
    }),
    wwLand: () => ({
      details: new Map([[1, { armyXpMilli: o.armyXp ?? 42_000 }]]),
    }),
    wwNavy: () => ({ detail: { navyXpMilli: 30_000 } }),
    wwPolitics: () => ({ detail: () => null }),
  };
  return game as unknown as DesignerGame;
}

export function saved(
  def: DesignDef,
  slot: number,
  over: Partial<WwDesignSlotData> = {},
): WwDesignSlotData {
  return {
    kind: def.kind,
    slot,
    def,
    origin: "own",
    from: 0,
    obsolete: false,
    inUse: 0,
    ...over,
  } as WwDesignSlotData;
}
