import {
  GW_REGENT_AFTER,
  GW_SLOW_MAX,
  GW_SLOW_SEC,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWar } from "./GreatWar";
import { plotsAfterRegency } from "./Plots";
import { news, reason } from "./World";

/** Friends at one table (design §9): who is here, who is away, who runs what. */

function isAway(gw: GreatWar, seat: GwSeatState): boolean {
  const p = gw.mg.playerBySmallID(seat.smallID);
  return p.isPlayer() && p.isDisconnected();
}

export function isHost(gw: GreatWar, seat: GwSeatState): boolean {
  const p = gw.mg.playerBySmallID(seat.smallID);
  return p.isPlayer() && p.isLobbyCreator();
}

/**
 * Seats that count for "everyone is ready": not a dropped friend, not a
 * regent's, not one that has left the war for its memoirs.
 */
export function waitedFor(seat: GwSeatState): boolean {
  return seat.memoir === null && !seat.away && !seat.regent;
}

/**
 * The seat is back in the player's hands. Plots start a new round: what
 * came while the regent sat there was read by nobody, so it comes again.
 */
export function takeBack(gw: GreatWar, seat: GwSeatState): void {
  if (!seat.regent) return;
  seat.regent = false;
  seat.idle = 0;
  plotsAfterRegency(gw, seat);
  reason(gw, seat, "seat_taken_back");
  gw.touch();
}

/** Every tick: who dropped, and who came back to a regent's seat. */
export function watchSeats(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const away = isAway(gw, seat);
    if (away === seat.away) continue;
    seat.away = away;
    if (!away) takeBack(gw, seat);
    gw.touch();
  }
}

/** An order came from the seat: somebody is sitting there. */
export function noteActed(gw: GreatWar, seat: GwSeatState): void {
  seat.ordered = true;
  takeBack(gw, seat);
}

/** A chapter closes: a seat empty twice in a row goes to its regent. */
export function closeSeats(gw: GreatWar): void {
  const clocked = gw.s.deadlineTick !== null;
  for (const seat of gw.s.seats) {
    seat.idle = seat.ordered || seat.ready ? 0 : seat.idle + 1;
    seat.ordered = false;
    if (!clocked || seat.regent || seat.idle < GW_REGENT_AFTER) continue;
    seat.regent = true;
    reason(gw, seat, "regent_took_over");
    news(gw, "regent_took_over", seat.tag);
  }
}

/** A regent signs what the country's AI planned for the coming chapter. */
export function regentStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (!seat.regent) continue;
    const plan = gw.nation(seat.tag)?.alloc ?? null;
    if (plan !== null) seat.alloc = { ...plan };
  }
}

function grantSlow(gw: GreatWar): void {
  const s = gw.s;
  s.deadlineTick! += GW_SLOW_SEC * 10;
  s.slowGranted++;
  s.slowAsked = [];
}

/** The host's word is enough; with no host at the table, the asking is. */
export function askSlow(gw: GreatWar, seat: GwSeatState): GwOrderBlock | null {
  const s = gw.s;
  if (s.deadlineTick === null) return "closed";
  if (s.slowGranted >= GW_SLOW_MAX) return "slow_spent";
  const hostHere = s.seats.some((x) => isHost(gw, x) && !x.away && !x.regent);
  if (isHost(gw, seat) || !hostHere) {
    grantSlow(gw);
  } else if (!s.slowAsked.includes(seat.smallID)) {
    s.slowAsked.push(seat.smallID);
  }
  return null;
}

export function answerSlow(
  gw: GreatWar,
  seat: GwSeatState,
  grant: boolean,
): GwOrderBlock | null {
  const s = gw.s;
  if (!isHost(gw, seat)) return "not_host";
  if (s.slowAsked.length === 0 || s.deadlineTick === null) return "not_asked";
  if (grant && s.slowGranted < GW_SLOW_MAX) grantSlow(gw);
  s.slowAsked = [];
  return null;
}
