import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "../game/Game";
import type { WorldWar } from "./WorldWar";

/** Why `attacker` may not declare war on `target` now (spec §7.3); null if it may. */
export function declareWarBlock(
  _mg: Game,
  ww: WorldWar,
  attacker: Player,
  target: Player,
  tick: number,
): DeclareWarBlock | null {
  if (ww.inPrep(tick)) return "prep";
  if (attacker === target) return "self";
  if (!attacker.isAlive() || !target.isAlive()) return "dead";
  const a = attacker.smallID();
  const b = target.smallID();
  if (ww.isCapitulated(a) || ww.isCapitulated(b)) return "capitulated";
  if (ww.sameFaction(a, b)) return "faction";
  if (ww.isAtWar(a, b)) return "at_war";
  return null;
}

/**
 * Spec §7.3: the attacker goes to war with the target and with every living,
 * uncapitulated member of the target's faction; never with members of its
 * own faction. Returns the smallIDs newly at war with it, the target first,
 * and tells everyone.
 */
export function declareWar(
  mg: Game,
  ww: WorldWar,
  attacker: Player,
  target: Player,
  tick: number,
): number[] {
  if (declareWarBlock(mg, ww, attacker, target, tick) !== null) return [];
  const a = attacker.smallID();
  const joined: number[] = [];
  if (ww.setWar(a, target.smallID(), tick)) joined.push(target.smallID());
  const faction = ww.factionOf(target.smallID());
  if (faction !== null) {
    for (const m of ww.factionMembers(faction)) {
      if (m === target.smallID() || m === a || ww.isCapitulated(m)) continue;
      const p = mg.playerBySmallID(m);
      if (!p.isPlayer() || !p.isAlive()) continue;
      if (ww.setWar(a, m, tick)) joined.push(m);
    }
  }
  mg.displayMessage(
    "events_display.ww1936_war_declared",
    MessageType.WORLD_WAR,
    null,
    undefined,
    {
      attackerTag: ww.tagOf(a),
      targetTag: ww.tagOf(target.smallID()),
      allies: joined.length - 1,
    },
  );
  return joined;
}

/** Spec §7.3: a war between the two only (the calendar's "join"). */
export function joinWar(
  mg: Game,
  ww: WorldWar,
  actor: Player,
  enemy: Player,
  tick: number,
): boolean {
  if (declareWarBlock(mg, ww, actor, enemy, tick) !== null) return false;
  ww.setWar(actor.smallID(), enemy.smallID(), tick);
  mg.displayMessage(
    "events_display.ww1936_war_joined",
    MessageType.WORLD_WAR,
    null,
    undefined,
    {
      actorTag: ww.tagOf(actor.smallID()),
      enemyTag: ww.tagOf(enemy.smallID()),
    },
  );
  return true;
}
