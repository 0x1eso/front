// World War 1936 P4 → P5 (P5 pre-flight §0-10, §0-2): the places the
// endgame (war score, exiles, disarmament) hooks into the navy and the
// air war. Neutral bodies today; P5's foundation fills them here (the
// lanes only call them at their kill and build sites).
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import type {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwAir } from "../air/WwAir";
import type { CountryEconomy, WwEconomy } from "../economy/WwEconomy";
import type { WwNavy } from "./WwNavy";

/**
 * A ship of `owner` went down (WwNavy.removeShip with sunk; before its row
 * goes): `by` the country that sank it, 0 when nobody did (scuttled,
 * stranded). Every kill site (N2's battles, A2's strikes, C's ASW) passes
 * its killer. Today: nothing.
 */
export function onShipSunk(
  navy: WwNavy,
  shipId: number,
  owner: number,
  cls: ShipClass,
  by: number,
  tick: number,
): void {
  void navy;
  void shipId;
  void owner;
  void cls;
  void by;
  void tick;
}

/**
 * `n` planes of `owner` were shot down or destroyed by `by` (0: nobody).
 * A1's air combat, N2's carrier strikes and A2's paradrops and strikes
 * call it with the planes they take off (Buildings.losePlanes). Today:
 * nothing.
 */
export function onPlanesLost(
  air: WwAir,
  owner: number,
  by: number,
  type: AirType,
  n: number,
): void {
  void air;
  void owner;
  void by;
  void type;
  void n;
}

/**
 * P5 disarmament (a defeated country's restrictions): why `ce` may not
 * build `what` — a dockyard or naval base (P1 construction), a ship class
 * or convoys (lane E's naval_line_add) — or null. Today: never refused.
 */
export function navalBuildBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  what: BuildingId | ShipClass | "convoy",
): WwOrderBlock | null {
  void econ;
  void ce;
  void what;
  return null;
}

/**
 * Capitulation (decision 32; P5 spec §5.2): before the loser's ships and
 * deployments are removed, P5 may move them to an exile country
 * (WwNavy.transferShip / transferUnits); what is still the loser's after
 * this is removed, not sunk. Today: nothing (all of it is removed).
 */
export function exileNavyAndAir(
  navy: WwNavy,
  air: WwAir,
  loser: number,
  victor: number,
): void {
  void navy;
  void air;
  void loser;
  void victor;
}
