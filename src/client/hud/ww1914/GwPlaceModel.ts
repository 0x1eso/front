// Great War 1914: the map's plain logic (no DOM), so it can be tested: where a
// paper comes from, what pins the desk puts up, how a month's land plays back.
import {
  GW_LINES,
  GW_THEATRES,
  GwLandMove,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwFrontView } from "@openfront/engine-api/ww1914/GwWorldView";
import { frontPlaces } from "@openfront/engine-lib/ww1914/FrontLand";
import {
  frontPlace,
  GW_CAPITALS,
} from "@openfront/engine-lib/ww1914/PlaceRules";
import { briefText, cardTitle } from "./GwText";

/** Names a brief uses that aren't a place's own: what they point at. */
const CITY_WORDS: Readonly<Record<string, GwPlace>> = {
  빈에서: "vienna",
  빈의: "vienna",
  빈이: "vienna",
  빈은: "vienna",
  빈에: "vienna",
  빈으로: "vienna",
  "빈 주재": "vienna",
  에센: "rhineland",
  보훔: "rhineland",
  루르: "rhineland",
  빌헬름스하펜: "heligoland",
  유틀란트: "heligoland",
  "킬 군항": "hamburg",
  "킬 운하": "hamburg",
  크론시타트: "petrograd",
  페테르부르크: "petrograd",
  상트페테르부르크: "petrograd",
  벨파스트: "dublin",
  얼스터: "dublin",
  클라이드: "glasgow",
  솜강: "peronne",
  "솜 강": "peronne",
  마른강: "meaux",
  "마른 강": "meaux",
  이손초: "gorizia",
  카르파티아: "ungvar",
  콘스탄티노폴: "constantinople",
  이스탄불: "constantinople",
  살로니키: "salonika",
};

/** A country named in a brief: its capital, when nothing nearer is named. */
const COUNTRY_WORDS: Readonly<Record<string, GwTag>> = {
  독일: "DEU",
  오스트리아: "AUH",
  러시아: "RUS",
  프랑스: "FRA",
  영국: "GBR",
  이탈리아: "ITA",
  오스만: "OTT",
  튀르크: "OTT",
  미국: "USA",
  일본: "JPN",
  세르비아: "SRB",
  몬테네그로: "MNE",
  벨기에: "BEL",
  네덜란드: "NLD",
  스위스: "CHE",
  스웨덴: "SWE",
  스페인: "ESP",
  루마니아: "ROU",
  불가리아: "BGR",
  그리스: "GRC",
  알바니아: "ALB",
};

/** Words of a front: wherever its line stands. */
const FRONT_WORDS: Readonly<Record<string, GwTheatre>> = {
  서부전선: "west",
  "서부 전선": "west",
  동부전선: "east",
  "동부 전선": "east",
  발칸전선: "balkan",
  "발칸 전선": "balkan",
  이탈리아전선: "italy",
  "이탈리아 전선": "italy",
  캅카스전선: "caucasus",
  "캅카스 전선": "caucasus",
};

/** Names that are everyday words too: "리가 없다", "가자". One syllable is never safe. */
const NOT_NAMES: ReadonlySet<string> = new Set(["리가", "가자", "토고", "반"]);

/** What may follow a name and still leave it a name. */
const TAIL =
  "(?:에서는|에서|으로|에는|까지|부터|근처|방면|전선|요새|항구|공장|주재|대사|은|는|이|가|을|를|의|에|와|과|도|로|만|쪽|행|발)?";

function wordRegex(words: readonly string[]): RegExp {
  const longest = [...words].sort((a, b) => b.length - a.length);
  const any = longest.map((w) => w.replace(/ /g, "\\s")).join("|");
  return new RegExp(`(?<![가-힣])(${any})${TAIL}(?![가-힣])`, "gu");
}

const CITY_NAMES: ReadonlyMap<string, GwPlace> = new Map<string, GwPlace>([
  ...(Object.entries(GW_PLACES) as [GwPlace, { nameKo: string }][])
    .filter(([, p]) => p.nameKo.length >= 2 && !NOT_NAMES.has(p.nameKo))
    .map(([id, p]): [string, GwPlace] => [p.nameKo, id]),
  ...(Object.entries(CITY_WORDS) as [string, GwPlace][]),
]);
const CITY_RE = wordRegex([...CITY_NAMES.keys()]);
const COUNTRY_RE = wordRegex(Object.keys(COUNTRY_WORDS));
const FRONT_RE = wordRegex(Object.keys(FRONT_WORDS));

function wordsIn(re: RegExp, text: string): string[] {
  return [...text.matchAll(re)].map((m) => m[1].replace(/\s/g, " "));
}

export type GwLineOf = (t: GwTheatre) => number;

/**
 * The place a paper's words name, or null. A town comes before a front, and
 * `near` (the rules' answer, unless that's only the capital) before a country:
 * a country named in passing says less than a theatre or an office does. The
 * seat's own capital or country counts only if nothing else is named.
 */
export function placeInText(
  text: string,
  tag: GwTag,
  lineOf: GwLineOf,
  near: GwPlace | null = null,
): GwPlace | null {
  const home = GW_CAPITALS[tag] ?? null;
  const cities = wordsIn(CITY_RE, text).map((w) => CITY_NAMES.get(w)!);
  const away = cities.find((p) => p !== home);
  if (away !== undefined) return away;
  const front = wordsIn(FRONT_RE, text)[0];
  if (front !== undefined) {
    const t = FRONT_WORDS[front];
    return frontPlace(t, lineOf(t));
  }
  if (near !== null && near !== home) return near;
  for (const w of wordsIn(COUNTRY_RE, text)) {
    const there = COUNTRY_WORDS[w];
    if (there !== tag && GW_CAPITALS[there] !== undefined) {
      return GW_CAPITALS[there]!;
    }
  }
  return cities[0] ?? near;
}

function lineOfSeat(seat: GwSeatView): GwLineOf {
  return (t) => seat.theatres.find((x) => x.id === t)?.line ?? 0;
}

/** Where a paper comes from: named by hand, by its words, by rule. */
export function placeOfCard(
  card: GwCardView,
  pack: GwPack | null,
  seat: GwSeatView,
  date: string,
): GwPlace | null {
  if (card.place !== undefined) return card.place;
  const from =
    card.letterFrom === undefined ? null : GW_CAPITALS[card.letterFrom];
  if (from !== null && from !== undefined) return from;
  const brief = briefText(pack, card, seat, date) ?? "";
  const words = `${cardTitle(pack, card)} ${brief}`;
  return placeInText(words, seat.tag, lineOfSeat(seat), card.near ?? null);
}

export interface GwPin {
  place: GwPlace;
  cards: GwCardView[];
  /** Something on it waits for the seat's word. */
  waits: boolean;
}

/** The desk on the map: a pin for each place with papers on it. */
export function deskPins(
  seat: GwSeatView,
  pack: GwPack | null,
  date: string,
): GwPin[] {
  const out = new Map<GwPlace, GwPin>();
  for (const card of seat.desk) {
    if (card.silent === true || card.past !== undefined) continue;
    const place = placeOfCard(card, pack, seat, date);
    if (place === null) continue;
    const pin = out.get(place) ?? { place, cards: [], waits: false };
    pin.cards.push(card);
    pin.waits ||= card.options.length > 0 || card.kind === "talk";
    out.set(place, pin);
  }
  return [...out.values()];
}

const THEATRE_OF: ReadonlyMap<GwPlace, GwTheatre> = new Map(
  GW_THEATRES.flatMap((t) =>
    frontPlaces(t).map((p): [GwPlace, GwTheatre] => [p, t]),
  ),
);

/** The front a place belongs to, if any. */
export function theatreOfPlace(place: GwPlace | null): GwTheatre | null {
  return place === null ? null : (THEATRE_OF.get(place) ?? null);
}

/** One front of a month's replay. */
export interface GwReplayBeat {
  theatre: GwTheatre | null;
  /** The named line it left and the one it stands on; null if it didn't move. */
  line: { from: number; to: number } | null;
  moves: GwLandMove[];
  /** Where the camera looks, and how near. */
  x: number;
  y: number;
  zoom: number;
}

/** Scale that fits a spread of tiles on a screen this many pixels across. */
function zoomFor(spread: number, screen: number): number {
  return Math.max(2.2, Math.min(6, (screen * 0.55) / Math.max(1, spread)));
}

/**
 * What the month did to the map, front by front: the ones that took land
 * first, the most land first. A line that moved without land is one beat too.
 */
export function replayBeats(
  moves: readonly GwLandMove[],
  before: readonly GwFrontView[],
  after: readonly GwFrontView[],
  screen: number,
): GwReplayBeat[] {
  const beats: GwReplayBeat[] = [];
  const ids = new Set<GwTheatre | null>(moves.map((m) => m.theatre));
  for (const f of after) {
    const was = before.find((x) => x.id === f.id);
    if (was !== undefined && was.lineIndex !== f.lineIndex) ids.add(f.id);
  }
  for (const theatre of ids) {
    const own = moves.filter((m) => m.theatre === theatre);
    const f = after.find((x) => x.id === theatre);
    const was = before.find((x) => x.id === theatre);
    const line =
      f !== undefined && was !== undefined && was.lineIndex !== f.lineIndex
        ? { from: was.lineIndex, to: f.lineIndex }
        : null;
    const spots = own.map((m) => GW_PLACES[m.place].center);
    if (spots.length === 0 && theatre !== null && line !== null) {
      spots.push(GW_PLACES[frontPlace(theatre, line.to)].center);
    }
    if (spots.length === 0) continue;
    const xs = spots.map((p) => p[0]);
    const ys = spots.map((p) => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    beats.push({
      theatre,
      line,
      moves: own,
      x: Math.round((x0 + x1) / 2),
      y: Math.round((y0 + y1) / 2),
      zoom: zoomFor(Math.max(x1 - x0, y1 - y0, 12), screen),
    });
  }
  return beats.sort((a, b) => b.moves.length - a.moves.length);
}

const PAN_MS = 900;
const HOLD_MS = 700;
const QUIET_BEAT_MS = 1300;
/** A month plays in a few seconds, however much fell. */
const MOVES_MS = 2400;
const MOVE_MAX_MS = 700;
const BEATS_SHOWN = 3;

/** When each beat and each of its moves starts, ms from the start. */
export interface GwReplayClock {
  beats: { at: number; moves: number[] }[];
  end: number;
}

export function replayClock(beats: readonly GwReplayBeat[]): GwReplayClock {
  let t = 0;
  const out: GwReplayClock["beats"] = [];
  for (const b of beats.slice(0, BEATS_SHOWN)) {
    const at = t;
    t += PAN_MS;
    if (b.moves.length === 0) {
      t += QUIET_BEAT_MS;
      out.push({ at, moves: [] });
      continue;
    }
    const each = Math.min(MOVE_MAX_MS, MOVES_MS / b.moves.length);
    const moves = b.moves.map((_, i) => Math.round(t + i * each));
    t += b.moves.length * each + HOLD_MS;
    out.push({ at, moves });
  }
  return { beats: out, end: Math.round(t) };
}

/** The line names a front moved between, for the caption. */
export function replayLineNames(
  t: GwTheatre,
  line: { from: number; to: number },
): [string, string] {
  return [GW_LINES[t][line.from], GW_LINES[t][line.to]];
}

/** "1914-09-01" as the month that closed: its year and month. */
export function monthOf(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}
