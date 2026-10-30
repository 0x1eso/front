import {
  DepthOrder,
  WwOrder,
  WwOrderSchema,
} from "@openfront/engine-api/Schemas";
import { DEPTH_ORDER_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  RESOURCE_IDS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../../game/Game";
import { execSnapshotType } from "../../snapshot/ExecutionSnapshot";
import {
  armyAutoAll,
  autoArmyNamed,
  autoSet,
  handOverDomain,
  noteArmyHandOver,
} from "../Automation";
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
 * button with the same block functions. Final review A, finding 1: what
 * the order left pending (queued event cards, depth stats marks) is drained
 * before it returns, since an order applies after the tick's flushes.
 */
export function applyWwOrder(
  mg: Game,
  econ: WwEconomy,
  p: Player,
  order: WwOrder,
  day: number,
): WwOrderBlock | null {
  const ww = econ.ww;
  const id = p.smallID();
  // Automation (owner brief 2026-10-30): a human's own order in a domain
  // the AI runs for it hands the domain back first, with a notice; an auto
  // army the order takes out of auto is told after.
  const army = ww.isActor(id) ? autoArmyNamed(ww, id, order) : 0;
  if (ww.isActor(id)) handOverDomain(mg, ww, id, order);
  const block = applyOrder(mg, econ, p, order, day);
  noteArmyHandOver(mg, ww, id, army);
  econ.ww.settleOrder(mg.ticks());
  return block;
}

function applyOrder(
  mg: Game,
  econ: WwEconomy,
  p: Player,
  order: WwOrder,
  day: number,
): WwOrderBlock | null {
  const ce = econ.country(p.smallID());
  // P5 plan decision 6: the sender's country plays (an exile does).
  if (ce === null || !econ.ww.isActor(p.smallID())) {
    return "dead";
  }
  // P6 (plan decision 4): the 57 depth orders go to the depth systems.
  if (isDepthOrder(order)) {
    const block = econ.ww.depth.issue(p.smallID(), order, mg.ticks());
    if (block === null) econ.markCountryDirty(ce.smallID);
    return block;
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
    // P5 (plan decision 10): the endgame's orders; white peace's
    // peace_offer and peace_reply (appended after P6's) go there too.
    case "peace_submit":
    case "peace_pass":
    case "occupation_law":
    case "integrate_region":
    case "lend_lease":
    case "lend_lease_cancel":
    case "lend_lease_request":
    case "volunteers_send":
    case "volunteers_recall":
    case "air_volunteers":
    case "ships_transfer":
    case "army_garrison":
    case "peace_offer":
    case "peace_reply":
      block = econ.ww.endgame.issue(p.smallID(), order, mg.ticks());
      break;
    case "takeover_pick":
      // Routed by the sender's clientID (WwTakeoverPickExecution): the
      // human it comes from has no country left.
      block = "no_takeover";
      break;
    // Automation (owner brief 2026-10-30): the sender's own country only.
    case "auto_set":
      block = autoSet(econ.ww, p.smallID(), order.domain, order.on);
      break;
    case "army_auto_all":
      block = armyAutoAll(econ.ww, p.smallID(), order.on);
      break;
  }
  if (block === null) econ.markCountryDirty(ce.smallID);
  return block;
}

const DEPTH_KINDS: ReadonlySet<string> = new Set(DEPTH_ORDER_KINDS);

/** P6: one of the depth systems' orders (plan decision 4). */
export function isDepthOrder(o: WwOrder): o is DepthOrder {
  return DEPTH_KINDS.has(o.kind);
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

/**
 * ww_order takeover_pick (spec §11.3, plan Task 1 review fix 1): the sender
 * is a human whose country is gone, so the order goes by the sender's
 * clientID to its takeover card, never through a player.
 */
export class WwTakeoverPickExecution implements Execution {
  constructor(
    private client: string,
    private pick: number,
  ) {}

  init(mg: Game, ticks: number): void {
    const ww = mg.worldWar();
    if (ww === null) return;
    ww.endgame.takeoverPickBy(this.client, this.pick, ticks);
    // Final review A, finding 1: as applyWwOrder.
    ww.settleOrder(ticks);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return WwTakeoverPickExecutionSnapshot.write({
      client: this.client,
      pick: this.pick,
    });
  }

  restoreSnapshot(s: WwTakeoverPickState): void {
    this.client = s.client;
    this.pick = s.pick;
  }
}

const WwTakeoverPickStateSchema = z.object({
  client: z.string(),
  pick: z.number().int(),
});
type WwTakeoverPickState = z.infer<typeof WwTakeoverPickStateSchema>;

export const WwTakeoverPickExecutionSnapshot = execSnapshotType({
  name: "WwTakeoverPick",
  version: 1,
  schema: WwTakeoverPickStateSchema,
  cls: () => WwTakeoverPickExecution,
});

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
