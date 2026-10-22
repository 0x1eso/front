/**
 * LandAtlas — World War 1936 P2 (spec §15.2: "one atlas"): the branch
 * symbols, division counts and status icons of the army tokens and battle
 * markers, drawn once with Canvas2D when the land war starts and uploaded as
 * one mipmapped texture. Nothing binary goes into the repository, and there
 * are no national insignia: a token is its country's colour and a NATO-like
 * branch symbol.
 *
 * 64 px cells, 16 a row: cells 0..11 the branch symbols by BATTALION_IDS
 * index, 16..40 the numbers 0..24, then the icons. The shaders get the
 * layout as #defines (ATLAS_COLS, ATLAS_ROWS).
 */

import { BATTALION_IDS } from "@openfront/engine-api/ww1936/LandTypes";

export const ATLAS_CELL = 64;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 4;
/** First number cell: cell NUMBER_CELL0 + n shows n (0..MAX_NUMBER). */
export const NUMBER_CELL0 = 16;
export const MAX_NUMBER = 24;
/** P6 fog (spec §8.9): "?" for an unknown count and "~" marking a band's top. */
export const CELL_QUESTION = 41;
export const CELL_TILDE = 42;
export const ICON_MOVE = 48;
export const ICON_BATTLE = 49;
export const ICON_RAIL = 50;
export const ICON_SEA = 51;
export const ICON_PARA = 52;

const INK = "#1b1b1b";
const OUTLINE = "rgba(0,0,0,0.9)";
const WHITE = "#ffffff";

type Ctx = CanvasRenderingContext2D;

function cellOrigin(cell: number): [number, number] {
  return [
    (cell % ATLAS_COLS) * ATLAS_CELL,
    Math.floor(cell / ATLAS_COLS) * ATLAS_CELL,
  ];
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function cross(ctx: Ctx): void {
  line(ctx, 5, 6, 59, 58);
  line(ctx, 59, 6, 5, 58);
}

function ellipse(ctx: Ctx, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(32, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function wheels(ctx: Ctx): void {
  for (const x of [20, 44]) {
    ctx.beginPath();
    ctx.arc(x, 53, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A NATO-like branch symbol, dark on transparent, inside a 64 px cell. */
function drawSymbol(ctx: Ctx, id: (typeof BATTALION_IDS)[number]): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (id) {
    case "infantry":
      cross(ctx);
      break;
    case "cavalry":
      line(ctx, 5, 58, 59, 6);
      break;
    case "mountain":
      cross(ctx);
      ctx.beginPath();
      ctx.moveTo(20, 60);
      ctx.lineTo(32, 42);
      ctx.lineTo(44, 60);
      ctx.closePath();
      ctx.fill();
      break;
    case "marine":
      cross(ctx);
      ctx.beginPath();
      ctx.moveTo(12, 52);
      ctx.quadraticCurveTo(22, 44, 32, 52);
      ctx.quadraticCurveTo(42, 60, 52, 52);
      ctx.stroke();
      break;
    case "paratrooper":
      cross(ctx);
      ctx.beginPath();
      ctx.arc(32, 46, 14, 0, Math.PI);
      ctx.stroke();
      break;
    case "motorized":
      ellipse(ctx, 26, 22, 13);
      wheels(ctx);
      break;
    case "artillery":
      ctx.beginPath();
      ctx.arc(32, 32, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "mot_artillery":
      ctx.beginPath();
      ctx.arc(32, 26, 10, 0, Math.PI * 2);
      ctx.fill();
      wheels(ctx);
      break;
    case "anti_tank":
      ctx.beginPath();
      ctx.moveTo(6, 58);
      ctx.lineTo(32, 8);
      ctx.lineTo(58, 58);
      ctx.stroke();
      break;
    case "anti_air":
      ctx.beginPath();
      ctx.arc(32, 52, 24, Math.PI, Math.PI * 2);
      ctx.stroke();
      break;
    case "light_armor":
      ellipse(ctx, 32, 24, 15);
      break;
    case "medium_armor":
      ellipse(ctx, 32, 24, 15);
      ellipse(ctx, 32, 15, 7);
      break;
  }
}

/** White with a dark outline: strokes the current path twice. */
function outlinedStroke(ctx: Ctx, width: number): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 6;
  ctx.stroke();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = width;
  ctx.stroke();
}

function outlinedFill(ctx: Ctx): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.fill();
}

function drawIcon(ctx: Ctx, cell: number): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (cell) {
    case ICON_MOVE:
      ctx.moveTo(10, 32);
      ctx.lineTo(50, 32);
      ctx.moveTo(36, 16);
      ctx.lineTo(52, 32);
      ctx.lineTo(36, 48);
      outlinedStroke(ctx, 7);
      break;
    case ICON_BATTLE:
      // Two crossed swords: blades, then guards.
      ctx.moveTo(12, 12);
      ctx.lineTo(50, 50);
      ctx.moveTo(52, 12);
      ctx.lineTo(14, 50);
      ctx.moveTo(36, 50);
      ctx.lineTo(52, 34);
      ctx.moveTo(28, 50);
      ctx.lineTo(12, 34);
      outlinedStroke(ctx, 6);
      break;
    case ICON_RAIL:
      ctx.moveTo(8, 24);
      ctx.lineTo(56, 24);
      ctx.moveTo(8, 40);
      ctx.lineTo(56, 40);
      for (const x of [16, 28, 40, 52]) {
        ctx.moveTo(x - 2, 16);
        ctx.lineTo(x - 2, 48);
      }
      outlinedStroke(ctx, 4);
      break;
    case ICON_SEA:
      ctx.moveTo(8, 36);
      ctx.lineTo(56, 36);
      ctx.lineTo(46, 52);
      ctx.lineTo(18, 52);
      ctx.closePath();
      outlinedFill(ctx);
      ctx.beginPath();
      ctx.moveTo(32, 34);
      ctx.lineTo(32, 10);
      ctx.lineTo(48, 28);
      ctx.lineTo(32, 28);
      outlinedStroke(ctx, 4);
      break;
    case ICON_PARA:
      ctx.arc(32, 28, 20, Math.PI, Math.PI * 2);
      ctx.closePath();
      outlinedFill(ctx);
      ctx.beginPath();
      ctx.moveTo(13, 28);
      ctx.lineTo(32, 52);
      ctx.lineTo(51, 28);
      ctx.moveTo(32, 28);
      ctx.lineTo(32, 52);
      outlinedStroke(ctx, 3);
      ctx.beginPath();
      ctx.arc(32, 54, 5, 0, Math.PI * 2);
      outlinedFill(ctx);
      break;
  }
}

/** Draws the whole atlas into a 2D context of ATLAS_COLS × ATLAS_ROWS cells. */
export function drawLandAtlas(ctx: Ctx): void {
  ctx.clearRect(0, 0, ATLAS_COLS * ATLAS_CELL, ATLAS_ROWS * ATLAS_CELL);
  BATTALION_IDS.forEach((id, i) => {
    const [x, y] = cellOrigin(i);
    ctx.save();
    ctx.translate(x, y);
    drawSymbol(ctx, id);
    ctx.restore();
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 46px sans-serif";
  ctx.lineJoin = "round";
  for (let n = 0; n <= MAX_NUMBER; n++) {
    const [x, y] = cellOrigin(NUMBER_CELL0 + n);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.strokeText(String(n), x + 32, y + 34, 60);
    ctx.fillStyle = WHITE;
    ctx.fillText(String(n), x + 32, y + 34, 60);
  }
  for (const [cell, ch] of [
    [CELL_QUESTION, "?"],
    [CELL_TILDE, "~"],
  ] as const) {
    const [x, y] = cellOrigin(cell);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.strokeText(ch, x + 32, y + 34, 60);
    ctx.fillStyle = WHITE;
    ctx.fillText(ch, x + 32, y + 34, 60);
  }
  for (const cell of [ICON_MOVE, ICON_BATTLE, ICON_RAIL, ICON_SEA, ICON_PARA]) {
    const [x, y] = cellOrigin(cell);
    ctx.save();
    ctx.translate(x, y);
    drawIcon(ctx, cell);
    ctx.restore();
  }
}

export type CanvasFactory = (
  w: number,
  h: number,
) => { canvas: TexImageSource; ctx: Ctx } | null;

function domCanvas(
  w: number,
  h: number,
): { canvas: TexImageSource; ctx: Ctx } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  try {
    const ctx = canvas.getContext("2d");
    return ctx === null ? null : { canvas, ctx };
  } catch {
    return null;
  }
}

/** The atlas texture (RGBA, mipmapped). Without a 2D canvas it is one clear texel. */
export class LandAtlas {
  readonly texture: WebGLTexture;

  constructor(
    private gl: WebGL2RenderingContext,
    makeCanvas: CanvasFactory = domCanvas,
  ) {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const made = makeCanvas(ATLAS_COLS * ATLAS_CELL, ATLAS_ROWS * ATLAS_CELL);
    if (made !== null) {
      drawLandAtlas(made.ctx);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        made.canvas,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
    } else {
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    this.texture = tex;
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}
