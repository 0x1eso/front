// World War 1936 P4 (plan Task 8 Step 7): close air support (P4 spec
// §14.7) on ww1936sea. Germany and Poland are humans (no AI); Germany's
// CAS flies from Berlin over the land zone East (2) on 1936-06-01, a clear
// day in Krakow (the zone's center region). The zone's day is called
// directly (airMissionEffects), the battle rounds with stepBattles, so no
// other step comes between them.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  casPoolCenti,
  casRoundHits,
  rangeEffPm,
  sortieEffPm,
  WEATHER_SORTIE_PM,
} from "@openfront/engine-lib/ww1936/AirRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { roundDamage } from "@openfront/engine-lib/ww1936/CombatRules";
import type { Game } from "@openfront/engine/game/Game";
import {
  airMissionEffects,
  casHitsFor,
} from "@openfront/engine/ww1936/air/AirEffects";
import { apportion } from "@openfront/engine/ww1936/air/Bombing";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import { joinBattle, stepBattles } from "@openfront/engine/ww1936/land/Battles";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { REGION, SEA, SR } from "./seaFixture";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  withTestPolitics,
  WwHuman,
  wwRunner,
} from "./util";

withTestPolitics();

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const JUNE_1 = dayOfDate("1936-06-01");
const CAS = AIR_TYPES.indexOf("cas");
const M_CAS = AIR_MISSIONS.indexOf("cas");

function stockUp(g: Game, tag: "DEU" | "POL"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Germany at war with Poland from 1936-06-01, the board cleared. */
async function juneWar() {
  const runner = await wwRunner({}, DEU_POL, SEA.map);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  stockUp(g, "DEU");
  stockUp(g, "POL");
  const ww = g.worldWar()!;
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  expect(ww.land.isEnemy(deu, pol)).toBe(true);
  return { runner, g, ww, l: ww.land, air: ww.air, deu, pol };
}

/** `n` German CAS (1936) on close air support over the zone East from Berlin. */
function deployCas(g: Game, n: number): void {
  const ww = g.worldWar()!;
  const deu = byTag(g, "DEU").smallID();
  const ce = ww.economy.country(deu)!;
  ce.stock[equipKey("cas", 1)] = n;
  ww.air.addDeployment({
    owner: deu,
    sr: SR.eastLand,
    type: CAS,
    mission: M_CAS,
    counts: drawPlanes(ce, "cas", n),
    target: n,
    base: REGION.berlin,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

function attack(l: WwLand, a: Army, region: number): void {
  for (const id of a.divisions) joinBattle(l, id, region);
}

/** A Polish template of six infantry and one anti-air battalion (anti-air 20). */
function aaTemplate(l: WwLand, pol: number): number {
  const cl = l.country(pol)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: "AA",
      battalions: [...new Array<"infantry">(6).fill("infantry"), "anti_air"],
      support: [],
    },
  });
  return id;
}

/** The pool the engine should find: the same sortie efficiency and pool rules. */
function expectedPool(g: Game, n: number): number {
  const ww = g.worldWar()!;
  const deu = byTag(g, "DEU").smallID();
  const ce = ww.economy.country(deu)!;
  const km = ww.scenario.srKm(REGION.berlin, SR.eastLand);
  const rangePm = rangeEffPm(km, 450);
  const weather =
    WEATHER_SORTIE_PM[ww.land.weatherOn(REGION.krakow, ww.land.day())];
  const eff = sortieEffPm(
    weather,
    ce.fuelRatioPm,
    rangePm,
    0,
    ww.air.airSup(ww.land.sideOf(deu), SR.eastLand),
  );
  return casPoolCenti(n * eff, 1200, ce.stats.casPct);
}

/**
 * One round of a Munich → Krakow battle (two German divisions on one
 * Polish), with or without 100 German CAS over the zone; the Polish
 * division's org and its anti-air.
 */
async function oneRound(opts: {
  cas: boolean;
  aaDiv: boolean;
  aaLevel: number;
}) {
  const { g, ww, l, air, deu, pol } = await juneWar();
  const a = placeArmy(g, "DEU", REGION.munich, 2);
  const d = placeArmy(
    g,
    "POL",
    REGION.krakow,
    1,
    opts.aaDiv ? aaTemplate(l, pol) : 1,
  );
  if (opts.aaLevel > 0) {
    ww.economy.addBuilding(REGION.krakow, "anti_air", opts.aaLevel);
  }
  attack(l, a, REGION.krakow);
  if (opts.cas) deployCas(g, 100);
  airMissionEffects(air, SR.eastLand, l.day());
  const hits = casHitsFor(air, REGION.krakow, l.sideOf(deu));
  const r = l.divisions.rowOf(d.divisions[0]);
  const org0 = l.divisions.org[r];
  stepBattles(l, g.ticks());
  return {
    hits,
    lostOrg: org0 - l.divisions.org[l.divisions.rowOf(d.divisions[0])],
    divAa: l.statsOf(r).airAtk,
  };
}

describe("World War 1936 P4: close air support (spec §14.7)", () => {
  test("100 1936 CAS give their pool split by frontage", async () => {
    const { g, ww, l, air, deu } = await juneWar();
    expect(l.weatherOn(REGION.krakow, l.day())).toBe("clear");
    // Berlin → the zone East's center (pre-flight T8 A2 row: 282 km, 937‰).
    expect(ww.scenario.srKm(REGION.berlin, SR.eastLand)).toBe(282);
    expect(rangeEffPm(282, 450)).toBe(937);
    const side = l.sideOf(deu);
    // One battle: Munich → Krakow.
    const a = placeArmy(g, "DEU", REGION.munich, 2);
    placeArmy(g, "POL", REGION.krakow, 1);
    attack(l, a, REGION.krakow);
    deployCas(g, 100);
    airMissionEffects(air, SR.eastLand, l.day());
    const pool = expectedPool(g, 100);
    expect(pool).toBeGreaterThan(0);
    expect(air.casPool(SR.eastLand, side)).toBe(pool);
    expect(casHitsFor(air, REGION.krakow, side)).toBe(casRoundHits(pool));
    // No CAS for the other side, none for a battle elsewhere.
    expect(
      casHitsFor(air, REGION.krakow, l.sideOf(byTag(g, "POL").smallID())),
    ).toBe(0);
    expect(casHitsFor(air, REGION.warsaw, side)).toBe(0);
    // A second battle, Berlin → Warsaw with one division: the pool splits
    // by the attackers' frontage (2 : 1 of the same template).
    const b = placeArmy(g, "DEU", REGION.berlin, 1);
    placeArmy(g, "POL", REGION.warsaw, 1);
    attack(l, b, REGION.warsaw);
    airMissionEffects(air, SR.eastLand, l.day());
    const width = (x: Army) =>
      x.divisions.reduce((s, id) => s + l.widthOf(l.divisions.rowOf(id)), 0);
    const [pmWarsaw, pmKrakow] = apportion(1000, [width(b), width(a)]);
    expect(pmKrakow).toBe(667);
    expect(pmWarsaw).toBe(333);
    expect(casHitsFor(air, REGION.krakow, side)).toBe(
      casRoundHits(Math.floor((pool * pmKrakow) / 1000)),
    );
    expect(casHitsFor(air, REGION.warsaw, side)).toBe(
      casRoundHits(Math.floor((pool * pmWarsaw) / 1000)),
    );
    // The zone's results: Germany's CAS pool given.
    const z = air.zoneState[ww.scenario.srIdxOf(SR.eastLand)];
    expect(z.result.get(deu)?.[2]).toBe(pool);
  }, 60_000);

  test("CAS cuts organisation in the battle", async () => {
    const without = await oneRound({ cas: false, aaDiv: false, aaLevel: 0 });
    const withCas = await oneRound({ cas: true, aaDiv: false, aaLevel: 0 });
    expect(without.hits).toBe(0);
    expect(withCas.hits).toBeGreaterThan(0);
    expect(withCas.divAa).toBe(0);
    // The round's CAS hits on the defender, no block value (P2 roundDamage).
    expect(withCas.lostOrg - without.lostOrg).toBe(
      roundDamage(withCas.hits, false).orgMilli,
    );
  }, 120_000);

  test("division AA reduces CAS", async () => {
    const without = await oneRound({ cas: false, aaDiv: true, aaLevel: 2 });
    const withCas = await oneRound({ cas: true, aaDiv: true, aaLevel: 2 });
    // The anti-air battalion: 20 points = −20%; the region's two anti-air
    // levels: −10%.
    expect(withCas.divAa).toBe(20);
    const cut = Math.floor(
      (Math.floor((withCas.hits * (100 - withCas.divAa)) / 100) * 90) / 100,
    );
    expect(withCas.lostOrg - without.lostOrg).toBe(
      roundDamage(cut, false).orgMilli,
    );
    expect(cut).toBeLessThan(withCas.hits);
  }, 120_000);

  test("the effects' state is in the air war's hash", async () => {
    const { ww, air, deu } = await juneWar();
    const z = air.zoneState[ww.scenario.srIdxOf(SR.eastLand)];
    const c = air.country(deu)!;
    const h0 = air.hash();
    const changes: [() => void, () => void][] = [
      [() => z.cas.set(deu, 5), () => z.cas.clear()],
      [
        () => (z.casShare = [[REGION.krakow, deu, 1000]]),
        () => (z.casShare = []),
      ],
      [
        () => (z.airSupply = [[REGION.krakow, deu, 2000]]),
        () => (z.airSupply = []),
      ],
      [() => z.result.set(deu, [0, 0, 7, 0, 0]), () => z.result.clear()],
      [() => (c.bombTaken[3] = 400), () => (c.bombTaken[3] = 0)],
      [() => (c.tally[2][5] = 9), () => (c.tally[2][5] = 0)],
    ];
    for (const [change, undo] of changes) {
      change();
      expect(air.hash()).not.toBe(h0);
      undo();
      expect(air.hash()).toBe(h0);
    }
  }, 60_000);
});
