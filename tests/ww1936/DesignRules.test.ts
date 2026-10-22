// World War 1936 P6 (spec §5, plan Task 1 Step 21, Review Focus 2): the
// designers' pure rules — the spec's check lines, roles, costs, checks,
// experience, conversion, licences, reliability; the engine's cache uses
// the same designStats.
import type {
  DesignDef,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  applyShipDesign,
  convertCost,
  designBlock,
  DesignCtx,
  designStats,
  designXpCost,
  licenceCostPct,
  planeType,
  recommendedTank,
  reliabilityLossBp,
  SHIP_CLASS_SLOTS,
  shipDesignMods,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  designCtxOf,
  type DesignSlot,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { wwRunner } from "./util";

const ALL: ReadonlySet<WwTechId> = new Set(WW_TECH_IDS);
const CTX: DesignCtx = { techs: ALL, projects: 0, relPp: 0, costPct: 0 };
const OPEN = {
  techs: ALL,
  projects: 0,
  treatyMember: false,
  treatyEscalated: false,
};
const tank = (base: string, modules: string[], a = 0, e = 0): DesignDef => ({
  kind: "tank",
  base,
  modules,
  armorLevel: a,
  engineLevel: e,
  name: "t",
});
const stats = (d: DesignDef, ctx: DesignCtx = CTX) => designStats(d, ctx);
const tankStats = (d: DesignDef, ctx: DesignCtx = CTX) =>
  designStats(d, ctx) as TankDesignStats;

describe("design rules", () => {
  it("spec §5.2.1: the light I recommended fit", () => {
    const s = stats({ ...recommendedTank("light_1", ALL, "tank"), name: "l" });
    expect(s).toMatchObject({
      soft: 1200,
      hard: 400,
      def: 400,
      brk: 2160,
      pierce: 1500,
      armor: 900,
      speedCenti: 800,
    });
  });

  it("spec §5.2.3: the medium II and medium I recommended fits", () => {
    expect(stats(TEST_TANK)).toMatchObject({
      soft: 1680,
      hard: 1800,
      brk: 4130,
      pierce: 6200,
      def: 600,
      armor: 5428,
      speedCenti: 722,
      relPm: 875,
      costMilli: 19_550,
    });
    const m1 = stats({
      ...recommendedTank("medium_1", ALL, "tank"),
      name: "m",
    });
    expect(m1).toMatchObject({
      soft: 2100,
      hard: 1000,
      pierce: 3000,
      brk: 3776,
    });
  });

  it("roles: howitzer, anti-air, fixed casemate", () => {
    expect(
      tankRole(
        tank("medium_1", ["howitzer", "turret_open", "", "", "", "", ""]),
      ),
    ).toBe("sp_artillery");
    expect(
      tankRole(
        tank("medium_1", ["aa_auto", "turret_open", "", "", "", "", ""]),
      ),
    ).toBe("sp_anti_air");
    for (const g of ["gun_small", "gun_hv", "gun_heavy"]) {
      expect(
        tankRole(tank("medium_2", [g, "turret_none", "", "", "", "", ""])),
      ).toBe("tank_destroyer");
    }
    expect(
      tankRole(tank("medium_1", ["mg", "turret_none", "", "", "", "", ""])),
    ).toBe("tank");
  });

  it("cost: additions, then module %, then level %; reliability clamped 400..990", () => {
    const plain = tankStats(tank("medium_2", ["", "", "", "", "", "", ""]));
    const levels = tankStats(
      tank("medium_2", ["", "", "", "", "", "", ""], 3, 3),
    );
    expect(levels.costMilli).toBeGreaterThan(plain.costMilli);
    expect(tankStats(TEST_TANK, { ...CTX, relPp: 100 }).relPm).toBe(990);
    expect(tankStats(TEST_TANK, { ...CTX, relPp: -100 }).relPm).toBe(400);
    expect(tankStats(TEST_TANK, { ...CTX, costPct: -10 }).costMilli).toBe(
      Math.floor((19_550 * 90) / 100),
    );
  });

  it("slot checks", () => {
    const ok = TEST_TANK;
    expect(designBlock(ok, OPEN)).toBeNull();
    // Slot count, slot kind, weight, a repeated special, a howitzer in a one-man turret.
    expect(designBlock({ ...ok, modules: ok.modules.slice(0, 6) }, OPEN)).toBe(
      "module_bad_slot",
    );
    expect(
      designBlock({ ...ok, modules: ["radio", ...ok.modules.slice(1)] }, OPEN),
    ).toBe("module_bad_slot");
    expect(
      designBlock(tank("light_1", ["", "", "interleaved", "", "", ""]), OPEN),
    ).toBe("module_bad_slot");
    expect(
      designBlock(
        { ...ok, modules: [...ok.modules.slice(0, 5), "radio", "radio"] },
        OPEN,
      ),
    ).toBe("module_bad_slot");
    expect(
      designBlock(
        tank("medium_1", ["howitzer", "turret_1", "", "", "", "", ""]),
        OPEN,
      ),
    ).toBe("module_bad_slot");
    // A module without its tech; a chassis without its tech.
    const noGun = new Set([...ALL].filter((t) => t !== "tank_gun_2"));
    expect(designBlock(ok, { ...OPEN, techs: noGun })).toBe("module_locked");
    const noHeavy = new Set([...ALL].filter((t) => t !== "heavy_tank_1"));
    expect(
      designBlock(tank("heavy_1", ["", "", "", "", "", "", ""]), {
        ...OPEN,
        techs: noHeavy,
      }),
    ).toBe("bad_base");
  });

  it("the naval treaty: heavy guns until the escalator, never the super-heavy hull", () => {
    const empty = SHIP_CLASS_SLOTS.bb.map(() => "");
    const heavy: DesignDef = {
      kind: "ship",
      base: "bb_3",
      modules: ["main_heavy", ...empty.slice(1)],
      name: "b",
    };
    const shbb: DesignDef = {
      kind: "ship",
      base: "bb_3",
      modules: [...empty.slice(0, 5), "shbb_hull"],
      name: "s",
    };
    const member = { ...OPEN, treatyMember: true };
    expect(designBlock(heavy, OPEN)).toBeNull();
    expect(designBlock(heavy, member)).toBe("treaty_limit");
    expect(designBlock(heavy, { ...member, treatyEscalated: true })).toBeNull();
    expect(designBlock(shbb, OPEN)).toBeNull();
    expect(designBlock(shbb, { ...member, treatyEscalated: true })).toBe(
      "treaty_limit",
    );
  });

  it("ships: no module keeps the P4 numbers; the super-heavy hull", () => {
    const base = shipStats("bb", 3, emptyStats(), ALL);
    const empty: DesignDef = {
      kind: "ship",
      base: "bb_3",
      modules: SHIP_CLASS_SLOTS.bb.map(() => ""),
      name: "b",
    };
    expect(applyShipDesign(base, shipDesignMods(empty))).toEqual(base);
    const m = shipDesignMods({
      ...empty,
      modules: [...empty.modules.slice(0, 5), "shbb_hull"],
    });
    expect(m).toMatchObject({
      hpPct: 40,
      heavyPct: 30,
      piercePct: 15,
      armorPct: 25,
      speedCentiKn: -400,
      visPct: 20,
      costPct: 60,
    });
  });

  it("planes: the role table and the jet's fuel", () => {
    const plane = (base: string, modules: string[]): DesignDef => ({
      kind: "plane",
      base,
      modules,
      name: "p",
    });
    expect(planeType(plane("small_1", ["w_mg4", "", "", ""]))).toBe("fighter");
    expect(planeType(plane("small_1", ["w_mg4", "", "", "m_carrier"]))).toBe(
      "cv_fighter",
    );
    expect(planeType(plane("small_1", ["w_bombs_s", "", "", ""]))).toBe("cas");
    expect(planeType(plane("small_1", ["w_torpedo", "", "", ""]))).toBe(
      "naval_bomber",
    );
    expect(planeType(plane("medium_1", ["w_hmg", "", "", "", ""]))).toBe(
      "heavy_fighter",
    );
    expect(planeType(plane("medium_1", ["w_bombs_m", "", "", "", ""]))).toBe(
      "bomber",
    );
    expect(planeType(plane("medium_1", ["w_mg2", "", "", "", "m_radar"]))).toBe(
      "naval_bomber",
    );
    expect(planeType(plane("large_1", ["w_bombs_l", "", "", "", "", ""]))).toBe(
      "strat_bomber",
    );
    expect(planeType(plane("medium_1", ["w_cargo", "", "", "", ""]))).toBe(
      "transport_plane",
    );
    const jet = stats(plane("jet_1", ["w_cannon30", "", "", ""]));
    expect(jet.kind === "plane" && jet.fuelPct).toBe(60);
  });

  it("experience, conversion, licences, reliability", () => {
    const blank = tank("medium_2", ["", "", "", "", "", "", ""]);
    expect(designXpCost(null, blank)).toBe(10);
    const one = {
      ...blank,
      modules: ["gun_hv", "", "", "", "", "", ""],
      armorLevel: 1,
      engineLevel: 1,
    };
    expect(designXpCost(null, one)).toBe(10 + 3 + 2);
    expect(
      designXpCost(one, {
        ...one,
        modules: ["gun_cs", ...one.modules.slice(1)],
      }),
    ).toBe(5);
    expect(convertCost(19_550, 8_200)).toBe(14_630);
    expect([0, 2, 6].map(licenceCostPct)).toEqual([10, 30, 60]);
    expect(reliabilityLossBp(800)).toBe(10_000);
    expect(reliabilityLossBp(700)).toBe(11_000);
  });

  it("designer preview equals engine stats (Review Focus 2)", async () => {
    usePoliticsContent(depthFixture());
    try {
      const runner = await wwRunner({}, [], DEEP.map);
      const d = runner.game.worldWar()!.depth;
      const id = DEEP.tag.DEU;
      d.country(id)!.des.tank[0] = {
        def: TEST_TANK as DesignSlot["def"],
        origin: "own",
        from: 0,
        fromSlot: 0,
        obsolete: false,
        savedDay: 0,
      };
      d.refreshDesignCache(id);
      expect(d.designStatsOf(id, "tank", 1)).toEqual(
        designStats(TEST_TANK, designCtxOf(d, id, TEST_TANK)),
      );
    } finally {
      usePoliticsContent(null);
    }
  });
});
