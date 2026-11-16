// Great War 1914 (ww221 §3): the fleet tokens on the map, worked out from the
// seat's view (GwWorldView.fleets). No drawing and no text here: where each
// token stands at a zoom, the rows FleetTokenPass draws (the 1936 fleet
// token), and the tap's hit. The fan and the push-apart follow the army
// tokens (GwTokenModel); the LOD is the 1936 fleets' (token, chip).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFleetKind,
  GwFleetMission,
  GwFleetTokenView,
} from "@openfront/engine-api/ww1914/GwFleets";
import {
  type DirectFleetRow,
  type DirectFleetSource,
  KIND_CHIP,
  KIND_TOKEN,
  SHIP_CELL,
  ST_BATTLE,
  ST_REPAIR,
} from "../../render/gl/passes/FleetTokenPass";
import { DOCKED_SCALE, fleetLod } from "../../view/FleetTokenLayout";
import { fanSlot } from "../../view/LandTokenLayout";

/** A tap this near a token's middle, in screen px, takes it (design §3). */
export const GW_FLEET_TAP_PX = 24;

/** The 1936 silhouette of each kind. */
export const FLEET_KIND_CELL: Readonly<Record<GwFleetKind, number>> = {
  battle: SHIP_CELL.battleship,
  cruisers: SHIP_CELL.cruiser,
  subs: SHIP_CELL.submarine,
};

/** The 1936 mission badge of each mission. */
export const FLEET_MISSION_CELL: Readonly<Record<GwFleetMission, number>> = {
  patrol: SHIP_CELL.patrol,
  raid: SHIP_CELL.raid,
  escort: SHIP_CELL.escort,
  strike: SHIP_CELL.strike,
  invasion_support: SHIP_CELL.invasion_support,
};

const REL_ORDER = { own: 0, ally: 1, foe: 2 } as const;
const KIND_ORDER = { battle: 0, cruisers: 1, subs: 2 } as const;
/** Screen px from one fanned token to the next, by LOD (1936 FLEET_STEP_PX, plus bars). */
const STEP_PX: readonly number[] = [40, 22];
/** A token's width on screen by LOD (fleet-token.frag.glsl's box and badges). */
const TOKEN_WIDTH_PX: readonly number[] = [56, 28];
/** How many steps a token may be pushed aside before it is left overlapping. */
const MAX_PUSH = 12;

/** One fleet token as it stands on the map at a zoom: tile coordinates after the fan. */
export interface GwFleetPlacement {
  fleet: GwFleetTokenView;
  key: string;
  x: number;
  y: number;
}

/** Names a token across chapters (the card stays open on the same fleet). */
export function gwFleetKey(f: GwFleetTokenView): string {
  return `${f.rel}:${f.id}`;
}

/**
 * Tokens sharing an anchor fan out like the army tokens: ours first, then
 * allies', then foes', battle fleets before cruisers and boats. A docked
 * token is drawn smaller, so it steps less.
 */
export function placeGwFleets(
  fleets: readonly GwFleetTokenView[],
  zoom: number,
): GwFleetPlacement[] {
  const lod = fleetLod(zoom);
  const z = Math.max(zoom, 1e-6);
  const sorted = [...fleets].sort(
    (a, b) =>
      REL_ORDER[a.rel] - REL_ORDER[b.rel] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const seen = new Map<string, number>();
  const out: GwFleetPlacement[] = [];
  for (const fleet of sorted) {
    const scale = fleet.port ? DOCKED_SCALE : 1;
    const step = (STEP_PX[lod] * scale) / z;
    const wide = (TOKEN_WIDTH_PX[lod] * scale) / z;
    const anchor = `${Math.round(fleet.at[0])},${Math.round(fleet.at[1])}`;
    const k = seen.get(anchor) ?? 0;
    seen.set(anchor, k + 1);
    const p = {
      fleet,
      key: gwFleetKey(fleet),
      x: fleet.at[0],
      y: fleet.at[1] + fanSlot(k) * step,
    };
    // Tokens of nearby anchors that would cover each other step aside, down.
    for (let i = 0; i < MAX_PUSH; i++) {
      const hit = out.some(
        (q) => Math.abs(q.x - p.x) < wide && Math.abs(q.y - p.y) < step - 1e-6,
      );
      if (!hit) break;
      p.y += step;
    }
    out.push(p);
  }
  return out;
}

/**
 * The rows FleetTokenPass draws. Ours show the exact count and how worn
 * (the HP bar); allies their count; foes the top of the range with "~" and
 * grey bars (design decision 4B); "?" when nothing is known. The second
 * (organisation) bar is unused: grey. Mission, battle and repair badges as
 * 1936; in port the token is drawn small (docked).
 */
export function gwFleetRows(
  placed: readonly GwFleetPlacement[],
  zoom: number,
  ownerOf: (tag: GwTag) => number | null,
  chosen: string | null,
): DirectFleetRow[] {
  const kind = fleetLod(zoom) === 0 ? KIND_TOKEN : KIND_CHIP;
  const rows: DirectFleetRow[] = [];
  for (const p of placed) {
    const f = p.fleet;
    const owner = ownerOf(f.tag);
    if (owner === null) continue;
    const unknown = f.ships === null || f.sure <= 0;
    const foe = f.rel === "foe";
    rows.push({
      x: p.x,
      y: p.y,
      kind,
      owner,
      cell: FLEET_KIND_CELL[f.kind],
      ships: unknown ? -1 : foe ? f.hi : (f.ships ?? 0),
      hpPm: f.fill === null ? -1 : f.fill * 10,
      orgPm: -1,
      mission:
        f.port || f.mission === null ? -1 : FLEET_MISSION_CELL[f.mission],
      state: (f.fought ? ST_BATTLE : 0) | (f.repair ? ST_REPAIR : 0),
      chosen: p.key === chosen,
      docked: f.port,
      approx: !unknown && f.rel !== "own" && f.lo !== f.hi,
      unknown,
    });
  }
  return rows;
}

/** The token nearest a world point within `radiusTiles`, with its squared distance. */
export function hitGwFleet(
  placed: readonly GwFleetPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
): { at: GwFleetPlacement; d2: number } | null {
  let best: GwFleetPlacement | null = null;
  let bestD = radiusTiles * radiusTiles;
  for (const p of placed) {
    // The shader draws a token at its tile's middle.
    const dx = p.x + 0.5 - wx;
    const dy = p.y + 0.5 - wy;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best === null ? null : { at: best, d2: bestD };
}

/** What the source reads each frame: the fleets and the one tapped. */
export interface GwFleetInputs {
  fleets: readonly GwFleetTokenView[];
  chosen: string | null;
}

/**
 * The renderer's source (Renderer.setDirectFleets): the same rows array
 * while the fleets, the choice and the zoom stay; `inputs` null hides them.
 */
export class GwFleetSource implements DirectFleetSource {
  private fleets: readonly GwFleetTokenView[] | null = null;
  private chosen: string | null = null;
  private zoom = -1;
  private placed: GwFleetPlacement[] = [];
  private last: readonly DirectFleetRow[] = [];

  constructor(
    private readonly inputs: () => GwFleetInputs | null,
    private readonly ownerOf: (tag: GwTag) => number | null,
  ) {}

  /** Where the tokens stand at `zoom` (what a tap is tested against). */
  placements(zoom: number): readonly GwFleetPlacement[] {
    const now = this.inputs();
    if (now === null) return [];
    this.rows(zoom);
    return this.placed;
  }

  rows(zoom: number): readonly DirectFleetRow[] {
    const now = this.inputs();
    if (now === null) {
      this.fleets = null;
      if (this.last.length > 0) this.last = [];
      return this.last;
    }
    if (
      now.fleets === this.fleets &&
      now.chosen === this.chosen &&
      zoom === this.zoom
    ) {
      return this.last;
    }
    this.placed = placeGwFleets(now.fleets, zoom);
    this.fleets = now.fleets;
    this.chosen = now.chosen;
    this.zoom = zoom;
    this.last = gwFleetRows(this.placed, zoom, this.ownerOf, now.chosen);
    return this.last;
  }
}
