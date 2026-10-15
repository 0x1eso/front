import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GOLD_PER_POINT,
  MILLI,
  TECHS_REQUIRED_FROM_PREVIOUS_ERA,
} from "./Balance";
import { TECHS } from "./Techs";

export type ResearchBlock = "researched" | "busy" | "era" | "prereq";

/** Why `tech` can't be started now (cost aside), or null when it can. */
export function researchBlock(
  researched: ReadonlySet<TechId>,
  busy: boolean,
  tech: TechId,
): ResearchBlock | null {
  if (researched.has(tech)) return "researched";
  if (busy) return "busy";
  const def = TECHS[tech];
  if (def.era > 1) {
    let fromPreviousEra = 0;
    for (const r of researched) {
      if (TECHS[r].era === def.era - 1) fromPreviousEra++;
    }
    if (fromPreviousEra < TECHS_REQUIRED_FROM_PREVIOUS_ERA) return "era";
  }
  for (const p of def.prereqs) {
    if (!researched.has(p)) return "prereq";
  }
  return null;
}

/** Research duration in ticks after the researchTime modifier (at least 1 s). */
export function researchTicks(tech: TechId, researchTimePct: number): number {
  return Math.max(
    10,
    Math.round(TECHS[tech].seconds * 10 * (1 + researchTimePct / 100)),
  );
}

/** Gold that covers `shortMilli` missing milli-points, after goldPaymentCost. */
export function shortfallGold(
  shortMilli: number,
  goldPaymentCostPct: number,
): bigint {
  if (shortMilli <= 0) return 0n;
  const points = Math.ceil(shortMilli / MILLI);
  // Integer percent math: (1 + pct / 100) in floats can overcharge by 1.
  return BigInt(
    Math.ceil((points * GOLD_PER_POINT * (100 + goldPaymentCostPct)) / 100),
  );
}
