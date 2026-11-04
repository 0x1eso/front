// World War 1936: automation for a human's country (owner brief
// 2026-10-30: humans have too much to do and fall behind the AI). Five
// switches, one per domain (WW_AUTO_DOMAINS), let the AI routines of that
// domain run for a human's country on the AI's own cadence: production
// (AiEconomy's line planner and naval lines), research (AiEconomy's
// research), training (AiLand's division training), air (AiAir's wing planner:
// a direct order pins that wing alone) and navy (AiNavy's fleets and the depth AI's mine fleets;
// never an invasion, nor the fleets supporting one under way). Each system
// asks WorldWar.autoOn where it runs its AI for an AI country; nothing else
// is handed over (no laws, building, trade, focus, decisions, events,
// diplomacy or political power).
//
// The hand-over: a human's own order in a domain that is on switches it off
// first, with a notice, and then applies as usual. The same rule for an
// army's auto command: an order that turns an army's `auto` off (the land
// and navy orders do, P2 spec §8.5) tells the human.
//
// The switches are WorldWar state (snapshot, hash). A takeover clears the
// switches of both countries (WwEndgame.setControl): the country passed to
// the AI has the AI run everything, the human starts with all of them off.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwAutoDomain } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "../game/Game";
import type { WorldWar } from "./WorldWar";

/**
 * A human's orders by the domain they hand back. Production: what the line
 * planner decides (the military and naval lines, their factories and
 * dockyards, retooling, order, a line's design); research: the slots;
 * training: the training queue; air: placing and recalling wings; navy:
 * where a fleet goes and what it does there (the orders AiNavy gives, and a
 * move or a new home port). A fleet's admiral, its carriers' deck mix, its
 * own auto switch and the invasions are no deployment: they stay the human's.
 * Intel: every order of the intelligence screen (founding, upgrades,
 * operatives, operations, cryptology).
 */
export const AUTO_ORDER_DOMAIN: Readonly<
  Partial<Record<WwOrder["kind"], WwAutoDomain>>
> = {
  add_line: "production",
  change_line: "production",
  set_line_factories: "production",
  remove_line: "production",
  move_line: "production",
  line_convert: "production",
  naval_line_add: "production",
  naval_line_docks: "production",
  naval_line_count: "production",
  naval_line_remove: "production",
  naval_line_move: "production",
  research: "research",
  cancel_research: "research",
  train: "training",
  train_army: "training",
  cancel_train: "training",
  deploy_now: "training",
  air_deploy: "air",
  air_recall: "air",
  fleet_mission: "navy",
  fleet_move: "navy",
  fleet_return: "navy",
  fleet_base: "navy",
  fleet_engage: "navy",
  fleet_return_at: "navy",
  fleet_split: "navy",
  fleet_merge: "navy",
  fleet_port_strike: "navy",
  thought_set: "thought",
  intel_found: "intel",
  intel_upgrade: "intel",
  operative_recruit: "intel",
  operative_assign: "intel",
  operative_recall: "intel",
  operation_start: "intel",
  operation_cancel: "intel",
  crypto_target: "intel",
  crypto_activate: "intel",
};

/** The hand-over notice of each domain (full keys: the translation check reads them). */
export const AUTO_OFF_NOTICE: Readonly<Record<WwAutoDomain, string>> = {
  production: "events_display.ww1936_auto_off_production",
  research: "events_display.ww1936_auto_off_research",
  training: "events_display.ww1936_auto_off_training",
  air: "events_display.ww1936_auto_off_air",
  navy: "events_display.ww1936_auto_off_navy",
  thought: "events_display.ww1936_auto_off_thought",
  intel: "events_display.ww1936_auto_off_intel",
};

/** An army's auto command went off by its owner's order. */
export const AUTO_ARMY_OFF_NOTICE = "events_display.ww1936_auto_army_off";

/** auto_set: the sender's own country, while a human controls it. */
export function autoSet(
  ww: WorldWar,
  smallID: number,
  domain: WwAutoDomain,
  on: boolean,
): WwOrderBlock | null {
  if (!ww.isHumanControlled(smallID)) return "not_controlled";
  ww.setAuto(smallID, domain, on);
  // ww8 (design §7): [auto] takes every wing, off leaves each on its orders.
  if (domain === "air" && ww.air.wingsLive) {
    for (const w of ww.air.wingsOf(smallID)) {
      if (w.base >= 0 && w.auto !== on) {
        w.auto = on;
        ww.air.markWing(w.id);
      }
    }
  }
  return null;
}

/**
 * army_auto_all: every army of the sender's country takes `on` (an army
 * the order check refuses — a garrison, a volunteer army — keeps its own).
 * Null when one took it; else the first refusal ("bad_index" with none).
 */
export function armyAutoAll(
  ww: WorldWar,
  smallID: number,
  on: boolean,
): WwOrderBlock | null {
  if (!ww.isHumanControlled(smallID)) return "not_controlled";
  const land = ww.land;
  let first: WwOrderBlock | null = "bad_index";
  let any = false;
  for (const a of [...land.armiesOf(smallID)].sort((x, y) => x.id - y.id)) {
    // ww7: on means the full level (a defend-only army goes up to it).
    if (on ? a.autoLevel === 2 : !a.auto) {
      any = true;
      continue;
    }
    const block = land.issue(
      smallID,
      { kind: "army_auto", army: a.id, on },
      "player",
    );
    if (block === null) any = true;
    else if (first === "bad_index") first = block;
  }
  return any ? null : first;
}

function notify(
  mg: Game,
  ww: WorldWar,
  smallID: number,
  key: string,
  params?: Record<string, string | number>,
): void {
  const p = mg.playerBySmallID(smallID);
  if (!p.isPlayer() || !ww.isHumanControlled(smallID)) return;
  mg.displayMessage(key, MessageType.WORLD_WAR, p.id(), undefined, params);
}

/**
 * The hand-over, before a human's order applies: an order in a domain the
 * AI runs for the country switches that domain off, and the human hears it.
 */
export function handOverDomain(
  mg: Game,
  ww: WorldWar,
  smallID: number,
  order: WwOrder,
): void {
  const domain = AUTO_ORDER_DOMAIN[order.kind];
  if (domain === undefined || !ww.autoOn(smallID, domain)) return;
  // ww8: air_deploy and air_recall are refused in the wing model; a direct wing
  // order pins that wing alone (pinOrderedWings), the switch stays on.
  if (domain === "air" && ww.air.wingsLive) return;
  ww.setAuto(smallID, domain, false);
  notify(mg, ww, smallID, AUTO_OFF_NOTICE[domain]);
}

/**
 * ww8 (owner decision 4): a human's direct order, once it took effect, pins
 * the wings it named; the country's other wings stay under [auto]. The AI's
 * own orders go straight to WwAir.issue and pin nothing.
 */
export function pinOrderedWings(
  ww: WorldWar,
  smallID: number,
  order: WwOrder,
): void {
  let ids: readonly number[];
  if (order.kind === "air_night") ids = [order.deployment];
  else if (order.kind === "wing_mission" || order.kind === "wing_base") {
    ids = order.wings;
  } else return;
  for (const id of ids) {
    const w = ww.air.wings.get(id);
    if (w !== undefined && w.owner === smallID && w.auto) {
      w.auto = false;
      ww.air.markWing(id);
    }
  }
}

/** The sender's auto army the order names (its `army`), or 0. */
export function autoArmyNamed(
  ww: WorldWar,
  smallID: number,
  order: WwOrder,
): number {
  if (
    order.kind === "army_auto" ||
    order.kind === "army_auto_level" ||
    (order.kind === "army_direct" && order.targets === undefined) ||
    !("army" in order)
  ) {
    return 0;
  }
  const id = order.army;
  if (typeof id !== "number" || id <= 0) return 0;
  const a = ww.land.armies.get(id);
  return a !== undefined && a.owner === smallID && a.auto ? id : 0;
}

/** After the order: the army it named lost its auto command — the human hears it. */
export function noteArmyHandOver(
  mg: Game,
  ww: WorldWar,
  smallID: number,
  army: number,
): void {
  if (army === 0) return;
  const a = ww.land.armies.get(army);
  if (a === undefined || a.auto) return;
  // The screens name an army by its number (LandModel.armyName).
  notify(mg, ww, smallID, AUTO_ARMY_OFF_NOTICE, { army: a.nameNo });
}
