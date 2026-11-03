/**
 * DynamicGlyphs — letters the baked MSDF atlas lacks (Hangul, Cyrillic, …),
 * drawn with the browser's own font into spare cells of the atlas texture.
 *
 * The baked atlas is Latin only. A cell here holds a single-channel signed
 * distance field (written to r = g = b, so the name shader's median() reads
 * it back unchanged) made from a canvas rendering of the letter, with the
 * atlas's own conventions: 48 px em, baseline 36 px below the line top,
 * 8 px of padding, distance range 16. Glyph ids from DYN_BASE up are these
 * cells; ids below are the baked atlas.
 */

import type { GlyphTables } from "./AtlasData";
import { CHAR_RANGE } from "./Types";

/** First glyph id of the dynamic cells. */
export const DYN_BASE = CHAR_RANGE;
/** How many letters can be added (a country name set uses well under 200). */
export const DYN_COUNT = 256;
/** Total glyph ids the name pass tables hold. */
export const NAME_CHAR_RANGE = DYN_BASE + DYN_COUNT;
/** Cell edge in atlas pixels (a 48 px em plus 8 px of padding each side). */
export const DYN_CELL = 64;
/** Cells per atlas row; the atlas is 1024 px wide. */
export const DYN_COLS = 16;
/** Rows of cells appended below the baked atlas. */
export const DYN_ROWS = DYN_COUNT / DYN_COLS;
/** Atlas pixels the dynamic cells add to the atlas height. */
export const DYN_HEIGHT = DYN_ROWS * DYN_CELL;

/** Distance range of the baked atlas (msdf-atlas.json distanceField). */
const RANGE = 16;
const PAD = 8;
/** Glyph em in atlas pixels: a Hangul syllable's height matches Latin caps. */
const EM = 40;
/** Line-top-relative offsets of the baked atlas ('A': yoffset -6, base 36). */
const Y_OFFSET = -6;
const BASELINE_IN_CELL = 36 - Y_OFFSET;
/** Supersampling of the canvas the field is made from. */
const SS = 2;

/** A letter drawn on a transparent canvas: alpha at SS× the cell size. */
export interface RasterGlyph {
  /** Alpha, (DYN_CELL * SS)² bytes, row-major. */
  alpha: Uint8Array;
  /** Pen advance in atlas pixels. */
  advance: number;
}

export type GlyphRasterizer = (unit: number) => RasterGlyph;

/** Squared Euclidean distance transform of a 1D function (Felzenszwalb). */
function edt1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  const cross = (q: number, p: number): number =>
    (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
  for (let q = 1; q < n; q++) {
    let s = cross(q, v[k]);
    while (s <= z[k]) {
      k--;
      s = cross(q, v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

/** Squared distance of every cell to the nearest cell where `seed` is 1. */
function edt2d(seed: Uint8Array, w: number, h: number): Float64Array {
  const INF = 1e20;
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = seed[i] === 1 ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

/**
 * A DYN_CELL² field byte per pixel (0 outside .. 128 edge .. 255 inside, over
 * `RANGE` atlas pixels) from an alpha mask drawn at SS× the cell size.
 */
export function alphaToField(alpha: Uint8Array): Uint8Array {
  const hi = DYN_CELL * SS;
  const inside = new Uint8Array(hi * hi);
  const outside = new Uint8Array(hi * hi);
  for (let i = 0; i < hi * hi; i++) {
    if (alpha[i] >= 128) inside[i] = 1;
    else outside[i] = 1;
  }
  const toOutside = edt2d(outside, hi, hi); // for inside pixels
  const toInside = edt2d(inside, hi, hi); // for outside pixels
  const field = new Uint8Array(DYN_CELL * DYN_CELL);
  for (let y = 0; y < DYN_CELL; y++) {
    for (let x = 0; x < DYN_CELL; x++) {
      let signed = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = (y * SS + sy) * hi + (x * SS + sx);
          // Distance to the pixel border across the edge, in cell pixels.
          signed +=
            inside[i] === 1
              ? (Math.sqrt(toOutside[i]) - 0.5) / SS
              : -(Math.sqrt(toInside[i]) - 0.5) / SS;
        }
      }
      signed /= SS * SS;
      const sd = Math.min(1, Math.max(0, 0.5 + signed / RANGE));
      field[y * DYN_CELL + x] = Math.round(sd * 255);
    }
  }
  return field;
}

/** The browser-font rasterizer (main thread: needs a canvas). */
export function canvasRasterizer(): GlyphRasterizer {
  const hi = DYN_CELL * SS;
  let canvas: HTMLCanvasElement | null = null;
  return (unit) => {
    canvas ??= Object.assign(document.createElement("canvas"), {
      width: hi,
      height: hi,
    });
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, hi, hi);
    ctx.font = `700 ${EM * SS}px "Noto Sans KR","Noto Sans CJK KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    const ch = String.fromCharCode(unit);
    ctx.fillText(ch, PAD * SS, BASELINE_IN_CELL * SS);
    const rgba = ctx.getImageData(0, 0, hi, hi).data;
    const alpha = new Uint8Array(hi * hi);
    for (let i = 0; i < hi * hi; i++) alpha[i] = rgba[i * 4 + 3];
    return { alpha, advance: ctx.measureText(ch).width / SS };
  };
}

/** One cell waiting for its pixels to reach the GPU. */
export interface PendingCell {
  /** Atlas pixel position of the cell's top-left corner. */
  x: number;
  y: number;
  /** RGBA pixels, DYN_CELL² texels. */
  pixels: Uint8Array;
}

/** What a new glyph means for the GPU metrics texture (see buildGlyphMetricsTex). */
export interface GlyphMetrics {
  id: number;
  advance: number;
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
  u0: number;
  v0: number;
  u1: number;
}

export class DynamicGlyphs {
  private ids = new Map<number, number>();
  private pending: PendingCell[] = [];

  /**
   * @param glyph CPU glyph tables sized NAME_CHAR_RANGE; filled as letters arrive
   * @param atlasW baked atlas width (cells are packed from x = 0)
   * @param atlasH0 baked atlas height (cells start below it)
   * @param atlasH total texture height, atlasH0 + DYN_HEIGHT
   * @param onMetrics told of every new glyph, for the GPU metrics texture
   */
  constructor(
    private readonly glyph: GlyphTables,
    private readonly atlasW: number,
    private readonly atlasH0: number,
    private readonly atlasH: number,
    private readonly onMetrics: (m: GlyphMetrics) => void,
    private readonly rasterize: GlyphRasterizer,
  ) {}

  /**
   * The glyph id to draw a UTF-16 unit with: itself when the baked atlas has
   * it, a dynamic cell otherwise (made on first use), 0 (not drawn) for a
   * control code, a lone surrogate, or when the cells are full.
   */
  idFor(unit: number): number {
    if (unit < DYN_BASE) return unit;
    if (unit >= 0xd800 && unit <= 0xdfff) return 0;
    const known = this.ids.get(unit);
    if (known !== undefined) return known;
    const n = this.ids.size;
    if (n >= DYN_COUNT) return 0;
    const id = DYN_BASE + n;
    this.ids.set(unit, id);

    const { alpha, advance } = this.rasterize(unit);
    const field = alphaToField(alpha);
    const pixels = new Uint8Array(DYN_CELL * DYN_CELL * 4);
    for (let i = 0; i < DYN_CELL * DYN_CELL; i++) {
      pixels[i * 4] = field[i];
      pixels[i * 4 + 1] = field[i];
      pixels[i * 4 + 2] = field[i];
      pixels[i * 4 + 3] = 255;
    }
    const x = (n % DYN_COLS) * DYN_CELL;
    const y = this.atlasH0 + Math.floor(n / DYN_COLS) * DYN_CELL;
    this.pending.push({ x, y, pixels });

    const adv = Math.round(advance);
    this.glyph.advance[id] = adv;
    // Layout centres on the ink box, not the padded cell.
    this.glyph.xOffset[id] = 0;
    this.glyph.visW[id] = adv;
    this.onMetrics({
      id,
      advance: adv,
      xOffset: -PAD,
      yOffset: Y_OFFSET,
      width: DYN_CELL,
      height: DYN_CELL,
      u0: x / this.atlasW,
      v0: y / this.atlasH,
      u1: (x + DYN_CELL) / this.atlasW,
    });
    return id;
  }

  /** Cells made since the last call, to upload into the atlas texture. */
  takePending(): PendingCell[] {
    if (this.pending.length === 0) return this.pending;
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
