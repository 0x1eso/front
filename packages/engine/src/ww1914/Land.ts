import {
  GW_FRONT_START,
  GW_FRONT_UP,
  GW_LINE_STEP,
  GW_LINES,
  GwSide,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  frontLandAt,
  frontPlaces,
  isOpenGround,
} from "@openfront/engine-lib/ww1914/FrontLand";
import { placeCells } from "./Cells";
import { posOf } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { GW_FRONT_ENDS } from "./Tables";
import { atWarWith, memberEnd, membersOf, sideIn } from "./Wars";
import { other } from "./World";

/** Who holds a place now. */
export function holderOf(gw: GreatWar, place: GwPlace): GwTag {
  return gw.s.held[place] ?? GW_PLACES[place].owner;
}

/**
 * Gives a place and its tiles to a country: the one way land changes hands.
 * Nothing happens on a map without the place, or for a country with no
 * player. `theatre` is what moved it, for the chapter's record.
 */
export function moveLand(
  gw: GreatWar,
  place: GwPlace,
  to: GwTag,
  theatre: GwTheatreState["id"] | null,
  how?: "occupation" | "table",
): void {
  const id = gw.world.places.get(place);
  const from = holderOf(gw, place);
  const smallID = gw.world.tags.indexOf(to) + 1;
  if (id === undefined || smallID === 0 || from === to) return;
  const player = gw.mg.playerBySmallID(smallID);
  if (!player.isPlayer()) return;
  gw.scenario.ensureRegionTiles(gw.mg.map());
  // ww179: the place's whole cell goes with it (Cells.ts).
  for (const region of placeCells(gw).get(place) ?? [id]) {
    for (const tile of gw.scenario.regionTiles(region)) player.conquer(tile);
  }
  if (to === GW_PLACES[place].owner) {
    delete gw.s.held[place];
    if (gw.s.heldSince !== undefined) delete gw.s.heldSince[place];
  } else {
    gw.s.held[place] = to;
    gw.s.heldSince ??= {};
    gw.s.heldSince[place] = gw.s.chapter;
  }
  gw.s.landMoves.push(
    how === undefined
      ? { place, theatre, from, to }
      : { place, theatre, from, to, how },
  );
  gw.touch();
}

/** The position a theatre's end `e` drives its line towards. */
export function farPos(t: GwTheatreState["id"], e: GwSide): number {
  return e === GW_FRONT_UP[t] ? (GW_LINES[t].length - 1) * GW_LINE_STEP : 0;
}

/**
 * ww179: the front has run past `owner`'s last line here: it fights on this
 * front and the other end stands at the far end. Its places the line no
 * longer names are then left to occupation, not handed back.
 */
export function ranOn(gw: GreatWar, t: GwTheatreState, owner: GwTag): boolean {
  const end = memberEnd(gw, t.id, owner);
  return end !== null && posOf(t) === farPos(t.id, other(end));
}

/**
 * Who a place falls to with the front's end `side` on it. A country gets its
 * own land back, the land of a country this front isn't the war of stays out
 * of it (but for open ground, ww179), and what is taken goes to the lead
 * there (ww171: by ends, not only coalitions).
 */
function takerOf(
  gw: GreatWar,
  t: GwTheatreState,
  place: GwPlace,
  side: GwSide | null,
): GwTag {
  const owner = GW_PLACES[place].owner;
  const now = holderOf(gw, place);
  if (side === null) {
    // Past the owner's last line, what an enemy took stays taken (ww179).
    const kept = now !== owner && atWarWith(gw, now, owner);
    return kept && ranOn(gw, t, owner) ? now : owner;
  }
  const ownerSide = sideIn(gw, t.id, owner);
  if (ownerSide === side) return owner;
  if (ownerSide === null && !isOpenGround(t.id, owner)) return now;
  if (sideIn(gw, t.id, now) === side) return now;
  const listed = GW_FRONT_ENDS[t.id][side].find(
    (tag) => sideIn(gw, t.id, tag) === side && gw.nation(tag)?.out !== true,
  );
  return membersOf(gw, t.id, side)[0] ?? listed ?? now;
}

/**
 * The line a theatre has truly reached. `t.line` rounds down, so one step
 * back from a line already reads as the next one down: land waits for the
 * whole step, either way from the start.
 */
export function reachedLine(t: GwTheatreState): number {
  const pos = posOf(t);
  return pos >= GW_FRONT_START[t.id] * GW_LINE_STEP
    ? Math.floor(pos / GW_LINE_STEP)
    : Math.ceil(pos / GW_LINE_STEP);
}

/**
 * How far past `reachedLine` the front has gone towards the next line, away
 * from the start: -2..2, the sign is the way (see frontLandAt).
 */
export function lineStep(t: GwTheatreState): number {
  return posOf(t) - reachedLine(t) * GW_LINE_STEP;
}

/** The map follows the fronts: each theatre's land goes as its line stands. */
export function frontLandStep(gw: GreatWar): void {
  gw.s.landMoves = [];
  // After the armistice only the table moves land.
  if (gw.s.armistice !== null) return;
  const settled = gw.s.settled ?? [];
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    const held = frontLandAt(t.id, reachedLine(t), lineStep(t), t.salient ?? 0);
    for (const place of frontPlaces(t.id)) {
      const to = takerOf(gw, t, place, held.get(place) ?? null);
      // What a table settled moves again only in a new war of the two (ww172).
      if (settled.includes(place) && !atWarWith(gw, holderOf(gw, place), to)) {
        continue;
      }
      moveLand(gw, place, to, t.id);
    }
  }
}
