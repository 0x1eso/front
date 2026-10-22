// World War 1936 P6 lane W3 (plan Task 9 Steps 6, 8): the 11 depth
// effects and the 9 depth conditions, one line each, through P3's
// dispatcher on the deep test map (France human). The effects whose
// bodies other lanes own (D, E, I, S, W1) are checked for their routing
// here; their numbers are those lanes' tests.
import {
  CP_MAX_MILLI,
  GRAND_DOCTRINES,
  SPECIAL_PROJECTS,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type Condition,
  type Effect,
  EFFECT_KINDS,
  effectGroup,
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { bopValue } from "@openfront/engine/ww1936/depth/BalanceOfPower";
import { addCongressPp } from "@openfront/engine/ww1936/depth/Congress";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffect,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepToDate, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const { FRA, DEU, GBR } = DEEP.tag;

async function game(): Promise<GameRunner> {
  const runner = await wwRunner(
    {},
    [{ clientID: "HUMANFRA", country: "FRA" }],
    DEEP.map,
  );
  stepToDate(runner, "1936-01-03");
  return runner;
}

function fx(runner: GameRunner, e: Effect, who: number = FRA): void {
  const ww = runner.game.worldWar()!;
  expect(() => WwEffectSchema.parse(e)).not.toThrow();
  expect(effectGroup(e.kind)).toBe("depth");
  applyEffect(makeCtx(ww.politics, who, who, 0, runner.game.ticks()), e);
}

function cond(runner: GameRunner, c: Condition, who: number = FRA): boolean {
  const ww = runner.game.worldWar()!;
  expect(() => WwConditionSchema.parse(c)).not.toThrow();
  return evalCondition(
    makeCtx(ww.politics, who, who, 0, runner.game.ticks()),
    c,
  );
}

describe("World War 1936 P6: the depth effects", () => {
  it("are the eleven after navy_xp", () => {
    const first = EFFECT_KINDS.indexOf("doctrine_mastery");
    expect(EFFECT_KINDS.slice(first)).toEqual([
      "doctrine_mastery",
      "congress",
      "bop",
      "cp",
      "intel_network",
      "decrypt",
      "project_progress",
      "design_grant",
      "energy",
      "agency",
      "cfocus_unlock",
    ]);
  });

  it("each one runs", async () => {
    const runner = await game();
    const d = runner.game.worldWar()!.depth;
    const c = d.country(FRA)!;
    // doctrine_mastery (D), intel_network/decrypt/agency (I),
    // project_progress (S), design_grant (E), energy (W1): routed.
    fx(runner, { kind: "doctrine_mastery", domain: "land", amount: 60 });
    fx(runner, { kind: "intel_network", on: { tag: "DEU" }, pm: 100 });
    fx(runner, { kind: "decrypt", on: { tag: "DEU" }, pm: 100 });
    fx(runner, { kind: "project_progress", project: "sp_atomic", pct: 10 });
    fx(runner, { kind: "design_grant", preset: "preset_medium_2" });
    fx(runner, { kind: "energy", amount: 5 });
    fx(runner, { kind: "agency" });
    // congress: the US only (the deep map has none: nothing moves).
    const bp = d.mech.congressBp;
    fx(runner, { kind: "congress", pp: 10 });
    expect(d.mech.congressBp).toBe(bp);
    addCongressPp(d, GBR, 10);
    expect(d.mech.congressBp).toBe(bp + 1_000);
    // bop: France's balance, while its mechanism is on.
    const v = bopValue(d, "FRA");
    fx(runner, { kind: "bop", amount: 100 });
    expect(bopValue(d, "FRA")).toBe(v + 100);
    fx(runner, { kind: "bop", amount: 100 }, DEU); // no mechanism: nothing
    expect(bopValue(d, "FRA")).toBe(v + 100);
    // cp: whole points of command power, kept in range. (Lane D's daily
    // gain has run since the start: count from what France holds now.)
    const cp = c.cmd.cpMilli;
    fx(runner, { kind: "cp", amount: 5 });
    expect(c.cmd.cpMilli).toBe(cp + 5_000);
    fx(runner, { kind: "cp", amount: -100 });
    expect(c.cmd.cpMilli).toBe(0);
    c.cmd.cpMilli = CP_MAX_MILLI - 1_000;
    fx(runner, { kind: "cp", amount: 100 });
    expect(c.cmd.cpMilli).toBe(CP_MAX_MILLI);
    // cfocus_unlock: the continuous focuses open in 1936.
    expect(c.mech.cfocusOpen).toBe(false);
    fx(runner, { kind: "cfocus_unlock" });
    expect(c.mech.cfocusOpen).toBe(true);
    expect(
      d.issue(FRA, { kind: "cfocus_set", id: "cf_army" }, runner.game.ticks()),
    ).toBeNull();
  });
});

describe("World War 1936 P6: the depth conditions", () => {
  it("each one reads the depth state", async () => {
    const runner = await game();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const c = d.country(FRA)!;
    // has_doctrine: a grand doctrine (its domain) or a sub-doctrine (its track).
    const gd = { kind: "has_doctrine", doctrine: "gd_firepower" } as const;
    expect(cond(runner, gd)).toBe(false);
    c.doc.gd[0] = GRAND_DOCTRINES.indexOf("gd_firepower");
    expect(cond(runner, gd)).toBe(true);
    c.doc.sub[1] = SUBDOCTRINES.indexOf("arm_mech");
    expect(cond(runner, { kind: "has_doctrine", doctrine: "arm_mech" })).toBe(
      true,
    );
    // mastery_level: the track's level.
    c.doc.masteryMilli[1] = 300_000;
    expect(
      cond(runner, { kind: "mastery_level", track: "armor", level: 2 }),
    ).toBe(true);
    expect(
      cond(runner, { kind: "mastery_level", track: "armor", level: 3 }),
    ).toBe(false);
    // has_agency.
    expect(cond(runner, { kind: "has_agency" })).toBe(false);
    c.intel.agency = true;
    expect(cond(runner, { kind: "has_agency" })).toBe(true);
    // intel_level: our level on `of` in the domain, percent.
    d.intelLevels[(FRA * d.cap + DEU) * 4 + 1] = 55;
    const intel = (pct: number): Condition => ({
      kind: "intel_level",
      of: { tag: "DEU" },
      domain: "army",
      pct,
    });
    expect(cond(runner, intel(55))).toBe(true);
    expect(cond(runner, intel(56))).toBe(false);
    // project_done.
    const proj = { kind: "project_done", project: "sp_jet_engine" } as const;
    expect(cond(runner, proj)).toBe(false);
    c.proj.done |= 1 << SPECIAL_PROJECTS.indexOf("sp_jet_engine");
    expect(cond(runner, proj)).toBe(true);
    // has_atomic: the stock (default 1).
    expect(cond(runner, { kind: "has_atomic" })).toBe(false);
    ww.economy.country(FRA)!.stock[equipKey("atomic_bomb", 1)] = 2;
    expect(cond(runner, { kind: "has_atomic" })).toBe(true);
    expect(cond(runner, { kind: "has_atomic", count: 3 })).toBe(false);
    // congress_above: the US congress's support, percent.
    d.mech.congressBp = 5_000;
    expect(cond(runner, { kind: "congress_above", pct: 50 })).toBe(true);
    expect(cond(runner, { kind: "congress_above", pct: 51 })).toBe(false);
    // bop_range: the tag's band; a tag without a mechanism here never.
    const band = d.mech.bop.find((b) => b[0] === 2)![2];
    expect(cond(runner, { kind: "bop_range", tag: "FRA", band })).toBe(true);
    expect(
      cond(runner, { kind: "bop_range", tag: "FRA", band: (band + 1) % 5 }),
    ).toBe(false);
    // energy_below: yesterday's energy ratio, percent.
    c.mech.energyPm = 590;
    expect(cond(runner, { kind: "energy_below", pct: 60 })).toBe(true);
    expect(cond(runner, { kind: "energy_below", pct: 59 })).toBe(false);
    // `who` asks about another country.
    expect(cond(runner, { kind: "has_agency", who: { tag: "DEU" } })).toBe(
      false,
    );
  });
});
