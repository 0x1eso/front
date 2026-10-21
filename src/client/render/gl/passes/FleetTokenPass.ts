/**
 * FleetTokenPass — World War 1936 P4 (spec §18.2): one instanced draw of
 * the fleet tokens (WW_MAX_FLEETS a country, at most ~400 on the map): the
 * country's colour in a rounded box, the white silhouette of the fleet's
 * biggest class (ship-atlas.png, drawn for this fork: no ensigns, no
 * insignia), the ship count, HP and organisation bars, the mission icon,
 * the state icon (battle, repair) and a red dot when short of fuel. Docked
 * fleets are drawn small on their port's coast; zoomed out a token is a
 * ship-count chip (FleetTokenLayout's LOD). The chosen fleet's outline
 * breathes and it is drawn last, on top.
 *
 * This file also holds what the other P4 passes share: the ship atlas
 * texture (ShipAtlas), the sprite program (ShipSpriteProgram, fleet-token
 * shaders) and an instance batch for it (ShipSpriteBatch: tokens, chips,
 * text chips such as "✈120" and ✓/✗, convoy ships, rings).
 *
 * Instances are rewritten only when the layout moved or the view, the
 * choice or the viewer changed; nothing is allocated per frame.
 */

import type {
  FleetMission,
  FleetSummary,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { FLEET_FLAG_LOW_FUEL } from "@openfront/engine-api/ww1936/NavyTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import shipAtlasMeta from "resources/atlases/ship-atlas-meta.json";
import type { SeaAirSelection } from "../../../hud/ww1936/SeaAirSelection";
import {
  DOCKED_SCALE,
  type FleetLayoutCache,
  shipCount,
  tokenClass,
} from "../../../view/FleetTokenLayout";
import type { WwNavyView } from "../../../view/WwNavyView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/fleet-token/fleet-token.frag.glsl?raw";
import vertSrc from "../shaders/fleet-token/fleet-token.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";

const shipAtlasUrl = assetUrl("atlases/ship-atlas.png");

/** Atlas cells (ship-atlas-meta.json). */
export const SHIP_CELL = shipAtlasMeta.cells;
export const SHIP_ATLAS_COLS = shipAtlasMeta.cols;
export const SHIP_ATLAS_ROWS = shipAtlasMeta.rows;

/** Floats per instance: three vec4 (see fleet-token.vert.glsl). */
export const SPRITE_FLOATS = 12;
export const KIND_TOKEN = 0;
export const KIND_CHIP = 1;
export const KIND_TEXT = 2;
export const KIND_SPRITE = 3;
export const KIND_RING = 4;
/** Token state bits (fleet-token.frag.glsl). */
export const ST_BATTLE = 1;
export const ST_REPAIR = 2;
export const ST_LOW_FUEL = 4;
/** Token flags. */
export const TOKEN_CHOSEN = 1;
export const TOKEN_DOCKED = 2;
/** Text chip styles. */
export const TEXT_DARK = 0;
export const TEXT_GREEN = 1;
export const TEXT_RED = 2;
export const TEXT_OWNER = 3;
/** Ring styles. */
export const RING_PREP = 0;
export const RING_SPLASH = 1;
export const RING_READY = 2;
/** Glyphs a text chip holds. */
export const TEXT_MAX_GLYPHS = 5;

/** The silhouette cell of each class (bc shares bb's, cl ca's). */
const CLASS_CELL: Readonly<Record<string, number>> = {
  bb: SHIP_CELL.battleship,
  bc: SHIP_CELL.battleship,
  cv: SHIP_CELL.carrier,
  ca: SHIP_CELL.cruiser,
  cl: SHIP_CELL.cruiser,
  dd: SHIP_CELL.destroyer,
  ss: SHIP_CELL.submarine,
};

/** The mission icon cells (spec §18.2); hold shows none. */
export const MISSION_CELL: Readonly<Record<FleetMission, number>> = {
  hold: -1,
  patrol: SHIP_CELL.patrol,
  strike: SHIP_CELL.strike,
  raid: SHIP_CELL.raid,
  escort: SHIP_CELL.escort,
  invasion_support: SHIP_CELL.invasion_support,
  training: SHIP_CELL.training,
};

/** The shader's atlas layout. */
export const SPRITE_DEFINES: Record<string, number> = {
  ATLAS_COLS: SHIP_ATLAS_COLS,
  ATLAS_ROWS: SHIP_ATLAS_ROWS,
  DIGIT0: SHIP_CELL.digit0,
  CELL_PLANE: SHIP_CELL.plane,
  CELL_BATTLE: SHIP_CELL.battle,
  CELL_REPAIR: SHIP_CELL.repair,
  CELL_LOW_FUEL: SHIP_CELL.low_fuel,
  DOCKED_SCALE,
};

/** Screen px a glyph takes in a text chip (as fleet-token.frag.glsl's glyphAdv). */
export function glyphAdvance(cell: number): number {
  if (cell === SHIP_CELL.plane) return 15;
  if (cell < SHIP_CELL.digit0) return 13;
  return 9;
}

/**
 * The glyphs of `prefix` (a cell, or -1 for none) then the digits of `n`
 * (0..9999, larger shows 9999) into `out`; returns how many.
 */
export function numberGlyphs(prefix: number, n: number, out: number[]): number {
  let k = 0;
  if (prefix >= 0) out[k++] = prefix;
  const s = String(Math.max(0, Math.min(9999, Math.floor(n))));
  for (let i = 0; i < s.length && k < TEXT_MAX_GLYPHS; i++) {
    out[k++] = SHIP_CELL.digit0 + s.charCodeAt(i) - 48;
  }
  return k;
}

/** The ship atlas texture: one clear texel until the PNG has loaded. */
export class ShipAtlas {
  readonly texture: WebGLTexture;
  private disposed = false;

  constructor(private gl: WebGL2RenderingContext) {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(4),
    );
    this.texture = tex;
    void this.load();
  }

  private async load(): Promise<void> {
    if (typeof Image === "undefined") return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = shipAtlasUrl;
      await img.decode();
      if (this.disposed) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
    } catch (e) {
      console.warn("[FleetTokenPass] ship atlas failed to load", e);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.gl.deleteTexture(this.texture);
  }
}

/** The fleet-token program, shared by every P4 pass that draws ship sprites. */
export class ShipSpriteProgram {
  readonly program: WebGLProgram;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private paletteTex: WebGLTexture,
    private atlasTex: WebGLTexture,
  ) {
    this.program = createProgram(
      gl,
      shaderSrc(vertSrc, SPRITE_DEFINES),
      shaderSrc(fragSrc, SPRITE_DEFINES),
      "FleetTokenPass",
    );
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCamera = u("uCamera");
    this.uTilesPerPx = u("uTilesPerPx");
    this.uTime = u("uTime");
    gl.useProgram(this.program);
    gl.uniform1i(u("uPalette"), 0);
    gl.uniform1i(u("uAtlas"), 1);
  }

  /** Binds the program, its uniforms and textures for this frame's draws. */
  bind(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
    gl.uniform1f(this.uTime, timeSec);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

/**
 * Instances for ShipSpriteProgram: write with the put* methods from 0, then
 * `upload()`; `draw()` after the program's `bind`.
 */
export class ShipSpriteBatch {
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  /** Instances written since begin(). */
  count = 0;
  /** Instances the last upload sent. */
  drawn = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.buf = new DynamicInstanceBuffer(
      gl,
      gl.createBuffer()!,
      64,
      SPRITE_FLOATS,
    );
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    for (const loc of [1, 2, 3]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        4,
        gl.FLOAT,
        false,
        SPRITE_FLOATS * 4,
        (loc - 1) * 16,
      );
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  /** Starts writing, room for `n` instances (more grow the buffer). */
  begin(n: number): void {
    this.count = 0;
    this.buf.ensureCapacity(Math.max(1, n));
  }

  /** The instance floats as they stand (valid until the next put that grows). */
  get floats(): Float32Array {
    return this.buf.float32;
  }

  private next(): number {
    this.buf.ensureCapacity(this.count + 1);
    return this.count++ * SPRITE_FLOATS;
  }

  private put(
    a0: number,
    a1: number,
    a2: number,
    a3: number,
    b0: number,
    b1: number,
    b2: number,
    b3: number,
    c0: number,
    c1: number,
    c2: number,
    c3: number,
  ): void {
    const o = this.next();
    const f = this.buf.float32;
    f[o] = a0;
    f[o + 1] = a1;
    f[o + 2] = a2;
    f[o + 3] = a3;
    f[o + 4] = b0;
    f[o + 5] = b1;
    f[o + 6] = b2;
    f[o + 7] = b3;
    f[o + 8] = c0;
    f[o + 9] = c1;
    f[o + 10] = c2;
    f[o + 11] = c3;
  }

  /** A fleet token (KIND_TOKEN) or chip (KIND_CHIP). */
  putToken(
    x: number,
    y: number,
    kind: number,
    owner: number,
    cell: number,
    ships: number,
    hpPm: number,
    orgPm: number,
    mission: number,
    state: number,
    flags: number,
  ): void {
    this.put(
      x,
      y,
      kind,
      owner,
      cell,
      ships,
      hpPm,
      orgPm,
      mission,
      state,
      flags,
      0,
    );
  }

  /** A text chip of `n` glyph cells from `glyphs`. */
  putText(
    x: number,
    y: number,
    owner: number,
    glyphs: readonly number[],
    n: number,
    style: number,
  ): void {
    n = Math.min(n, TEXT_MAX_GLYPHS);
    let w = 10;
    for (let i = 0; i < n; i++) w += glyphAdvance(glyphs[i]);
    this.put(
      x,
      y,
      KIND_TEXT,
      owner,
      n > 0 ? glyphs[0] : -1,
      n > 1 ? glyphs[1] : -1,
      n > 2 ? glyphs[2] : -1,
      n > 3 ? glyphs[3] : -1,
      n > 4 ? glyphs[4] : -1,
      style,
      w,
      n,
    );
  }

  /** One atlas cell, `size` px, mirrored when `flip` < 0. */
  putSprite(
    x: number,
    y: number,
    cell: number,
    flip: number,
    alpha: number,
    size: number,
  ): void {
    this.put(x, y, KIND_SPRITE, 0, cell, flip, alpha, size, 0, 0, 0, 0);
  }

  /** A ring of `radius` px: preparation progress, ready pulse or splash. */
  putRing(
    x: number,
    y: number,
    progress: number,
    radius: number,
    style: number,
    phase: number,
  ): void {
    this.put(x, y, KIND_RING, 0, progress, radius, style, phase, 0, 0, 0, 0);
  }

  /** Sends what was written since begin(). */
  upload(): void {
    this.drawn = this.count;
    if (this.count === 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.buf.float32,
      0,
      this.count * SPRITE_FLOATS,
    );
  }

  draw(): void {
    if (this.drawn === 0) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.drawn);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    this.buf.dispose();
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.vao);
  }
}

/** The state bits a token shows for a fleet (spec §18.2). */
export function fleetStateBits(state: string, flags: number): number {
  let s = 0;
  if (state === "battle") s |= ST_BATTLE;
  if (state === "repairing") s |= ST_REPAIR;
  if ((flags & FLEET_FLAG_LOW_FUEL) !== 0) s |= ST_LOW_FUEL;
  return s;
}

/** Per-fleet token attributes cached between samples (FLEET_ATTRS each). */
const FLEET_ATTRS = 8;

export class FleetTokenPass {
  private batch: ShipSpriteBatch;
  private seenView: WwNavyView | null = null;
  private seenVersion = -1;
  private seenSelection = -1;
  private seenFleet = -1;
  /** The layout sample the attributes below were worked out for. */
  private seenSamples = -1;
  /** owner, cell, ships, HP, org, mission, state, flags per fleet of layout.fleets. */
  private attrs = new Float32Array(64 * FLEET_ATTRS);

  constructor(
    gl: WebGL2RenderingContext,
    private sprites: ShipSpriteProgram,
  ) {
    this.batch = new ShipSpriteBatch(gl);
  }

  /** Instances written by the last update. */
  get instanceCount(): number {
    return this.batch.drawn;
  }

  /**
   * Rewrites the instances when `layoutMoved` or the view or the choice
   * changed. `layout` must be updated for this frame. What a token shows
   * is worked out again only when the layout sampled the fleets again;
   * a frame in between only moves the tokens.
   */
  update(
    view: WwNavyView,
    layout: FleetLayoutCache,
    layoutMoved: boolean,
    selection: SeaAirSelection | null,
  ): void {
    const chosen = selection?.fleet ?? 0;
    if (
      !layoutMoved &&
      view === this.seenView &&
      view.version === this.seenVersion &&
      (selection?.version ?? -1) === this.seenSelection &&
      chosen === this.seenFleet
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenSelection = selection?.version ?? -1;
    this.seenFleet = chosen;
    if (layout.samples !== this.seenSamples) {
      this.seenSamples = layout.samples;
      this.cacheAttrs(layout.fleets);
    }
    const kind = layout.lod === 0 ? KIND_TOKEN : KIND_CHIP;
    const b = this.batch;
    b.begin(layout.count);
    let last = false;
    for (let i = 0; i < layout.count; i++) {
      if (layout.slotFleet[i].id === chosen) {
        last = true;
        continue;
      }
      this.write(layout, i, kind, false);
    }
    // The chosen fleet on top (both its slots on the date line).
    if (last) {
      for (let i = 0; i < layout.count; i++) {
        if (layout.slotFleet[i].id === chosen) {
          this.write(layout, i, kind, true);
        }
      }
    }
    b.upload();
  }

  private cacheAttrs(fleets: readonly FleetSummary[]): void {
    if (this.attrs.length < fleets.length * FLEET_ATTRS) {
      this.attrs = new Float32Array(fleets.length * FLEET_ATTRS * 2);
    }
    const a = this.attrs;
    for (let k = 0; k < fleets.length; k++) {
      const f = fleets[k];
      const cls = tokenClass(f.counts);
      const o = k * FLEET_ATTRS;
      a[o] = f.owner;
      a[o + 1] = cls === null ? -1 : CLASS_CELL[cls];
      a[o + 2] = shipCount(f.counts);
      a[o + 3] = f.hpPm;
      a[o + 4] = f.orgPm;
      a[o + 5] = MISSION_CELL[f.mission] ?? -1;
      a[o + 6] = fleetStateBits(f.state, f.flags);
      a[o + 7] = f.docked !== 0 ? TOKEN_DOCKED : 0;
    }
  }

  private write(
    layout: FleetLayoutCache,
    i: number,
    kind: number,
    chosen: boolean,
  ): void {
    const s = layout.slots[i];
    const a = this.attrs;
    const o = layout.slotIndex[i] * FLEET_ATTRS;
    this.batch.putToken(
      s.x,
      s.y,
      kind,
      a[o],
      a[o + 1],
      a[o + 2],
      a[o + 3],
      a[o + 4],
      a[o + 5],
      a[o + 6],
      a[o + 7] | (chosen ? TOKEN_CHOSEN : 0),
    );
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (this.batch.drawn === 0) return;
    this.sprites.bind(cam, tilesPerPx, timeSec);
    this.batch.draw();
  }

  dispose(): void {
    this.batch.dispose();
  }
}
