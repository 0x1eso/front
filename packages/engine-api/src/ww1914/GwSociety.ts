// Great War 1914 (ww207/ww208): the society under the parties. Axes (the
// Zeitgeist), communities, the factions' ideology, elections and the faction
// utopias (Frostpunk 2's Utopia trees). The words, the state a seat keeps and
// what the screen reads. Rows are engine-lib/ww1914/SocietyRows and
// UtopiaRows, content in content/society/<tag>.ts and content/utopia/, the
// running engine/ww1914/Society (S1) and engine/ww1914/Utopia (S2). See
// /home/eser/dev/ww207-format.md. Lists are APPEND ONLY.
import { z } from "zod";
import type { GwTag } from "./GwCountries";
import type { GwChamber, GwFactionStatus } from "./GwHouse";

// ---- Axes ----

/**
 * The axes. Minus is the first word, plus the second. Common to all five:
 * `rule` (왕권·권위·전제·칙령 / GBR 통제 ↔ 의회·공화 / GBR 자유) and `class`
 * (재산, RUS 지주·자본 ↔ 노동, RUS 농민·노동). Each seat's own: DEU `force`
 * (무력 ↔ 협조), GBR `union` (연합 ↔ 자치), FRA `church` (교회 ↔ 세속), RUS
 * `nations` (하나의 러시아 ↔ 민족들), AUH `dual` (이원 체제 ↔ 민족들).
 * Text (C): gw.society.axis.<axis>.<tag>.{name,minus,plus}, and the lean
 * line gw.society.lean.<axis>.<tag>.<step> ("의회 쪽으로 기울었다").
 */
export const GW_AXES = [
  "rule",
  "class",
  "force",
  "union",
  "church",
  "nations",
  "dual",
] as const;
export type GwAxis = (typeof GW_AXES)[number];

/** Each seat's three axes, in the 정국 tab's order. Absent tag: rule and class. */
export const GW_COUNTRY_AXES: Readonly<
  Partial<Record<GwTag, readonly GwAxis[]>>
> = {
  DEU: ["rule", "class", "force"],
  GBR: ["union", "class", "rule"],
  FRA: ["rule", "class", "church"],
  RUS: ["rule", "class", "nations"],
  AUH: ["rule", "class", "dual"],
};

export function axesOf(tag: GwTag): readonly GwAxis[] {
  return GW_COUNTRY_AXES[tag] ?? ["rule", "class"];
}

/** A step of an axis is this many notches; a bill moves one notch. */
export const GW_AXIS_NOTCHES = 10;
/** An axis runs -GW_AXIS_MAX..GW_AXIS_MAX steps. */
export const GW_AXIS_MAX = 3;

/** A side of an axis: -1 the first word, +1 the second. */
export type GwAxisSide = -1 | 1;
/** A faction's ideals (FP2's three Cornerstones): 0 or absent, no view. */
export type GwIdeals = Readonly<Partial<Record<GwAxis, -1 | 0 | 1>>>;
/** What a bill text, a node or a power pushes: notches by axis. */
export type GwAxisPush = Readonly<Partial<Record<GwAxis, number>>>;

// ---- Words ----

/** Support, 0..GW_FACTION_SUPPORT_MAX: its share of its communities. */
export const GW_FACTION_SUPPORT_MAX = 10;
/**
 * Trust -3..3, a faction's or a community's in the seat, as words:
 * gw.society.trust.<word>, GW_TRUST_WORDS[trust + 3].
 */
export const GW_TRUST_WORDS = [
  "hostile", // 적대
  "distrust", // 불신
  "cold", // 냉담
  "neutral", // 중립
  "warm", // 호의
  "trust", // 신뢰
  "loyal", // 충성
] as const;
export type GwTrustWord = (typeof GW_TRUST_WORDS)[number];
export const GW_TRUST_MAX = 3;
/** A community's size 1..5: gw.society.size.<n> (한 줌 .. 나라의 절반). */
export const GW_COMMUNITY_SIZE_MAX = 5;
/** A community's temper 0..4 (as a faction's): gw.house.temper.<n>. */
export const GW_COMMUNITY_TEMPER_MAX = 4;

// ---- Elections ----

/**
 * How a chamber's seats go out by support. fptp: first past the post, a
 * bonus to the largest (Commons). two_round: alliances (camps) gain in the
 * second round (Reichstag, Chambre). curia: weighted by the franchise in
 * force (the Duma, Budapest, Prussia's votes).
 */
export const GW_ELECTION_RULES = ["fptp", "two_round", "curia"] as const;
export type GwElectionRule = (typeof GW_ELECTION_RULES)[number];

/**
 * The franchise in force, narrowest first: a franchise bill's text sets it
 * (GwLawDraft `franchise`). Text gw.society.franchise.<id>.
 */
export const GW_FRANCHISES = ["estates", "curia", "wide", "equal"] as const;
export type GwFranchise = (typeof GW_FRANCHISES)[number];

/** Why an election came: its term ran out, a dissolution, a new regime, a by-election. */
export const GW_ELECTION_CAUSES = ["due", "dissolved", "regime", "by"] as const;
export type GwElectionCause = (typeof GW_ELECTION_CAUSES)[number];

/** By-elections: every this many chapters, 1..GW_BY_SEATS seats move. */
export const GW_BY_EVERY = 6;
export const GW_BY_SEATS = 3;

// ---- Utopia ----

/** The seven tree templates (C writes them): text gw.utopia.template.<id>. */
export const GW_TREE_TEMPLATES = [
  "parliament", // 의회
  "labour", // 노동
  "crown_army", // 왕권과 군
  "nation", // 민족
  "church", // 교회
  "market_empire", // 시장과 제국
  "peace", // 평화
] as const;
export type GwTreeTemplate = (typeof GW_TREE_TEMPLATES)[number];

/** A tree's tiers, three nodes each: moderate, bold, extreme. */
export const GW_NODE_TIERS = ["moderate", "bold", "extreme"] as const;
export type GwNodeTier = (typeof GW_NODE_TIERS)[number];
/** Nodes a tree has; realisation needs all of them. */
export const GW_TREE_NODES = 9;

/**
 * What a node gives. law: an exclusive law joins the book. institution: a
 * ministry, a paper, a militia, a council (FP2's hub). perk: an econ term or a
 * bloc floor. ability: its ability grows stronger.
 */
export const GW_NODE_KINDS = ["law", "institution", "perk", "ability"] as const;
export type GwNodeKind = (typeof GW_NODE_KINDS)[number];

/** Affinity runs 0..GW_AFFINITY_MAX; a node costs its tier's price. */
export const GW_AFFINITY_MAX = 100;
export const GW_NODE_PRICE: Readonly<Record<GwNodeTier, number>> = {
  moderate: 20,
  bold: 35,
  extreme: 50,
};
/** Realisation: the axes at its ideals this far, its communities over half. */
export const GW_REALISE_AXIS = 2;

/** The player's word on a utopia's regime change (decision 1B). */
export const GW_UTOPIA_CHOICES = ["end", "play"] as const;
export type GwUtopiaChoice = (typeof GW_UTOPIA_CHOICES)[number];

// ---- State ----

const int = z.number().int();
const Id = z.string();

/** A nation's axes, in notches (GW_AXIS_NOTCHES a step); absent axis: 0. */
export const GwAxesSchema = z.partialRecord(z.enum(GW_AXES), int);
export type GwAxes = z.infer<typeof GwAxesSchema>;

export const GwCommunityStateSchema = z.object({
  /** A community row. */
  id: Id,
  /** 1..GW_COMMUNITY_SIZE_MAX. */
  size: int,
  /** -3..3. */
  trust: int,
  /** Heat; temper 0..4 from the row's steps, as a faction's. */
  heat: int,
  step: int,
  /** Its rally or protest came this chapter; -9 never. */
  stirred: int,
});
export type GwCommunityState = z.infer<typeof GwCommunityStateSchema>;

/** An election as it played: the card on the hemicycle (play each uid once). */
export const GwElectionSchema = z.object({
  uid: int,
  chamber: Id,
  cause: z.enum(GW_ELECTION_CAUSES),
  chapter: int,
  /** Faction -> seats before and after, in the hemicycle's order. */
  seats: z.array(z.object({ faction: Id, before: int, after: int })),
});
export type GwElection = z.infer<typeof GwElectionSchema>;

/** A utopia realised (S2), and the player's word on it. */
export const GwUtopiaStateSchema = z.object({
  faction: Id,
  chapter: int,
  /** The regime it brought; null: none changed. */
  regime: Id.nullable(),
  /** Option B: the new head the seat may play on as; null none. */
  head: Id.nullable(),
  /** null: the card waits for the player's word. */
  choice: z.enum(GW_UTOPIA_CHOICES).nullable(),
});
export type GwUtopiaState = z.infer<typeof GwUtopiaStateSchema>;

/** A seat's society: absent until the first chapter that runs it (S1). */
export const GwSocietyStateSchema = z.object({
  communities: z.array(GwCommunityStateSchema),
  /** Births so far (birth row or generic id), with their chapter. */
  births: z.array(z.object({ id: Id, chapter: int })),
  /** The axes (notches) at the last birth: a new one needs all three moved. */
  bornAt: GwAxesSchema,
  /** Elections held, newest last; uid counts up. */
  elections: z.array(GwElectionSchema),
  /** Chamber -> franchise in force, once a bill set it; absent: the row's. */
  franchise: z.record(z.string(), z.enum(GW_FRANCHISES)),
  /** The chapter of the last by-election. */
  byAt: int,
  /** A realised utopia; null none yet. */
  utopia: GwUtopiaStateSchema.nullable(),
  /** ww208 (S1): the axes at the last society step (the view's trend). */
  was: GwAxesSchema.optional(),
});
export type GwSocietyState = z.infer<typeof GwSocietyStateSchema>;

export function gwSocietyStart(): GwSocietyState {
  return {
    communities: [],
    births: [],
    bornAt: {},
    elections: [],
    franchise: {},
    byAt: 0,
    utopia: null,
  };
}

// ---- What the screen reads ----

/** An axis in words: the step and which word it leans to. */
export interface GwAxisView {
  axis: GwAxis;
  /** -3..3: gw.society.lean.<axis>.<tag>.<step>. */
  step: number;
  /** Moved since last chapter: -1, 0, +1. */
  trend: number;
}

export interface GwCommunityView {
  id: string;
  /** Its one ideal. */
  ideal: { axis: GwAxis; side: GwAxisSide };
  /** 1..5: gw.society.size.<n>. */
  size: number;
  /** -3..3: GW_TRUST_WORDS[trust + 3]. */
  trust: number;
  /** 0..4. */
  temper: number;
  /** Factions that draw on it, biggest first. */
  factions: readonly string[];
}

/** A node of a faction's tree on the faction card. */
export interface GwNodeView {
  id: string;
  tier: GwNodeTier;
  kind: GwNodeKind;
  open: boolean;
  /** 연다 is offered: affinity enough, the tier before open, its gate holds. */
  can: boolean;
  /** Why not, a key: gw.utopia.why.<key>; null when it can or is open. */
  why: string | null;
}

/** A faction's ability on its chip and card (a power row). */
export interface GwAbilityView {
  power: string;
  /** The amber dot: 부탁한다 is offered now. */
  ready: boolean;
  /** Turned against the seat (temper 3+): its turned form. */
  turned: boolean;
  /** Greyed: gw.power.why.<key>, else the row's; null when ready. */
  why: string | null;
}

/** A chip of the bottom strip, and its faction card. */
export interface GwStripFactionView {
  id: string;
  bloc: string;
  /** `gone` greys the chip out; it leaves the strip a chapter later. */
  status: GwFactionStatus;
  /** Seats in the first chamber (the strip's order, most first). */
  seats: number;
  /** 0..10: its share of its communities (words on the card). */
  support: number;
  /** -3..3: the standing bar. */
  trust: number;
  /** 0..4: three red marks at 2, 3, 4. */
  temper: number;
  ideals: GwIdeals;
  leader: string | null;
  /** 0..100: the ring round its mark. */
  affinity: number;
  /** Born this chapter or last: "새 당". */
  born: boolean;
  ability: GwAbilityView | null;
  /** Its tree; null for a faction with none. */
  tree: {
    template: GwTreeTemplate;
    /** The utopia's id: gw.utopia.<id> (pack utopia.<id> for a named one). */
    utopia: string;
    nodes: readonly GwNodeView[];
    /** Every node open and the state met: 실현한다 is offered. */
    ready: boolean;
  } | null;
  /** 지지한다 / 규탄한다 are offered (orders faction_promote / condemn). */
  promote: boolean;
  condemn: boolean;
}

/** The election card on the hemicycle, and when the next one is due. */
export interface GwElectionView {
  /** The last election (play its uid once); null none yet. */
  last: GwElection | null;
  /** Chamber -> the chapter its next general election is due; absent none. */
  due: Readonly<Partial<Record<GwChamber, number>>>;
}

/** The society: the strip, the 정국 tab's axes and communities, the card. */
export interface GwSocietyView {
  axes: readonly GwAxisView[];
  communities: readonly GwCommunityView[];
  /** The strip, by seats, most first; born parties with no seats last. */
  factions: readonly GwStripFactionView[];
  election: GwElectionView;
  /** A realised utopia; `choice` null: the card asks (order utopia_choice). */
  utopia: GwUtopiaState | null;
}
