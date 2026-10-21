// World War 1936 P2 Task 4: occupation and the tile spread (P2 spec §7.7,
// §9.6, §9.7, §12). Germany and Poland are humans (no AI land war). The
// attacks are driven by hand (joinBattle, startHopInto: pre-flight U9, C3).
// P5 lane O (the second block): occupation rule — resistance, compliance,
// laws, integration, uprisings (P5 spec §7.3, §8) on the end map.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CS_GONE,
  OCCUPATION_LAWS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  idleOrder,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_WALK,
  WW_SPREAD_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { resistanceTarget } from "@openfront/engine-lib/ww1936/EndgameRules";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { needOf } from "@openfront/engine/ww1936/endgame/Garrison";
import {
  garrisonOrder,
  integrateRegion,
  occView,
  uprisingNow,
} from "@openfront/engine/ww1936/endgame/Occupation";
import { joinBattle } from "@openfront/engine/ww1936/land/Battles";
import {
  enemyDivisionsIn,
  startHopInto,
} from "@openfront/engine/ww1936/land/Movement";
import { spreadOrder } from "@openfront/engine/ww1936/land/Occupation";
import {
  SPREAD_BATTLE,
  type WwLand,
} from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  byTag,
  clearLand,
  dropPact,
  END_MAP,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  takeRegion,
  WwHuman,
  wwRunner,
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
const MOSCOW = 8;
const KIEV = 9;

function stockUp(g: Game, tag: "DEU" | "POL" | "SUN"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Germany at war with Poland from 1936-06-01 (a clear day in Warsaw). */
async function juneWar(
  humans: WwHuman[] = DEU_POL,
  target: "POL" | "SUN" = "POL",
) {
  const { runner, updates } = await wwRunnerCapture({}, humans);
  const g = runner.game;
  dropPact(g, "DEU", target);
  stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, target).id() }),
  ]);
  return {
    runner,
    updates,
    g,
    l: land(g),
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}

const vpOf = (g: Game, region: number) => {
  const sc = g.worldWar()!.scenario;
  return sc.vpTile(sc.region(region)!);
};

/** Tiles of `region` (but its victory-point tile) `owner` holds. */
function heldIn(g: Game, region: number, owner: number): number {
  const vp = vpOf(g, region);
  let n = 0;
  for (const t of g.worldWar()!.scenario.regionTiles(region)) {
    if (t !== vp && g.ownerID(t) === owner) n++;
  }
  return n;
}

/** Every tile owner of the map, to count a tick's changes. */
function owners(g: Game): Uint16Array {
  const out = new Uint16Array(g.width() * g.height());
  for (let t = 0; t < out.length; t++) out[t] = g.ownerID(t);
  return out;
}

function changed(a: Uint16Array, b: Uint16Array, skip: Set<number>): number {
  let n = 0;
  for (let t = 0; t < a.length; t++) if (a[t] !== b[t] && !skip.has(t)) n++;
  return n;
}

/** The victory-point tile of every land region is its controller's (Review Focus 1). */
function expectVpFollowsControl(g: Game, l: WwLand): void {
  const sc = g.worldWar()!.scenario;
  for (const r of sc.landRegions) {
    const vp = sc.vpTile(r);
    if (!g.map().isLand(vp)) continue;
    expect(g.ownerID(vp), `region ${r.id} at ${g.ticks()}`).toBe(
      l.controller[r.id],
    );
  }
}

describe("World War 1936 P2: occupation and the spread (spec §12)", () => {
  test("the victory-point tile always follows control", async () => {
    // Germany's 1936 armies take Warsaw, every division that can attacking
    // it or walking in once it is empty; Poland, past its surrender line,
    // capitulates a month later and hands Krakow over (spec §12.5).
    const { runner, g, l, deu, pol } = await juneWar();
    const ww = g.worldWar()!;
    const sc = ww.scenario;
    for (const a of l.armiesOf(deu)) {
      // Anchored on the army's region: an anchor (0) that reaches no border
      // sends the army idle (Fronts.assignFront).
      a.order = {
        ...idleOrder(),
        kind: "plan",
        anchor: l.armyRegion(a),
        targets: [WARSAW],
        stance: "aggressive",
        executing: true,
      };
    }
    const t = l.divisions;
    const drive = () => {
      if (!l.isEnemy(deu, l.controller[WARSAW])) return;
      for (const a of l.armiesOf(deu)) {
        for (const id of [...a.divisions]) {
          const r = t.rowOf(id);
          if (r < 0 || t.battle[r] !== 0 || t.mode[r] !== MOVE_NONE) continue;
          if (t.org[r] * 10 < l.orgMaxOf(r) * 6) continue;
          if (sc.edgeBetween(t.region[r], WARSAW) < 0) continue;
          if (enemyDivisionsIn(l, deu, WARSAW) > 0) joinBattle(l, id, WARSAW);
          else startHopInto(l, r, WARSAW, MOVE_WALK);
        }
      }
    };
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      drive();
      step(runner);
      expectVpFollowsControl(g, l);
      if (l.battles.size > 0) seen.add("battle");
      if ([...l.spreads.values()].some((s) => s.kind === SPREAD_BATTLE)) {
        seen.add("battle spread");
      }
      if (t.mode.subarray(0, t.rows).includes(MOVE_ADVANCE)) {
        seen.add("advance");
      }
      if (ww.isCapitulated(pol)) seen.add("capitulation");
    }
    // Not a quiet board.
    expect([...seen].sort()).toEqual([
      "advance",
      "battle",
      "battle spread",
      "capitulation",
    ]);
    expect([l.controller[WARSAW], l.controller[KRAKOW]]).toEqual([deu, deu]);
    expect(byTag(g, "POL").isAlive()).toBe(false);
  }, 120_000);

  test("the spread stays under 40% in battle and goes back when the defence holds", async () => {
    const { runner, g, l, deu, pol } = await juneWar();
    clearLand(g);
    stockUp(g, "DEU");
    stockUp(g, "POL");
    // Six German divisions from Berlin against five Polish: one direction,
    // too few (spec §9.10).
    const a = placeArmy(g, "DEU", BERLIN, 6);
    placeArmy(g, "POL", WARSAW, 5);
    for (const id of a.divisions) joinBattle(l, id, WARSAW);
    step(runner);
    const n = g.worldWar()!.scenario.regionTiles(WARSAW).length - 1;
    expect(n).toBe(1499);
    const ceiling = Math.floor((n * 400) / 1000);
    const daily = Math.floor((n * 200) / 1000);
    // Show the defence nearly gone (the progress at its top) so both
    // limits bind: 20% a day, 40% in all.
    const b = l.battles.get(WARSAW)!;
    let most = 0;
    let firstDay = -1;
    while (l.battles.has(WARSAW)) {
      b.lostOrgMilli = Math.max(b.lostOrgMilli, b.startOrgMilli);
      step(runner);
      expect(g.ticks()).toBeLessThan(dayStartTick(JUNE_1 + 30, WW_PREP_TICKS));
      const s = l.spreads.get(WARSAW);
      if (s === undefined) continue;
      expect(s.by).toBe(deu);
      expect(heldIn(g, WARSAW, deu)).toBe(s.done);
      expect(s.done).toBeLessThanOrEqual(ceiling);
      expect(Math.abs(s.done - s.dayBase)).toBeLessThanOrEqual(daily);
      if (firstDay < 0) firstDay = s.dayNo;
      if (s.dayNo === firstDay) expect(s.done).toBeLessThanOrEqual(daily);
      most = Math.max(most, s.done);
    }
    expect(most).toBe(ceiling);
    // The attack failed: Warsaw is Poland's and the spread goes back.
    expect(l.controller[WARSAW]).toBe(pol);
    step(runner, 3);
    expect(heldIn(g, WARSAW, deu)).toBe(0);
    expect(heldIn(g, WARSAW, pol)).toBe(n);
    expect(l.spreads.has(WARSAW)).toBe(false);
  }, 120_000);

  test("capture spreads the rest within the budget", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];
    const { runner, g, l, deu } = await juneWar(humans, "SUN");
    clearLand(g);
    const skip = new Set([vpOf(g, MOSCOW), vpOf(g, KIEV)]);
    takeRegion(g, MOSCOW, "DEU");
    takeRegion(g, KIEV, "DEU");
    expect([l.controller[MOSCOW], l.controller[KIEV]]).toEqual([deu, deu]);
    const total = 2 * 3999;
    let moved = 0;
    let ticks = 0;
    while (l.spreads.size > 0) {
      const before = owners(g);
      step(runner);
      const n = changed(before, owners(g), skip);
      expect(n).toBeLessThanOrEqual(WW_SPREAD_TILES_PER_TICK);
      moved += n;
      expect(++ticks).toBeLessThan(10);
    }
    expect(moved).toBe(total);
    expect(ticks).toBe(4);
    expect(heldIn(g, MOSCOW, deu) + heldIn(g, KIEV, deu)).toBe(total);
    // The Soviet Union held only these two: gone, its conquest settled.
    expect(byTag(g, "SUN").isAlive()).toBe(false);
  }, 120_000);

  test("spread order starts at the attackers' side", async () => {
    const { g, l } = await juneWar();
    const sc = g.worldWar()!.scenario;
    const vp = vpOf(g, WARSAW);
    const tiles = sc.regionTiles(WARSAW);
    const order = spreadOrder(l, WARSAW, [BERLIN]);
    // Every tile of Warsaw once, but its victory-point tile.
    expect(order.length).toBe(tiles.length - 1);
    expect(new Set(order).size).toBe(order.length);
    expect(order.includes(vp)).toBe(false);
    expect([...order].every((t) => sc.regionAt(t) === WARSAW)).toBe(true);
    // Berlin touches Warsaw's x = 90 column for y 0..34: those come first.
    const w = sc.width;
    const head = [...order.subarray(0, 35)];
    expect(head.every((t) => t % w === 90 && Math.floor(t / w) < 35)).toBe(
      true,
    );
    expect(order[35] % w).toBe(91);
    // From inside (a paradrop): the center first, its four neighbours.
    const center = sc.centerTile(WARSAW);
    expect(center).toBe(vp);
    expect([...spreadOrder(l, WARSAW, []).subarray(0, 4)]).toEqual([
      center - w,
      center + 1,
      center + w,
      center - 1,
    ]);
    // The scratch is clean again: the same order twice.
    expect(spreadOrder(l, WARSAW, [BERLIN])).toEqual(order);
  }, 60_000);

  test("capitulation hands control at once and the tiles by budget", async () => {
    const { runner, updates, g, l, deu, pol } = await juneWar();
    const ww = g.worldWar()!;
    const conquered: number[] = [];
    const settle = g.conquerPlayer.bind(g);
    g.conquerPlayer = (by, who) => {
      if (who.smallID() === pol) conquered.push(by.smallID());
      settle(by, who);
    };
    // Warsaw falls the evening before Poland's gauge fills: its capture
    // spread and the capitulation's share one tick's budget.
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    takeRegion(g, WARSAW, "DEU");
    ww.setCapitulationGauge(pol, WW_CAPITULATION_DAYS - 1);
    const skip = new Set([vpOf(g, WARSAW), vpOf(g, KRAKOW)]);
    const n0 = updates.length;
    let before = owners(g);
    step(runner);
    expect(ww.isCapitulated(pol)).toBe(true);
    // That tick: every region and its point, Poland's divisions gone.
    expect([l.controller[WARSAW], l.controller[KRAKOW]]).toEqual([deu, deu]);
    expect(g.ownerID(vpOf(g, KRAKOW))).toBe(deu);
    expect(l.fieldMen(pol)).toBe(0);
    expect(ww.transfers()).toEqual([]);
    let ticks = 0;
    for (;;) {
      expect(changed(before, owners(g), skip)).toBeLessThanOrEqual(
        WW_SPREAD_TILES_PER_TICK,
      );
      if (!byTag(g, "POL").isAlive()) break;
      expect(conquered).toEqual([]);
      before = owners(g);
      step(runner);
      expect(++ticks).toBeLessThan(10);
    }
    // 2,998 tiles: the capitulation tick and one more.
    expect(ticks).toBe(1);
    expect(conquered).toEqual([deu]);
    const events = updates
      .slice(n0)
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === byTag(g, "POL").id());
    expect(events).toHaveLength(1);
    expect(heldIn(g, KRAKOW, deu)).toBe(1499);
    expect(ww.transfers()).toEqual([]);
  }, 120_000);

  test("a capture overruns broken defenders and pushes a neutral division out", async () => {
    // Germany and the Soviet Union at peace (spec §9.1).
    const { g, l, deu, pol } = await juneWar();
    clearLand(g);
    stockUp(g, "POL");
    stockUp(g, "SUN");
    const sun = byTag(g, "SUN").smallID();
    expect(l.isEnemy(deu, sun)).toBe(false);
    const [broken, fit, leaving] = placeArmy(g, "POL", WARSAW, 3).divisions;
    const [soviet] = placeArmy(g, "SUN", WARSAW, 1).divisions;
    const t = l.divisions;
    t.org[t.rowOf(broken)] = Math.floor(l.orgMaxOf(t.rowOf(broken)) / 20);
    // As broken, but walking out to Krakow: leaving R (spec §9.6 b).
    const w = t.rowOf(leaving);
    t.org[w] = Math.floor(l.orgMaxOf(w) / 20);
    startHopInto(l, w, KRAKOW, MOVE_WALK);
    t.prog[w] = 10_000;
    takeRegion(g, WARSAW, "DEU");
    expect(l.controller[WARSAW]).toBe(deu);
    // Under a tenth of its org: destroyed (spec §9.6 b).
    expect(t.rowOf(broken)).toBe(-1);
    // The other falls back to Krakow.
    const r = t.rowOf(fit);
    expect([t.mode[r], t.next[r], t.owner[r]]).toEqual([
      MOVE_RETREAT,
      KRAKOW,
      pol,
    ]);
    // The walking one goes on its way.
    const lw = t.rowOf(leaving);
    expect([t.mode[lw], t.next[lw], t.prog[lw]]).toEqual([
      MOVE_WALK,
      KRAKOW,
      10_000,
    ]);
    // The Soviet division is moved to the nearest Soviet region, Moscow.
    const s = t.rowOf(soviet);
    expect([t.region[s], t.mode[s], t.dest[s]]).toEqual([
      MOSCOW,
      MOVE_NONE,
      MOSCOW,
    ]);
  }, 60_000);

  test("a capitulation pushes a neutral division out of the regions it hands over", async () => {
    const { runner, g, l, deu, pol } = await juneWar();
    const ww = g.worldWar()!;
    stockUp(g, "SUN");
    const [soviet] = placeArmy(g, "SUN", KRAKOW, 1).divisions;
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    takeRegion(g, WARSAW, "DEU");
    ww.setCapitulationGauge(pol, WW_CAPITULATION_DAYS - 1);
    step(runner);
    expect(ww.isCapitulated(pol)).toBe(true);
    expect(l.controller[KRAKOW]).toBe(deu);
    // Pre-flight C5: Krakow's nearest Soviet region is Kiev.
    expect(l.divisions.region[l.divisions.rowOf(soviet)]).toBe(KIEV);
  }, 60_000);
});

// ---- P5 lane O: occupation rule (P5 spec §7.3, §8) ----

describe("World War 1936 P5: occupation rule (spec §8)", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));
  afterEach(() => usePoliticsContent(null));

  /** Germany and Czechoslovakia are humans: no AI moves or laws. */
  const OCC_HUMANS: WwHuman[] = [
    { clientID: "HUMANDEU", country: "DEU" },
    { clientID: "HUMANCSK", country: "CSK" },
  ];
  const SLOVAKIA = END.region["slovakia"];
  const PRAGUE = END.region["prague"];
  const MUNICH = END.region["munich"];

  /** Past the preparation, an empty board. */
  async function occGame() {
    const runner = await wwRunner({}, OCC_HUMANS, END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    clearLand(g);
    stockUp(g, "DEU");
    return {
      runner,
      g,
      ww,
      eg: ww.endgame,
      deu: endId("DEU"),
      csk: endId("CSK"),
    };
  }

  /** Czechoslovakia in exile in London (legitimacy 50%): its cores fight on. */
  function exileCsk(ww: WorldWar, day: number): void {
    ww.endgame.exiles.push({
      smallID: endId("CSK"),
      host: endId("GBR"),
      legitBp: 5000,
      sinceDay: day,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: END.capital.CSK!,
    });
    ww.endgame.rebuildDerived();
  }

  /** Runs to the first tick of the n-th next day: each country's day runs n times. */
  function days(runner: GameRunner, n: number): void {
    const ww = runner.game.worldWar()!;
    stepTo(
      runner,
      dayStartTick(ww.day(runner.game.ticks()) + n, ww.prepEndTick()),
    );
  }

  it("resistance rises without a garrison and falls with one", async () => {
    const { runner, g, ww, eg, deu } = await occGame();
    exileCsk(ww, ww.day(g.ticks()));
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    expect(eg.isAdministered(SLOVAKIA)).toBe(true);
    days(runner, 1);
    const r0 = eg.resBp[SLOVAKIA];
    days(runner, 10);
    // Base 3,500 (the exile fights on) × 2 (no garrison) + 500 (legitimacy):
    // far above, so the most a day, 15 bp.
    expect(eg.resBp[SLOVAKIA] - r0).toBe(150);
    expect(eg.supDeci[SLOVAKIA]).toBe(0);
    expect(occView(eg, SLOVAKIA).targetBp).toBe(
      resistanceTarget({
        coreHolderFighting: true,
        law: "occ_military",
        compBp: eg.compBp[SLOVAKIA],
        coveragePct: 0,
        exileLegitBp: 5000,
        statPct: 0,
      }),
    );
    // A garrison army in the region covers its need: down 30 bp a day.
    const a = placeArmy(g, "DEU", SLOVAKIA, 1);
    expect(garrisonOrder(eg, deu, a.id, 0)).toBeNull();
    eg.resBp[SLOVAKIA] = 6000;
    days(runner, 1);
    const r1 = eg.resBp[SLOVAKIA];
    expect(r1).toBe(6000 - 30);
    days(runner, 10);
    expect(eg.supDeci[SLOVAKIA]).toBeGreaterThanOrEqual(
      needOf(eg, deu, SLOVAKIA),
    );
    expect(r1 - eg.resBp[SLOVAKIA]).toBe(300);
    expect(occView(eg, SLOVAKIA).targetBp).toBeLessThan(5000);
  }, 60_000);

  it("compliance sets the factory share of an occupied region", async () => {
    const { g, ww, eg, deu, csk } = await occGame();
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    eg.compBp[SLOVAKIA] = 5000;
    // Occupied: 20% + compliance × 60% (military government ±0).
    expect(eg.regionShare(SLOVAKIA)).toEqual({
      factoryPct: 50,
      resourcePct: 50,
      manpowerPct: 2,
    });
    // P1 reads it.
    expect(ww.economy.shares(SLOVAKIA).controlPct).toBe(50);
    // Martial rule over Czechoslovak land takes 15 points more.
    eg.occLaw.push({
      by: deu,
      of: csk,
      law: OCCUPATION_LAWS.indexOf("occ_martial"),
      lockUntilDay: 0,
    });
    expect(eg.regionShare(SLOVAKIA)!.factoryPct).toBe(65);
    eg.occLaw = [];
    // Taken (Germany its legal owner, someone else's core): 50% + 25%.
    ww.politics.setLegalOwner(SLOVAKIA, deu);
    expect(eg.isAdministered(SLOVAKIA)).toBe(true);
    expect(eg.regionShare(SLOVAKIA)).toEqual({
      factoryPct: 75,
      resourcePct: 75,
      manpowerPct: 5,
    });
    expect(eg.supplyFactorPm(SLOVAKIA)).toBe(1000);
    eg.resBp[SLOVAKIA] = 10000;
    expect(eg.supplyFactorPm(SLOVAKIA)).toBe(500);
  }, 60_000);

  it("a colony with no other core holder is never administered", async () => {
    const { runner, g, ww, eg, deu } = await occGame();
    // Munich as a colony held since 1936 (decision 32's Korea rule): no
    // core of its holder, nobody else's either.
    eg.removeCore(deu, MUNICH);
    expect(eg.coreHolders(MUNICH)).toEqual([]);
    expect(eg.isAdministered(MUNICH)).toBe(false);
    // Taken by another country, legal owner too: still nobody's occupation.
    const sun = endId("SUN");
    ww.land.setController(MUNICH, sun, g.ticks());
    expect(eg.isAdministered(MUNICH)).toBe(false);
    ww.politics.setLegalOwner(MUNICH, sun);
    expect(eg.isAdministered(MUNICH)).toBe(false);
    days(runner, 20);
    expect(eg.resBp[MUNICH]).toBe(0);
    expect(eg.compBp[MUNICH]).toBe(0);
    expect(eg.occSince[MUNICH]).toBe(0);
    expect(eg.regionShare(MUNICH)).toBeNull();
    expect(eg.supplyFactorPm(MUNICH)).toBe(1000);
    expect(eg.administeredOf(sun)).toEqual([]);
  }, 60_000);

  it("an uprising returns control to a fighting exile", async () => {
    const { runner, g, ww, eg, deu, csk } = await occGame();
    exileCsk(ww, ww.day(g.ticks()));
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    // A worn German division that is no garrison: half its little
    // suppression, under 50% of the need.
    const a = placeArmy(g, "DEU", SLOVAKIA, 1);
    ww.land.setMen(ww.land.divisions.rowOf(a.divisions[0]), 100);
    days(runner, 1);
    eg.resBp[SLOVAKIA] = 9000;
    eg.uprDays[SLOVAKIA] = 0;
    days(runner, 1);
    expect(eg.uprDays[SLOVAKIA]).toBe(1);
    expect(eg.supDeci[SLOVAKIA] * 100).toBeLessThan(
      needOf(eg, deu, SLOVAKIA) * 50,
    );
    days(runner, 28);
    expect(eg.uprDays[SLOVAKIA]).toBe(29);
    expect(ww.land.controller[SLOVAKIA]).toBe(deu);
    days(runner, 1);
    expect(ww.land.controller[SLOVAKIA]).toBe(csk);
    expect(eg.uprDays[SLOVAKIA]).toBe(0);
    const l = ww.land;
    const rows = l.rowsIn(SLOVAKIA).filter((r) => l.divisions.owner[r] === csk);
    expect(rows).toHaveLength(2);
    expect(l.armies.get(l.divisions.army[rows[0]])!.divisions).toHaveLength(2);
    // The German division left the region (retreat, or lost on its island).
    expect(
      l
        .rowsIn(SLOVAKIA)
        .filter(
          (r) => l.divisions.owner[r] === deu && l.divisions.mode[r] === 0,
        ),
    ).toEqual([]);
    expect(eg.isAdministered(SLOVAKIA)).toBe(false);
  }, 60_000);

  it("an uprising moves the victory-point tile with control", async () => {
    const { runner, g, ww, eg, deu, csk } = await occGame();
    exileCsk(ww, ww.day(g.ticks()));
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    step(runner, 1);
    expectVpFollowsControl(g, ww.land);
    uprisingNow(eg, SLOVAKIA, g.ticks());
    expect(ww.land.controller[SLOVAKIA]).toBe(csk);
    expectVpFollowsControl(g, ww.land);
  }, 60_000);

  it("an uprising with nobody to rise for damages the region", async () => {
    const { g, ww, eg, deu, csk } = await occGame();
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    // Czechoslovakia not at war with Germany: nobody takes the region.
    const econ = ww.economy;
    const civ = econ.civ[SLOVAKIA];
    expect(civ).toBeGreaterThan(0);
    eg.resBp[SLOVAKIA] = 9000;
    uprisingNow(eg, SLOVAKIA, g.ticks());
    expect(ww.land.controller[SLOVAKIA]).toBe(deu);
    expect(eg.resBp[SLOVAKIA]).toBe(5000);
    expect(econ.damage.some((d) => d > 0)).toBe(true);
    expect(ww.isAtWar(deu, csk)).toBe(false);
  }, 60_000);

  it("the occupation law is locked for 30 days", async () => {
    const { runner, g, ww, eg, deu, csk } = await occGame();
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    const c = ww.politics.country(deu)!;
    c.ppMilli = 100_000;
    const p = byTag(g, "DEU");
    const send = (law: "occ_civil" | "occ_martial") =>
      applyWwOrder(
        g,
        ww.economy,
        p,
        { kind: "occupation_law", of: csk, law },
        ww.day(g.ticks()),
      );
    expect(send("occ_civil")).toBeNull();
    expect(eg.occupationLawOf(deu, csk)).toBe("occ_civil");
    expect(c.ppMilli).toBe(75_000);
    // Other legal owners keep the default.
    expect(eg.occupationLawOf(deu, endId("POL"))).toBe("occ_military");
    days(runner, 29);
    expect(send("occ_martial")).toBe("law_locked");
    expect(eg.occupationLawOf(deu, csk)).toBe("occ_civil");
    days(runner, 1);
    c.ppMilli = 30_000;
    expect(send("occ_martial")).toBeNull();
    expect(eg.occupationLawOf(deu, csk)).toBe("occ_martial");
    // Out of political power: refused.
    days(runner, 31);
    c.ppMilli = 10_000;
    expect(send("occ_civil")).toBe("no_pp");
  }, 60_000);

  it("integration needs 90% compliance for 180 days", async () => {
    const { runner, g, ww, eg, deu, csk } = await occGame();
    // Czechoslovakia is gone (no cap on compliance) and Slovakia Germany's.
    eg.setCountryState(csk, CS_GONE);
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    ww.politics.setLegalOwner(SLOVAKIA, deu);
    expect(eg.isAdministered(SLOVAKIA)).toBe(true);
    days(runner, 1);
    eg.compBp[SLOVAKIA] = 9500;
    eg.compHigh[SLOVAKIA] = 0;
    days(runner, 10);
    expect(eg.compHigh[SLOVAKIA]).toBe(10);
    const day = ww.day(g.ticks());
    const c = ww.politics.country(deu)!;
    c.ppMilli = 100_000;
    eg.compHigh[SLOVAKIA] = 179;
    expect(integrateRegion(eg, deu, SLOVAKIA, day)).toBe("not_integrable");
    expect(integrateRegion(eg, deu, PRAGUE, day)).toBe("not_integrable");
    eg.compHigh[SLOVAKIA] = 180;
    expect(integrateRegion(eg, deu, SLOVAKIA, day)).toBeNull();
    // 25 + the region's victory points.
    expect(c.ppMilli).toBe(100_000 - (25 + END.vp[SLOVAKIA]) * 1000);
    expect(eg.hasCore(deu, SLOVAKIA)).toBe(true);
    expect(eg.isAdministered(SLOVAKIA)).toBe(false);
    days(runner, 1);
    expect(eg.resBp[SLOVAKIA]).toBe(0);
    expect(eg.compBp[SLOVAKIA]).toBe(0);
  }, 60_000);

  it("integration is refused while an enemy holds a core there", async () => {
    const { g, ww, eg, deu, csk } = await occGame();
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    ww.land.setController(SLOVAKIA, deu, g.ticks());
    ww.politics.setLegalOwner(SLOVAKIA, deu);
    ww.politics.country(deu)!.ppMilli = 100_000;
    eg.compBp[SLOVAKIA] = 9500;
    eg.compHigh[SLOVAKIA] = 400;
    const day = ww.day(g.ticks());
    expect(integrateRegion(eg, deu, SLOVAKIA, day)).toBe("not_integrable");
    ww.endWar(deu, csk);
    expect(integrateRegion(eg, deu, SLOVAKIA, day)).toBeNull();
  }, 60_000);
});
