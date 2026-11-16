// ww229: the conditions and AI weights Republican Spain's focuses, events
// and decisions share. Data only (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { AiWeight } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { ROUTE_AI_STABILITY, ROUTE_READY_PCT } from "../../focus/routes";
import { T, all, any, not } from "../../helpers";

/** The civil war against the Nationalists is on. */
export const AT_ESN: Condition = { kind: "at_war_with", of: T("ESN") };
/** The civil war is over (its spirit gone, no war with the Nationalists). */
export const PEACE_AT_HOME: Condition = all(
  not({ kind: "has_spirit", id: "esp_civil_war_nation" }),
  not(AT_ESN),
);
export const SOVIET_GOLD: Condition = { kind: "flag", flag: "esr_soviet_gold" };
export const PARIS_GOLD: Condition = { kind: "flag", flag: "esr_paris_gold" };
export const NOT_COM: Condition = not({
  kind: "ruling",
  ideology: "communist",
});
export const READY_COM: Condition = all(NOT_COM, {
  kind: "pop_ge",
  ideology: "communist",
  pct: ROUTE_READY_PCT,
});
export const NOT_NEU: Condition = not({ kind: "ruling", ideology: "neutral" });
export const READY_NEU: Condition = all(NOT_NEU, {
  kind: "pop_ge",
  ideology: "neutral",
  pct: ROUTE_READY_PCT,
});
export const NOT_FAS: Condition = not({ kind: "ruling", ideology: "fascist" });
export const READY_FAS: Condition = all(NOT_FAS, {
  kind: "pop_ge",
  ideology: "fascist",
  pct: ROUTE_READY_PCT,
});
/** A route's middle steps: once started, the AI carries on. */
export const AI_ON: AiWeight = { base: 5 };
/** A route's civil war: only a shaken country. */
export const AI_RISE: AiWeight = {
  base: 2,
  mods: [{ if: { kind: "stability_ge", pct: ROUTE_AI_STABILITY }, factor: 0 }],
};
// The balance of power's bands (core.ts BOP row).
export const BAND0: Condition = { kind: "bop_range", tag: "ESR", band: 0 };
export const BAND1: Condition = { kind: "bop_range", tag: "ESR", band: 1 };
export const BAND2: Condition = { kind: "bop_range", tag: "ESR", band: 2 };
export const BAND3: Condition = { kind: "bop_range", tag: "ESR", band: 3 };
export const BAND4: Condition = { kind: "bop_range", tag: "ESR", band: 4 };
/** The balance is on (any band). */
export const BOP_ON: Condition = any(BAND0, BAND1, BAND2, BAND3, BAND4);
