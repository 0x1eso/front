// World War 1936 P3: short ways to write the data (the only content file
// with functions; tests/ww1936/ContentPurity.test.ts checks the others).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  TechBranch,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  Condition,
  Effect,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  AiWeight,
  FocusId,
  HistoryBeat,
  Ideology,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_TECHS } from "../WwTechs";

export const T = (tag: CountryTag): Selector => ({ tag });
export const all = (...c: Condition[]): Condition => ({ all: c });
export const any = (...c: Condition[]): Condition => ({ any: c });
export const not = (c: Condition): Condition => ({ not: c });
export const after = (date: string): Condition => ({ kind: "date_ge", date });
export const before = (date: string): Condition => ({ kind: "date_lt", date });
export const done = (id: FocusId): Condition => ({ kind: "focus_done", id });
export const flag = (f: string): Condition => ({ kind: "flag", flag: f });
export const gflag = (f: string): Condition => ({ kind: "gflag", flag: f });
export const exists = (tag: CountryTag): Condition => ({
  kind: "exists",
  who: { tag },
});
/** Prerequisites have no "a|b, c" shorthand: write [[a, b], [c]]. */
export const fire = (id: string, to?: Selector, days?: number): Effect => ({
  kind: "fire_event",
  id,
  ...(to ? { to } : {}),
  ...(days ? { days } : {}),
});

/**
 * gen_tech_exchange (research overhaul changes §2.6): the leader is ahead in
 * a branch when it has one of the branch's researchable techs we lack; the
 * first such branch (in `branches` order) gets +100% once, else land
 * doctrine mastery.
 */
// ---- ww229 MA2: the ruling party's own push stops at a ceiling ----
// gen_rally and gen_suppress_opposition used to stack every 180 days on top
// of the focuses, and every AI country's ruling party sat at 100% within two
// years: no opposition was left for elections, crises or the ww226 routes.
// The rally needs the ruling party below 60% (its 90 days of drift add about
// 13.5 points), the purge below 75%. (Here, not in decisions/generic.ts:
// content files hold data only.)
export function rulingBelow(pct: number): Condition {
  return any(
    ...(["democratic", "communist", "fascist", "neutral"] as const).map(
      (ideology) =>
        all(
          { kind: "ruling", ideology },
          not({ kind: "pop_ge", ideology, pct }),
        ),
    ),
  );
}

export function techExchange(branches: readonly TechBranch[]): {
  ahead: Condition[];
  effect: Effect;
} {
  const leader: Selector = { factionLeaderOf: "self" };
  const ahead = branches.map((branch) =>
    any(
      ...WW_TECH_IDS.filter(
        (t) => WW_TECHS[t].branch === branch && WW_TECHS[t].retired !== true,
      ).map((tech) =>
        all(
          { kind: "has_tech", who: leader, tech },
          not({ kind: "has_tech", tech }),
        ),
      ),
    ),
  );
  const from = (i: number): Effect =>
    i >= branches.length
      ? // Doctrine: mastery on land (the old doctrine techs are retired).
        { kind: "doctrine_mastery", domain: "land", amount: 60 }
      : {
          kind: "if",
          cond: ahead[i],
          then: [
            { kind: "research_bonus", branch: branches[i], pct: 100, uses: 1 },
          ],
          else: [from(i + 1)],
        };
  return { ahead, effect: from(0) };
}

/** ww229 (design ww227 §8): the movement's share a national route's AI start needs ... */
export const NATION_ROUTE_POP_PCT = 25;
/** ... or a country shakier than this (stability, percent). */
export const NATION_ROUTE_STABILITY_PCT = 40;

/**
 * ww229 (design ww227 §8): the AI weight of the first focus of a national
 * tree's route to `ideology`: `bias` (the country's AiCharacter.routeBias,
 * 0..3) times 2, and nothing unless the movement holds 25% or the country's
 * stability is under 40%. The route's later steps take a flat weight.
 */
export function nationRouteAi(ideology: Ideology, bias = 1): AiWeight {
  return {
    base: 2 * Math.max(0, Math.min(3, bias)),
    mods: [
      {
        if: not(
          any(
            { kind: "pop_ge", ideology, pct: NATION_ROUTE_POP_PCT },
            not({ kind: "stability_ge", pct: NATION_ROUTE_STABILITY_PCT }),
          ),
        ),
        factor: 0,
      },
    ],
  };
}

/**
 * ww229 MR: the effects of the first case whose condition holds, as a
 * chain of `if`s (none holds: nothing). For a reaction whose minor is
 * whichever one founded the bloc.
 */
export function firstOf(
  cases: readonly (readonly [Condition, readonly Effect[]])[],
): Effect {
  const [[cond, then], ...rest] = cases;
  return {
    kind: "if",
    cond,
    then: [...then],
    ...(rest.length > 0 ? { else: [firstOf(rest)] } : {}),
  };
}

/** ww229 MR: the minor is there and not at war with the major. */
function mrOpen(tag: CountryTag): Condition {
  return all(exists(tag), not({ kind: "at_war_with", of: T(tag) }));
}

/**
 * ww229 MR (design ww227 §7): a major courts a minor: goodwill both ways,
 * rifles, and technical help for its factories (the licence offer).
 */
export function mrCourt(tag: CountryTag): Effect {
  return {
    kind: "if",
    cond: mrOpen(tag),
    then: [
      { kind: "opinion", who: T(tag), of: "self", value: 25, days: 730 },
      { kind: "opinion", of: T(tag), value: 15, days: 730 },
      {
        kind: "send_equipment",
        to: T(tag),
        type: "infantry_equipment",
        count: 1500,
      },
      {
        kind: "research_bonus",
        who: T(tag),
        branch: "industry",
        pct: 25,
        uses: 1,
      },
    ],
  };
}

/** ww229 MR: a major guarantees a minor. */
export function mrGuard(tag: CountryTag): Effect {
  return {
    kind: "if",
    cond: mrOpen(tag),
    then: [
      { kind: "guarantee", of: T(tag) },
      { kind: "opinion", who: T(tag), of: "self", value: 20, days: 730 },
    ],
  };
}

/** ww229 MR: a major opposes a minor with a war goal (a claim names its group). */
export function mrOppose(
  tag: CountryTag,
  type: "conquer" | "claim" | "topple",
  group?: string,
): Effect {
  return {
    kind: "if",
    cond: mrOpen(tag),
    then: [
      { kind: "war_goal", on: T(tag), type, ...(group ? { group } : {}) },
      { kind: "tension", pct: 2 },
      { kind: "opinion", who: T(tag), of: "self", value: -30, days: 730 },
    ],
  };
}

type Mods = NonNullable<AiWeight["mods"]>;

/** ww229 MR: kin governments court each other; so do friends and allies. */
export function mrCourtAi(
  tag: CountryTag,
  base = 30,
  extra: Mods = [],
): AiWeight {
  const m = T(tag);
  return {
    base,
    mods: [
      ...(["fascist", "communist", "democratic"] as const).map((ideology) => ({
        if: all(
          { kind: "ruling", ideology },
          { kind: "ruling", who: m, ideology },
        ),
        factor: 300,
      })),
      { if: { kind: "opinion_ge", of: m, value: 30 }, factor: 150 },
      { if: { kind: "same_faction", of: m }, factor: 300 },
      { if: { kind: "at_war_with", of: m }, factor: 0 },
      ...extra,
    ],
  };
}

/**
 * ww229 MR: a strong neighbour opposes, a democracy rarely and an ally
 * never; a major already at war has other worries. A fascist or communist
 * major seldom turns on a government of its own kind (merge MR: fascist
 * Italy took a war goal on an Iron Guard Romania).
 */
export function mrOpposeAi(
  tag: CountryTag,
  base = 15,
  extra: Mods = [],
): AiWeight {
  const m = T(tag);
  return {
    base,
    mods: [
      { if: { kind: "neighbor_of", of: m }, factor: 200 },
      { if: { kind: "strength_ratio_ge", vs: m, permille: 3000 }, factor: 200 },
      { if: { kind: "ruling", ideology: "democratic" }, factor: 10 },
      { if: { kind: "at_war" }, factor: 30 },
      { if: { kind: "same_faction", of: m }, factor: 0 },
      { if: { kind: "opinion_ge", of: m, value: 30 }, factor: 30 },
      ...(["fascist", "communist"] as const).map((ideology) => ({
        if: all(
          { kind: "ruling", ideology },
          { kind: "ruling", who: m, ideology },
        ),
        factor: 25,
      })),
      ...extra,
    ],
  };
}

/** ww229 MR: democracies guarantee; a major at war or a minor in a camp, rarely. */
export function mrGuardAi(
  tag: CountryTag,
  base = 15,
  extra: Mods = [],
): AiWeight {
  const m = T(tag);
  return {
    base,
    mods: [
      { if: { kind: "ruling", ideology: "democratic" }, factor: 300 },
      { if: { kind: "at_war" }, factor: 50 },
      { if: { kind: "in_faction", who: m }, factor: 30 },
      { if: { kind: "at_war_with", of: m }, factor: 0 },
      ...extra,
    ],
  };
}

/** ww229 MR: the country is `tag`. */
export const isTag = (tag: CountryTag): Condition => ({ kind: "tag", tag });
/** ww229 MR: set a flag on the country. */
export const setFlag = (f: string): Effect => ({ kind: "set_flag", flag: f });

/**
 * ww229 MR: a historical AI's reaction focus: a "focus" beat that waits for
 * its situation (`when`) the whole war, from the first spring.
 */
export function focusBeat(
  id: string,
  actor: CountryTag,
  focus: FocusId,
  when: Condition,
): HistoryBeat {
  return {
    id,
    date: "1936-03-01",
    actor,
    act: { kind: "focus", id: focus },
    when,
    windowDays: 3300,
  };
}
