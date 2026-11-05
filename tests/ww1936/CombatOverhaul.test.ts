// ww84: the combat overhaul. Ground and weather decide nothing, armour stops
// what can't pierce it, each battalion has its job. Rules are checked on the
// pure functions; what only a fight can show runs a real battle round.
import { CONTENT_PARTS } from "@openfront/engine-lib/ww1936/content/registry";
import {
  EQUIPMENT_TYPES,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  BattalionId,
  DivisionStats,
  GENERAL_TRAITS,
  NEED_GROUP_COUNT,
  NEED_GROUPS,
  RETIRED_GENERAL_TRAITS,
  SupportId,
  TPL_BARE_ARMOR,
  TPL_CAVALRY_MAJOR,
  TPL_ENGINEER,
  TPL_FOOT_MAJOR,
  TPL_MARINE_MAJOR,
  TPL_MOUNTAIN_MAJOR,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { regionDepth } from "@openfront/engine-lib/ww1936/BandRules";
import { BATTALIONS } from "@openfront/engine-lib/ww1936/Battalions";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addToSide,
  armorProtectPm,
  ASSAULT_BREAK_BP,
  BARE_ARMOR_ORG_PCT,
  bandProtectPm,
  defenderOrgPct,
  divisionMods,
  emptySide,
  entrenchMax,
  FOOT_DEFENCE_ORG_PCT,
  FORT_ATTACK_BP,
  hitProtectPm,
  ModInput,
  predictBattle,
  RIVER_ATTACK_BP,
  TANK_FEAR_PCT,
  tankFearPct,
  trenchCutPm,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { moveNeed, moveStep } from "@openfront/engine-lib/ww1936/MoveRules";
import {
  regionSupplyMilli,
  supplyEdgeCost,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import {
  CAVALRY_INITIATIVE,
  initiativeOf,
  newTacticSide,
} from "@openfront/engine-lib/ww1936/TacticRules";
import {
  divisionStatsAt,
  GEN1,
  MAX_PIERCE_BANDS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  fearCutOf,
  joinBattle,
  ROUT_LOSS_CAVALRY_PCT,
  ROUT_LOSS_PCT,
  stepBattles,
  stepRecovery,
} from "@openfront/engine/ww1936/land/Battles";
import { landDivisions } from "@openfront/engine/ww1936/land/SeaLift";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { describe, expect, test } from "vitest";
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
  WwHuman,
  wwGameStart,
} from "./util";

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const WARSAW = 6;
const BERLIN = 3;
const ZERO = techTotals(new Set());

function battalions(
  list: readonly (readonly [BattalionId, number])[],
): BattalionId[] {
  return list.flatMap(([id, n]) => new Array<BattalionId>(n).fill(id));
}

const stats = (
  list: readonly (readonly [BattalionId, number])[],
  support: readonly SupportId[] = [],
) =>
  templateStats(
    { name: "", battalions: battalions(list), support: [...support] },
    ZERO,
    GEN1,
  );

function input(o: Partial<ModInput> = {}): ModInput {
  return {
    attacking: true,
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

const line = (ls: { id: string; bp: number }[], id: string) =>
  ls.find((l) => l.id === id)?.bp;

/** DEU and POL at war on 1 June 1936, the land cleared, stock for full divisions. */
async function war(warsawPatch?: Record<string, unknown>) {
  const files = await loadMapFiles(
    new TestDataMapLoader(MINI),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const scenario = structuredClone(files.scenario!);
  if (warsawPatch !== undefined) {
    Object.assign(scenario.regions.find((r) => r.name === "Warsaw")!, {
      ...warsawPatch,
    });
  }
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
  for (const tag of ["DEU", "POL"] as const) {
    const ce = l.econ.country(byTag(g, tag).smallID())!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
  }
  return { runner, g, l };
}

/** A template of `list` for country `tag`; its id. */
function template(
  g: Game,
  tag: "DEU" | "POL",
  list: readonly (readonly [BattalionId, number])[],
  support: readonly SupportId[] = [],
): number {
  const cl = land(g).country(byTag(g, tag).smallID())!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: { name: `t${id}`, battalions: battalions(list), support: [...support] },
  });
  return id;
}

function attack(l: WwLand, a: Army, region: number): void {
  for (const id of a.divisions) joinBattle(l, id, region);
}

describe("P1: the ground and the weather decide nothing", () => {
  test("a fight in a snowbound mountain goes as one on a mild plain, to the bit", async () => {
    const run = async (patch?: Record<string, unknown>) => {
      const { g, l } = await war(patch);
      const a = placeArmy(g, "DEU", BERLIN, 3);
      const d = placeArmy(g, "POL", WARSAW, 2);
      attack(l, a, WARSAW);
      for (let i = 0; i < 12; i++) stepBattles(l, g.ticks());
      expect(l.battles.get(WARSAW)?.round).toBe(12);
      const t = l.divisions;
      return [...a.divisions, ...d.divisions].map((id) => {
        const r = t.rowOf(id);
        return r < 0 ? null : [t.org[r], t.men[r]];
      });
    };
    const plain = await run({ land: "plains" });
    expect(await run({ land: "mountain", latC: 7000 })).toEqual(plain);
    expect(await run({ land: "urban", latC: 7000 })).toEqual(plain);
  }, 120_000);

  test("marching, supply lines and bands read no ground", () => {
    const edge = { a: 1, b: 2, border: 10, km: 180, river: 0, strait: 0 } as const;
    expect(moveNeed(edge)).toBe(180_000);
    expect(moveStep(400, 1, 1000, 0)).toBe(7316);
    expect(supplyEdgeCost(300, 0, 3, 1)).toBe(27_272);
    expect(regionSupplyMilli(5000, 2000)).toBe(7000);
    expect(regionDepth(50, 0)).toBe(1);
    expect(regionDepth(50, 10)).toBe(2);
  });

  test("no general carries a terrain trait; their bits stay where they were", () => {
    expect(GENERAL_TRAITS.indexOf("winter_specialist")).toBe(5);
    expect(GENERAL_TRAITS.indexOf("swamp_expert")).toBe(13);
    for (const g of GENERALS) {
      for (const t of RETIRED_GENERAL_TRAITS) expect(g.traits).not.toContain(t);
    }
    const mods = divisionMods(
      input({ traits: traitBit("mountaineer") | traitBit("urban_expert") }),
    );
    expect(line(mods.attackLines, "trait")).toBeUndefined();
  });

  test("no spirit carries a terrain key", () => {
    for (const s of CONTENT_PARTS.spirits) {
      for (const k of [
        "winterPenaltyPct",
        "desertAttackPct",
        "forestDefensePct",
      ]) {
        expect(s.stats, s.id).not.toHaveProperty(k);
      }
    }
  });
});

describe("P1: assault infantry, cavalry, marines", () => {
  test("assault infantry breaks through a fifth harder, attacking only", () => {
    const flags = TPL_MOUNTAIN_MAJOR;
    expect(line(divisionMods(input({ flags })).defenseLines, "mountain")).toBe(
      ASSAULT_BREAK_BP,
    );
    expect(
      line(
        divisionMods(input({ flags, attacking: false })).defenseLines,
        "mountain",
      ),
    ).toBeUndefined();
    expect(BATTALIONS.mountain.orgMilli).toBe(70_000);
    expect(BATTALIONS.mountain.special).toBe(true);
  });

  test("assault infantry pays 15 % less for rivers and forts", () => {
    const flags = TPL_MOUNTAIN_MAJOR;
    const river = (f: number) =>
      line(divisionMods(input({ flags: f, river: 2 })).attackLines, "river");
    const fort = (f: number) =>
      line(divisionMods(input({ flags: f, fort: 2 })).attackLines, "fort");
    expect(river(0)).toBe(RIVER_ATTACK_BP[2]);
    expect(river(flags)).toBe(-3400);
    expect(fort(0)).toBe(FORT_ATTACK_BP * 2);
    expect(fort(flags)).toBe(-2890);
    expect(fort(flags | TPL_ENGINEER)).toBe(-2167);
  });

  test("marines get no ground bonus", () => {
    const m = divisionMods(input({ flags: TPL_MARINE_MAJOR }));
    expect(line(m.attackLines, "marine")).toBeUndefined();
  });

  test("a line of cavalry takes the initiative", () => {
    const s = newTacticSide();
    const before = initiativeOf(s, false);
    s.cavalry = true;
    expect(initiativeOf(s, false)).toBe(before + CAVALRY_INITIATIVE);
    expect(stats([["cavalry", 5]]).flags & TPL_CAVALRY_MAJOR).not.toBe(0);
  });

  test("a defender cavalry broke leaves more behind", async () => {
    const lossOf = async (by: BattalionId) => {
      const { g, l } = await war();
      const tpl = template(g, "DEU", [[by, 9]]);
      const a = placeArmy(g, "DEU", BERLIN, 2, tpl);
      const d = placeArmy(g, "POL", WARSAW, 2);
      attack(l, a, WARSAW);
      const t = l.divisions;
      const r = t.rowOf(d.divisions[0]);
      stepBattles(l, g.ticks());
      // One blow from breaking.
      t.org[r] = 1;
      t.org[t.rowOf(d.divisions[1])] = 1;
      const men = t.men[r];
      stepBattles(l, g.ticks());
      return { men, left: t.men[r] };
    };
    const inf = await lossOf("infantry");
    const cav = await lossOf("cavalry");
    expect(ROUT_LOSS_CAVALRY_PCT).toBe(ROUT_LOSS_PCT + 5);
    const lost = (x: typeof inf) => ((x.men - x.left) * 100) / x.men;
    expect(lost(inf)).toBeGreaterThanOrEqual(ROUT_LOSS_PCT);
    expect(lost(inf)).toBeLessThan(ROUT_LOSS_PCT + 2);
    expect(lost(cav)).toBeGreaterThanOrEqual(ROUT_LOSS_CAVALRY_PCT);
    expect(lost(cav)).toBeLessThan(ROUT_LOSS_CAVALRY_PCT + 2);
  }, 120_000);

  test("marines just ashore recover half as fast again for three days", async () => {
    const { g, l } = await war();
    const tpl = template(g, "DEU", [["marine", 9]]);
    const tech = l.econ.country(byTag(g, "DEU").smallID())!;
    tech.researched.add("marines");
    const a = placeArmy(g, "DEU", BERLIN, 2, tpl);
    const t = l.divisions;
    const [landed, stayed] = a.divisions.map((id) => t.rowOf(id));
    landDivisions(l, [a.divisions[0]], BERLIN, true, g.ticks());
    t.org[landed] = t.org[stayed] = 1000;
    stepRecovery(l);
    const gained = t.org[landed] - 1000;
    expect(gained).toBe(Math.floor(((t.org[stayed] - 1000) * 150) / 100));
    const snap = l.snapshot();
    expect(snap.landedUntil).toEqual([[a.divisions[0], l.day() + 3]]);
  }, 60_000);
});

/** What `by`'s attack loses to `to`'s armour, ‰, as it attacks or defends. */
const stopped = (by: DivisionStats, to: DivisionStats, attacking: boolean) =>
  hitProtectPm(
    by.soft,
    by.hard,
    to.hardnessPm,
    bandProtectPm(
      attacking ? by.bandPierceAtk : by.bandPierce,
      by.bandHard,
      to.armor,
    ),
  );

describe("P2: armour and pierce bands", () => {
  const tanks = stats([
    ["medium_armor", 4],
    ["motorized", 5],
  ]);
  const rifles = stats([["infantry", 9]]);

  test("the curve: 85 % to a third, 50 % at two thirds, none at the armour", () => {
    expect([1000, 2000, 3000, 4000, 5000, 6000].map((p) => armorProtectPm(6000, p))).toEqual(
      [850, 850, 675, 500, 250, 0],
    );
  });

  test("rifles barely scratch a tank's hard part; the soft part goes through", () => {
    expect(bandProtectPm(rifles.bandPierce, rifles.bandHard, tanks.armor)).toBe(850);
    // Medium tanks 4 of 9: hardness 455 ‰, and rifles are mostly soft attack:
    // 12 % of their hits are hard, as the plan's split has it. (P7's numbers.)
    expect(stopped(rifles, tanks, true)).toBe(103);
    // A pure tank division is nearly all hard: more of it stopped.
    expect(stopped(rifles, stats([["medium_armor", 9]]), true)).toBe(510);
  });

  test("anti-tank guns are not diluted by the rifles around them", () => {
    const withGuns = stats([
      ["infantry", 7],
      ["anti_tank", 2],
    ]);
    expect(withGuns.bandPierce).toEqual([400, 5000]);
    expect(withGuns.bandHard).toEqual([700, 3000]);
    expect(withGuns.pierce).toBe(5000);
    // Defending: the guns' share goes straight through a medium tank's armour.
    const p = bandProtectPm(withGuns.bandPierce, withGuns.bandHard, 4000);
    expect(p).toBe(Math.floor((700 * 850) / 3700));
  });

  test("a gun pierces fully defending, half attacking; a tank's gun both ways", () => {
    const guns = stats([
      ["infantry", 7],
      ["anti_tank", 2],
    ]);
    expect(guns.bandPierceAtk).toEqual([400, 2500]);
    const company = stats([["infantry", 9]], ["support_anti_tank"]);
    expect(company.bandPierce).toEqual([400, 4500]);
    expect(company.bandPierceAtk).toEqual([400, 2250]);
    expect(tanks.bandPierceAtk).toEqual(tanks.bandPierce);
    expect(stopped(guns, tanks, true)).toBeGreaterThan(
      stopped(guns, tanks, false),
    );
  });

  test("at most four bands, the nearest merged by hard attack", () => {
    const s = stats(
      [
        ["infantry", 3],
        ["artillery", 1],
        ["anti_air", 1],
        ["anti_tank", 1],
        ["light_armor", 1],
        ["medium_armor", 1],
      ],
      ["support_anti_air"],
    );
    expect(s.bandPierce.length).toBe(MAX_PIERCE_BANDS);
    expect(s.bandHard.reduce((a, b) => a + b, 0)).toBe(s.hard);
    expect([...s.bandPierce].sort((a, b) => a - b)).toEqual(s.bandPierce);
    // (The medium tank's 45 and the gun's 50 are the nearest pair here.)
    expect(s.bandPierce[MAX_PIERCE_BANDS - 1]).toBeGreaterThan(4500);
    expect(s.bandPierce[MAX_PIERCE_BANDS - 1]).toBeLessThan(5000);
  });

  test("a gun the division has lost pierces nothing", () => {
    const s = stats([
      ["infantry", 7],
      ["anti_tank", 2],
    ]);
    const fill = new Array<number>(NEED_GROUP_COUNT).fill(1000);
    fill[NEED_GROUPS.indexOf("anti_tank")] = 0;
    const d = divisionStatsAt(s, fill, s.men);
    expect(d.bandHard).toEqual([700, 0]);
    expect(bandProtectPm(d.bandPierce, d.bandHard, 4000)).toBe(850);
  });

  test("the prediction fights by bands too", () => {
    const side = (s: DivisionStats) => {
      const sum = emptySide();
      addToSide(sum, s, s.orgMilli);
      return sum;
    };
    const ctx = {
      land: "plains" as const,
      directions: 1,
      attackerAttackBp: 10_000,
      attackerBlockBp: 10_000,
      defenderAttackBp: 10_000,
      defenderBlockBp: 10_000,
    };
    const guns = stats([
      ["infantry", 7],
      ["anti_tank", 2],
    ]);
    const a = side(tanks);
    const plain = predictBattle(a, side(rifles), ctx);
    const held = predictBattle(a, side(guns), ctx);
    expect(held.ratioPm).toBeLessThan(plain.ratioPm);
    // Rifles are hardly worse than bare hands against the tanks.
    const toTanks = predictBattle(side(rifles), a, ctx);
    const noArmour = { ...a, armor: 0 };
    expect(predictBattle(side(rifles), noArmour, ctx).ratioPm).toBeGreaterThan(
      toTanks.ratioPm,
    );
  });
});

describe("P3: infantry and armour", () => {
  const tanks = stats([
    ["medium_armor", 4],
    ["motorized", 5],
  ]);
  const bare = stats([
    ["medium_armor", 7],
    ["motorized", 2],
  ]);
  const rifles = stats([["infantry", 9]]);
  const side = (s: DivisionStats) => {
    const sum = emptySide();
    addToSide(sum, s, s.orgMilli);
    return sum;
  };
  const ctx = {
    land: "plains" as const,
    directions: 1,
    attackerAttackBp: 10_000,
    attackerBlockBp: 10_000,
    defenderAttackBp: 10_000,
    defenderBlockBp: 10_000,
  };

  test("foot defend at −15 % org damage; tanks on their own at +25 %", () => {
    expect(rifles.flags & TPL_FOOT_MAJOR).not.toBe(0);
    expect(defenderOrgPct(rifles.flags)).toBe(FOOT_DEFENCE_ORG_PCT);
    expect(tanks.flags & TPL_BARE_ARMOR).toBe(0);
    expect(defenderOrgPct(tanks.flags)).toBe(FOOT_DEFENCE_ORG_PCT);
    expect(bare.flags & TPL_BARE_ARMOR).not.toBe(0);
    expect(defenderOrgPct(bare.flags)).toBe(BARE_ARMOR_ORG_PCT);
    expect(defenderOrgPct(stats([["artillery", 9]]).flags)).toBe(100);
  });

  test("tanks on their own dig in half as deep", () => {
    expect(entrenchMax(rifles.flags, ZERO)).toBe(5);
    expect(entrenchMax(bare.flags, ZERO)).toBe(2);
    expect(entrenchMax(bare.flags | TPL_ENGINEER, ZERO)).toBe(5);
  });

  test("a trench costs tanks 5 points of protection a level, 25 at most", () => {
    expect(trenchCutPm(rifles.flags, 0)).toBe(0);
    expect(trenchCutPm(rifles.flags, 3)).toBe(150);
    expect(trenchCutPm(rifles.flags, 9)).toBe(250);
    expect(trenchCutPm(stats([["artillery", 9]]).flags, 5)).toBe(0);
    expect(bandProtectPm([400], [900], 4000, 250)).toBe(600);
    expect(bandProtectPm([3900], [900], 4000, 250)).toBe(0);
  });

  test("tank fear: a line that can't reach a third of the armour takes 25 % more", () => {
    expect(tankFearPct(rifles.bandPierce, rifles.bandHard, 4000, 0)).toBe(
      TANK_FEAR_PCT,
    );
    // Research takes it off, five points a step.
    expect(tankFearPct(rifles.bandPierce, rifles.bandHard, 4000, 10)).toBe(15);
    expect(tankFearPct(rifles.bandPierce, rifles.bandHard, 4000, 30)).toBe(0);
    const guns = stats([
      ["infantry", 7],
      ["anti_tank", 2],
    ]);
    expect(tankFearPct(guns.bandPierce, guns.bandHard, 4000, 0)).toBe(0);
    // A gun with no crew left stops nobody's fear.
    expect(tankFearPct(guns.bandPierce, [700, 0], 4000, 0)).toBe(TANK_FEAR_PCT);
  });

  test("portable anti-tank weapons: foot battalions' pierce and hard attack", () => {
    const tech = { ...ZERO, infAtPierce: 2100, infAtHard: 100 };
    const of = (b: BattalionId) =>
      templateStats({ name: "", battalions: [b], support: [] }, tech, GEN1);
    expect(of("infantry").bandPierce).toEqual([2500]);
    expect(of("infantry").hard).toBe(200);
    expect(of("motorized").bandPierce).toEqual([2500]);
    expect(of("mountain").bandPierce).toEqual([2500]);
    expect(of("artillery").bandPierce).toEqual([500]);
    expect(of("medium_armor").bandPierce).toEqual([4500]);
    // And rifles now reach past a third of a medium tank's armour.
    const s = of("infantry");
    expect(tankFearPct(s.bandPierce, s.bandHard, 4000, 0)).toBe(0);
  });

  test("the research reaches a real division: inf_at_2 and tank fear", async () => {
    const { g, l } = await war();
    const ce = l.econ.country(byTag(g, "POL").smallID())!;
    const before = ce.stats.tankFearCutPp;
    ce.addTech("inf_at_1");
    ce.addTech("inf_at_2");
    expect(ce.stats.tankFearCutPp).toBeGreaterThanOrEqual(before + 10);
    const tpl = template(g, "POL", [["infantry", 9]]);
    const d = placeArmy(g, "POL", WARSAW, 1, tpl);
    const s = l.statsOf(l.divisions.rowOf(d.divisions[0]));
    expect(s.bandPierce[0]).toBeGreaterThanOrEqual(2500);
    expect(fearCutOf(l, l.divisions.rowOf(d.divisions[0]))).toBe(
      ce.stats.tankFearCutPp,
    );
  }, 60_000);

  test("the prediction knows all of it", () => {
    const toFoot = predictBattle(side(tanks), side(rifles), ctx);
    const fearless = predictBattle(side(tanks), side(rifles), {
      ...ctx,
      tankFearCutPp: 25,
    });
    // Tank fear: the armour-major share of the attackers counts (4 of 9 is
    // no armour-major division, so here nothing).
    expect(toFoot.ratioPm).toBe(fearless.ratioPm);
    const heavy = stats([
      ["medium_armor", 5],
      ["motorized", 4],
    ]);
    expect(
      predictBattle(side(heavy), side(rifles), ctx).ratioPm,
    ).toBeGreaterThan(
      predictBattle(side(heavy), side(rifles), { ...ctx, tankFearCutPp: 25 })
        .ratioPm,
    );
    // Foot defend better than the same numbers without the rule.
    const plainDef = { ...side(rifles), defOrgPct: 100 };
    expect(predictBattle(side(rifles), plainDef, ctx).ratioPm).toBeGreaterThan(
      predictBattle(side(rifles), side(rifles), ctx).ratioPm,
    );
    // A trench gets at the tanks.
    const dug = { ...ctx, defenderPrepBp: 2500 };
    const open = predictBattle(side(heavy), side(rifles), {
      ...dug,
      defenderBlockBp: 12_500,
    });
    const noFoot = { ...side(rifles), footPm: 0 };
    expect(open.ratioPm).toBeLessThan(
      predictBattle(side(heavy), noFoot, { ...dug, defenderBlockBp: 12_500 })
        .ratioPm,
    );
  });

  test("in a fight: a medium tank line scares rifles, and a battle applies the foot cut", async () => {
    const round = async (by: "tank" | "rifle") => {
      const { g, l } = await war();
      const tpl = template(
        g,
        "DEU",
        by === "tank"
          ? [
              ["medium_armor", 5],
              ["motorized", 4],
            ]
          : [["infantry", 9]],
      );
      const pol = template(g, "POL", [["infantry", 9]]);
      l.econ.country(byTag(g, "DEU").smallID())!.researched.add("medium_tank_1");
      const a = placeArmy(g, "DEU", BERLIN, 1, tpl);
      const d = placeArmy(g, "POL", WARSAW, 1, pol);
      attack(l, a, WARSAW);
      const t = l.divisions;
      const r = t.rowOf(d.divisions[0]);
      const was = t.org[r];
      stepBattles(l, g.ticks());
      return was - t.org[r];
    };
    expect(await round("rifle")).toBeGreaterThan(0);
    expect(await round("tank")).toBeGreaterThan(await round("rifle"));
  }, 120_000);
});
