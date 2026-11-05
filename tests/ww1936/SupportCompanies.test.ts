// ww98: what the support companies do. The rules are checked on the pure
// functions; what only a fight can show (the guns' wear) runs real rounds. The
// fit itself is `duel-fit.ts --plan --only deep`; the report has its table.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  idleOrder,
  MOVE_NONE,
  SideSum,
  SupportId,
  TPL_ENGINEER,
  TPL_LOGISTICS,
  TPL_RECON,
  TPL_SUPPORT_AA,
  TPL_SUPPORT_AT,
  TPL_SUPPORT_GUNS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addToSide,
  casCutHits,
  divisionMods,
  emptySide,
  ENGINEER_PREP_CUT_MAX_PM,
  ENGINEER_PREP_CUT_PM,
  engineerCutPm,
  ENTRENCH_DEF_BP,
  ENTRENCH_WEAR_MAX,
  ENTRENCH_WEAR_ROUNDS,
  entrenchBp,
  entrenchMax,
  fearTakenPct,
  FORT_ATTACK_BP,
  ModInput,
  POSITION_DEF_BP,
  predictBattle,
  predictBattleRange,
  prepLeftBp,
  RIVER_ATTACK_BP,
  sideFearPct,
  TANK_FEAR_PCT,
} from "@openfront/engine-lib/ww1936/CombatRules";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Game } from "@openfront/engine/game/Game";
import {
  closeBattle,
  dailyEntrench,
  joinBattle,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import { predictAttack } from "@openfront/engine/ww1936/land/Plans";
import { attritionPpm } from "@openfront/engine/ww1936/land/Sustain";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { describe, expect, test } from "vitest";
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
  wwRunner,
} from "./util";

const WARSAW = 6;
const BERLIN = 3;
const ZERO = techTotals(new Set());
const INF: BattalionId[] = new Array<BattalionId>(9).fill("infantry");

const stats = (
  support: readonly SupportId[] = [],
  battalions: readonly BattalionId[] = INF,
) =>
  templateStats(
    { name: "", battalions: [...battalions], support: [...support] },
    ZERO,
    GEN1,
  );

function input(o: Partial<ModInput> = {}): ModInput {
  return {
    attacking: false,
    genAtt: 0,
    genDef: 0,
    traits: 0,
    flags: 0,
    tech: ZERO,
    exp: 0,
    planBp: 0,
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
    ...o,
  };
}

const lineOf = (ls: { id: string; bp: number }[], id: string) =>
  ls.find((l) => l.id === id)?.bp;

function side(n: number, s: ReturnType<typeof stats>): SideSum {
  const sum = emptySide();
  for (let i = 0; i < n; i++) addToSide(sum, s, s.orgMilli);
  return sum;
}

/** A deep line's prediction: `att` on infantry with entrench 10 and positions 3. */
function deepRatio(att: SideSum, entrench = 10): number {
  return predictBattle(att, side(5, stats()), deepCtx(entrench)).ratioPm;
}

function deepCtx(entrench = 10) {
  const m = divisionMods(input({ entrench, posLevel: 3 })).mods;
  return {
    land: "plains" as const,
    directions: 1,
    attackerAttackBp: 10_000,
    attackerBlockBp: 10_000,
    defenderAttackBp: 10_000,
    defenderBlockBp: m.defenseBp,
    defenderPrepBp: m.prepBp,
    defenderPosBp: m.posBp,
    defenderEntrench: entrench,
  };
}

/** DEU and POL at war, the land cleared, stock for full divisions. */
async function war() {
  const runner = await wwRunner({}, [
    { clientID: HUMAN, country: "DEU" },
    { clientID: "HUMAN002", country: "POL" },
  ]);
  const g: Game = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  const l = land(g);
  for (const tag of ["DEU", "POL"] as const) {
    const ce = l.econ.country(byTag(g, tag).smallID())!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
  }
  return { runner, g, l };
}

function template(
  g: Game,
  tag: "DEU" | "POL",
  support: readonly SupportId[],
): number {
  const cl = land(g).country(byTag(g, tag).smallID())!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: { name: `t${id}`, battalions: [...INF], support: [...support] },
  });
  return id;
}

/** Attackers with `support` on two defenders at entrench `dug`; `plain` more without it. */
async function shelled(
  support: readonly SupportId[],
  n = 4,
  plain = 0,
  dug = 8,
) {
  const { g, l } = await war();
  const a = placeArmy(g, "DEU", BERLIN, n, template(g, "DEU", support));
  const b =
    plain > 0
      ? placeArmy(g, "DEU", BERLIN, plain, template(g, "DEU", []))
      : null;
  const d = placeArmy(g, "POL", WARSAW, 2, template(g, "POL", []));
  for (const x of [a, b, d]) {
    if (x !== null) {
      x.order = idleOrder();
      x.general = 0;
    }
  }
  const t = l.divisions;
  for (const id of d.divisions) t.entrench[t.rowOf(id)] = dug;
  for (const id of [...a.divisions, ...(b?.divisions ?? [])]) {
    joinBattle(l, id, WARSAW);
  }
  const level = () => t.entrench[t.rowOf(d.divisions[0])];
  /** Runs `rounds` rounds with the defenders' org kept up, so the battle lasts. */
  const fight = (rounds: number) => {
    for (let i = 0; i < rounds; i++) {
      for (const id of d.divisions) t.org[t.rowOf(id)] = 60_000;
      for (const id of [...a.divisions, ...(b?.divisions ?? [])]) {
        t.org[t.rowOf(id)] = 60_000;
      }
      stepBattles(l, g.ticks() + i);
    }
  };
  return { g, l, t, level, fight, d, a };
}

function polId(g: Game): number {
  return byTag(g, "POL").smallID();
}

/** The country digs at the base rate (a start's research would make it a level a day). */
function noDigResearch(l: WwLand, id: number): void {
  const st = l.econ.country(id)!.stats as unknown as Record<string, number>;
  st.entrenchSpeedPct = 0;
}

function stand(l: WwLand, row: number, days: number, id: number) {
  const t = l.divisions;
  for (let i = 0; i < days; i++) {
    expect(t.mode[row]).toBe(MOVE_NONE);
    dailyEntrench(l, id);
  }
}

describe("entrenchment: the deep levels", () => {
  test("from level 6 each level gives half", () => {
    expect(entrenchBp(1)).toBe(ENTRENCH_DEF_BP);
    expect(entrenchBp(5)).toBe(12_500);
    expect(entrenchBp(6)).toBe(13_750);
    expect(entrenchBp(10)).toBe(18_750);
    expect(entrenchBp(12)).toBe(21_250);
  });

  test("the card's line is the total, one figure", () => {
    const m = divisionMods(input({ entrench: 8, posLevel: 2 }));
    expect(lineOf(m.defenseLines, "entrench")).toBe(16_250);
    expect(lineOf(m.defenseLines, "position")).toBe(2 * POSITION_DEF_BP);
    expect(m.mods.prepBp).toBe(16_250 + 5000);
    expect(m.mods.posBp).toBe(5000);
  });
});

describe("engineers", () => {
  test("attacking, enemy entrenchment and position count 30 % less", () => {
    expect(prepLeftBp(10_000, 2500, TPL_ENGINEER, 0, 300)).toBe(7000);
    expect(stats(["engineer"]).engineerCutPm).toBe(ENGINEER_PREP_CUT_PM);
    expect(stats().engineerCutPm).toBe(0);
  });

  test("the defence line is gone, what else they did stays", () => {
    const m = divisionMods(input({ flags: TPL_ENGINEER }));
    expect(lineOf(m.defenseLines, "engineer")).toBeUndefined();
    expect(m.mods.defenseBp).toBe(10_000);
    const att = (flags: number) =>
      divisionMods(input({ attacking: true, flags, river: 2, fort: 2 }));
    expect(lineOf(att(TPL_ENGINEER).attackLines, "river")).toBe(
      RIVER_ATTACK_BP[2] / 2,
    );
    expect(lineOf(att(TPL_ENGINEER).attackLines, "fort")).toBe(
      (FORT_ATTACK_BP * 2 * 75) / 100,
    );
    expect(entrenchMax(TPL_ENGINEER, ZERO)).toBe(entrenchMax(0, ZERO) + 5);
  });

  test("research scales the cut, up to its cap", () => {
    expect(engineerCutPm(TPL_ENGINEER, 50)).toBe(450);
    expect(engineerCutPm(TPL_ENGINEER, 100)).toBe(ENGINEER_PREP_CUT_MAX_PM);
    expect(engineerCutPm(0, 100)).toBe(0);
  });

  test("they dig a level a day, others one in two", async () => {
    const { g, l } = await war();
    const t = l.divisions;
    const pol = polId(g);
    noDigResearch(l, pol);
    const plain = placeArmy(g, "POL", WARSAW, 1, template(g, "POL", []));
    const eng = placeArmy(
      g,
      "POL",
      WARSAW,
      1,
      template(g, "POL", ["engineer"]),
    );
    const r0 = t.rowOf(plain.divisions[0]);
    const r1 = t.rowOf(eng.divisions[0]);
    stand(l, r0, 4, pol);
    expect(t.entrench[r0]).toBe(2);
    expect(t.entrench[r1]).toBe(4);
  });

  test("the prediction follows, by their share of the side", () => {
    const plain = stats();
    const eng = stats(["engineer"]);
    const none = deepRatio(side(10, plain));
    const half = side(5, plain);
    for (let i = 0; i < 5; i++) addToSide(half, eng, eng.orgMilli);
    // (Width-weighted step by step: floors take a point or two.)
    expect(half.engineerCutPm).toBeGreaterThan(140);
    expect(half.engineerCutPm).toBeLessThanOrEqual(ENGINEER_PREP_CUT_PM / 2);
    expect(deepRatio(half)).toBeGreaterThan(none);
    expect(deepRatio(side(10, eng))).toBeGreaterThan(deepRatio(half));
  });
});

describe("recon", () => {
  test("the enemy's position counts a tenth less, entrenchment not at all", () => {
    expect(prepLeftBp(10_000, 0, TPL_RECON, 0, 0)).toBe(10_000);
    expect(prepLeftBp(10_000, 5000, TPL_RECON, 0, 0)).toBe(9500);
  });

  test("with engineers the cuts follow each other", () => {
    expect(
      prepLeftBp(5000, 5000, TPL_ENGINEER | TPL_RECON, 0, ENGINEER_PREP_CUT_PM),
    ).toBe(3150);
  });

  test("the prediction counts it", () => {
    expect(deepRatio(side(10, stats(["recon"])))).toBeGreaterThan(
      deepRatio(side(10, stats())),
    );
  });

  test("a narrower range, on either side's recon, with the middle where it was", () => {
    const ctx = deepCtx(5);
    const widthOf = (att: SideSum, def: SideSum) => {
      const r = predictBattleRange(att, def, ctx);
      expect(r.lowPm).toBeLessThanOrEqual(r.midPm);
      expect(r.midPm).toBeLessThanOrEqual(r.highPm);
      return (r.highPm - r.lowPm) / r.midPm;
    };
    const plain = widthOf(side(10, stats()), side(5, stats()));
    expect(widthOf(side(10, stats(["recon"])), side(5, stats()))).toBeLessThan(
      plain,
    );
    expect(widthOf(side(10, stats()), side(5, stats(["recon"])))).toBeLessThan(
      plain,
    );
  });
});

describe("support guns", () => {
  test("a level a stretch of rounds, at most three, and it stays", async () => {
    const { l, level, fight } = await shelled(["support_artillery"]);
    fight(ENTRENCH_WEAR_ROUNDS - 1);
    expect(level()).toBe(8);
    fight(1);
    expect(level()).toBe(7);
    fight(ENTRENCH_WEAR_ROUNDS * 10);
    expect(level()).toBe(8 - ENTRENCH_WEAR_MAX);
    expect(l.battles.get(WARSAW)?.wornLevels).toBe(ENTRENCH_WEAR_MAX);
    closeBattle(l, WARSAW);
    expect(level()).toBe(8 - ENTRENCH_WEAR_MAX);
  });

  test("more guns don't pass the rate, fewer take longer", async () => {
    const many = await shelled(["support_artillery"], 5);
    many.fight(ENTRENCH_WEAR_ROUNDS);
    expect(many.level()).toBe(7);
    const part = await shelled(["support_artillery"], 2, 2);
    part.fight(ENTRENCH_WEAR_ROUNDS);
    expect(part.level()).toBe(8);
    part.fight(ENTRENCH_WEAR_ROUNDS);
    expect(part.level()).toBe(7);
  });

  test("no guns, no wear; nothing written on the battle", async () => {
    const { l, level, fight } = await shelled([]);
    fight(ENTRENCH_WEAR_ROUNDS * 3);
    expect(level()).toBe(8);
    expect(l.battles.get(WARSAW)?.wornLevels).toBeUndefined();
    expect(l.battles.get(WARSAW)?.wearPm).toBeUndefined();
  });

  test("nobody digs under them; after the battle it rebuilds at the normal rate", async () => {
    const { g, l, t, d, level, fight } = await shelled(
      ["support_artillery"],
      4,
      0,
      4,
    );
    fight(ENTRENCH_WEAR_ROUNDS);
    expect(level()).toBe(3);
    const row = t.rowOf(d.divisions[0]);
    const id = polId(g);
    noDigResearch(l, id);
    t.stillDays[row] = 1;
    dailyEntrench(l, id);
    expect(level()).toBe(3);
    closeBattle(l, WARSAW);
    t.stillDays[row] = 1;
    dailyEntrench(l, id);
    expect(level()).toBe(4);
    dailyEntrench(l, id);
    expect(level()).toBe(4);
  });

  test("the battle's clock is in the snapshot's hash only when it runs", async () => {
    const { l, fight } = await shelled(["support_artillery"]);
    fight(3);
    const b = l.battles.get(WARSAW)!;
    expect(b.wearPm).toBe(3000);
    expect(b.wornLevels).toBeUndefined();
    const before = l.hash();
    b.wearPm = 4000;
    expect(l.hash()).not.toBe(before);
  });

  test("the prediction counts the wear, by the levels left to wear", () => {
    const guns = stats(["support_artillery"]);
    expect(guns.flags & TPL_SUPPORT_GUNS).not.toBe(0);
    const att = side(10, guns);
    expect(att.wearPm).toBe(1000);
    const without = { ...att, wearPm: 0 };
    expect(deepRatio(att)).toBeGreaterThan(deepRatio(without));
    const ctx = deepCtx();
    const def = side(5, stats());
    const worn = predictBattle(att, def, { ...ctx, wornLevels: 3 });
    expect(worn.ratioPm).toBe(predictBattle(without, def, ctx).ratioPm);
  });
});

describe("support anti-tank", () => {
  test("halves the tank fear its division takes", () => {
    expect(stats(["support_anti_tank"]).flags & TPL_SUPPORT_AT).not.toBe(0);
    expect(fearTakenPct(TANK_FEAR_PCT, TPL_SUPPORT_AT)).toBe(TANK_FEAR_PCT / 2);
    expect(fearTakenPct(TANK_FEAR_PCT, 0)).toBe(TANK_FEAR_PCT);
  });

  test("the prediction halves it by their share of the side", () => {
    const att = { ...emptySide(), armor: 30_000, armorMajorPm: 1000 };
    const def = side(4, stats());
    expect(sideFearPct(att, def, 0)).toBe(TANK_FEAR_PCT);
    expect(sideFearPct(att, { ...def, fearHalfPm: 1000 }, 0)).toBe(
      TANK_FEAR_PCT / 2,
    );
    expect(sideFearPct(att, { ...def, fearHalfPm: 500 }, 0)).toBe(
      23,
    );
  });
});

describe("support anti-air", () => {
  test("a fifth off close air support", () => {
    expect(stats(["support_anti_air"]).flags & TPL_SUPPORT_AA).not.toBe(0);
    expect(casCutHits(1000, 0, 0, TPL_SUPPORT_AA)).toBe(800);
    expect(casCutHits(1000, 0, 0, 0)).toBe(1000);
  });

  test("a quarter off the air superiority penalty, attacking and defending", () => {
    for (const attacking of [true, false]) {
      const m = divisionMods(
        input({ attacking, flags: TPL_SUPPORT_AA, airBp: -2000 }),
      );
      expect(lineOf(m.attackLines, "air")).toBe(-1500);
      expect(lineOf(m.defenseLines, "air")).toBe(-1500);
    }
    expect(
      lineOf(divisionMods(input({ airBp: -2000 })).attackLines, "air"),
    ).toBe(-2000);
  });
});

describe("field hospital and logistics", () => {
  test("a hospital takes a quarter off attrition", async () => {
    const { g, l } = await war();
    const t = l.divisions;
    const plain = placeArmy(g, "DEU", BERLIN, 1, template(g, "DEU", []));
    const care = placeArmy(
      g,
      "DEU",
      BERLIN,
      1,
      template(g, "DEU", ["field_hospital"]),
    );
    const r0 = t.rowOf(plain.divisions[0]);
    const r1 = t.rowOf(care.divisions[0]);
    t.encircled[r0] = 1;
    t.encircled[r1] = 1;
    expect(attritionPpm(l, r0, 0)).toBe(10_000);
    expect(attritionPpm(l, r1, 0)).toBe(7500);
  });

  test("logistics burn a tenth less fuel", () => {
    const tanks = new Array<BattalionId>(4).fill("light_armor");
    const s = stats(["logistics"], tanks);
    expect(s.flags & TPL_LOGISTICS).not.toBe(0);
    expect(s.fuelHourMilli).toBe(
      Math.floor((stats([], tanks).fuelHourMilli * 90) / 100),
    );
    expect(s.fuelHourMilli).toBeGreaterThan(0);
  });
});

describe("the engine's prediction reads the real line", () => {
  test("predictAttack sees engineers against a dug-in region", async () => {
    const run = async (support: readonly SupportId[]) => {
      const { g, l } = await war();
      const a = placeArmy(g, "DEU", BERLIN, 6, template(g, "DEU", support));
      const d = placeArmy(g, "POL", WARSAW, 2, template(g, "POL", []));
      a.general = 0;
      a.order = idleOrder();
      d.general = 0;
      d.order = idleOrder();
      const t = l.divisions;
      for (const id of d.divisions) t.entrench[t.rowOf(id)] = 10;
      l.posLevel[WARSAW] = 3;
      return predictAttack(
        l,
        a.divisions.map((id) => t.rowOf(id)),
        WARSAW,
      ).ratioPm;
    };
    const plain = await run([]);
    expect(await run(["engineer"])).toBeGreaterThan(plain);
    expect(await run(["support_artillery"])).toBeGreaterThan(plain);
  });
});
