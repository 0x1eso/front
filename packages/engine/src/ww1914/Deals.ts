// Great War 1914 (ww209/ww210, lane S2): bargaining in the lobby (design §3):
// deadlines, counter-offers, a law for a law, earmarks, favours owed both
// ways, threats, peeling a faction's wing, and the seat's ledger (house.deals2)
// that remembers them; word gets round. The lobby list's extras are filled
// in House.ts. S0 left stubs that change nothing: the orders refuse, the
// conds read false, the effects do nothing, the views pass through. See
// /home/eser/dev/ww209-format.md.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCounterKind,
  GwDealTerm,
  GwThreatKind,
} from "@openfront/engine-api/ww1914/GwDeals";
import type { GwDossierView } from "@openfront/engine-api/ww1914/GwHouse";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";
import type { SceneCtx } from "./SceneRun";

export type DealCond = Extract<GwWorldCond, { is: "ledger" }>;
export type DealEffect = Extract<GwWorldEffect, { do: "ledger" }>;

/** Each chapter, after the house: deadlines due, favours come back, threats. */
export function dealStep(_gw: GreatWar): void {}

/** Order `bill_counter`. */
export function billCounter(
  _gw: GreatWar,
  _seat: GwSeatState,
  _law: string,
  _faction: string,
  _counter: GwCounterKind,
  _pick: string | null,
): GwOrderBlock | null {
  return "no_law";
}

/** Order `bill_term`. */
export function billTerm(
  _gw: GreatWar,
  _seat: GwSeatState,
  _law: string,
  _faction: string,
  _want: string,
  _term: GwDealTerm,
): GwOrderBlock | null {
  return "no_law";
}

/** Order `bill_favour`. */
export function billFavour(
  _gw: GreatWar,
  _seat: GwSeatState,
  _law: string,
  _faction: string,
  _want: string | null,
  _call: boolean,
): GwOrderBlock | null {
  return "no_law";
}

/** Order `bill_threat`. */
export function billThreat(
  _gw: GreatWar,
  _seat: GwSeatState,
  _law: string,
  _faction: string,
  _threat: GwThreatKind,
): GwOrderBlock | null {
  return "no_law";
}

/** Order `bill_peel`. */
export function billPeel(
  _gw: GreatWar,
  _seat: GwSeatState,
  _law: string,
  _faction: string,
  _want: string | null,
): GwOrderBlock | null {
  return "no_law";
}

export function dealHolds(_ctx: SceneCtx, _c: DealCond): boolean {
  return false;
}

export function dealDo(_ctx: SceneCtx, _e: DealEffect): void {}

/** The notebook's 약속과 빚 box (`dossier.deals`). */
export function dealsDossierView(
  _gw: GreatWar,
  _seat: GwSeatState,
  v: GwDossierView | undefined,
): GwDossierView | undefined {
  return v;
}
