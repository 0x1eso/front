// World War 1936 P2: why an army order cannot be given now (P2 spec §7,
// §8, §15.4), over plain data: the engine's armyOrderBlock and the army
// card's greyed buttons judge the same way. STUB: Task 3 writes the body
// (the signature is final).
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { FrontWorld } from "./FrontRules";

export interface OrderCheckArmy {
  owner: number;
  divisions: number;
  /** Regions its divisions stand in, ascending. */
  regions: readonly number[];
  /** Some division is in a battle / moving by rail or sea. */
  fighting: boolean;
  /** Every division's template has a paratrooper battalion. */
  allPara: boolean;
  paraLastDay: number;
}

export interface OrderCheckWorld extends FrontWorld {
  me: number;
  day: number;
  rail(region: number): number;
  isPort(region: number): boolean;
  /** Victory points of the region (paradrop airfield stand-in). */
  vp(region: number): number;
  army(id: number): OrderCheckArmy | null;
  armyCount(): number;
}

/** Why the army order cannot be given now (army_* and paradrop kinds); null when it can. */
export function landOrderBlockOf(
  w: OrderCheckWorld,
  order: LandOrder,
): WwOrderBlock | null {
  return null;
}
