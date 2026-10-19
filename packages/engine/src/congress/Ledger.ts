import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { CONFLICT_MEMORY_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";
import { isLedgerPlayer } from "./Metrics";

function isHumanOrNation(p: Player): boolean {
  return p.type() === PlayerType.Human || p.type() === PlayerType.Nation;
}

/**
 * Spec §4.1: `next` took one tile from `prev`. Between a connected human or
 * nation and another human or nation, the pair's conflict and the loser's
 * losses are recorded; the taker's aggression counts unless the loser
 * struck first in this conflict, or the capture is exempt.
 */
export function ledgerConquer(
  mg: Game,
  c: Congress,
  prev: Player,
  next: Player,
): void {
  if (prev === next || !isLedgerPlayer(prev) || !isHumanOrNation(next)) {
    return;
  }
  const now = mg.ticks();
  const pair = c.touchPair(next.smallID(), prev.smallID(), now);
  const lost = prev.congress();
  if (lost !== null) {
    lost.recordLost(now, 1);
    lost.recordHitBy(next.smallID(), now);
  }
  if (pair.initiator !== next.smallID()) return;
  if (aggressionExempt(mg, c, next, prev)) return;
  next.congress()?.recordTaken(now, 1);
}

/**
 * Spec §4.2: an outgoing, non-retreating attack on a connected human or
 * nation that isn't defense (the target started this conflict) or exempt.
 * A boat at sea isn't an attack yet.
 */
export function isAggressing(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const now = mg.ticks();
  for (const attack of player.outgoingAttacks()) {
    if (attack.retreating()) continue;
    const target = attack.target();
    if (!target.isPlayer() || !isLedgerPlayer(target)) continue;
    const pair = c.pair(player.smallID(), target.smallID());
    const defending =
      pair !== undefined &&
      now - pair.lastTick <= CONFLICT_MEMORY_TICKS &&
      pair.initiator === target.smallID();
    if (defending || aggressionExempt(mg, c, player, target)) continue;
    return true;
  }
  return false;
}

/** Never aggression: an emergency member against the target (spec §9.4), anyone against a condemned project's owner (spec §10.2). */
export function aggressionExempt(
  _mg: Game,
  c: Congress,
  attacker: Player,
  defender: Player,
): boolean {
  if (
    c.isEmergencyTarget(defender.smallID()) &&
    c.isEmergencyMember(attacker.smallID())
  ) {
    return true;
  }
  return c
    .active()
    .some(
      (r) =>
        r.resolution === "world_heritage" &&
        r.option === "B" &&
        r.targets[0] === defender.smallID(),
    );
}
