import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WarKind } from "@openfront/engine-api/ww1936/EndgameTypes";
import { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "../game/Game";
import { declareWarRules } from "./politics/WarGoals";
import type { WorldWar } from "./WorldWar";

/** P5 (plan decision 38): what a declaration carries beyond P0's. */
export interface DeclareOpts {
  /** The war record's kind (a beat's civil: true → "civil"). */
  war?: WarKind;
  /** P5 lane S: a subject's independence war (no subject refusal). */
  independence?: boolean;
}

/**
 * Why `attacker` may not declare war on `target` now (spec §7.3); null if
 * it may. `join`: a war between the two only (a call to arms, a guarantee,
 * a beat's join), which P3's rules judge apart (P3 spec §14.5).
 */
export function declareWarBlock(
  _mg: Game,
  ww: WorldWar,
  attacker: Player,
  target: Player,
  tick: number,
  join = false,
  opts: DeclareOpts = {},
): DeclareWarBlock | null {
  if (ww.inPrep(tick)) return "prep";
  if (attacker === target) return "self";
  const a = attacker.smallID();
  const b = target.smallID();
  const eg = ww.endgame;
  // P5 (pre-flight §0-1): an exile has no land but is in the game.
  if (
    (!attacker.isAlive() && !eg.isExile(a)) ||
    (!target.isAlive() && !eg.isExile(b))
  ) {
    return "dead";
  }
  if (
    (ww.isCapitulated(a) && !eg.isExile(a)) ||
    (ww.isCapitulated(b) && !eg.isExile(b))
  ) {
    return "capitulated";
  }
  // P5 plan decision 6: both play (a dormant or gone country does not).
  if (!ww.isActor(a) || !ww.isActor(b)) return "dead";
  if (ww.sameFaction(a, b)) return "faction";
  if (ww.isAtWar(a, b)) return "at_war";
  // P3 spec §14.5: the appended reasons.
  const block = declareWarRules(ww.politics, a, b, join).block;
  if (block !== null) return block;
  // P5 (spec §9.1, §10): a puppet fights only its overlord's enemies; an
  // exile declares nothing (it joins its side's wars).
  if (!opts.independence) {
    const s = eg.subjectOf(a);
    if (
      s !== null &&
      (s.level === "integrated" || s.level === "puppet") &&
      !ww.isAtWar(s.overlord, b)
    ) {
      return "subject_restricted";
    }
  }
  if (!join && eg.isExile(a)) return "exile";
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
  opts: DeclareOpts = {},
): number[] {
  if (declareWarBlock(mg, ww, attacker, target, tick, false, opts) !== null) {
    return [];
  }
  const { noGoal } = declareWarRules(
    ww.politics,
    attacker.smallID(),
    target.smallID(),
    false,
  );
  const a = attacker.smallID();
  const b = target.smallID();
  // P5 plan decision 8: the declaration makes a war record; its goal is
  // P3's war goal on the target (pre-flight §B).
  const g = ww.politics.country(a)?.warGoals.find((x) => x.on === b);
  const joined: number[] = [];
  const link = {
    kind: "declare" as const,
    ...(opts.war !== undefined ? { war: opts.war } : {}),
    ...(g !== undefined ? { goal: { type: g.type, group: g.group } } : {}),
  };
  if (ww.setWar(a, b, tick, link)) joined.push(b);
  const warId = ww.endgame.warOfPair(a, b);
  const faction = ww.factionOf(b);
  if (faction !== null) {
    for (const m of ww.factionMembers(faction)) {
      // P5 pre-flight §0-1: exiles of the faction are drawn in too.
      if (m === b || m === a || !ww.isActor(m)) continue;
      if (ww.setWar(a, m, tick, { kind: "into", warId })) joined.push(m);
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
  ww.politics.onWarDeclared(a, target.smallID(), joined, noGoal, tick);
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
  if (declareWarBlock(mg, ww, actor, enemy, tick, true) !== null) return false;
  // P5 plan decision 8: into the enemy's oldest war, on the other side.
  ww.setWar(actor.smallID(), enemy.smallID(), tick, { kind: "into", warId: 0 });
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
  ww.politics.onWarJoined(actor.smallID(), enemy.smallID(), tick);
  return true;
}

/**
 * Spec §7.2: a human's attack or boat on a country it is not at war with is
 * refused, and one line tells them why (as a congress truce does). Nothing
 * for a faction friend (refused as an ally is) or for a war still waiting
 * for the preparation minute to end.
 */
export function reportNotAtWar(
  mg: Game,
  ww: WorldWar,
  attacker: Player,
  target: Player,
): void {
  if (
    !ww.isHumanControlled(attacker.smallID()) ||
    attacker.isFriendly(target)
  ) {
    return;
  }
  if (ww.isAtWar(attacker.smallID(), target.smallID())) return;
  mg.displayMessage(
    "events_display.ww1936_not_at_war",
    MessageType.ATTACK_FAILED,
    attacker.id(),
    undefined,
    { nameTag: ww.tagOf(target.smallID()) },
  );
}
