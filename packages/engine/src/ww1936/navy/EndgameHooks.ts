// World War 1936 P4 → P5 (P5 pre-flight §0-10, §0-2): the places the
// endgame (war score, exiles, disarmament) hooks into the navy and the
// air war. The P5 foundation connects them to the endgame (lane W's war
// score, lane X's exile fleets, lane W's disarmament); the P4 lanes only
// call them at their kill and build sites.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import type {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import { SHIP_BASE } from "@openfront/engine-lib/ww1936/ShipStats";
import type { WwAir } from "../air/WwAir";
import type { CountryEconomy, WwEconomy } from "../economy/WwEconomy";
import { exileFleets } from "../endgame/Exile";
import { noteKills } from "../endgame/Wars";
import type { WwNavy } from "./WwNavy";

/**
 * A ship of `owner` went down (WwNavy.removeShip with sunk; before its row
 * goes): `by` the country that sank it, 0 when nobody did (scuttled,
 * stranded). Every kill site (N2's battles, A2's strikes, C's ASW) passes
 * its killer. P5: war score by the class's supremacy weight (lane W).
 */
export function onShipSunk(
  navy: WwNavy,
  shipId: number,
  owner: number,
  cls: ShipClass,
  by: number,
  tick: number,
): void {
  void shipId;
  void tick;
  if (by <= 0 || by === owner) return;
  noteKills(navy.ww.endgame, by, owner, "ship", SHIP_BASE[cls].supWeight);
}

/**
 * `n` planes of `owner` were shot down or destroyed by `by` (0: nobody).
 * A1's air combat, N2's carrier strikes and A2's paradrops and strikes
 * call it with the planes they take off (Buildings.losePlanes). P5: war
 * score (lane W).
 */
export function onPlanesLost(
  air: WwAir,
  owner: number,
  by: number,
  type: AirType,
  n: number,
): void {
  void type;
  if (by <= 0 || by === owner || n <= 0) return;
  noteKills(air.ww.endgame, by, owner, "plane", n);
}

/**
 * P5 (pre-flight §0-10): `n` convoys of `owner` sunk by `by` (lane C's
 * raiding calls it where it takes convoys off). War score (lane W).
 */
export function onConvoysLost(
  navy: WwNavy,
  owner: number,
  by: number,
  n: number,
): void {
  if (by <= 0 || by === owner || n <= 0) return;
  noteKills(navy.ww.endgame, by, owner, "convoy", n);
}

/**
 * P5 disarmament (a defeated country's restrictions): why `ce` may not
 * build `what` — a dockyard or naval base (P1 construction), a ship class
 * or convoys (lane E's naval_line_add) — or null. P5: the treaty's
 * disarmament (lane W's disarmBlockOf).
 */
export function navalBuildBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  what: BuildingId | ShipClass | "convoy",
): WwOrderBlock | null {
  const kind = what === "dock" || what === "naval_base" ? "dock" : "naval";
  return econ.ww.endgame.disarmBlock(ce.smallID, kind);
}

/**
 * Capitulation (decision 32; P5 spec §5.2): before the loser's ships and
 * deployments are removed, P5 may move them to an exile country
 * (WwNavy.transferShip / transferUnits); what is still the loser's after
 * this is removed, not sunk. P5: lane X's exileFleets.
 */
export function exileNavyAndAir(
  navy: WwNavy,
  air: WwAir,
  loser: number,
  victor: number,
): void {
  void air;
  exileFleets(navy.ww.endgame, loser, victor);
}
