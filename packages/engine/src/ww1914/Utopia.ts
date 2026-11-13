// Great War 1914 (ww207/ww208, lane S2): the faction utopias. Affinity, the
// trees' nodes, realisation (society absorbed, 불온 emptied, the regime
// changed), the option-B card (end here or play on as the new head), the
// factions' abilities as power rows, trust, rallies and protests, the AI's
// trees. The S0 format commit leaves these as stubs that change nothing
// (GW_DIGEST holds); S2 owns this file. Rows: engine-lib/ww1914/UtopiaRows.
// See /home/eser/dev/ww207-format.md.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwStripFactionView } from "@openfront/engine-api/ww1914/GwSociety";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";
import type { SceneCtx } from "./SceneRun";

export type UtopiaCond = Extract<
  GwWorldCond,
  { is: "affinity" | "node" | "utopia" }
>;

export type UtopiaEffect = Extract<GwWorldEffect, { do: "affinity" }>;

/** The chapter's utopia step, after the society's (GW_CHAPTER_STEPS). S2. */
export function utopiaStep(gw: GreatWar): void {
  void gw;
}

/** S2: the utopias' world conds. The stub holds none. */
export function utopiaHolds(ctx: SceneCtx, c: UtopiaCond): boolean {
  void ctx;
  void c;
  return false;
}

/** S2: the utopias' world effects. The stub does nothing. */
export function utopiaDo(ctx: SceneCtx, e: UtopiaEffect): void {
  void ctx;
  void e;
}

/** Order `node_open` (연다). S2. */
export function openNode(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
  node: string,
): GwOrderBlock | null {
  void gw;
  void seat;
  void faction;
  void node;
  return "no_node";
}

/** Order `utopia_realise` (실현한다). S2. */
export function realiseUtopia(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  void gw;
  void seat;
  void faction;
  return "no_utopia";
}

/** Order `utopia_choice`: end here, or play on as the new head (1B). S2. */
export function utopiaChoice(
  gw: GreatWar,
  seat: GwSeatState,
  play: boolean,
): GwOrderBlock | null {
  void gw;
  void seat;
  void play;
  return "no_utopia";
}

/** The faction card's tree (Society's societyView calls it). S2. */
export function treeView(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwStripFactionView["tree"] {
  void gw;
  void seat;
  void faction;
  return null;
}

/** The chip's ability and its amber dot (Society's societyView calls it). S2. */
export function abilityView(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwStripFactionView["ability"] {
  void gw;
  void seat;
  void faction;
  return null;
}
