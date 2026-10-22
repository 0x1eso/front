// World War 1936 P6 lane W3 (plan Task 9): the political mechanisms' day
// and orders (spec §12–§14). The country's turn: the continuous focus's
// opening, the US congress (the US turn), the balance of power. The day's
// common step: the naval treaty's clock, then the faction goals.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { bopEndsDay, dailyBop } from "./BalanceOfPower";
import { congressDay, usaIdOf } from "./Congress";
import { dailyContinuousFocus, issueCfocus } from "./ContinuousFocus";
import {
  factionGoalsDay,
  issueFactionGoal,
  issueFactionRule,
} from "./FactionRules";
import { issueTreatyLeave, treatyDay } from "./NavalTreaty";
import type { WwDepth } from "./WwDepth";

/** Congress for the US, the balance of power, the continuous focus. */
export function dailyMechanisms(d: WwDepth, id: number, day: number): void {
  dailyContinuousFocus(d, id, day);
  if (id === usaIdOf(d)) congressDay(d, id, day);
  dailyBop(d, id, day);
}

/**
 * The balance-of-power ends (whatever the country's state), the treaty
 * clock, then the faction goals (the congress and balance drift on the
 * countries' turns).
 */
export function dayCommonMech(d: WwDepth, day: number, tick: number): void {
  bopEndsDay(d, day);
  treatyDay(d, day, tick);
  factionGoalsDay(d, day);
}

/**
 * Review fix: W3's state in WwDepth.hash(), after the foundation's part —
 * congress, balance of power (BOP_DEFS order), treaty (members and leavers
 * by smallID), faction rules (faction, rule) and goals (faction), then each
 * country's continuous focus by smallID. The same step as hash()'s mix.
 */
export function mixMechanismsHash(h: number, d: WwDepth): number {
  const mix = (v: number) => {
    h = (Math.imul(h, 31) + (v | 0)) >>> 0;
  };
  const m = d.mech;
  mix(m.congressBp);
  mix(m.congressFull);
  mix(m.attackedUntil);
  mix(m.isolationCleared ? 1 : 0);
  mix(m.bop.length);
  for (const b of [...m.bop].sort((x, y) => x[0] - y[0])) {
    mix(b[0]);
    mix(b[1]);
    mix(b[2]);
  }
  const t = m.treaty;
  mix(t.escalated ? 1 : 0);
  mix(t.ended ? 1 : 0);
  mix(t.members.length);
  for (const id of [...t.members].sort((x, y) => x - y)) mix(id);
  mix(t.leaving.length);
  for (const [id, day] of [...t.leaving].sort((x, y) => x[0] - y[0])) {
    mix(id);
    mix(day);
  }
  mix(m.factionRules.length);
  for (const r of [...m.factionRules].sort(
    (x, y) => x[0] - y[0] || x[1] - y[1],
  )) {
    mix(r[0]);
    mix(r[1]);
    mix(r[2] ? 1 : 0);
    mix(r[3]);
  }
  mix(m.factionGoals.length);
  for (const g of [...m.factionGoals].sort((x, y) => x.faction - y.faction)) {
    mix(g.faction);
    for (const s of g.slots) mix(s);
    mix(g.achieved);
  }
  for (let id = 1; id < d.cap; id++) {
    const c = d.countries[id];
    if (c === null || c === undefined) continue;
    mix(c.mech.cfocus);
    mix(c.mech.cfocusLock);
    mix(c.mech.cfocusOpen ? 1 : 0);
  }
  return h;
}

/** cfocus_set, cfocus_clear, faction_rule, faction_goal, treaty_leave. */
export function issueMech(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  const day = Math.max(0, d.ww.day(tick));
  switch (o.kind) {
    case "cfocus_set":
    case "cfocus_clear":
      return issueCfocus(d, id, o, day);
    case "faction_rule":
      return issueFactionRule(d, id, o, day);
    case "faction_goal":
      return issueFactionGoal(d, id, o);
    case "treaty_leave":
      return issueTreatyLeave(d, id, day);
    default:
      return "bad_index";
  }
}
