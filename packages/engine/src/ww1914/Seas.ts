// Great War 1914 (ww190 §9): who holds a sea, derived from state. No state of
// its own: the sea line, the straits line, who holds Sevastopol and Valona,
// who is still in the war and what the submarines have cost. A scene reads it
// through `{ is: "sea_hold", sea, by }`, from its own side.
import {
  GW_FRONT_START,
  GwSeaZone,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { fights } from "./World";

export type GwSeaCond = Extract<GwWorldCond, { is: "sea_hold" }>;

/** The sea line at or past the Channel (GW_LINES.sea index) is Germany's. */
const SEA_CENTRAL_FROM = 2;
/** The straits line at the Narrows (GW_LINES.straits index): the way is open. */
const NARROWS = 2;
/** Shipping lost from which the Mediterranean is no longer the entente's. */
const MED_LOST_AT = 6;

function lineOf(gw: GreatWar, id: "sea" | "straits"): number {
  const t = gw.s.theatres.find((x) => x.id === id);
  return t === undefined || t.since === null ? GW_FRONT_START[id] : t.line;
}

/** The side that holds a sea; null if neither. */
export function seaHold(gw: GreatWar, sea: GwSeaZone): GwSide | null {
  switch (sea) {
    case "north":
      return lineOf(gw, "sea") >= SEA_CENTRAL_FROM ? "central" : "entente";
    case "black": {
      const ott = gw.nation("OTT");
      const ottOut = ott === null || ott.out || !fights(ott);
      const rus = gw.nation("RUS");
      if (
        rus !== null &&
        fights(rus) &&
        holderOf(gw, "sevastopol") === "RUS" &&
        (ottOut || lineOf(gw, "straits") >= NARROWS)
      ) {
        return "entente";
      }
      return ott !== null && fights(ott) ? "central" : null;
    }
    case "adriatic": {
      const ita = gw.nation("ITA");
      const valona = gw.nation(holderOf(gw, "valona"));
      if (ita?.side === "entente" && valona?.side === "entente") {
        return "entente";
      }
      return fights(gw.nation("AUH")) ? "central" : null;
    }
    case "med":
      return gw.s.shipping >= MED_LOST_AT ? "central" : "entente";
  }
}

export function seaHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwSeaCond,
): boolean {
  const hold = seaHold(gw, c.sea);
  const mine = gw.nation(seat.tag)?.side ?? null;
  switch (c.by) {
    case "none":
      return hold === null;
    case "us":
      return hold !== null && hold === mine;
    case "foe":
      return hold !== null && mine !== null && hold !== mine;
  }
}
