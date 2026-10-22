// World War 1936 P6 T1b (navy/air half): night bombing and aces in P4's
// air war (spec §15.2, §15.3; lane W2's sites 3–6) on ww1936deep —
// Britain and Italy, both human, at war over the western land zone.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
  type PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import { EQUIPMENT_GENS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { detectionPm } from "@openfront/engine-lib/ww1936/AirRules";
import { ACE_STATS } from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  airDuelMilli,
  dailyAirZone,
  zoneFlights,
} from "@openfront/engine/ww1936/air/AirCombat";
import { airMissionEffects } from "@openfront/engine/ww1936/air/AirEffects";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import { bombableRegions } from "@openfront/engine/ww1936/air/Bombing";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const WEST = DEEP.sr.westLand;
const ROME = DEEP.region.rome;

async function atWar(): Promise<{ runner: GameRunner; ww: WorldWar }> {
  const runner = await wwRunner(
    {},
    [
      { clientID: "HUMANGBR", country: "GBR" },
      { clientID: "HUMANITA", country: "ITA" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = runner.game.worldWar()!;
  ww.setWar(GBR, ITA, runner.game.ticks());
  // Plenty of fuel: the sorties fly at the weather's and range's rate only.
  for (const id of [GBR, ITA]) ww.economy.country(id)!.fuelMilli = 1e12;
  return { runner, ww };
}

/** A record of `planes` generation-1 planes on base 0 (no range or base damage). */
function deploy(
  ww: WorldWar,
  owner: number,
  type: AirType,
  mission: AirMission,
  planes: number,
): Deployment {
  const counts = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
  counts[0] = planes;
  return ww.air.addDeployment({
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

/** Losses taken today, milli: whole planes gone and the remainder. */
const lossMilli = (d: Deployment, start: number) =>
  (start - d.counts.reduce((a, b) => a + b, 0)) * 1000 + d.lossRest;

function setAa(ww: WorldWar, region: number, level: number): void {
  ww.economy.buildingArray("anti_air")[region] = level;
  ww.economy.afterBuildingChange(region, "anti_air");
}

/** The flight of deployment `id` the zone's day just flew. */
function flightOf(ww: WorldWar, id: number) {
  return zoneFlights(ww.air, WEST).find((f) => f.id === id)!;
}

/** Side `side`'s detection over the western zone, as P4's air battle reads it. */
function detection(ww: WorldWar, side: number, shooterOwner: number): number {
  const s = ww.scenario.sr(WEST)!;
  const own = s.members.some(
    (r) => ww.land.sideOf(ww.land.controller[r] ?? 0) === side,
  );
  const pct = ww.economy.country(shooterOwner)!.stats.airDetectPct;
  return detectionPm(radarPmAt(ww.air, side, WEST), own, pct, 0);
}

/** Interceptors against strategic bombers: the bombers' loss to the duel, milli. */
async function interceptedRaid(
  nightOn: boolean,
): Promise<{ loss: number; duel: number }> {
  const { runner, ww } = await atWar();
  setAa(ww, ROME, 0);
  const bombers = deploy(ww, GBR, "strat_bomber", "strategic_bombing", 40);
  deploy(ww, ITA, "fighter", "interception", 100);
  if (nightOn) {
    expect(
      ww.depth.issue(
        GBR,
        { kind: "air_night", deployment: bombers.id, on: true },
        runner.game.ticks(),
      ),
    ).toBeNull();
  }
  const day = ww.day(runner.game.ticks());
  dailyAirZone(ww.air, WEST, day);
  const f = zoneFlights(ww.air, WEST);
  const b = f.find((x) => x.id === bombers.id)!;
  const i = f.find((x) => x.owner === ITA)!;
  const duel = airDuelMilli(
    [{ stats: i.stats[0], milli: i.milli[0], weight: 1 }],
    [{ stats: b.stats[0], milli: b.milli[0], weight: 300 }],
    detection(ww, ww.land.sideOf(ITA), ITA),
  );
  return { loss: lossMilli(bombers, 40), duel };
}

describe("T1b: night bombing in P4's air war (spec §15.3)", () => {
  it("a night raid takes half the interceptors' losses", async () => {
    const day = await interceptedRaid(false);
    const night = await interceptedRaid(true);
    expect(day.duel).toBeGreaterThan(1000);
    expect(day.loss).toBe(day.duel);
    expect(night.duel).toBe(day.duel);
    expect(night.loss).toBe(Math.floor((night.duel * 5_000) / 10_000));
  });

  it("anti-air hits a night raid half as hard", async () => {
    const run = async (nightOn: boolean) => {
      const { runner, ww } = await atWar();
      setAa(ww, ROME, 3);
      const bombers = deploy(ww, GBR, "strat_bomber", "strategic_bombing", 40);
      bombers.night = nightOn;
      dailyAirZone(ww.air, WEST, ww.day(runner.game.ticks()));
      return {
        loss: lossMilli(bombers, 40),
        total: flightOf(ww, bombers.id).total,
      };
    };
    const day = await run(false);
    const night = await run(true);
    expect(day.loss).toBeGreaterThan(0);
    expect(night.total).toBe(day.total);
    // ‰ of the sorties by day; half of it by night.
    expect(night.loss).toBe(Math.floor((day.loss * 5_000) / 10_000));
  });

  it("a night raid scores 60 percent of its bomb points", async () => {
    const run = async (nightOn: boolean) => {
      const { runner, ww } = await atWar();
      setAa(ww, ROME, 0);
      const bombers = deploy(ww, GBR, "strat_bomber", "strategic_bombing", 40);
      bombers.night = nightOn;
      const day = ww.day(runner.game.ticks());
      dailyAirZone(ww.air, WEST, day);
      const before = ww.air.bombPointsTotal;
      airMissionEffects(ww.air, WEST, day);
      const f = flightOf(ww, bombers.id);
      return { points: ww.air.bombPointsTotal - before, f };
    };
    const day = await run(false);
    const night = await run(true);
    const lit = Math.floor((day.f.milli[0] * day.f.stats[0].strat) / 1000);
    expect(day.points).toBe(Math.floor(lit / 100));
    expect(night.points).toBe(
      Math.floor(Math.floor((lit * 6_000) / 10_000) / 100),
    );
    expect(night.points).toBeLessThan(day.points);
  });

  it("no raid, by day or night, strikes a no-strike region", async () => {
    const { ww } = await atWar();
    expect(bombableRegions(ww.air, WEST)).toContain(ROME);
    // The content's no-strike set (P5's Korea and Taiwan groups) counts
    // as the engine-lib names do.
    const judge = vi
      .spyOn(ww.depth, "noStrike")
      .mockImplementation((r: number) => r === ROME);
    expect(bombableRegions(ww.air, WEST)).not.toContain(ROME);
    judge.mockRestore();
  });
});

describe("T1b: aces in P4's air war (spec §15.2)", () => {
  /** British superiority fighters on Italian CAS planes, with or without an ace. */
  const run = async (ace: boolean) => {
    const { runner, ww } = await atWar();
    const fighters = deploy(ww, GBR, "fighter", "air_superiority", 100);
    const cas = deploy(ww, ITA, "cas", "cas", 100);
    if (ace) {
      ww.depth.sea.aces.push({
        id: 7,
        owner: GBR,
        deployment: fighters.id,
        sinceDay: 0,
        callNo: 8,
      });
      fighters.ace = 7;
    }
    dailyAirZone(ww.air, WEST, ww.day(runner.game.ticks()));
    const f = flightOf(ww, fighters.id);
    const c = flightOf(ww, cas.id);
    const det = detection(ww, ww.land.sideOf(GBR), GBR);
    const duel = (st: PlaneStats) =>
      airDuelMilli(
        [{ stats: st, milli: f.milli[0], weight: 1 }],
        [{ stats: c.stats[0], milli: c.milli[0], weight: 100 }],
        det,
      );
    return { loss: lossMilli(cas, 100), st: f.stats[0], duel };
  };

  it("an ace's record fights with +10% air attack and +5% agility", async () => {
    const plain = await run(false);
    const aced = await run(true);
    expect(plain.loss).toBe(plain.duel(plain.st));
    const st = aced.st;
    const better = {
      ...st,
      airAtk: Math.floor((st.airAtk * (100 + ACE_STATS.attackPct)) / 100),
      agility: Math.floor((st.agility * (100 + ACE_STATS.agilityPct)) / 100),
    };
    expect(aced.loss).toBe(aced.duel(better));
    expect(aced.loss).toBeGreaterThan(plain.loss);
  });
});
