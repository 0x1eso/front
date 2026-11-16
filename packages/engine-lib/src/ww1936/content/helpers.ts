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
