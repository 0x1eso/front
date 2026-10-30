import type { TileRef } from "@openfront/engine-api/game/GameMap";
import type { Winner } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  FACTION_IDS,
  FactionId,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  factionIdxOfKey,
  FactionKey,
  factionKeyOf,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  DeclareWarBlock,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Config } from "@openfront/engine-lib/configuration/Config";
import { dateOfDay, dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
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

/**
 * What the World War 1936 screens read from the game (a fake in tests).
 * P3's politics view is optional: without it (or before its first update)
 * the factions are P0's starting ones.
 */
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
> &
  Partial<Pick<GameView, "wwPolitics" | "wwEndgame">>;

/**
 * What a countdown reads for the game's pace: the config's tick length
 * (msPerTick) and its GameConfig. A screen's fake may carry no config, or
 * only part of one: a tick is then the usual 100 ms.
 */
export interface WwPaceGame {
  config?: () => Partial<Config>;
}

/**
 * `ticks` as whole seconds, rounded up, at the game's tick length
 * (Config.msPerTick: 400 ms in the unlimited game, else 100). At 100 ms
 * exactly Math.ceil(ticks / 10).
 */
export function wwSeconds(game: WwPaceGame, ticks: number): number {
  const msPerTick = game.config?.().msPerTick?.() ?? 100;
  return Math.ceil((ticks * msPerTick) / 1000);
}

/**
 * A human window the engine writes in 100 ms ticks (WW_PREP_TICKS,
 * WW_PEACE_ROUND_TICKS…), in this game's ticks: wwRealTicks, a quarter of
 * them in the unlimited game, so it keeps its real seconds.
 */
export function wwWindowTicks(game: WwPaceGame, ticks: number): number {
  const gc = game.config?.().gameConfig?.();
  return gc === undefined ? ticks : wwRealTicks(gc, ticks);
}

export function countryName(tag: CountryTag): string {
  return translateText(`ww1936.country.${tag}`);
}

const FACTION_KEYS: Readonly<Record<FactionId, string>> = {
  axis: "ww1936.faction.axis",
  allies: "ww1936.faction.allies",
  comintern: "ww1936.faction.comintern",
};

/**
 * A faction's name: P0's key for the starting three; a faction made in the
 * game (P3 f3, f4…) by its name id (ww1936.faction_name.<name>, "auto":
 * named after its creator).
 */
/**
 * Why a declaration is refused (engine Diplomacy.declareWarBlock; P3 spec
 * §14.5 added nap … isolation). Task 8 shows it under the declare button.
 */
export const DECLARE_BLOCK_KEYS: Readonly<Record<DeclareWarBlock, string>> = {
  prep: "ww1936.declare.block.prep",
  self: "ww1936.declare.block.self",
  dead: "ww1936.declare.block.dead",
  capitulated: "ww1936.declare.block.capitulated",
  faction: "ww1936.declare.block.faction",
  at_war: "ww1936.declare.block.at_war",
  nap: "ww1936.declare.block.nap",
  guarantor: "ww1936.declare.block.guarantor",
  democracy_no_goal: "ww1936.declare.block.democracy_no_goal",
  isolation: "ww1936.declare.block.isolation",
  // P5 (spec §9.1, §10).
  subject_restricted: "ww1936.declare.block.subject_restricted",
  exile: "ww1936.declare.block.exile",
  // P6 (spec §13.1).
  congress: "ww1936.declare.block.congress",
  // White peace: a one-year truce.
  truce_active: "ww1936.declare.block.truce_active",
};

export function factionName(id: FactionKey, game?: WwGame): string {
  if (id in FACTION_KEYS) return translateText(FACTION_KEYS[id as FactionId]);
  const idx = factionIdxOfKey(id);
  const f = game?.wwPolitics?.()?.global?.factions.find((x) => x.idx === idx);
  if (f === undefined) return "";
  // "auto" (ww1936.faction_name.auto) names it after its creator.
  return translateText(`ww1936.faction_name.${f.name}`, {
    country: isCountryTag(f.nameTag) ? countryName(f.nameTag) : "",
  });
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

/**
 * The tick the preparation minute ends: the engine's, or before its data
 * arrives where the engine puts it (wwRealTicks of WW_PREP_TICKS).
 */
export function prepEndTick(
  game: Pick<WwGame, "worldWarData"> & WwPaceGame,
): number {
  return game.worldWarData()?.prepEndTick ?? wwWindowTicks(game, WW_PREP_TICKS);
}

export function today(game: WwGame & WwPaceGame): number {
  return dayIndex(game.ticks(), prepEndTick(game));
}

/** Whole seconds of the preparation minute left; 0 once it is over. */
export function prepSecondsLeft(game: WwGame & WwPaceGame): number {
  return Math.max(0, wwSeconds(game, prepEndTick(game) - game.ticks()));
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

/**
 * P5 pre-flight §0-1: the country still plays — alive and not capitulated,
 * or a government in exile (which has no land but fights on). The screens'
 * "is it out of the game" question; the engine's is WorldWar.isActor.
 */
export function wwActive(game: WwGame, smallID: number): boolean {
  const eg = game.wwEndgame?.() ?? null;
  if (eg?.isExile(smallID) === true) return true;
  // The endgame's state (a dormant slot, a gone country) as the engine's
  // isActor reads it.
  const state = eg?.countryState(smallID) ?? null;
  if (state !== null && state !== "active") return false;
  const p = asPlayer(game, smallID);
  return p !== null && p.isAlive() && !isCapitulated(game, smallID);
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

/**
 * A country's faction now (P3 plan decision 8: politics' state); before the
 * first politics update, its starting faction.
 */
export function factionOfId(game: WwGame, smallID: number): FactionKey | null {
  const s = game.wwPolitics?.()?.summary(smallID) ?? null;
  if (s !== null) return s.faction < 0 ? null : factionKeyOf(s.faction);
  const tag = game.worldWarScenario()?.tagOfSmallId(smallID);
  return tag === undefined ? null : COUNTRIES[tag].faction;
}

function factionOfPlayer(
  game: WwGame,
  p: PlayerView | null,
): FactionKey | null {
  return p === null ? null : factionOfId(game, p.smallID());
}

/**
 * Same faction (decision 8: faction members are friends). Without a game:
 * the starting factions.
 */
export function sameFaction(
  a: PlayerView | null,
  b: PlayerView | null,
  game?: WwGame,
): boolean {
  if (a === null || b === null || a === b) return false;
  const of = (p: PlayerView): FactionKey | null => {
    if (game !== undefined) return factionOfPlayer(game, p);
    const tag = p.countryTag();
    return tag === null ? null : COUNTRIES[tag].faction;
  };
  const f = of(a);
  return f !== null && f === of(b);
}

export interface BandModel {
  label: string;
  inPrep: boolean;
  myTag: CountryTag | null;
  myFaction: FactionKey | null;
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
    myFaction: me === null ? null : factionOfPlayer(game, me),
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
  const eg = game.wwEndgame?.() ?? null;
  // P5 (spec §16.1): no dormant slot is a line; a subject without a
  // faction of its own counts in its overlord's.
  return s.countries.flatMap((tag, i) => {
    const id = i + 1;
    const dormant =
      eg !== null && eg.countries.has(id)
        ? eg.isDormant(id)
        : s.isDormantSlot(id);
    if (dormant) return [];
    const p = asPlayer(game, id);
    const own = factionOfId(game, id);
    const overlord = eg?.subjectOf(id)?.overlord ?? 0;
    return [
      {
        smallID: id,
        faction: own ?? (overlord > 0 ? factionOfId(game, overlord) : null),
        major: COUNTRIES[tag].major,
        alive: wwActive(game, id),
        vp: vp[id],
        tiles: p?.numTilesOwned() ?? 0,
      },
    ];
  });
}

export function viewCamps(game: WwGame): CampScore[] {
  const s = game.worldWarScenario();
  if (s === null) return [];
  return campScores(viewScoreInputs(game), s.totalVp(), game.numLandTiles());
}

export function campName(game: WwGame, camp: FactionKey | number): string {
  if (typeof camp !== "number") return factionName(camp, game);
  const tag = game.worldWarScenario()?.tagOfSmallId(camp);
  return tag === undefined ? "" : countryName(tag);
}

export interface DiplomacyModel {
  factions: {
    id: FactionKey;
    /** The faction leader's smallID; 0 when unknown (before politics' first update). */
    leader: number;
    members: {
      tag: CountryTag;
      smallID: number;
      capitulated: boolean;
      alive: boolean;
    }[];
  }[];
  myWars: CountryTag[];
  camps: { name: string; scoreBp: number; mine: boolean }[];
  /**
   * The next day a history beat fires (P3 spec §18.2: politics' rolled
   * day, WwPolGlobal.nextBeatDay); null with none left or no data yet.
   */
  nextHistory: string | null;
}

/**
 * The factions as they are now (P3 plan decision 8: politics' state, in
 * faction order); before politics' first update, the starting three.
 */
export function liveFactions(
  game: WwGame,
): { id: FactionKey; leader: number; members: number[] }[] {
  const s = game.worldWarScenario();
  if (s === null) return [];
  const global = game.wwPolitics?.()?.global ?? null;
  if (global !== null) {
    return [...global.factions]
      .sort((a, b) => a.idx - b.idx)
      .map((f) => ({ id: f.key, leader: f.leader, members: [...f.members] }));
  }
  return FACTION_IDS.map((id) => ({
    id,
    leader: 0,
    members: s.countries
      .map((tag, i) => (COUNTRIES[tag].faction === id ? i + 1 : 0))
      .filter((x) => x !== 0),
  }));
}

export function diplomacyModel(game: WwGame): DiplomacyModel {
  const s = game.worldWarScenario();
  if (s === null)
    return { factions: [], myWars: [], camps: [], nextHistory: null };
  const me = game.myPlayer();
  const myID = me?.smallID() ?? 0;
  const myFaction = factionOfPlayer(game, me);
  const factions = liveFactions(game)
    .map((f) => ({
      id: f.id,
      leader: f.leader,
      members: f.members
        .filter((id) => s.tagOfSmallId(id) !== undefined)
        .map((id) => ({
          tag: s.tagOfSmallId(id)!,
          smallID: id,
          capitulated: isCapitulated(game, id) && !wwActive(game, id),
          alive: wwActive(game, id),
        })),
    }))
    .filter((f) => f.members.length > 0);
  const next = game.wwPolitics?.()?.global?.nextBeatDay ?? -1;
  return {
    factions,
    myWars: enemiesOf(game, myID).map((id) => s.tagOfSmallId(id)!),
    camps: viewCamps(game).map((c) => ({
      name: campName(game, c.camp),
      scoreBp: c.scoreBp,
      mine: c.camp === myFaction || c.camp === myID,
    })),
    nextHistory: next < 0 ? null : dateLabel(next),
  };
}

/**
 * Countries my declaration on `target` newly brings in besides the target
 * (spec §7.3): its living, uncapitulated faction members I am not at war
 * with yet. Matches Diplomacy.declareWar, which skips those.
 */
export function callIns(game: WwGame, target: PlayerView): number {
  const s = game.worldWarScenario();
  const faction = factionOfPlayer(game, target);
  if (s === null || faction === null) return 0;
  const myID = game.myPlayer()?.smallID() ?? 0;
  const atWar = new Set(enemiesOf(game, myID));
  let n = 0;
  s.countries.forEach((tag, i) => {
    const id = i + 1;
    if (id === target.smallID() || id === myID) return;
    if (factionOfId(game, id) !== faction || atWar.has(id)) return;
    // P5 pre-flight §0-1: an exile of the faction is drawn in too.
    if (!wwActive(game, id)) return;
    n++;
  });
  return n;
}

export interface RegionInfo {
  name: string;
  vp: number;
  /**
   * The legal owner (P3 spec §17.1: politics' legalOwner, the 1936 owner
   * until a peaceful transfer or a capitulation) when someone else holds
   * the tile now.
   */
  legalOwner: CountryTag | null;
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
  const legal = game.wwPolitics?.()?.legalOwner[r.id] ?? s.smallIdOf(r.owner);
  const legalTag = s.tagOfSmallId(legal) ?? null;
  return {
    name: korean ? r.nameKo : r.name,
    vp: r.vp,
    legalOwner: legal === game.ownerID(tile) ? null : legalTag,
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
    const faction = winner[1] as FactionKey;
    const name = factionName(faction, game);
    const isWin = factionOfPlayer(game, me) === faction;
    const members = s.countries
      .map((_, i) => (factionOfId(game, i + 1) === faction ? i + 1 : 0))
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
