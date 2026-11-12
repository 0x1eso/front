// Great War 1914 (ww187): scenes that match the state. The facts the tags of
// engine-api/ww1914/GwAssumes read that had no state before: who holds a place
// from the seat's chair, a house closed by its dissolution until the election.
// The tags themselves are asked in SceneRun (assumesHold, pickVariant).
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwHolder } from "@openfront/engine-api/ww1914/GwAssumes";
import type { GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GreatWar } from "./GreatWar";
import { chamberSits, houseRow } from "./House";
import { holderOf } from "./Land";
import type { SceneCtx } from "./SceneRun";
import { atWarWith } from "./Wars";
import { reason } from "./World";

/** A dissolved house stays closed this many days: the campaign and the poll. */
export const GW_ELECTION_DAYS = 60;

/** Who holds the place now, as the seat sees it. */
export function heldBy(
  gw: GreatWar,
  seat: GwSeatState,
  place: GwPlace,
  by: GwHolder,
): boolean {
  const holder = holderOf(gw, place);
  if (by === "owner") return holder === GW_PLACES[place].owner;
  const mine = gw.nation(seat.tag)?.side ?? null;
  const theirs = gw.nation(holder)?.side ?? null;
  if (by === "us") {
    return holder === seat.tag || (mine !== null && mine === theirs);
  }
  if (holder === seat.tag) return false;
  return (
    atWarWith(gw, seat.tag, holder) ||
    (mine !== null && theirs !== null && mine !== theirs)
  );
}

/** The seat's house is dissolved and its election hasn't come. */
export function dissolvedNow(gw: GreatWar, seat: GwSeatState): boolean {
  const d = seat.dissolved;
  return d !== undefined && gw.s.day - d < GW_ELECTION_DAYS;
}

/** A chamber of the seat's house sits now; false with no such chamber. */
export function sitsNow(ctx: SceneCtx, id: GwChamber): boolean {
  const c = houseRow(ctx.seat.tag)?.chambers.find((x) => x.id === id);
  return c !== undefined && chamberSits(ctx, c);
}

/** The house is dissolved: closed from today until its election. */
export function dissolve(gw: GreatWar, seat: GwSeatState): void {
  seat.dissolved = gw.s.day;
}

/** Chapter step: an election past its day opens the house again. */
export function electionStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.dissolved === undefined || dissolvedNow(gw, seat)) continue;
    delete seat.dissolved;
    reason(gw, seat, "house_elected");
  }
}
