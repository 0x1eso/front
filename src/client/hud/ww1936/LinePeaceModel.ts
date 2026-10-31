// World War 1936: peace on the current line on the screens (현 점령선 평화,
// owner request 2026-10-31). The drawer's war row gets [현 점령선 평화]
// next to [평화 제안]: a preview under the row — what changes hands each
// way (the engine's daily row, settled by the same rules the peace uses),
// the totals, the chance the other side's AI leader takes it (the same
// judge), [지도에서 보기] (the panel steps aside; PeaceMapPass draws each
// region in its new owner's colour) and a two-tap [보내기]. The target's
// card shows the same summary and map.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type {
  WwLinePeaceSplit,
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  negPeaceHint,
  type NegPeaceHint,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import {
  PEACE_MINE,
  PEACE_SELECTED,
  type PeaceMapRegion,
  type PeaceMapSource,
} from "../../render/gl/passes/PeaceMapPass";
import { translateText } from "../../Utils";
import { countryText } from "./EndgameNames";
import { type NegPeaceGame, wwPeaceMapSource } from "./NegPeaceModel";
import { peaceColor, peaceRegionName } from "./PeaceModel";
import type { WhitePeaceGame } from "./WhitePeaceModel";

/** Region names a list shows before "and N more". */
export const LINE_NAMES_SHOWN = 6;

// ---- The client state: the open preview and the map (one per game) ----

export class LinePeaceUi {
  /** The war whose preview is open (0: none) and its target. */
  war = 0;
  target = 0;
  /** The map shows a line: my preview's (offer 0) or a card's offer (its id). */
  map = false;
  offer = 0;
  /** The region tapped last on the map (0: none). */
  region = 0;
  /** Bumped on every change (the preview, the band and the map redraw on it). */
  version = 0;

  open(war: number, target: number): void {
    if (war !== this.war || target !== this.target) this.closeMap();
    this.war = war;
    this.target = target;
    this.version++;
  }

  /** Closes the preview (and its map). */
  close(): void {
    if (this.map && this.offer === 0) this.closeMap();
    this.war = 0;
    this.target = 0;
    this.version++;
  }

  /** The map of my preview (`offer` 0) or of the offer `offer` made to me. */
  openMap(offer = 0): void {
    if (offer === 0 && this.war === 0) return;
    this.map = true;
    this.offer = offer;
    this.region = 0;
    this.version++;
  }

  closeMap(): void {
    if (!this.map) return;
    this.map = false;
    this.offer = 0;
    this.region = 0;
    this.version++;
  }
}

const uis = new WeakMap<object, LinePeaceUi>();
/** One line peace client state per game view. */
export function linePeaceUiOf(game: object): LinePeaceUi {
  let u = uis.get(game);
  if (u === undefined) uis.set(game, (u = new LinePeaceUi()));
  return u;
}

// ---- Texts ----

/** "Germany, Krakow, … and 3 more" ("" for none). */
function namesLine(game: WhitePeaceGame, regions: readonly number[]): string {
  const sc = game.worldWarScenario();
  if (sc === null || regions.length === 0) return "";
  const shown = regions
    .slice(0, LINE_NAMES_SHOWN)
    .map((r) => peaceRegionName(sc, r))
    .join(", ");
  return regions.length > LINE_NAMES_SHOWN
    ? translateText("ww1936.lpeace.more", {
        names: shown,
        n: regions.length - LINE_NAMES_SHOWN,
      })
    : shown;
}

/** A line's summary from one side: the totals, what it gets, what it gives up. */
export interface LinePeaceSummary {
  /** "We gain 3 regions (5 VP) / lose 1 region (2 VP)". */
  totals: string;
  /** "We gain: Krakow, Lyon" ("" for none). */
  gain: string;
  /** "We lose: Munich" ("" for none). */
  lose: string;
  /** "No region changes hands: the same as a white peace" (null: some do). */
  empty: string | null;
}

/** `s` read by the side that gets `s.gain` (mine: the preview's; flipped: the target's card). */
export function lineSummary(
  game: WhitePeaceGame,
  s: WwLinePeaceSplit,
): LinePeaceSummary {
  const gain = namesLine(game, s.gain);
  const lose = namesLine(game, s.lose);
  return {
    totals: translateText("ww1936.lpeace.totals", {
      n: s.gain.length,
      vp: s.gainVp,
      m: s.lose.length,
      lvp: s.loseVp,
    }),
    gain:
      gain === "" ? "" : translateText("ww1936.lpeace.gain", { regions: gain }),
    lose:
      lose === "" ? "" : translateText("ww1936.lpeace.lose", { regions: lose }),
    empty:
      s.gain.length + s.lose.length === 0
        ? translateText("ww1936.lpeace.empty")
        : null,
  };
}

/** The proposer's split seen by the other side. */
export function flipSplit(s: WwLinePeaceSplit): WwLinePeaceSplit {
  return { gain: s.lose, lose: s.gain, gainVp: s.loseVp, loseVp: s.gainVp };
}

// ---- The preview ----

export interface LinePeacePreviewView extends LinePeaceSummary {
  war: number;
  target: number;
  /** "Peace on the current line with Poland". */
  title: string;
  /** What the peace does (each side keeps what it holds; capitals go back). */
  rules: string;
  /** False until the engine's row arrives (no totals yet). */
  ready: boolean;
  /** "Chance they accept: high" — or "A human player decides" ("" without a row). */
  hint: string;
  /** The level (null: a human target, or no row yet). */
  hintLevel: NegPeaceHint | null;
  order: WwOrder;
}

/** A country a human controls now (the endgame's controllers). */
function isHuman(game: WhitePeaceGame, id: number): boolean {
  return game.wwEndgame?.()?.controllers.some(([, x]) => x === id) ?? false;
}

/** The preview of my war `w` (null: no preview open for it). */
export function linePeacePreview(
  game: WhitePeaceGame,
  me: number,
  w: WwWarSummary,
): LinePeacePreviewView | null {
  const ui = linePeaceUiOf(game);
  if (ui.war !== w.id || me <= 0) return null;
  const target = ui.target;
  const row = game.wwEndgame?.()?.lineFor(me, w.id) ?? null;
  const ready = row !== null && row.to === target;
  const split: WwLinePeaceSplit = ready
    ? row
    : { gain: [], lose: [], gainVp: 0, loseVp: 0 };
  const sum = lineSummary(game, split);
  let hint = "";
  let hintLevel: NegPeaceHint | null = null;
  if (isHuman(game, target)) {
    hint = translateText("ww1936.npeace.chance_human");
  } else if (ready) {
    hintLevel = negPeaceHint(row.chance);
    hint = translateText("ww1936.npeace.chance", {
      level: translateText(`ww1936.npeace.chance_${hintLevel}`),
    });
  }
  return {
    war: w.id,
    target,
    title: translateText("ww1936.lpeace.title", {
      country: countryText(game, target),
    }),
    rules: translateText("ww1936.lpeace.rules"),
    ready,
    ...sum,
    totals: ready ? sum.totals : "",
    empty: ready ? sum.empty : null,
    hint,
    hintLevel,
    order: { kind: "line_peace_offer", war: w.id, target },
  };
}

// ---- The target's card ----

/** The line of an offer made to me, as my card reads it (null: another kind of offer). */
export function lineCardSummary(
  game: WhitePeaceGame,
  o: WwPeaceOfferView,
): LinePeaceSummary | null {
  if (o.line === undefined) return null;
  return lineSummary(game, flipSplit(o.line));
}

// ---- The map ----

/** The line the map shows now, from my side: what I get, what they get, and who they are. */
function mapLine(
  game: WhitePeaceGame,
): { split: WwLinePeaceSplit; me: number; them: number } | null {
  const ui = linePeaceUiOf(game);
  const me = game.myPlayer()?.smallID() ?? 0;
  const eg = game.wwEndgame?.() ?? null;
  if (!ui.map || me <= 0 || eg === null) return null;
  if (ui.offer > 0) {
    const o = eg.peaceOffers.find((x) => x.id === ui.offer) ?? null;
    if (o === null || o.line === undefined) return null;
    return { split: flipSplit(o.line), me: o.to, them: o.from };
  }
  const row = eg.lineFor(me, ui.war);
  if (row === null || row.to !== ui.target) return null;
  return { split: row, me, them: ui.target };
}

/** The map's regions: those I get in my colour, those they get in theirs; the tapped one outlined. */
export function linePeaceMapRegions(game: NegPeaceGame): PeaceMapRegion[] {
  const sc = game.worldWarScenario();
  const line = mapLine(game);
  if (sc === null || line === null) return [];
  const ui = linePeaceUiOf(game);
  const w = sc.width;
  const out: PeaceMapRegion[] = [];
  for (const [regions, owner] of [
    [line.split.gain, line.me],
    [line.split.lose, line.them],
  ] as const) {
    const rgb = peaceColor(game, owner);
    for (const r of regions) {
      const t = sc.centerTile(r);
      out.push({
        region: r,
        state: PEACE_MINE | (r === ui.region ? PEACE_SELECTED : 0),
        rgb,
        value: sc.region(r)?.vp ?? 0,
        x: t % w,
        y: Math.floor(t / w),
      });
    }
  }
  return out;
}

/**
 * The land tap flow asks this (WwLandController): while the map shows a
 * line, a tap names the region under it (and which way it goes) and
 * nothing else happens. False when the map is off.
 */
export function linePeaceMapTap(game: WhitePeaceGame, region: number): boolean {
  const ui = linePeaceUiOf(game);
  if (!ui.map) return false;
  ui.region = Math.max(0, region);
  ui.version++;
  return true;
}

/** The band of the map: what the colours mean, the tapped region and which way it goes. */
export function linePeaceBand(
  game: WhitePeaceGame,
): { line: string; region: string } | null {
  const ui = linePeaceUiOf(game);
  const sc = game.worldWarScenario();
  const line = mapLine(game);
  if (!ui.map || sc === null || line === null) return null;
  let region = "";
  if (ui.region > 0) {
    const name = peaceRegionName(sc, ui.region);
    const way = line.split.gain.includes(ui.region)
      ? "region_gain"
      : line.split.lose.includes(ui.region)
        ? "region_lose"
        : "region_none";
    region = translateText(`ww1936.lpeace.${way}`, { region: name });
  }
  return {
    line: translateText("ww1936.lpeace.band", {
      n: line.split.gain.length,
      m: line.split.lose.length,
    }),
    region,
  };
}

/**
 * What PeaceMapPass reads: a line while its map is on, else the
 * negotiated peace's pick mode or the conference's map mode
 * (NegPeaceModel.wwPeaceMapSource).
 */
export function linePeaceMapSource(game: NegPeaceGame): PeaceMapSource {
  const other = wwPeaceMapSource(game);
  let rows: unknown = null;
  let offers: unknown = null;
  let data = 0;
  let seen = "";
  let key = "";
  return {
    key: () => {
      const ui = linePeaceUiOf(game);
      if (!ui.map) return other.key();
      const eg = game.wwEndgame?.() ?? null;
      // The engine swaps its lists on an update, never edits them.
      if (eg !== null && (eg.linePeace !== rows || eg.peaceOffers !== offers)) {
        rows = eg.linePeace;
        offers = eg.peaceOffers;
        data++;
      }
      const k = [ui.version, data, game.myPlayer()?.smallID() ?? 0].join(":");
      if (k !== seen) {
        seen = k;
        key = `line:${k}`;
      }
      return key;
    },
    regions: () =>
      linePeaceUiOf(game).map ? linePeaceMapRegions(game) : other.regions(),
  };
}
