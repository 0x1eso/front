import {
  GovernmentId,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  governmentBlock,
  GOVERNMENTS,
  MAX_GOVERNMENT_TIER,
} from "@openfront/engine-lib/domestic/Governments";
import { lawBlock, lawCost } from "@openfront/engine-lib/domestic/Laws";
import { researchBlock } from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { ChooseGovernmentExecution } from "../../domestic/ChooseGovernmentExecution";
import type { PlayerDomestic } from "../../domestic/PlayerDomestic";
import { ProclaimLawExecution } from "../../domestic/ProclaimLawExecution";
import { ResearchExecution } from "../../domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "../../domestic/SetRecruitTargetExecution";
import { Game, Player } from "../../game/Game";
import { NationDomesticPlan, nationDomesticPlan } from "./NationPersonality";
import {
  nationProjectKind,
  nationProjectPoliticalReserveMilli,
} from "./NationVictoryBehavior";

/**
 * Nations start attacks at 50-60% of max troops (AiAttackBehavior's
 * triggerRatio), so the peacetime target must stay above that or they
 * would never attack. Spec §9.2 says 50%; 70% keeps nations functional.
 */
export const NATION_PEACE_RECRUIT_TARGET_PCT = 70;
export const NATION_WAR_RECRUIT_TARGET_PCT = 100;

/** Spec §9.1: a theocracy without state religion settles for monarchy. */
const THEOCRACY_FALLBACK: GovernmentId = "monarchy";

/**
 * Recruit target, research, government and laws for one nation; called on
 * its action tick. `plan` defaults to the nation's own personality plan.
 */
export function nationDomesticTick(
  mg: Game,
  player: Player,
  plan?: NationDomesticPlan,
): void {
  const d = player.domestic();
  if (d === null) return;
  const p = plan ?? nationDomesticPlan(player.id());
  updateRecruitTarget(mg, player, d);
  maybeResearch(mg, player, d, p);
  // Adopting a government restarts the law cooldown; laws wait a check.
  if (maybeChooseGovernment(mg, player, d, p)) return;
  // Political power saved for world government isn't spent on laws.
  const reserveMilli = nationProjectPoliticalReserveMilli(
    mg,
    player,
    nationProjectKind(mg.config().gameConfig().difficulty, p.personality),
  );
  maybeProclaimLaw(mg, player, d, p, reserveMilli);
}

function updateRecruitTarget(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const atWar =
    player.incomingAttacks().length > 0 ||
    player.outgoingAttacks().some((a) => a.target().isPlayer());
  const target = atWar
    ? NATION_WAR_RECRUIT_TARGET_PCT
    : NATION_PEACE_RECRUIT_TARGET_PCT;
  if (d.recruitTargetPct() !== target) {
    mg.addExecution(new SetRecruitTargetExecution(player, target));
  }
}

function maybeResearch(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
): void {
  if (d.currentResearch() !== null) return;
  const tech = nextResearch(d.researchedTechs(), plan.techOrder);
  // Wait for this tech rather than skipping to a cheaper one.
  if (tech !== null && d.scienceMilliAvailable() >= TECHS[tech].cost * MILLI) {
    mg.addExecution(new ResearchExecution(player, tech, false));
  }
}

/**
 * The tech a nation researches next: the first unresearched tech in `order`,
 * or, while that one is still locked, the first tech in `order` that brings
 * it closer (a missing prerequisite, or one more tech of the era below).
 * Without this a locked priority tech fell through to the rest of the
 * order, e.g. a scholar researched every era 1 tech before the second era 2
 * tech that Computers needs. Null once every tech is researched.
 */
export function nextResearch(
  researched: ReadonlySet<TechId>,
  order: readonly TechId[],
): TechId | null {
  for (const goal of order) {
    const step = stepTowards(researched, order, goal);
    if (step !== null) return step;
  }
  return null;
}

/** A tech that can start now and works towards `goal`; null if none does. */
function stepTowards(
  researched: ReadonlySet<TechId>,
  order: readonly TechId[],
  goal: TechId,
): TechId | null {
  const block = researchBlock(researched, false, goal);
  if (block === null) return goal;
  // Prerequisites and earlier eras come strictly before `goal`, so this ends.
  let helpers: readonly TechId[] = [];
  if (block === "era") {
    helpers = order.filter((t) => TECHS[t].era === TECHS[goal].era - 1);
  } else if (block === "prereq") {
    helpers = TECHS[goal].prereqs;
  }
  for (const helper of helpers) {
    if (researched.has(helper)) continue;
    const step = stepTowards(researched, order, helper);
    if (step !== null) return step;
  }
  return null;
}

/** True when it adopted a government this check. */
function maybeChooseGovernment(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
): boolean {
  const open = Math.min(d.governmentTier(), MAX_GOVERNMENT_TIER);
  if (open === 0 || GOVERNMENTS[d.currentGovernment()].tier >= open) {
    return false;
  }
  const blockOf = (government: GovernmentId) =>
    governmentBlock(
      d.governmentTier(),
      d.currentGovernment(),
      d.proclaimedLaws(),
      government,
    );
  let pick = plan.governments[open - 1];
  if (blockOf(pick) === "requires") pick = THEOCRACY_FALLBACK;
  if (blockOf(pick) !== null) return false;
  mg.addExecution(new ChooseGovernmentExecution(player, pick));
  return true;
}

/** Proclaims the next law of the plan, keeping `reserveMilli` political power. */
function maybeProclaimLaw(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
  reserveMilli: number,
): void {
  const laws = d.proclaimedLaws();
  for (const { law, option } of plan.lawOrder) {
    const block = lawBlock(
      law,
      laws.get(law),
      d.researchedTechs(),
      d.lawCooldownUntilTick(),
      mg.ticks(),
    );
    if (block === "proclaimed" || block === "requires") continue;
    if (block === "cooldown") return;
    // Nations never pay a shortfall with gold.
    if (
      d.politicalMilliAvailable() >=
      lawCost(laws.size, d.pct("lawCost")) * MILLI + reserveMilli
    ) {
      mg.addExecution(new ProclaimLawExecution(player, law, option, false));
    }
    return;
  }
}
