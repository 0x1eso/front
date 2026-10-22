// World War 1936 P6 lane W3 (plan Task 9): the political mechanisms' day
// and orders (spec §12–§14). The country's turn: the continuous focus's
// opening, the US congress (the US turn), the balance of power. The day's
// common step: the naval treaty's clock, then the faction goals.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { dailyBop } from "./BalanceOfPower";
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

/** The treaty clock, then the faction goals (the congress and balance drift on the countries' turns). */
export function dayCommonMech(d: WwDepth, day: number, tick: number): void {
  treatyDay(d, day, tick);
  factionGoalsDay(d, day);
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
