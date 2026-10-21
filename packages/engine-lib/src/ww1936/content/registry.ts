// World War 1936 P3 (spec §20, plan decisions 6, 7, 31): the content
// registry. Every lane file is joined here in a fixed order (event numbers
// follow it, spec §12.3), and the indices the engine reads are built once.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  CivilWarSeedDef,
  CoreDef,
  OccupationDefaultDef,
  PeaceDefaultDef,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  BranchPoint,
  ClaimDef,
  CountryPoliticsDef,
  DecisionDef,
  EventDef,
  FactionNameDef,
  FOCUS_TREES,
  FocusDef,
  FocusId,
  FocusTreeId,
  HistoryBeat,
  PersonDef,
  RegionGroupDef,
  SpiritDef,
  TemplateUnlockDef,
  TraitDef,
  TraitId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "../Calendar";
import { idHash } from "../Roll";
import { TRAITS } from "./advisors";
import { CLAIMS, COUNTRY_POLITICS, FACTION_NAMES } from "./countries";
import { ENDGAME_DECISIONS } from "./decisions/endgame";
import { FRA_DECISIONS } from "./decisions/fra";
import { GENERIC_DECISIONS } from "./decisions/generic";
import { ITA_DECISIONS } from "./decisions/ita";
import { JPN_DECISIONS } from "./decisions/jpn";
import { NATIONAL_DECISIONS } from "./decisions/national";
import { USA_DECISIONS } from "./decisions/usa";
import { BEATS_P5 } from "./endgame/beats";
import { CLAIMS_P5 } from "./endgame/claims";
import { CORES_1936 } from "./endgame/cores";
import { DORMANT_POLITICS } from "./endgame/dormant";
import { REGION_GROUPS_P5 } from "./endgame/groups";
import { OCCUPATION_DEFAULTS } from "./endgame/occupation";
import { HISTORY_PEACE } from "./endgame/peace";
import { CIVIL_WAR_SEEDS } from "./endgame/seeds";
import { DEU_EVENTS } from "./events/deu";
import { ENDGAME_EVENTS } from "./events/endgame";
import { FRA_EVENTS } from "./events/fra";
import { GBR_EVENTS } from "./events/gbr";
import { GENERIC_EVENTS } from "./events/generic";
import { ITA_EVENTS } from "./events/ita";
import { JPN_EVENTS } from "./events/jpn";
import { SUN_EVENTS } from "./events/sun";
import { USA_EVENTS } from "./events/usa";
import { WORLD_EVENTS } from "./events/world";
import { FLAGS_BASE, FLAGS_P5_BASE } from "./flags/base";
import { FLAGS_DEU } from "./flags/deu";
import { FLAGS_ENDGAME } from "./flags/endgame";
import { FLAGS_FRA } from "./flags/fra";
import { FLAGS_GBR } from "./flags/gbr";
import { FLAGS_GEN } from "./flags/gen";
import { FLAGS_ITA } from "./flags/ita";
import { FLAGS_JPN } from "./flags/jpn";
import { FLAGS_SUN } from "./flags/sun";
import { FLAGS_USA } from "./flags/usa";
import { FLAGS_WORLD } from "./flags/world";
import { DEU_BRANCHES, DEU_FOCUSES, DEU_PATH } from "./focus/deu";
import { FRA_BRANCHES, FRA_FOCUSES, FRA_PATH } from "./focus/fra";
import { GBR_BRANCHES, GBR_FOCUSES, GBR_PATH } from "./focus/gbr";
import {
  GENERIC_BRANCHES,
  GENERIC_FOCUSES,
  GENERIC_PATH,
} from "./focus/generic";
import { ITA_BRANCHES, ITA_FOCUSES, ITA_PATH } from "./focus/ita";
import { JPN_BRANCHES, JPN_FOCUSES, JPN_PATH } from "./focus/jpn";
import { SUN_BRANCHES, SUN_FOCUSES, SUN_PATH } from "./focus/sun";
import { USA_BRANCHES, USA_FOCUSES, USA_PATH } from "./focus/usa";
import { HISTORY_BEATS } from "./history";
import { PERSONS_DEU } from "./persons/deu";
import { PERSONS_ENDGAME } from "./persons/endgame";
import { PERSONS_FRA } from "./persons/fra";
import { PERSONS_GBR } from "./persons/gbr";
import { PERSONS_ITA } from "./persons/ita";
import { PERSONS_JPN } from "./persons/jpn";
import { PERSONS_LEADERS } from "./persons/leaders";
import { PERSONS_P4 } from "./persons/p4";
import { PERSONS_SUN } from "./persons/sun";
import { PERSONS_USA } from "./persons/usa";
import { REGION_GROUPS } from "./regionGroups";
import { SPIRITS_DEU } from "./spirits/deu";
import { SPIRITS_ENDGAME } from "./spirits/endgame";
import { SPIRITS_FRA } from "./spirits/fra";
import { SPIRITS_GBR } from "./spirits/gbr";
import { SPIRITS_GEN } from "./spirits/gen";
import { SPIRITS_ITA } from "./spirits/ita";
import { SPIRITS_JPN } from "./spirits/jpn";
import { SPIRITS_P4 } from "./spirits/p4";
import { SPIRITS_START } from "./spirits/start";
import { SPIRITS_SUN } from "./spirits/sun";
import { SPIRITS_USA } from "./spirits/usa";
import { SPIRITS_WORLD } from "./spirits/world";
import { TEMPLATES_DEU } from "./templates/deu";
import { TEMPLATES_FRA } from "./templates/fra";
import { TEMPLATES_GBR } from "./templates/gbr";
import { TEMPLATES_GEN } from "./templates/gen";
import { TEMPLATES_ITA } from "./templates/ita";
import { TEMPLATES_JPN } from "./templates/jpn";
import { TEMPLATES_SUN } from "./templates/sun";
import { TEMPLATES_USA } from "./templates/usa";
import { START_NAPS } from "./treaties";

export interface ContentParts {
  focuses: readonly FocusDef[];
  /** By tree; the generic path may hold "@ideo" and "@ideo_ally" (Task 2 expands them). */
  paths: Partial<Record<FocusTreeId, readonly FocusId[]>>;
  branchPoints: Partial<Record<FocusTreeId, readonly BranchPoint[]>>;
  events: readonly EventDef[];
  decisions: readonly DecisionDef[];
  spirits: readonly SpiritDef[];
  traits: readonly TraitDef[];
  persons: readonly PersonDef[];
  beats: readonly HistoryBeat[];
  groups: readonly RegionGroupDef[];
  countries: readonly CountryPoliticsDef[];
  claims: readonly ClaimDef[];
  factionNames: readonly FactionNameDef[];
  templates: readonly TemplateUnlockDef[];
  flags: readonly string[];
  startNaps: readonly (readonly [CountryTag, CountryTag])[];
  // P5 (plan decision 30): the endgame tables.
  peace: readonly PeaceDefaultDef[];
  cores: readonly CoreDef[];
  seeds: readonly CivilWarSeedDef[];
  occupationDefaults: readonly OccupationDefaultDef[];
}

export interface ContentRegistry extends ContentParts {
  focusIdx: Map<FocusId, number>;
  /** Focus indices of each tree in content order; a focus's place in this list is its tree position. */
  treeFocuses: Record<FocusTreeId, number[]>;
  treePos: Map<FocusId, number>;
  eventIdx: Map<string, number>;
  eventHash: number[];
  /** Triggered events (with a `trigger`) by receiver tag, in event order. */
  eventsByTag: Map<CountryTag, number[]>;
  /** Triggered events every country checks, in event order. */
  eventsAny: number[];
  /** day → event indices with a date, in event order. */
  dateEvents: Map<number, number[]>;
  decisionIdx: Map<string, number>;
  decisionsFor: Map<CountryTag, number[]>;
  decisionsAny: number[];
  spiritIdx: Map<string, SpiritDef>;
  traitIdx: Map<TraitId, TraitDef>;
  personIdx: Map<string, PersonDef>;
  personsOf: Map<CountryTag, PersonDef[]>;
  groupIdx: Map<string, RegionGroupDef>;
  countryIdx: Map<CountryTag, CountryPoliticsDef>;
  beatHash: number[];
  flagSet: Set<string>;
  /** P5: the HISTORY_PEACE rows of each loser, in table order. */
  peaceByLoser: Map<CountryTag, PeaceDefaultDef[]>;
  /** P5: the CORES_1936 groups of each tag, in table order. */
  coresByTag: Map<CountryTag, string[]>;
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const l = m.get(k);
  if (l === undefined) m.set(k, [v]);
  else l.push(v);
};

export function buildRegistry(p: ContentParts): ContentRegistry {
  const treeFocuses = Object.fromEntries(
    FOCUS_TREES.map((t) => [t, [] as number[]]),
  ) as Record<FocusTreeId, number[]>;
  const focusIdx = new Map<FocusId, number>();
  const treePos = new Map<FocusId, number>();
  p.focuses.forEach((f, i) => {
    focusIdx.set(f.id, i);
    treePos.set(f.id, treeFocuses[f.tree].length);
    treeFocuses[f.tree].push(i);
  });
  const eventIdx = new Map<string, number>();
  const eventsByTag = new Map<CountryTag, number[]>();
  const eventsAny: number[] = [];
  const dateEvents = new Map<number, number[]>();
  p.events.forEach((e, i) => {
    eventIdx.set(e.id, i);
    if (e.date !== undefined) push(dateEvents, dayOfDate(e.date.on), i);
    if (e.trigger === undefined) return;
    if (e.receivers === "any") eventsAny.push(i);
    else for (const t of e.receivers ?? []) push(eventsByTag, t, i);
  });
  const decisionIdx = new Map<string, number>();
  const decisionsFor = new Map<CountryTag, number[]>();
  const decisionsAny: number[] = [];
  p.decisions.forEach((d, i) => {
    decisionIdx.set(d.id, i);
    if (d.for === "any") decisionsAny.push(i);
    else for (const t of d.for) push(decisionsFor, t, i);
  });
  const personsOf = new Map<CountryTag, PersonDef[]>();
  for (const x of p.persons) push(personsOf, x.country, x);
  const peaceByLoser = new Map<CountryTag, PeaceDefaultDef[]>();
  for (const x of p.peace) push(peaceByLoser, x.loser, x);
  const coresByTag = new Map<CountryTag, string[]>();
  for (const c of p.cores) for (const g of c.groups) push(coresByTag, c.tag, g);
  return {
    ...p,
    focusIdx,
    treeFocuses,
    treePos,
    eventIdx,
    eventHash: p.events.map((e) => idHash(e.id)),
    eventsByTag,
    eventsAny,
    dateEvents,
    decisionIdx,
    decisionsFor,
    decisionsAny,
    spiritIdx: new Map(p.spirits.map((s) => [s.id, s])),
    traitIdx: new Map(p.traits.map((t) => [t.id, t])),
    personIdx: new Map(p.persons.map((x) => [x.id, x])),
    personsOf,
    groupIdx: new Map(p.groups.map((g) => [g.id, g])),
    countryIdx: new Map(p.countries.map((c) => [c.tag, c])),
    beatHash: p.beats.map((b) => idHash(b.id)),
    flagSet: new Set(p.flags),
    peaceByLoser,
    coresByTag,
  };
}

/**
 * P5 (plan decision 30): the P3 claims and the P5 ones; a tag in both keeps
 * one row whose groups are joined (the first table's order first, no
 * repeats). New tags follow in the second table's order.
 */
export function mergeClaims(
  a: readonly ClaimDef[],
  b: readonly ClaimDef[],
): ClaimDef[] {
  const out: ClaimDef[] = a.map((c) => ({ tag: c.tag, groups: [...c.groups] }));
  for (const c of b) {
    const row = out.find((x) => x.tag === c.tag);
    if (row === undefined) {
      out.push({ tag: c.tag, groups: [...c.groups] });
      continue;
    }
    const groups = [...row.groups];
    for (const g of c.groups) if (!groups.includes(g)) groups.push(g);
    row.groups = groups;
  }
  return out;
}

/** Everything in its fixed file order (event numbers follow this order, spec §12.3). */
export const CONTENT_PARTS: ContentParts = {
  // P5 (plan decision 30): every P5 part after the P3 (and P4) ones.
  focuses: [
    ...GENERIC_FOCUSES,
    ...DEU_FOCUSES,
    ...GBR_FOCUSES,
    ...SUN_FOCUSES,
    ...ITA_FOCUSES,
    ...JPN_FOCUSES,
    ...FRA_FOCUSES,
    ...USA_FOCUSES,
  ],
  paths: {
    generic: GENERIC_PATH,
    DEU: DEU_PATH,
    GBR: GBR_PATH,
    SUN: SUN_PATH,
    ITA: ITA_PATH,
    JPN: JPN_PATH,
    FRA: FRA_PATH,
    USA: USA_PATH,
  },
  branchPoints: {
    generic: GENERIC_BRANCHES,
    DEU: DEU_BRANCHES,
    GBR: GBR_BRANCHES,
    SUN: SUN_BRANCHES,
    ITA: ITA_BRANCHES,
    JPN: JPN_BRANCHES,
    FRA: FRA_BRANCHES,
    USA: USA_BRANCHES,
  },
  events: [
    ...GENERIC_EVENTS,
    ...DEU_EVENTS,
    ...GBR_EVENTS,
    ...SUN_EVENTS,
    ...WORLD_EVENTS,
    ...ITA_EVENTS,
    ...JPN_EVENTS,
    ...FRA_EVENTS,
    ...USA_EVENTS,
    ...ENDGAME_EVENTS,
  ],
  decisions: [
    ...GENERIC_DECISIONS,
    ...NATIONAL_DECISIONS,
    ...ITA_DECISIONS,
    ...JPN_DECISIONS,
    ...FRA_DECISIONS,
    ...USA_DECISIONS,
    ...ENDGAME_DECISIONS,
  ],
  spirits: [
    ...SPIRITS_START,
    ...SPIRITS_GEN,
    ...SPIRITS_DEU,
    ...SPIRITS_GBR,
    ...SPIRITS_SUN,
    ...SPIRITS_WORLD,
    // P4 (spec §16.4): the navy and air spirits.
    ...SPIRITS_P4,
    ...SPIRITS_ITA,
    ...SPIRITS_JPN,
    ...SPIRITS_FRA,
    ...SPIRITS_USA,
    ...SPIRITS_ENDGAME,
  ],
  traits: TRAITS,
  // P4 (spec §16.3): the navy and air chiefs (AirChiefs.P4_PERSONS), last.
  persons: [
    ...PERSONS_LEADERS,
    ...PERSONS_DEU,
    ...PERSONS_GBR,
    ...PERSONS_SUN,
    ...PERSONS_P4,
    ...PERSONS_ITA,
    ...PERSONS_JPN,
    ...PERSONS_FRA,
    ...PERSONS_USA,
    // P5 pre-flight §A K1–K5: K5's persons (the Philippines' leader).
    ...PERSONS_ENDGAME,
  ],
  beats: [...HISTORY_BEATS, ...BEATS_P5],
  groups: [...REGION_GROUPS, ...REGION_GROUPS_P5],
  countries: [...COUNTRY_POLITICS, ...DORMANT_POLITICS],
  claims: mergeClaims(CLAIMS, CLAIMS_P5),
  factionNames: FACTION_NAMES,
  templates: [
    ...TEMPLATES_GEN,
    ...TEMPLATES_DEU,
    ...TEMPLATES_GBR,
    ...TEMPLATES_SUN,
    ...TEMPLATES_ITA,
    ...TEMPLATES_JPN,
    ...TEMPLATES_FRA,
    ...TEMPLATES_USA,
  ],
  flags: [
    ...FLAGS_BASE,
    ...FLAGS_GEN,
    ...FLAGS_DEU,
    ...FLAGS_GBR,
    ...FLAGS_SUN,
    ...FLAGS_WORLD,
    ...FLAGS_ITA,
    ...FLAGS_JPN,
    ...FLAGS_FRA,
    ...FLAGS_USA,
    ...FLAGS_ENDGAME,
    ...FLAGS_P5_BASE,
  ],
  startNaps: START_NAPS,
  peace: HISTORY_PEACE,
  cores: CORES_1936,
  seeds: CIVIL_WAR_SEEDS,
  occupationDefaults: OCCUPATION_DEFAULTS,
};
export const CONTENT: ContentRegistry = buildRegistry(CONTENT_PARTS);
