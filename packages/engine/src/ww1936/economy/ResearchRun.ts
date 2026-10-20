// World War 1936 P1: research slots (spec §9). The judgement is shared
// with the screens (engine-lib EconomyChecks); the orders and the daily
// step live here.
import { MessageType, PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  freeResearchSlot,
  researchBlockOf,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  aheadPct,
  researchProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { techDays, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

function slotTechs(ce: CountryEconomy): (WwTechId | null)[] {
  return ce.slots.map((s) => s?.tech ?? null);
}

/** Why `ce` may not start `tech` now; null if it may. */
export function researchBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): WwOrderBlock | null {
  return researchBlockOf(
    {
      researched: ce.researched,
      slots: slotTechs(ce),
      slotCount: ce.totals.slotCount,
    },
    tech,
  );
}

/** Puts `tech` in the first empty slot, from no progress (spec §9.3). */
export function startResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): WwOrderBlock | null {
  const block = researchBlock(econ, ce, tech);
  if (block !== null) return block;
  const i = freeResearchSlot(slotTechs(ce), ce.totals.slotCount);
  while (ce.slots.length <= i) ce.slots.push(null);
  ce.slots[i] = { tech, progress: 0 };
  return null;
}

/** Empties a slot; its progress is lost (spec §9.3). */
export function cancelResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  slot: number,
): WwOrderBlock | null {
  if (slot < 0 || slot >= ce.slots.length || ce.slots[slot] === null) {
    return "bad_slot";
  }
  ce.slots[slot] = null;
  return null;
}

/**
 * One day of research for `ce` (spec §9.2). A slot past the slot count
 * pauses with its progress (§9.1). A slot the country never had appears
 * empty, and a human owner hears of it once (§13.6); a finished tech is
 * told to its human owner only (§9.3).
 */
export function stepResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
  day: number,
): void {
  const human = p.type() === PlayerType.Human;
  let added = 0;
  while (ce.slots.length < ce.totals.slotCount) {
    ce.slots.push(null);
    added++;
  }
  if (added > 0 && human) {
    econ.mg.displayMessage(
      "events_display.ww1936_slot_free",
      MessageType.WORLD_WAR,
      p.id(),
    );
  }
  const speed = ce.tech.researchPct + ce.law().researchPct;
  for (let i = 0; i < ce.slots.length && i < ce.totals.slotCount; i++) {
    const s = ce.slots[i];
    if (s === null) continue;
    const def = WW_TECHS[s.tech];
    s.progress += researchProgress(speed, aheadPct(def.year, day));
    if (s.progress < techDays(def.year) * 1000) continue;
    // Done; what runs over is dropped (§9.2).
    ce.addTech(s.tech);
    ce.slots[i] = null;
    if (human) {
      econ.mg.displayMessage(
        "events_display.ww1936_research_done",
        MessageType.WORLD_WAR,
        p.id(),
        undefined,
        { tech: s.tech },
      );
    }
  }
}
