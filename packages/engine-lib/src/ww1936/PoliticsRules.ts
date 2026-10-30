// World War 1936 P3: the pure rules the engine and the screens share
// (spec §4–§7, §14, §16; plan decision 11). Integers only.
import {
  LawValue,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
  POP_TOTAL,
  TensionAct,
  WarGoalType,
  WW_PP_BASE_MILLI,
  WW_PP_CAP,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

// ---- Political power (spec §4.1) ----

export function dailyPpMilli(s: WwStats): number {
  return Math.floor((WW_PP_BASE_MILLI * (100 + s.ppGainPct)) / 100) + s.ppMilli;
}

/** Adds a day's gain; what goes over the cap is lost (spec §4.1). */
export function addPpCapped(ppMilli: number, gain: number): number {
  const cap = WW_PP_CAP * 1000;
  if (ppMilli >= cap) return ppMilli;
  return Math.min(cap, ppMilli + gain);
}

/** Spec §4.3: floor(base × (100 + pct) / 100), at least 0. PP, not milli. */
export function costWith(base: number, pct: number): number {
  return Math.max(0, Math.floor((base * (100 + pct)) / 100));
}

// ---- Popularity (spec §5.2) ----

/**
 * Adds `delta` bp to ideology `i` and takes it from (or gives it to) the
 * others in proportion; the integer remainder goes to the largest other
 * (ties: lower index), which stops at 0. The sum stays exactly 10,000.
 */
export function addPopularity(pop: number[], i: number, delta: number): void {
  const d = Math.max(-pop[i], Math.min(POP_TOTAL - pop[i], Math.trunc(delta)));
  if (d === 0) return;
  let others = 0;
  for (let j = 0; j < 4; j++) if (j !== i) others += pop[j];
  if (others === 0) {
    // Only when d < 0 (i held everything): the whole loss goes to one ideology.
    pop[i === IDEO_NEU ? IDEO_DEM : IDEO_NEU] -= d;
    pop[i] += d;
    return;
  }
  let moved = 0;
  for (let j = 0; j < 4; j++) {
    if (j === i) continue;
    const share = -Math.trunc((d * pop[j]) / others);
    pop[j] += share;
    moved += share;
  }
  let rest = -d - moved;
  while (rest !== 0) {
    let best = -1;
    for (let j = 0; j < 4; j++) {
      if (j === i || (rest < 0 && pop[j] === 0)) continue;
      if (best < 0 || pop[j] > pop[best]) best = j;
    }
    if (best < 0) break;
    const step = rest < 0 ? Math.max(rest, -pop[best]) : rest;
    pop[best] += step;
    rest -= step;
  }
  pop[i] += d;
}

/** Largest ideology other than `ruling` (ties: lower index). */
export function largestOther(pop: readonly number[], ruling: number): number {
  let best = -1;
  for (let j = 0; j < 4; j++) {
    if (j !== ruling && (best < 0 || pop[j] > pop[best])) best = j;
  }
  return best;
}

// ---- Stability and war support (spec §6) ----

/** Ruling-party line: (support − 50%) / 5, bp. */
export function rulingPartyBp(rulingPop: number): number {
  return Math.trunc((rulingPop - 5000) / 5);
}

/** Spec §6.2: the dynamic stats a stability value gives. */
export function stabilityEffects(s: number): Partial<WwStats> {
  if (s < 5000) {
    const out = 0 - Math.floor(((5000 - s) * 4) / 1000);
    return {
      ppGainPct: 0 - Math.floor(((5000 - s) * 5) / 1000),
      outputPct: out,
      constructionPct: out,
    };
  }
  return {
    ppGainPct: Math.floor(((s - 5000) * 3) / 1000),
    outputPct: Math.floor(((s - 5000) * 2) / 1000),
  };
}

/** Spec §6.3. */
export function warSupportEffects(w: number): Partial<WwStats> {
  if (w < 5000) {
    return {
      recoveryPct: 0 - Math.floor(((5000 - w) * 5) / 1000),
      recruitablePct: 0 - Math.floor(((5000 - w) * 2) / 1000),
    };
  }
  return { recoveryPct: Math.floor(((w - 5000) * 2) / 1000) };
}

/**
 * Spec §6.4. The floor is 50%, or for a country whose base line is under
 * 60% (P2 Task 11: France 31, Belgium 25, the Netherlands 26 — their
 * colonies hold most of their points, so 80% of all of them was out of
 * reach on the homeland) ten points under its base.
 */
export function effectiveSurrenderPct(
  basePct: number,
  stabBp: number,
  wsBp: number,
  surrenderPp: number,
): number {
  const ws = Math.max(-10, Math.min(10, Math.floor((wsBp - 5000) / 500)));
  const st = Math.max(-5, Math.min(5, Math.floor((stabBp - 5000) / 1000)));
  const floor = Math.min(50, basePct - 10);
  return Math.max(floor, Math.min(98, basePct + ws + st + surrenderPp));
}

/** Spec §6.1: war-weariness line, bp (≤ 0). */
export function wearinessBp(
  casualties: number,
  corePop: number,
  lostLegalVpPct: number,
): number {
  const cas =
    corePop <= 0
      ? 0
      : Math.min(3000, Math.floor((casualties * 400 * 100) / corePop));
  // 0 - …: never −0 (a stored −0 would differ from 0 in a snapshot check).
  return 0 - cas - lostLegalVpPct * 20;
}

// ---- Laws (spec §7.2) ----

export const LAW_PP: Readonly<Record<LawValue, number>> = {
  civilian: 50,
  early_mobilization: 75,
  partial_mobilization: 100,
  war_economy: 150,
  total_mobilization: 150,
  free_trade: 100,
  export_focus: 75,
  limited_exports: 75,
  closed_economy: 100,
  disarmed: 50,
  volunteer: 50,
  limited: 50,
  extensive: 100,
  service: 125,
  all_adults: 150,
  scraping: 150,
};
const CONSCRIPTION_VALUES: readonly LawValue[] = [
  "disarmed",
  "volunteer",
  "limited",
  "extensive",
  "service",
  "all_adults",
  "scraping",
];
/** Spec §7.2 stability lines of the laws in force, bp. */
export const LAW_STABILITY_BP: Readonly<Partial<Record<LawValue, number>>> = {
  war_economy: -300,
  total_mobilization: -800,
  all_adults: -500,
  scraping: -1000,
};

export interface LawCtx {
  wsBp: number;
  wtBp: number;
  ruling: number;
  atWar: boolean;
  ppMilli: number;
  costMilli: number;
}

/**
 * Spec §7.2: why `value` cannot be set now; null if it can (cooldown and
 * "same" are P1's). "War support ≥ N% or at war" (partial mobilization,
 * war economy) is the `ctx.atWar ? null` cases; "at war and" (total
 * mobilization, all adults, scraping) is `needWar`, refused as P1's
 * law_condition. Extensive and service look at war support at war too.
 * The tension line of a democracy is gone at war.
 */
export function lawBlock(value: LawValue, ctx: LawCtx): WwOrderBlock | null {
  const dem = ctx.ruling === IDEO_DEM;
  const gate = (
    ws: number,
    wt: number,
    needWar: boolean,
  ): WwOrderBlock | null => {
    if (needWar && !ctx.atWar) return "law_condition";
    if (ctx.wsBp < ws) return "law_ws";
    if (dem && !ctx.atWar && ctx.wtBp < wt) return "law_tension";
    return null;
  };
  let block: WwOrderBlock | null;
  switch (value) {
    case "partial_mobilization":
      block = ctx.atWar ? null : gate(3000, 2500, false);
      break;
    case "war_economy":
      block = ctx.atWar ? null : gate(5000, 5000, false);
      break;
    case "total_mobilization":
      block = gate(7000, 0, true);
      break;
    case "extensive":
      block = gate(3000, 2500, false);
      break;
    case "service":
      block = gate(5000, 5000, false);
      break;
    case "all_adults":
      block = gate(7000, 0, true);
      break;
    case "scraping":
      block = gate(8000, 0, true);
      break;
    case "free_trade":
      block =
        ctx.ruling === IDEO_COM || ctx.ruling === IDEO_FAS
          ? "law_ideology"
          : null;
      break;
    case "closed_economy":
      block =
        ctx.ruling === IDEO_COM || ctx.ruling === IDEO_FAS || ctx.atWar
          ? null
          : "law_ideology";
      break;
    default:
      block = null;
  }
  if (block !== null) return block;
  return ctx.ppMilli < 0 || ctx.costMilli > ctx.ppMilli ? "no_pp" : null;
}

/** Spec §7.1: the target law's cost in PP. */
export function lawCost(value: LawValue, s: WwStats): number {
  const pct =
    s.lawCostPct +
    (CONSCRIPTION_VALUES.includes(value) ? s.conscriptionCostPct : 0);
  return costWith(LAW_PP[value], pct);
}

// ---- War goals, justification, tension (spec §14) ----

export function justifyCost(targetMajor: boolean, s: WwStats): number {
  return costWith(targetMajor ? 75 : 50, s.justifyCostPct);
}

/** Spec §14.3: days, at least 10. */
export function justifyDays(
  s: WwStats,
  targetEnemyJustifyPct: number,
  majorGuarantors: number,
): number {
  const pct =
    100 + s.justifyTimePct + targetEnemyJustifyPct + majorGuarantors * 25;
  return Math.max(10, Math.floor((100 * pct) / 100));
}

/** Spec §14.1: tension an act adds, bp, with the actor's tensionPct. */
export function tensionFor(
  act: TensionAct,
  targetMajor: boolean,
  s: WwStats,
  goal?: WarGoalType,
): number {
  let pct: number;
  switch (act) {
    case "justified":
      pct = targetMajor ? 4 : 2;
      break;
    case "declare_goal":
      pct = targetMajor ? 5 : 2;
      break;
    case "declare_no_goal":
      pct = 2 * (targetMajor ? 5 : 2) + 4;
      break;
    case "capitulation":
      pct = 2;
      break;
  }
  let bp = pct * 100;
  if (goal === "claim" && act !== "capitulation") bp = Math.floor(bp / 2);
  return Math.max(0, Math.floor((bp * (100 + s.tensionPct)) / 100));
}

export interface JustifyGateCtx {
  ruling: number;
  wtBp: number;
  targetThreatBp: number;
  /** The target is in a faction at war with me or my faction. */
  targetInEnemyFaction: boolean;
  atWarWith: boolean;
  sameFaction: boolean;
  nap: boolean;
  iGuarantee: boolean;
  noJustifyRule: boolean;
  busy: boolean;
}

/** Spec §14.3 conditions: why I cannot start justifying on the target. */
export function justifyGate(c: JustifyGateCtx): WwOrderBlock | null {
  if (c.busy) return "justify_busy";
  if (c.atWarWith || c.sameFaction || c.nap || c.iGuarantee || c.noJustifyRule)
    return "justify_blocked";
  if (c.ruling === IDEO_DEM) {
    const ok =
      (c.wtBp >= 5000 && c.targetThreatBp >= 500) ||
      c.wtBp >= 8000 ||
      c.targetInEnemyFaction;
    return ok ? null : "tension_gate";
  }
  if (c.ruling === IDEO_NEU) return c.wtBp >= 2500 ? null : "tension_gate";
  return null;
}

/** Spec §14.4, §16.1: may a government guarantee now? */
export function guaranteeGate(
  ruling: number,
  wtBp: number,
  targetJustifiedAgainst: boolean,
  gatePct = 25,
): boolean {
  if (ruling !== IDEO_DEM) return true;
  return targetJustifiedAgainst || wtBp >= gatePct * 100;
}

/** Spec §14.4, §15.3: the world tension (percent) a government needs to create / join / invite into a faction; 0: none. */
export function factionGateNeedPp(ruling: number, minusPp = 0): number {
  if (ruling !== IDEO_DEM && ruling !== IDEO_NEU) return 0;
  return Math.max(0, 40 - minusPp);
}

/** Spec §14.4, §15.3: may a government create / join / invite into a faction now? */
export function factionGate(
  ruling: number,
  wtBp: number,
  minusPp = 0,
): boolean {
  const need = factionGateNeedPp(ruling, minusPp);
  return need === 0 || wtBp >= need * 100;
}
