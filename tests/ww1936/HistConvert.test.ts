import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { histStatsOf } from "@openfront/engine-lib/ww1936/hist/Convert";
import {
  gunStatsOfEntry,
  infantryStatsOfEntry,
} from "@openfront/engine-lib/ww1936/hist/ConvertGear";
import { planeStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertPlane";
import { shipStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertShip";
import {
  effectiveArmorMm,
  tankStatsOfEntry,
} from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import {
  HIST_ALL,
  histEntry,
  histTableLines,
} from "@openfront/engine-lib/ww1936/hist/index";
import { interp, isqrt } from "@openfront/engine-lib/ww1936/hist/Num";
import type {
  GunEntry,
  InfantryEntry,
  PlaneEntry,
  ShipEntry,
  TankEntry,
} from "@openfront/engine-lib/ww1936/hist/Types";
import { describe, expect, test } from "vitest";

const base = { techs: [], year: 1940, source: "test" } as const;
const t34: TankEntry = {
  ...base,
  id: "sun_t34_test",
  country: "SUN",
  family: "tank",
  role: "medium",
  spec: {
    massT: 26.5,
    hullFrontMm: 45,
    hullSlopeDeg: 60,
    turretFrontMm: 52,
    gunMm: 76,
    penMm500: 68,
    heFillerG: 640,
    mgs: 2,
    offroadKmh: 30,
    roadKmh: 53,
    reliability: 4,
    costK: 26,
  },
};

describe("hist conversions", () => {
  test("integer helpers", () => {
    expect([0, 1, 15, 16, 17, 10 ** 6].map(isqrt)).toEqual([
      0, 1, 3, 4, 4, 1000,
    ]);
    expect(
      interp(
        [
          [0, 0],
          [10, 100],
        ],
        5,
      ),
    ).toBe(50);
    expect(
      interp(
        [
          [0, 0],
          [10, 100],
        ],
        99,
      ),
    ).toBe(100);
  });

  test("catalogue ids are unique, in their country, with real techs", () => {
    const seen = new Set<string>();
    for (const e of HIST_ALL) {
      expect(seen.has(e.id)).toBe(false);
      seen.add(e.id);
      expect(e.id.startsWith(e.country.toLowerCase() + "_")).toBe(true);
      for (const t of e.techs) expect(WW_TECH_IDS).toContain(t);
      expect(histEntry(e.id)).toBe(e);
      expect(e.source.length).toBeGreaterThan(5);
    }
  });

  test("conversions are pure and integer", () => {
    for (const e of HIST_ALL) {
      expect(histStatsOf(e)).toEqual(histStatsOf(e));
      for (const v of Object.values(histStatsOf(e))) {
        if (typeof v === "number") expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  test("the threshold rule reads the real figures", () => {
    const tiger = tankStatsOfEntry(histEntry("deu_tiger1_e") as TankEntry);
    const panther = tankStatsOfEntry(histEntry("deu_panther_a") as TankEntry);
    const t = tankStatsOfEntry(t34);
    const pz3 = tankStatsOfEntry(histEntry("deu_pz3_e") as TankEntry);
    expect(tiger.pierce).toBeGreaterThan(t.armor);
    expect(t.pierce).toBeLessThan(tiger.armor);
    expect(panther.pierce).toBeGreaterThan(t.armor);
    expect(pz3.pierce).toBeLessThan(t.armor);
    expect(t.pierce).toBeGreaterThan(pz3.armor);
  });

  test("slope counts, softened", () => {
    expect(effectiveArmorMm({ ...t34.spec, turretFrontMm: undefined })).toBe(
      79,
    );
    expect(
      effectiveArmorMm({
        ...t34.spec,
        hullSlopeDeg: 0,
        turretFrontMm: undefined,
      }),
    ).toBe(45);
  });

  test("1936-39 baseline: a Pz III E is today's generation-1 medium tank", () => {
    const s = tankStatsOfEntry(histEntry("deu_pz3_e") as TankEntry);
    expect(s.costMilli).toBeGreaterThan(11_000);
    expect(s.costMilli).toBeLessThan(13_000);
    expect(s.armor).toBeGreaterThan(2500);
    expect(s.armor).toBeLessThan(4500);
    expect(s.pierce).toBeGreaterThan(2500);
    expect(s.pierce).toBeLessThan(4500);
  });

  test("costs are real ratios", () => {
    const c = (id: string) =>
      tankStatsOfEntry(histEntry(id) as TankEntry).costMilli;
    expect(c("deu_tiger1_e") / c("deu_pz3_e")).toBeGreaterThan(2.4);
    expect(tankStatsOfEntry(t34).costMilli * 3).toBeLessThan(c("deu_tiger1_e"));
  });

  test("unreliable stays below reliable", () => {
    const r = (id: string) =>
      tankStatsOfEntry(histEntry(id) as TankEntry).relPm;
    expect(r("deu_tiger2_b")).toBeLessThan(r("deu_panther_a"));
    expect(r("deu_panther_a")).toBeLessThan(tankStatsOfEntry(t34).relPm);
  });

  test("planes: a Bf 109 E class fighter reads as the generation-1 fighter", () => {
    const f: PlaneEntry = {
      ...base,
      id: "deu_bf109e_test",
      country: "DEU",
      family: "plane",
      type: "fighter",
      spec: {
        maxKmh: 560,
        rangeKm: 660,
        emptyKg: 2000,
        wingLoad: 172,
        guns: [
          { mm: 7.92, count: 2, rpm: 1000 },
          { mm: 20, count: 2, rpm: 520 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 20,
      },
    };
    const s = planeStatsOfEntry(f);
    expect(s.airAttack).toBeGreaterThan(1500);
    expect(s.airAttack).toBeLessThan(2200);
    expect(s.costMilli).toBe(22_000);
    expect(s.speed).toBe(504);
    const h: PlaneEntry = {
      ...f,
      id: "deu_he111_test",
      type: "bomber",
      spec: {
        ...f.spec,
        maxKmh: 440,
        emptyKg: 7700,
        wingLoad: 150,
        guns: [],
        defGuns: 5,
        bombKg: 2000,
        costK: 60,
      },
    };
    const b = planeStatsOfEntry(h);
    expect(b.ground).toBe(600);
    expect(b.strategic).toBe(400);
    expect(b.agility).toBeLessThan(s.agility);
  });

  test("ships: a destroyer and a battleship land on the generation-1 rows", () => {
    const dd: ShipEntry = {
      ...base,
      id: "usa_dd_test",
      country: "USA",
      family: "ship",
      cls: "dd",
      spec: {
        dispT: 1500,
        main: { count: 5, mm: 127 },
        beltMm: 0,
        speedKn: 34,
        rangeNm: 3500,
        torpTubes: 8,
        torpWarheadKg: 320,
        asw: 1,
        aaLight: [{ count: 2, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 7.5,
      },
    };
    const d = shipStatsOfEntry(dd);
    expect(d.hpMilli).toBe(15_000);
    expect(d.torpedo).toBe(1600);
    expect(d.cost).toBe(1200);
    const bb: ShipEntry = {
      ...dd,
      id: "usa_bb_test",
      cls: "bb",
      spec: {
        ...dd.spec,
        dispT: 36000,
        main: { count: 9, mm: 406 },
        beltMm: 330,
        speedKn: 23,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        costM: 78,
      },
    };
    const s = shipStatsOfEntry(bb);
    expect(s.hpMilli).toBe(150_000);
    expect(s.heavy).toBeGreaterThan(4500);
    expect(s.heavy).toBeLessThan(5600);
    expect(s.armor).toBe(4800);
    expect(s.cost).toBeGreaterThan(11_000);
    expect(s.cost).toBeLessThan(14_000);
  });

  test("infantry weapons and guns stay within about +-20 percent", () => {
    const kar: InfantryEntry = {
      ...base,
      id: "deu_kar98k_test",
      country: "DEU",
      family: "infantry",
      spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 30 },
    };
    expect(infantryStatsOfEntry(kar).statPct).toBe(100);
    const garand: InfantryEntry = {
      ...kar,
      spec: {
        ...kar.spec,
        aimedRpm: 30,
        rangeM: 460,
        autoPct: 20,
        costUsd: 85,
      },
    };
    const g = infantryStatsOfEntry(garand);
    expect(g.statPct).toBeGreaterThan(100);
    expect(g.statPct).toBeLessThanOrEqual(120);
    const pak: GunEntry = {
      ...base,
      id: "deu_pak36_test",
      country: "DEU",
      family: "gun",
      role: "anti_tank",
      spec: {
        mm: 37,
        rpm: 15,
        rangeM: 4000,
        shellKg: 0.68,
        penMm500: 29,
        massKg: 432,
        barrels: 1,
        costK: 2.2,
      },
    };
    const p = gunStatsOfEntry(pak);
    expect(p.statPct).toBeGreaterThanOrEqual(99);
    expect(p.statPct).toBeLessThanOrEqual(101);
    expect(p.pierceCenti).toBe(2900);
    const flak88: GunEntry = {
      ...pak,
      id: "deu_flak88_test",
      role: "anti_tank",
      spec: {
        ...pak.spec,
        mm: 88,
        rpm: 15,
        shellKg: 9.4,
        penMm500: 110,
        rangeM: 14800,
        costK: 15,
      },
    };
    expect(gunStatsOfEntry(flak88).statPct).toBeLessThanOrEqual(120);
    expect(gunStatsOfEntry(flak88).pierceCenti).toBeGreaterThan(t34 ? 7000 : 0);
  });

  test("prints the table", () => {
    const lines = histTableLines(HIST_ALL);
    console.log("\n" + lines.join("\n"));
    expect(lines.length).toBeGreaterThan(HIST_ALL.length);
  });
});

describe("designer flag", () => {
  test("absent means off", async () => {
    const { wwDesigner } =
      await import("@openfront/engine-lib/ww1936/ModeConfig");
    expect(wwDesigner({})).toBe(false);
    expect(wwDesigner({ ww1936Designer: false })).toBe(false);
    expect(wwDesigner({ ww1936Designer: true })).toBe(true);
  });
});

describe("slots and static names", () => {
  test("a static key falls back to the generic name where the country has no stand-in", async () => {
    const { histStaticName, histEntriesGatedBy } =
      await import("@openfront/engine-lib/ww1936/hist/Slots");
    expect(histStaticName("DEU", "light_tank", 1)).toMatch(
      /^ww1936\.hist\.deu_/,
    );
    expect(histStaticName("DEU", "convoy", 1)).toBeNull();
    expect(histEntriesGatedBy("heavy_tank_1", "DEU").length).toBeGreaterThan(0);
    expect(histEntriesGatedBy("no_such_tech").length).toBe(0);
  });
});
