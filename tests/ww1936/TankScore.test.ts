// Tank design reform, phase 1: the performance score, the "old" rule and the
// draw order by score (engine-lib, pure).
import {
  KeyStatsTable,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
  NG_HEAVY,
  NG_SPA,
  NG_SPAA,
  NG_TD,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  designNeedGroup,
  recommendedTank,
  TANK_BASE_DEFS,
  tankStats,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import {
  groupDrawSlots,
  isOldScore,
  oldInfoOf,
  rowScore,
  STATIC_KEY_STATS,
  TANK_OLD_PCT,
} from "@openfront/engine-lib/ww1936/TemplateStats";

const ALL = new Set<WwTechId>(WW_TECH_IDS);
const ROLES = [
  "tank",
  "tank_destroyer",
  "sp_artillery",
  "sp_anti_air",
] as const;

/** The score of a chassis at its recommended fit for a role, and the need group it lands in. */
function fitScore(base: string, role: (typeof ROLES)[number]) {
  const def = recommendedTank(base, ALL, role);
  const s = tankStats(def, { techs: ALL, projects: -1, relPp: 0, costPct: 0 });
  const row = new Int32Array(KS_FIELDS);
  row[KS.soft] = s.soft;
  row[KS.hard] = s.hard;
  row[KS.def] = s.def;
  row[KS.brk] = s.brk;
  row[KS.pierce] = s.pierce;
  row[KS.armor] = s.armor;
  row[KS.aa] = s.aa;
  return { score: rowScore(row, 0, s.group, s.year), group: s.group, row };
}

/** The chassis lines: a heavier chassis never replaces a lighter one in the score order of its own line. */
const LINES = [
  ["light_1", "light_2"],
  ["medium_1", "medium_2", "medium_3", "modern_1"],
  ["heavy_1", "heavy_2", "heavy_3", "super_heavy_1"],
];

describe("tank performance score", () => {
  it("static tanks rise with generation", () => {
    for (const type of ["light_tank", "medium_tank"] as const) {
      let last = 0;
      for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
        const [t] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
        if (t !== type) continue;
        expect(STATIC_KEY_STATS.score[j]).toBeGreaterThan(last);
        last = STATIC_KEY_STATS.score[j];
      }
    }
  });

  it.each(ROLES)("base-fit designs rise with the chassis (%s)", (role) => {
    for (const line of LINES) {
      let last = 0;
      for (const base of line) {
        const f = fitScore(base, role);
        // (A fit that falls out of the role's group, e.g. a super gun, is no tank destroyer.)
        if (role === "tank_destroyer" && f.group !== NG_TD) continue;
        expect(f.score, `${role} ${base}`).toBeGreaterThan(last);
        last = f.score;
      }
    }
  });

  it("a design and a static tank stand on one scale", () => {
    for (const [base, type, gen] of [
      ["light_1", "light_tank", 1],
      ["light_2", "light_tank", 2],
      ["medium_1", "medium_tank", 1],
      ["medium_2", "medium_tank", 2],
      ["medium_3", "medium_tank", 3],
    ] as const) {
      const j = GROUND_EQUIP_KEYS.findIndex(
        (k) => EQUIP_KEYS[k][0] === type && EQUIP_KEYS[k][1] === gen,
      );
      const st = STATIC_KEY_STATS.score[j];
      const d = fitScore(base, "tank").score;
      expect(Math.abs(d - st) * 100, base).toBeLessThan(st * 25);
    }
  });

  it("static tanks and chassis tie to the same techs (cells absorb statics)", () => {
    for (const [base, type, gen] of [
      ["light_1", "light_tank", 1],
      ["light_2", "light_tank", 2],
      ["medium_1", "medium_tank", 1],
      ["medium_2", "medium_tank", 2],
      ["medium_3", "medium_tank", 3],
    ] as const) {
      expect(TANK_BASE_DEFS[base].tech).toBe(EQUIPMENT[type].techs[gen - 1]);
    }
  });

  it("the role changes what counts", () => {
    const td = fitScore("medium_2", "tank_destroyer");
    const spa = fitScore("medium_2", "sp_artillery");
    const spaa = fitScore("medium_2", "sp_anti_air");
    expect([td.group, spa.group, spaa.group]).toEqual([NG_TD, NG_SPA, NG_SPAA]);
    // Raising the anti-air number lifts only the anti-air score.
    const more = Int32Array.from(spaa.row);
    more[KS.aa] += 1000;
    expect(rowScore(more, 0, NG_SPAA, 1940)).toBeGreaterThan(spaa.score);
    expect(rowScore(more, 0, NG_SPA, 1940)).toBe(
      rowScore(spaa.row, 0, NG_SPA, 1940),
    );
    expect(designNeedGroup(recommendedTank("heavy_1", ALL, "tank"))).toBe(
      NG_HEAVY,
    );
  });

  it("non-tank groups rank by year as before", () => {
    // Every group but the tank groups keeps the year as its score.
    for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
      const [t] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
      if (t === "light_tank" || t === "medium_tank") continue;
      expect(STATIC_KEY_STATS.score[j]).toBe(STATIC_KEY_STATS.year[j]);
    }
  });
});

describe("old keys", () => {
  it("is old strictly beyond 15 % below the best", () => {
    expect(TANK_OLD_PCT).toBe(15);
    expect(isOldScore(850, 1000)).toBe(false);
    expect(isOldScore(849, 1000)).toBe(true);
    expect(isOldScore(1000, 1000)).toBe(false);
  });

  const slotOf = (type: string, gen: number) =>
    GROUND_EQUIP_KEYS.findIndex(
      (k) => EQUIP_KEYS[k][0] === type && EQUIP_KEYS[k][1] === gen,
    );

  it("judges static tanks by the techs the country has", () => {
    const l1 = slotOf("light_tank", 1);
    const l2 = slotOf("light_tank", 2);
    const only1 = oldInfoOf(STATIC_KEY_STATS, new Set(["light_tank_1"]));
    expect(only1.old[l1]).toBe(0);
    const both = oldInfoOf(
      STATIC_KEY_STATS,
      new Set(["light_tank_1", "light_tank_2"]),
    );
    expect(both.old[l1]).toBe(1);
    expect(both.old[l2]).toBe(0);
  });

  it("a design joins the comparison, and draw order follows the score", () => {
    const m1 = slotOf("medium_tank", 1);
    const m3 = slotOf("medium_tank", 3);
    const dslot = GROUND_STATIC_SLOTS; // design 1
    const ks: KeyStatsTable = {
      group: STATIC_KEY_STATS.group.slice(),
      year: STATIC_KEY_STATS.year.slice(),
      score: STATIC_KEY_STATS.score.slice(),
      stats: STATIC_KEY_STATS.stats.slice(),
    };
    const g = ks.group[m1];
    ks.group[dslot] = g;
    ks.year[dslot] = 1936;
    // A design that outscores medium III, with the oldest year.
    ks.score[dslot] = ks.score[m3] + 100;
    const order = groupDrawSlots(ks, g);
    expect(order[0]).toBe(dslot);
    expect(order.slice(1)).toEqual([
      slotOf("medium_tank", 3),
      slotOf("medium_tank", 2),
      m1,
    ]);
    const info = oldInfoOf(
      ks,
      new Set(["medium_tank_1", "medium_tank_2", "medium_tank_3"]),
    );
    expect(info.best[g]).toBe(ks.score[dslot]);
    expect(info.old[dslot]).toBe(0);
    expect(info.old[m1]).toBe(1);
  });

  it("ties go to the smaller slot", () => {
    const m1 = slotOf("medium_tank", 1);
    const ks: KeyStatsTable = {
      group: STATIC_KEY_STATS.group.slice(),
      year: STATIC_KEY_STATS.year.slice(),
      score: STATIC_KEY_STATS.score.slice(),
      stats: STATIC_KEY_STATS.stats.slice(),
    };
    const g = ks.group[m1];
    ks.group[GROUND_STATIC_SLOTS] = g;
    ks.group[GROUND_STATIC_SLOTS + 1] = g;
    ks.score[GROUND_STATIC_SLOTS] = 9000;
    ks.score[GROUND_STATIC_SLOTS + 1] = 9000;
    const order = groupDrawSlots(ks, g);
    expect(order.slice(0, 2)).toEqual([
      GROUND_STATIC_SLOTS,
      GROUND_STATIC_SLOTS + 1,
    ]);
  });
});
