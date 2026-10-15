import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { researchBlock } from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { ResearchExecution } from "../../domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "../../domestic/SetRecruitTargetExecution";
import { Game, Player } from "../../game/Game";

/**
 * Phase 1: every nation researches in one balanced order (personalities
 * come in phase 2). It covers every tech, so long games keep progressing.
 */
export const BALANCED_RESEARCH_ORDER: readonly TechId[] = [
  "currency",
  "academia",
  "navigation",
  "bureaucracy",
  "fortification",
  "railroad",
  "conscription",
  "scientific_method",
  "steel_ships",
  "banking",
  "printing_press",
  "rocketry",
  "manhattan_project",
  "industrialization",
  "radar",
  "computers",
  "global_trade",
  "globalization",
  "thermonuclear",
  "mirv",
  "space_program",
];

/**
 * Nations start attacks at 50-60% of max troops (AiAttackBehavior's
 * triggerRatio), so the peacetime target must stay above that or they
 * would never attack. Spec §9.2 says 50%; 70% keeps nations functional.
 */
export const NATION_PEACE_RECRUIT_TARGET_PCT = 70;
export const NATION_WAR_RECRUIT_TARGET_PCT = 100;

/** Recruit target and research for one nation; called on its action tick. */
export function nationDomesticTick(mg: Game, player: Player): void {
  const d = player.domestic();
  if (d === null) return;

  const atWar =
    player.incomingAttacks().length > 0 ||
    player.outgoingAttacks().some((a) => a.target().isPlayer());
  const target = atWar
    ? NATION_WAR_RECRUIT_TARGET_PCT
    : NATION_PEACE_RECRUIT_TARGET_PCT;
  if (d.recruitTargetPct() !== target) {
    mg.addExecution(new SetRecruitTargetExecution(player, target));
  }

  if (d.currentResearch() !== null) return;
  for (const tech of BALANCED_RESEARCH_ORDER) {
    if (researchBlock(d.researchedTechs(), false, tech) !== null) continue;
    // Wait for the next tech in order rather than skipping ahead.
    if (d.scienceMilliAvailable() >= TECHS[tech].cost * MILLI) {
      mg.addExecution(new ResearchExecution(player, tech, false));
    }
    return;
  }
}
