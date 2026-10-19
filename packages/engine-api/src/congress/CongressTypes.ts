import type { TechId } from "../domestic/DomesticTypes";
import { UnitType } from "../game/GameTypes";

// World congress (docs/superpowers/specs/2026-10-19-world-congress-design.md):
// the shared vocabulary only — ids, data shapes and the limits the wire
// schemas check. Numbers and rules live in engine-lib/congress.

/** Spec §8: fourteen resolutions, the two project cards and the emergency vote. */
export const RESOLUTION_IDS = [
  "sanction",
  "truce",
  "protectorate",
  "war_tax",
  "arms_treaty",
  "arms_embargo",
  "non_proliferation",
  "hegemony_check",
  "trade_pact",
  "building_pact",
  "research_fund",
  "tech_pact",
  "government_resolution",
  "law_review",
  "world_government",
  "world_heritage",
  "emergency",
] as const;
export type ResolutionId = (typeof RESOLUTION_IDS)[number];

export const BALLOT_OPTIONS = ["A", "B"] as const;
export type BallotOption = (typeof BALLOT_OPTIONS)[number];

export type ResolutionCategory =
  | "security"
  | "economy"
  | "project"
  | "emergency";
/** Who an item names: one player, the two of a war pair, a parameter (unit, trade kind, government, law) or nobody. */
export type ResolutionTargetKind = "player" | "pair" | "param" | "global";

export interface ResolutionMeta {
  category: ResolutionCategory;
  target: ResolutionTargetKind;
  /** The option that is good for the named player(s); null when neither side is. */
  favorable: BallotOption | null;
}

export const RESOLUTION_META: Readonly<Record<ResolutionId, ResolutionMeta>> = {
  sanction: { category: "security", target: "player", favorable: "B" },
  truce: { category: "security", target: "pair", favorable: null },
  protectorate: { category: "security", target: "player", favorable: "A" },
  war_tax: { category: "security", target: "global", favorable: null },
  arms_treaty: { category: "security", target: "global", favorable: null },
  arms_embargo: { category: "security", target: "player", favorable: "B" },
  non_proliferation: {
    category: "security",
    target: "global",
    favorable: null,
  },
  hegemony_check: { category: "security", target: "player", favorable: "B" },
  trade_pact: { category: "economy", target: "param", favorable: null },
  building_pact: { category: "economy", target: "param", favorable: null },
  research_fund: { category: "economy", target: "global", favorable: null },
  tech_pact: { category: "economy", target: "global", favorable: null },
  government_resolution: {
    category: "economy",
    target: "param",
    favorable: null,
  },
  law_review: { category: "economy", target: "param", favorable: null },
  world_government: {
    category: "project",
    target: "player",
    favorable: "A",
  },
  world_heritage: { category: "project", target: "player", favorable: "A" },
  emergency: { category: "emergency", target: "player", favorable: "B" },
};

/** Spec §9. */
export const EMERGENCY_KINDS = ["aggression", "nuclear", "hegemony"] as const;
export type EmergencyKind = (typeof EMERGENCY_KINDS)[number];

export const SESSION_KINDS = ["regular", "emergency"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Why an item is on the agenda (spec §7); the card shows it as one line. */
export const AGENDA_REASONS = [
  "victim",
  "aggressor",
  "war_pair",
  "runaway",
  "global",
  "most_built",
  "aggressor_government",
  "common_government",
  "aggressor_law",
  "project",
  "convened",
] as const;
export type AgendaReason = (typeof AGENDA_REASONS)[number];

/** Spec §5.1: why influence did (or didn't) grow last second. */
export const INFLUENCE_STATUSES = [
  "peaceful",
  "aggressing",
  "sanctioned",
  "target",
  "capped",
] as const;
export type InfluenceStatus = (typeof INFLUENCE_STATUSES)[number];

/** Until the next regular tally, until the victory project ends, or until a tick. */
export type ResolutionExpiry = "next_tally" | "project_end" | number;

/** Spec §6.3: at most five extra votes on one item. */
export const MAX_EXTRA_VOTES = 5;
/** Security, economy and the project card (spec §7). */
export const MAX_AGENDA_ITEMS = 3;

/**
 * building_pact parameters (spec §7.2), in tie-break order. The key is also
 * the unit's translation key (unit_type.<key>).
 */
export const BUILDING_PACT_UNITS: readonly {
  readonly key: string;
  readonly type: UnitType;
}[] = [
  { key: "city", type: UnitType.City },
  { key: "port", type: UnitType.Port },
  { key: "factory", type: UnitType.Factory },
  { key: "research_institute", type: UnitType.ResearchInstitute },
  { key: "admin_office", type: UnitType.AdminOffice },
  { key: "defense_post", type: UnitType.DefensePost },
  { key: "missile_silo", type: UnitType.MissileSilo },
  { key: "sam_launcher", type: UnitType.SAMLauncher },
  { key: "airport", type: UnitType.Airport },
  { key: "coastal_battery", type: UnitType.CoastalBattery },
];

/** trade_pact parameters: the domestic stat each one scales. */
export const TRADE_PACT_KINDS = ["tradeShip", "train"] as const;
export type TradePactKind = (typeof TRADE_PACT_KINDS)[number];

// Parameter formats (AgendaItemData.param, ActiveResolutionData.param):
//   trade_pact             a TradePactKind
//   building_pact          a BUILDING_PACT_UNITS key
//   government_resolution  a GovernmentId
//   law_review             "<LawId>:<LawOption>", e.g. "doctrine:B"
//   world_government, world_heritage   the host unit id, as a string
//   emergency              an EmergencyKind (also the hegemony-failure bonus)

export interface AgendaItemData {
  resolution: ResolutionId;
  /** smallIDs: one player, a pair (lower first), or none. */
  targets: number[];
  param: string | null;
  reason: AgendaReason;
  /** The reason's number: a percent (one decimal), a ratio, a count, or the convener's smallID. */
  reasonValue: number;
  /** Ballots cast so far. The sides stay secret (spec §6.5). */
  voters: number;
}

export interface SessionData {
  id: number;
  kind: SessionKind;
  openTick: number;
  closeTick: number;
  items: AgendaItemData[];
}

/** A tallied item: totals only, never who voted what. */
export interface ResultData {
  sessionId: number;
  kind: SessionKind;
  tick: number;
  resolution: ResolutionId;
  targets: number[];
  param: string | null;
  a: number;
  b: number;
  /** null: a tie, nothing adopted. */
  adopted: BallotOption | null;
}

export interface ActiveResolutionData {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  sinceTick: number;
  expires: ResolutionExpiry;
}

export interface EmergencyData {
  kind: EmergencyKind;
  target: number;
  startTick: number;
  endTick: number;
  /** "land": tiles to take; "silos": missile silos to destroy or capture. */
  goalKind: "land" | "silos";
  goal: number;
  progress: number;
  members: number[];
  /** The highest contribution so far; null while nobody has one. */
  hero: number | null;
}

export interface AvailableEmergencyData {
  kind: EmergencyKind;
  target: number;
  /** The tick it became available; nations wait a while after it (spec §11.3). */
  sinceTick: number;
}

export interface RankEntry {
  /** smallID. */
  id: number;
  /** Percent, one decimal. */
  pct: number;
}

export interface WorldGovVerdictData {
  owner: number;
  host: number;
  ratified: boolean;
}

/** The congress as sent worker -> main thread (GameUpdateType.Congress). Never mutated. */
export interface CongressData {
  nextSessionTick: number;
  session: SessionData | null;
  /** smallIDs, ascending. */
  seats: number[];
  active: ActiveResolutionData[];
  emergency: EmergencyData | null;
  available: AvailableEmergencyData[];
  /** No emergency can be listed before this tick. */
  cooldownUntilTick: number;
  emergenciesLeft: number;
  /** Newest last; at most HISTORY_LENGTH. */
  history: ResultData[];
  /** tech_pact A: techs that cost 30% less now. */
  discountedTechs: TechId[];
  aggressors: RankEntry[];
  victims: RankEntry[];
  verdicts: WorldGovVerdictData[];
}

export interface BallotData {
  sessionId: number;
  item: number;
  option: BallotOption;
  extra: number;
}

/** One player's congress state on PlayerUpdate.congress. The UI shows only its own player's. */
export interface PlayerCongressData {
  /** Whole points. */
  influence: number;
  influencePerSec: number;
  status: InfluenceStatus;
  ballots: BallotData[];
}
