// World War 1936 P5 lane O (plan Task 3): garrisons (spec §8.5, plan
// decision 10). A garrison army's divisions spread over its country's
// administered regions, each to the region short of the most suppression;
// the suppression a region has counts the controller's divisions standing
// there (a garrison's in full, the rest at half).
import {
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_SEA,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  divisionSuppression,
  garrisonNeed,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { startNextHop } from "../land/Movement";
import type { WwLand } from "../land/WwLand";
import type { WwEndgame } from "./WwEndgame";

/** Spec §8.5: a division outside a garrison counts this share, %. */
export const NON_GARRISON_SUPPRESS_PCT = 50;

/** Spec §8.5: the suppression `region` needs from its controller, tenths. */
export function needOf(
  eg: WwEndgame,
  controller: number,
  region: number,
): number {
  const sc = eg.ww.scenario;
  if (sc.region(region) === undefined) return 0;
  const law = eg.occupationLawOf(
    controller,
    eg.ww.politics.legalOwner[region] ?? 0,
  );
  return garrisonNeed(
    sc.regionTiles(region).length,
    eg.resBp[region],
    law,
    eg.ww.politics.stats(controller).garrisonNeedPct,
  );
}

/** Spec §8.5: one division's suppression at its strength now, tenths. */
export function rowSuppression(land: WwLand, row: number): number {
  const t = land.divisions;
  const tpl = land.templateOf(t.owner[row], t.template[row]);
  if (tpl === null) return 0;
  return divisionSuppression(tpl.def, land.strengthOf(row));
}

/** The division's army garrisons (army order "garrison"). */
export function inGarrison(land: WwLand, row: number): boolean {
  return land.armies.get(land.divisions.army[row])?.order.kind === "garrison";
}

/**
 * Spec §8.5: the suppression in `region`, tenths: its controller's
 * divisions standing there (not on the move), a garrison army's in full,
 * the others at NON_GARRISON_SUPPRESS_PCT.
 */
export function supplyOf(eg: WwEndgame, region: number): number {
  const land = eg.ww.land;
  const c = land.controller[region] ?? 0;
  if (c === 0) return 0;
  const t = land.divisions;
  let sup = 0;
  for (const r of land.rowsIn(region)) {
    if (t.owner[r] !== c || t.mode[r] !== MOVE_NONE) continue;
    const s = rowSuppression(land, r);
    sup += inGarrison(land, r)
      ? s
      : Math.floor((s * NON_GARRISON_SUPPRESS_PCT) / 100);
  }
  return sup;
}

/** A busy division moves to another short region only when that one is this many times as short. */
export const GARRISON_MOVE_FACTOR = 2;

/**
 * Spec §8.5: `owner`'s garrison armies (army id order) to its administered
 * regions (of legal owner `scope`, 0: all), one division at a time to the
 * region most short now (need − suppression already assigned; ties: the
 * smaller id). That region takes a division already headed there, else a
 * free one (headed outside the scope or to a covered region; the lowest
 * id), else — when it is GARRISON_MOVE_FACTOR times as short as the least
 * short region a division is headed to — that division; otherwise the
 * most short region a division is headed to keeps it (no swaps when two
 * needs cross, no division walking back and forth). Once every region is
 * covered the rest stay where they are headed. Each walks there (P2
 * movement); a division fighting, retreating, advancing or at sea counts
 * where it is headed but is not moved.
 */
export function assignGarrisons(
  eg: WwEndgame,
  owner: number,
  day: number,
): void {
  void day;
  const land = eg.ww.land;
  const armies = land
    .armiesOf(owner)
    .filter((a) => a.order.kind === "garrison")
    .sort((a, b) => a.id - b.id);
  if (armies.length === 0) return;
  const admin = eg.administeredOf(owner);
  if (admin.length === 0) return;
  const legal = eg.ww.politics.legalOwner;
  const need = new Map<number, number>();
  for (const r of admin) need.set(r, needOf(eg, owner, r));
  const got = new Map<number, number>();
  const gapOf = (r: number) => (need.get(r) ?? 0) - (got.get(r) ?? 0);
  const t = land.divisions;
  const tick = eg.mg.ticks();
  const assign = (row: number, to: number) => {
    got.set(to, (got.get(to) ?? 0) + rowSuppression(land, row));
    if (t.region[row] !== to || t.dest[row] !== to) {
      sendDivision(land, row, to, tick);
    }
  };
  for (const a of armies) {
    const scope = a.order.enemy;
    const regs = admin.filter((r) => scope === 0 || legal[r] === scope);
    if (regs.length === 0) continue;
    const inScope = new Set(regs);
    const mostShort = () => {
      let best = regs[0];
      let bestGap = Number.NEGATIVE_INFINITY;
      for (const r of regs) {
        const g = gapOf(r);
        if (g > bestGap) {
          best = r;
          bestGap = g;
        }
      }
      return best;
    };
    const left: number[] = [];
    for (const d of [...a.divisions].sort((x, y) => x - y)) {
      const row = t.rowOf(d);
      if (row >= 0) left.push(row);
    }
    while (left.length > 0) {
      const top = mostShort();
      const topGap = gapOf(top);
      if (topGap <= 0) break;
      let i = left.findIndex((row) => t.dest[row] === top);
      if (i < 0) {
        i = left.findIndex(
          (row) => !inScope.has(t.dest[row]) || gapOf(t.dest[row]) <= 0,
        );
      }
      let to = top;
      if (i < 0) {
        // Every division left is headed to a region still short.
        let least = 0;
        let most = 0;
        for (let k = 1; k < left.length; k++) {
          const g = gapOf(t.dest[left[k]]);
          if (g < gapOf(t.dest[left[least]])) least = k;
          if (g > gapOf(t.dest[left[most]])) most = k;
        }
        if (topGap > GARRISON_MOVE_FACTOR * gapOf(t.dest[left[least]])) {
          i = least;
        } else {
          i = most;
          to = t.dest[left[most]];
        }
      }
      assign(left.splice(i, 1)[0], to);
    }
    // Everything covered: the rest stay, or go to the least covered region.
    for (const row of left) {
      assign(row, inScope.has(t.dest[row]) ? t.dest[row] : mostShort());
    }
  }
}

/**
 * P2 movement toward `to` (the move order's way for one division): a
 * standing division starts its next hop, a walking one turns there at the
 * end of its edge. Battles, retreats, advances and voyages go on.
 */
function sendDivision(
  land: WwLand,
  row: number,
  to: number,
  tick: number,
): void {
  const t = land.divisions;
  const m = t.mode[row];
  if (t.battle[row] !== 0) return;
  if (m === MOVE_RETREAT || m === MOVE_ADVANCE || m === MOVE_SEA) return;
  t.dest[row] = to;
  if (m === MOVE_NONE) startNextHop(land, row, tick);
  land.markArmy(t.army[row]);
}
