// World War 1936 ww7 lane B2: defence and capitulation. Entrenchment per
// level, positions (build, keep, reset, river start, zone), the fort's
// width, urban org damage, and the capitulation gauge arithmetic, the
// capital's +15 points and France's floor.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  MOVE_WALK,
  type LandTerrain,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_CAPITAL_LINE_MAX,
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  applyBp,
  attackValue,
  combatWidth,
  defenderOrgDamage,
  divisionMods,
  ENTRENCH_DEF_BP,
  FORT_HALF_WIDTH_FROM,
  POSITION_DEF_BP,
  predictBattle,
  roundDamage,
  roundHits,
  TERRAIN,
  type ModInput,
} from "@openfront/engine-lib/ww1936/CombatRules";
import {
  effectiveSurrenderPct,
  withCapitalPct,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  capitulationStep,
  holdsCapital,
} from "@openfront/engine/ww1936/Capitulation";
import {
  joinBattle,
  modInputOf,
  modsOf,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import {
  dailyPositions,
  POS_EMPTY_DAYS,
  POS_MAX_LEVEL,
  POS_STEP_DAYS,
  stepPosition,
} from "@openfront/engine/ww1936/land/Positions";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  MINI,
  placeArmy,
  stamped,
  step,
  stepTo,
  wwGameStart,
  wwRunner,
  type WwHuman,
} from "./util";

const BERLIN = 3;
const MUNICH = 4;
const WARSAW = 6;
const KRAKOW = 7;
const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];

// ---- Pure rules ----

const NEUTRAL: ModInput = {
  attacking: false,
  genAtt: 0,
  genDef: 0,
  traits: 0,
  flags: 0,
  tech: techTotals(new Set()),
  exp: 0,
  planBp: 0,
  land: "plains",
  weather: "clear",
  river: 0,
  strait: false,
  fort: 0,
  entrench: 0,
  excessBp: 0,
  supplyPm: 1000,
  encircled: false,
  airBp: 0,
  fuelBp: 0,
  landingBp: 0,
  coastalFortBp: 0,
  shoreBp: 0,
  fmAtt: 0,
  fmDef: 0,
  fmTraits: 0,
  cmdAttBp: 0,
  cmdDefBp: 0,
  enemyPlanCutBp: 0,
  fortCut: 0,
  halfSupply: false,
  designFlags: 0,
  artSoftPm: 0,
  fmPlanBp: 0,
};
const lineBp = (m: ModInput, id: string) =>
  divisionMods(m).defenseLines.find((l) => l.id === id)?.bp ?? 0;

describe("ww7 B2: defence values", () => {
  test("entrenchment and position are +5% a level for the defender only", () => {
    expect(ENTRENCH_DEF_BP).toBe(500);
    expect(POSITION_DEF_BP).toBe(500);
    for (let lv = 1; lv <= 10; lv++) {
      expect(lineBp({ ...NEUTRAL, entrench: lv }, "entrench")).toBe(lv * 500);
    }
    for (let lv = 1; lv <= 3; lv++) {
      expect(lineBp({ ...NEUTRAL, posLevel: lv }, "position")).toBe(lv * 500);
    }
    expect(lineBp(NEUTRAL, "position")).toBe(0);
    // Together they add: entrench 5 and position 3 are +40%.
    expect(
      divisionMods({ ...NEUTRAL, entrench: 5, posLevel: 3 }).mods.defenseBp,
    ).toBe(14_000);
    // An attacker has neither.
    const att = divisionMods({
      ...NEUTRAL,
      attacking: true,
      entrench: 5,
      posLevel: 3,
    });
    expect(att.defenseLines.map((l) => l.id)).not.toContain("position");
    expect(att.defenseLines.map((l) => l.id)).not.toContain("entrench");
  });

  test("a fort of level 3 or more halves the extra width of the extra directions", () => {
    expect(FORT_HALF_WIDTH_FROM).toBe(3);
    for (const t of Object.keys(TERRAIN) as LandTerrain[]) {
      const { width, perDirection } = TERRAIN[t];
      for (let d = 1; d <= 4; d++) {
        const full = width + perDirection * (d - 1);
        expect(combatWidth(t, d), `${t} ${d}`).toBe(full);
        expect(combatWidth(t, d, 2), `${t} ${d} fort 2`).toBe(full);
        expect(combatWidth(t, d, 3), `${t} ${d} fort 3`).toBe(
          width + Math.floor((perDirection * (d - 1)) / 2),
        );
        expect(combatWidth(t, d, 5)).toBe(combatWidth(t, d, 3));
      }
    }
    // One direction has no extra width to halve.
    expect(combatWidth("plains", 1, 5)).toBe(90);
    expect(combatWidth("plains", 3, 3)).toBe(135);
    expect(combatWidth("plains", 3)).toBe(180);
  });

  test("urban defenders take 15% less org damage", () => {
    expect(defenderOrgDamage("urban", 1000)).toBe(850);
    expect(defenderOrgDamage("urban", 7)).toBe(5);
    expect(defenderOrgDamage("urban", 0)).toBe(0);
    for (const t of Object.keys(TERRAIN) as LandTerrain[]) {
      if (t !== "urban") expect(defenderOrgDamage(t, 1000)).toBe(1000);
    }
  });

  test("the prediction knows the urban cut and the fort's width", () => {
    const side = (n: number, org: number) => ({
      divisions: n,
      width: 20 * n,
      soft: 100 * n,
      hard: 10 * n,
      def: 200 * n,
      brk: 100 * n,
      armor: 0,
      pierce: 0,
      hardnessPm: 100,
      orgMilli: org * n,
      hpMilli: 1000 * n,
    });
    const ctx = (l: LandTerrain, fort?: number) => ({
      land: l,
      directions: 3,
      ...(fort === undefined ? {} : { fort }),
      attackerAttackBp: 10_000,
      attackerBlockBp: 10_000,
      defenderAttackBp: 10_000,
      defenderBlockBp: 10_000,
    });
    const att = side(12, 60_000);
    const def = side(4, 60_000);
    // Three directions on plains are 180 wide; with a fort 135: fewer
    // attackers in line, so the defenders lose org more slowly.
    const open = predictBattle(att, def, ctx("plains"));
    const forted = predictBattle(att, def, ctx("plains", 3));
    expect(forted.ratioPm).toBeLessThan(open.ratioPm);
    expect(predictBattle(att, def, ctx("plains", 2)).ratioPm).toBe(
      open.ratioPm,
    );
  });
});

describe("ww7 B2: positions (stepPosition)", () => {
  /** Days of standing until the level reaches `lv`; -1 if never within 60. */
  function daysTo(lv: number, zone: boolean, river: boolean): number {
    let s = { level: 0, days: 0 };
    for (let d = 1; d <= 60; d++) {
      s = stepPosition(s.level, s.days, true, zone, river);
      if (s.level >= lv) return d;
    }
    return -1;
  }

  test("a region qualifies after 5 days and then builds a level every 5, up to 3", () => {
    expect(POS_STEP_DAYS).toBe(5);
    expect(POS_MAX_LEVEL).toBe(3);
    expect([1, 2, 3].map((lv) => daysTo(lv, false, false))).toEqual([
      10, 15, 20,
    ]);
    let s = { level: 0, days: 0 };
    for (let d = 1; d <= 9; d++) {
      s = stepPosition(s.level, s.days, true, false, false);
    }
    expect(s).toEqual({ level: 0, days: 9 });
    // The cap: nothing more to count.
    s = { level: 3, days: 0 };
    for (let d = 1; d <= 9; d++) {
      s = stepPosition(s.level, s.days, true, false, false);
    }
    expect(s).toEqual({ level: 3, days: 0 });
  });

  test("a Defend zone builds twice as fast", () => {
    expect([1, 2, 3].map((lv) => daysTo(lv, true, false))).toEqual([5, 8, 10]);
  });

  test("a region fronted by rivers starts at level 1 after 5 days", () => {
    expect([1, 2, 3].map((lv) => daysTo(lv, false, true))).toEqual([5, 10, 15]);
    expect([1, 2, 3].map((lv) => daysTo(lv, true, true))).toEqual([3, 5, 8]);
  });

  test("the level stays when it stands empty, until the fifth empty day", () => {
    expect(POS_EMPTY_DAYS).toBe(5);
    let s = { level: 2, days: 3 };
    for (let d = 1; d < POS_EMPTY_DAYS; d++) {
      s = stepPosition(s.level, s.days, false, false, false);
      expect(s.level).toBe(2);
    }
    expect(s).toEqual({ level: 2, days: -4 });
    s = stepPosition(s.level, s.days, false, false, false);
    expect(s).toEqual({ level: 0, days: 0 });
    // Back on the fourth day: kept, and the count towards the next starts over.
    s = { level: 2, days: -3 };
    s = stepPosition(s.level, s.days, true, false, false);
    expect(s).toEqual({ level: 2, days: 1 });
    // Nothing built yet and nobody there: the standing starts over.
    expect(stepPosition(0, 4, false, false, false)).toEqual({
      level: 0,
      days: 0,
    });
  });
});

// ---- The simulation ----

/** Germany and Poland human (nothing moves), past the prep minute, the board cleared. */
async function posBoard() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  clearLand(g);
  for (const tag of ["DEU", "POL"] as const) {
    const ce = land(g).econ.country(byTag(g, tag).smallID())!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
  }
  return {
    runner,
    g,
    l: land(g),
    ww: g.worldWar()!,
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
    sun: byTag(g, "SUN").smallID(),
  };
}

function days(l: WwLand, id: number, n: number): void {
  for (let i = 0; i < n; i++) dailyPositions(l, id);
}

describe("ww7 B2: positions in the war", () => {
  test("standing divisions build, the position stays when they change, goes when the region changes hands", async () => {
    const { g, l, deu, pol } = await posBoard();
    const a = placeArmy(g, "POL", WARSAW, 1);
    days(l, pol, 9);
    expect([l.posLevel[WARSAW], l.posDays[WARSAW]]).toEqual([0, 9]);
    days(l, pol, 1);
    expect([l.posLevel[WARSAW], l.posDays[WARSAW]]).toEqual([1, 0]);
    days(l, pol, 5);
    expect(l.posLevel[WARSAW]).toBe(2);
    // The defender fights with the +5% line.
    const t = l.divisions;
    const row = t.rowOf(a.divisions[0]);
    expect(modInputOf(l, row, WARSAW, false).posLevel).toBe(2);
    expect(modInputOf(l, row, WARSAW, true).posLevel).toBe(0);
    // Other divisions take over: the position is the region's.
    l.killDivision(row, false);
    placeArmy(g, "POL", WARSAW, 1);
    days(l, pol, 1);
    expect(l.posLevel[WARSAW]).toBe(2);
    // A level a day is not built by a division on the move.
    const m = placeArmy(g, "POL", KRAKOW, 1);
    const mrow = t.rowOf(m.divisions[0]);
    t.mode[mrow] = MOVE_WALK;
    days(l, pol, 6);
    expect(l.posLevel[KRAKOW]).toBe(0);
    // The region changes hands: gone, with the count.
    l.setController(WARSAW, deu, g.ticks());
    expect([l.posLevel[WARSAW], l.posDays[WARSAW]]).toEqual([0, 0]);
  }, 60_000);

  test("an empty region keeps its position for four days and loses it on the fifth", async () => {
    const { g, l, pol } = await posBoard();
    const a = placeArmy(g, "POL", WARSAW, 1);
    days(l, pol, 15);
    expect(l.posLevel[WARSAW]).toBe(2);
    l.killDivision(l.divisions.rowOf(a.divisions[0]), false);
    days(l, pol, 4);
    expect(l.posLevel[WARSAW]).toBe(2);
    days(l, pol, 1);
    expect([l.posLevel[WARSAW], l.posDays[WARSAW]]).toEqual([0, 0]);
  }, 60_000);

  test("a Defend zone region builds twice as fast", async () => {
    const { g, l, pol } = await posBoard();
    const a = placeArmy(g, "POL", WARSAW, 1);
    a.order = { ...idleOrder(), kind: "front", anchor: WARSAW };
    a.front = [WARSAW];
    days(l, pol, 4);
    expect(l.posLevel[WARSAW]).toBe(0);
    days(l, pol, 1);
    expect(l.posLevel[WARSAW]).toBe(1);
    // An army that does not hold the region in its zone does not.
    const b = placeArmy(g, "POL", KRAKOW, 1);
    b.order = { ...idleOrder(), kind: "front", anchor: WARSAW };
    b.front = [WARSAW];
    days(l, pol, 5);
    expect(l.posLevel[KRAKOW]).toBe(0);
  }, 60_000);

  test("a region whose every edge to the enemy crosses a river starts at level 1", async () => {
    const { g, l, ww, pol, sun } = await posBoard();
    placeArmy(g, "POL", WARSAW, 1);
    placeArmy(g, "POL", KRAKOW, 1);
    // Only the Soviet Union is at war with Poland: Warsaw meets it over a
    // small river, Krakow over a big one.
    ww.setWar(sun, pol, g.ticks());
    days(l, pol, 5);
    expect([l.posLevel[WARSAW], l.posLevel[KRAKOW]]).toEqual([1, 1]);
    // Also at war with Germany, Warsaw borders Berlin and Munich with no
    // river; Krakow borders Munich too.
    const b = await posBoard();
    placeArmy(b.g, "POL", WARSAW, 1);
    b.ww.setWar(b.deu, b.pol, b.g.ticks());
    days(b.l, b.pol, 5);
    expect(b.l.posLevel[WARSAW]).toBe(0);
  }, 60_000);

  test("the daily step runs with the country's day", async () => {
    const { runner, g, l, ww, pol } = await posBoard();
    placeArmy(g, "POL", WARSAW, 1);
    for (let d = 0; d < 10; d++) {
      stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS) + 1);
    }
    expect(l.posLevel[WARSAW]).toBe(1);
    expect(l.armiesOf(pol).length).toBe(1);
    // The screens see it.
    expect(l.regionData(WARSAW).pos).toBe(1);
  }, 120_000);
});

// ---- Battles ----

async function juneWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  for (const tag of ["DEU", "POL"] as const) {
    const ce = land(g).econ.country(byTag(g, tag).smallID())!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
  }
  return { runner, g, l: land(g) };
}

/** Spec §9.10's German infantry division, "infantry 7 · artillery 2" (width 20). */
function specInfantry(l: WwLand, deu: number): number {
  const cl = l.country(deu)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: "7-2",
      battalions: [
        ...new Array<"infantry">(7).fill("infantry"),
        "artillery",
        "artillery",
      ],
      support: [],
    },
  });
  return id;
}

const attack = (l: WwLand, a: Army, region: number) => {
  for (const id of a.divisions) joinBattle(l, id, region);
};

describe("ww7 B2: forts and cities in battle", () => {
  test("a fort of level 3 narrows the line seven attackers from two directions get", async () => {
    const { g, l } = await juneWar();
    const deu = byTag(g, "DEU").smallID();
    const inf72 = specInfantry(l, deu);
    const north = placeArmy(g, "DEU", BERLIN, 4, inf72);
    const south = placeArmy(g, "DEU", MUNICH, 3, inf72);
    placeArmy(g, "POL", WARSAW, 5);
    l.econ.buildingArray("fort")[WARSAW] = 2;
    attack(l, north, WARSAW);
    attack(l, south, WARSAW);
    const b = l.battles.get(WARSAW)!;
    expect(b.attackers).toHaveLength(7);
    // Level 2: the whole 135 (spec §9.10).
    expect(l.battleSummary(b).width).toBe(135);
    // Level 3: 90 + 45 ÷ 2.
    l.econ.buildingArray("fort")[WARSAW] = 3;
    const s = l.battleSummary(b);
    expect([s.directions, s.width]).toEqual([2, 112]);
    stepBattles(l, g.ticks());
    // Five fill 100, a sixth still stands with a third of its width left, a seventh waits.
    expect(b.attLine).toHaveLength(6);
  }, 60_000);

  test("the defenders of an urban region take 15% less org damage", async () => {
    // Warsaw as a city: the scenario's terrain for the region.
    const files = await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const scenario = structuredClone(files.scenario!);
    scenario.regions.find((r) => r.name === "Warsaw")!.land = "urban";
    const runner = await createGameRunner(
      wwGameStart({}, DEU_POL),
      undefined,
      { ...files, scenario },
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g: Game = runner.game;
    dropPact(g, "DEU", "POL");
    stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
    step(runner, 2, [
      stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
    ]);
    clearLand(g);
    const l = land(g);
    expect(l.scenario.landOf(WARSAW)).toBe("urban");
    for (const tag of ["DEU", "POL"] as const) {
      const ce = l.econ.country(byTag(g, tag).smallID())!;
      for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
      ce.manpower += 1_000_000;
    }
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    attack(l, a, WARSAW);
    const t = l.divisions;
    const [ar, dr] = [t.rowOf(a.divisions[0]), t.rowOf(d.divisions[0])];
    // What a round deals, from the same numbers the battle reads.
    const sa = l.statsOf(ar);
    const sd = l.statsOf(dr);
    const am = modsOf(l, ar, WARSAW, true);
    const dm = modsOf(l, dr, WARSAW, false);
    const toDef = roundDamage(
      roundHits(
        applyBp(
          applyBp(attackValue(sa.soft, sa.hard, sd.hardnessPm), am.attackBp),
          10_000,
        ),
        applyBp(sd.def, dm.defenseBp),
      ),
      sd.armor > sa.pierce,
    ).orgMilli;
    const toAtt = roundDamage(
      roundHits(
        applyBp(
          applyBp(attackValue(sd.soft, sd.hard, sa.hardnessPm), dm.attackBp),
          10_000,
        ),
        applyBp(sa.brk, am.defenseBp),
      ),
      sa.armor > sd.pierce,
    ).orgMilli;
    expect(toDef).toBeGreaterThan(100);
    const [a0, d0] = [t.org[ar], t.org[dr]];
    stepBattles(l, g.ticks());
    expect(d0 - t.org[dr]).toBe(Math.floor((toDef * 85) / 100));
    expect(d0 - t.org[dr]).toBeLessThan(toDef);
    // The attackers get no such cut.
    expect(a0 - t.org[ar]).toBe(toAtt);
  }, 60_000);
});

// ---- Capitulation ----

describe("ww7 B2: capitulation", () => {
  test("the gauge: 1 + one for every 5 points over the line a day, 45 to fill", () => {
    expect(WW_CAPITULATION_DAYS).toBe(45);
    // 24 points, a line of 80: 19.2 lost is the line.
    const stepOf = (lost: number) => capitulationStep(lost, 24, 80);
    expect(stepOf(20)).toBe(1); // 83.3%: 3.3 over
    expect(stepOf(21)).toBe(2); // 87.5%: 7.5 over
    expect(stepOf(22)).toBe(3); // 91.7%: 11.7 over
    expect(stepOf(23)).toBe(4); // 95.8%: 15.8 over
    expect(stepOf(24)).toBe(5); // 100%: 20 over
    // Exactly at the line.
    expect(capitulationStep(80, 100, 80)).toBe(1);
    expect(capitulationStep(85, 100, 80)).toBe(2);
    expect(capitulationStep(84, 100, 80)).toBe(1);
    expect(capitulationStep(100, 100, 95)).toBe(2);
    // Barely over: 45 days; far over: 9.
    expect(Math.ceil(45 / stepOf(20))).toBe(45);
    expect(Math.ceil(45 / stepOf(24))).toBe(9);
  });

  test("holding the capital adds 15 points to the line, at most 95", () => {
    expect(WW_CAPITAL_LINE_MAX).toBe(95);
    expect(withCapitalPct(80, true)).toBe(95);
    expect(withCapitalPct(60, true)).toBe(75);
    expect(withCapitalPct(85, true)).toBe(95);
    expect(withCapitalPct(95, true)).toBe(95);
    // A line already above stays; it is not cut to 95.
    expect(withCapitalPct(98, true)).toBe(98);
    expect(withCapitalPct(80, false)).toBe(80);
  });

  test("France's floor is 25 (the others keep ten under their base, at most 50)", () => {
    expect(COUNTRIES.FRA.surrenderFloorPct).toBe(25);
    expect(effectiveSurrenderPct(31, 0, 0, 0, 25)).toBe(25);
    expect(effectiveSurrenderPct(31, 0, 0, 0)).toBe(21);
    expect(effectiveSurrenderPct(31, 5000, 5000, 0, 25)).toBe(31);
    for (const [tag, c] of Object.entries(COUNTRIES)) {
      if (tag !== "FRA") expect(c.surrenderFloorPct, tag).toBeUndefined();
    }
  });

  test("the line in the war: capital held, capital lost, France's floor", async () => {
    const runner = await wwRunner({}, DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, fra] = (["DEU", "POL", "FRA"] as const).map((t) =>
      byTag(g, t),
    );
    const pc = ww.politics.country(pol.smallID())!;
    const base = effectiveSurrenderPct(
      COUNTRIES.POL.surrenderPct,
      pc.stabBp,
      pc.wsBp,
      pc.stats.surrenderPp,
    );
    expect(holdsCapital(g, ww, pol.smallID())).toBe(true);
    expect(ww.politics.surrenderPct(pol.smallID())).toBe(
      Math.min(95, base + 15),
    );
    // Warsaw falls.
    ww.land.setController(WARSAW, deu.smallID(), g.ticks());
    expect(holdsCapital(g, ww, pol.smallID())).toBe(false);
    expect(ww.politics.surrenderPct(pol.smallID())).toBe(base);
    // France at its lowest stability and war support: the floor of 25, and
    // 40 with Paris.
    const fc = ww.politics.country(fra.smallID())!;
    fc.stabBp = 0;
    fc.wsBp = 0;
    fc.stats.surrenderPp = 0;
    expect(ww.politics.surrenderPct(fra.smallID())).toBe(40);
    ww.land.setController(1, deu.smallID(), g.ticks());
    expect(ww.politics.surrenderPct(fra.smallID())).toBe(25);
  }, 60_000);
});
