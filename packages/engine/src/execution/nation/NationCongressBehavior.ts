import {
  BallotOption,
  EmergencyKind,
  RESOLUTION_META,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  Difficulty,
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
      if (pc.ballot(s.id, index) !== null || !c.canVote(player, item)) return;
      const vote = nationBallot(mg, c, player, item, committedMilli);
      if (vote === null) return;
      committedMilli += extraVoteCostMilli(0, vote.extra);
      mg.addExecution(
        new CongressVoteExecution(player, s.id, index, vote.option, vote.extra),
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
  const budget =
    Math.floor((influenceMilli * (100 - AI_RESERVE_PCT)) / 100) -
    committedMilli;
  let k = Math.min(wanted, MAX_EXTRA_VOTES);
  while (k > 0 && extraVoteCostMilli(0, k) > budget) k--;
  return Math.max(0, k);
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
  if (pc === null) return null;
  const cap = AI_EXTRA_CAP[mg.config().gameConfig().difficulty];
  const half = Math.ceil(cap / 2);
  const vote = (option: BallotOption | null, wanted: number) =>
    option === null
      ? null
      : {
          option,
          extra: affordableExtra(pc.influenceMilli(), wanted, committedMilli),
        };
  if (item.resolution === "emergency") {
    return emergencyVote(mg, player, item, cap, half, vote);
  }
  const me = player.smallID();
  const favorable = RESOLUTION_META[item.resolution].favorable;
  const targets = item.targets
    .map((id) => mg.playerBySmallID(id))
    .filter((p): p is Player => p.isPlayer());
  // 1. My own case: the side that favours me, with every extra vote I can.
  if (item.targets.includes(me)) {
    return vote(selfOption(mg, c, player, item, favorable), cap);
  }
  if (holdsParam(player, item)) return vote("A", cap);
  // 2. An ally's case.
  const ally = targets.find((t) => player.isAlliedWith(t));
  if (ally !== undefined) {
    return vote(item.resolution === "truce" ? "A" : favorable, half);
  }
  // 3. An enemy's case.
  if (favorable !== null && targets.some((t) => isEnemy(mg, c, player, t))) {
    return vote(other(favorable), half);
  }
  // 4. The runaway leader (Hard and up).
  if (
    favorable !== null &&
    isHard(mg) &&
    targets.length === 1 &&
    findRunawayLeader(mg) === targets[0] &&
    !player.isFriendly(targets[0])
  ) {
    return vote(other(favorable), 0);
  }
  // 5. Personality.
  return vote(personalityOption(mg, player, item, targets[0] ?? null), 0);
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
    return [...d.proclaimedLaws()].some(([l, o]) => l === law && o === option);
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
function emergencyVote(
  mg: Game,
  player: Player,
  item: AgendaItem,
  cap: number,
  half: number,
  vote: (option: BallotOption | null, wanted: number) => NationVote | null,
): NationVote | null {
  const target = mg.playerBySmallID(item.targets[0]);
  if (!target.isPlayer()) return null;
  if (target === player) return vote("B", cap);
  if (player.isFriendly(target, true)) return vote("B", half);
  if (isVictimOf(mg, player, target)) return vote("A", half);
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
  return support ? vote("A", 0) : null;
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
