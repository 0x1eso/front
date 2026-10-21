// World War 1936 P4 Task 7 (lane A1): sorties, air combat and anti-air
// (spec §14.2–§14.4) on ww1936sea. Britain and Italy (or Germany and
// Poland) are humans at war, their production lines taken back; each test
// picks a clear day over its zone with the zone's own weather function.
import {
  AIR_TYPES,
  type AirMission,
  type AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  aaLossPm,
  rangeEffPm,
  sortieEffPm,
  WEATHER_SORTIE_PM,
} from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  airDuelMilli,
  zoneWeather,
} from "@openfront/engine/ww1936/air/AirCombat";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { joinBattle } from "@openfront/engine/ww1936/land/Battles";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { diffSnapshots } from "../util/Snapshot";
import { AIR_KM, REGION, SEA, SR, TAG_ID } from "./seaFixture";
import {
  clearLand,
  clearStartSetup,
  gameHash,
  HUMAN,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  withTestPolitics,
  WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const GBR_ITA: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "ITA" },
];
const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];

function setStock(ww: WorldWar, id: number, type: AirType, counts: number[]) {
  const ce = ww.economy.country(id)!;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    ce.stock[equipKey(type, g)] = counts[g - 1] ?? 0;
  }
}

function deploy(
  runner: GameRunner,
  id: number,
  sr: number,
  type: AirType,
  mission: AirMission,
  count: number,
) {
  return runner.game
    .worldWar()!
    .air.issue(
      id,
      { kind: "air_deploy", sr, type, mission, count },
      runner.game.ticks(),
    );
}

function recordsOf(ww: WorldWar, sr: number, owner: number, type: AirType) {
  return ww.air
    .deploymentsIn(sr)
    .map((id) => ww.air.deployments.get(id)!)
    .filter((d) => d.owner === owner && d.type === AIR_TYPES.indexOf(type));
}

/** Losses taken so far, milli: whole planes gone plus the remainder. */
const lossMilli = (d: Deployment, start: number) =>
  (start - d.counts.reduce((a, b) => a + b, 0)) * 1000 + d.lossRest;

/** The first day from `from` on that is clear over zone `sr`. */
function clearDay(ww: WorldWar, sr: number, from: number): number {
  for (let d = from; d < from + 400; d++) {
    if (zoneWeather(ww.air, sr, d) === "clear") return d;
  }
  throw new Error("no clear day");
}

/** Runs up to the start of `day`, then through its tick k. */
function toDay(runner: GameRunner, day: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()));
}
function through(runner: GameRunner, day: number, k: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()) + k + 1);
}

/** Britain and Italy at war past the preparation minute, no production. */
async function channelWar() {
  const runner = await wwRunner({}, GBR_ITA, SEA.map);
  const ww = runner.game.worldWar()!;
  for (const id of [TAG_ID.GBR, TAG_ID.ITA]) {
    clearStartSetup(ww.economy, ww.economy.country(id)!);
  }
  warAfterPrep(runner, HUMAN, "ITA");
  expect(ww.land.isEnemy(TAG_ID.GBR, TAG_ID.ITA)).toBe(true);
  const day = clearDay(ww, SR.central, ww.day(runner.game.ticks()) + 1);
  return { runner, ww, day };
}

const Z = emptyStats();
const none = new Set<never>();

describe("air combat (spec §14.2–§14.4)", () => {
  it("200 v 200 1936 fighters lose 3.214 a day each at detection 300", async () => {
    const { runner, ww, day } = await channelWar();
    toDay(runner, day);
    setStock(ww, TAG_ID.GBR, "fighter", [200, 0, 0]);
    setStock(ww, TAG_ID.ITA, "fighter", [200, 0, 0]);
    expect(
      deploy(runner, TAG_ID.GBR, SR.central, "fighter", "air_superiority", 200),
    ).toBeNull();
    expect(
      deploy(runner, TAG_ID.ITA, SR.central, "fighter", "air_superiority", 200),
    ).toBeNull();
    // Rome's base (level 1) holds 200, 128 km out; London's 200 km: both
    // within half the range, so every plane flies.
    expect(ww.scenario.srKm(REGION.rome, SR.central)).toBe(128);
    expect(ww.scenario.srKm(REGION.london, SR.central)).toBe(
      AIR_KM.londonToCentral,
    );
    const [gbr] = recordsOf(ww, SR.central, TAG_ID.GBR, "fighter");
    const [ita] = recordsOf(ww, SR.central, TAG_ID.ITA, "fighter");
    expect([gbr.base, ita.base]).toEqual([REGION.london, REGION.rome]);
    // 360,000 × 300 / (1,200 × 28) = 3,214 milli.
    expect(
      airDuelMilli(
        [
          {
            stats: planeStats("fighter", 1, Z, none),
            milli: 200_000,
            weight: 1,
          },
        ],
        [
          {
            stats: planeStats("fighter", 1, Z, none),
            milli: 200_000,
            weight: 2,
          },
        ],
        300,
      ),
    ).toBe(3214);
    through(runner, day, ww.scenario.srIdxOf(SR.central) % 7);
    for (const d of [gbr, ita]) {
      expect(d.counts).toEqual([197, 0, 0]);
      expect(d.lossRest).toBe(214);
    }
    const z = ww.air.zoneState[ww.scenario.srIdxOf(SR.central)];
    expect(z.result.get(TAG_ID.GBR)?.slice(0, 2)).toEqual([3, 3]);
    expect(z.result.get(TAG_ID.ITA)?.slice(0, 2)).toEqual([3, 3]);
    expect(z.sorties.get(ww.land.sideOf(TAG_ID.GBR))?.[0]).toBe(200);
    expect(z.fightersSup.get(TAG_ID.ITA)).toBe(200_000);
    expect(ww.air.planesLostTotal).toBe(6);
  }, 60_000);

  it("interceptors hit bombers first", async () => {
    const { runner, ww, day } = await channelWar();
    toDay(runner, day);
    setStock(ww, TAG_ID.GBR, "fighter", [200, 0, 0]);
    setStock(ww, TAG_ID.ITA, "fighter", [100, 0, 0]);
    setStock(ww, TAG_ID.ITA, "bomber", [100, 0]);
    expect(
      deploy(runner, TAG_ID.GBR, SR.central, "fighter", "interception", 200),
    ).toBeNull();
    expect(
      deploy(runner, TAG_ID.ITA, SR.central, "fighter", "air_superiority", 100),
    ).toBeNull();
    expect(
      deploy(runner, TAG_ID.ITA, SR.central, "bomber", "port_strike", 100),
    ).toBeNull();
    const [fighters] = recordsOf(ww, SR.central, TAG_ID.ITA, "fighter");
    const [bombers] = recordsOf(ww, SR.central, TAG_ID.ITA, "bomber");
    through(runner, day, ww.scenario.srIdxOf(SR.central) % 7);
    // The bombers fly at 30% (no superiority yesterday); interceptors weigh
    // them ×3 and the fighters ×1.
    const bomberMilli =
      100 * sortieEffPm(1000, 1000, rangeEffPm(128, 900), 0, 0);
    expect(bomberMilli).toBe(30_000);
    const loss = airDuelMilli(
      [{ stats: planeStats("fighter", 1, Z, none), milli: 200_000, weight: 1 }],
      [
        {
          stats: planeStats("fighter", 1, Z, none),
          milli: 100_000,
          weight: 100,
        },
        {
          stats: planeStats("bomber", 1, Z, none),
          milli: bomberMilli,
          weight: 300,
        },
      ],
      300,
    );
    const f = lossMilli(fighters, 100);
    const b = lossMilli(bombers, 100);
    expect(f + b).toBe(loss);
    // Per plane in the air a bomber is three times as likely to fall.
    const perF = Math.floor((f * 1000) / 100_000);
    const perB = Math.floor((b * 1000) / bomberMilli);
    expect(Math.abs(perB - 3 * perF)).toBeLessThanOrEqual(3);
  }, 60_000);

  it("AA shoots down CAS over its region", async () => {
    const runner = await wwRunner({}, DEU_POL, SEA.map);
    const ww = runner.game.worldWar()!;
    const g = runner.game;
    const [deu, pol] = [TAG_ID.DEU, TAG_ID.POL];
    for (const id of [deu, pol]) {
      clearStartSetup(ww.economy, ww.economy.country(id)!);
    }
    warAfterPrep(runner, HUMAN, "POL");
    expect(ww.land.isEnemy(deu, pol)).toBe(true);
    const day = ww.day(g.ticks()) + 1;
    toDay(runner, day);
    clearLand(g);
    for (const id of [deu, pol]) {
      const ce = ww.economy.country(id)!;
      for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
      ce.manpower += 1_000_000;
    }
    // Warsaw's guns: one level, as London's.
    const WARSAW = 6;
    ww.economy.addBuilding(WARSAW, "anti_air", 1);
    const a = placeArmy(g, "DEU", REGION.berlin, 1);
    placeArmy(g, "POL", WARSAW, 1);
    for (const id of a.divisions) joinBattle(ww.land, id, WARSAW);
    const b = ww.land.battles.get(WARSAW)!;
    expect(b).toBeDefined();
    // Only Berlin's base (Rome, on Germany's side, would be nearer).
    ww.economy.addBuilding(REGION.rome, "air_base", -1);
    setStock(ww, deu, "cas", [400, 0, 0]);
    expect(deploy(runner, deu, SR.eastLand, "cas", "cas", 400)).toBeNull();
    const [cas] = recordsOf(ww, SR.eastLand, deu, "cas");
    expect(cas.base).toBe(REGION.berlin);
    // Berlin → the East: 282 km, 937‰ of a 450 km range.
    const km = ww.scenario.srKm(REGION.berlin, SR.eastLand);
    expect(km).toBe(282);
    expect(rangeEffPm(km, 450)).toBe(937);
    let polAa = 0;
    for (const id of b.defLine) {
      polAa += ww.land.baseStatsOf(ww.land.divisions.rowOf(id)).airAtk;
    }
    const pm = aaLossPm(1, polAa, 0, true);
    expect(pm).toBe(3 + Math.floor(polAa / 100));
    const eff = sortieEffPm(
      WEATHER_SORTIE_PM[zoneWeather(ww.air, SR.eastLand, day)],
      1000,
      937,
      0,
      0,
    );
    through(runner, day, ww.scenario.srIdxOf(SR.eastLand) % 7);
    expect(ww.land.battles.has(WARSAW)).toBe(true);
    expect(lossMilli(cas, 400)).toBe(Math.floor((400 * eff * pm) / 1000));
  }, 60_000);

  it("a game restored mid-campaign flies and fights the same", async () => {
    const { runner, ww, day } = await channelWar();
    toDay(runner, day);
    setStock(ww, TAG_ID.GBR, "fighter", [500, 0, 0]);
    setStock(ww, TAG_ID.ITA, "fighter", [300, 0, 0]);
    setStock(ww, TAG_ID.ITA, "bomber", [200, 0]);
    deploy(runner, TAG_ID.GBR, SR.central, "fighter", "interception", 300);
    deploy(runner, TAG_ID.ITA, SR.central, "fighter", "air_superiority", 100);
    deploy(runner, TAG_ID.ITA, SR.central, "bomber", "port_strike", 100);
    deploy(
      runner,
      TAG_ID.ITA,
      SR.approaches,
      "fighter",
      "air_superiority",
      100,
    );
    through(runner, day + 2, 4);
    const b = await wwRestore(runner, GBR_ITA, SEA.map);
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(b.game)),
    ).toEqual([]);
    expect(ww.air.planesLostTotal).toBeGreaterThan(0);
  }, 120_000);
});
