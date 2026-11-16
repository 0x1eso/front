// Great War 1914 (ww218 §5): the army tokens on the map, worked out from the
// seat's view (GwWorldView.tokens). No drawing and no text here: where each
// token stands at a zoom, the rows ArmyTokenPass draws, and the tap's hit.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwTokenView } from "@openfront/engine-api/ww1914/GwTokens";
import {
  ARMY_RAIL,
  BATTALION_IDS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  type DirectTokenRow,
  type DirectTokenSource,
  KIND_CHIP,
  KIND_DOT,
  KIND_TOKEN,
} from "../../render/gl/passes/ArmyTokenPass";
import { fanSlot, tokenLod } from "../../view/LandTokenLayout";

/** Every token is an infantry counter (the 1936 symbol). */
const INFANTRY = BATTALION_IDS.indexOf("infantry");
/** A tap this near a token's middle, in screen px, takes it (design §5). */
export const GW_TOKEN_TAP_PX = 24;

const REL_ORDER = { own: 0, ally: 1, foe: 2 } as const;
const KIND_ORDER = { front: 0, reserve: 1, moving: 2, garrison: 3 } as const;
/**
 * Screen px from one fanned token to the next, by LOD: a token's or a chip's
 * full height with its bars (1936's TOKEN_STEP_PX lets chips overlap).
 */
const STEP_PX: readonly number[] = [32, 24, 9];
/** A token's width on screen by LOD (army-token.vert.glsl's extents). */
const TOKEN_WIDTH_PX: readonly number[] = [52, 44, 16];
/** How many steps a token may be pushed aside before it is left overlapping. */
const MAX_PUSH = 12;

/** One token as it stands on the map at a zoom: tile coordinates after the fan. */
export interface GwTokenPlacement {
  token: GwTokenView;
  key: string;
  x: number;
  y: number;
}

/** Names a token across chapters (the card stays open on the same one). */
export function gwTokenKey(t: GwTokenView): string {
  return `${t.kind}:${t.tag}:${t.theatre ?? "-"}:${t.side ?? "-"}:${t.group ?? "-"}`;
}

/**
 * Tokens sharing an anchor fan out like 1936 (LandTokenLayout.fanSlot): ours
 * first, then allies', then foes', one token height apart at this zoom.
 */
export function placeGwTokens(
  tokens: readonly GwTokenView[],
  zoom: number,
): GwTokenPlacement[] {
  const step = STEP_PX[tokenLod(zoom)] / Math.max(zoom, 1e-6);
  const sorted = [...tokens].sort(
    (a, b) =>
      REL_ORDER[a.rel] - REL_ORDER[b.rel] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0),
  );
  const wide = TOKEN_WIDTH_PX[tokenLod(zoom)] / Math.max(zoom, 1e-6);
  const seen = new Map<string, number>();
  const out: GwTokenPlacement[] = [];
  for (const token of sorted) {
    const anchor = `${Math.round(token.at[0])},${Math.round(token.at[1])}`;
    const k = seen.get(anchor) ?? 0;
    seen.set(anchor, k + 1);
    const p = {
      token,
      key: gwTokenKey(token),
      x: token.at[0],
      y: token.at[1] + fanSlot(k) * step,
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
 * The rows ArmyTokenPass draws. Ours show the exact count; allies their
 * believed count; foes the top of the range with "~" and grey bars (design
 * decision 4B); "?" when nothing is known. The order bar is grey where the
 * view has none.
 */
export function gwTokenRows(
  placed: readonly GwTokenPlacement[],
  zoom: number,
  ownerOf: (tag: GwTag) => number | null,
  chosen: string | null,
): DirectTokenRow[] {
  const lod = tokenLod(zoom);
  const kind = lod === 0 ? KIND_TOKEN : lod === 1 ? KIND_CHIP : KIND_DOT;
  const rows: DirectTokenRow[] = [];
  for (const p of placed) {
    const t = p.token;
    const owner = ownerOf(t.tag);
    if (owner === null) continue;
    const unknown = t.divs === null || t.sure <= 0;
    const foe = t.rel === "foe";
    rows.push({
      x: p.x,
      y: p.y,
      kind,
      owner,
      symbol: INFANTRY,
      shown: unknown ? -1 : foe ? t.hi : (t.divs ?? 0),
      strengthPm: (t.fill ?? 0) * 10,
      orgPm: (t.order ?? 0) * 10,
      state: t.kind === "moving" ? ARMY_RAIL : 0,
      chosen: p.key === chosen,
      approx: !unknown && t.rel !== "own" && t.lo !== t.hi,
      gray: t.fill === null,
      orgGray: t.fill !== null && t.order === null,
    });
  }
  return rows;
}

/** The token nearest a world point within `radiusTiles`, or null. */
export function hitGwToken(
  placed: readonly GwTokenPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
): GwTokenPlacement | null {
  let best: GwTokenPlacement | null = null;
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
  return best;
}

/** What the source reads each frame: the tokens and the one tapped. */
export interface GwTokenInputs {
  tokens: readonly GwTokenView[];
  chosen: string | null;
}

/**
 * The renderer's source (Renderer.setDirectTokens): the same rows array
 * while the tokens, the choice and the zoom stay; `inputs` null hides them.
 */
export class GwTokenSource implements DirectTokenSource {
  private tokens: readonly GwTokenView[] | null = null;
  private chosen: string | null = null;
  private zoom = -1;
  private placed: GwTokenPlacement[] = [];
  private last: readonly DirectTokenRow[] = [];

  constructor(
    private readonly inputs: () => GwTokenInputs | null,
    private readonly ownerOf: (tag: GwTag) => number | null,
  ) {}

  /** Where the tokens stand at `zoom` (what a tap is tested against). */
  placements(zoom: number): readonly GwTokenPlacement[] {
    const now = this.inputs();
    if (now === null) return [];
    if (now.tokens !== this.tokens || zoom !== this.zoom) {
      this.placed = placeGwTokens(now.tokens, zoom);
    }
    return this.placed;
  }

  rows(zoom: number): readonly DirectTokenRow[] {
    const now = this.inputs();
    if (now === null) {
      this.tokens = null;
      if (this.last.length > 0) this.last = [];
      return this.last;
    }
    if (
      now.tokens === this.tokens &&
      now.chosen === this.chosen &&
      zoom === this.zoom
    ) {
      return this.last;
    }
    this.placed = placeGwTokens(now.tokens, zoom);
    this.tokens = now.tokens;
    this.chosen = now.chosen;
    this.zoom = zoom;
    this.last = gwTokenRows(this.placed, zoom, this.ownerOf, now.chosen);
    return this.last;
  }
}
