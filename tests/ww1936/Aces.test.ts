// World War 1936 P6 (plan Task 8, lane W2): aces (spec §15.2) on
// ww1936deep — British and Italian fighters over the western land zone,
// both countries human, at war. The rolls are P3's stateless wwRoll, so
// the test picks its days with them (plan decision 30).
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import { EQUIPMENT_GENS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  P_ACE_DEATH,
  P_ACE_SPAWN,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  ACE_STATS,
  aceCallNo,
  WW_MAX_ACES,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { aceMods, dailyAces } from "@openfront/engine/ww1936/depth/Aces";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const WEST = DEEP.sr.westLand;
const HUMANS = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANITA", country: "ITA" as const },
];

async function atWar(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

function deploy(
  runner: GameRunner,
  owner: number,
  type: AirType,
  mission: AirMission,
  planes: number,
): Deployment {
  const air = runner.game.worldWar()!.air;
  const counts = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
  counts[0] = planes;
  return air.addDeployment({
    owner,
    sr: WEST,
    type: AIR_TYPES.indexOf(type),
    mission: AIR_MISSIONS.indexOf(mission),
    counts,
    target: planes,
    base: 0,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

/** The first day from `from` whose roll passes. */
function dayWhere(from: number, pass: (day: number) => boolean): number {
  for (let day = from; day < from + 100_000; day++) if (pass(day)) return day;
  throw new Error("no day");
}

describe("World War 1936 P6: aces (spec §15.2)", () => {
  it("an ace appears deterministically after a 20-kill day and dies by roll", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const air = ww.air;
    const seed = ww.politics.seed;
    const messages = vi.spyOn(d, "message");
    const big = deploy(runner, GBR, "fighter", "air_superiority", 30);
    const small = deploy(runner, GBR, "fighter", "air_superiority", 10);
    const bombers = deploy(runner, GBR, "bomber", "cas", 50);
    const enemy = deploy(runner, ITA, "fighter", "air_superiority", 30);
    const z = air.zoneState[ww.scenario.srIdxOf(WEST)];
    const from = ww.day(runner.game.ticks());
    const spawn = (day: number) =>
      wwRoll(seed, P_ACE_SPAWN, GBR, day, WEST) % 1000 < 20;
    const born = dayWhere(from, spawn);
    const notBorn = dayWhere(from, (x) => !spawn(x));
    // 19 kills: never.
    z.result = new Map([[GBR, [19, 0, 0, 0, 0]]]);
    dailyAces(d, WEST, born);
    expect(d.sea.aces).toEqual([]);
    // 20 kills on a day the roll fails: none either.
    z.result = new Map([[GBR, [20, 0, 0, 0, 0]]]);
    dailyAces(d, WEST, notBorn);
    expect(d.sea.aces).toEqual([]);
    // The roll passes: on the record with the most fighters (not the bombers).
    dailyAces(d, WEST, born);
    expect(d.sea.aces.length).toBe(1);
    const ace = d.sea.aces[0];
    expect(ace).toEqual({
      id: ace.id,
      owner: GBR,
      deployment: big.id,
      sinceDay: born,
      callNo: aceCallNo(big.id),
    });
    expect(ace.callNo).toBe((big.id % 100) + 1);
    expect(big.ace).toBe(ace.id);
    expect(aceMods(d, big.id)).toEqual(ACE_STATS);
    expect(aceMods(d, small.id)).toEqual({ attackPct: 0, agilityPct: 0 });
    expect(aceMods(d, bombers.id)).toEqual({ attackPct: 0, agilityPct: 0 });
    expect(messages).toHaveBeenLastCalledWith(GBR, "ww1936_ace", {
      callsign: ace.callNo,
      state: "rise",
    });
    // The same day again: the next ace goes to the next record.
    dailyAces(d, WEST, born);
    expect(d.sea.aces.map((a) => a.deployment)).toEqual([big.id, small.id]);
    // At most five a country.
    for (let i = 0; i < 4; i++) {
      deploy(runner, GBR, "fighter", "air_superiority", 5);
      dailyAces(d, WEST, born);
    }
    expect(d.sea.aces.length).toBe(WW_MAX_ACES);
    expect(d.sea.aces.every((a) => a.owner === GBR)).toBe(true);
    // Lost: a 0.5% roll on a day its record fought in the air.
    z.result = new Map();
    const death = (day: number) =>
      wwRoll(seed, P_ACE_DEATH, ace.id, day) % 1000 < 5;
    const dies = dayWhere(from, death);
    const lives = dayWhere(from, (x) => !death(x));
    dailyAces(d, WEST, lives);
    expect(d.sea.aces.some((a) => a.id === ace.id)).toBe(true);
    // No enemy in the sky: no air combat, no loss.
    air.removeDeployment(enemy.id, true);
    dailyAces(d, WEST, dies);
    expect(d.sea.aces.some((a) => a.id === ace.id)).toBe(true);
    deploy(runner, ITA, "fighter", "air_superiority", 30);
    messages.mockClear();
    dailyAces(d, WEST, dies);
    expect(d.sea.aces.some((a) => a.id === ace.id)).toBe(false);
    expect(big.ace).toBe(0);
    expect(aceMods(d, big.id)).toEqual({ attackPct: 0, agilityPct: 0 });
    expect(messages).toHaveBeenCalledWith(GBR, "ww1936_ace", {
      callsign: ace.callNo,
      state: "lost",
    });
    // A recalled record retires its ace.
    const other = d.sea.aces.find((a) => a.deployment === small.id)!;
    air.removeDeployment(small.id, true);
    dailyAces(d, WEST, lives);
    expect(d.sea.aces.some((a) => a.id === other.id)).toBe(false);
  });

  it("the same game rolls the same aces", async () => {
    const ids: number[][] = [];
    for (let run = 0; run < 2; run++) {
      const runner = await atWar();
      const ww = runner.game.worldWar()!;
      const d = ww.depth;
      const seed = ww.politics.seed;
      const big = deploy(runner, GBR, "fighter", "air_superiority", 30);
      deploy(runner, ITA, "fighter", "air_superiority", 30);
      const z = ww.air.zoneState[ww.scenario.srIdxOf(WEST)];
      z.result = new Map([
        [GBR, [25, 0, 0, 0, 0]],
        [ITA, [30, 0, 0, 0, 0]],
      ]);
      const from = ww.day(runner.game.ticks());
      const out: number[] = [];
      for (let day = from; day < from + 400; day++) {
        dailyAces(d, WEST, day);
        out.push(d.sea.aces.length * 1000 + (big.ace === 0 ? 0 : 1));
      }
      expect(seed).toBe(ww.politics.seed);
      ids.push(out);
    }
    expect(ids[0]).toEqual(ids[1]);
    // Over 400 days at a 2% roll both sides found aces.
    expect(ids[0][399]).toBeGreaterThan(0);
  });
});
