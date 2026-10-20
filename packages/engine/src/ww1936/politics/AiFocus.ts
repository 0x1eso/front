// World War 1936 P3: the AI's focus choice (spec §18.4, §18.5). Lane F
// (Task 2). With historical AI on, an AI follows its tree's history path
// (with the branch points rolled at the start, spec §18.4); off the path,
// or with it off, it picks by weight (spec §18.5).
import {
  FocusBranch,
  FocusId,
  WW_BEAT_MAX_SKIP_AHEAD,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  aiWeight,
  P_FOCUS,
  pickWeighted,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";
import { aiPersonality } from "../economy/AiEconomy";
import { evalCondition } from "./Conditions";
import { makeCtx } from "./Dispatch";
import {
  focusBlock,
  focusCompleted,
  focusDef,
  focusFinished,
  holds,
  startFocus,
} from "./Focus";
import type { CountryPol, WwPolitics } from "./WwPolitics";

/** The generic tree's ideology focuses and their alliance focuses, IDEOLOGIES order (spec §19.2). */
const IDEO_FOCUS: readonly FocusId[] = [
  "gen_pol_dem",
  "gen_pol_com",
  "gen_pol_fas",
  "gen_pol_neu",
];
const IDEO_ALLY: readonly FocusId[] = [
  "gen_pol_dem_ally",
  "gen_pol_com_ally",
  "gen_pol_fas_ally",
  "gen_pol_neu_league",
];

/** The ideology focus the country took or is running (it decides "@ideo"); -1: none yet. */
function takenIdeology(pol: WwPolitics, c: CountryPol): number {
  return IDEO_FOCUS.findIndex(
    (f) => focusFinished(pol, c, f) || c.focus?.id === f,
  );
}

/**
 * The country's history path today: "@ideo" / "@ideo_ally" resolved (the
 * ideology branch it took, else the ruling ideology: Japan's turns fascist
 * with its government), deviated branch points swapped for their rolled
 * alternative.
 */
export function historyPath(pol: WwPolitics, c: CountryPol): FocusId[] {
  const taken = takenIdeology(pol, c);
  let ideo = taken >= 0 ? taken : c.ruling;
  const out: FocusId[] = [];
  for (const raw of pol.content.paths[c.tree] ?? []) {
    let id =
      raw === "@ideo"
        ? IDEO_FOCUS[ideo]
        : raw === "@ideo_ally"
          ? IDEO_ALLY[ideo]
          : raw;
    for (const bp of pol.content.branchPoints[c.tree] ?? []) {
      const alt = pol.branchDeviations.get(`${c.tag}:${bp.id}`) ?? null;
      if (alt === null || (bp.historical !== raw && bp.historical !== id)) {
        continue;
      }
      if (bp.historical === "@ideo") {
        // Spec §19.2: a generic country that deviates takes its second
        // most popular ideology (once one is taken, that one stays).
        if (taken >= 0) continue;
        const second = [0, 1, 2, 3]
          .filter((i) => i !== c.ruling)
          .sort((a, b) => c.pop[b] - c.pop[a] || a - b)[0];
        ideo = second;
        id = IDEO_FOCUS[second];
      } else {
        id = alt;
      }
    }
    out.push(id);
  }
  return out;
}

/**
 * Never startable again: an exclusive partner is done, or every focus of
 * a prerequisite group is (spec §18.4: the path after a deviated branch
 * point skips what the deviation closed).
 */
function focusDead(
  pol: WwPolitics,
  c: CountryPol,
  id: FocusId,
  depth = 0,
): boolean {
  const f = focusDef(pol, id);
  if (f === undefined || f.tree !== c.tree) return true;
  if (focusFinished(pol, c, id)) return false;
  if ((f.exclusive ?? []).some((x) => focusCompleted(pol, c, x))) return true;
  if (depth >= 32) return false;
  return (f.prereq ?? []).some((g) =>
    g.every((p) => focusDead(pol, c, p, depth + 1)),
  );
}

/** Spec §18.5 common factors, percent: war, few military factories, the P1 persona (controller ruling R17). */
function branchFactor(
  pol: WwPolitics,
  id: number,
  branch: FocusBranch,
): number {
  const persona = aiPersonality(pol.tagOf(id));
  let f = 100;
  if (branch === "army" && pol.ww.hasWar(id)) f = (f * 200) / 100;
  if (branch === "industry" && (pol.econ.country(id)?.totals.mil ?? 0) < 10) {
    f = (f * 150) / 100;
  }
  if (
    persona === "aggressor" &&
    (branch === "army" || branch === "diplomacy")
  ) {
    f = (f * 150) / 100;
  }
  if (persona === "democracy" && branch === "industry") f = (f * 130) / 100;
  if (persona === "minor" && branch === "industry") f = (f * 150) / 100;
  if (persona === "minor" && branch === "politics") f = (f * 70) / 100;
  return Math.floor(f);
}

/** The AI's next focus (nothing is running): the history path first, else by weight. */
export function aiPickFocus(
  pol: WwPolitics,
  id: number,
  day: number,
): FocusId | null {
  const c = pol.country(id)!;
  const ctx = makeCtx(pol, id, id, 0, pol.mg.ticks());
  // Started, a focus whose cancelIf holds would be cancelled the same day.
  const startable = (fid: FocusId) =>
    focusBlock(pol, id, fid, false) === null &&
    !holds(ctx, focusDef(pol, fid)!.cancelIf);
  if (pol.mg.config().historicalAi()) {
    let blocked = 0;
    for (const fid of historyPath(pol, c)) {
      if (focusDef(pol, fid) === undefined || focusFinished(pol, c, fid)) {
        continue;
      }
      if (startable(fid)) return fid;
      // Off the path for good: not counted (spec §18.4).
      if (focusDead(pol, c, fid)) continue;
      // Spec §18.4: never more than three places ahead of the path.
      if (++blocked >= WW_BEAT_MAX_SKIP_AHEAD) break;
    }
  }
  const cands = pol.content.treeFocuses[c.tree]
    .map((i) => pol.content.focuses[i])
    .filter((f) => startable(f.id));
  const weights = cands.map((f) => {
    const w = aiWeight(f.ai, (i) => evalCondition(ctx, f.ai!.mods![i].if));
    return Math.floor((w * branchFactor(pol, id, f.branch)) / 100);
  });
  const k = pickWeighted(
    weights,
    wwRoll(pol.seed, P_FOCUS, id, c.focusesDone, day),
  );
  return k < 0 ? null : cands[k].id;
}

/**
 * Spec §18.4 beat "focus": an AI that has neither finished nor is running
 * it starts it now when nothing runs, else queues it first in line in
 * place of what was queued (the running focus is not cancelled).
 */
export function forceFocusNext(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): void {
  const c = pol.country(id);
  if (
    c === null ||
    pol.isHuman(id) ||
    c.focus?.id === focus ||
    focusFinished(pol, c, focus)
  ) {
    return;
  }
  if (c.focus === null) {
    startFocus(pol, id, focus, pol.mg.ticks());
    return;
  }
  // The queue it replaces does not block it (an exclusive partner there).
  const old = c.queued;
  c.queued = null;
  c.queued = focusBlock(pol, id, focus, true) === null ? focus : old;
}
