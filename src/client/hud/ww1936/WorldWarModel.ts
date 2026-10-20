import type { TileRef } from "@openfront/engine-api/game/GameMap";
import type { Winner } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  FACTION_IDS,
  FactionId,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dateOfDay,
  dayIndex,
  dayOfDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { HISTORY } from "@openfront/engine-lib/ww1936/History";
import {
  CampScore,
  campScores,
  CountryScoreInput,
  rankMembers,
} from "@openfront/engine-lib/ww1936/Score";
import { translateText } from "../../Utils";
import type { GameView, PlayerView } from "../../view";

/** Height of the top band in px; the hover card moves down by it. */
export const WW_BAND_PX = 32;
/** A second tap within this many ms confirms an irreversible action (§14d). */
export const TWO_TAP_MS = 3000;
/**
 * A confirming tap sooner than this after arming is ignored and the action
 * stays armed: a double-click or double-tap must not confirm before the
 * confirmation label can be read.
 */
export const TWO_TAP_MIN_MS = 350;
/** How many MVPs the win screen lists. */
export const WW_MVP_COUNT = 3;

/** What the World War 1936 screens read from the game (a fake in tests). */
export type WwGame = Pick<
  GameView,
  | "ticks"
  | "worldWarScenario"
  | "worldWarData"
  | "playerBySmallID"
  | "playerByClientID"
  | "myPlayer"
  | "ownerID"
  | "usernameOf"
  | "numLandTiles"
>;

export function countryName(tag: CountryTag): string {
  return translateText(`ww1936.country.${tag}`);
}

const FACTION_KEYS: Readonly<Record<FactionId, string>> = {
  axis: "ww1936.faction.axis",
  allies: "ww1936.faction.allies",
  comintern: "ww1936.faction.comintern",
};

export function factionName(id: FactionId): string {
  return translateText(FACTION_KEYS[id]);
}

/** "Germany · minsu" for a human's country; the country alone for a nation. */
export function countryLabel(game: WwGame, p: PlayerView): string {
  const tag = p.countryTag();
  const name = tag === null ? p.displayName() : countryName(tag);
  const clientID = p.clientID();
  const user = clientID === null ? null : game.usernameOf(clientID);
  return user === null ? name : `${name} · ${user}`;
}

/**
 * The name the hover card and the player panel show a player by: in this
 * mode its translated country (with the username for a human), as on the
 * leaderboard; otherwise its display name. PlayerInfo.name stays the
 * English country name for the map labels (plan decision 3).
 */
export function shownName(game: WwGame, p: PlayerView): string {
  return game.worldWarScenario() === null
    ? p.displayName()
    : countryLabel(game, p);
}

/**
 * Month names by month - 1. "m01".."m12": integer-like keys would be ordered
 * as numbers, not as the sorted strings tests/EnJsonSorted.test.ts expects.
 * Written out so tests/TranslationSystem.test.ts sees every key.
 */
const MONTH_KEYS = [
  "ww1936.month.m01",
  "ww1936.month.m02",
  "ww1936.month.m03",
  "ww1936.month.m04",
  "ww1936.month.m05",
  "ww1936.month.m06",
  "ww1936.month.m07",
  "ww1936.month.m08",
  "ww1936.month.m09",
  "ww1936.month.m10",
  "ww1936.month.m11",
  "ww1936.month.m12",
] as const;

export function dateLabel(day: number): string {
  const d = dateOfDay(day);
  return translateText("ww1936.date", {
    year: d.year,
    month: translateText(MONTH_KEYS[d.month - 1]),
    day: d.day,
  });
}

function prepEnd(game: WwGame): number {
  return game.worldWarData()?.prepEndTick ?? WW_PREP_TICKS;
}

export function today(game: WwGame): number {
  return dayIndex(game.ticks(), prepEnd(game));
}

/** Whole seconds of the preparation minute left; 0 once it is over. */
export function prepSecondsLeft(game: WwGame): number {
  return Math.max(0, Math.ceil((prepEnd(game) - game.ticks()) / 10));
}

/** smallIDs at war with `smallID`, in the order the wars began. */
export function enemiesOf(game: WwGame, smallID: number): number[] {
  return (game.worldWarData()?.wars ?? []).flatMap((w) =>
    w.a === smallID ? [w.b] : w.b === smallID ? [w.a] : [],
  );
}

export function isCapitulated(game: WwGame, smallID: number): boolean {
  return (game.worldWarData()?.capitulated ?? []).some(
    (c) => c.smallID === smallID,
  );
}

function asPlayer(game: WwGame, smallID: number): PlayerView | null {
  // GameView throws for a smallID whose first update has not arrived yet.
  let p: ReturnType<WwGame["playerBySmallID"]>;
  try {
    p = game.playerBySmallID(smallID);
  } catch {
    return null;
  }
  return p.isPlayer() ? (p as PlayerView) : null;
}

function factionOfPlayer(p: PlayerView | null): FactionId | null {
  const tag = p?.countryTag() ?? null;
  return tag === null ? null : COUNTRIES[tag].faction;
}

/** Same starting faction (decision 8: faction members are friends). */
export function sameFaction(
  a: PlayerView | null,
  b: PlayerView | null,
): boolean {
  const f = factionOfPlayer(a);
  return f !== null && a !== b && f === factionOfPlayer(b);
}

export interface BandModel {
  label: string;
  inPrep: boolean;
  myTag: CountryTag | null;
  myFaction: FactionId | null;
  wars: number;
}

export function bandModel(game: WwGame): BandModel {
  const left = prepSecondsLeft(game);
  const me = game.myPlayer();
  const myTag = me?.countryTag() ?? null;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return {
    label:
      left > 0
        ? translateText("ww1936.band.prep", {
            time: `${Math.floor(left / 60)}:${pad(left % 60)}`,
          })
        : dateLabel(today(game)),
    inPrep: left > 0,
    myTag,
    myFaction: myTag === null ? null : COUNTRIES[myTag].faction,
    wars: me === null ? 0 : enemiesOf(game, me.smallID()).length,
  };
}

/** Each country's numbers as the screens see them (engine: Victory.scoreInputs). */
export function viewScoreInputs(game: WwGame): CountryScoreInput[] {
  const s = game.worldWarScenario();
  if (s === null) return [];
  const vp = new Array<number>(s.countries.length + 1).fill(0);
  for (const r of s.landRegions) {
    const owner = game.ownerID(s.vpTile(r));
    if (owner > 0 && owner < vp.length) vp[owner] += r.vp;
  }
  return s.countries.map((tag, i) => {
    const id = i + 1;
    const p = asPlayer(game, id);
    return {
      smallID: id,
      faction: COUNTRIES[tag].faction,
      major: COUNTRIES[tag].major,
      alive: p !== null && p.isAlive() && !isCapitulated(game, id),
      vp: vp[id],
      tiles: p?.numTilesOwned() ?? 0,
    };
  });
}

export function viewCamps(game: WwGame): CampScore[] {
  const s = game.worldWarScenario();
  if (s === null) return [];
  return campScores(viewScoreInputs(game), s.totalVp(), game.numLandTiles());
}

export function campName(game: WwGame, camp: FactionId | number): string {
  if (typeof camp !== "number") return factionName(camp);
  const tag = game.worldWarScenario()?.tagOfSmallId(camp);
  return tag === undefined ? "" : countryName(tag);
}

export interface DiplomacyModel {
  factions: {
    id: FactionId;
    members: { tag: CountryTag; capitulated: boolean; alive: boolean }[];
  }[];
  myWars: CountryTag[];
  camps: { name: string; scoreBp: number; mine: boolean }[];
  /** The next date of the historical calendar (as written, not as rolled). */
  nextHistory: string | null;
}

export function diplomacyModel(game: WwGame): DiplomacyModel {
  const s = game.worldWarScenario();
  if (s === null)
    return { factions: [], myWars: [], camps: [], nextHistory: null };
  const me = game.myPlayer();
  const myID = me?.smallID() ?? 0;
  const myFaction = factionOfPlayer(me);
  const factions = FACTION_IDS.map((id) => ({
    id,
    members: s.countries
      .map((tag, i) => ({ tag, smallID: i + 1 }))
      .filter((m) => COUNTRIES[m.tag].faction === id)
      .map((m) => ({
        tag: m.tag,
        capitulated: isCapitulated(game, m.smallID),
        alive: asPlayer(game, m.smallID)?.isAlive() ?? false,
      })),
  })).filter((f) => f.members.length > 0);
  const day = today(game);
  const next = HISTORY.find(
    (e) =>
      dayOfDate(e.date) >= day &&
      s.smallIdOf(e.actor) !== 0 &&
      s.smallIdOf(e.target) !== 0,
  );
  return {
    factions,
    myWars: enemiesOf(game, myID).map((id) => s.tagOfSmallId(id)!),
    camps: viewCamps(game).map((c) => ({
      name: campName(game, c.camp),
      scoreBp: c.scoreBp,
      mine: c.camp === myFaction || c.camp === myID,
    })),
    nextHistory: next === undefined ? null : dateLabel(dayOfDate(next.date)),
  };
}

/**
 * Countries my declaration on `target` newly brings in besides the target
 * (spec §7.3): its living, uncapitulated faction members I am not at war
 * with yet. Matches Diplomacy.declareWar, which skips those.
 */
export function callIns(game: WwGame, target: PlayerView): number {
  const s = game.worldWarScenario();
  const faction = factionOfPlayer(target);
  if (s === null || faction === null) return 0;
  const myID = game.myPlayer()?.smallID() ?? 0;
  const atWar = new Set(enemiesOf(game, myID));
  let n = 0;
  s.countries.forEach((tag, i) => {
    const id = i + 1;
    if (id === target.smallID() || id === myID) return;
    if (COUNTRIES[tag].faction !== faction || atWar.has(id)) return;
    if (isCapitulated(game, id) || !(asPlayer(game, id)?.isAlive() ?? false))
      return;
    n++;
  });
  return n;
}

export interface RegionInfo {
  name: string;
  vp: number;
  /** The 1936 owner when someone else holds the tile now. */
  originalOwner: CountryTag | null;
}

export function regionInfo(
  game: WwGame,
  tile: TileRef,
  korean: boolean,
): RegionInfo | null {
  const s = game.worldWarScenario();
  if (s === null) return null;
  const r = s.region(s.regionAt(tile));
  if (r === undefined) return null;
  return {
    name: korean ? r.nameKo : r.name,
    vp: r.vp,
    originalOwner: s.smallIdOf(r.owner) === game.ownerID(tile) ? null : r.owner,
  };
}

/** Region and sea-zone names come from scenario.json in two languages (spec §11). */
export function isKoreanUi(): boolean {
  if (typeof document === "undefined") return false;
  const sel = document.querySelector("lang-selector") as {
    currentLang?: string;
  } | null;
  return (sel?.currentLang ?? "en").startsWith("ko");
}

/** Plan decision 13: a "…Tag" param also comes as its translated country name. */
export function translateCountryParams(
  params: Record<string, string | number>,
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...params };
  for (const [k, v] of Object.entries(params)) {
    if (!k.endsWith("Tag") || typeof v !== "string") continue;
    out[k.slice(0, -3)] = isCountryTag(v) ? countryName(v) : "";
  }
  return out;
}

/**
 * Spec §8.2: an irreversible action needs a second tap within TWO_TAP_MS,
 * but not sooner than TWO_TAP_MIN_MS.
 */
export class TwoTap {
  private key: string | null = null;
  private at = 0;

  /** True when this tap confirms. */
  tap(key: string, nowMs: number): boolean {
    if (this.isArmed(key, nowMs)) {
      // Too soon: still armed, from the first tap.
      if (nowMs - this.at < TWO_TAP_MIN_MS) return false;
      this.key = null;
      return true;
    }
    this.key = key;
    this.at = nowMs;
    return false;
  }

  isArmed(key: string, nowMs: number): boolean {
    return this.key === key && nowMs - this.at < TWO_TAP_MS;
  }
}

export interface WwWinView {
  title: string;
  isWin: boolean;
  /** The winning camp's best members, best first (spec §7.6). */
  mvp: string[];
}

export function wwWinView(
  game: WwGame,
  winner: NonNullable<Winner>,
): WwWinView {
  const s = game.worldWarScenario()!;
  const me = game.myPlayer();
  const inputs = viewScoreInputs(game);
  const total = s.totalVp();
  const land = game.numLandTiles();
  const labels = (members: number[]) =>
    rankMembers(inputs, members, total, land)
      .slice(0, WW_MVP_COUNT)
      .map((r) => asPlayer(game, r.smallID))
      .filter((p): p is PlayerView => p !== null)
      .map((p) => countryLabel(game, p));
  if (winner[0] === "team") {
    const faction = winner[1] as FactionId;
    const name = factionName(faction);
    const isWin = factionOfPlayer(me) === faction;
    const members = s.countries
      .map((tag, i) => (COUNTRIES[tag].faction === faction ? i + 1 : 0))
      .filter((id) => id !== 0);
    return {
      title: translateText(
        isWin ? "ww1936.win.your_faction" : "ww1936.win.faction_won",
        {
          faction: name,
        },
      ),
      isWin,
      mvp: labels(members),
    };
  }
  // An unaligned country won on its own.
  const p =
    winner[0] === "player"
      ? game.playerByClientID(winner[1])
      : asPlayer(
          game,
          s.countries.findIndex((t) => COUNTRIES[t].name === winner[1]) + 1,
        );
  const isWin = p !== null && p === me;
  return {
    title: isWin
      ? translateText("win_modal.you_won")
      : translateText("ww1936.win.country_won", {
          country: p === null ? winner[1] : countryLabel(game, p),
        }),
    isWin,
    mvp: [],
  };
}
