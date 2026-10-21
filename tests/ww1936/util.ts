import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ErrorUpdate,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import {
  GameConfig,
  GameStartInfo,
  Intent,
  StampedIntent,
  WwOrder,
} from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { removeLine } from "@openfront/engine/ww1936/economy/Production";
import { cancelResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import { fieldDivision } from "@openfront/engine/ww1936/land/LandStartRun";
import { capture } from "@openfront/engine/ww1936/land/Occupation";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { politicsFixture } from "./politicsFixture";

export const MINI = "ww1936mini";
/** P3 (plan decision 22): ww1936mini plus AUT, CSK, LTU, EST on nine islands. */
export const POL = "ww1936pol";
/** P4 (plan decision 29): ww1936mini with four sea zones, the Isthmus (TUR) and Malta (seaFixture.ts). */
export const SEA_MAP = "ww1936sea";
/** P5 (plan decision 31): ww1936pol plus Kosice (20, Czechoslovakia) east of Slovakia (endFixture.ts). */
export const END_MAP = "ww1936end";
/** P6 (plan Task 1 Step 19): ww1936sea plus the scenario v5 fields (deepFixture.ts). */
export const DEEP_MAP = "ww1936deep";
export const HUMAN = "HUMAN001";

export interface WwHuman {
  clientID: string;
  country?: CountryTag;
}

export function wwGameStart(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
): GameStartInfo {
  return {
    gameID: "WWTEST01",
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Private,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: true,
      donateTroops: true,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      worldWar1936: true,
      ...config,
    },
    players: humans.map((h, i) => ({
      clientID: h.clientID,
      username: `player${i}`,
      clanTag: null,
      isLobbyCreator: i === 0,
      ...(h.country === undefined ? {} : { country: h.country }),
    })),
  };
}

/** A runner on the test map; `updates` collects every tick's view data. */
export async function wwRunnerCapture(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
  map: string = MINI,
  gameID?: string,
): Promise<{ runner: GameRunner; updates: GameUpdateViewData[] }> {
  const start = wwGameStart(config, humans);
  // P3: the game id seeds politics' roll (plan decision 2).
  if (gameID !== undefined) start.gameID = gameID;
  const updates: GameUpdateViewData[] = [];
  const runner = await createGameRunner(
    start,
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(map),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (gu: GameUpdateViewData | ErrorUpdate) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
      updates.push(gu);
    },
  );
  return { runner, updates };
}

export async function wwRunner(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
  map:
    | "ww1936mini"
    | "ww1936pol"
    | "ww1936sea"
    | "ww1936end"
    | "ww1936deep"
    | string = MINI,
): Promise<GameRunner> {
  return (await wwRunnerCapture(config, humans, map)).runner;
}

/** Runs n ticks; the intents go into the first one. */
export function step(
  runner: GameRunner,
  n = 1,
  intents: StampedIntent[] = [],
): void {
  for (let i = 0; i < n; i++) {
    runner.addTurn({
      turnNumber: runner.game.ticks(),
      intents: i === 0 ? intents : [],
    });
    if (!runner.executeNextTick()) {
      throw new Error(`tick ${runner.game.ticks()} did not run`);
    }
  }
}

/** Runs until game.ticks() reaches `tick`. */
export function stepTo(runner: GameRunner, tick: number): void {
  while (runner.game.ticks() < tick) step(runner);
}

export function stamped(clientID: string, intent: Intent): StampedIntent {
  return { ...intent, clientID } as StampedIntent;
}

export function byTag(game: Game, tag: CountryTag): Player {
  const p = game.worldWar()?.playerOfTag(tag) ?? null;
  if (p === null) throw new Error(`no ${tag} in this game`);
  return p;
}

/**
 * Takes back a country's starting lines and research (WwEconomy.start
 * gives every country the AI's day-0 lines and slots) with the orders a
 * player would give, for a test that measures lines or slots from none.
 */
export function clearStartSetup(econ: WwEconomy, ce: CountryEconomy): void {
  for (const l of [...ce.lines]) removeLine(econ, ce, l.id);
  ce.slots.forEach((s, i) => {
    if (s !== null) cancelResearch(econ, ce, i);
  });
}

// ---- P2: the land war (plan Task 1 Step 20; every lane uses these) ----

/** The land war of a World War game. */
export function land(game: Game): WwLand {
  return game.worldWar()!.land;
}

/** Hands a region to `tag` now, the way a won battle does (Occupation.capture). */
export function takeRegion(game: Game, region: number, tag: CountryTag): void {
  capture(land(game), region, byTag(game, tag).smallID(), game.ticks());
}

/** Removes every division and army (a blank board for a numeric test). Men and equipment do not come back. */
export function clearLand(game: Game): void {
  const l = land(game);
  for (let r = 0; r < l.divisions.rows; r++) {
    if (l.divisions.alive(r)) l.killDivision(r, false);
  }
}

/**
 * `n` full-strength divisions of `tag`'s template number `template` (1:
 * its first 1936 template) in `region`, as one new army; returns the army.
 * Draws men and equipment like training; the test country needs both.
 */
export function placeArmy(
  game: Game,
  tag: CountryTag,
  region: number,
  n: number,
  template = 1,
): Army {
  const l = land(game);
  const id = byTag(game, tag).smallID();
  const cl = l.country(id)!;
  const ce = l.econ.country(id)!;
  const a = l.newArmy(id)!;
  const tpl = cl.template(template)!;
  for (let i = 0; i < n; i++) {
    if (!fieldDivision(l, cl, ce, tpl, region, a)) {
      throw new Error(`${tag} ran out of men`);
    }
  }
  return a;
}

/**
 * Steps past the preparation minute and declares `a` → `b` (a human `a`);
 * the war is on when it returns (the declaration runs a tick after its turn).
 */
export function warAfterPrep(
  runner: GameRunner,
  clientID: string,
  b: CountryTag,
): void {
  // P3 (spec §16.2): a 1936 pact (Germany–Poland) would refuse it.
  const me = runner.game.playerByClientID(clientID);
  if (me !== null)
    dropPactOf(runner.game, me.smallID(), byTag(runner.game, b).smallID());
  stepTo(runner, WW_PREP_TICKS + 1);
  step(runner, 2, [
    stamped(clientID, {
      type: "declare_war",
      target: byTag(runner.game, b).id(),
    }),
  ]);
}

// ---- P3: politics (plan Task 1 Step 16; every lane uses these) ----

/**
 * P3 spec §16.2: the 1936 non-aggression pacts (Germany–Poland, the Soviet
 * Union's) refuse a declaration until broken. A P0–P2 test that only needs
 * the war drops the pact first, as the history path does (plan decision 15).
 */
export function dropPact(game: Game, a: CountryTag, b: CountryTag): void {
  dropPactOf(game, byTag(game, a).smallID(), byTag(game, b).smallID());
}

function dropPactOf(game: Game, x: number, y: number): void {
  const p = pol(game);
  const lo = Math.min(x, y);
  const hi = Math.max(x, y);
  p.naps = p.naps.filter((n) => !(n.a === lo && n.b === hi));
}

/** The game's politics. */
export function pol(game: Game): WwPolitics {
  return game.worldWar()!.politics;
}

/** Runs until the start of `date` (the day's first tick). */
export function stepToDate(runner: GameRunner, date: string): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(dayOfDate(date), ww.prepEndTick()));
}

/** A human order for `clientID`. */
export function order(clientID: string, o: WwOrder): StampedIntent {
  return stamped(clientID, { type: "ww_order", order: o });
}

/**
 * A new runner from `runner`'s snapshot (the snapshot holds the config and
 * the players; the game start gives the game id). P3: politics' content is
 * the content source's, the same for both while a test runs.
 */
export async function wwRestore(
  runner: GameRunner,
  humans: WwHuman[] = [],
  map = MINI,
): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({}, humans),
    runner.snapshot(),
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(map),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    () => {},
  );
}

/** The game hash (GameImpl.hash). */
export function gameHash(runner: GameRunner): number {
  return (runner.game as unknown as { hash(): number }).hash();
}

/**
 * P3: a P1/P2 formula test file runs its games on the small test content
 * (no politics rows: neutral, 50% stability and war support, no spirits,
 * events or decisions), so the content lanes' 1936 politics does not move
 * its numbers. Call once at the top of the file.
 */
export function withTestPolitics(): void {
  beforeEach(() => usePoliticsContent(politicsFixture()));
  afterEach(() => usePoliticsContent(null));
}
