import { WwOrder, WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  RESOURCE_IDS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../../game/Game";
import { execSnapshotType } from "../../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../../snapshot/SnapshotContext";
import { cancelBuild, moveBuild, queueBuild } from "./Construction";
import { setLaw } from "./LawsRun";
import {
  addLine,
  changeLine,
  moveLine,
  removeLine,
  setLineFactories,
} from "./Production";
import { cancelResearch, startResearch } from "./ResearchRun";
import { closeTrade, openTrade } from "./Trade";
import type { WwEconomy } from "./WwEconomy";

/**
 * Applies one order for `p`'s country (plan decision 3); null when it took
 * effect. A refusal changes nothing and is not logged: the screens grey the
 * button with the same block functions.
 */
export function applyWwOrder(
  mg: Game,
  econ: WwEconomy,
  p: Player,
  order: WwOrder,
  day: number,
): WwOrderBlock | null {
  const ce = econ.country(p.smallID());
  if (ce === null || !p.isAlive() || econ.ww.isCapitulated(p.smallID())) {
    return "dead";
  }
  let block: WwOrderBlock | null;
  switch (order.kind) {
    case "build":
      block = queueBuild(econ, ce, order.region, order.building, order.count);
      break;
    case "cancel_build":
      block = cancelBuild(econ, ce, order.index);
      break;
    case "move_build":
      block = moveBuild(econ, ce, order.index, order.to);
      break;
    case "set_law":
      block = setLaw(econ, ce, order.law, order.value, day);
      break;
    case "add_line":
      block = addLine(econ, ce, order.equipment, order.gen, order.factories);
      break;
    case "change_line":
      block = changeLine(econ, ce, order.line, order.equipment, order.gen);
      break;
    case "set_line_factories":
      block = setLineFactories(econ, ce, order.line, order.factories);
      break;
    case "remove_line":
      block = removeLine(econ, ce, order.line);
      break;
    case "move_line":
      block = moveLine(econ, ce, order.line, order.to);
      break;
    case "open_trade": {
      if (!mg.hasPlayer(order.seller)) return "no_partner";
      const seller = mg.player(order.seller);
      block = openTrade(
        econ,
        ce,
        seller.smallID(),
        RESOURCE_IDS.indexOf(order.resource),
        order.civs,
      );
      break;
    }
    case "close_trade":
      block = closeTrade(econ, ce, order.trade);
      break;
    case "research":
      block = startResearch(econ, ce, order.tech);
      break;
    case "cancel_research":
      block = cancelResearch(econ, ce, order.slot);
      break;
    // P2 (plan decision 2): the land war's orders, a player's (P4 plan
    // decision 34: WwLand.issue hands army_sea to the navy).
    case "template_save":
    case "template_delete":
    case "train":
    case "cancel_train":
    case "deploy_now":
    case "army_move":
    case "army_rail":
    case "army_sea":
    case "army_attack":
    case "army_front":
    case "army_plan":
    case "army_execute":
    case "army_halt":
    case "army_split":
    case "army_merge":
    case "army_disband":
    case "army_general":
    case "army_auto":
    case "paradrop":
    case "appoint_general":
      block = econ.ww.land.issue(p.smallID(), order, "player");
      break;
    // P3 (plan decision 3): politics' orders, the same for humans and the AI.
    case "focus_start":
    case "focus_queue":
    case "focus_cancel":
    case "focus_unqueue":
    case "advisor_hire":
    case "advisor_fire":
    case "decision_take":
    case "decision_cancel":
    case "event_choose":
    case "justify":
    case "justify_cancel":
    case "guarantee":
    case "guarantee_end":
    case "nap_offer":
    case "nap_break":
    case "access_ask":
    case "access_revoke":
    case "faction_create":
    case "faction_invite":
    case "faction_request":
    case "faction_kick":
    case "faction_leave":
    case "faction_dissolve":
    case "improve_relations":
      block = econ.ww.politics.issue(p.smallID(), order, mg.ticks());
      break;
    // P4 (plan decision 3): the navy's and the air war's orders.
    case "fleet_mission":
    case "fleet_move":
    case "fleet_return":
    case "fleet_base":
    case "fleet_engage":
    case "fleet_return_at":
    case "fleet_split":
    case "fleet_merge":
    case "fleet_admiral":
    case "fleet_auto":
    case "fleet_port_strike":
    case "carrier_mix":
    case "naval_line_add":
    case "naval_line_docks":
    case "naval_line_count":
    case "naval_line_remove":
    case "naval_line_move":
    case "appoint_admiral":
    case "army_invade":
    case "invasion_execute":
    case "invasion_cancel":
      block = econ.ww.navy.issue(p.smallID(), order, mg.ticks(), "player");
      break;
    case "air_deploy":
    case "air_recall":
    case "air_auto":
      block = econ.ww.air.issue(p.smallID(), order, mg.ticks());
      break;
  }
  if (block === null) econ.markCountryDirty(ce.smallID);
  return block;
}

/**
 * ww_order (plan decision 2): one economy order of the sender's country,
 * applied once in init (also during the preparation minute, spec §2).
 */
export class WwOrderExecution implements Execution {
  constructor(
    private player: Player,
    private order: WwOrder,
  ) {}

  init(mg: Game, ticks: number): void {
    const ww = mg.worldWar();
    if (ww === null) return;
    applyWwOrder(mg, ww.economy, this.player, this.order, ww.day(ticks));
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return WwOrderExecutionSnapshot.write({
      player: w.player(this.player),
      order: JSON.stringify(this.order),
    });
  }

  restoreSnapshot(s: WwOrderState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.order = WwOrderSchema.parse(JSON.parse(s.order));
  }
}

const WwOrderStateSchema = z.object({
  player: zPlayerRef(),
  order: z.string(),
});
type WwOrderState = z.infer<typeof WwOrderStateSchema>;

export const WwOrderExecutionSnapshot = execSnapshotType({
  name: "WwOrder",
  version: 1,
  schema: WwOrderStateSchema,
  cls: () => WwOrderExecution,
});
