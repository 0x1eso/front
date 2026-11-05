// Owner, 2026-11-05: generic equipment is clearly, reliably weaker than
// historical equipment, with the designer off. The rule reads the catalogue,
// so a new entry below today's rows fails nothing and moves the rows down.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { histStatsOf } from "@openfront/engine-lib/ww1936/hist/Convert";
import type { GearStats } from "@openfront/engine-lib/ww1936/hist/ConvertGear";
import { planeStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertPlane";
import {
  shipPowerOf,
  shipStatsOfEntry,
} from "@openfront/engine-lib/ww1936/hist/ConvertShip";
import { tankStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";
import { histStaticEntry } from "@openfront/engine-lib/ww1936/hist/Slots";
import type { HistCountry } from "@openfront/engine-lib/ww1936/hist/Types";
import {
  realPlanes,
  realShips,
  realTanks,
  weakKeyRow,
  weakPlaneNumbers,
  weakPlaneStats,
  weakShipPower,
  weakShipStats,
  weakStaticPlaneScore,
} from "@openfront/engine-lib/ww1936/hist/WeakGeneric";
import { planeScore } from "@openfront/engine-lib/ww1936/PlaneScore";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  rowScore,
  STATIC_KEY_STATS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";

const weakTable = () => {
  const t = {
    group: STATIC_KEY_STATS.group.slice(),
    year: STATIC_KEY_STATS.year.slice(),
    score: STATIC_KEY_STATS.score.slice(),
    stats: STATIC_KEY_STATS.stats.slice(),
  };
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) weakKeyRow(t, j);
  return t;
};

describe("generic use is below every real entry of its group", () => {
  test("planes, by type and generation, on the planes' score", () => {
    for (const type of AIR_TYPES) {
      for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
        const real = realPlanes(type, g).map((e) => {
          const s = planeStatsOfEntry(e);
          return planeScore(type, {
            airAtk: s.airAttack,
            airDef: s.airDefense,
            agility: s.agility,
            speed: s.speed,
            range: s.range,
            ground: s.ground,
            strat: s.strategic,
            naval: s.naval,
          });
        });
        expect(real.length).toBeGreaterThan(0);
        expect(weakStaticPlaneScore(type, g)).toBeLessThan(Math.min(...real));
      }
    }
  });

  test("ships, by class and generation, on the ships' power", () => {
    for (const cls of SHIP_CLASSES) {
      for (let g = 1; g <= 4; g++) {
        const real = realShips(cls, g).map((e) =>
          shipPowerOf(shipStatsOfEntry(e)),
        );
        expect(real.length).toBeGreaterThan(0);
        expect(weakShipPower(cls, g)).toBeLessThan(Math.min(...real));
      }
    }
  });

  test("ship anti-air too: at most 70 % of the median", () => {
    for (const cls of SHIP_CLASSES) {
      if (cls === "ss") continue;
      const st = shipStats(cls, 1, emptyStats(), new Set());
      const aa = realShips(cls, 1)
        .map((e) => shipStatsOfEntry(e).aa)
        .filter((v) => v > 0)
        .sort((a, b) => a - b);
      const median = aa[Math.floor((aa.length - 1) / 2)];
      expect(weakShipStats(st, cls, 1).aa * 100).toBeLessThanOrEqual(
        median * 70,
      );
    }
  });

  test("tanks and gear, on their row's score and percent", () => {
    const t = weakTable();
    const scratch = new Int32Array(KS_FIELDS);
    for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
      const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
      if (type === "light_tank" || type === "medium_tank") {
        for (const e of realTanks(type, gen)) {
          const s = tankStatsOfEntry(e);
          scratch[KS.soft] = s.soft;
          scratch[KS.hard] = s.hard;
          scratch[KS.def] = s.def;
          scratch[KS.brk] = s.brk;
          scratch[KS.pierce] = s.pierce;
          scratch[KS.armor] = s.armor;
          scratch[KS.aa] = s.aa;
          expect(t.score[j]).toBeLessThan(
            rowScore(scratch, 0, t.group[j], t.year[j]),
          );
        }
        continue;
      }
      if (type === "motorized" || type === "support_equipment") continue;
      const generic = STATIC_KEY_STATS.stats[j * KS_FIELDS + KS.soft];
      const weak = t.stats[j * KS_FIELDS + KS.soft];
      for (const c of Object.keys(HIST_CATALOGUE) as HistCountry[]) {
        const e = histStaticEntry(c, type, gen);
        if (e === undefined) continue;
        expect(weak * 100).toBeLessThan(
          generic * (histStatsOf(e) as GearStats).statPct,
        );
        expect(weak * 100).toBeLessThanOrEqual(generic * 80);
      }
    }
  });

  test("no number falls from one generation to the next", () => {
    for (const type of AIR_TYPES) {
      for (let g = 2; g <= EQUIPMENT_GENS[type]; g++) {
        const a = weakPlaneNumbers(type, g - 1);
        const b = weakPlaneNumbers(type, g);
        for (const k of Object.keys(a) as (keyof typeof a)[]) {
          expect(b[k]).toBeGreaterThanOrEqual(a[k] - 1);
        }
      }
    }
  });
});

describe("generic use leaves the rest alone", () => {
  test("the shared generic numbers and a ship's cost do not move", () => {
    const st = shipStats("bb", 1, emptyStats(), new Set());
    expect(st.hpMilli).toBe(150_000);
    expect(weakShipStats(st, "bb", 1).cost).toBe(st.cost);
    expect(planeStats("fighter", 1, emptyStats(), new Set()).airAtk).toBe(1800);
  });

  test("a fighter's reach is not cut, and country percents still count", () => {
    const stats = { ...emptyStats(), airAttackPct: 50 };
    const a = weakPlaneStats(
      planeStats("fighter", 1, emptyStats(), new Set()),
      "fighter",
      1,
    );
    const b = weakPlaneStats(
      planeStats("fighter", 1, stats, new Set()),
      "fighter",
      1,
    );
    expect(a.rangeKm).toBe(650);
    expect(b.airAtk).toBeGreaterThan(a.airAtk);
  });

  test("an anti-air battalion's air attack follows its key; the generic table reads as before", () => {
    const def = {
      name: "AA",
      battalions: ["infantry", "anti_air"],
      support: [],
    };
    const gens = new Array(64).fill(0).map((_, i) => (i < 24 ? 100 : 0));
    const a = templateStats(def as never, {} as never, gens);
    const b = templateStats(def as never, {} as never, gens, weakTable());
    expect(b.airAtk).toBeLessThan(a.airAtk);
    expect(b.soft).toBeLessThan(a.soft);
  });
});
