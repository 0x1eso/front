import { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import {
  MessageType,
  PlayerType,
  TerraNullius,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  AFTERMATH_TRUCE_TICKS,
  AGGRESSION_GOAL_PCT,
  CONVENE_COST_MILLI,
  ELIMINATION_MEMORY_TICKS,
  EMERGENCY_AGGRESSION_PCT,
  EMERGENCY_DURATION_TICKS,
  EMERGENCY_GLOBAL_COOLDOWN_TICKS,
  EMERGENCY_MAX_PER_GAME,
  EMERGENCY_NUKE_SCORE,
  EMERGENCY_TARGET_COOLDOWN_TICKS,
  HEGEMONY_GOAL_PCT,
  HEGEMONY_THRESHOLDS_PCT,
  HERO_MULT,
  LAND_GOAL_MIN_TILES,
  NUCLEAR_NO_SILO_GOAL_PCT,
  NUCLEAR_SUCCESS_BAN_TICKS,
  nukeScore,
  NukeWeapon,
  REWARD_INFLUENCE_MILLI,
  REWARD_SECONDS,
  SILO_CREDIT_WORLD_PCT,
  SURVIVE_INFLUENCE_MILLI,
  SURVIVE_SECONDS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  ConveneBlock,
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import type { Game, Player } from "../game/Game";
import type { AvailableEmergency, Congress, ItemResult } from "./Congress";
import { aggressionPct, isLedgerPlayer, landSharePct } from "./Metrics";

// Emergencies (spec §9): rare, and only ever opened by someone convening
// one. A nation crossing a threshold only puts it on the available list.

/** How many hegemony thresholds (40%, 55%) `p`'s land share has passed. */
export function hegemonyLevel(mg: Game, p: Player): number {
  const share = landSharePct(mg, p);
  return HEGEMONY_THRESHOLDS_PCT.filter((t) => share >= t).length;
}

/** Spec §9.1: the worst kind `p` qualifies for now (nuclear > aggression > hegemony), or null. */
export function emergencyKindFor(
  mg: Game,
  c: Congress,
  p: Player,
): EmergencyKind | null {
  const pc = p.congress();
  if (pc === null) return null;
  const now = mg.ticks();
  if (pc.nukeScore(now) >= EMERGENCY_NUKE_SCORE) return "nuclear";
  const elim = c.lastElimination(p.smallID());
  if (
    aggressionPct(mg, p, now) >= EMERGENCY_AGGRESSION_PCT ||
    (elim !== null && now - elim <= ELIMINATION_MEMORY_TICKS)
  ) {
    return "aggression";
  }
  if (hegemonyLevel(mg, p) > c.hegemonyLevelUsed(p.smallID())) {
    return "hegemony";
  }
  return null;
}

/**
 * Spec §9.1: what can be convened now, one entry per target. Nothing while
 * an emergency runs or is voted on, without seats, in the global cooldown,
 * after EMERGENCY_MAX_PER_GAME, or once there is a winner. Everyone hears
 * when an entry appears. (A regular vote and the guard before the next
 * session only close the convening window, conveneWindowOpen: the entry
 * stays listed.)
 */
export function refreshAvailability(mg: Game, c: Congress): void {
  const now = mg.ticks();
  const open =
    mg.getWinner() === null &&
    c.seats().length > 0 &&
    c.emergency() === null &&
    c.session()?.kind !== "emergency" &&
    now >= c.globalCooldownUntil() &&
    c.emergenciesStarted() < EMERGENCY_MAX_PER_GAME;
  const prev = c.available();
  const next: AvailableEmergency[] = [];
  if (open) {
    for (const p of mg.players()) {
      if (!isLedgerPlayer(p) || now < c.targetCooldownUntil(p.smallID())) {
        continue;
      }
      const kind = emergencyKindFor(mg, c, p);
      if (kind === null) continue;
      const old = prev.find((a) => a.kind === kind && a.target === p.smallID());
      next.push({
        kind,
        target: p.smallID(),
        sinceTick: old?.sinceTick ?? now,
      });
      if (old === undefined) {
        announce(mg, "events_display.congress_emergency_available", kind, p);
      }
    }
  }
  c.setAvailable(next);
}

/** convene_emergency (spec §9.2): pays 50 influence and opens the 20 s vote with the convener's yes. */
export function conveneEmergency(
  mg: Game,
  convener: Player,
  kind: EmergencyKind,
  target: Player,
): ConveneBlock | null {
  const c = mg.congress();
  if (c === null) return "unavailable";
  const now = mg.ticks();
  const pc = convener.congress();
  const block = conveneBlock({
    // The list can be up to 9 ticks old: a target that died or left the
    // ledger since can't be convened against.
    available:
      target.isAlive() &&
      isLedgerPlayer(target) &&
      c
        .available()
        .some((a) => a.kind === kind && a.target === target.smallID()),
    windowOpen: conveneWindowOpen(
      now,
      c.session() !== null,
      c.emergency() !== null,
      c.nextSessionTick(),
    ),
    seated: convener.isAlive() && c.isSeated(convener.smallID()),
    isTarget: convener === target,
    friendlyToTarget: convener.isFriendly(target, true),
    sanctioned: c.isSanctioned(convener.smallID()),
    influenceMilli: pc?.influenceMilli() ?? 0,
  });
  if (block !== null || pc === null) return block ?? "influence";
  pc.spend(CONVENE_COST_MILLI);
  const session = c.openSession(
    "emergency",
    [
      {
        resolution: "emergency",
        targets: [target.smallID()],
        param: kind,
        reason: "convened",
        reasonValue: convener.smallID(),
      },
    ],
    now,
  );
  c.castBallot(convener, session.id, 0, "A", 0);
  // One at a time (spec §9.1): nothing stays listed while this one votes.
  refreshAvailability(mg, c);
  announce(mg, "events_display.congress_emergency_convened", kind, target, {
    targetID: convener.smallID(),
  });
  return null;
}

/** After an emergency vote (spec §9.3): it starts, or the cooldowns do. */
export function onEmergencyVote(mg: Game, c: Congress, r: ItemResult): void {
  const now = mg.ticks();
  const targetID = r.item.targets[0];
  const target = mg.playerBySmallID(targetID);
  const kind = r.item.param as EmergencyKind;
  if (r.adopted !== "A" || !target.isPlayer() || !target.isAlive()) {
    c.setGlobalCooldown(now + EMERGENCY_GLOBAL_COOLDOWN_TICKS);
    c.setTargetCooldown(targetID, now + EMERGENCY_TARGET_COOLDOWN_TICKS);
    // A target that died during the vote isn't "rejected 3:1": no message.
    if (target.isPlayer() && !target.isAlive()) return;
    announce(mg, "events_display.congress_emergency_rejected", kind, target, {
      a: r.a,
      b: r.b,
    });
    return;
  }
  startEmergency(mg, c, kind, target, r.aVoters, r.bVoters);
  announce(mg, "events_display.congress_emergency_started", kind, target, {
    a: r.a,
    b: r.b,
  });
}

/**
 * Spec §9.4: goals fixed now; the yes voters (never the target or its
 * friends) are the first members. Aggression and hegemony take a share of
 * the target's land, at least LAND_GOAL_MIN_TILES; the nuclear one half its
 * finished silos, or 10% of its land when it has none.
 */
export function startEmergency(
  mg: Game,
  c: Congress,
  kind: EmergencyKind,
  target: Player,
  supporters: readonly number[],
  opposed: readonly number[],
): void {
  const now = mg.ticks();
  const tiles = target.numTilesOwned();
  const share = (pct: number) => Math.ceil((tiles * pct) / 100);
  const silos =
    kind === "nuclear"
      ? target
          .units(UnitType.MissileSilo)
          .filter((u) => !u.isUnderConstruction())
      : [];
  let goal: number;
  if (silos.length > 0) {
    goal = Math.max(1, Math.ceil(silos.length / 2));
  } else if (kind === "nuclear") {
    goal = Math.max(1, share(NUCLEAR_NO_SILO_GOAL_PCT));
  } else {
    goal = Math.max(
      LAND_GOAL_MIN_TILES,
      share(kind === "aggression" ? AGGRESSION_GOAL_PCT : HEGEMONY_GOAL_PCT),
    );
  }
  const members = supporters.filter((id) => {
    if (id === target.smallID()) return false;
    const p = mg.playerBySmallID(id);
    return p.isPlayer() && !p.isFriendly(target, true);
  });
  c.setEmergency({
    kind,
    target: target.smallID(),
    startTick: now,
    endTick: now + EMERGENCY_DURATION_TICKS[kind],
    goalKind: silos.length > 0 ? "silos" : "land",
    goal,
    progress: 0,
    members,
    opposed: [...opposed],
    contributions: new Map(),
    goalSilos: silos,
    countedSilos: [],
  });
  c.countEmergencyStarted();
  if (kind === "hegemony") {
    c.useHegemonyLevel(target.smallID(), hegemonyLevel(mg, target));
  }
}

/** GameImpl.conquer: a tile of the target taken. Late joiners become members (spec §9.4). */
export function emergencyConquer(
  _mg: Game,
  c: Congress,
  prev: Player,
  next: Player,
): void {
  const e = c.emergency();
  if (e === null || prev.smallID() !== e.target) return;
  const id = next.smallID();
  const joins = !e.members.includes(id);
  if (
    joins &&
    (e.opposed.includes(id) ||
      !isLedgerPlayer(next) ||
      next.isFriendly(prev, true))
  ) {
    return;
  }
  c.updateEmergency((x) => {
    if (joins) x.members.push(id);
    x.contributions.set(id, (x.contributions.get(id) ?? 0) + 1);
    if (x.goalKind === "land") x.progress++;
  });
}

/** Goal silos destroyed or out of the target's hands count, whoever did it; a member who did it earns the credit. */
function countSilos(mg: Game, c: Congress): void {
  const e = c.emergency();
  if (e === null) return;
  const credit = Math.ceil((mg.numLandTiles() * SILO_CREDIT_WORLD_PCT) / 100);
  for (const silo of e.goalSilos) {
    if (e.countedSilos.includes(silo.id())) continue;
    if (silo.isActive() && silo.owner().smallID() === e.target) continue;
    const by = silo.isActive() ? silo.owner() : silo.destroyer();
    c.updateEmergency((x) => {
      x.countedSilos.push(silo.id());
      x.progress++;
      if (by !== undefined && x.members.includes(by.smallID())) {
        x.contributions.set(
          by.smallID(),
          (x.contributions.get(by.smallID()) ?? 0) + credit,
        );
      }
    });
  }
}

/** Once a second: the running emergency's progress and end, then the available list. */
export function processEmergencySecond(mg: Game, c: Congress): void {
  if (c.emergency()?.goalKind === "silos") countSilos(mg, c);
  const e = c.emergency();
  if (e !== null) {
    const target = mg.playerBySmallID(e.target);
    if (!target.isPlayer() || !target.isAlive() || e.progress >= e.goal) {
      finishEmergency(mg, c, true);
    } else if (mg.ticks() >= e.endTick) {
      finishEmergency(mg, c, false);
    }
  }
  refreshAvailability(mg, c);
}

function rewardOutput(p: Player, seconds: number): void {
  const d = p.domestic();
  if (d === null) return;
  d.grantPoints(
    d.scienceMilliPerSecond() * seconds,
    d.politicalMilliPerSecond() * seconds,
  );
}

/** Spec §9.5: the members' rewards or the target's, the aftermath truces and the cooldowns. */
export function finishEmergency(mg: Game, c: Congress, success: boolean): void {
  const e = c.emergency();
  if (e === null) return;
  const now = mg.ticks();
  const { kind, target: targetID } = e;
  const target = mg.playerBySmallID(targetID);
  const hero = c.emergencyHero();
  const contributions = [...e.contributions];
  const members = [...e.members];
  if (success) {
    for (const [id, n] of contributions) {
      if (n <= 0) continue;
      const p = mg.playerBySmallID(id);
      if (!p.isPlayer()) continue;
      const mult = id === hero ? HERO_MULT : 1;
      rewardOutput(p, REWARD_SECONDS * mult);
      p.congress()?.grant(REWARD_INFLUENCE_MILLI * mult);
    }
    if (target.isPlayer()) {
      if (kind === "aggression") {
        c.addResolution({
          resolution: "sanction",
          option: "A",
          targets: [targetID],
          param: null,
          sinceTick: now,
          expires: "next_tally",
          source: "emergency",
        });
      } else if (kind === "nuclear") {
        c.addResolution({
          resolution: "arms_embargo",
          option: "A",
          targets: [targetID],
          param: null,
          sinceTick: now,
          expires: now + NUCLEAR_SUCCESS_BAN_TICKS,
          source: "emergency",
        });
      } else {
        target.congress()?.clearInfluence();
      }
    }
  } else if (target.isPlayer()) {
    rewardOutput(target, SURVIVE_SECONDS);
    target.congress()?.grant(SURVIVE_INFLUENCE_MILLI);
    if (kind === "hegemony") {
      c.addResolution({
        resolution: "emergency",
        option: "B",
        targets: [targetID],
        param: "hegemony",
        sinceTick: now,
        expires: "next_tally",
        source: "emergency",
      });
    }
  }
  for (const m of members) {
    c.addResolution({
      resolution: "truce",
      option: "A",
      targets: [targetID, m],
      param: null,
      sinceTick: now,
      expires: now + AFTERMATH_TRUCE_TICKS,
      source: "emergency",
    });
  }
  c.setEmergency(null);
  c.setGlobalCooldown(now + EMERGENCY_GLOBAL_COOLDOWN_TICKS);
  c.setTargetCooldown(targetID, now + EMERGENCY_TARGET_COOLDOWN_TICKS);
  if (!success) {
    announce(mg, "events_display.congress_emergency_failed", kind, target);
  } else if (hero !== null && mg.playerBySmallID(hero).isPlayer()) {
    announce(mg, "events_display.congress_emergency_success", kind, target, {
      targetID: hero,
    });
  } else {
    announce(
      mg,
      "events_display.congress_emergency_success_nohero",
      kind,
      target,
    );
  }
}

/**
 * The victims' side of a nuke, MIRV or orbital strike hit (spec §4.2): the
 * land it took counts as lost, and the shooter as having hit them. Returns
 * the hardest-hit victim other than the shooter, or null.
 */
export function congressNukeLosses(
  mg: Game,
  shooter: Player,
  impacted: ReadonlyMap<Player, number>,
): Player | null {
  const now = mg.ticks();
  let victim: Player | null = null;
  let most = -1;
  for (const [p, tiles] of impacted) {
    if (p === shooter) continue;
    const pc = p.congress();
    if (pc !== null) {
      if (tiles > 0) pc.recordLost(now, tiles);
      pc.recordHitBy(shooter.smallID(), now);
    }
    if (tiles > most) {
      most = tiles;
      victim = p;
    }
  }
  return victim;
}

/**
 * A nuke, MIRV or orbital strike hit (spec §4.2): the victims' losses and
 * who hit them, and the shooter's nuke score when the hardest hit is a
 * human or nation.
 */
export function congressNukeHit(
  mg: Game,
  _c: Congress,
  shooter: Player,
  impacted: ReadonlyMap<Player, number>,
  weapon: NukeWeapon,
): void {
  const victim = congressNukeLosses(mg, shooter, impacted);
  const score = nukeScore(weapon);
  if (score === 0 || victim === null || !isLedgerPlayer(victim)) return;
  shooter.congress()?.recordNuke(mg.ticks(), score);
}

/** GameImpl.conquerPlayer: a human's elimination makes its conqueror's aggression emergency available (spec §9.1). */
export function congressElimination(
  mg: Game,
  c: Congress,
  conqueror: Player,
  conquered: Player,
): void {
  if (conquered.type() !== PlayerType.Human || !isLedgerPlayer(conqueror)) {
    return;
  }
  c.noteElimination(conqueror.smallID(), mg.ticks());
}

/** To everyone, focused on the target (plan decision 12). */
function announce(
  mg: Game,
  key: string,
  kind: EmergencyKind,
  target: Player | TerraNullius,
  extra: Record<string, string | number> = {},
): void {
  mg.displayMessage(
    key,
    MessageType.CONGRESS,
    null,
    undefined,
    {
      kind,
      ...(target.isPlayer() ? { name: target.displayName() } : {}),
      ...extra,
    },
    undefined,
    target.isPlayer() ? target.id() : undefined,
  );
}
