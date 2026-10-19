import {
  BallotOption,
  EmergencyKind,
  RESOLUTION_META,
} from "@openfront/engine-api/congress/CongressTypes";
import { LawId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  PlayerType,
  Relation,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  AI_CONVENE_DELAY_TICKS,
  AI_CONVENE_MIN_INFLUENCE_MILLI,
  AI_EXTRA_CAP,
  AI_RESERVE_PCT,
  aiVoteDelayTicks,
  CONFLICT_MEMORY_TICKS,
  extraVoteCostMilli,
  ledgerBucket,
  MAX_EXTRA_VOTES,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import { buildingPactType } from "@openfront/engine-lib/congress/ResolutionEffects";
import { ringSum } from "@openfront/engine-lib/congress/Ring";
import {
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import type { AgendaItem, Congress } from "../../congress/Congress";
import { CongressVoteExecution } from "../../congress/CongressVoteExecution";
import { ConveneEmergencyExecution } from "../../congress/ConveneEmergencyExecution";
import type { Game, Player } from "../../game/Game";
import { nationDomesticPlan, Personality } from "./NationPersonality";
import { findRunawayLeader } from "./NationUtils";

export interface NationVote {
  option: BallotOption;
  extra: number;
}

const MILITARY: ReadonlySet<UnitType> = new Set([
  UnitType.DefensePost,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
  UnitType.Airport,
  UnitType.CoastalBattery,
]);
const ECONOMIC: ReadonlySet<UnitType> = new Set([
  UnitType.City,
  UnitType.Port,
  UnitType.Factory,
]);

/**
 * A nation's part in the congress (spec §11), called every tick from
 * NationExecution: its ballots exactly aiVoteDelayTicks after a session
 * opens, and a convening check on its own tick of each second. No state,
 * no PRNG; nations never see the tally (secret ballot).
 */
export function nationCongressTick(mg: Game, player: Player): void {
  const c = mg.congress();
  const pc = player.congress();
  if (c === null || pc === null || !player.isAlive()) return;
  const now = mg.ticks();
  const s = c.session();
  if (
    s !== null &&
    now === s.openTick + aiVoteDelayTicks(player.smallID()) &&
    now < s.closeTick
  ) {
    // One budget for the whole session: the ballots are cast a tick later,
    // in this order, so each item's extra votes are priced against what the
    // earlier items already committed. That keeps the 30% reserve on the
    // total, and no ballot is refused (losing its free base vote) for lack
    // of influence.
    let committedMilli = 0;
    s.items.forEach((item, index) => {
      if (!c.canVote(player, item)) return;
      const wish = ballotWish(mg, c, player, item);
      if (wish === null) return;
      // A ballot already in is the convener's own yes (Emergencies.ts casts
      // it with no extra votes): raise it on the same side, never switch.
      const existing = pc.ballot(s.id, index);
      if (existing !== null && existing.option !== wish.option) return;
      const from = existing?.extra ?? 0;
      const extra = affordableRaise(
        pc.influenceMilli(),
        from,
        wish.wanted,
        committedMilli,
      );
      if (existing !== null && extra <= from) return;
      committedMilli += extraVoteCostMilli(from, extra);
      mg.addExecution(
        new CongressVoteExecution(player, s.id, index, wish.option, extra),
      );
    });
  }
  if (now % 10 === player.smallID() % 10) maybeConvene(mg, c, player);
}

/**
 * The most extra votes up to `wanted` whose cost stays within 70% of the
 * influence, less `committedMilli` already promised to other items of the
 * same session (the reserve is kept on the total).
 */
export function affordableExtra(
  influenceMilli: number,
  wanted: number,
  committedMilli = 0,
): number {
  return affordableRaise(influenceMilli, 0, wanted, committedMilli);
}

/** Like affordableExtra, for a ballot that already holds `from` extra votes (paid for): never below `from`. */
function affordableRaise(
  influenceMilli: number,
  from: number,
  wanted: number,
  committedMilli: number,
): number {
  if (wanted <= from) return from;
  const budget =
    Math.floor((influenceMilli * (100 - AI_RESERVE_PCT)) / 100) -
    committedMilli;
  let k = Math.min(wanted, MAX_EXTRA_VOTES);
  while (k > from && extraVoteCostMilli(from, k) > budget) k--;
  return k;
}

function other(o: BallotOption): BallotOption {
  return o === "A" ? "B" : "A";
}

function personality(player: Player): Personality {
  return nationDomesticPlan(player.id()).personality;
}

function isHard(mg: Game): boolean {
  const d = mg.config().gameConfig().difficulty;
  return d === Difficulty.Hard || d === Difficulty.Impossible;
}

/** `tick` is on record and no older than the conflict memory (180 s). */
function recent(mg: Game, tick: number | null | undefined): boolean {
  return (
    tick !== null &&
    tick !== undefined &&
    mg.ticks() - tick <= CONFLICT_MEMORY_TICKS
  );
}

/**
 * `them` took land from or nuked `me` in the last 180 s. PlayerCongress
 * prunes its hit list lazily, so the age is checked here.
 */
function isVictimOf(mg: Game, me: Player, them: Player): boolean {
  return recent(mg, me.congress()?.lastHitTick(them.smallID()));
}

/** Land changed hands between us, or they nuked me, in the last 180 s (spec §11.1 rule 3). */
function isEnemy(mg: Game, c: Congress, me: Player, them: Player): boolean {
  return (
    recent(mg, c.pair(me.smallID(), them.smallID())?.lastTick) ||
    isVictimOf(mg, me, them)
  );
}

/**
 * Spec §11.1: the nation's ballot on `item`, or null to abstain.
 * `committedMilli` is influence already promised to extra votes on other
 * items of the same session (nationCongressTick).
 */
export function nationBallot(
  mg: Game,
  c: Congress,
  player: Player,
  item: AgendaItem,
  committedMilli = 0,
): NationVote | null {
  const pc = player.congress();
  const wish = ballotWish(mg, c, player, item);
  if (pc === null || wish === null) return null;
  return {
    option: wish.option,
    extra: affordableExtra(pc.influenceMilli(), wish.wanted, committedMilli),
  };
}

/** The side a nation takes and the extra votes it would like, before what it can afford. */
interface BallotWish {
  option: BallotOption;
  wanted: number;
}

/** `option` with `wanted` extra votes; null abstains. */
function wanting(
  option: BallotOption | null,
  wanted: number,
): BallotWish | null {
  return option === null ? null : { option, wanted };
}

/** Spec §11.1 rules 1-5 and §11.2, or null to abstain. */
function ballotWish(
  mg: Game,
  c: Congress,
  player: Player,
  item: AgendaItem,
): BallotWish | null {
  if (player.congress() === null) return null;
  const cap = AI_EXTRA_CAP[mg.config().gameConfig().difficulty];
  const half = Math.ceil(cap / 2);
  if (item.resolution === "emergency") {
    return emergencyWish(mg, player, item, cap, half);
  }
  const me = player.smallID();
  const favorable = RESOLUTION_META[item.resolution].favorable;
  const targets = item.targets
    .map((id) => mg.playerBySmallID(id))
    .filter((p): p is Player => p.isPlayer());
  // 1. My own case: the side that favours me, with every extra vote I can.
  if (item.targets.includes(me)) {
    return wanting(selfOption(mg, c, player, item, favorable), cap);
  }
  if (holdsParam(player, item)) return wanting("A", cap);
  // 2. An ally's case.
  const ally = targets.find((t) => player.isAlliedWith(t));
  if (ally !== undefined) {
    return wanting(item.resolution === "truce" ? "A" : favorable, half);
  }
  // 3. An enemy's case.
  if (favorable !== null && targets.some((t) => isEnemy(mg, c, player, t))) {
    return wanting(other(favorable), half);
  }
  // 4. The runaway leader (Hard and up).
  if (
    favorable !== null &&
    isHard(mg) &&
    targets.length === 1 &&
    findRunawayLeader(mg) === targets[0] &&
    !player.isFriendly(targets[0])
  ) {
    return wanting(other(favorable), 0);
  }
  // 5. Personality.
  return wanting(personalityOption(mg, player, item, targets[0] ?? null), 0);
}

function selfOption(
  mg: Game,
  c: Congress,
  player: Player,
  item: AgendaItem,
  favorable: BallotOption | null,
): BallotOption | null {
  if (item.resolution !== "truce") return favorable;
  // One side of a truce: a duel when I took more of the pair's land in the
  // last 120 s, a truce otherwise.
  const otherId = item.targets.find((id) => id !== player.smallID());
  const pair =
    otherId === undefined ? undefined : c.pair(player.smallID(), otherId);
  if (pair === undefined) return "A";
  const b = ledgerBucket(mg.ticks());
  const low = player.smallID() === pair.low;
  const mine = ringSum(low ? pair.lowTook : pair.highTook, b, WAR_PAIR_BUCKETS);
  const theirs = ringSum(
    low ? pair.highTook : pair.lowTook,
    b,
    WAR_PAIR_BUCKETS,
  );
  return mine > theirs ? "B" : "A";
}

/** E5 / E6 (spec §11.1 rule 1): my government, or a law I proclaimed, is the parameter. */
function holdsParam(player: Player, item: AgendaItem): boolean {
  const d = player.domestic();
  if (d === null) return false;
  if (item.resolution === "government_resolution") {
    return item.param === d.currentGovernment();
  }
  if (item.resolution === "law_review") {
    const [law, option] = (item.param ?? "").split(":");
    return d.proclaimedLaws().get(law as LawId) === option;
  }
  return false;
}

function techCount(p: Player): number {
  return p.domestic()?.researchedTechs().size ?? 0;
}

/** Over the alive players with a domestic state (humans and nations). */
function medianTechCount(mg: Game): number {
  const counts = mg
    .players()
    .filter((p) => p.domestic() !== null)
    .map(techCount)
    .sort((a, b) => a - b);
  return counts.length === 0 ? 0 : counts[Math.floor(counts.length / 2)];
}

/** Spec §11.1 rule 5 (the personality table); null abstains. */
function personalityOption(
  mg: Game,
  player: Player,
  item: AgendaItem,
  target: Player | null,
): BallotOption | null {
  const p = personality(player);
  const relation = target === null ? Relation.Neutral : player.relation(target);
  switch (item.resolution) {
    case "sanction":
      if (p !== "conqueror") return "A";
      return target !== null &&
        target.numTilesOwned() * 2 >= player.numTilesOwned()
        ? "A"
        : "B";
    case "truce":
    case "protectorate":
    case "war_tax":
    case "arms_embargo":
    case "non_proliferation":
      return p === "conqueror" ? "B" : "A";
    case "arms_treaty":
      return p === "conqueror" || p === "zealot" ? "B" : "A";
    case "hegemony_check":
      return "A";
    case "trade_pact":
      if (p === "conqueror") return "B";
      if (
        p === "zealot" &&
        player.domestic()?.proclaimedLaws().get("diplomacy") === "B"
      ) {
        return "B";
      }
      return "A";
    case "building_pact": {
      const type = buildingPactType(item.param);
      if (type === null) return null;
      switch (p) {
        case "conqueror":
          return MILITARY.has(type) ? "A" : ECONOMIC.has(type) ? "B" : null;
        case "merchant":
          return ECONOMIC.has(type) ? "A" : null;
        case "scholar":
          return type === UnitType.ResearchInstitute ? "A" : null;
        case "zealot":
          return type === UnitType.AdminOffice || type === UnitType.DefensePost
            ? "A"
            : null;
      }
      return null;
    }
    case "research_fund":
      return p === "conqueror" || p === "zealot" ? "B" : "A";
    case "tech_pact":
      return techCount(player) < medianTechCount(mg) ? "A" : "B";
    case "government_resolution":
      if (p === "zealot") return "B";
      return p === "merchant" && item.param === "fascism" ? "B" : null;
    case "law_review":
      return p === "conqueror" ? null : "B";
    case "world_government":
      if (p === "merchant" || p === "zealot") {
        return relation >= Relation.Friendly
          ? "A"
          : relation === Relation.Neutral
            ? null
            : "B";
      }
      return "B";
    case "world_heritage":
      if (p === "conqueror" || p === "scholar") return "B";
      if (p === "merchant") return relation >= Relation.Friendly ? "A" : null;
      return "A";
    default:
      return null;
  }
}

/** Spec §11.2: an emergency vote. */
function emergencyWish(
  mg: Game,
  player: Player,
  item: AgendaItem,
  cap: number,
  half: number,
): BallotWish | null {
  const target = mg.playerBySmallID(item.targets[0]);
  if (!target.isPlayer()) return null;
  if (target === player) return wanting("B", cap);
  if (player.isFriendly(target, true)) return wanting("B", half);
  if (isVictimOf(mg, player, target)) return wanting("A", half);
  if (mg.config().gameConfig().difficulty === Difficulty.Easy) return null;
  const hard = isHard(mg);
  const kind = item.param as EmergencyKind;
  let support = false;
  switch (personality(player)) {
    case "conqueror":
      support = player.sharesBorderWith(target);
      break;
    case "merchant":
      support = hard || player.sharesBorderWith(target);
      break;
    case "scholar":
      support = hard || findRunawayLeader(mg) === target;
      break;
    case "zealot":
      support = kind !== "hegemony" || hard;
      break;
  }
  return support ? wanting("A", 0) : null;
}

/** Spec §11.3: whether `player` wants to convene this emergency against `target`. */
export function wantsToConvene(
  mg: Game,
  player: Player,
  target: Player,
  kind: EmergencyKind,
): boolean {
  if (isVictimOf(mg, player, target)) return true;
  if (!isHard(mg)) return false;
  switch (personality(player)) {
    case "zealot":
      return kind === "nuclear";
    case "merchant":
    case "scholar":
      return kind === "hegemony" && findRunawayLeader(mg) === target;
    case "conqueror":
      return false;
  }
}

/**
 * Spec §11.3: not on Easy, with 80 influence, and only for an emergency
 * listed for 20 s (humans get the first chance). At most one per check.
 */
function maybeConvene(mg: Game, c: Congress, player: Player): void {
  if (mg.config().gameConfig().difficulty === Difficulty.Easy) return;
  const pc = player.congress();
  if (pc === null || pc.influenceMilli() < AI_CONVENE_MIN_INFLUENCE_MILLI) {
    return;
  }
  const now = mg.ticks();
  const windowOpen = conveneWindowOpen(
    now,
    c.session() !== null,
    c.emergency() !== null,
    c.nextSessionTick(),
  );
  for (const a of c.available()) {
    if (now - a.sinceTick < AI_CONVENE_DELAY_TICKS) continue;
    const target = mg.playerBySmallID(a.target);
    if (!target.isPlayer()) continue;
    const block = conveneBlock({
      available: true,
      windowOpen,
      seated: c.isSeated(player.smallID()),
      isTarget: target === player,
      friendlyToTarget: player.isFriendly(target, true),
      sanctioned: c.isSanctioned(player.smallID()),
      influenceMilli: pc.influenceMilli(),
    });
    if (block !== null) continue;
    if (!wantsToConvene(mg, player, target, a.kind)) continue;
    mg.addExecution(new ConveneEmergencyExecution(player, a.kind, target.id()));
    return;
  }
}

// --- Behaviour after results (spec §11.4), read by AiAttackBehavior and
// NationDomesticBehavior. All false / null without a congress, so other
// games play exactly as before.

/** Spec §11.4: not an attack target now — a truce partner, or a protectorate we don't outnumber two to one. */
export function congressSparesTarget(
  mg: Game,
  player: Player,
  other: Player,
): boolean {
  const c = mg.congress();
  if (c === null) return false;
  if (player.isTruceWith(other)) return true;
  const protectorate = c
    .active()
    .some(
      (r) =>
        r.resolution === "protectorate" &&
        r.option === "A" &&
        r.targets[0] === other.smallID(),
    );
  return protectorate && player.troops() < other.troops() * 2;
}

/**
 * The emergency target `player` (a member) should hit first; null
 * otherwise, and for a member that has since allied with the target (it
 * stays a member but can't attack it, spec §9.4).
 */
export function emergencyTargetFor(mg: Game, player: Player): Player | null {
  const e = mg.congress()?.emergency() ?? null;
  if (e === null || !e.members.includes(player.smallID())) return null;
  const target = mg.playerBySmallID(e.target);
  return target.isPlayer() &&
    target.isAlive() &&
    !player.isFriendly(target, true)
    ? target
    : null;
}

/**
 * The running emergency's target, when `player` may take it on: a member,
 * or a nation that would join by taking its land (spec §9.4: not the
 * target, not one that voted against, not the target's friend). Null
 * otherwise. A war tax leaves this target open (spec §11.4).
 */
export function joinableEmergencyTarget(
  mg: Game,
  player: Player,
): Player | null {
  const e = mg.congress()?.emergency() ?? null;
  if (e === null) return null;
  const target = mg.playerBySmallID(e.target);
  if (!target.isPlayer() || !target.isAlive() || target === player) {
    return null;
  }
  if (player.isFriendly(target, true) || player.isTruceWith(target)) {
    return null;
  }
  if (e.members.includes(player.smallID())) return target;
  return e.opposed.includes(player.smallID()) ? null : target;
}

/** Why the congress keeps `player` from starting attacks on humans and nations (spec §11.4), or null. */
export type CongressRestraint = "emergency_target" | "war_tax";

/**
 * Spec §11.4: the emergency target only answers attacks; under a war tax
 * (S4 A) merchants, scholars and zealots start nothing against humans or
 * nations but the emergency target (bots and free land stay open).
 */
export function congressRestraint(
  mg: Game,
  player: Player,
): CongressRestraint | null {
  const c = mg.congress();
  if (c === null) return null;
  if (c.isEmergencyTarget(player.smallID())) return "emergency_target";
  return warTaxBinds(c, player) ? "war_tax" : null;
}

/** A war tax (S4 A) is in force and `player` is a nation that heeds it (not a conqueror). */
function warTaxBinds(c: Congress, player: Player): boolean {
  return (
    player.type() === PlayerType.Nation &&
    personality(player) !== "conqueror" &&
    c.active().some((r) => r.resolution === "war_tax" && r.option === "A")
  );
}

/** `other` attacks `player` by land now, or took land from or nuked it in the last 180 s. */
function isHittingUs(mg: Game, player: Player, other: Player): boolean {
  return (
    isVictimOf(mg, player, other) ||
    player.incomingAttacks().some((a) => a.attacker() === other)
  );
}

/**
 * Spec §11.4, the gate of every attack or strike a nation starts on
 * `other`: AiAttackBehavior.shouldAttack (which the nuke, warfare and
 * strategic behaviours use) and the MIRV choice. Never a spared target
 * (congressSparesTarget). As the emergency target, nothing on a member;
 * under a war tax, nothing on a human or nation but the joinable emergency
 * target (bots stay open). Hitting back at whoever is attacking or hit us
 * isn't starting anything ("반격"). Always true without a congress and for
 * anyone but a nation; reads no PRNG.
 */
export function congressAllowsAttack(
  mg: Game,
  player: Player,
  other: Player,
): boolean {
  const c = mg.congress();
  if (c === null || player.type() !== PlayerType.Nation) return true;
  if (congressSparesTarget(mg, player, other)) return false;
  const asTarget =
    c.isEmergencyTarget(player.smallID()) &&
    c.isEmergencyMember(other.smallID());
  const taxed =
    warTaxBinds(c, player) &&
    other.type() !== PlayerType.Bot &&
    joinableEmergencyTarget(mg, player) !== other;
  return !(asTarget || taxed) || isHittingUs(mg, player, other);
}

/** Spec §11.4: start no attack of our own — as the emergency target, or as a peaceful nation under a war tax. */
export function congressHoldsFire(mg: Game, player: Player): boolean {
  return congressRestraint(mg, player) !== null;
}
