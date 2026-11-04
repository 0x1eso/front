// War overhaul (ww7) lane A: the luck of a land battle (design ww6 §2) as
// pure rules: the tactic tables and their counters, initiative and who picks
// second, the three roll purposes, the daily luck's range and mean, the
// reserves' chance, predictBattleRange around predictBattle, and the win
// table. The engine side (a real battle's rounds) is in Battles.test.ts.
import {
  BattalionId,
  BattleCtx,
  LAND_ATTACK_TACTICS,
  LAND_DEFENSE_TACTICS,
  SideSum,
  TemplateDef,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  addToSide,
  emptySide,
  predictBattle,
  predictBattleRange,
  WIN_PCT_AT,
  WIN_RATIO_AT_PM,
  winPctOf,
} from "@openfront/engine-lib/ww1936/CombatRules";
import * as Roll from "@openfront/engine-lib/ww1936/Roll";
import {
  AT_ASSAULT,
  AT_ATTACK,
  AT_BARRAGE,
  AT_BLITZ,
  AT_ENVELOP,
  AT_INFILTRATION,
  AT_SHOCK,
  COUNTER_OF_ATTACK,
  COUNTERED_BY_DEFENSE,
  DT_AMBUSH,
  DT_COUNTER,
  DT_DEFEND,
  DT_DEPTH,
  DT_ELASTIC,
  DT_HOLD,
  DT_WITHDRAW,
  initiativeOf,
  isCountered,
  LUCK_BATTLE_BP,
  LUCK_DAY_BP,
  LUCK_MAX_BP,
  luckBp,
  newTacticFx,
  newTacticSide,
  pickTactics,
  REINF_MAX_PCT,
  reinfPctOf,
  reinfRoll,
  tacticFx,
  type TacticSide,
} from "@openfront/engine-lib/ww1936/TacticRules";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";

const fx = (a: number, d: number) => ({ ...tacticFx(a, d, newTacticFx()) });
const ZERO = fx(AT_ATTACK, DT_DEFEND);

describe("tactics (design §2.2)", () => {
  test("the tables list every tactic once and the indices are the lists'", () => {
    expect(LAND_ATTACK_TACTICS[AT_ASSAULT]).toBe("assault");
    expect(LAND_ATTACK_TACTICS[AT_ENVELOP]).toBe("envelop");
    expect(LAND_DEFENSE_TACTICS[DT_AMBUSH]).toBe("ambush");
    expect(LAND_DEFENSE_TACTICS[DT_WITHDRAW]).toBe("withdraw");
    expect(COUNTER_OF_ATTACK).toHaveLength(LAND_ATTACK_TACTICS.length);
    expect(COUNTERED_BY_DEFENSE).toHaveLength(LAND_DEFENSE_TACTICS.length);
  });

  test("counters: assault-ambush, shock-elastic, infiltration-hold, blitz-depth, envelop-withdraw; attack and barrage have none", () => {
    expect(COUNTER_OF_ATTACK[AT_ASSAULT]).toBe(DT_AMBUSH);
    expect(COUNTER_OF_ATTACK[AT_SHOCK]).toBe(DT_ELASTIC);
    expect(COUNTER_OF_ATTACK[AT_INFILTRATION]).toBe(DT_HOLD);
    expect(COUNTER_OF_ATTACK[AT_BLITZ]).toBe(DT_DEPTH);
    expect(COUNTER_OF_ATTACK[AT_ENVELOP]).toBe(DT_WITHDRAW);
    expect(COUNTER_OF_ATTACK[AT_ATTACK]).toBe(-1);
    expect(COUNTER_OF_ATTACK[AT_BARRAGE]).toBe(-1);
    // The inverse: defend and counter counter nothing.
    expect(COUNTERED_BY_DEFENSE[DT_DEFEND]).toBe(-1);
    expect(COUNTERED_BY_DEFENSE[DT_COUNTER]).toBe(-1);
    expect(COUNTERED_BY_DEFENSE[DT_AMBUSH]).toBe(AT_ASSAULT);
    for (let a = 0; a < LAND_ATTACK_TACTICS.length; a++) {
      for (let d = 0; d < LAND_DEFENSE_TACTICS.length; d++) {
        expect(isCountered(a, d)).toBe(COUNTER_OF_ATTACK[a] === d);
      }
    }
  });

  test("a counter zeroes the countered tactic's effect and keeps its own", () => {
    // Assault: +25 % attack, +10 % org damage taken; ambush: its own +15 % attack.
    expect(fx(AT_ASSAULT, DT_DEFEND)).toMatchObject({
      attAtkBp: 2500,
      attOrgBp: 1000,
    });
    expect(fx(AT_ASSAULT, DT_AMBUSH)).toMatchObject({
      attAtkBp: 0,
      attOrgBp: 0,
      defAtkBp: 1500,
    });
    // Shock +30 %, countered by elastic (its −20 % org damage stays).
    expect(fx(AT_SHOCK, DT_DEFEND).attAtkBp).toBe(3000);
    expect(fx(AT_SHOCK, DT_ELASTIC)).toMatchObject({
      attAtkBp: 0,
      defOrgBp: -2000,
    });
    // Infiltration: reserves +15 / −10 points; hold stops it (+15 % block).
    expect(fx(AT_INFILTRATION, DT_DEFEND)).toMatchObject({
      attReinfPp: 15,
      defReinfPp: -10,
    });
    expect(fx(AT_INFILTRATION, DT_HOLD)).toMatchObject({
      attReinfPp: 0,
      defReinfPp: 0,
      defBlockBp: 1500,
    });
    // Blitz: +35 % attack and half entrenchment; depth stops both.
    expect(fx(AT_BLITZ, DT_DEFEND)).toMatchObject({
      attAtkBp: 3500,
      halveEntrench: true,
    });
    expect(fx(AT_BLITZ, DT_DEPTH)).toMatchObject({
      attAtkBp: 0,
      halveEntrench: false,
    });
    // Envelop: +15 % and the 20 % annihilation line (lane B reads `envelop`);
    // withdraw stops it, and is itself in play.
    expect(fx(AT_ENVELOP, DT_DEFEND)).toMatchObject({
      attAtkBp: 1500,
      envelop: true,
      withdraw: false,
    });
    expect(fx(AT_ENVELOP, DT_WITHDRAW)).toMatchObject({
      attAtkBp: 0,
      envelop: false,
      withdraw: true,
      attOrgBp: -2500,
      defOrgBp: -2500,
      attHpBp: -2500,
      defHpBp: -2500,
    });
  });

  test("barrage is never countered; attack and defend do nothing; counter works against everything", () => {
    for (let d = 0; d < LAND_DEFENSE_TACTICS.length; d++) {
      expect(fx(AT_BARRAGE, d).attSoftBp).toBe(2000);
      expect(fx(AT_BARRAGE, d).attAtkBp).toBe(d === DT_COUNTER ? -1000 : 0);
    }
    expect(ZERO).toEqual(newTacticFx());
    for (let a = 0; a < LAND_ATTACK_TACTICS.length; a++) {
      const f = fx(a, DT_COUNTER);
      expect(f.defAtkBp).toBe(2500);
      // Countering does not touch the other tactic's own bonus: −10 % on top.
      expect(f.attAtkBp).toBe(fx(a, DT_DEFEND).attAtkBp - 1000);
    }
    expect(fx(AT_ATTACK, DT_AMBUSH).defAtkBp).toBe(1500);
    expect(fx(AT_ATTACK, DT_HOLD).defBlockBp).toBe(1500);
  });
});

/** A side that is as strong in initiative as it can be, and one that is as weak. */
function strongSide(): TacticSide {
  return {
    ...newTacticSide(),
    skill: 5,
    level: 5,
    signal: true,
    recon: true,
    doctrine: 10,
    expTier: 3,
  };
}

describe("initiative (design §2.3) and who picks second", () => {
  test("it grows with the general, companies, doctrine and experience, within 0..100", () => {
    const weak = newTacticSide();
    expect(initiativeOf(weak, false)).toBe(20);
    expect(initiativeOf({ ...weak, skill: 3 }, false)).toBe(32);
    expect(initiativeOf({ ...weak, level: 4 }, false)).toBe(28);
    expect(initiativeOf({ ...weak, signal: true }, false)).toBe(30);
    expect(initiativeOf({ ...weak, recon: true }, false)).toBe(25);
    expect(initiativeOf({ ...weak, doctrine: 4 }, false)).toBe(24);
    expect(initiativeOf({ ...weak, expTier: 2 }, false)).toBe(26);
    const strong = initiativeOf(strongSide(), false);
    expect(strong).toBe(84);
    expect(strong).toBeLessThanOrEqual(100);
    expect(
      initiativeOf({ ...strongSide(), traits: -1, doctrine: 99 }, false),
    ).toBeLessThanOrEqual(100);
    expect(initiativeOf({ ...weak, skill: -50 }, false)).toBe(0);
  });

  test("offensive generals count for the attacker, defensive ones for the defender", () => {
    const base = newTacticSide();
    const off = { ...base, traits: traitBit("offensive_doctrine") };
    const def = { ...base, traits: traitBit("defensive_doctrine") };
    expect(initiativeOf(off, false)).toBe(initiativeOf(base, false) + 6);
    expect(initiativeOf(off, true)).toBe(initiativeOf(base, true));
    expect(initiativeOf(def, true)).toBe(initiativeOf(base, true) + 6);
    expect(initiativeOf(def, false)).toBe(initiativeOf(base, false));
  });

  test("the much higher side sees the other's pick and answers it", () => {
    // 80 points of difference: the second pick is certain.
    const hi = strongSide();
    const lo = newTacticSide();
    expect(
      initiativeOf(hi, true) - initiativeOf(lo, false),
    ).toBeGreaterThanOrEqual(50);
    const pick = { att: 0, def: 0 };
    // A defender with all the options (a fort), the attacker too (artillery,
    // armour, two directions, a fort).
    const opts = (s: TacticSide): TacticSide => ({
      ...s,
      artPm: 400,
      mechPm: 700,
      directions: 2,
      entrench: 4,
      fort: 1,
    });
    let countered = 0;
    let avoided = 0;
    for (let round = 1; round <= 400; round += 4) {
      // The defender is higher: its pick is the counter of the attacker's.
      pickTactics(7, 3, 100, round, opts(lo), opts(hi), pick);
      const c = COUNTER_OF_ATTACK[pick.att];
      if (c >= 0) {
        expect(pick.def).toBe(c);
        countered++;
      }
      // The attacker is higher: it never walks into the defender's counter.
      pickTactics(7, 3, 100, round, opts(hi), opts(lo), pick);
      expect(isCountered(pick.att, pick.def)).toBe(false);
      if (COUNTERED_BY_DEFENSE[pick.def] >= 0) avoided++;
    }
    // (Both kinds of pick came up.)
    expect(countered).toBeGreaterThan(20);
    expect(avoided).toBeGreaterThan(20);
  });

  test("with equal initiative both pick blind, so counters happen only by chance", () => {
    const s = (): TacticSide => ({
      ...newTacticSide(),
      artPm: 400,
      mechPm: 700,
      directions: 2,
      entrench: 4,
      fort: 1,
    });
    const pick = { att: 0, def: 0 };
    let hits = 0;
    let n = 0;
    for (let round = 1; round <= 2000; round += 4) {
      pickTactics(11, 5, 40, round, s(), s(), pick);
      n++;
      if (isCountered(pick.att, pick.def)) hits++;
    }
    // Neither never nor always.
    expect(hits).toBeGreaterThan(n * 0.05);
    expect(hits).toBeLessThan(n * 0.6);
  });

  test("preconditions: barrage needs 25 % artillery, blitz 50 % armour, envelop two directions, hold entrench 3 or a fort", () => {
    const seen = (att: TacticSide, def: TacticSide) => {
      const a = new Set<number>();
      const d = new Set<number>();
      const pick = { att: 0, def: 0 };
      for (let round = 1; round <= 4000; round += 4) {
        pickTactics(3, 8, 20, round, att, def, pick);
        a.add(pick.att);
        d.add(pick.def);
      }
      return { a, d };
    };
    const plain = seen(newTacticSide(), newTacticSide());
    for (const t of [AT_BARRAGE, AT_BLITZ, AT_ENVELOP]) {
      expect(plain.a.has(t)).toBe(false);
    }
    expect(plain.d.has(DT_HOLD)).toBe(false);
    expect(plain.a.has(AT_ASSAULT)).toBe(true);
    expect(plain.d.has(DT_AMBUSH)).toBe(true);
    const low = seen(
      { ...newTacticSide(), artPm: 249, mechPm: 499, directions: 1 },
      { ...newTacticSide(), entrench: 2, fort: 0 },
    );
    for (const t of [AT_BARRAGE, AT_BLITZ, AT_ENVELOP]) {
      expect(low.a.has(t)).toBe(false);
    }
    expect(low.d.has(DT_HOLD)).toBe(false);
    const full = seen(
      { ...newTacticSide(), artPm: 250, mechPm: 500, directions: 2 },
      { ...newTacticSide(), entrench: 3 },
    );
    for (const t of [AT_BARRAGE, AT_BLITZ, AT_ENVELOP]) {
      expect(full.a.has(t)).toBe(true);
    }
    expect(full.d.has(DT_HOLD)).toBe(true);
    // A fort alone allows hold.
    expect(
      seen(newTacticSide(), { ...newTacticSide(), fort: 2 }).d.has(DT_HOLD),
    ).toBe(true);
  });

  test("traits tilt the picks: offensive generals assault, defensive ones hold", () => {
    const count = (att: TacticSide, def: TacticSide) => {
      const a = new Array<number>(LAND_ATTACK_TACTICS.length).fill(0);
      const d = new Array<number>(LAND_DEFENSE_TACTICS.length).fill(0);
      const pick = { att: 0, def: 0 };
      for (let round = 1; round <= 8000; round += 4) {
        pickTactics(21, 4, 60, round, att, def, pick);
        a[pick.att]++;
        d[pick.def]++;
      }
      return { a, d };
    };
    const base = { ...newTacticSide(), entrench: 4 };
    const plain = count(base, base);
    const tilted = count(
      { ...base, traits: traitBit("offensive_doctrine") },
      { ...base, traits: traitBit("defensive_doctrine") },
    );
    expect(tilted.a[AT_ASSAULT]).toBeGreaterThan(plain.a[AT_ASSAULT]);
    expect(tilted.a[AT_SHOCK]).toBeGreaterThan(plain.a[AT_SHOCK]);
    expect(tilted.d[DT_HOLD]).toBeGreaterThan(plain.d[DT_HOLD]);
  });
});

describe("rolls: stateless and separate (design §2.1)", () => {
  test("the three purposes differ from each other and from every other purpose", () => {
    const purposes = Object.entries(Roll)
      .filter(([k, v]) => k.startsWith("P_") && typeof v === "number")
      .map(([, v]) => v as number);
    expect(new Set(purposes).size).toBe(purposes.length);
    expect(Roll.P_LAND_TACTIC).toBe(Roll.idHash("land_tactic"));
    expect(Roll.P_LAND_LUCK).toBe(Roll.idHash("land_luck"));
    expect(Roll.P_LAND_REINF).toBe(Roll.idHash("land_reinf"));
    // The same keys give different draws under different purposes.
    const k = [1234, 6, 900, 17] as const;
    const draws = [Roll.P_LAND_TACTIC, Roll.P_LAND_LUCK, Roll.P_LAND_REINF].map(
      (p) => Roll.wwRoll(k[0], p, k[1], k[2], k[3]),
    );
    expect(new Set(draws).size).toBe(3);
  });

  test("the same inputs give the same draw whatever ran before", () => {
    const first = luckBp(99, 6, 450, 12, 0);
    luckBp(1, 2, 3, 4, 5);
    reinfRoll(9, 9, 9, 9, 9);
    expect(luckBp(99, 6, 450, 12, 0)).toBe(first);
    expect(reinfRoll(5, 6, 7, 8, 9)).toBe(reinfRoll(5, 6, 7, 8, 9));
    const a = { att: 0, def: 0 };
    const b = { att: 0, def: 0 };
    const side = { ...newTacticSide(), entrench: 4 };
    pickTactics(5, 6, 7, 9, side, side, a);
    pickTactics(5, 6, 7, 9, side, side, b);
    expect(a).toEqual(b);
  });

  test("a battle's key changes the draws: region, start tick, round, side, division", () => {
    const base = luckBp(5, 6, 100, 3, 0);
    const others = [
      luckBp(5, 7, 100, 3, 0),
      luckBp(5, 6, 101, 3, 0),
      luckBp(5, 6, 100, 4, 0),
      luckBp(5, 6, 100, 3, 1),
      luckBp(6, 6, 100, 3, 0),
    ];
    expect(others.filter((x) => x === base).length).toBeLessThan(2);
    const ids = new Set(
      Array.from({ length: 40 }, (_, id) => reinfRoll(5, 6, 100, 3, id + 1)),
    );
    expect(ids.size).toBeGreaterThan(15);
  });
});

describe("daily luck (design §2.1)", () => {
  test("within ±10 %, mean 0 over 10,000 draws, more mass in the middle (triangular)", () => {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let inner = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const v = luckBp(77, 1 + (i % 9), 300 + i, i, i & 1);
      sum += v;
      min = Math.min(min, v);
      max = Math.max(max, v);
      if (Math.abs(v) <= LUCK_MAX_BP / 2) inner++;
    }
    // ww7 lane F: the day's ±20 % and the band's ±30 %.
    expect(LUCK_MAX_BP).toBe(LUCK_DAY_BP + LUCK_BATTLE_BP);
    expect(min).toBeGreaterThanOrEqual(-LUCK_MAX_BP);
    expect(max).toBeLessThanOrEqual(LUCK_MAX_BP);
    // The tails are thin, the mean is 0 (σ ≈ 1,470 bp: ±90 is 6 s.e.).
    expect(min).toBeLessThan(-3000);
    expect(max).toBeGreaterThan(3000);
    expect(Math.abs(sum / N)).toBeLessThan(90);
    // Most of it in the middle half (a flat spread: 50 %).
    expect(inner / N).toBeGreaterThan(0.85);
  });

  test("ww7 lane F: the band's part lasts the band, the day's changes daily", () => {
    const spread = (since: number) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let day = 0; day < 400; day++) {
        const v = luckBp(77, 6, since, day, 0);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      return { lo, hi, mid: (lo + hi) / 2 };
    };
    // One band: the days move it by no more than the day's part.
    const a = spread(100);
    expect(a.hi - a.lo).toBeLessThanOrEqual(2 * LUCK_DAY_BP);
    expect(a.hi - a.lo).toBeGreaterThan(LUCK_DAY_BP);
    // Another band (a new start tick) rolls its own.
    const mids = [100, 101, 102, 103, 104, 105].map((x) => spread(x).mid);
    expect(new Set(mids).size).toBeGreaterThan(3);
    expect(Math.max(...mids) - Math.min(...mids)).toBeGreaterThan(500);
  });
});

describe("reserves (design §2.4)", () => {
  test("25 % + initiative ÷ 4 + signal 10 + infiltration, 0..70", () => {
    expect(reinfPctOf(0, false, 0)).toBe(25);
    expect(reinfPctOf(40, false, 0)).toBe(35);
    expect(reinfPctOf(40, true, 0)).toBe(45);
    expect(reinfPctOf(40, true, 15)).toBe(60);
    expect(reinfPctOf(40, false, -10)).toBe(25);
    // The cap and the floor.
    expect(REINF_MAX_PCT).toBe(70);
    expect(reinfPctOf(100, true, 15)).toBe(70);
    expect(reinfPctOf(0, false, -100)).toBe(0);
    for (let init = 0; init <= 100; init += 5) {
      for (const sig of [false, true]) {
        for (const pp of [-10, 0, 15]) {
          const p = reinfPctOf(init, sig, pp);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(70);
        }
      }
    }
  });

  test("a division's roll is uniform over 0..99: it enters as often as its chance says", () => {
    for (const pct of [25, 45, 70]) {
      let enters = 0;
      const N = 8000;
      for (let i = 0; i < N; i++) {
        const r = reinfRoll(31, 1 + (i % 7), 200, 1 + Math.floor(i / 7), i);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(100);
        if (r < pct) enters++;
      }
      expect(Math.abs(enters / N - pct / 100)).toBeLessThan(0.03);
    }
  });
});

// ---- predictBattleRange and the win table (design §2.6) ----

const def = (bns: [BattalionId, number][]): TemplateDef => ({
  name: "",
  battalions: bns.flatMap(([id, n]) => new Array<BattalionId>(n).fill(id)),
  support: [],
});
const INF = def([
  ["infantry", 7],
  ["artillery", 2],
]);
const POL = def([["infantry", 9]]);
function sideOf(d: TemplateDef, n: number): SideSum {
  const s = templateStats(d, techTotals(new Set()), GEN1);
  const sum = emptySide();
  for (let i = 0; i < n; i++) addToSide(sum, s, s.orgMilli);
  return sum;
}
const ctx = (directions = 2): BattleCtx => ({
  land: "plains",
  directions,
  attackerAttackBp: 10_000,
  attackerBlockBp: 10_000,
  defenderAttackBp: 10_000,
  defenderBlockBp: 10_000,
});

describe("predictBattleRange and winPctOf (design §2.6)", () => {
  test("low ≤ mid ≤ high, mid is predictBattle, three expected-value runs", () => {
    for (const [n, m, dirs] of [
      [1, 1, 1],
      [4, 3, 1],
      [7, 5, 2],
      [12, 4, 2],
      [3, 9, 1],
    ] as const) {
      const att = sideOf(INF, n);
      const dfn = sideOf(POL, m);
      const range = predictBattleRange(att, dfn, ctx(dirs));
      const mid = predictBattle(att, dfn, ctx(dirs));
      expect(range.midPm).toBe(mid.ratioPm);
      expect(range.days).toBe(mid.days);
      expect(range.lowPm).toBeLessThanOrEqual(range.midPm);
      expect(range.midPm).toBeLessThanOrEqual(range.highPm);
      expect(range.winPct).toBe(winPctOf(mid.ratioPm));
      // A real spread, not a point (a fight that is not hopeless or won).
      if (mid.ratioPm > 200 && mid.ratioPm < 20_000) {
        expect(range.lowPm).toBeLessThan(range.highPm);
      }
    }
    // Nobody on a side: the plain answer on all three.
    expect(predictBattleRange(emptySide(), sideOf(POL, 1), ctx())).toEqual({
      lowPm: 0,
      midPm: 0,
      highPm: 0,
      winPct: 0,
      days: 0,
    });
    expect(
      predictBattleRange(sideOf(POL, 1), emptySide(), ctx()),
    ).toMatchObject({
      lowPm: 1_000_000,
      midPm: 1_000_000,
      highPm: 1_000_000,
      winPct: 100,
    });
  });

  test("monotone in strength: more attackers, fewer defenders, stronger attack never lower the range", () => {
    let last = { lowPm: -1, midPm: -1, highPm: -1, winPct: -1 };
    for (let n = 1; n <= 20; n++) {
      const r = predictBattleRange(sideOf(INF, n), sideOf(POL, 6), ctx(2));
      expect(r.lowPm).toBeGreaterThanOrEqual(last.lowPm);
      expect(r.midPm).toBeGreaterThanOrEqual(last.midPm);
      expect(r.highPm).toBeGreaterThanOrEqual(last.highPm);
      expect(r.winPct).toBeGreaterThanOrEqual(last.winPct);
      last = r;
    }
    last = { lowPm: -1, midPm: -1, highPm: -1, winPct: -1 };
    for (let m = 14; m >= 1; m--) {
      const r = predictBattleRange(sideOf(INF, 7), sideOf(POL, m), ctx(2));
      expect(r.midPm).toBeGreaterThanOrEqual(last.midPm);
      expect(r.winPct).toBeGreaterThanOrEqual(last.winPct);
      last = r;
    }
    let atk = -1;
    for (const bp of [8000, 9000, 10_000, 11_500, 14_000]) {
      const r = predictBattleRange(sideOf(INF, 6), sideOf(POL, 6), {
        ...ctx(2),
        attackerAttackBp: bp,
      });
      expect(r.midPm).toBeGreaterThanOrEqual(atk);
      atk = r.midPm;
    }
  });

  test("the win table: ends at 0 and 100, monotone, the ratio edges ascend", () => {
    expect(WIN_RATIO_AT_PM).toHaveLength(WIN_PCT_AT.length);
    for (let i = 1; i < WIN_RATIO_AT_PM.length; i++) {
      expect(WIN_RATIO_AT_PM[i]).toBeGreaterThan(WIN_RATIO_AT_PM[i - 1]);
      expect(WIN_PCT_AT[i]).toBeGreaterThanOrEqual(WIN_PCT_AT[i - 1]);
    }
    for (const p of WIN_PCT_AT) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
    expect(winPctOf(0)).toBe(0);
    expect(winPctOf(-5)).toBe(0);
    expect(winPctOf(1_000_000)).toBe(100);
    let last = 0;
    for (let r = 1; r <= 40_000; r += 7) {
      const w = winPctOf(r);
      expect(w).toBeGreaterThanOrEqual(last);
      last = w;
    }
    // Weak attackers lose, strong ones win, and an even fight is in between.
    expect(winPctOf(100)).toBeLessThan(15);
    expect(winPctOf(8000)).toBeGreaterThan(90);
    expect(winPctOf(1000)).toBeGreaterThan(25);
    expect(winPctOf(1000)).toBeLessThan(75);
    // ww7 lane F: wide, not a step at 1 (it was 60, 90, 100 at 1, 1.2, 1.4).
    expect(winPctOf(1189)).toBeLessThan(88);
    expect(winPctOf(1414)).toBeLessThan(95);
    expect(winPctOf(707)).toBeGreaterThan(5);
    expect(winPctOf(2000)).toBeGreaterThanOrEqual(90);
    expect(winPctOf(354)).toBeLessThan(5);
  });
});
