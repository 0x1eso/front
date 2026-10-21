// World War 1936 P5 (plan decision 26, Task 8; spec §16.4): the endgame
// conditions, is_exile … legitimacy_ge, and borders_group (lane E, the
// content lanes' "next to a group" gap: spec §17.6's Warsaw and Paris
// uprisings). Each reads `who` (the P3 rule: self when absent); P3's
// evalLeaf has checked that it plays.
import { SUBJECT_LEVELS } from "@openfront/engine-api/ww1936/EndgameTypes";
import type {
  LeafCondition,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { warScoreShare } from "../endgame/Wars";
import { type EffectCtx, resolveSelector } from "./Dispatch";

export function evalEndgameCondition(
  ctx: EffectCtx,
  c: LeafCondition,
): boolean {
  const pol = ctx.pol;
  const eg = pol.ww.endgame;
  const land = pol.land;
  const id = c.who === undefined ? ctx.self : resolveSelector(ctx, c.who);
  if (id === 0) return false;
  const other = (s: Selector) => resolveSelector(ctx, s);
  const regionsOf = (group: string): readonly number[] =>
    pol.content.groupIdx.get(group)?.regions ?? [];
  switch (c.kind) {
    case "is_exile":
      return eg.isExile(id);
    case "exile_host": {
      const h = eg.exileHost(id);
      return h !== 0 && h === other(c.of);
    }
    case "is_subject":
      return eg.subjectOf(id) !== null;
    case "subject_of": {
      const o = other(c.of);
      return o !== 0 && eg.subjectOf(id)?.overlord === o;
    }
    case "subject_level_ge": {
      // Levels by index, integrated 0 (the tightest) … dominion 3: "≥" is
      // the index (puppet or looser for level puppet).
      const s = eg.subjectOf(id);
      return (
        s !== null &&
        SUBJECT_LEVELS.indexOf(s.level) >= SUBJECT_LEVELS.indexOf(c.level)
      );
    }
    case "autonomy_ge": {
      const i = eg.subjectIdx.get(id);
      return i !== undefined && eg.subjects[i].autBp >= c.pct * 100;
    }
    case "legitimacy_ge": {
      const i = eg.exileIdx.get(id);
      return i !== undefined && eg.exiles[i].legitBp >= c.pct * 100;
    }
    case "country_state": {
      const t = pol.idOfTag(c.tag);
      return t !== 0 && eg.countryState(t) === c.state;
    }
    case "occupied_by": {
      // Some region of the group is held by `of` and not its by law.
      const o = other(c.of);
      return (
        o !== 0 &&
        regionsOf(c.group).some(
          (r) => land.controller[r] === o && pol.legalOwner[r] !== o,
        )
      );
    }
    case "resistance_ge":
    case "compliance_ge": {
      // The average over the group's administered regions (none: false).
      const arr = c.kind === "resistance_ge" ? eg.resBp : eg.compBp;
      let sum = 0;
      let n = 0;
      for (const r of regionsOf(c.group)) {
        if (!eg.isAdministered(r)) continue;
        sum += arr[r];
        n++;
      }
      return n > 0 && sum >= c.pct * 100 * n;
    }
    case "war_score_share_ge": {
      // W's share (‰) of its side's war score in its war against `of`.
      const o = other(c.of);
      return o !== 0 && warScoreShare(eg, id, o) >= c.pct * 10;
    }
    case "in_conference":
      return eg.conferences.some(
        (k) =>
          k.status === 1 &&
          (k.losers.includes(id) || k.parts.some((p) => p.id === id)),
      );
    case "borders_group": {
      // It holds a region outside the group across a land border (not a
      // strait) from one of the group's.
      const sc = pol.ww.scenario;
      const inGroup = new Set(regionsOf(c.group));
      for (const r of inGroup) {
        for (const x of sc.edgesOf(r)) {
          if (inGroup.has(x.to) || land.controller[x.to] !== id) continue;
          if (sc.edge(x.edge).strait === 0) return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}
