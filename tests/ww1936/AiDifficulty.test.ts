// World War 1936: the lobby's difficulty (engine-lib ww1936/AiDifficulty).
// The handicaps go to the AI-controlled countries only and follow a
// takeover; Normal (Medium) is the game as it was.
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  WW_STAT_KEYS,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  WW_AI_HANDICAP,
  WW_EASY_AI_PLAN_DAYS,
  wwAiLevel,
  wwAiWarPlanDue,
} from "@openfront/engine-lib/ww1936/AiDifficulty";
import { normalizeWorldWar1936Config } from "@openfront/engine-lib/ww1936/ModeConfig";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiNavyDue } from "@openfront/engine/ww1936/navy/AiNavy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, pol, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const A = "HUMANAAA";
const HUMANS = [{ clientID: A, country: "POL" as const }];

/** A game on the test map, one tick past the preparation (stats computed). */
async function started(difficulty: Difficulty): Promise<GameRunner> {
  const runner = await wwRunner({ difficulty }, HUMANS, END_MAP);
  stepTo(runner, runner.game.worldWar()!.prepEndTick() + 1);
  return runner;
}

const statsOf = (runner: GameRunner, id: number): WwStats => ({
  ...pol(runner.game).stats(id),
});

/** `base` plus the handicap, key by key. */
function withHandicap(base: WwStats, h: Partial<WwStats>): WwStats {
  const out = { ...base };
  for (const k of WW_STAT_KEYS) out[k] += h[k] ?? 0;
  return out;
}

describe("World War 1936 difficulty: the lobby", () => {
  const base = {
    gameMap: GameMapType.World,
    gameMapSize: GameMapSize.Normal,
    gameMode: GameMode.FFA,
    gameType: GameType.Singleplayer,
    nations: "default",
    bots: 0,
    donateGold: false,
    donateTroops: false,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
    worldWar1936: true,
  } as const;

  it("defaults to Easy, keeps Easy/Medium/Hard and plays Impossible as Hard", () => {
    const of = (d: Difficulty | undefined) =>
      normalizeWorldWar1936Config({ ...base, difficulty: d } as GameConfig)
        .difficulty;
    expect(of(undefined)).toBe(Difficulty.Easy);
    expect(of(Difficulty.Easy)).toBe(Difficulty.Easy);
    expect(of(Difficulty.Medium)).toBe(Difficulty.Medium);
    expect(of(Difficulty.Hard)).toBe(Difficulty.Hard);
    expect(of(Difficulty.Impossible)).toBe(Difficulty.Hard);
  });

  it("leaves a game without the mode alone", () => {
    const c = {
      ...base,
      worldWar1936: false,
      difficulty: Difficulty.Impossible,
    } as GameConfig;
    expect(normalizeWorldWar1936Config(c)).toBe(c);
    expect(c.difficulty).toBe(Difficulty.Impossible);
  });

  it("maps the levels", () => {
    expect(wwAiLevel(Difficulty.Easy)).toBe("easy");
    expect(wwAiLevel(Difficulty.Medium)).toBe("normal");
    expect(wwAiLevel(Difficulty.Hard)).toBe("hard");
    expect(wwAiLevel(Difficulty.Impossible)).toBe("hard");
    expect(wwAiLevel(undefined)).toBe("easy");
  });
});

describe("World War 1936 difficulty: the AI's handicaps", () => {
  it("Easy handicaps an AI country, never a human one", async () => {
    const easy = await started(Difficulty.Easy);
    const normal = await started(Difficulty.Medium);
    const [pl, aut] = [endId("POL"), endId("AUT")];
    expect(easy.game.worldWar()!.aiLevel).toBe("easy");
    expect(statsOf(easy, aut)).toEqual(
      withHandicap(statsOf(normal, aut), WW_AI_HANDICAP.easy),
    );
    expect(statsOf(easy, aut).outputPct).toBe(
      statsOf(normal, aut).outputPct - 20,
    );
    expect(statsOf(easy, aut).researchPct).toBe(
      statsOf(normal, aut).researchPct - 15,
    );
    expect(statsOf(easy, pl)).toEqual(statsOf(normal, pl));
  });

  it("Hard helps an AI country's industry and research, not its combat", async () => {
    const hard = await started(Difficulty.Hard);
    const normal = await started(Difficulty.Medium);
    const aut = endId("AUT");
    const h = statsOf(hard, aut);
    const n = statsOf(normal, aut);
    expect(h).toEqual(withHandicap(n, WW_AI_HANDICAP.hard));
    expect([h.outputPct, h.constructionPct, h.researchPct]).toEqual([
      n.outputPct + 10,
      n.constructionPct + 10,
      n.researchPct + 10,
    ]);
    expect([h.attackPct, h.defensePct]).toEqual([n.attackPct, n.defensePct]);
    expect(statsOf(hard, endId("POL"))).toEqual(statsOf(normal, endId("POL")));
  });

  it("Normal adds nothing and keeps the old cadences", () => {
    expect(WW_AI_HANDICAP.normal).toEqual({});
    for (let day = 0; day < 30; day++) {
      for (const id of [1, 2, 3, 7]) {
        expect(wwAiWarPlanDue("normal", id, day)).toBe(true);
        expect(wwAiWarPlanDue("hard", id, day)).toBe(true);
        expect(aiNavyDue(id, day, true, "normal")).toBe(day % 2 === id % 2);
        expect(aiNavyDue(id, day, true)).toBe(day % 2 === id % 2);
        expect(aiNavyDue(id, day, false, "easy")).toBe(day % 10 === id % 10);
      }
    }
  });

  it("Easy plans the war every 3 days, staggered by country", () => {
    expect(WW_EASY_AI_PLAN_DAYS).toBe(3);
    for (const id of [1, 2, 3]) {
      const days = [...Array(9).keys()].filter((d) =>
        wwAiWarPlanDue("easy", id, d),
      );
      expect(days).toHaveLength(3);
      expect(days[1] - days[0]).toBe(3);
      expect(days.map((d) => aiNavyDue(id, d, true, "easy"))).toEqual([
        true,
        true,
        true,
      ]);
    }
    // Three countries in a row plan on three different days.
    const first = [1, 2, 3].map((id) =>
      [...Array(3).keys()].find((d) => wwAiWarPlanDue("easy", id, d)),
    );
    expect(new Set(first).size).toBe(3);
  });

  it("a takeover moves the handicap with the control", async () => {
    const easy = await started(Difficulty.Easy);
    const ww = easy.game.worldWar()!;
    const [pl, aut] = [endId("POL"), endId("AUT")];
    const before = { pl: statsOf(easy, pl), aut: statsOf(easy, aut) };
    const ver = (id: number) => ww.economy.country(id)!.statsVer;
    const verBefore = [ver(pl), ver(aut)];
    ww.endgame.setControl(A, aut);
    expect(ww.isHumanControlled(aut)).toBe(true);
    expect(ww.isHumanControlled(pl)).toBe(false);
    const neg = Object.fromEntries(
      Object.entries(WW_AI_HANDICAP.easy).map(([k, v]) => [k, -v!]),
    );
    // The human's new country loses it, the country it left gains it, now.
    expect(statsOf(easy, aut)).toEqual(withHandicap(before.aut, neg));
    expect(statsOf(easy, pl)).toEqual(
      withHandicap(before.pl, WW_AI_HANDICAP.easy),
    );
    // The land, sea and air stat caches key on statsVer.
    expect(ver(pl)).toBeGreaterThan(verBefore[0]);
    expect(ver(aut)).toBeGreaterThan(verBefore[1]);
  });

  it("a snapshot keeps the difficulty", async () => {
    const easy = await started(Difficulty.Easy);
    const restored = await wwRestore(easy, HUMANS, END_MAP);
    expect(restored.game.config().gameConfig().difficulty).toBe(
      Difficulty.Easy,
    );
    expect(restored.game.worldWar()!.aiLevel).toBe("easy");
    const aut = endId("AUT");
    expect(statsOf(restored, aut)).toEqual(statsOf(easy, aut));
  });
});
