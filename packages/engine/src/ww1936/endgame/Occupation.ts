// P5 lane O fills this file (plan Task 3): occupation — compliance,
// resistance, laws, garrisons' need, integration, uprisings (spec §8). The
// foundation's stub: the region shares are P1's (pre-flight §A T1 × O), the
// rest neutral; a garrison order only sets the army's order.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  OccupationLaw,
  WwOccView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { regionShares } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { setGarrison } from "../land/Orders";
import type { WwEndgame } from "./WwEndgame";

/** Spec §8.3–§8.4: the day of `controller`'s administered regions. Stub: nothing. */
export function stepOccupation(
  eg: WwEndgame,
  controller: number,
  day: number,
): void {
  void eg;
  void controller;
  void day;
}

/**
 * Spec §8.6: what an administered region gives its controller. Stub: P1's
 * regionShares (the legal owner's core from the core table; the owner
 * fights while it is an actor).
 */
export function regionShareOf(
  eg: WwEndgame,
  region: number,
): { factoryPct: number; resourcePct: number; manpowerPct: number } {
  const owner = eg.ww.politics.legalOwner[region] ?? 0;
  const sh = regionShares(
    eg.ww.land.controller[region] ?? 0,
    owner,
    eg.hasCore(owner, region),
    eg.ww.isActor(owner),
  );
  return {
    factoryPct: sh.controlPct,
    resourcePct: sh.controlPct,
    manpowerPct: sh.manpowerPct,
  };
}

/** Spec §8.6: the supply of an administered region, permille. Stub: 1000. */
export function supplyFactorOf(eg: WwEndgame, region: number): number {
  void eg;
  void region;
  return 1000;
}

/** occupation_law (spec §8.2). Stub: refused. */
export function setOccupationLaw(
  eg: WwEndgame,
  by: number,
  of: number,
  law: OccupationLaw,
  day: number,
): WwOrderBlock | null {
  void eg;
  void by;
  void of;
  void law;
  void day;
  return "not_integrable";
}

/** integrate_region (spec §8.7). Stub: refused. */
export function integrateRegion(
  eg: WwEndgame,
  smallID: number,
  region: number,
  day: number,
): WwOrderBlock | null {
  void eg;
  void smallID;
  void region;
  void day;
  return "not_integrable";
}

/**
 * army_garrison (spec §8.5): the army garrisons the administered regions
 * of legal owner `scope` (0: all). The foundation sets the order; lane O's
 * Garrison picks the regions.
 */
export function garrisonOrder(
  eg: WwEndgame,
  smallID: number,
  army: number,
  scope: number,
): WwOrderBlock | null {
  const a = eg.ww.land.armies.get(army);
  if (a === undefined || a.owner !== smallID) return "no_army";
  setGarrison(eg.ww.land, a, scope);
  return null;
}

/** Spec §8.6 uprising: the region rises now. Stub: nothing. */
export function uprisingNow(eg: WwEndgame, region: number, tick: number): void {
  void eg;
  void region;
  void tick;
}

/** The occupation tab's row (spec §21.4). Stub: the state's numbers. */
export function occView(eg: WwEndgame, region: number): WwOccView {
  const c = eg.ww.land.controller[region] ?? 0;
  const owner = eg.ww.politics.legalOwner[region] ?? 0;
  return {
    region,
    controller: c,
    resBp: eg.resBp[region],
    targetBp: 0,
    compBp: eg.compBp[region],
    needDeci: 0,
    supDeci: eg.supDeci[region],
    factoryPct: regionShareOf(eg, region).factoryPct,
    law: eg.occupationLawOf(c, owner),
    uprisingDays: eg.uprDays[region],
  };
}
