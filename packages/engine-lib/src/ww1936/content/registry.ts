// World War 1936 P3 (spec §20, plan decisions 6, 7, 31): the content
// registry. Every lane file is joined here in a fixed order (event numbers
// follow it, spec §12.3), and the indices the engine reads are built once.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
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
import { GENERIC_DECISIONS } from "./decisions/generic";
import { NATIONAL_DECISIONS } from "./decisions/national";
import { DEU_EVENTS } from "./events/deu";
import { GBR_EVENTS } from "./events/gbr";
import { GENERIC_EVENTS } from "./events/generic";
import { SUN_EVENTS } from "./events/sun";
import { WORLD_EVENTS } from "./events/world";
import { FLAGS_BASE } from "./flags/base";
import { FLAGS_DEU } from "./flags/deu";
import { FLAGS_GBR } from "./flags/gbr";
import { FLAGS_GEN } from "./flags/gen";
import { FLAGS_SUN } from "./flags/sun";
import { FLAGS_WORLD } from "./flags/world";
import { DEU_BRANCHES, DEU_FOCUSES, DEU_PATH } from "./focus/deu";
import { GBR_BRANCHES, GBR_FOCUSES, GBR_PATH } from "./focus/gbr";
import {
  GENERIC_BRANCHES,
  GENERIC_FOCUSES,
  GENERIC_PATH,
} from "./focus/generic";
import { SUN_BRANCHES, SUN_FOCUSES, SUN_PATH } from "./focus/sun";
import { HISTORY_BEATS } from "./history";
import { PERSONS_DEU } from "./persons/deu";
import { PERSONS_GBR } from "./persons/gbr";
import { PERSONS_LEADERS } from "./persons/leaders";
import { PERSONS_SUN } from "./persons/sun";
import { REGION_GROUPS } from "./regionGroups";
import { SPIRITS_DEU } from "./spirits/deu";
import { SPIRITS_GBR } from "./spirits/gbr";
import { SPIRITS_GEN } from "./spirits/gen";
import { SPIRITS_START } from "./spirits/start";
import { SPIRITS_SUN } from "./spirits/sun";
import { SPIRITS_WORLD } from "./spirits/world";
import { TEMPLATES_DEU } from "./templates/deu";
import { TEMPLATES_GBR } from "./templates/gbr";
import { TEMPLATES_GEN } from "./templates/gen";
import { TEMPLATES_SUN } from "./templates/sun";
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
  };
}

/** Everything in its fixed file order (event numbers follow this order, spec §12.3). */
export const CONTENT_PARTS: ContentParts = {
  focuses: [...GENERIC_FOCUSES, ...DEU_FOCUSES, ...GBR_FOCUSES, ...SUN_FOCUSES],
  paths: {
    generic: GENERIC_PATH,
    DEU: DEU_PATH,
    GBR: GBR_PATH,
    SUN: SUN_PATH,
  },
  branchPoints: {
    generic: GENERIC_BRANCHES,
    DEU: DEU_BRANCHES,
    GBR: GBR_BRANCHES,
    SUN: SUN_BRANCHES,
  },
  events: [
    ...GENERIC_EVENTS,
    ...DEU_EVENTS,
    ...GBR_EVENTS,
    ...SUN_EVENTS,
    ...WORLD_EVENTS,
  ],
  decisions: [...GENERIC_DECISIONS, ...NATIONAL_DECISIONS],
  spirits: [
    ...SPIRITS_START,
    ...SPIRITS_GEN,
    ...SPIRITS_DEU,
    ...SPIRITS_GBR,
    ...SPIRITS_SUN,
    ...SPIRITS_WORLD,
  ],
  traits: TRAITS,
  persons: [...PERSONS_LEADERS, ...PERSONS_DEU, ...PERSONS_GBR, ...PERSONS_SUN],
  beats: HISTORY_BEATS,
  groups: REGION_GROUPS,
  countries: COUNTRY_POLITICS,
  claims: CLAIMS,
  factionNames: FACTION_NAMES,
  templates: [
    ...TEMPLATES_GEN,
    ...TEMPLATES_DEU,
    ...TEMPLATES_GBR,
    ...TEMPLATES_SUN,
  ],
  flags: [
    ...FLAGS_BASE,
    ...FLAGS_GEN,
    ...FLAGS_DEU,
    ...FLAGS_GBR,
    ...FLAGS_SUN,
    ...FLAGS_WORLD,
  ],
  startNaps: START_NAPS,
};
export const CONTENT: ContentRegistry = buildRegistry(CONTENT_PARTS);
