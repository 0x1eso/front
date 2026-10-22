// World War 1936 P6 lane W3 (plan Task 9 Step 6): the depth conditions
// (plan decision 27: has_doctrine … energy_below), read from the depth
// state the lanes keep. (nukes_on is the foundation's, in Conditions.ts.)
// The subject is `who` (or self), alive — evalLeaf checked it.
import {
  DOCTRINE_TRACKS,
  GD_DOMAIN,
  GRAND_DOCTRINES,
  INTEL_DOMAINS,
  SPECIAL_PROJECTS,
  SUB_TRACK,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LeafCondition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { masteryLevel } from "@openfront/engine-lib/ww1936/DoctrineRules";
import { bopBandOf } from "../depth/BalanceOfPower";
import type { WwDepth } from "../depth/WwDepth";
import { EffectCtx, resolveSelector } from "./Dispatch";

/** Plan decision 20: the atomic stock is P1's stock slot of atomic_bomb 1. */
const ATOMIC_KEY = equipKey("atomic_bomb", 1);

export function evalDepthCondition(ctx: EffectCtx, c: LeafCondition): boolean {
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  if (d === undefined) return false;
  const id = c.who === undefined ? ctx.self : resolveSelector(ctx, c.who);
  const dc = d.country(id);
  if (dc === null) return false;
  switch (c.kind) {
    case "has_doctrine": {
      const g = (GRAND_DOCTRINES as readonly string[]).indexOf(c.doctrine);
      if (g >= 0) return dc.doc.gd[GD_DOMAIN[g]] === g;
      const s = (SUBDOCTRINES as readonly string[]).indexOf(c.doctrine);
      return s >= 0 && dc.doc.sub[SUB_TRACK[s]] === s;
    }
    case "mastery_level": {
      const t = DOCTRINE_TRACKS.indexOf(c.track);
      return t >= 0 && masteryLevel(dc.doc.masteryMilli[t] ?? 0) >= c.level;
    }
    case "has_agency":
      return dc.intel.agency;
    case "intel_level": {
      const of = resolveSelector(ctx, c.of);
      const dom = INTEL_DOMAINS.indexOf(c.domain);
      if (of <= 0 || of >= d.cap || dom < 0) return false;
      return d.intelOf(id, of, dom) >= c.pct;
    }
    case "project_done":
      return d.projectDone(id, SPECIAL_PROJECTS.indexOf(c.project));
    case "has_atomic":
      return (
        (d.ww.economy.country(id)?.stock[ATOMIC_KEY] ?? 0) >= (c.count ?? 1)
      );
    case "congress_above":
      return d.mech.congressBp >= c.pct * 100;
    case "bop_range":
      return bopBandOf(d, c.tag) === c.band;
    case "energy_below":
      return dc.mech.energyPm < c.pct * 10;
    default:
      return false;
  }
}
