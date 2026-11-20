// ww240: a country's flag on every 1936 screen and on the map. The engine
// names a civil-war slot's flag after its ideology alone (ww_cw_<ideology>,
// WwEndgame.flagOf), so every side of every civil war flew the same generic
// flag (a "French Commune" under a red flag with a yellow star). A side that
// carries a country's name ({country}: nameArg) flies that country's flag
// with its ideology's canton instead: it reads as that country, and differs
// from the government's plain flag (and from a side of another ideology).
import {
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import type { WwCountryView } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  IDEOLOGIES,
  type Ideology,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";

/** The engine's civil-war slot flag (WwEndgame.flagOf). */
const SLOT_FLAG = /^ww_cw_([a-z]+)$/;
const COUNTRY_NAME_PREFIX = "ww1936.country.";

/** What a country's flag is drawn from: a flag file, and the canton on it. */
export interface FlagSource {
  /** resources/flags/<file>.svg */
  file: string;
  /** The ideology canton of a civil-war side; null: the file as it is. */
  mark: Ideology | null;
}

/**
 * The flag of `tag` given its endgame view (undefined: none yet). A
 * civil-war slot named after a country (nameArg) flies that country's flag
 * with its ideology's canton; one that won and took the country's own name
 * (nameKey ww1936.country.<TAG>) flies that flag plain. Anything else: the
 * engine's flag, else the scenario's.
 */
export function flagSource(
  tag: CountryTag,
  c: Pick<WwCountryView, "flag" | "nameKey" | "nameArg"> | undefined,
): FlagSource {
  const slot = c?.flag ? SLOT_FLAG.exec(c.flag) : null;
  if (slot !== null && c !== undefined) {
    const ideology = (IDEOLOGIES as readonly string[]).includes(slot[1])
      ? (slot[1] as Ideology)
      : null;
    if (c.nameArg && COUNTRIES[c.nameArg] !== undefined) {
      return { file: COUNTRIES[c.nameArg].flag, mark: ideology };
    }
    const own = c.nameKey?.startsWith(COUNTRY_NAME_PREFIX)
      ? (c.nameKey.slice(COUNTRY_NAME_PREFIX.length) as CountryTag)
      : null;
    if (own !== null && COUNTRIES[own] !== undefined) {
      return { file: COUNTRIES[own].flag, mark: null };
    }
  }
  const engine = c?.flag ?? "";
  return { file: engine !== "" ? engine : COUNTRIES[tag].flag, mark: null };
}

// ---- The canton (drawn once per flag and ideology) ----

/** Draws the flag at `url` with `mark`'s canton; resolves to an image URL. */
export type FlagComposer = (url: string, mark: Ideology) => Promise<string>;

const W = 150;
const H = 100;
const CANTON: Record<Ideology, { fill: string; sign: string }> = {
  communist: { fill: "#b22222", sign: "#f2c94c" },
  fascist: { fill: "#1a1a1a", sign: "#ffffff" },
  democratic: { fill: "#1f4e9c", sign: "#ffffff" },
  neutral: { fill: "#5b3a8c", sign: "#f2c94c" },
};

/** The canton's sign: ★ communist, a slash fascist, ○ democratic, ◆ neutral. */
function drawCanton(ctx: CanvasRenderingContext2D, mark: Ideology): void {
  const cw = W * 0.42;
  const ch = H * 0.5;
  const { fill, sign } = CANTON[mark];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw + 3, ch + 3);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, cw, ch);
  const cx = cw / 2;
  const cy = ch / 2;
  const r = ch * 0.34;
  ctx.fillStyle = sign;
  ctx.strokeStyle = sign;
  ctx.beginPath();
  if (mark === "communist") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 === 0 ? r : r * 0.42;
      ctx.lineTo(cx + d * Math.cos(a), cy + d * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  } else if (mark === "fascist") {
    ctx.lineWidth = ch * 0.16;
    ctx.moveTo(cw * 0.18, ch * 0.85);
    ctx.lineTo(cw * 0.82, ch * 0.15);
    ctx.stroke();
  } else if (mark === "democratic") {
    ctx.lineWidth = ch * 0.1;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.75, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.75, cy);
    ctx.closePath();
    ctx.fill();
  }
}

const canvasComposer: FlagComposer = async (url, mark) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("no 2d canvas");
  ctx.drawImage(img, 0, 0, W, H);
  drawCanton(ctx, mark);
  return canvas.toDataURL("image/png");
};

let composer: FlagComposer = canvasComposer;
/** Drawn flags by "<file>|<mark>": the image URL, or null while drawing (or failed). */
const drawn = new Map<string, string | null>();
let version = 0;

/** Tests: draw the cantons with `c` (null: the canvas again); forgets every drawn flag. */
export function setFlagComposer(c: FlagComposer | null): void {
  composer = c ?? canvasComposer;
  drawn.clear();
  version++;
}

/** Bumps each time a drawn flag becomes ready (the map redraws its flags). */
export function drawnFlagsVersion(): number {
  return version;
}

/**
 * A flag source as an image URL. A plain file: its asset URL. A canton
 * flag: the drawn image once ready; until then (or if it can't be drawn)
 * the country's plain flag, so it never shows a slot's.
 */
export function flagSourceUrl(src: FlagSource): string {
  const plain = assetUrl(`flags/${src.file}.svg`);
  if (src.mark === null) return plain;
  const key = `${src.file}|${src.mark}`;
  const got = drawn.get(key);
  if (got !== undefined) return got ?? plain;
  drawn.set(key, null);
  composer(plain, src.mark).then(
    (url) => {
      if (!drawn.has(key)) return; // forgotten (a new composer) meanwhile
      drawn.set(key, url);
      version++;
    },
    () => {},
  );
  return plain;
}

/**
 * The running game's flags by tag (GameView sets it, as setLiveCountryNames;
 * null outside a 1936 game).
 */
let liveFlags: ((tag: CountryTag) => string | null) | null = null;

export function setLiveCountryFlags(
  flags: ((tag: CountryTag) => string | null) | null,
): void {
  liveFlags = flags;
}

/**
 * A country's flag URL on every screen, a tag at hand: its flag in the
 * running game (a civil-war side's country flag with its canton), else its
 * scenario flag.
 */
export function countryFlag(tag: CountryTag): string {
  return liveFlags?.(tag) ?? assetUrl(`flags/${COUNTRIES[tag].flag}.svg`);
}
