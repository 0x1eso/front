// World War 1936 P2 (plan Task 3 Step 5): readiness and battle plans on
// the test map (P2 spec §8.2, §8.3) — readiness growth and its cap, a plan
// attacking only toward its targets, the plan ending when they are ours,
// and the engine's attack preview.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_WALK } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addToSide,
  divisionMods,
  emptySide,
  predictBattle,
} from "@openfront/engine-lib/ww1936/CombatRules";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { modInputOf } from "@openfront/engine/ww1936/land/Battles";
import { predictAttack } from "@openfront/engine/ww1936/land/Plans";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  grantDoctrineStats,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

/** Germany's front army before the war, its order given after its day's step. */
async function frontArmy(divisions = 3) {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  const l = land(g);
  stepTo(runner, WW_PREP_TICKS + 1);
  clearLand(g);
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  const a = placeArmy(g, "DEU", 3, divisions);
  const d0 = today(g);
  finishDay(runner, d0);
  expect(
    l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
  ).toBe(null);
  return { runner, g, l, a, d0, ce: l.econ.country(deu)! };
}

/** Germany at war with Poland, a 6-division army in Berlin. */
async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  return {
    runner,
    g,
    l: land(g),
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
    a: placeArmy(g, "DEU", 3, 6),
  };
}

const rowsOf = (g: Game, a: Army) =>
  a.divisions.map((id) => land(g).divisions.rowOf(id));

describe("World War 1936 P2: readiness (P2 spec §8.3)", () => {
  test("readiness grows 1% a day to 30%", async () => {
    const { runner, a, d0, ce } = await frontArmy();
    expect(ce.tech.planSpeedPct).toBe(0);
    expect(a.planBp).toBe(0);
    finishDay(runner, d0 + 10);
    expect(a.planBp).toBe(1000);
    finishDay(runner, d0 + 40);
    expect(a.planBp).toBe(3000);
    finishDay(runner, d0 + 45);
    expect(a.planBp).toBe(3000);
  });

  test("the battle-plan doctrine's planMaxBp lifts the cap to 40%", async () => {
    const { runner, g, a, d0, ce } = await frontArmy();
    // P6 plan decision 25: battleplan_1 is retired and adds nothing; the
    // doctrine's stat key comes through the depth stats part (lane D fills
    // GRAND_DOCTRINE_STATS' share of it).
    ce.addTech("battleplan_1");
    expect(ce.stats.planMaxBp).toBe(0);
    grantDoctrineStats(g.worldWar()!, ce.smallID, { planMaxBp: 1000 });
    expect(ce.stats.planMaxBp).toBe(1000);
    finishDay(runner, d0 + 40);
    expect(a.planBp).toBe(4000);
    finishDay(runner, d0 + 45);
    expect(a.planBp).toBe(4000);
  });

  test("a general's planning speeds it, another front starts it over", async () => {
    const { runner, g, l, a, d0 } = await frontArmy();
    // Rundstedt (planning 3): +130 bp a day.
    a.general = 1;
    expect(l.country(a.owner)!.generals.find((x) => x.id === 1)!.plan).toBe(3);
    finishDay(runner, d0 + 10);
    expect(a.planBp).toBe(1300);
    // The same front (the anchor on it) keeps it; another enemy resets it.
    const deu = a.owner;
    const pol = byTag(g, "POL").smallID();
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
    ).toBe(null);
    expect(a.planBp).toBe(1300);
    const fra = byTag(g, "FRA").smallID();
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: fra }),
    ).toBe(null);
    expect(a.planBp).toBe(0);
  });
});

describe("World War 1936 P2: battle plans (P2 spec §8.2)", () => {
  test("an executing plan attacks only toward its targets", async () => {
    const { runner, g, l, deu, pol, a } = await atWar();
    // Warsaw empty, two Polish divisions in Krakow.
    placeArmy(g, "POL", 7, 2);
    expect(
      l.issue(deu, {
        kind: "army_plan",
        army: a.id,
        targets: [6],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(a.order.executing).toBe(false);
    expect(l.issue(deu, { kind: "army_execute", army: a.id, on: true })).toBe(
      null,
    );
    step(runner);
    // The front toward Warsaw: anchor Berlin (nearest it), against Poland.
    expect(a.order.anchor).toBe(3);
    expect(a.order.enemy).toBe(pol);
    expect(a.front).toEqual([3, 4]);
    const t = l.divisions;
    const into = (region: number) =>
      rowsOf(g, a).filter(
        (r) => t.mode[r] === MOVE_WALK && t.next[r] === region,
      );
    expect(into(6)).toHaveLength(1);
    const d = today(g);
    for (let i = 0; i < 300 && l.controller[6] !== deu; i++) {
      step(runner);
      expect(into(7)).toEqual([]);
      expect(rowsOf(g, a).every((r) => t.region[r] !== 7)).toBe(true);
    }
    expect(l.controller[6]).toBe(deu);
    // Krakow, off the way to Warsaw, was never walked into.
    finishDay(runner, Math.max(d, today(g)) + 3);
    expect(into(7)).toEqual([]);
    expect(l.controller[7]).toBe(pol);
  });

  test("the plan ends when its targets are ours", async () => {
    const { runner, g, l, deu, a } = await atWar();
    placeArmy(g, "POL", 6, 1);
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 6 })).toBe(
      null,
    );
    expect(a.order.kind).toBe("plan");
    expect(a.order.stance).toBe("aggressive");
    expect(a.order.executing).toBe(true);
    step(runner);
    expect(a.order.executing).toBe(true);
    takeRegion(g, 6, "DEU");
    finishDay(runner, today(g) + 1);
    expect(a.order.kind).toBe("plan");
    expect(a.order.executing).toBe(false);
    // The army holds its (new) front.
    expect(a.front.length).toBeGreaterThan(0);
  });

  test("an attack on another country's region draws a front toward it", async () => {
    const { runner, g, l, deu, pol, a } = await atWar();
    placeArmy(g, "POL", 6, 1);
    const fra = byTag(g, "FRA").smallID();
    // A front against France (no war), with readiness.
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: fra }),
    ).toBe(null);
    step(runner);
    a.planBp = 500;
    // Warsaw is Poland's: a front against Poland, from Berlin (its nearest
    // border region), readiness from 0.
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 6 })).toBe(
      null,
    );
    expect(a.order.enemy).toBe(pol);
    expect(a.order.anchor).toBe(3);
    expect(a.planBp).toBe(0);
    step(runner);
    expect(a.front).toEqual([3, 4]);
    // A plan on the same front keeps its front and readiness.
    a.planBp = 700;
    expect(
      l.issue(deu, {
        kind: "army_plan",
        army: a.id,
        targets: [7],
        stance: "careful",
      }),
    ).toBe(null);
    expect([a.order.anchor, a.order.enemy, a.planBp]).toEqual([3, pol, 700]);
    expect(a.order.executing).toBe(false);
  });

  test("the preview counts directions and only the defenders at war", async () => {
    const { g, l, a } = await atWar();
    const [rB] = rowsOf(g, a);
    const m = placeArmy(g, "DEU", 4, 1);
    const [rM] = rowsOf(g, m);
    // Nobody in Warsaw, or only Soviets (not at war with us): no defence.
    expect(predictAttack(l, [rB], 6).ratioPm).toBe(1_000_000);
    placeArmy(g, "SUN", 6, 1);
    expect(predictAttack(l, [rB], 6).ratioPm).toBe(1_000_000);
    const p = placeArmy(g, "POL", 6, 1);
    const [rP] = rowsOf(g, p);
    const want = (rows: number[], dirs: number) => {
      const att = emptySide();
      for (const r of rows) addToSide(att, l.statsOf(r), l.divisions.org[r]);
      const def = emptySide();
      addToSide(def, l.statsOf(rP), l.divisions.org[rP]);
      const am = divisionMods(modInputOf(l, rows[0], 6, true)).mods;
      const dm = divisionMods(modInputOf(l, rP, 6, false)).mods;
      return predictBattle(att, def, {
        land: "plains",
        directions: dirs,
        attackerAttackBp: am.attackBp,
        attackerBlockBp: am.defenseBp,
        defenderAttackBp: dm.attackBp,
        defenderBlockBp: dm.defenseBp,
      });
    };
    expect(predictAttack(l, [rB], 6)).toEqual(want([rB], 1));
    // From Berlin and Munich: two directions.
    expect(predictAttack(l, [rB, rM], 6)).toEqual(want([rB, rM], 2));
    expect(predictAttack(l, [rB, rM], 6).ratioPm).toBeGreaterThan(
      predictAttack(l, [rB], 6).ratioPm,
    );
    expect(predictAttack(l, [], 6).ratioPm).toBe(0);
  });
});
