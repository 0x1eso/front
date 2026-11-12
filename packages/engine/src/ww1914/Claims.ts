// Great War 1914 (전쟁 목표의 땅): the seat paints the land it wants. The list is
// stored on the seat and read by the national aim, the chief of staff's papers,
// the country's blocs, other countries' answers, the peace table and the memoir.
// How much was painted costs at home and abroad; that shows only afterwards.
import {
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type { GwClaimsView } from "@openfront/engine-api/ww1914/GwTable";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { frontPlaces } from "@openfront/engine-lib/ww1914/FrontLand";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { moveRuler } from "./Ruler";
import { clampTo, reason } from "./World";

/** Places at which greed steps up: modest, wide, vast. */
const GREED_AT = [1, 7, 17] as const;
export const GW_GREED_WORDS = ["modest", "wide", "vast"] as const;
/** A bloc's points at each step of greed. */
const GREED_BLOCS: Readonly<Record<GwBloc, readonly [number, number, number]>> =
  {
    army: [1, 2, 2],
    court: [0, 1, 0],
    parliament: [0, -1, -3],
    business: [1, 1, -1],
    workers: [-1, -2, -4],
    press: [0, 1, -1],
  };
/** What a change of the map costs, each time more. */
const CHANGE_AUTHORITY = 8;
const CHANGE_AUTHORITY_MORE = 4;
const CHANGE_REPUTATION = -1;
/** Half of it, to call it done. */
const HELD_SHARE_PCT = 50;

/** The paint is open while the war is on. */
export function claimsOpen(gw: GreatWar): boolean {
  return gw.s.warChapter !== null && gw.s.armistice === null;
}

/** 0 nothing painted, then 1..3 by how much. */
export function greedOf(seat: GwSeatState): number {
  return GREED_AT.filter((n) => seat.claims.length >= n).length;
}

/** What the bloc makes of the painted land. */
export function greedTerm(
  seat: GwSeatState,
  bloc: GwBloc,
): { key: string; points: number } | null {
  const g = greedOf(seat);
  if (g === 0) return null;
  const points = GREED_BLOCS[bloc][g - 1];
  return { key: `claims_${GW_GREED_WORDS[g - 1]}`, points };
}

/** How many of a country's places the seat has painted. */
export function claimsOn(seat: GwSeatState, tag: GwTag): number {
  return seat.claims.filter((p) => GW_PLACES[p].owner === tag).length;
}

/** Painted land the seat's country holds now. */
export function claimsHeld(gw: GreatWar, seat: GwSeatState): GwPlace[] {
  return seat.claims.filter((p) => holderOf(gw, p) === seat.tag);
}

/** The aim's land is won: nothing painted, or at least half of it held. */
export function claimsMet(gw: GreatWar, seat: GwSeatState): boolean {
  const all = seat.claims.length;
  return claimsHeld(gw, seat).length * 100 >= all * HELD_SHARE_PCT;
}

/** The theatre with the most painted land still to take, of those in `open`. */
export function claimFront(
  gw: GreatWar,
  seat: GwSeatState,
  open: readonly GwTheatre[],
): GwTheatre | null {
  let best: GwTheatre | null = null;
  let most = 0;
  for (const id of open) {
    const n = claimsIn(gw, seat, id).length;
    if (n > most) {
      most = n;
      best = id;
    }
  }
  return best;
}

/** Painted land in a theatre, still to take. */
export function claimsIn(
  gw: GreatWar,
  seat: GwSeatState,
  theatre: GwTheatre,
): GwPlace[] {
  const there = frontPlaces(theatre);
  return seat.claims.filter(
    (p) => there.includes(p) && holderOf(gw, p) !== seat.tag,
  );
}

function trustDown(gw: GreatWar, tag: GwTag, from: GwTag): void {
  const n = gw.nation(tag);
  if (n !== null) n.trust[from] = clampTo((n.trust[from] ?? 0) - 1, -3, 3);
}

/** Friends and neutrals hear of it: those whose land was added think less of it. */
function heard(gw: GreatWar, seat: GwSeatState, added: readonly GwPlace[]) {
  const me = gw.nation(seat.tag);
  const owners = new Set(added.map((p) => GW_PLACES[p].owner));
  for (const tag of [...owners].sort()) {
    const n = gw.nation(tag);
    if (n === null || me === null) continue;
    if (n.side !== null && n.side !== me.side) continue;
    trustDown(gw, tag, seat.tag);
    reason(gw, seat, n.side === null ? "claims_neutral" : "claims_ally");
  }
  if (greedOf(seat) >= 2 && gw.nation("USA")?.side !== me?.side) {
    trustDown(gw, "USA", seat.tag);
    reason(gw, seat, "claims_washington");
  }
}

function payForChange(gw: GreatWar, seat: GwSeatState): void {
  const n = gw.nation(seat.tag);
  if (n !== null) {
    const price = CHANGE_AUTHORITY + seat.claimsChanged * CHANGE_AUTHORITY_MORE;
    n.authority = clampTo(n.authority - price, 0, 100);
  }
  moveRuler(gw, seat, "reputation", CHANGE_REPUTATION, "claims_changed");
  reason(gw, seat, "claims_changed");
  seat.claimsChanged++;
}

/** Applies the `claims` order; null when it took effect. */
export function setClaims(
  gw: GreatWar,
  seat: GwSeatState,
  places: readonly string[],
): GwOrderBlock | null {
  if (!claimsOpen(gw)) return "no_claims";
  const fresh = [...new Set(places)];
  if (fresh.length !== places.length) return "no_claims";
  if (!fresh.every((p) => p in GW_PLACES)) return "no_claims";
  const list = fresh as GwPlace[];
  if (list.some((p) => GW_PLACES[p].owner === seat.tag)) return "no_claims";
  const same =
    list.length === seat.claims.length &&
    list.every((p) => seat.claims.includes(p));
  if (same) return "no_claims";
  const added = list.filter((p) => !seat.claims.includes(p));
  if (seat.claimsSigned >= 0) payForChange(gw, seat);
  else seat.claimsSigned = gw.s.chapter;
  seat.claims = list;
  heard(gw, seat, added);
  const scene = `gw_t_claims_${seat.tag.toLowerCase()}`;
  if (gwContent().scenes.some((x) => x.id === scene)) {
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
  return null;
}

/** The screen's copy. */
export function claimsView(gw: GreatWar, seat: GwSeatState): GwClaimsView {
  return {
    places: seat.claims,
    held: claimsHeld(gw, seat),
    open: claimsOpen(gw),
    priced: seat.claimsSigned >= 0,
    // ww199: the fate chips, painted while the war is on or a table sits.
    fates: seat.fates ?? {},
    fatesOpen:
      claimsOpen(gw) ||
      (gw.s.table !== null &&
        !gw.s.table.closed &&
        gw.s.table.order.includes(seat.tag)),
  };
}
