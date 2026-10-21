// P5 lane X fills this file (plan Task 5): governments in exile, takeover
// cards, spectating (spec §10, §11). The foundation's stub: no exile forms;
// a capitulation's forces go as in P0–P4; a human without a country
// spectates.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { EconAdjust, WwEndgame } from "./WwEndgame";

/** Spec §10.1: whether `loser` goes into exile (its side still fights). Stub: never. */
export function formExile(
  eg: WwEndgame,
  loser: number,
  victor: number,
  tick: number,
): boolean {
  void eg;
  void loser;
  void victor;
  void tick;
  return false;
}

/** Spec §10.1: the exile's host. Stub: 0. */
export function pickHost(eg: WwEndgame, loser: number, victor: number): number {
  void eg;
  void loser;
  void victor;
  return 0;
}

/**
 * Spec §5.2: a capitulated country's forces. `host` > 0: what escapes goes
 * to the exile. Stub (P0–P4): its divisions, armies and training are gone
 * (P2), then its fleets, routes and air deployments (P4).
 */
export function capitulationForces(
  eg: WwEndgame,
  loser: number,
  victor: number,
  host: number,
  tick: number,
): void {
  void host;
  void tick;
  eg.ww.land.removeCountryForces(loser);
  eg.ww.navy.onCapitulation(loser, victor);
  eg.ww.air.onCapitulation(loser, victor);
}

/**
 * P4's hook (navy/EndgameHooks.exileNavyAndAir, first in the navy's
 * onCapitulation): ships and deployments that escape to the exile move
 * now; what stays is removed. Stub: nothing escapes.
 */
export function exileFleets(
  eg: WwEndgame,
  loser: number,
  victor: number,
): void {
  void eg;
  void loser;
  void victor;
}

/** Spec §10.3–§10.4: an exile's day (legitimacy, collapse). Stub: nothing. */
export function stepExile(eg: WwEndgame, id: number, day: number): void {
  void eg;
  void id;
  void day;
}

/** Spec §10.5: the exile returns or collapses. Stub: nothing. */
export function endExile(
  eg: WwEndgame,
  id: number,
  tick: number,
  reason: "returned" | "collapsed",
): void {
  void eg;
  void id;
  void tick;
  void reason;
}

/** Spec §10.4: an exile's virtual factories and manpower. Stub: nothing. */
export function exileEconomy(eg: WwEndgame, id: number, out: EconAdjust): void {
  void eg;
  void id;
  void out;
}

/** Spec §10.4: an exile's daily political power, percent. Stub: 100. */
export function exilePpFactorPct(eg: WwEndgame, id: number): number {
  void eg;
  void id;
  return 100;
}

/**
 * Spec §11: a human whose country is gone gets a takeover card. Stub: no
 * candidate — the human spectates (controller 0).
 */
export function offerTakeover(
  eg: WwEndgame,
  client: string,
  fromSmallID: number,
  tick: number,
): void {
  void tick;
  // Told while the country is still theirs (the message goes to its player).
  const p = eg.mg.playerBySmallID(fromSmallID);
  if (p.isPlayer()) {
    eg.mg.displayMessage(
      "events_display.ww1936_spectating",
      MessageType.WORLD_WAR,
      p.id(),
    );
  }
  eg.setControl(client, 0);
}

/** Spec §11.3: takeover cards past their deadline. Stub: nothing. */
export function resolveTakeovers(eg: WwEndgame, tick: number): void {
  void eg;
  void tick;
}

/**
 * takeover_pick from `client` (its card, spec §11.3; routed by clientID,
 * since the sender has no country left). Stub: no card.
 */
export function takeoverPick(
  eg: WwEndgame,
  client: string,
  pick: number,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void client;
  void pick;
  void tick;
  return "no_takeover";
}
