// Great War 1914: a general sent to a front from the map. It spends a schedule
// slot, as anything the seat starts itself does. The one he replaces takes it
// badly, and that shows afterwards in the why-log.
import {
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { ownFronts } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { fieldCommanders, trustBy } from "./People";
import { GW_COMMAND_NAMED_AFTER } from "./Tables";
import { reasonOf } from "./World";

/** Trust a general loses for being replaced in the field. */
const RELIEVED_TRUST = 1;

/** Whether the seat may call him by name at a front yet. */
function known(seat: GwSeatState, id: string): boolean {
  const after = GW_COMMAND_NAMED_AFTER[id];
  return after === undefined || after.some((f) => seat.flags.includes(f));
}

/** The generals the seat could send, wherever they are now. */
export function generalsFor(gw: GreatWar, seat: GwSeatState): string[] {
  return fieldCommanders(gw, seat)
    .filter((p) => known(seat, p.id))
    .map((p) => p.id);
}

/** Applies the `post` order; null when it took effect. */
export function postGeneral(
  gw: GreatWar,
  seat: GwSeatState,
  person: string,
  theatre: GwTheatre,
): GwOrderBlock | null {
  if (seat.acts <= 0) return "no_slot";
  const t = ownFronts(gw, seat).find((x) => x.id === theatre);
  if (t === undefined || theatre === "sea") return "no_front";
  if (!generalsFor(gw, seat).includes(person)) return "no_person";
  if (t.commander === person) return "no_person";
  const relieved = t.commander === null ? null : gw.person(t.commander);
  // A general the story hasn't named at the front yet isn't named here either.
  if (
    relieved !== null &&
    relieved.office === null &&
    known(seat, relieved.id)
  ) {
    trustBy(relieved, -RELIEVED_TRUST);
    reasonOf(gw, seat, "post_relieved", relieved.id);
  }
  for (const other of gw.s.theatres) {
    if (other.commander === person) other.commander = null;
  }
  t.commander = person;
  seat.acts--;
  reasonOf(gw, seat, "post_sent", person);
  return null;
}
