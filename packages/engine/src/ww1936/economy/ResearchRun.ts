// World War 1936 P1: research slots (spec §9). The judgement is shared
// with the screens (engine-lib EconomyChecks); the orders and the daily
// step live here.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
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
import { researchSpeedPct } from "@openfront/engine-lib/ww1936/Stats";
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
  const bonusPct = takeResearchBonus(econ, ce, tech);
  ce.slots[i] = { tech, progress: 0, ...(bonusPct === 0 ? {} : { bonusPct }) };
  return null;
}

/**
 * P3 spec §10.4 research_bonus: a tech that starts takes the first bonus
 * for its id or its branch (one use; used up, it goes) and keeps it until
 * it ends.
 */
function takeResearchBonus(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): number {
  const c = econ.ww.politics.country(ce.smallID);
  if (c === null) return 0;
  const branch = WW_TECHS[tech].branch;
  const i = c.researchBonuses.findIndex(
    (b) => b.key === tech || b.key === branch,
  );
  if (i < 0) return 0;
  const b = c.researchBonuses[i];
  b.uses--;
  if (b.uses <= 0) c.researchBonuses.splice(i, 1);
  econ.ww.politics.markCountry(ce.smallID);
  return b.pct;
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
  const human = econ.ww.isHumanControlled(p.smallID());
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
  const lawPct = ce.law().researchPct;
  for (let i = 0; i < ce.slots.length && i < ce.totals.slotCount; i++) {
    const s = ce.slots[i];
    if (s === null) continue;
    const def = WW_TECHS[s.tech];
    // P3 spec §3.4: the branch's research stat and the slot's bonus.
    const speed =
      researchSpeedPct(ce.stats, def.branch) + lawPct + (s.bonusPct ?? 0);
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
