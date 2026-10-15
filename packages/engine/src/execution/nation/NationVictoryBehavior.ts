import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { PROJECT_HOST_MIN_LEVEL } from "@openfront/engine-lib/domestic/Balance";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { VictoryProjectExecution } from "../../domestic/VictoryProjectExecution";
import { Game, Player, Unit } from "../../game/Game";
import { UpgradeStructureExecution } from "../UpgradeStructureExecution";
import { nationDomesticPlan, Personality } from "./NationPersonality";

/**
 * The victory project a nation goes for (spec §9.1, §9.3): scholars the
 * science one, zealots (the faithful) the political one, and only on Hard
 * and Impossible.
 */
export function nationProjectKind(
  difficulty: Difficulty,
  personality: Personality,
): VictoryProjectKind | null {
  if (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible) {
    return null;
  }
  switch (personality) {
    case "scholar":
      return "science";
    case "zealot":
      return "political";
    default:
      return null;
  }
}

/**
 * nationProjectKind for a live nation, by its phase 2 personality plan
 * (fixed by the player id); null right away outside domestic mode.
 */
export function nationProjectKindFor(
  mg: Game,
  player: Player,
): VictoryProjectKind | null {
  if (player.domestic() === null) return null;
  return nationProjectKind(
    mg.config().gameConfig().difficulty,
    nationDomesticPlan(player.id()).personality,
  );
}

/** The highest-level finished host building for `kind` (ties: the oldest). */
export function bestProjectHost(
  player: Player,
  kind: VictoryProjectKind,
): Unit | null {
  let best: Unit | null = null;
  for (const u of player.units(VICTORY_PROJECTS[kind].hostType)) {
    if (u.isUnderConstruction()) continue;
    if (best === null || u.level() > best.level()) best = u;
  }
  return best;
}

function qualified(player: Player, kind: VictoryProjectKind): boolean {
  const d = player.domestic();
  return (
    d !== null &&
    projectQualified(kind, d.hasTech("space_program"), d.governmentTier())
  );
}

/**
 * True while a nation going for `kind` has everything but the cost: it is
 * qualified, runs no project and owns a level 3+ host. NationStructureBehavior
 * builds nothing then, so the gold piles up for the project.
 */
export function nationIsSavingForProject(
  player: Player,
  kind: VictoryProjectKind | null,
): boolean {
  if (kind === null) return false;
  const d = player.domestic();
  if (d === null || d.victoryProject() !== null || !qualified(player, kind)) {
    return false;
  }
  const host = bestProjectHost(player, kind);
  return host !== null && host.level() >= PROJECT_HOST_MIN_LEVEL;
}

/**
 * One victory-project step for a nation going for `kind`, on its action
 * tick: raise its best host towards level 3 one level at a time, then start
 * the project once it can pay. Building the host in the first place is left
 * to NationStructureBehavior's domestic building ratios.
 */
export function nationVictoryTick(
  mg: Game,
  player: Player,
  kind: VictoryProjectKind | null,
): void {
  if (kind === null) return;
  const d = player.domestic();
  if (d === null || d.victoryProject() !== null || !qualified(player, kind)) {
    return;
  }
  const host = bestProjectHost(player, kind);
  if (host === null) return;
  if (host.level() < PROJECT_HOST_MIN_LEVEL) {
    if (player.canUpgradeUnit(host)) {
      mg.addExecution(new UpgradeStructureExecution(player, host.id(), 1));
    }
    return;
  }
  const block = victoryProjectBlock(kind, {
    busy: false,
    qualified: true,
    hostLevel: host.level(),
    gold: player.gold(),
    politicalMilli: d.politicalMilliAvailable(),
  });
  if (block === null) {
    mg.addExecution(new VictoryProjectExecution(player, kind, host.id()));
  }
}
