// World War 1936 P1: production lines (spec §8). STUB — Task 4 fills the
// bodies; the signatures are final.
import {
  EquipmentType,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

export function addLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  type: EquipmentType,
  gen: number,
  factories: number,
): WwOrderBlock | null {
  return null;
}

export function changeLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  type: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  return null;
}

export function setLineFactories(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  factories: number,
): WwOrderBlock | null {
  return null;
}

export function removeLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
): WwOrderBlock | null {
  return null;
}

export function moveLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  to: number,
): WwOrderBlock | null {
  return null;
}

/** One day of resource allocation and production for `ce` (spec §7.3, §8). */
export function stepProduction(econ: WwEconomy, ce: CountryEconomy): void {}
