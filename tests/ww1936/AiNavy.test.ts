// P4 Task 10 (lane AI): the navy AI's pure plan (spec §17.2) and the sea
// term of P3's war score for an overseas war (controller addition).
import {
  SHIP_CLASSES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { fleetPower } from "@openfront/engine-lib/ww1936/NavalRules";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  AI_MAIN_ENGAGE_PM,
  AI_NAVY_STYLES,
  AiFleetView,
  AiNavalInput,
  aiNavalPlan,
  aiNavyDue,
  aiNavyStyle,
  aiOrganise,
  aiOverseas,
  aiOverseasBlend,
  aiOverseasWarScore,
  aiPredictPm,
  aiRegroups,
  AiSeaRegionView,
  aiSeaWarPm,
  AiShipRow,
  aiSupPower,
  finishSideSum,
  fleetAgg,
  fleetCounts,
  fleetRole,
  fleetRows,
  mergeSideSum,
  navalSideSum,
  newSideSumAcc,
} from "@openfront/engine/ww1936/navy/AiNavy";
import {
  AI_BEAT_SCORE_PM,
  AI_WAR_SCORE_PM,
  aiWarScore,
} from "@openfront/engine/ww1936/politics/AiPolitics";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { pol, step, stepTo, takeRegion, wwRunner } from "./util";

const counts = (c: Partial<Record<ShipClass, number>>) =>
  SHIP_CLASSES.map((k) => c[k] ?? 0);

/** Full-strength ships of 1936 (generation 2), no techs. */
function rows(c: Partial<Record<ShipClass, number>>, gen = 2): AiShipRow[] {
  const out: AiShipRow[] = [];
  for (const cls of SHIP_CLASSES) {
    for (let i = 0; i < (c[cls] ?? 0); i++) {
      const stats = shipStats(cls, gen, emptyStats(), new Set());
      out.push({
        cls: SHIP_CLASSES.indexOf(cls),
        gen,
        stats,
        hpMilli: stats.hpMilli,
        orgMilli: stats.orgMilli,
      });
    }
  }
  return out;
}

let nextId = 1;
function fleet(
  c: Partial<Record<ShipClass, number>>,
  over: Partial<AiFleetView> = {},
): AiFleetView {
  const r = rows(c);
  return {
    id: nextId++,
    counts: counts(c),
    supPower: aiSupPower(r),
    sum: navalSideSum(r),
    home: REGION.london,
    docked: REGION.london,
    sr: 1001,
    state: "docked",
    mission: "hold",
    missionSr: 0,
    engage: "if_stronger",
    returnAtPct: 50,
    newShips: false,
    rangeKm: 10_000,
    ...over,
  };
}

function region(
  sr: number,
  over: Partial<AiSeaRegionView> = {},
): AiSeaRegionView {
  return {
    sr,
    km: 300,
    home: false,
    traffic: 0,
    lossMilli: 0,
    raiderSpotted: false,
    enemyTraffic: 0,
    enemyEscort: 0,
    enemySup: 0,
    enemySum: null,
    enemySpotted: false,
    invasion: false,
    ...over,
  };
}

function input(over: Partial<AiNavalInput>): AiNavalInput {
  return {
    smallID: TAG_ID.GBR,
    day: 100,
    atWar: true,
    fleets: [],
    fleetCount: over.fleets?.length ?? 0,
    regions: [],
    ports: [],
    style: aiNavyStyle("GBR"),
    seed: 0,
    ...over,
  };
}

const missions = (orders: ReturnType<typeof aiNavalPlan>) =>
  orders.flatMap((o) =>
    o.kind === "fleet_mission" ? [`${o.fleet}:${o.mission}@${o.sr}`] : [],
  );

describe("the navy AI's plan (spec §17.2)", () => {
  test("new ships are organised into role fleets at 3:1", () => {
    // A carrier group (carriers with as many capital ships, screens 3:1,
    // destroyers first), a surface group of what is left, a flotilla.
    const { groups, rest } = aiOrganise(
      counts({ dd: 14, cl: 4, ca: 2, bb: 2, cv: 2, ss: 7 }),
    );
    expect(groups).toEqual([
      counts({ dd: 12, bb: 2, cv: 2 }),
      counts({ dd: 2, cl: 4, ca: 2 }),
      counts({ ss: 7 }),
    ]);
    expect(rest).toEqual(counts({}));
    for (const g of groups.slice(0, 2)) {
      const big = g[2] + g[3] + g[4] + g[5];
      expect(g[0] + g[1]).toBe(3 * big);
    }
    expect(groups.map(fleetRole)).toEqual(["main", "main", "sub"]);
    // Patrols of 4–6 (light cruisers first), escorts of 6–8 destroyers.
    expect(aiOrganise(counts({ dd: 12, cl: 2 })).groups).toEqual([
      counts({ dd: 4, cl: 2 }),
      counts({ dd: 8 }),
    ]);
    expect(aiOrganise(counts({ dd: 3, ss: 4 })).rest).toEqual(
      counts({ dd: 3, ss: 4 }),
    );
    // The plan splits every group off the new-ships fleet but the last,
    // which the fleet itself stays.
    const f = fleet(
      { dd: 14, cl: 4, ca: 2, bb: 2, cv: 2, ss: 7 },
      { newShips: true },
    );
    const orders = aiNavalPlan(input({ fleets: [f] }));
    expect(orders.filter((o) => o.kind === "fleet_split")).toEqual([
      {
        kind: "fleet_split",
        fleet: f.id,
        counts: [
          ["dd", 12],
          ["bb", 2],
          ["cv", 2],
        ],
        ships: [],
      },
      {
        kind: "fleet_split",
        fleet: f.id,
        counts: [
          ["dd", 2],
          ["cl", 4],
          ["ca", 2],
        ],
        ships: [],
      },
    ]);
    // It waits a day before its own mission; at 40 fleets nothing splits.
    expect(orders.filter((o) => o.kind === "fleet_mission")).toEqual([]);
    expect(
      aiNavalPlan(input({ fleets: [f], fleetCount: 40 })).filter(
        (o) => o.kind === "fleet_split",
      ),
    ).toEqual([]);
    // Two new destroyers join a battle fleet in the same port that is short of screens.
    const main = fleet({ bb: 2, dd: 4 });
    const two = fleet({ dd: 2 }, { newShips: true });
    expect(
      aiNavalPlan(input({ fleets: [main, two] })).filter(
        (o) => o.kind === "fleet_merge",
      ),
    ).toEqual([{ kind: "fleet_merge", fleet: two.id, into: main.id }]);
  });

  test("home defence and trade protection by the personality table", () => {
    const main = fleet({ bb: 2, dd: 6 });
    const patrol = fleet({ cl: 2, dd: 3 });
    const escortA = fleet({ dd: 7 });
    const escortB = fleet({ dd: 7 });
    const regions = [
      region(1001, { home: true, enemySup: 50, km: 0 }),
      region(1002, { home: true, enemySup: 900 }),
      // Convoys lost in the east; the central lane busy but quiet.
      region(1003, { traffic: 10, lossMilli: 2_000 }),
      region(1004, { traffic: 40 }),
    ];
    const plan = (tag: "GBR" | "USA") =>
      missions(
        aiNavalPlan(
          input({
            fleets: [main, patrol, escortA, escortB],
            regions,
            style: aiNavyStyle(tag),
          }),
        ),
      );
    // The battle fleet strikes where home is threatened most; a patrol for
    // the threatened home region; an escort where convoys were lost.
    // Britain (trade first, every lane) also escorts its busiest lane.
    expect(plan("GBR")).toEqual([
      `${main.id}:strike@1002`,
      `${patrol.id}:patrol@1002`,
      `${escortA.id}:escort@1003`,
      `${escortB.id}:escort@1004`,
    ]);
    // The United States escorts only where it loses ships; its other
    // escort waits in port.
    expect(plan("USA")).toEqual([
      `${main.id}:strike@1002`,
      `${patrol.id}:patrol@1002`,
      `${escortA.id}:escort@1003`,
    ]);
    expect(AI_NAVY_STYLES.GBR?.tradeAlways).toBe(true);
    expect(AI_NAVY_STYLES.USA?.tradeAlways).toBeFalsy();
    // Germany sends its submarines to the enemy lane with the weakest
    // escort first; engage rules: patrols if stronger, raiders avoid.
    const subs = fleet({ ss: 8 });
    const deu = aiNavalPlan(
      input({
        smallID: TAG_ID.DEU,
        fleets: [subs],
        regions: [
          region(1002, { enemyTraffic: 50, enemyEscort: 900 }),
          region(1003, { enemyTraffic: 20, enemyEscort: 100 }),
        ],
        style: aiNavyStyle("DEU"),
      }),
    );
    expect(missions(deu)).toEqual([`${subs.id}:raid@1003`]);
    // (The raid's own rule is avoid: the mission order sets it, no more.)
    expect(deu.some((o) => o.kind === "fleet_engage")).toBe(false);
  });

  test("a weaker battle fleet stays in port", () => {
    // Two battleships against three: predictNaval under 0.9 — the fleet
    // stays home (a fleet in being); against two it sorties, engage always,
    // home at 70% (the battle fleet's 60% is no order value).
    const weak = navalSideSum(rows({ bb: 3, dd: 4 }));
    const even = navalSideSum(rows({ bb: 2, dd: 2 }));
    const main = fleet(
      { bb: 2, dd: 6 },
      {
        docked: 0,
        sr: 1001,
        state: "on_station",
        mission: "patrol",
        missionSr: 1001,
      },
    );
    expect(aiPredictPm(main.sum, weak)).toBeLessThan(AI_MAIN_ENGAGE_PM);
    expect(aiPredictPm(main.sum, even)).toBeGreaterThanOrEqual(
      AI_MAIN_ENGAGE_PM,
    );
    const plan = (enemySum: typeof weak) =>
      aiNavalPlan(
        input({
          fleets: [main],
          regions: [region(1002, { home: true, enemySup: 500, enemySum })],
        }),
      );
    expect(plan(weak)).toEqual([{ kind: "fleet_return", fleet: main.id }]);
    // The mission first (its order sets the strike's own rule, always).
    expect(plan(even)).toEqual([
      { kind: "fleet_mission", fleet: main.id, mission: "strike", sr: 1002 },
      { kind: "fleet_return_at", fleet: main.id, pct: 70 },
    ]);
    // Docked already: it holds there.
    const docked = { ...main, docked: REGION.london, state: "docked" as const };
    expect(
      aiNavalPlan(
        input({
          fleets: [docked],
          regions: [region(1002, { home: true, enemySum: weak })],
        }),
      ),
    ).toEqual([
      { kind: "fleet_mission", fleet: main.id, mission: "hold", sr: 1001 },
    ]);
  });

  test("a fleet in being (Italy) seeks battle only at 1.3 to 1 (Task 15)", () => {
    // An even fight sends the default navy out, not Italy's; a clearly
    // weaker enemy draws both.
    const even = navalSideSum(rows({ bb: 2, dd: 6 }));
    const weaker = navalSideSum(rows({ dd: 4 }));
    const main = fleet(
      { bb: 2, dd: 6 },
      {
        docked: 0,
        sr: 1001,
        state: "on_station",
        mission: "patrol",
        missionSr: 1001,
      },
    );
    const ita = aiNavyStyle("ITA");
    expect(ita.engagePm).toBe(1300);
    expect(aiPredictPm(main.sum, even)).toBeLessThan(1300);
    expect(aiPredictPm(main.sum, even)).toBeGreaterThanOrEqual(
      AI_MAIN_ENGAGE_PM,
    );
    expect(aiPredictPm(main.sum, weaker)).toBeGreaterThanOrEqual(1300);
    const plan = (enemySum: typeof even, style = aiNavyStyle("FRA")) =>
      aiNavalPlan(
        input({
          fleets: [main],
          regions: [
            region(1001, { home: true }),
            region(1002, { home: true, enemySup: 500, enemySum }),
          ],
          style,
        }),
      ).filter((o) => o.kind === "fleet_mission" || o.kind === "fleet_return");
    expect(plan(even)).toEqual([
      { kind: "fleet_mission", fleet: main.id, mission: "strike", sr: 1002 },
    ]);
    expect(plan(even, ita)).toEqual([{ kind: "fleet_return", fleet: main.id }]);
    expect(plan(weaker, ita)).toEqual([
      { kind: "fleet_mission", fleet: main.id, mission: "strike", sr: 1002 },
    ]);
    // Its patrols too stay out of a home region an enemy battle fleet holds.
    const patrol = fleet({ dd: 4, cl: 1 });
    const patrolPlan = (style = aiNavyStyle("FRA")) =>
      aiNavalPlan(
        input({
          fleets: [patrol],
          regions: [
            region(1002, {
              home: true,
              enemySup: 500,
              enemySum: navalSideSum(rows({ bb: 2 })),
            }),
          ],
          style,
        }),
      ).filter((o) => o.kind === "fleet_mission");
    expect(patrolPlan()).toEqual([
      { kind: "fleet_mission", fleet: patrol.id, mission: "patrol", sr: 1002 },
    ]);
    expect(patrolPlan(ita)).toEqual([]);
    // And half its submarine flotillas raid; the rest wait at home.
    const subs = [fleet({ ss: 8 }), fleet({ ss: 8 })];
    const raids = (style = aiNavyStyle("FRA")) =>
      aiNavalPlan(
        input({
          fleets: subs,
          regions: [
            region(1002, { home: true, enemyTraffic: 10 }),
            region(1003, { home: true, enemyTraffic: 5 }),
          ],
          style,
        }),
      ).filter((o) => o.kind === "fleet_mission" && o.mission === "raid");
    expect(raids()).toHaveLength(2);
    expect(raids(ita)).toHaveLength(1);
  });

  // Task 15: the 1936 order of battle's submarines with screens, and a
  // battle fleet's flotilla, sat in port all war (no role took them).
  test("at war a fleet no role takes is regrouped", () => {
    expect(aiRegroups(counts({ cl: 2, ss: 17 }))).toBe(true);
    expect(aiRegroups(counts({ bb: 3, dd: 17, ss: 20 }))).toBe(true);
    expect(aiRegroups(counts({ bb: 3, dd: 9 }))).toBe(false);
    expect(aiRegroups(counts({ ss: 8 }))).toBe(false);
    const mixed = fleet({ cl: 2, ss: 17 });
    const orders = aiNavalPlan(input({ fleets: [mixed] }));
    expect(orders).toEqual([
      {
        kind: "fleet_split",
        fleet: mixed.id,
        counts: [["ss", 10]],
        ships: [],
      },
      { kind: "fleet_split", fleet: mixed.id, counts: [["ss", 7]], ships: [] },
    ]);
    // At peace it waits.
    expect(
      aiNavalPlan(input({ atWar: false, fleets: [mixed] })).some(
        (o) => o.kind === "fleet_split",
      ),
    ).toBe(false);
  });

  // Task 15: with no threat at home a battle fleet goes where the enemy
  // holds the sea, when it would win there; else it strikes from home.
  test("a battle fleet with no threat at home contests the sea", () => {
    const main = fleet({ bb: 2, dd: 6 });
    const even = navalSideSum(rows({ bb: 2, dd: 2 }));
    const strong = navalSideSum(rows({ bb: 4, dd: 8 }));
    const plan = (enemySum: typeof even, rangeKm = 10_000) =>
      missions(
        aiNavalPlan(
          input({
            fleets: [{ ...main, rangeKm }],
            regions: [
              region(1001, { home: true, km: 0 }),
              region(1002, { enemySup: 200 }),
              region(1003, { enemySup: 600, enemySum }),
            ],
          }),
        ),
      );
    expect(plan(even)).toEqual([`${main.id}:patrol@1003`]);
    // Too strong there: the next contested region (nothing known there).
    expect(plan(strong)).toEqual([`${main.id}:patrol@1002`]);
    // Out of range: it strikes from home.
    expect(plan(even, 100)).toEqual([`${main.id}:strike@1001`]);
  });

  // Task 15: short of fuel the fleets save it.
  test("short of fuel, no contest and patrols only where home is threatened", () => {
    const main = fleet({ bb: 2, dd: 6 });
    const p = fleet({ cl: 2, dd: 3 });
    const regions = (threat: number) => [
      region(1001, { home: true, km: 0, enemySup: threat }),
      region(1002, { traffic: 20 }),
      region(1003, { enemySup: 600 }),
    ];
    const plan = (fuelShort: boolean, threat = 0) =>
      missions(
        aiNavalPlan(
          input({ fleets: [main, p], regions: regions(threat), fuelShort }),
        ),
      );
    expect(plan(false)).toEqual([
      `${main.id}:patrol@1003`,
      `${p.id}:patrol@1001`,
    ]);
    expect(plan(true)).toEqual([`${main.id}:strike@1001`]);
    expect(plan(true, 300)).toEqual([
      `${main.id}:strike@1001`,
      `${p.id}:patrol@1001`,
    ]);
  });

  test("peace keeps fleets home with one training patrol", () => {
    const main = fleet(
      { bb: 2, dd: 6 },
      { docked: 0, mission: "strike", missionSr: 1002 },
    );
    const p1 = fleet({ cl: 2, dd: 3 });
    const p2 = fleet({ cl: 1, dd: 4 }, { mission: "patrol", missionSr: 1002 });
    const subs = fleet({ ss: 8 });
    const orders = aiNavalPlan(
      input({
        atWar: false,
        fleets: [main, p1, p2, subs],
        regions: [region(1001, { home: true, km: 0 }), region(1002)],
      }),
    );
    expect(orders).toEqual([
      { kind: "fleet_return", fleet: main.id },
      { kind: "fleet_mission", fleet: p1.id, mission: "training", sr: 1001 },
      { kind: "fleet_mission", fleet: p2.id, mission: "hold", sr: 1001 },
    ]);
  });

  test("at war it plans every 2 days on its parity, at peace every 10 (cadence ruling)", () => {
    // Final perf lane (controller ruling, 2026-10-23): half the countries
    // plan each day at war, the other half the next.
    for (const id of [1, 2, 7, 8]) {
      const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) =>
        aiNavyDue(id, 100 + d, true),
      );
      expect(days).toEqual(id % 2 === 0 ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9]);
      // Peace: one day in ten, a day of the same parity.
      const peace = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) =>
        aiNavyDue(id, 100 + d, false),
      );
      expect(peace).toEqual([id % 10]);
      expect(aiNavyDue(id, 100 + (id % 10), true)).toBe(true);
    }
  });

  test("a carrier fleet strikes a port only outside the no-strike list (the plan never sees one) and on a beat", () => {
    const cv = fleet(
      { cv: 3, bb: 3, dd: 18 },
      { docked: 0, sr: 1002, state: "on_station" },
    );
    const orders = aiNavalPlan(
      input({
        fleets: [cv],
        regions: [region(1002)],
        ports: [{ port: REGION.rome, sr: 1002, capitals: 4, beat: false }],
      }),
    );
    expect(orders).toContainEqual({
      kind: "fleet_port_strike",
      fleet: cv.id,
      port: REGION.rome,
    });
    // Two capital ships docked: no strike without a beat; with one, yes.
    const few = (beat: boolean) =>
      aiNavalPlan(
        input({
          fleets: [cv],
          regions: [region(1002)],
          ports: [{ port: REGION.rome, sr: 1002, capitals: 2, beat }],
        }),
      ).some((o) => o.kind === "fleet_port_strike");
    expect(few(false)).toBe(false);
    expect(few(true)).toBe(true);
  });
});

describe("the navy AI in a game (lane AI review)", () => {
  test("role fleets split from a new-ships fleet are fleets of their own", async () => {
    // An AI Britain at peace: launches in London make a new-ships fleet
    // (two battleships, six destroyers, six submarines). On its navy days
    // the battle group splits off and the flotilla left behind is given
    // its mission: no fleet keeps the new-ships mark, so lane N1's
    // housekeeping (return, rehoming) applies to them all, and the next
    // launch starts a new new-ships fleet.
    const runner = await wwRunner({}, [], SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const navy = ww.navy;
    const gbr = TAG_ID.GBR;
    for (const [cls, n] of [
      ["bb", 2],
      ["dd", 6],
      ["ss", 6],
    ] as const) {
      for (let i = 0; i < n; i++)
        navy.commissionShip(gbr, cls, 2, REGION.london);
    }
    const first = navy.fleetsOf(gbr);
    expect(first.map((f) => f.newShips)).toEqual([true]);
    stepTo(runner, dayStartTick(25, ww.prepEndTick()));
    const fleets = navy.fleetsOf(gbr);
    expect(fleets.map((f) => fleetRole(fleetCounts(navy, f))).sort()).toEqual([
      "main",
      "sub",
    ]);
    expect(fleets.every((f) => !f.newShips)).toBe(true);
    navy.commissionShip(gbr, "dd", 2, REGION.london);
    const fresh = navy.fleetsOf(gbr).filter((f) => f.newShips);
    expect(fresh.length).toBe(1);
    expect(fresh[0].ships.length).toBe(1);
  }, 120_000);

  test("the one-pass fleet sums are the rows' sums (Task 15 perf)", async () => {
    // Every fleet of the sea map's 1936 navies, some ships damaged: fleetAgg
    // gives navalSideSum, aiSupPower, fleetPower and the class counts of its
    // rows, and merged sums are the sums of the joined rows.
    const runner = await wwRunner({}, [], SEA.map);
    const navy = runner.game.worldWar()!.navy;
    const t = navy.ships;
    navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["bb", 2, 2],
      ["cv", 2, 1],
      ["dd", 2, 4],
    ]);
    navy.createFleet(TAG_ID.GBR, REGION.london, [["ss", 2, 3]]);
    navy.createFleet(TAG_ID.ITA, REGION.rome, [
      ["ca", 2, 1],
      ["cl", 1, 2],
      ["dd", 3, 3],
    ]);
    navy.createFleet(TAG_ID.ITA, REGION.rome, [["dd", 2, 2]]);
    let k = 0;
    for (const f of navy.fleets.values()) {
      for (const id of f.ships) {
        const r = t.rowOf(id);
        if (r >= 0 && k++ % 3 === 0) {
          t.hp[r] = Math.floor((t.hp[r] * 2) / 3);
          t.org[r] = Math.floor(t.org[r] / 2);
        }
      }
    }
    const all = newSideSumAcc();
    const allRows: AiShipRow[] = [];
    expect(navy.fleets.size).toBeGreaterThan(3);
    for (const f of navy.fleets.values()) {
      const rows = fleetRows(navy, f);
      const fa = fleetAgg(navy, f);
      expect(fa.counts).toEqual(fleetCounts(navy, f));
      expect(fa.sup).toBe(aiSupPower(rows));
      expect(fa.power).toBe(fleetPower(rows));
      expect(finishSideSum(fa.sum)).toEqual(navalSideSum(rows));
      mergeSideSum(all, fa.sum);
      allRows.push(...rows);
    }
    expect(finishSideSum(all)).toEqual(navalSideSum(allRows));
    expect(finishSideSum(newSideSumAcc())).toEqual(navalSideSum([]));
  }, 120_000);
});

describe("P3's war score at sea (controller addition)", () => {
  test("Japan out-guns the US Pacific fleet: the strike becomes plausible", () => {
    const power = (c: Partial<Record<ShipClass, number>>) =>
      fleetPower(rows(c).map((x) => ({ stats: x.stats, hpMilli: x.hpMilli })));
    // 1941-like: Kidō Butai and the battle line against the Pacific Fleet.
    const japan = power({ bb: 10, cv: 6, ca: 12, cl: 8, dd: 40 }) + 400 * 30;
    const usPacific = power({ bb: 8, cv: 3, ca: 10, cl: 6, dd: 30 }) + 100 * 30;
    const sea = aiSeaWarPm({
      ours: japan,
      theirs: usPacific,
      lift: 12,
      capacity: 10,
    });
    expect(sea).toBeGreaterThan(1300);
    // The land (the US army much bigger: 0.4) counts an eighth.
    const score = aiOverseasBlend(400, sea);
    expect(score).toBe(Math.floor((400 + 7 * sea) / 8));
    // Over the history beat's bar (0.8): the 1941 beat is taken.
    expect(score).toBeGreaterThanOrEqual(AI_BEAT_SCORE_PM.declare);
    // A two-to-one superiority clears even an aggressor's own war-goal
    // bar (1.3) without the beat.
    const twice = aiSeaWarPm({
      ours: 2 * usPacific,
      theirs: usPacific,
      lift: 12,
      capacity: 10,
    });
    expect(aiOverseasBlend(400, twice)).toBeGreaterThanOrEqual(
      AI_WAR_SCORE_PM.aggressor,
    );
    // Out-gunned two to one, or without convoys to land an army, it is not.
    // (Final balance: the beat's bar is 650, not 800; the plain reverse,
    // the US fleet against Japan's, now scores 715 and clears it.)
    const weaker = aiSeaWarPm({
      ours: usPacific,
      theirs: 2 * japan,
      lift: 12,
      capacity: 10,
    });
    expect(aiOverseasBlend(400, weaker)).toBeLessThan(AI_BEAT_SCORE_PM.declare);
    expect(
      aiSeaWarPm({ ours: japan, theirs: usPacific, lift: 0, capacity: 10 }),
    ).toBe(Math.floor(sea / 2));
    // No navy at all: nothing at sea.
    expect(aiSeaWarPm({ ours: 0, theirs: 1, lift: 10, capacity: 10 })).toBe(0);
  });

  test("an overseas war's score follows the fleets (ww1936sea: Italy and Malta)", async () => {
    // Britain keeps Malta only (London is France's): an island no army
    // marches to. Italy (AI) joining a war on it (a join is the two alone).
    const runner = await wwRunner({}, [], SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const navy = ww.navy;
    const ita = TAG_ID.ITA;
    const gbr = TAG_ID.GBR;
    takeRegion(g, REGION.london, "FRA");
    expect(aiOverseas(ww, ita, [gbr])).toBe(true);
    // France borders Italy: a land war on France, whatever the fleets.
    expect(aiOverseas(ww, ita, [gbr, TAG_ID.FRA])).toBe(false);
    expect(
      aiOverseasWarScore(ww, ita, TAG_ID.FRA, [gbr, TAG_ID.FRA], 1234),
    ).toBe(1234);
    // No warship anywhere: the land score stands.
    expect(aiOverseasWarScore(ww, ita, gbr, [gbr], 8000)).toBe(8000);
    // Britain's ships and none of Italy's: the land's eighth only.
    navy.createFleet(gbr, REGION.malta, [
      ["bb", 2, 2],
      ["dd", 2, 4],
    ]);
    step(runner);
    expect(aiOverseasWarScore(ww, ita, gbr, [gbr], 8000)).toBe(1000);
    // On Britain with France beside it: half the land, half the sea.
    expect(aiOverseasWarScore(ww, ita, gbr, [gbr, TAG_ID.FRA], 8000)).toBe(
      4000,
    );
    const before = aiWarScore(pol(g), ita, gbr, true);
    navy.createFleet(ita, REGION.rome, [
      ["bb", 2, 6],
      ["dd", 2, 12],
    ]);
    // (The sea term is kept for the tick: a new fleet counts from the next.)
    step(runner);
    const after = aiWarScore(pol(g), ita, gbr, true);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(before * 2);
    // A war over a land border is the land's alone.
    const deu = TAG_ID.DEU;
    const polId = TAG_ID.POL;
    expect(aiOverseasWarScore(ww, deu, polId, [polId], 1234)).toBe(1234);
  });
});
