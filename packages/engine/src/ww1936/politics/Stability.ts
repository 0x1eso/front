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
import { bombFatigueBp } from "../air/Bombing";
import { capitalRegion } from "./Conditions";
import type { WwPolitics } from "./WwPolitics";

/**
 * What the lines read of the map for every country — % of its legal
 * victory points someone else controls (Conditions.lostLegalVpPct), the
 * men of its core regions (P1 population is in thousands) — from one pass
 * over the regions a tick (spec §22.7: the country step's budget), shared
 * by that tick's countries, and again when control changes
 * (WwLand.controlChanges). Never state: a restored game rebuilds it on
 * its first tick from the same state, so both read the same values (a
 * legal owner an effect changes mid-tick shows from the next tick, in
 * both).
 */
interface LandFacts {
  tick: number;
  changes: number;
  all: Int32Array;
  lostPct: Int32Array;
  corePop: Float64Array;
}
const FACTS = new WeakMap<WwPolitics, LandFacts>();

function landFacts(pol: WwPolitics): LandFacts {
  const tick = pol.mg.ticks();
  const changes = pol.land.controlChanges;
  let f = FACTS.get(pol);
  if (f !== undefined && f.tick === tick && f.changes === changes) return f;
  const n = pol.countries.length;
  if (f === undefined || f.lostPct.length !== n) {
    f = {
      tick,
      changes,
      all: new Int32Array(n),
      lostPct: new Int32Array(n),
      corePop: new Float64Array(n),
    };
    FACTS.set(pol, f);
  }
  f.tick = tick;
  f.changes = changes;
  const all = f.all;
  const lost = f.lostPct;
  all.fill(0);
  lost.fill(0);
  f.corePop.fill(0);
  const ctl = pol.land.controller;
  for (const r of pol.ww.scenario.landRegions) {
    const o = pol.legalOwner[r.id];
    if (o === 0 || o >= n) continue;
    all[o] += r.vp;
    if (ctl[r.id] !== o) lost[o] += r.vp;
    // WwPolitics.isCore, without its map lookup.
    const co = pol.coreOverride[r.id];
    if (co === 0 ? r.core : co === 1) f.corePop[o] += r.pop * 1000;
  }
  for (let o = 0; o < n; o++) {
    lost[o] = all[o] === 0 ? 0 : Math.floor((lost[o] * 100) / all[o]);
  }
  return f;
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
  for (const o of pol.countries) {
    if (o === null || o.smallID === id || !o.declaredOn.includes(id)) continue;
    if (pol.ww.isAtWar(id, o.smallID)) return true;
  }
  return false;
}

/**
 * The lines of one of the two values, bp: the base first, then each line
 * that is not 0 (into `out` when given). Returns their sum clamped to
 * 0..100%, the value.
 */
function lines(
  pol: WwPolitics,
  id: number,
  which: "stab" | "ws",
  out: WwPolLine[] | null,
): number {
  const c = pol.country(id)!;
  const f = landFacts(pol);
  const lostPct = f.lostPct[id] ?? 0;
  let sum = 0;
  // Each line's translation key, ww1936.pol.line.<name> (lane T's key
  // table), written in full so the translation check sees it used.
  const add = (key: string, bp: number) => {
    if (bp === 0) return;
    sum += bp;
    out?.push({ key, bp });
  };
  if (which === "stab") {
    sum = c.stabBaseBp;
    out?.push({ key: "ww1936.pol.line.stab_base", bp: c.stabBaseBp });
    add("ww1936.pol.line.stab_modifiers", c.stats.stabilityBp);
    add("ww1936.pol.line.stab_party", rulingPartyBp(c.pop[c.ruling]));
    if (c.ruling === IDEO_DEM && offensiveWar(pol, id)) {
      add("ww1936.pol.line.stab_offensive", -1000);
    }
    add("ww1936.pol.line.stab_occupation", 0 - Math.min(2000, lostPct * 20));
    if (c.ppMilli < 0) add("ww1936.pol.line.stab_no_pp", -1000);
  } else {
    sum = c.wsBaseBp;
    out?.push({ key: "ww1936.pol.line.ws_base", bp: c.wsBaseBp });
    add("ww1936.pol.line.ws_modifiers", c.stats.warSupportBp);
    if (c.ruling === IDEO_DEM || c.ruling === IDEO_NEU) {
      add("ww1936.pol.line.ws_tension", Math.floor((pol.wtBp * 3000) / 10_000));
    }
    if (defensiveWar(pol, id)) add("ww1936.pol.line.ws_defense", 1000);
    if (pol.ww.hasWar(id)) {
      const cap = capitalRegion(pol, id);
      const holder = cap > 0 ? (pol.land.controller[cap] ?? 0) : 0;
      if (holder !== 0 && holder !== id && pol.ww.isAtWar(id, holder)) {
        add("ww1936.pol.line.ws_capital", 1000);
      }
    }
    const casualties = pol.land.country(id)?.casualtiesTotal ?? 0;
    // The weariness line (PoliticsRules.wearinessBp) in its two parts.
    add(
      "ww1936.pol.line.ws_casualties",
      wearinessBp(casualties, f.corePop[id] ?? 0, 0),
    );
    add("ww1936.pol.line.ws_lost_vp", 0 - lostPct * 20);
    // P4 spec §14.8: the last 30 days' bombing (lane A2's bombFatigueBp).
    add("ww1936.pol.line.ws_bomb_fatigue", bombFatigueBp(pol.ww.air, id));
  }
  return Math.max(0, Math.min(10_000, sum));
}

/** Spec §6.1: today's stability and war support from the bases and lines. */
export function computeStability(
  pol: WwPolitics,
  id: number,
): { stabBp: number; wsBp: number } {
  return {
    stabBp: lines(pol, id, "stab", null),
    wsBp: lines(pol, id, "ws", null),
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
  const out: WwPolLine[] = [];
  lines(pol, id, which, out);
  return out;
}
