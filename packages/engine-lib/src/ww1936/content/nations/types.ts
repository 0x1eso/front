// ww229 (design ww227 §2-§8): the shape of a minor's national content. One
// folder per country, content/nations/<tag lower>/:
//   index.ts  NATION_<TAG>: NationDef  (tree, events, decisions, spirits,
//             people, groups, claims, its data sheet and AI character)
//   core.ts   CORE_<TAG>: NationCore   (generals, balance of power, own
//             equipment catalogue, start arms), read by engine-lib modules
// A lane may split index.ts into more files in its own folder. Data only
// (ContentPurity); registry.ts's joinNations joins it, helpers.ts has the
// route helper.
//
// A nation is "live" once it has focuses: then it plays its own tree (its
// tag), and its events, decisions, spirits, people and the rest join the
// content. Until then it changes nothing (its old tree, no rows).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { CivilWarSeedDef } from "@openfront/engine-api/ww1936/EndgameTypes";
import type {
  AiLean,
  BranchPoint,
  CountryPoliticsDef,
  DecisionDef,
  EventDef,
  FactionNameDef,
  FocusDef,
  FocusId,
  HistoryBeat,
  Ideology,
  NationTag,
  NationTier,
  PersonDef,
  RegionGroupDef,
  RegionGroupId,
  SpiritDef,
  TemplateUnlockDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { GeneralDef } from "../../Generals";
import type { HistEntry } from "../../hist/Types";
import type { BopDef } from "../../MechRules";

/** Design ww227 §8: how the country's AI leans; the `character` condition reads `lean`. */
export interface AiCharacter {
  lean: AiLean;
  /** The majors it looks to first (aid, licences, guarantees). */
  patrons: readonly CountryTag[];
  /**
   * The AI's weight on each ideology's route, 0 (never) to 3 (strong);
   * absent: 1. Pass it to helpers.nationRouteAi in the route's focuses.
   */
  routeBias?: Partial<Record<Ideology, number>>;
  /** The branch points' deviation, percent (absent: WW_NATION_DEVIATE_*). */
  deviatePct?: { political: number; other: number };
}

/** One historical dilemma of the sheet: a BranchPoint id and what history chose. */
export interface NationDilemma {
  /** The BranchPoint id in `branchPoints` that rolls it. */
  branchPoint: string;
  /** One line, English: the question and the historical side. */
  note: string;
}

/**
 * Design ww227 §4: the per-country data sheet, written first by the lane
 * and checked by tests/ww1936/NationTrees.test.ts: every person, general
 * and equipment id named here must exist, every dilemma must be a branch
 * point. Text here is the lane's plan, never shown to players.
 */
export interface NationSheet {
  /** The 1936 situation in two or three English sentences. */
  situation: string;
  /** Start spirits (ids in `spirits` or the base content), good and bad. */
  startSpirits: readonly string[];
  dilemmas: readonly NationDilemma[];
  /** The national mechanism in one line (none for tier C). */
  mechanism: string;
  patrons: readonly CountryTag[];
  rivals: readonly CountryTag[];
  /** Union or federation partners (design §5). */
  unions: readonly CountryTag[];
  /** Region groups it claims (existing or in `groups`). */
  claims: readonly RegionGroupId[];
  /** Person and general ids (persons, CORE generals); each has a `source`. */
  people: readonly string[];
  /** Catalogue entry ids: its own (CORE equipment) or START_ARMS rows. */
  equipment: readonly string[];
}

export interface NationDef {
  tag: NationTag;
  tier: NationTier;
  sheet: NationSheet;
  character: AiCharacter;
  /**
   * Changes to the country's row of the politics table once live (start
   * spirits, leaders, popularity). Never `tree` (the join sets it).
   */
  politics?: Partial<Omit<CountryPoliticsDef, "tag" | "tree">>;
  /** The national tree: every focus has `tree: <TAG>` and a `<tag lower>_` id. */
  focuses: readonly FocusDef[];
  /** The historical AI's order (helpers like the majors' *_PATH). */
  path: readonly FocusId[];
  branchPoints: readonly BranchPoint[];
  events: readonly EventDef[];
  decisions: readonly DecisionDef[];
  spirits: readonly SpiritDef[];
  persons: readonly PersonDef[];
  flags: readonly string[];
  /** New region groups (real region ids); claims and cores may name them. */
  groups: readonly RegionGroupDef[];
  /** Region groups the country claims, added to its claims row. */
  claims: readonly RegionGroupId[];
  /** CORES_1936 groups added to the country. */
  cores?: readonly string[];
  seeds?: readonly CivilWarSeedDef[];
  templates: readonly TemplateUnlockDef[];
  /** Appended after FACTION_NAMES (its rows still match first). */
  factionNames?: readonly FactionNameDef[];
  beats?: readonly HistoryBeat[];
  /**
   * The country's old tree's focus ids (generic or pack) that other content
   * still names (beats, decisions, events: `focus_done`, `focus_in_progress`),
   * mapped to this tree's focus that stands for it. The engine reads the
   * alias whenever a country on this tree is asked about the old id.
   */
  aliases: Readonly<Record<FocusId, FocusId>>;
  /** Old ids other content names that deliberately have no counterpart here. */
  dropped: readonly FocusId[];
}

/** design ww227 §6 (owner D4): equipment a minor holds at the start. */
export interface StartArmsRow {
  /** A catalogue entry id (any country's, a tank or plane). */
  entry: string;
  /** licensed: may be produced, already paid (no rent, permanent, outside the cap); received: used only. */
  origin: "licensed" | "received";
  /** Units put in stock at the start (0: the design only). */
  count: number;
  /** Where the purchase or licence is documented. */
  source: string;
}

/**
 * What engine-lib modules read before the content (Generals.ts, MechRules,
 * hist/index.ts, the start). Empty lists change nothing.
 */
export interface NationCore {
  tag: NationTag;
  /** Appended to GENERALS (ids index + 1), each with a `source`. */
  generals: readonly GeneralDef[];
  /** Appended to BOP_DEFS; the tag must be in BOP_TAGS. */
  bop: readonly BopDef[];
  /**
   * The country's own catalogue (hist/Types.ts entry shapes, `country` its
   * tag, ids `<tag lower>_<name>`). Non-empty: the country is a catalogue
   * country (its slots, names and static keys), its numbers clamped between
   * the generic key and the majors' median (hist/MinorClamp.ts).
   */
  equipment: readonly HistEntry[];
  startArms: readonly StartArmsRow[];
}
