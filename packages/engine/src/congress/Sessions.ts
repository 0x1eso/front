import {
  BallotOption,
  BUILDING_PACT_UNITS,
  ResolutionExpiry,
  ResolutionId,
  TRADE_PACT_KINDS,
  TradePactKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  GOVERNMENT_IDS,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { STOCKPILED_NUKES } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  AGGRESSOR_MIN_PCT,
  AGGRESSOR_REPEAT_PCT,
  AI_SEATS,
  MILITARY_LAWS,
  round1,
  RUNAWAY_FACTOR,
  TRUCE_TICKS,
  VICTIM_MIN_PCT,
  WAR_PAIR_MIN_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  domesticScores,
  projectProgress,
} from "@openfront/engine-lib/domestic/Score";
import type { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { domesticScoreInput } from "../domestic/DomesticWinCheck";
import type { Game, Player } from "../game/Game";
import type { AgendaItemInit, Congress, ItemResult } from "./Congress";
import { aggressionPct, isLedgerPlayer, pairPct, victimPct } from "./Metrics";
import { applyAdoption } from "./WorldGovernment";

export interface SecurityCandidate {
  item: AgendaItemInit;
  /** May follow a session with the same kind (an aggressor at 2%+). */
  repeatable: boolean;
}

export type EconomyKind =
  | "trade_pact"
  | "building_pact"
  | "research_fund"
  | "tech_pact"
  | "government_resolution"
  | "law_review";

const ECONOMY_KINDS: readonly EconomyKind[] = [
  "trade_pact",
  "building_pact",
  "research_fund",
  "tech_pact",
  "government_resolution",
  "law_review",
];

/** At the scheduled tick (spec §6.1): seats, then the security, economy and project cards, then the vote opens. */
export function openRegularSession(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): void {
  c.setSeats(pickSeats(mg));
  const security = pickSecurity(mg, c, random);
  const economy = pickEconomy(mg, c, random);
  const project = projectItem(mg);
  c.rememberAgenda(
    security.resolution,
    economy.resolution,
    economy.resolution === "building_pact"
      ? economy.param
      : c.lastBuildingTarget(),
  );
  c.openSession(
    "regular",
    project === null ? [security, economy] : [security, economy, project],
    mg.ticks(),
  );
}

/** Spec §6.2: alive humans and the AI_SEATS nations with the highest domestic score (ties: lower smallID). */
export function pickSeats(mg: Game): number[] {
  const players = mg.players();
  const scores = domesticScores(players.map(domesticScoreInput));
  const humans = players
    .filter((p) => p.type() === PlayerType.Human)
    .map((p) => p.smallID());
  const nations = players
    .map((p, i) => ({ p, score: scores[i].total }))
    .filter((x) => x.p.type() === PlayerType.Nation)
    .sort((a, b) => b.score - a.score || a.p.smallID() - b.p.smallID())
    .slice(0, AI_SEATS)
    .map((x) => x.p.smallID());
  return [...humans, ...nations].sort((a, b) => a - b);
}

function agendaTargets(mg: Game): Player[] {
  return mg.players().filter(isLedgerPlayer);
}

/** The player with the largest value at or above `min` (ties: the first, i.e. lower smallID). */
function best(
  players: readonly Player[],
  value: (p: Player) => number,
  min: number,
): { player: Player; value: number } | null {
  let top: { player: Player; value: number } | null = null;
  for (const p of players) {
    const v = value(p);
    if (v >= min && (top === null || v > top.value))
      top = { player: p, value: v };
  }
  return top;
}

function entry(
  resolution: ResolutionId,
  targets: number[],
  reason: AgendaItemInit["reason"],
  value: number,
  param: string | null = null,
): AgendaItemInit {
  return { resolution, targets, param, reason, reasonValue: round1(value) };
}

/** A finished missile silo, or a stockpiled nuke (strategic weapons). */
function isArmed(p: Player): boolean {
  return (
    p.units(UnitType.MissileSilo).some((u) => !u.isUnderConstruction()) ||
    STOCKPILED_NUKES.some((t) => (p.strategic()?.stock(t) ?? 0) > 0)
  );
}

/** Spec §7.1 steps 1-4, in priority order. */
export function securityCandidates(mg: Game, c: Congress): SecurityCandidate[] {
  const now = mg.ticks();
  const players = agendaTargets(mg);
  const out: SecurityCandidate[] = [];
  const victim = best(players, (p) => victimPct(mg, p, now), VICTIM_MIN_PCT);
  if (victim !== null) {
    out.push({
      item: entry(
        "protectorate",
        [victim.player.smallID()],
        "victim",
        victim.value,
      ),
      repeatable: false,
    });
  }
  const aggressor = best(
    players,
    (p) => aggressionPct(mg, p, now),
    AGGRESSOR_MIN_PCT,
  );
  if (aggressor !== null) {
    out.push({
      item: entry(
        isArmed(aggressor.player) ? "arms_embargo" : "sanction",
        [aggressor.player.smallID()],
        "aggressor",
        aggressor.value,
      ),
      repeatable: aggressor.value >= AGGRESSOR_REPEAT_PCT,
    });
  }
  let pair: { low: number; high: number; pct: number } | null = null;
  for (const p of c.pairs()) {
    const a = mg.playerBySmallID(p.low);
    const b = mg.playerBySmallID(p.high);
    if (!a.isPlayer() || !b.isPlayer() || !a.isAlive() || !b.isAlive()) {
      continue;
    }
    if (!isLedgerPlayer(a) || !isLedgerPlayer(b)) continue;
    const pct = pairPct(mg, p, now);
    if (pct < WAR_PAIR_MIN_PCT) continue;
    // Ties: the pair with the lower smallIDs (spec §3.3), whatever order
    // the conflicts started in.
    if (
      pair === null ||
      pct > pair.pct ||
      (pct === pair.pct &&
        (p.low < pair.low || (p.low === pair.low && p.high < pair.high)))
    ) {
      pair = { low: p.low, high: p.high, pct };
    }
  }
  if (pair !== null) {
    out.push({
      item: entry("truce", [pair.low, pair.high], "war_pair", pair.pct),
      repeatable: false,
    });
  }
  const byLand = [...players].sort(
    (a, b) =>
      b.numTilesOwned() - a.numTilesOwned() || a.smallID() - b.smallID(),
  );
  if (
    byLand.length >= 2 &&
    byLand[1].numTilesOwned() > 0 &&
    byLand[0].numTilesOwned() >= byLand[1].numTilesOwned() * RUNAWAY_FACTOR
  ) {
    out.push({
      item: entry(
        "hegemony_check",
        [byLand[0].smallID()],
        "runaway",
        byLand[0].numTilesOwned() / byLand[1].numTilesOwned(),
      ),
      repeatable: false,
    });
  }
  return out;
}

/** Spec §7.1: the first candidate not of the last session's kind (unless repeatable), else a world rule. */
export function pickSecurity(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): AgendaItemInit {
  const last = c.lastSecurityKind();
  for (const cand of securityCandidates(mg, c)) {
    if (cand.item.resolution !== last || cand.repeatable) return cand.item;
  }
  const globals: ResolutionId[] = ["war_tax", "arms_treaty"];
  if (
    mg
      .players()
      .some((p) => p.domestic()?.hasTech("manhattan_project") === true)
  ) {
    globals.push("non_proliferation");
  }
  const pool = globals.filter((g) => g !== last);
  return entry(pool[random.nextInt(0, pool.length)], [], "global", 0);
}

function pickEconomy(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): AgendaItemInit {
  const built = c.takeBuiltCounts();
  const available = availableEconomyKinds(mg, c, built);
  const last = c.lastEconomyKind();
  let pool = available.filter((k) => k !== last);
  if (pool.length === 0) pool = available;
  const kind = pool[random.nextInt(0, pool.length)];
  return economyItem(mg, c, kind, built, random);
}

function mostBuilt(
  c: Congress,
  built: ReadonlyMap<string, number>,
): { key: string; count: number } | null {
  let top: { key: string; count: number } | null = null;
  for (const u of BUILDING_PACT_UNITS) {
    if (u.key === c.lastBuildingTarget()) continue;
    const count = built.get(u.key) ?? 0;
    if (count > 0 && (top === null || count > top.count)) {
      top = { key: u.key, count };
    }
  }
  return top;
}

function topAggressor(mg: Game): Player | null {
  return (
    best(agendaTargets(mg), (p) => aggressionPct(mg, p), AGGRESSOR_MIN_PCT)
      ?.player ?? null
  );
}

function targetGovernment(
  mg: Game,
): { government: GovernmentId; aggressor: Player | null } | null {
  const aggressor = topAggressor(mg);
  const own = aggressor?.domestic()?.currentGovernment();
  if (aggressor !== null && own !== undefined && own !== "chiefdom") {
    return { government: own, aggressor };
  }
  const counts = new Map<GovernmentId, number>();
  for (const p of agendaTargets(mg)) {
    const g = p.domestic()?.currentGovernment();
    if (g !== undefined && g !== "chiefdom") {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  let top: GovernmentId | null = null;
  for (const g of GOVERNMENT_IDS) {
    if ((counts.get(g) ?? 0) > (top === null ? 0 : (counts.get(top) ?? 0))) {
      top = g;
    }
  }
  return top === null ? null : { government: top, aggressor: null };
}

function aggressorLaws(mg: Game): {
  aggressor: Player | null;
  laws: (typeof MILITARY_LAWS)[number][];
} {
  const aggressor = topAggressor(mg);
  const laws = aggressor?.domestic()?.proclaimedLaws();
  return {
    aggressor,
    laws:
      laws === undefined
        ? []
        : MILITARY_LAWS.filter((m) => laws.get(m.law) === m.option),
  };
}

/** Spec §7.2: the economy kinds that have something to name now. */
export function availableEconomyKinds(
  mg: Game,
  c: Congress,
  built: ReadonlyMap<string, number>,
): EconomyKind[] {
  return ECONOMY_KINDS.filter((k) => {
    switch (k) {
      case "building_pact":
        return mostBuilt(c, built) !== null;
      case "government_resolution":
        return targetGovernment(mg) !== null;
      case "law_review":
        return aggressorLaws(mg).laws.length > 0;
      default:
        return true;
    }
  });
}

/** Spec §7.2: the card of `kind` (which must be available). */
export function economyItem(
  mg: Game,
  c: Congress,
  kind: EconomyKind,
  built: ReadonlyMap<string, number>,
  random: PseudoRandom,
): AgendaItemInit {
  switch (kind) {
    case "trade_pact": {
      const factories = mg
        .units(UnitType.Factory)
        .some((u) => !u.isUnderConstruction());
      const kinds: readonly TradePactKind[] = factories
        ? TRADE_PACT_KINDS
        : ["tradeShip"];
      const param =
        kinds.length > 1 ? kinds[random.nextInt(0, kinds.length)] : kinds[0];
      return entry("trade_pact", [], "global", 0, param);
    }
    case "building_pact": {
      const top = mostBuilt(c, built);
      return entry(
        "building_pact",
        [],
        "most_built",
        top?.count ?? 0,
        top?.key ?? null,
      );
    }
    case "research_fund":
    case "tech_pact":
      return entry(kind, [], "global", 0);
    case "government_resolution": {
      const t = targetGovernment(mg);
      return {
        resolution: "government_resolution",
        targets: [],
        param: t?.government ?? null,
        reason: t?.aggressor ? "aggressor_government" : "common_government",
        reasonValue: t?.aggressor?.smallID() ?? 0,
      };
    }
    case "law_review": {
      const { aggressor, laws } = aggressorLaws(mg);
      const pick =
        laws.length > 1 ? laws[random.nextInt(0, laws.length)] : laws[0];
      return {
        resolution: "law_review",
        targets: [],
        param: pick === undefined ? null : `${pick.law}:${pick.option}`,
        reason: "aggressor_law",
        reasonValue: aggressor?.smallID() ?? 0,
      };
    }
  }
}

/**
 * Spec §7.3: the running (or waiting) victory project nearest to done
 * (ties: lower smallID). Like every agenda target (spec §7), its owner is a
 * connected human or nation.
 */
export function projectItem(mg: Game): AgendaItemInit | null {
  let top: Player | null = null;
  let left = Infinity;
  for (const p of agendaTargets(mg)) {
    const project = p.domestic()?.victoryProject() ?? null;
    if (project === null) continue;
    if (project.ticksLeft === 0 && project.kind !== "political") continue;
    if (project.ticksLeft < left) {
      top = p;
      left = project.ticksLeft;
    }
  }
  const project = top?.domestic()?.victoryProject() ?? null;
  if (top === null || project === null) return null;
  return {
    resolution:
      project.kind === "political" ? "world_government" : "world_heritage",
    targets: [top.smallID()],
    param: String(project.hostUnitId),
    reason: "project",
    reasonValue: Math.round(projectProgress(project) * 100),
  };
}

/** Spec §8: how long an adopted item lasts; null for the one-shot world-government card. */
export function resolutionExpiry(
  resolution: ResolutionId,
  option: BallotOption,
  now: number,
): ResolutionExpiry | null {
  if (resolution === "world_government") return null;
  if (resolution === "truce") return now + TRUCE_TICKS;
  if (resolution === "world_heritage" && option === "A") return "project_end";
  return "next_tally";
}

/** After a regular tally: the adopted item goes in force, its one-shot effects apply, everyone hears the totals. */
export function onRegularResult(mg: Game, c: Congress, r: ItemResult): void {
  const now = mg.ticks();
  if (r.adopted !== null) {
    const expires = resolutionExpiry(r.item.resolution, r.adopted, now);
    // A project already protected stays protected once: a second A for the
    // same project adds nothing (spec §10.2).
    const already =
      expires === "project_end" &&
      c
        .active()
        .some(
          (x) =>
            x.expires === "project_end" &&
            x.resolution === r.item.resolution &&
            x.option === r.adopted &&
            x.param === r.item.param &&
            x.targets[0] === r.item.targets[0],
        );
    if (expires !== null && !already) {
      c.addResolution({
        resolution: r.item.resolution,
        option: r.adopted,
        targets: [...r.item.targets],
        param: r.item.param,
        sinceTick: now,
        expires,
        source: "session",
      });
    }
    applyAdoption(mg, c, r);
  }
  announceResult(mg, r);
}

function announceResult(mg: Game, r: ItemResult): void {
  const [firstId, secondId] = r.item.targets;
  const first = firstId === undefined ? null : mg.playerBySmallID(firstId);
  const second = secondId === undefined ? null : mg.playerBySmallID(secondId);
  const shape = second?.isPlayer()
    ? "_pair"
    : first?.isPlayer()
      ? "_target"
      : "";
  const params: Record<string, string | number> = {
    resolution: r.item.resolution,
    a: r.a,
    b: r.b,
  };
  if (r.adopted !== null) params.option = r.adopted;
  // The raw subject (building, trade kind, government, law, host unit), so
  // the event log can name it.
  if (r.item.param !== null) params.param = r.item.param;
  if (first?.isPlayer()) params.name = first.displayName();
  if (second?.isPlayer()) params.targetID = second.smallID();
  mg.displayMessage(
    `events_display.congress_${r.adopted === null ? "tied" : "adopted"}${shape}`,
    MessageType.CONGRESS,
    null,
    undefined,
    params,
    undefined,
    first?.isPlayer() ? first.id() : undefined,
  );
}
