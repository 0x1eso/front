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
