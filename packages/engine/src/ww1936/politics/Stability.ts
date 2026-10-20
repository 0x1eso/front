// World War 1936 P3: stability and war support (spec §6.1). Recomputed on
// the country's political day from the bases and the lines below, so the
// lines never pile up (HOI4). bp integers, clamped to 0..10,000 at the end.
import {
  IDEO_DEM,
  IDEO_NEU,
  WwPolLine,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  rulingPartyBp,
  wearinessBp,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { capitalRegion } from "./Conditions";
import type { WwPolitics } from "./WwPolitics";

/** Translation key of each line: ww1936.pol.line.<name> (lane T's key table). */
export const POL_LINE_PREFIX = "ww1936.pol.line.";

/** What both values read of the map, in one pass over the regions. */
interface LandFacts {
  /** % of the legal victory points someone else controls (Conditions.lostLegalVpPct). */
  lostPct: number;
  /** Men of the core regions (P1 population is in thousands). */
  corePop: number;
}

function landFacts(pol: WwPolitics, id: number): LandFacts {
  let all = 0;
  let lost = 0;
  let corePop = 0;
  for (const r of pol.ww.scenario.landRegions) {
    if (pol.legalOwner[r.id] !== id) continue;
    all += r.vp;
    if (pol.land.controller[r.id] !== id) lost += r.vp;
    if (pol.isCore(r.id)) corePop += r.pop * 1000;
  }
  return { lostPct: all === 0 ? 0 : Math.floor((lost * 100) / all), corePop };
}

/**
 * Spec §6.1 offensive war line: a war `id` declared and still fights
 * (CountryPol.declaredOn, controller ruling R12).
 */
function offensiveWar(pol: WwPolitics, id: number): boolean {
  const c = pol.country(id)!;
  return c.declaredOn.some((t) => pol.ww.isAtWar(id, t));
}

/** Spec §6.1 defence line: someone who declared war on `id` still fights it. */
function defensiveWar(pol: WwPolitics, id: number): boolean {
  if (!pol.ww.hasWar(id)) return false;
  for (const o of pol.list()) {
    if (o.smallID === id || !o.declaredOn.includes(id)) continue;
    if (pol.ww.isAtWar(id, o.smallID)) return true;
  }
  return false;
}

/** Every line of one of the two values, bp: the base first, then each line that is not 0. */
function lines(
  pol: WwPolitics,
  id: number,
  which: "stab" | "ws",
  f: LandFacts,
): WwPolLine[] {
  const c = pol.country(id)!;
  const out: WwPolLine[] = [];
  const add = (name: string, bp: number) => {
    if (bp !== 0) out.push({ key: POL_LINE_PREFIX + name, bp });
  };
  if (which === "stab") {
    out.push({ key: POL_LINE_PREFIX + "stab_base", bp: c.stabBaseBp });
    add("stab_modifiers", c.stats.stabilityBp);
    add("stab_party", rulingPartyBp(c.pop[c.ruling]));
    if (c.ruling === IDEO_DEM && offensiveWar(pol, id)) {
      add("stab_offensive", -1000);
    }
    add("stab_occupation", 0 - Math.min(2000, f.lostPct * 20));
    if (c.ppMilli < 0) add("stab_no_pp", -1000);
    return out;
  }
  out.push({ key: POL_LINE_PREFIX + "ws_base", bp: c.wsBaseBp });
  add("ws_modifiers", c.stats.warSupportBp);
  if (c.ruling === IDEO_DEM || c.ruling === IDEO_NEU) {
    add("ws_tension", Math.floor((pol.wtBp * 3000) / 10_000));
  }
  if (defensiveWar(pol, id)) add("ws_defense", 1000);
  const cap = capitalRegion(pol, id);
  const holder = cap > 0 ? (pol.land.controller[cap] ?? 0) : 0;
  if (holder !== 0 && holder !== id && pol.ww.isAtWar(id, holder)) {
    add("ws_capital", 1000);
  }
  const casualties = pol.land.country(id)?.casualtiesTotal ?? 0;
  // The weariness line (PoliticsRules.wearinessBp) in its two parts.
  add("ws_casualties", wearinessBp(casualties, f.corePop, 0));
  add("ws_lost_vp", 0 - f.lostPct * 20);
  return out;
}

function clampedSum(l: readonly WwPolLine[]): number {
  let s = 0;
  for (const x of l) s += x.bp;
  return Math.max(0, Math.min(10_000, s));
}

/** Spec §6.1: today's stability and war support from the bases and lines. */
export function computeStability(
  pol: WwPolitics,
  id: number,
): { stabBp: number; wsBp: number } {
  const f = landFacts(pol, id);
  return {
    stabBp: clampedSum(lines(pol, id, "stab", f)),
    wsBp: clampedSum(lines(pol, id, "ws", f)),
  };
}

/**
 * Spec §6.1, §21.4-1: today's lines of stability ("stab") or war support
 * ("ws") for the government tab, bp each (controller rulings R2, R4): the
 * base first, then every line that is not 0. Their sum, clamped to
 * 0..100%, is the value.
 */
export function stabilityLines(
  pol: WwPolitics,
  id: number,
  which: "stab" | "ws",
): WwPolLine[] {
  if (pol.country(id) === null) return [];
  return lines(pol, id, which, landFacts(pol, id));
}
