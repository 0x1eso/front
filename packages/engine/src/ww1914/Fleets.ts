// STAND-IN (ww221 lane A). Lane F (w221-fleet) owns the real Fleets.ts; at
// the merge take F's file whole. This keeps only the API A builds on
// (/home/eser/dev/ww221-format.md "Engine API for A"), with the plainest
// rules, so the Admiralty's papers typecheck and test on their own.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFleet,
  GwFleetBlock,
  GwFleetMission,
  GwFleetMove,
  GwSeaArea,
  GwSeaFight,
} from "@openfront/engine-api/ww1914/GwFleets";
import { GW_SEA_AREAS } from "@openfront/engine-api/ww1914/GwFleets";
import type { GreatWar } from "./GreatWar";
import { monthsOf } from "./World";

const NEXT: Readonly<Record<GwSeaArea, readonly GwSeaArea[]>> = {
  north: ["channel", "baltic"],
  channel: ["north", "atlantic"],
  atlantic: ["channel", "med"],
  baltic: ["north"],
  med: ["atlantic", "adriatic", "black"],
  adriatic: ["med"],
  black: ["med"],
};

export function fleetOf(gw: GreatWar, id: string): GwFleet | null {
  return gw.s.fleets?.find((f) => f.id === id) ?? null;
}

export function fleetsOf(gw: GreatWar, tag: GwTag): GwFleet[] {
  return (gw.s.fleets ?? []).filter((f) => f.tag === tag);
}

export function fleetMoveBlock(
  gw: GreatWar,
  f: GwFleet,
  to: GwSeaArea,
): GwFleetBlock | null {
  void gw;
  void to;
  if (f.to !== undefined) return "fleet_moving";
  if (f.wear >= 4) return "fleet_repair";
  return null;
}

export function fleetMoves(gw: GreatWar, f: GwFleet): GwFleetMove[] {
  return GW_SEA_AREAS.filter((a) => a !== f.area).map((to) => {
    const why = fleetMoveBlock(gw, f, to);
    return {
      to,
      eta: NEXT[f.area].includes(to) ? 1 : 2,
      open: why === null,
      why,
    };
  });
}

export function sendFleet(gw: GreatWar, id: string, to: GwSeaArea): boolean {
  const f = fleetOf(gw, id);
  if (f === null || fleetMoveBlock(gw, f, to) !== null) return false;
  f.to = to;
  f.eta = gw.s.chapter + (NEXT[f.area].includes(to) ? 1 : 2);
  f.port = false;
  return true;
}

export function orderSortie(
  gw: GreatWar,
  id: string,
  way: "full" | "part" | "stay",
): boolean {
  const f = fleetOf(gw, id);
  if (f === null || f.wear >= 4 || f.to !== undefined) return false;
  if (way === "stay") {
    f.port = true;
    f.mission = "patrol";
    delete f.sortie;
    return true;
  }
  f.port = false;
  f.mission = "strike";
  f.sortie = way;
  return true;
}

export function setMission(
  gw: GreatWar,
  id: string,
  mission: GwFleetMission,
): boolean {
  const f = fleetOf(gw, id);
  if (f === null) return false;
  f.mission = mission;
  return true;
}

export function lastFight(
  gw: GreatWar,
  area: GwSeaArea,
  withinChapters: number,
): GwSeaFight | null {
  const list = (gw.s.seaFights ?? []).filter(
    (x) => x.area === area && gw.s.chapter - x.chapter <= withinChapters,
  );
  return list[list.length - 1] ?? null;
}

export function idleMonths(gw: GreatWar, tag: GwTag): number {
  const big = fleetsOf(gw, tag)
    .filter((f) => f.kind === "battle")
    .sort((a, b) => b.ships - a.ships)[0];
  if (big === undefined || !big.port || big.portSince === undefined) return 0;
  return (gw.s.chapter - big.portSince) * monthsOf(gw);
}

export function sortieWarned(gw: GreatWar, tag: GwTag): boolean {
  void gw;
  void tag;
  return false;
}
