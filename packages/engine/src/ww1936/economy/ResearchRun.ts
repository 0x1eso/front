// World War 1936 P1: research slots (spec §9). The judgement is final
// (engine-lib EconomyChecks, shared with the screens); the order and
// daily-step bodies are STUBS that Task 5 fills, with final signatures.
import {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Why `ce` may not start `tech` now; null if it may. */
export function researchBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): WwOrderBlock | null {
  return researchBlockOf(
    {
      researched: ce.researched,
      slots: ce.slots.map((s) => s?.tech ?? null),
      slotCount: ce.totals.slotCount,
    },
    tech,
  );
}

export function startResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): WwOrderBlock | null {
  return null;
}

export function cancelResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  slot: number,
): WwOrderBlock | null {
  return null;
}

/** One day of research for `ce` (spec §9.2). */
export function stepResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
  day: number,
): void {}
