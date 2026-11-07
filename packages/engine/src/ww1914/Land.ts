import {
  GW_FRONT_START,
  GW_LINE_STEP,
  GwSide,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  frontLandAt,
  frontPlaces,
} from "@openfront/engine-lib/ww1914/FrontLand";
import { posOf } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { membersOf } from "./Wars";

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
): void {
  const id = gw.world.places.get(place);
  const from = holderOf(gw, place);
  const smallID = gw.world.tags.indexOf(to) + 1;
  if (id === undefined || smallID === 0 || from === to) return;
  const player = gw.mg.playerBySmallID(smallID);
  if (!player.isPlayer()) return;
  gw.scenario.ensureRegionTiles(gw.mg.map());
  for (const tile of gw.scenario.regionTiles(id)) player.conquer(tile);
  if (to === GW_PLACES[place].owner) delete gw.s.held[place];
  else gw.s.held[place] = to;
  gw.s.landMoves.push({ place, theatre, from, to });
  gw.touch();
}

/**
 * Who a place falls to with `side` on it. A country gets its own land back,
 * a neutral's land stays out of it, and what is taken goes to the lead there.
 */
function takerOf(
  gw: GreatWar,
  t: GwTheatreState,
  place: GwPlace,
  side: GwSide | null,
): GwTag {
  const owner = GW_PLACES[place].owner;
  const now = holderOf(gw, place);
  if (side === null) return owner;
  const ownerSide = gw.nation(owner)?.side ?? null;
  if (ownerSide === side) return owner;
  if (ownerSide === null) return now;
  if (gw.nation(now)?.side === side) return now;
  return membersOf(gw, t.id, side)[0] ?? now;
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

/** The map follows the fronts: each theatre's land goes as its line stands. */
export function frontLandStep(gw: GreatWar): void {
  gw.s.landMoves = [];
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    const held = frontLandAt(t.id, reachedLine(t));
    for (const place of frontPlaces(t.id)) {
      moveLand(gw, place, takerOf(gw, t, place, held.get(place) ?? null), t.id);
    }
  }
}
