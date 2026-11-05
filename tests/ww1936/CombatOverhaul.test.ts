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
  GENERAL_TRAITS,
  RETIRED_GENERAL_TRAITS,
  SupportId,
  TPL_CAVALRY_MAJOR,
  TPL_ENGINEER,
  TPL_MARINE_MAJOR,
  TPL_MOUNTAIN_MAJOR,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { regionDepth } from "@openfront/engine-lib/ww1936/BandRules";
import { BATTALIONS } from "@openfront/engine-lib/ww1936/Battalions";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  ASSAULT_BREAK_BP,
  divisionMods,
  ModInput,
  RIVER_ATTACK_BP,
  FORT_ATTACK_BP,
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
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
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
