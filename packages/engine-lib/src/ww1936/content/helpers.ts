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
import type { FocusId } from "@openfront/engine-api/ww1936/PoliticsTypes";
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
