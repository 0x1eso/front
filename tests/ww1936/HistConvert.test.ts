import {
  DS_AMPHIBIOUS,
  DS_FLAIL,
  DS_FLAME,
  DS_HIST,
  DS_RECON,
} from "@openfront/engine-api/ww1936/DepthTypes";
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
    // 45 mm at 60 degrees is a thin plate: it keeps 2/3 of the slope bonus (65, not 79)
    expect(effectiveArmorMm({ ...t34.spec, turretFrontMm: undefined })).toBe(
      65,
    );
    // a thick plate keeps all of it: 100 mm at 60 degrees is 175
    expect(
      effectiveArmorMm({
        ...t34.spec,
        hullFrontMm: 100,
        turretFrontMm: undefined,
      }),
    ).toBe(175);
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
    expect(c("deu_tiger1_e") / c("deu_pz3_e")).toBeGreaterThan(2);
    expect(tankStatsOfEntry(t34).costMilli * 2).toBeLessThan(c("deu_tiger1_e"));
  });

  test("cross-country audit: same gun, same penetration; real threats hold", () => {
    const tk = (id: string) => tankStatsOfEntry(histEntry(id) as TankEntry);
    const same = (ids: string[]) => {
      const vals = ids.map((id) => tk(id).pierce);
      expect(new Set(vals).size).toBe(1);
    };
    same(["sun_t34_40", "sun_t34_43", "sun_kv1", "sun_kv1s", "sun_su76m"]); // F-34, ZiS-5, ZiS-3
    same(["usa_m4a1_sherman", "usa_m24_chaffee", "gbr_cromwell_iv"]); // 75 mm M3 family
    same(["usa_m4a3_76", "usa_m4a3e8", "usa_m18_hellcat", "usa_m10"]); // 76 mm M1, 3-inch M7
    same(["deu_panther_a", "deu_jagdpz4_70"]); // L/70
    same(["deu_tiger2_b", "deu_jagdpanther"]); // L/71
    same(["deu_pz4_h", "deu_stug3_g", "deu_hetzer"]); // L/48
    // A T-34 threatens a Panzer III's front; a Panzer III's gun does not answer.
    expect(tk("sun_t34_43").pierce).toBeGreaterThan(tk("deu_pz3_j").armor);
    expect(tk("deu_pz3_j").pierce).toBeLessThan(tk("sun_t34_43").armor);
    // The Sherman's 76 mm does not defeat a Tiger's front, the 90 mm does.
    expect(tk("usa_m4a3_76").pierce).toBeLessThan(tk("deu_tiger1_e").armor);
    expect(tk("usa_m26_pershing").pierce).toBeGreaterThan(
      tk("deu_tiger1_e").armor,
    );
  });

  test("cross-country audit: one cost basis, nothing past the era", () => {
    const tk = (id: string) =>
      tankStatsOfEntry(histEntry(id) as TankEntry).costMilli;
    const order = [
      "sun_t34_43",
      "usa_m4a1_sherman",
      // ww73: a medium never costs more than the generic medium of its
      // generation (18,000 at the third), so the Panther sits under the
      // heavies that have no generic twin.
      "deu_panther_a",
      "usa_m26_pershing",
      "deu_tiger1_e",
    ].map(tk);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(tk("sun_is2")).toBeLessThan(tk("deu_tiger1_e"));
    for (const e of HIST_ALL) expect(e.year).toBeLessThanOrEqual(1950);
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
    expect(s.costMilli).toBeGreaterThan(15_000);
    expect(s.costMilli).toBeLessThan(25_000);
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
    expect(d.cost).toBeGreaterThan(900);
    expect(d.cost).toBeLessThan(1500);
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

  test("w68: casemates sit below the turreted heavies; thin plates gain less", () => {
    const tk = (id: string) => tankStatsOfEntry(histEntry(id) as TankEntry);
    const tiger = tk("deu_tiger1_e").armorMm;
    expect(tk("deu_hetzer").armorMm).toBeLessThan(tiger * 0.85);
    expect(tk("deu_jagdpz4_70").armorMm).toBeLessThanOrEqual(tiger);
    // the Hetzer's 60 mm at 60 degrees: plain 1.75x would be 105
    expect(tk("deu_hetzer").armorMm).toBeLessThan(90);
    // Tiger's gun still defeats a T-34, the T-34's does not defeat the Tiger's front
    expect(tk("deu_tiger1_e").pierce).toBeGreaterThan(tk("sun_t34_43").armor);
    expect(tk("sun_t34_43").pierce).toBeLessThan(tk("deu_tiger1_e").armor);
  });

  test("w68: fighter attack counts cannon and gun quality; bombers' fixed guns are discounted", () => {
    const pl = (id: string) => planeStatsOfEntry(histEntry(id) as PlaneEntry);
    // the late cannon fighter is above its early version
    expect(pl("deu_bf109_f4").airAttack).toBeGreaterThan(
      pl("deu_bf109_e").airAttack,
    );
    expect(pl("deu_bf109_g6").airAttack).toBeGreaterThan(
      pl("deu_bf109_f4").airAttack,
    );
    // cannon (Spitfire IX) over six .50 (P-51D); one 20 mm over eight rifle-calibre guns
    expect(pl("gbr_spitfire_ix").airAttack).toBeGreaterThan(
      pl("usa_p51d").airAttack,
    );
    expect(pl("fra_d510").airAttack).toBeGreaterThan(
      pl("gbr_hurricane_i").airAttack,
    );
    // a bomber's attack is below a contemporary fighter's
    expect(pl("usa_b25j").airAttack).toBeLessThan(
      pl("gbr_spitfire_v").airAttack,
    );
    expect(pl("sun_tu2").airAttack).toBeLessThan(pl("sun_yak9").airAttack);
    // soft caps: the jet with four 30 mm stays above the Fw 190 A-8, which stays above the Bf 109 G-6
    expect(pl("deu_me262_a1").airAttack).toBeGreaterThan(
      pl("deu_fw190_a8").airAttack,
    );
    expect(pl("deu_fw190_a8").airAttack).toBeGreaterThan(
      pl("deu_bf109_g6").airAttack,
    );
    expect(pl("deu_me262_a1").airAttack).toBeLessThanOrEqual(4000);
    expect(pl("usa_a20g").ground).toBeLessThan(pl("usa_sb2c").ground);
  });

  test("w68: SP artillery differs by calibre; guns spread without a flat top", () => {
    const soft = (id: string) =>
      tankStatsOfEntry(histEntry(id) as TankEntry).soft;
    expect(soft("deu_wespe")).toBeLessThan(soft("sun_su122"));
    expect(soft("sun_su122")).toBeLessThan(soft("deu_hummel"));
    const g = (id: string) => gunStatsOfEntry(histEntry(id) as GunEntry);
    const at = ["deu_pak36", "deu_pak38", "deu_pak40", "deu_pak43"].map(
      (id) => g(id).statPct,
    );
    for (let i = 1; i < at.length; i++)
      expect(at[i]).toBeGreaterThan(at[i - 1]);
    expect(Math.max(...at)).toBeLessThan(130);
    const aa = ["deu_flak38", "deu_flak36_88", "usa_m1_90aa"].map((id) =>
      g(id),
    );
    expect(aa[0].costMilli).toBeLessThan(aa[1].costMilli);
    expect(aa[1].costMilli).toBeLessThan(aa[2].costMilli);
    expect(g("usa_m1_90aa").costMilli).toBeLessThanOrEqual(4 * 4000);
    // real penetration is untouched
    expect(g("deu_pak40").pierceCenti).toBe(
      100 * (histEntry("deu_pak40") as GunEntry).spec.penMm500,
    );
  });

  test("w68: ship gunnery counts the rate of fire; sub ranges are compressed", () => {
    const sh = (id: string) => shipStatsOfEntry(histEntry(id) as ShipEntry);
    expect(sh("usa_fletcher").light).toBeGreaterThan(sh("jpn_fubuki").light);
    expect(sh("usa_iowa").rangeKm).toBeLessThanOrEqual(12_000);
    expect(sh("jpn_i15").rangeKm).toBeLessThanOrEqual(12_000);
  });

  test("w68: typical cost of a family stays near today's generic, extremes only 2-3x", () => {
    const med = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1];
    const costs = (f: (e: (typeof HIST_ALL)[number]) => number | null) =>
      HIST_ALL.map(f).filter((v): v is number => v !== null);
    const medium = costs((e) =>
      e.family === "tank" && e.role === "medium"
        ? tankStatsOfEntry(e).costMilli
        : null,
    );
    expect(med(medium)).toBeLessThanOrEqual(15_000);
    const fighters = costs((e) =>
      e.family === "plane" && e.type === "fighter"
        ? planeStatsOfEntry(e).costMilli
        : null,
    );
    expect(med(fighters)).toBeLessThanOrEqual(27_500);
    const bombers = costs((e) =>
      e.family === "plane" && e.type === "bomber"
        ? planeStatsOfEntry(e).costMilli
        : null,
    );
    expect(med(bombers)).toBeLessThanOrEqual(37_500);
    const dds = costs((e) =>
      e.family === "ship" && e.cls === "dd" ? shipStatsOfEntry(e).cost : null,
    );
    expect(med(dds)).toBeLessThanOrEqual(1440);
    const pl = (id: string) =>
      planeStatsOfEntry(histEntry(id) as PlaneEntry).costMilli;
    // ww73: held to the generic strategic bomber of its generation (72,000).
    expect(pl("usa_b29") / pl("usa_b17g")).toBeGreaterThan(1.3);
    expect(pl("usa_b29") / pl("usa_b17g")).toBeLessThan(3);
    expect(pl("usa_b29")).toBeLessThan(150_000);
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

// ww73: production must not be slower than the old generic game.
describe("no slower than the generic item of the same type and generation", () => {
  test("light and medium tanks and every plane: cost and resources per factory", async () => {
    const { EQUIPMENT, unitCostMilli } =
      await import("@openfront/engine-lib/ww1936/Equipment");
    const { genOfTechs } =
      await import("@openfront/engine-lib/ww1936/hist/ConvertCost");
    let checked = 0;
    for (const e of HIST_ALL) {
      let type: keyof typeof EQUIPMENT | null = null;
      let prefix = "";
      if (e.family === "tank" && (e.role === "light" || e.role === "medium")) {
        type = e.role === "light" ? "light_tank" : "medium_tank";
        prefix = type;
      } else if (e.family === "plane") {
        type = e.type;
        prefix = e.type.replace(/^cv_/, "");
      } else if (e.family === "tank") {
        // No generic twin for the heavy and special roles, but never a resource
        // the generic medium tank does not ask for (rubber, tungsten).
        const s = tankStatsOfEntry(e);
        const g = EQUIPMENT.medium_tank.resources;
        s.resources.forEach((v, i) =>
          expect(v, e.id).toBeLessThanOrEqual(g[i]),
        );
      }
      if (type === null) continue;
      const s = histStatsOf(e) as { costMilli: number; resources: number[] };
      expect(s.costMilli, e.id).toBeLessThanOrEqual(
        unitCostMilli(type, genOfTechs(e.techs, prefix)),
      );
      s.resources.forEach((v, i) =>
        expect(v, `${e.id} resource ${i}`).toBeLessThanOrEqual(
          EQUIPMENT[type!].resources[i],
        ),
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  test("the German armoured cars need no rubber and the Panzer II costs the generic light tank", async () => {
    const { EQUIPMENT } =
      await import("@openfront/engine-lib/ww1936/Equipment");
    const pz2 = tankStatsOfEntry(histEntry("deu_pz2_c") as TankEntry);
    expect(pz2.costMilli).toBeLessThanOrEqual(8000);
    expect(pz2.resources).toEqual([...EQUIPMENT.light_tank.resources]);
    const car = tankStatsOfEntry(histEntry("deu_sdkfz231") as TankEntry);
    expect(car.costMilli).toBeLessThanOrEqual(8000);
    expect(car.resources).toEqual([...EQUIPMENT.light_tank.resources]);
  });

  test("every ship: the yard days of the line are never above the generic class and generation", async () => {
    const { genOfTechs } =
      await import("@openfront/engine-lib/ww1936/hist/ConvertCost");
    const { histShipMods } =
      await import("@openfront/engine-lib/ww1936/hist/AsDesign");
    const { lineUnitCost } =
      await import("@openfront/engine-lib/ww1936/ShipStats");
    let n = 0;
    for (const e of HIST_ALL) {
      if (e.family !== "ship") continue;
      // The line is a generation-1 line of the class with the entry as its design.
      const lineCost = Math.floor(
        (lineUnitCost(e.cls, 1) * (100 + histShipMods(e).costPct)) / 100,
      );
      const generic = lineUnitCost(e.cls, genOfTechs(e.techs, e.cls));
      // A percent rounding of one in a hundred at most.
      expect(lineCost, e.id).toBeLessThanOrEqual(Math.ceil(generic * 1.01));
      n++;
    }
    expect(n).toBeGreaterThan(60);
  });
});

describe("w77: special abilities of catalogue vehicles", () => {
  const flagsOf = (e: TankEntry) =>
    (tankStatsOfEntry(e) as { flags: number }).flags;

  test("spec fields set the designer's own flags on the catalogue row", () => {
    expect(flagsOf(t34) & DS_AMPHIBIOUS).toBe(0);
    for (const [field, flag] of [
      ["amphibious", DS_AMPHIBIOUS],
      ["flame", DS_FLAME],
      ["flail", DS_FLAIL],
    ] as const) {
      const e: TankEntry = { ...t34, spec: { ...t34.spec, [field]: true } };
      expect(flagsOf(e) & flag, field).toBe(flag);
      expect(flagsOf(e) & DS_HIST, field).toBe(DS_HIST);
    }
    const recon: PlaneEntry = {
      ...base,
      id: "x_recon",
      country: "DEU",
      family: "plane",
      type: "fighter",
      spec: {
        maxKmh: 560,
        rangeKm: 900,
        emptyKg: 2500,
        wingLoad: 170,
        guns: [],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        recon: true,
        reliability: 3,
        costK: 40,
      },
    };
    expect(
      (planeStatsOfEntry(recon) as { flags: number }).flags & DS_RECON,
    ).toBe(DS_RECON);
    expect(
      (
        planeStatsOfEntry({
          ...recon,
          spec: { ...recon.spec, recon: false },
        }) as {
          flags: number;
        }
      ).flags & DS_RECON,
    ).toBe(0);
  });

  test("only the vehicles that really were amphibious carry the flag", () => {
    const amphibious = HIST_ALL.filter(
      (e): e is TankEntry => e.family === "tank" && e.spec.amphibious === true,
    ).map((e) => e.id);
    expect(amphibious.sort()).toEqual(["jpn_type2_kami", "sun_t40"]);
    for (const id of amphibious) {
      expect(flagsOf(histEntry(id) as TankEntry) & DS_AMPHIBIOUS, id).toBe(
        DS_AMPHIBIOUS,
      );
    }
    // No catalogue entry is a flame tank, a flail or a recon plane yet.
    expect(
      HIST_ALL.some(
        (e) =>
          (e.family === "tank" &&
            (e.spec.flame === true || e.spec.flail === true)) ||
          (e.family === "plane" && e.spec.recon === true),
      ),
    ).toBe(false);
  });
});
