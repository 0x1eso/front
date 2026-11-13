// Great War 1914 (ww207/ww208): the society's rows. Communities and birth rows
// per seat in content/society/<tag>.ts (W lanes), the generic parties in
// content/society/common.ts; text in resources/ww1914/ko/<TAG>.house.json
// (`communities.<id>`, `births.<id>`) and common.house.json (`generic.*`).
// engine/ww1914/Society runs them (S1). Faction ideals are on GwFactionRow,
// elections on GwChamberRow `elect`, axis pushes on GwLawDraft `axes`. See
// /home/eser/dev/ww207-format.md.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwAxis,
  GwAxisSide,
  GwElectionRule,
  GwFranchise,
  GwIdeals,
  GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";

/** A community: one ideal, a size, sitting in no chamber (FP2's community). */
export interface GwCommunityRow {
  /** `deu_workers`. Text: pack communities.<id>.{name,note}. */
  readonly id: string;
  readonly tag: GwTag;
  /** Its one Cornerstone. */
  readonly ideal: { readonly axis: GwAxis; readonly side: GwAxisSide };
  /** Size at the start, 1..5. */
  readonly size: number;
  /** Trust at the start, -3..3; 0 if absent. */
  readonly trust?: number;
  /** Heat thresholds of tempers 2, 3, 4, as a faction's; GW_COMMUNITY_STEPS if absent. */
  readonly steps?: readonly number[];
}

/** A community's ideal now: the one a realised utopia gave it, else its row's. */
export function communityIdeal(
  row: GwCommunityRow,
  st?: { readonly ideal?: GwCommunityRow["ideal"] } | null,
): GwCommunityRow["ideal"] {
  return st?.ideal ?? row.ideal;
}

/** Heat a community needs for tempers 2, 3, 4 when its row names none. */
export const GW_COMMUNITY_STEPS: readonly number[] = [3, 6, 10];

/**
 * A real party's birth by state, not by date: an `out` faction row comes in
 * when the state calls for it (FP2: a community hot with no voice, or the
 * axes moved on all three since the last birth).
 */
export interface GwBirthRow {
  /** The `out` faction row it brings in (deu_uspd, gbr_sinn_fein). */
  readonly faction: string;
  readonly tag: GwTag;
  /** The community it is born from; its members come from there. */
  readonly from: string;
  /** The state that must hold too (war weariness, a split's cause); none: the birth rule alone. */
  readonly when?: GwCond;
  /** Its opposite, born a few chapters later (GW_OPPOSITE_AFTER). */
  readonly opposite?: string;
  /** The desk scene of its birth (`scheduledOnly`); the news line if absent. */
  readonly scene?: string;
}

/** Chapters after a birth that its opposite follows. */
export const GW_OPPOSITE_AFTER = 3;

/** The kinds of generic party any seat can see born. Text common.house.json generic.<kind>. */
export const GW_GENERIC_KINDS = [
  "peasants",
  "nationalist",
  "veterans",
  "peace",
] as const;
export type GwGenericKind = (typeof GW_GENERIC_KINDS)[number];

/**
 * A generic party, born where no real row fits. The engine makes its faction
 * row per seat (genericFactionId); `nationalist` once per community of
 * `nations`/`dual`/`union` ideal.
 */
export interface GwGenericPartyRow {
  readonly kind: GwGenericKind;
  readonly bloc: GwBloc;
  /** Its ideals; the axis a seat lacks is dropped, its community's ideal added. */
  readonly ideals: GwIdeals;
  readonly template: GwTreeTemplate;
  /** It can be born only while this holds (peace party: at war). */
  readonly when?: GwCond;
}

/** A generic party's faction id: `deu_g_peasants`, `auh_g_nationalist_czechs`. */
export function genericFactionId(
  tag: GwTag,
  kind: GwGenericKind,
  community?: string,
): string {
  const base = `${tag.toLowerCase()}_g_${kind}`;
  return community === undefined
    ? base
    : `${base}_${community.replace(/^[a-z]{3}_/, "")}`;
}

/** A chamber's elections (on GwChamberRow `elect`). */
export interface GwElectRow {
  readonly rule: GwElectionRule;
  /** YYYY-MM its term runs out, in peace (F: checked by the W lanes). */
  readonly due: string;
  /** Years a term runs after an election. */
  readonly term: number;
  /** The franchise at the start (curia chambers). */
  readonly franchise?: GwFranchise;
  /** The bill that postpones it in war (`*_postpone`); none: war doesn't. */
  readonly postpone?: string;
}

/** Everything the society reads from content, as GwContent carries it. */
export interface GwSocietyContent {
  readonly communities?: readonly GwCommunityRow[];
  readonly births?: readonly GwBirthRow[];
  readonly generic?: readonly GwGenericPartyRow[];
}

/** Joins the per-seat files. */
export function joinSociety(
  parts: readonly GwSocietyContent[],
): GwSocietyContent {
  return {
    communities: parts.flatMap((p) => p.communities ?? []),
    births: parts.flatMap((p) => p.births ?? []),
    generic: parts.flatMap((p) => p.generic ?? []),
  };
}
