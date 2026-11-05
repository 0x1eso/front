// World War 1936 war overhaul (ww7, lane B): occupation in depth bands
// (design §3, brief §2). Germany and Poland are humans (no AI land war);
// the board is cleared and each test places its divisions. The test map's
// regions are big (Warsaw 4 bands, Krakow 3, London 2).
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  LAND_DEFENSE_TACTICS,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_WALK,
  ROLE_DEFEND,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  BAND_MAX,
  bandSpreadTiles,
  isqrt,
  regionDepth,
} from "@openfront/engine-lib/ww1936/BandRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { edgeTicks, moveNeed } from "@openfront/engine-lib/ww1936/MoveRules";
import type { Game } from "@openfront/engine/game/Game";
import { bandNeedOf, depthOf } from "@openfront/engine/ww1936/land/Bands";
import {
  joinBattle,
  stepBattles,
  stepRecovery,
} from "@openfront/engine/ww1936/land/Battles";
import {
  startHopInto,
  walkStepInto,
} from "@openfront/engine/ww1936/land/Movement";
import {
  capture,
  transferOnCapitulation,
} from "@openfront/engine/ww1936/land/Occupation";
import { transferRegionPeaceful } from "@openfront/engine/ww1936/land/PoliticsBridge";
import { dailySupply } from "@openfront/engine/ww1936/land/Supply";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  dropPact,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  takeRegion,
  WwHuman,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const JUNE_1 = dayOfDate("1936-06-01");
const BERLIN = 3;
const WARSAW = 6;
const KRAKOW = 7;
const LONDON = 10;

function stockUp(g: Game, tag: "DEU" | "POL"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Spec §9.10's German infantry division (7 infantry, 2 artillery) as a template. */
function specInfantry(l: WwLand, deu: number): number {
  const cl = l.country(deu)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: "7-2",
      battalions: [
        ...new Array<"infantry">(7).fill("infantry"),
        "artillery",
        "artillery",
      ],
      support: [],
    },
  });
  return id;
}

/** Germany at war with Poland from 1936-06-01, the board cleared. */
async function juneWar() {
  const { runner, updates } = await wwRunnerCapture({}, DEU_POL);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  stockUp(g, "DEU");
  stockUp(g, "POL");
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  return {
    runner,
    updates,
    g,
    l,
    deu,
    pol: byTag(g, "POL").smallID(),
    inf72: specInfantry(l, deu),
  };
}

const rowOf = (l: WwLand, id: number) => l.divisions.rowOf(id);
const vpTileOf = (g: Game, region: number) => {
  const sc = g.worldWar()!.scenario;
  return sc.vpTile(sc.region(region)!);
};

function attack(l: WwLand, a: Army, region: number): void {
  for (const id of a.divisions) joinBattle(l, id, region);
}

/** The army runs an attack plan on `region`: it moves in when it wins. */
function attackPlan(l: WwLand, a: Army, region: number): void {
  a.order = {
    ...idleOrder(),
    kind: "plan",
    anchor: l.armyRegion(a),
    targets: [region],
    stance: "aggressive",
    executing: true,
  };
}

describe("ww7 depth bands: the rules", () => {
  test("depth = clamp(1, 4, floor(sqrt(tiles) / 10)), one more for 10 points, at most 5", () => {
    const table: [number, number, number][] = [
      [0, 0, 1],
      [99, 0, 1],
      [100, 0, 1],
      [399, 0, 1],
      [400, 0, 2],
      [899, 0, 2],
      [900, 0, 3],
      [1599, 0, 3],
      [1600, 0, 4],
      [100_000, 0, 4],
      // 10 victory points: one more band (ww84: urban ground adds none).
      [50, 9, 1],
      [50, 10, 2],
      [900, 21, 4],
      [1600, 21, 5],
      [100_000, 40, BAND_MAX],
    ];
    for (const [tiles, vp, want] of table) {
      expect(regionDepth(tiles, vp), `${tiles} ${vp}`).toBe(want);
    }
    for (const n of [0, 1, 2, 3, 4, 8, 9, 10, 99, 100, 10_000, 99_999]) {
      expect(isqrt(n)).toBe(Math.floor(Math.sqrt(n)));
    }
  });

  test("one band spreads exactly as before; more show the bands fallen", () => {
    const n = 1499;
    for (const pm of [0, 1, 333, 1000]) {
      expect(bandSpreadTiles(n, 0, 1, 400, pm)).toBe(
        Math.floor((n * 400 * pm) / 1_000_000),
      );
    }
    // Four bands: a quarter a band, the open battle adds 40% of the next.
    expect(bandSpreadTiles(n, 2, 4, 400, 0)).toBe(Math.floor(n / 2));
    expect(bandSpreadTiles(n, 2, 4, 400, 1000)).toBe(Math.floor((n * 2.4) / 4));
  });

  test("the test map's regions", async () => {
    const { l } = await juneWar();
    expect([WARSAW, KRAKOW, LONDON].map((r) => depthOf(l, r))).toEqual([
      4, 3, 2,
    ]);
  }, 60_000);
});

describe("ww7 depth bands: a region falls band by band", () => {
  test("d bands need d won battles; control and the victory-point tile change at the last", async () => {
    const { runner, g, l, deu, pol, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 8, inf72);
    placeArmy(g, "POL", WARSAW, 1);
    attackPlan(l, a, WARSAW);
    attack(l, a, WARSAW);
    const vp = vpTileOf(g, WARSAW);
    const seen: number[] = [0];
    const bands = new Set<number>();
    const t = l.divisions;
    let ticks = 0;
    while (l.controller[WARSAW] !== deu) {
      expect(++ticks).toBeLessThan(400);
      step(runner);
      if (l.controller[WARSAW] === deu) break;
      expect(g.ownerID(vp)).toBe(pol);
      const p = l.bandProg[WARSAW];
      if (p !== seen[seen.length - 1]) seen.push(p);
      const b = l.battles.get(WARSAW);
      if (b !== undefined) bands.add(b.band);
      if (p > 0) {
        expect(l.bandTaker[WARSAW]).toBe(deu);
        // The attackers are inside, occupying (and the fronts leave them).
        for (const id of a.divisions) {
          const r = rowOf(l, id);
          if (r >= 0) expect(t.region[r]).toBe(WARSAW);
        }
      }
    }
    // Four bands: 1, 2, 3 fallen, then the fourth takes the region.
    expect(seen).toEqual([0, 1, 2, 3]);
    expect([...bands].sort()).toEqual([0, 1, 2, 3]);
    expect(g.ownerID(vp)).toBe(deu);
    expect([l.bandProg[WARSAW], l.bandTaker[WARSAW]]).toEqual([0, 0]);
    expect(l.battles.has(WARSAW)).toBe(false);
  }, 120_000);

  test("a broken defender with a band left steps back inside the region, at half the recovery", async () => {
    const { g, l, deu } = await juneWar();
    // Krakow is German: nowhere to retreat to.
    takeRegion(g, KRAKOW, "DEU");
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const r = rowOf(l, d.divisions[0]);
    const t = l.divisions;
    t.org[r] = 1;
    attack(l, a, WARSAW);
    stepBattles(l, g.ticks());
    // Not destroyed: the first of four bands fell, the region is Poland's.
    expect(rowOf(l, d.divisions[0])).toBe(r);
    expect(t.org[r]).toBe(0);
    expect([t.mode[r], t.next[r], t.region[r]]).toEqual([
      MOVE_RETREAT,
      WARSAW,
      WARSAW,
    ]);
    expect(t.battle[r]).toBe(0);
    expect([l.bandProg[WARSAW], l.bandTaker[WARSAW]]).toEqual([1, deu]);
    expect(l.controller[WARSAW]).toBe(byTag(g, "POL").smallID());
    // The edge time over the bands.
    const sc = g.worldWar()!.scenario;
    const edges = sc.edgesOf(WARSAW);
    const mean = Math.floor(
      edges.reduce((s, e) => s + moveNeed(sc.edge(e.edge)), 0) / edges.length,
    );
    expect(t.need[r]).toBe(Math.floor(mean / 4));
    expect(bandNeedOf(l, WARSAW)).toBe(t.need[r]);
    // Recovery: half of a standing division's.
    const org0 = t.org[r];
    stepRecovery(l);
    const half = t.org[r] - org0;
    t.mode[r] = MOVE_NONE;
    t.org[r] = org0;
    stepRecovery(l);
    const full = t.org[r] - org0;
    expect(full).toBeGreaterThan(0);
    expect(half).toBe(Math.floor(full / 2));
  }, 60_000);

  test("a withdrawing defender's step back gets 10% org", async () => {
    const { g, l } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const r = rowOf(l, d.divisions[0]);
    l.divisions.org[r] = 1;
    attack(l, a, WARSAW);
    const b = l.battles.get(WARSAW)!;
    b.tacticDef = LAND_DEFENSE_TACTICS.indexOf("withdraw");
    // Mid-phase (lane A): the round keeps the tactics instead of picking anew.
    b.phaseRound = 1;
    stepBattles(l, g.ticks());
    expect(l.divisions.org[r]).toBe(Math.floor(l.orgMaxOf(r) / 10));
  }, 60_000);

  test("the defenders winning push the attackers back one band; at the first they leave", async () => {
    const { g, l, deu } = await juneWar();
    for (const [start, inside] of [
      [2, true],
      [1, false],
    ] as const) {
      const a = placeArmy(g, "DEU", BERLIN, 1);
      placeArmy(g, "POL", WARSAW, 5);
      const r = rowOf(l, a.divisions[0]);
      l.bandProg[WARSAW] = start;
      l.bandTaker[WARSAW] = deu;
      l.setDivisionRegion(r, WARSAW);
      l.divisions.org[r] = 1;
      joinBattle(l, a.divisions[0], WARSAW);
      let n = 0;
      while (l.battles.has(WARSAW)) {
        stepBattles(l, g.ticks());
        expect(++n).toBeLessThan(20);
      }
      const t = l.divisions;
      expect(l.bandProg[WARSAW]).toBe(start - 1);
      expect(t.mode[r]).toBe(MOVE_RETREAT);
      if (inside) {
        // Back one band, still inside Warsaw.
        expect([t.region[r], t.next[r]]).toEqual([WARSAW, WARSAW]);
        expect(l.bandTaker[WARSAW]).toBe(deu);
      } else {
        // Out of Warsaw, into Berlin.
        expect(t.next[r]).toBe(BERLIN);
        expect(l.bandTaker[WARSAW]).toBe(0);
      }
      clearLand(g);
      stockUp(g, "DEU");
      stockUp(g, "POL");
      l.bandProg[WARSAW] = 0;
    }
  }, 60_000);

  test("an empty region falls in today's time; one in progress needs only its bands left", async () => {
    const { runner, g, l, deu } = await juneWar();
    takeRegion(g, WARSAW, "DEU");
    const sc = g.worldWar()!.scenario;
    const need = moveNeed(sc.edge(sc.edgeBetween(WARSAW, KRAKOW)));
    const [id] = placeArmy(g, "DEU", WARSAW, 1).divisions;
    const r = rowOf(l, id);
    const t = l.divisions;
    startHopInto(l, r, KRAKOW, MOVE_WALK);
    expect(t.need[r]).toBe(need);
    let ticks = 0;
    while (l.controller[KRAKOW] !== deu) {
      expect(++ticks).toBeLessThan(200);
      step(runner);
    }
    // Back to Warsaw; 2 of Krakow's 3 bands fallen: a third of the edge.
    clearLand(g);
    l.setController(KRAKOW, byTag(g, "POL").smallID(), g.ticks());
    stockUp(g, "DEU");
    const [id2] = placeArmy(g, "DEU", WARSAW, 1).divisions;
    l.bandProg[KRAKOW] = 2;
    l.bandTaker[KRAKOW] = deu;
    const r2 = rowOf(l, id2);
    startHopInto(l, r2, KRAKOW, MOVE_WALK);
    expect(t.need[r2]).toBe(Math.floor(need / 3));
    let ticks2 = 0;
    while (l.controller[KRAKOW] !== deu) {
      expect(++ticks2).toBeLessThan(200);
      step(runner);
    }
    expect(ticks2).toBeLessThan(ticks);
    expect([l.bandProg[KRAKOW], l.bandTaker[KRAKOW]]).toEqual([0, 0]);
  }, 120_000);

  test("occupiers walk through empty bands at a band's pace", async () => {
    const { runner, g, l, deu } = await juneWar();
    // A division inside empty Krakow (3 bands): the bands fall one by one.
    const a = placeArmy(g, "DEU", KRAKOW, 1);
    const [id] = a.divisions;
    const r = rowOf(l, id);
    const pace = walkStepInto(l, r, KRAKOW);
    const per = Math.max(1, edgeTicks(bandNeedOf(l, KRAKOW), pace));
    joinBattle(l, id, KRAKOW);
    const t0 = g.ticks();
    const falls: [number, number][] = [];
    let last = 0;
    let ticks = 0;
    while (l.controller[KRAKOW] !== deu) {
      expect(++ticks).toBeLessThan(400);
      step(runner);
      if (l.controller[KRAKOW] === deu) break;
      if (l.bandProg[KRAKOW] !== last) {
        last = l.bandProg[KRAKOW];
        falls.push([last, g.ticks() - t0]);
      }
    }
    // The first band is empty at once, each next one a band's pace later.
    expect(falls.map((f) => f[0])).toEqual([1, 2]);
    expect(falls[1][1] - falls[0][1]).toBe(per);
    expect(g.ticks() - t0 - falls[1][1]).toBeLessThanOrEqual(per + 1);
  }, 60_000);

  test("a paradropped attacker progresses a band instead of taking the region", async () => {
    const { g, l, deu } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    const r = rowOf(l, a.divisions[0]);
    l.setDivisionRegion(r, WARSAW);
    l.divisions.org[r] = Math.floor((l.orgMaxOf(r) * 40) / 100);
    attack(l, a, WARSAW);
    l.divisions.org[rowOf(l, d.divisions[0])] = 1;
    stepBattles(l, g.ticks());
    expect(l.controller[WARSAW]).toBe(byTag(g, "POL").smallID());
    expect([l.bandProg[WARSAW], l.bandTaker[WARSAW]]).toEqual([1, deu]);
    // The battle goes on over the second band, from inside.
    const b = l.battles.get(WARSAW)!;
    expect(b.band).toBe(1);
    expect(b.attackers).toEqual(a.divisions);
    const s = l.battleSummary(b);
    expect([s.band, s.depth]).toEqual([1, 4]);
    expect(l.divisions.region[r]).toBe(WARSAW);
  }, 60_000);

  test("occupiers draw 80% of the supply next door", async () => {
    const { g, l, deu } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const [id] = a.divisions;
    const r = rowOf(l, id);
    l.setDivisionRegion(r, WARSAW);
    l.divisions.dest[r] = WARSAW;
    dailySupply(l, l.sideOf(deu));
    // Berlin has nothing standing in it: a full rate there, 80% of it here.
    expect(l.supplyMilli[BERLIN]).toBeGreaterThan(0);
    expect(l.divisions.supply[r]).toBe(800);
    // Once it is German ground, the normal rate.
    l.divisions.supply[r] = 123;
    l.setController(WARSAW, deu, g.ticks());
    dailySupply(l, l.sideOf(deu));
    expect(l.divisions.supply[r]).toBe(1000);
  }, 60_000);

  test("a division coming into a region in progress defends its next band", async () => {
    const { runner, g, l, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 8, inf72);
    placeArmy(g, "POL", WARSAW, 1);
    attackPlan(l, a, WARSAW);
    attack(l, a, WARSAW);
    let n = 0;
    while (l.bandProg[WARSAW] === 0) {
      expect(++n).toBeLessThan(200);
      step(runner);
    }
    // Poland's reinforcement arrives in Warsaw (its walk from Krakow takes
    // longer than the bands do): it defends the band the attackers are at.
    const [id] = placeArmy(g, "POL", KRAKOW, 1).divisions;
    l.setDivisionRegion(rowOf(l, id), WARSAW);
    l.divisions.dest[rowOf(l, id)] = WARSAW;
    let joined = false;
    for (let i = 0; i < 20 && !joined; i++) {
      step(runner);
      const b = l.battles.get(WARSAW);
      joined = b !== undefined && b.defenders.includes(id);
    }
    expect(joined).toBe(true);
    expect(l.divisions.role[rowOf(l, id)]).toBe(ROLE_DEFEND);
    expect(l.battles.get(WARSAW)!.band).toBeGreaterThanOrEqual(1);
  }, 120_000);

  test("an enveloping win overruns the standing at 20% org, not 10%", async () => {
    const { g, l, deu } = await juneWar();
    for (const [pct, survives] of [
      [10, true],
      [20, false],
    ] as const) {
      const d = placeArmy(g, "POL", WARSAW, 1);
      const r = rowOf(l, d.divisions[0]);
      // 15% org, standing: overrun only above the line.
      l.divisions.org[r] = Math.floor((l.orgMaxOf(r) * 15) / 100);
      capture(l, WARSAW, deu, g.ticks(), pct);
      expect(rowOf(l, d.divisions[0]) >= 0).toBe(survives);
      l.setController(WARSAW, byTag(g, "POL").smallID(), g.ticks());
      clearLand(g);
      stockUp(g, "POL");
    }
  }, 60_000);

  test("every change of control clears the progress", async () => {
    const { runner, g, l, deu, pol } = await juneWar();
    const set = (region: number) => {
      l.bandProg[region] = 2;
      l.bandTaker[region] = deu;
      l.bandDue[region] = 99;
    };
    const cleared = (region: number) =>
      [l.bandProg[region], l.bandTaker[region], l.bandDue[region]].join();
    set(KRAKOW);
    l.setController(KRAKOW, byTag(g, "GBR").smallID(), g.ticks());
    expect(cleared(KRAKOW)).toBe("0,0,0");
    set(KRAKOW);
    transferRegionPeaceful(l, KRAKOW, deu, g.ticks());
    expect(cleared(KRAKOW)).toBe("0,0,0");
    set(WARSAW);
    set(KRAKOW);
    transferOnCapitulation(l, pol, deu);
    expect(cleared(WARSAW)).toBe("0,0,0");
    // A peace without a transfer: the progress goes with the war, next day.
    l.setController(LONDON, pol, g.ticks());
    l.bandProg[LONDON] = 1;
    l.bandTaker[LONDON] = deu;
    expect(g.worldWar()!.endWar(deu, pol)).toBe(true);
    step(runner, 12);
    expect(cleared(LONDON)).toBe("0,0,0");
  }, 60_000);

  test("progress nobody holds is won back by the defenders", async () => {
    const { runner, g, l, deu } = await juneWar();
    placeArmy(g, "POL", KRAKOW, 1);
    l.bandProg[KRAKOW] = 2;
    l.bandTaker[KRAKOW] = deu;
    // No occupier, no battle: a band a day.
    const run = (until: () => boolean) => {
      for (let i = 0; i < 20 && !until(); i++) step(runner);
    };
    run(() => l.bandProg[KRAKOW] < 2);
    expect(l.bandProg[KRAKOW]).toBe(1);
    const at = g.ticks();
    run(() => l.bandProg[KRAKOW] < 1);
    expect([l.bandProg[KRAKOW], l.bandTaker[KRAKOW]]).toEqual([0, 0]);
    // A day (7 to 8 ticks) later, not at once.
    expect(g.ticks() - at).toBeGreaterThanOrEqual(7);
  }, 60_000);

  test("the screens: region data and battle summary carry the bands", async () => {
    const { g, l, deu } = await juneWar();
    expect(l.regionData(WARSAW).prog).toBeUndefined();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const d = placeArmy(g, "POL", WARSAW, 1);
    l.divisions.org[rowOf(l, d.divisions[0])] = 1;
    attackPlan(l, a, WARSAW);
    attack(l, a, WARSAW);
    expect(l.battleSummary(l.battles.get(WARSAW)!).band).toBeUndefined();
    stepBattles(l, g.ticks());
    const rd = l.regionData(WARSAW);
    expect([rd.depth, rd.prog, rd.taker]).toEqual([4, 1, deu]);
    // Once taken, nothing to send.
    capture(l, WARSAW, deu, g.ticks());
    const done = l.regionData(WARSAW);
    expect([done.depth, done.prog, done.taker]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  }, 60_000);
});

describe("ww7 depth bands: the snapshot", () => {
  /** A copy from the game's snapshot runs beside it; the hash agrees every tick. */
  async function lockstep(
    runner: Awaited<ReturnType<typeof juneWar>>["runner"],
  ) {
    const copy = await wwRestore(runner, DEU_POL);
    const l = land(runner.game);
    const lc = land(copy.game);
    expect(Array.from(lc.bandProg)).toEqual(Array.from(l.bandProg));
    expect(Array.from(lc.bandTaker)).toEqual(Array.from(l.bandTaker));
    expect(Array.from(lc.bandDue)).toEqual(Array.from(l.bandDue));
    for (let i = 0; i < 90; i++) {
      step(runner);
      step(copy);
      expect(gameHash(copy), `tick ${i}`).toBe(gameHash(runner));
    }
    expect(Array.from(lc.bandProg)).toEqual(Array.from(l.bandProg));
    expect(Array.from(lc.bandDue)).toEqual(Array.from(l.bandDue));
  }

  test("a restore while the defender steps back to the next band runs the same", async () => {
    const { runner, g, l, inf72 } = await juneWar();
    const a = placeArmy(g, "DEU", BERLIN, 8, inf72);
    placeArmy(g, "POL", WARSAW, 1);
    attackPlan(l, a, WARSAW);
    attack(l, a, WARSAW);
    let n = 0;
    while (l.bandProg[WARSAW] === 0) {
      expect(++n).toBeLessThan(200);
      step(runner);
    }
    const t = l.divisions;
    expect([...l.rowsIn(WARSAW)].some((r) => t.mode[r] === MOVE_RETREAT)).toBe(
      true,
    );
    await lockstep(runner);
  }, 120_000);

  test("a restore while an empty band is walked through runs the same", async () => {
    const { runner, g, l } = await juneWar();
    const [id] = placeArmy(g, "DEU", KRAKOW, 1).divisions;
    joinBattle(l, id, KRAKOW);
    let n = 0;
    while (l.bandDue[KRAKOW] === 0) {
      expect(++n).toBeLessThan(50);
      step(runner);
    }
    await lockstep(runner);
    expect(l.controller[KRAKOW]).toBe(byTag(g, "DEU").smallID());
  }, 120_000);
});
