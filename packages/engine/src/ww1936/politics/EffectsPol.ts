// World War 1936 P3: the political group of effects (spec §10.4, plan
// decisions 12, 21). `actor` is the country the effect acts on (Dispatch
// resolved `who`); the country that changed has its stats summed again and
// goes out to the screens.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  addPopularity,
  addPpCapped,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { setLaw } from "../economy/LawsRun";
import type { EffectCtx } from "./Dispatch";
import {
  civilWar,
  resolveIdeology,
  setGovernment,
  setLeader,
} from "./Ideology";
import { lawStep, setLawFree } from "./Laws";
import { addSpirit, removeSpirit, swapSpirit } from "./Spirits";

const clampBp = (v: number) => Math.max(0, Math.min(10_000, v));

/** Inserts `v` into an ascending list once. */
function insertSorted(list: string[], v: string): void {
  if (list.includes(v)) return;
  let i = list.length;
  while (i > 0 && list[i - 1] > v) i--;
  list.splice(i, 0, v);
}

export function applyPoliticalEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  const c = pol.country(actor);
  if (c === null) return;
  const day = ctx.day;
  switch (e.kind) {
    case "pp":
      // Up to the cap; an effect may take it below 0 (spec §4.1).
      if (e.amount >= 0) c.ppMilli = addPpCapped(c.ppMilli, e.amount * 1000);
      else c.ppMilli += e.amount * 1000;
      break;
    case "stability":
      c.stabBaseBp = clampBp(c.stabBaseBp + e.pct * 100);
      break;
    case "war_support":
      c.wsBaseBp = clampBp(c.wsBaseBp + e.pct * 100);
      break;
    case "add_spirit":
      addSpirit(pol, actor, e.id, e.days, day);
      break;
    case "remove_spirit":
      removeSpirit(pol, actor, e.id);
      break;
    case "swap_spirit":
      swapSpirit(pol, actor, e.from, e.to, day);
      break;
    case "popularity": {
      const i = resolveIdeology(pol, actor, e.ideology);
      if (i >= 0) addPopularity(c.pop, i, e.pp * 100);
      break;
    }
    case "set_government": {
      const i = resolveIdeology(pol, actor, e.ideology);
      if (i >= 0) setGovernment(pol, actor, i, ctx.tick);
      break;
    }
    case "set_leader":
      setLeader(pol, actor, e.person, ctx.tick);
      break;
    case "civil_war": {
      const i = resolveIdeology(pol, actor, e.ideology);
      if (i >= 0) civilWar(pol, actor, i, ctx.tick);
      break;
    }
    case "set_law": {
      if (e.free === true) {
        setLawFree(pol, actor, e.law, e.value);
        break;
      }
      // P1's order path: cost, conditions, cooldown; refused → skipped.
      const ce = pol.econ.country(actor);
      if (ce !== null && setLaw(pol.econ, ce, e.law, e.value, day) === null) {
        pol.econ.markCountryDirty(actor);
      }
      break;
    }
    case "law_step":
      lawStep(pol, actor, e.law, e.steps);
      break;
    case "add_advisor_candidate":
      // Controller ruling R9: open now, whatever the dates; a dismissed
      // person comes back (Eden's return).
      insertSorted(c.candidates, e.person);
      c.dismissed = c.dismissed.filter((p) => p !== e.person);
      break;
    case "remove_advisor":
      c.advisors = c.advisors.map((a) => (a === e.person ? null : a));
      insertSorted(c.dismissed, e.person);
      c.candidates = c.candidates.filter((p) => p !== e.person);
      break;
    case "person_trait":
      if (!c.personTraits.some(([p, t]) => p === e.person && t === e.trait)) {
        c.personTraits.push([e.person, e.trait]);
      }
      break;
    case "set_flag":
      c.flags.set(e.flag, [day, e.days === undefined ? -1 : day + e.days]);
      pol.markCountry(actor);
      return;
    case "clear_flag":
      c.flags.delete(e.flag);
      pol.markCountry(actor);
      return;
    case "set_gflag":
      pol.gflags.set(e.flag, day);
      pol.markGlobal();
      return;
    case "clear_gflag":
      pol.gflags.delete(e.flag);
      pol.markGlobal();
      return;
    case "elections":
      if (e.suspend !== undefined) c.electionsSuspended = e.suspend;
      if (e.postponeDays !== undefined) {
        c.nextElectionDay = day + e.postponeDays;
      }
      break;
    default:
      return;
  }
  pol.recomputeStats(actor);
  pol.markCountry(actor);
}
