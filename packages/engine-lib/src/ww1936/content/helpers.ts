// World War 1936 P3: short ways to write the data (the only content file
// with functions; tests/ww1936/ContentPurity.test.ts checks the others).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  Condition,
  Effect,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusId } from "@openfront/engine-api/ww1936/PoliticsTypes";

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
