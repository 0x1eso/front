import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { VICTORY_PROJECTS } from "@openfront/engine-lib/domestic/Victory";
import { awaitsRatification } from "../congress/WorldGovernment";
import type { Game, Player, Unit } from "../game/Game";
import type { PlayerDomestic } from "./PlayerDomestic";

/** True while `player` runs a victory project that hasn't completed. */
export function hasActiveVictoryProject(player: Player): boolean {
  const p = player.domestic()?.victoryProject() ?? null;
  return p !== null && p.ticksLeft > 0;
}

/** The buildings hosting a running victory project, in players() order. */
export function victoryProjectHosts(mg: Game): Unit[] {
  const hosts: Unit[] = [];
  for (const player of mg.players()) {
    const p = player.domestic()?.victoryProject() ?? null;
    if (p === null || p.ticksLeft === 0) continue;
    const host = mg.unit(p.hostUnitId);
    if (host !== undefined && host.isActive() && host.owner() === player) {
      hosts.push(host);
    }
  }
  return hosts;
}

/** A victory-project message for every player, naming `player`. */
export function announceVictoryProject(
  mg: Game,
  player: Player,
  message: string,
  kind: VictoryProjectKind,
  unitId?: number,
): void {
  mg.displayMessage(
    message,
    MessageType.VICTORY_PROJECT,
    null,
    undefined,
    { name: player.displayName(), project: kind },
    unitId,
    player.id(),
  );
}

/**
 * One second of a player's victory project (spec §8.1): it fails for good
 * when its building is gone or has a new owner, the political project holds
 * while its owner attacks another nation, and everyone hears when it fails
 * or completes. A complete project stays at 0 ticks until WinCheckExecution
 * declares the winner. Runs right after processDomesticSecond, so `d`'s
 * conditions are this second's.
 */
export function processVictoryProjectSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const project = d.victoryProject();
  if (project === null) return;
  // World congress (spec §10.1): a complete, unratified proclamation waits;
  // it still fails if its office is lost meanwhile.
  const waiting = project.ticksLeft === 0 && awaitsRatification(mg, player);
  if (project.ticksLeft === 0 && !waiting) return;
  const host = mg.unit(project.hostUnitId);
  if (host === undefined || !host.isActive() || host.owner() !== player) {
    d.clearVictoryProject();
    announceVictoryProject(
      mg,
      player,
      "events_display.victory_project_failed",
      project.kind,
    );
    return;
  }
  if (waiting) return;
  // The "attacking" condition processDomesticSecond set for this second
  // (spec §7.1): another player is the target and the attack isn't retreating.
  const paused =
    VICTORY_PROJECTS[project.kind].pausesWhileAttacking &&
    d.activeConditions().has("attacking");
  d.advanceVictoryProject(DOMESTIC_INTERVAL_TICKS, paused);
  if (d.victoryProject()?.ticksLeft === 0) {
    announceVictoryProject(
      mg,
      player,
      awaitsRatification(mg, player)
        ? "events_display.world_gov_awaiting"
        : "events_display.victory_project_complete",
      project.kind,
      host.id(),
    );
  }
}
