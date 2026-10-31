// World War 1936: focus effects are worth three times the written number
// (owner-approved). One pure function, used by the engine when a focus
// completes and by the client when it prints the effect text, so both show
// the same numbers. Only magnitudes scale; structure never does.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const FOCUS_EFFECT_SCALE = 3;

const S = FOCUS_EFFECT_SCALE;

/** `fx` with every magnitude of a focus effect multiplied (integers only). */
export function scaleFocusEffect(e: Effect): Effect {
  switch (e.kind) {
    case "pp":
    case "army_xp":
    case "navy_xp":
    case "resource":
      return { ...e, amount: e.amount * S };
    case "equipment":
    case "build":
      return { ...e, count: e.count * S };
    case "stability":
    case "war_support":
    case "research_bonus":
      return { ...e, pct: e.pct * S };
    case "popularity":
      return { ...e, pp: e.pp * S };
    case "opinion":
      return { ...e, value: e.value * S };
    case "add_spirit":
    case "swap_spirit":
      return { ...e, scaled: true };
    case "if":
      return {
        ...e,
        then: scaleFocusEffects(e.then),
        ...(e.else === undefined ? {} : { else: scaleFocusEffects(e.else) }),
      };
    case "random_list":
      return {
        ...e,
        options: e.options.map((o) => ({
          ...o,
          effects: scaleFocusEffects(o.effects),
        })),
      };
    default:
      return e;
  }
}

export function scaleFocusEffects(effects: readonly Effect[]): Effect[] {
  return effects.map(scaleFocusEffect);
}

/** A spirit's stat modifiers as a focus-added spirit has them. */
export function scaleSpiritStats(stats: Partial<WwStats>): Partial<WwStats> {
  const out: Partial<WwStats> = {};
  for (const k of Object.keys(stats) as (keyof WwStats)[]) {
    out[k] = (stats[k] as number) * S;
  }
  return out;
}
