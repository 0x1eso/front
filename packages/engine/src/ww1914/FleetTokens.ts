// Great War 1914 (ww221 §3): the fleet tokens a seat sees. Ours exact; allies'
// and foes' as the seat believes them. A foe's losses hide until we are sure,
// and a foe that put out unheard still lies in its home port on our map, so
// the truth of another's fleet never reaches the client.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, type GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFleet,
  GwFleetSeen,
  GwFleetTokenView,
  GwSeaArea,
} from "@openfront/engine-api/ww1914/GwFleets";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { hasTech } from "./Eras";
import {
  fleetMoves,
  foes,
  GW_HOME_PORTS,
  GW_SEA_ANCHORS,
  homePortOf,
  REPAIR_AT,
} from "./Fleets";
import type { GreatWar } from "./GreatWar";
import { heardOf, readsAtSea } from "./NavalIntel";
import { BELIEF_RANGE } from "./Transfers";
import { fights } from "./World";

const P_BELIEF = idHash("gw_fleet_belief");
/** Chapters a bearing or a fleet seen leaving keeps a foe surer. */
const HEARD_WITHIN = 2;
const WEAR_MAX = 8;

type Pt = readonly [number, number];

export interface FleetBelief {
  sure: number;
  seen: GwFleetSeen;
  /** Believed ships; null at sure 0. */
  ships: number | null;
  lo: number;
  hi: number;
  /** It put out unheard: we still think it lies in its home port. */
  hidden: boolean;
}

const homeArea = (f: GwFleet): GwSeaArea =>
  f.id.slice(f.id.lastIndexOf("_") + 1) as GwSeaArea;

/** Our cruisers (or a partner's) out in that area. */
function cruisersIn(gw: GreatWar, viewer: GwTag, area: GwSeaArea): boolean {
  const side = gw.nation(viewer)?.side ?? null;
  return (gw.s.fleets ?? []).some(
    (f) =>
      f.kind === "cruisers" &&
      f.ships > 0 &&
      f.area === area &&
      f.to === undefined &&
      !f.port &&
      (f.tag === viewer || (side !== null && gw.nation(f.tag)?.side === side)),
  );
}

/** What `viewer` believes of fleet `f` (§3). */
export function fleetBelief(
  gw: GreatWar,
  viewer: GwTag,
  f: GwFleet,
): FleetBelief {
  if (f.tag === viewer) {
    return {
      sure: 3,
      seen: "own",
      ships: f.ships,
      lo: f.ships,
      hi: f.ships,
      hidden: false,
    };
  }
  const vn = gw.nation(viewer);
  const ally = !foes(gw, viewer, f.tag);
  let sure = 2;
  let seen: GwFleetSeen = "ally";
  let hidden = false;
  if (!ally) {
    sure = f.kind === "battle" ? 2 : 1;
    seen = "programme";
    const saw =
      f.outAt !== undefined &&
      gw.s.chapter - f.outAt <= HEARD_WITHIN &&
      (f.heardBy ?? []).includes(viewer);
    // Cruisers on patrol meet a fleet at sea, not one behind its booms, and
    // not in the chapter it put out: that is the chain's to hear.
    const contact =
      !f.port &&
      (f.outAt === undefined || f.outAt < gw.s.chapter) &&
      cruisersIn(gw, viewer, f.area);
    if (saw || heardOf(gw, viewer, f.tag, HEARD_WITHIN)) {
      sure++;
      seen = "heard";
    } else if (contact) {
      sure++;
      seen = "contact";
    }
    if (readsAtSea(gw, viewer, f.tag)) {
      sure++;
      seen = "codes";
    } else if (vn !== null && hasTech(vn, "aerial_photos")) {
      sure++;
      seen = "air";
    }
    sure = Math.min(3, sure);
    // Port hides: it left unheard, and nobody of ours has met it since.
    hidden =
      !f.port &&
      f.outAt !== undefined &&
      !(f.heardBy ?? []).includes(viewer) &&
      !contact &&
      sure < 3 &&
      GW_HOME_PORTS[f.tag]?.[homeArea(f)] !== undefined;
    if (hidden) seen = "last";
  }
  // Losses hide until we are sure; the building programmes are public.
  const base = sure >= 3 ? f.ships : f.known;
  const span = (4 - sure) * 10;
  const roll = wwRoll(
    gw.s.seed,
    P_BELIEF,
    Math.floor(gw.s.chapter / 2),
    GW_TAGS.indexOf(viewer) * GW_TAGS.length + GW_TAGS.indexOf(f.tag),
    (gw.s.fleets ?? []).indexOf(f),
  );
  let off = (roll % (2 * span + 1)) - span;
  if (sure < 3 && Math.abs(off) < 5) off = off < 0 ? -5 : 5;
  let ships = Math.max(1, Math.floor((base * (100 + off)) / 100));
  // Below sure 3 the guess is never the count itself.
  if (sure < 3 && ships === f.ships) {
    ships = off < 0 && ships > 1 ? ships - 1 : ships + 1;
  }
  const r = BELIEF_RANGE[sure];
  return {
    sure,
    seen,
    ships,
    lo: Math.floor((ships * (100 - r)) / 100),
    hi: Math.floor((ships * (100 + r) + 99) / 100),
    hidden,
  };
}

const mid = (a: Pt, b: Pt): Pt => [
  Math.round((a[0] + b[0]) / 2),
  Math.round((a[1] + b[1]) / 2),
];

function portPoint(f: GwFleet, area: GwSeaArea): Pt {
  const port = GW_HOME_PORTS[f.tag]?.[area];
  return port === undefined ? GW_SEA_ANCHORS[area] : GW_PLACES[port].center;
}

/** The seat's fleet tokens; undefined while its country is not at war. */
export function fleetTokensView(
  gw: GreatWar,
  seat: GwSeatState,
): GwFleetTokenView[] | undefined {
  const n = gw.nation(seat.tag);
  if (n === null || !fights(n) || gw.s.fleets === undefined) return undefined;
  const out: GwFleetTokenView[] = [];
  const c = gw.s.chapter;
  for (const f of gw.s.fleets) {
    const own = f.tag === seat.tag;
    const foe = foes(gw, seat.tag, f.tag);
    const ally =
      !own &&
      !foe &&
      n.side !== null &&
      gw.nation(f.tag)?.side === n.side &&
      fights(gw.nation(f.tag));
    if (!own && !foe && !ally) continue;
    if (f.ships === 0 && (own || ally || f.known === 0)) continue;
    const b = fleetBelief(gw, seat.tag, f);
    const sure3 = own || b.sure >= 3;
    const area = b.hidden ? homeArea(f) : f.area;
    const port = b.hidden || f.port;
    const moving = f.to !== undefined && (own || ally || sure3) && !b.hidden;
    const at: Pt = moving
      ? mid(GW_SEA_ANCHORS[f.area], GW_SEA_ANCHORS[f.to!])
      : port
        ? portPoint(f, area)
        : GW_SEA_ANCHORS[area];
    const friend = own || ally;
    const view: GwFleetTokenView = {
      id: f.id,
      tag: f.tag,
      rel: own ? "own" : ally ? "ally" : "foe",
      kind: f.kind,
      area,
      at,
      port,
      homePort: b.hidden
        ? (GW_HOME_PORTS[f.tag]?.[area] ?? null)
        : homePortOf(f),
      ships: b.ships,
      lo: b.lo,
      hi: b.hi,
      sure: b.sure,
      seen: b.seen,
      fill: friend
        ? 100 - Math.floor((Math.min(WEAR_MAX, f.wear) * 100) / WEAR_MAX)
        : null,
      mission: port || !(friend || sure3) ? null : f.mission,
      fought: f.fought !== undefined && f.fought >= c - 1,
      repair: friend && f.wear >= REPAIR_AT,
      ...(moving ? { to: f.to, eta: Math.max(1, (f.eta ?? c) - c) } : {}),
    };
    if (own) {
      view.moves = fleetMoves(gw, f);
      if (f.kind !== "subs") {
        const why =
          f.to !== undefined
            ? "fleet_moving"
            : f.wear >= REPAIR_AT
              ? "fleet_repair"
              : null;
        view.sortie = { open: why === null, why };
      }
    }
    out.push(view);
  }
  return out;
}
