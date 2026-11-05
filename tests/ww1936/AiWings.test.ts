// ww8 lane E: the wing planner shared by the AI and a human's [auto]. First the
// pure plan on plain data, then real games on the test map: the AI's orders pin
// nothing, [auto] starts off, a direct order pins only that wing, and [auto]
// gives no order outside the air force.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  WP_STATION,
  type AirType,
  type WingOrder,
} from "@openfront/engine-api/ww1936/AirTypes";
import { AI_PLAN_DEFAULT } from "@openfront/engine-lib/ww1936/AiPlans";
import { wingMaxPlanes } from "@openfront/engine-lib/ww1936/WingRules";
import {
  AI_WING_FIGHTER_MAX_PCT,
  aiWingPlan,
  type AiWingInput,
  type AiWingView,
  type AiWingZone,
} from "@openfront/engine/ww1936/air/AiAir";
import { describe, expect, test } from "vitest";
import {
  byTag,
  HUMAN,
  order,
  step,
  stepTo,
  warAfterPrep,
  wwRunner,
} from "./util";

const zone = (sr: number, o: Partial<AiWingZone> = {}): AiWingZone => ({
  sr,
  kind: "land",
  front: false,
  enemyDivisions: 0,
  enemyPlanes: 0,
  attacking: false,
  bombed: false,
  enemyFleet: false,
  convoyLoss: false,
  industry: 0,
  supPm: 500,
  encircled: false,
  lossPm: 0,
  reach: AIR_TYPES.map(() => true),
  beat: false,
  members: [sr * 10],
  ownMembers: [],
  enemyFighters: 0,
  bomb: null,
  port: null,
  fleetZone: 0,
  supply: null,
  battles: 0,
  battleRegion: 0,
  homeWaters: false,
  priority: false,
  ownDivisions: 0,
  ...o,
});

const wing = (
  id: number,
  type: AirType,
  o: Partial<AiWingView> = {},
): AiWingView => ({
  id,
  type,
  planes: wingMaxPlanes(type),
  base: 1,
  rangeKm: 1000,
  mission: null,
  sr: 0,
  target: 0,
  follow: 0,
  escortOf: 0,
  cls: "auto",
  lastFerryDay: -1,
  flying: false,
  fuelMilli: 100,
  ...o,
});

const input = (o: Partial<AiWingInput>): AiWingInput => ({
  smallID: 1,
  day: 100,
  atWar: true,
  zones: [],
  wings: [],
  bases: [],
  armies: [],
  capitalSr: 0,
  stock: AIR_TYPES.map(() => 0),
  fuelBudgetMilli: 1_000_000,
  stripSpots: [],
  km: () => 100,
  threatened: () => false,
  ...o,
});

type MissionOrder = Extract<WingOrder, { kind: "wing_mission" }>;
const missions = (orders: readonly WingOrder[]) =>
  orders.filter((o): o is MissionOrder => o.kind === "wing_mission");
const of = (orders: readonly WingOrder[], id: number) =>
  missions(orders).find((o) => o.wings[0] === id);
const isDown = (o: MissionOrder | undefined) =>
  o !== undefined &&
  o.target === 0 &&
  o.army === undefined &&
  o.escort === undefined;

describe("aiWingPlan", () => {
  test("ww91: the plan's sky bar and weights steer the bombers", () => {
    const zones = [
      zone(2, {
        supPm: 250,
        enemyPlanes: 50,
        bomb: { region: 21, cls: "rail", score: 90 },
      }),
    ];
    const bomb = (stratSupPm: number) =>
      of(
        aiWingPlan(
          input({
            wings: [wing(1, "strat_bomber")],
            zones,
            plan: { ...AI_PLAN_DEFAULT, stratSupPm },
          }),
        ),
        1,
      )?.mission;
    expect(bomb(200)).toBe("strategic_bombing");
    expect(bomb(300)).not.toBe("strategic_bombing");
    // Two targets: the plan's bombing weight beats the port's by its share.
    const two = [
      zone(2, {
        supPm: 900,
        bomb: { region: 21, cls: "rail", score: 12 },
        port: { region: 22, ships: 5 },
      }),
    ];
    const first = (bombWeightPct: number, navalWeightPct: number) =>
      of(
        aiWingPlan(
          input({
            wings: [wing(1, "bomber")],
            zones: two,
            plan: { ...AI_PLAN_DEFAULT, bombWeightPct, navalWeightPct },
          }),
        ),
        1,
      )?.mission;
    expect(first(200, 100)).toBe("strategic_bombing");
    expect(first(50, 150)).toBe("port_strike");
  });

  test("peace: every wing with an order stands down", () => {
    const plan = aiWingPlan(
      input({
        atWar: false,
        wings: [
          wing(1, "fighter", { mission: "air_superiority", sr: 2 }),
          wing(2, "fighter"),
        ],
      }),
    );
    expect(plan).toHaveLength(1);
    expect(isDown(of(plan, 1))).toBe(true);
  });

  test("fighters: by demand, the sky an attack needs first; who holds stays; a share guards home", () => {
    const fighters = [1, 2, 3, 4, 5].map((id) => wing(id, "fighter"));
    fighters[0] = wing(1, "fighter", {
      mission: "air_superiority",
      sr: 2,
      target: 20,
    });
    const plan = aiWingPlan(
      input({
        wings: fighters,
        capitalSr: 9,
        fighterHomePct: 20,
        zones: [
          zone(2, { front: true, enemyDivisions: 3, ownDivisions: 40 }),
          zone(3, { front: true, enemyDivisions: 1 }),
          zone(9, { ownMembers: [90] }),
        ],
      }),
    );
    // Wing 1 already holds zone 2: no order for it.
    expect(of(plan, 1)).toBeUndefined();
    const sent = missions(plan);
    const toZone = (t: number) => sent.filter((o) => o.target === t).length;
    expect(sent.filter((o) => o.mission === "interception")).toHaveLength(1);
    expect(toZone(20)).toBeGreaterThan(toZone(30));
  });

  test("close support follows the busy army, a priority army weighs ×3", () => {
    const wings = [1, 2, 3, 4].map((id) => wing(id, "cas"));
    const armies = [
      { id: 7, region: 70, sr: 2, attacking: 4, defending: 0, priority: false },
      { id: 8, region: 80, sr: 3, attacking: 4, defending: 0, priority: true },
    ];
    const plan = aiWingPlan(input({ wings, armies }));
    const on = (a: number) =>
      missions(plan).filter((o) => o.mission === "cas" && o.army === a).length;
    expect(on(7)).toBe(1);
    expect(on(8)).toBe(3);
  });

  test("bombing: the zone's pick and class, only under our sky or an empty one, with an escort", () => {
    const wings = [
      wing(1, "strat_bomber"),
      wing(2, "fighter"),
      wing(3, "fighter"),
      wing(4, "fighter"),
      wing(5, "fighter"),
    ];
    const plan = aiWingPlan(
      input({
        wings,
        zones: [
          zone(2, {
            supPm: 400,
            enemyFighters: 50,
            enemyPlanes: 50,
            bomb: { region: 21, cls: "rail", score: 90 },
          }),
          zone(3, {
            supPm: 100,
            enemyPlanes: 400,
            bomb: { region: 31, cls: "factories", score: 900 },
          }),
          zone(4, { front: true, enemyDivisions: 2 }),
        ],
      }),
    );
    expect(of(plan, 1)).toMatchObject({
      mission: "strategic_bombing",
      target: 21,
      cls: "rail",
    });
    const escorts = missions(plan).filter((o) => o.mission === "escort");
    expect(escorts).toHaveLength(1);
    expect(escorts[0].escort).toBe(1);
    // The bomber's order stands before the escort that names it.
    const at = (o: WingOrder | undefined) => plan.indexOf(o!);
    expect(at(of(plan, 1))).toBeLessThan(at(escorts[0]));
  });

  test("the sea and supply: strikes, ports, patrols, air supply", () => {
    const plan = aiWingPlan(
      input({
        wings: [
          wing(1, "naval_bomber"),
          wing(2, "naval_bomber"),
          wing(3, "naval_bomber"),
          wing(5, "naval_bomber"),
          wing(6, "naval_bomber"),
          wing(4, "transport_plane"),
        ],
        zones: [
          zone(2, { kind: "sea", fleetZone: 5001 }),
          zone(3, { kind: "sea", members: [5002], convoyLoss: true }),
          zone(4, { enemyPlanes: 0, port: { region: 41, ships: 4 } }),
          zone(5, { supply: { region: 51, milli: 3000 } }),
        ],
      }),
    );
    const kinds = missions(plan).map((o) => `${o.mission}:${o.target}`);
    expect(kinds).toContain("naval_strike:5001");
    expect(kinds).toContain("naval_patrol:5002");
    expect(kinds).toContain("port_strike:41");
    expect(kinds).toContain("air_supply:51");
  });

  test("bases: past 70% of the range to the nearest base with room, 10 days apart; no base, a strip", () => {
    const km = (a: number, b: number) =>
      a === 1 ? 900 : a === 2 ? 300 : a === 3 ? 200 : 100;
    const z = zone(4, { front: true, enemyDivisions: 2, members: [40] });
    const bases = [
      { region: 2, room: 500 },
      { region: 3, room: 10 },
    ];
    const moved = aiWingPlan(
      input({ wings: [wing(1, "fighter")], zones: [z], bases, km }),
    );
    expect(moved[0]).toEqual({ kind: "wing_base", wings: [1], base: 2 });
    expect(of(moved, 1)).toMatchObject({ target: 40 });
    // Ferried 3 days ago: it stays (the target is still in range).
    const stay = aiWingPlan(
      input({
        wings: [wing(1, "fighter", { lastFerryDay: 97 })],
        zones: [z],
        bases,
        km,
      }),
    );
    expect(stay.filter((o) => o.kind === "wing_base")).toHaveLength(0);
    // Out of range with no base: nobody goes; a strip near the target is asked for.
    const strip = aiWingPlan(
      input({
        wings: [wing(1, "strat_bomber", { rangeKm: 800 })],
        zones: [zone(4, { bomb: { region: 41, cls: "rail", score: 9 } })],
        stripSpots: [6],
        km: (a) => (a === 1 ? 900 : 200),
      }),
    );
    expect(strip).toEqual([{ kind: "air_field", region: 6 }]);
    // Enemy divisions next to the base: out first, even with a target in reach.
    const out = aiWingPlan(
      input({
        wings: [wing(1, "fighter")],
        bases,
        threatened: (r) => r === 1,
      }),
    );
    expect(out).toContainEqual({ kind: "wing_base", wings: [1], base: 2 });
  });

  test("fuel: the land first; what the budget doesn't cover stays down, the bombing before the attack", () => {
    const z = zone(2, { bomb: { region: 21, cls: "factories", score: 9 } });
    const plan = aiWingPlan(
      input({
        fuelBudgetMilli: 150,
        wings: [
          wing(1, "strat_bomber", {
            mission: "strategic_bombing",
            sr: 2,
            target: 21,
            cls: "factories",
          }),
          wing(2, "cas"),
        ],
        zones: [z],
        armies: [
          {
            id: 7,
            region: 70,
            sr: 3,
            attacking: 2,
            defending: 0,
            priority: false,
          },
        ],
      }),
    );
    expect(of(plan, 2)).toMatchObject({ mission: "cas", army: 7 });
    expect(isDown(of(plan, 1))).toBe(true);
  });

  test("under strength: no sortie; the weakest gives its planes back when the stock can't fill them", () => {
    const stock = AIR_TYPES.map(() => 0);
    const plan = aiWingPlan(
      input({
        stock,
        wings: [
          wing(1, "fighter", { planes: 20, mission: "air_superiority", sr: 2 }),
          wing(2, "fighter", { planes: 30 }),
          wing(3, "fighter"),
        ],
        zones: [zone(2, { front: true })],
      }),
    );
    expect(isDown(of(plan, 1))).toBe(true);
    expect(plan).toContainEqual({ kind: "wing_disband", wing: 1 });
  });

  test("the mix: bases full, bombers waiting, fighters past their band: one fighter wing goes back", () => {
    const stock = AIR_TYPES.map((t) => (t === "bomber" ? 500 : 0));
    const wings = [1, 2, 3].map((id) => wing(id, "fighter"));
    expect(150 * 3 * 100).toBeGreaterThan(450 * AI_WING_FIGHTER_MAX_PCT);
    const full = input({ atWar: false, stock, wings });
    expect(aiWingPlan(full)).toEqual([{ kind: "wing_disband", wing: 1 }]);
    // Room on a base: forming needs no swap.
    expect(aiWingPlan({ ...full, bases: [{ region: 2, room: 200 }] })).toEqual(
      [],
    );
  });
});

describe("the wing planner in a game", () => {
  const humans = [{ clientID: HUMAN, country: "DEU" as const }];

  test("the AI flies its wings through air.issue and pins nothing; no auto flag", async () => {
    const r = await wwRunner();
    const g = r.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU").smallID();
    const t0 = 11_300; // past the calendar's war (Sept 1939)
    stepTo(r, t0);
    const wings = ww.air.wingsOf(deu);
    expect(ww.hasWar(deu)).toBe(true);
    expect(wings.some((w) => w.mission >= 0)).toBe(true);
    expect(wings.every((w) => !w.auto)).toBe(true);
    let flying = 0;
    for (let i = 0; i < 40; i++) {
      step(r);
      flying += ww.air
        .wingsOf(deu)
        .filter((w) => w.phase === WP_STATION).length;
    }
    expect(flying).toBeGreaterThan(0);
  }, 120_000);

  test("[auto]: off in a new game; on takes every wing; a direct order pins that wing alone; only air orders", async () => {
    const r = await wwRunner({}, humans);
    const g = r.game;
    const ww = g.worldWar()!;
    const air = ww.air;
    const deu = byTag(g, "DEU").smallID();
    const land = ww.land;
    expect(ww.autoOn(deu, "air")).toBe(false);
    expect(air.wingsOf(deu).every((w) => !w.auto)).toBe(true);
    warAfterPrep(r, HUMAN, "POL");
    // Off: the human's wings get no orders.
    stepTo(r, g.ticks() + 60);
    expect(air.wingsOf(deu).every((w) => w.mission < 0)).toBe(true);
    // What the country does outside the air force, watched from here on.
    const before = {
      research: [...(ww.economy.country(deu)!.researched as Set<string>)],
      laws: JSON.stringify(ww.economy.country(deu)!.laws),
      lines: ww.economy.country(deu)!.lines.length,
      armies: land.armiesOf(deu).map((a) => `${a.id}:${a.order.kind}`),
      wars: ww.enemiesOf(deu).length,
    };
    const landIssue = land.issue.bind(land);
    let landOrders = 0;
    land.issue = ((id: number, o: WwOrder, by: "player" | "ai") => {
      if (id === deu) landOrders++;
      return landIssue(id, o, by);
    }) as typeof land.issue;
    const kinds = new Set<string>();
    const airIssue = air.issue.bind(air);
    air.issue = ((id: number, o: WwOrder, t: number) => {
      const b = airIssue(id, o, t);
      if (id === deu) kinds.add(o.kind);
      return b;
    }) as typeof air.issue;
    step(r, 1, [order(HUMAN, { kind: "auto_set", domain: "air", on: true })]);
    expect(ww.autoOn(deu, "air")).toBe(true);
    const own = air.wingsOf(deu);
    expect(own.length).toBeGreaterThan(1);
    expect(own.every((w) => w.auto)).toBe(true);
    stepTo(r, g.ticks() + 60);
    expect(own.some((w) => w.mission >= 0)).toBe(true);
    for (const k of kinds) {
      expect([
        "wing_mission",
        "wing_base",
        "air_field",
        "wing_disband",
      ]).toContain(k);
    }
    // A direct order pins that wing, the rest and the switch stay on [auto].
    const pinned = own[0];
    step(r, 1, [
      order(HUMAN, {
        kind: "wing_mission",
        wings: [pinned.id],
        mission: AIR_MISSIONS[pinned.mission < 0 ? 0 : pinned.mission],
        target: 0,
      }),
    ]);
    expect(pinned.auto).toBe(false);
    expect(ww.autoOn(deu, "air")).toBe(true);
    expect(own.slice(1).every((w) => w.auto)).toBe(true);
    // The planner leaves it alone: it stays idle across a few plans.
    stepTo(r, g.ticks() + 150);
    expect(pinned.mission).toBe(-1);
    // Its card's [auto] takes it again.
    step(r, 1, [
      order(HUMAN, { kind: "wing_auto", wings: [pinned.id], on: true }),
    ]);
    expect(pinned.auto).toBe(true);
    // Nothing outside the air force moved by [auto].
    const ce = ww.economy.country(deu)!;
    expect(landOrders).toBe(0);
    expect([...(ce.researched as Set<string>)]).toEqual(before.research);
    expect(JSON.stringify(ce.laws)).toBe(before.laws);
    expect(ce.lines.length).toBe(before.lines);
    expect(ww.enemiesOf(deu).length).toBeGreaterThanOrEqual(before.wars);
    // The switch off leaves every wing on its orders, by hand.
    const held = own[1].mission;
    step(r, 1, [order(HUMAN, { kind: "auto_set", domain: "air", on: false })]);
    expect(air.wingsOf(deu).every((w) => !w.auto)).toBe(true);
    expect(own[1].mission).toBe(held);
  }, 120_000);

  test("army_air_priority: the sender's army, ascending, off removes it", async () => {
    const r = await wwRunner({}, humans);
    const g = r.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU").smallID();
    const pol = byTag(g, "POL").smallID();
    const ids = ww.land.armiesOf(deu).map((a) => a.id);
    const c = ww.air.country(deu)!;
    const go = (army: number, on: boolean) =>
      ww.air.issue(deu, { kind: "army_air_priority", army, on }, g.ticks());
    expect(go(ids[1], true)).toBeNull();
    expect(go(ids[0], true)).toBeNull();
    expect(go(ids[0], true)).toBeNull();
    expect(c.priorityArmies).toEqual([ids[0], ids[1]].sort((a, b) => a - b));
    expect(go(ids[1], false)).toBeNull();
    expect(c.priorityArmies).toEqual([ids[0]]);
    const foreign = ww.land.armiesOf(pol)[0].id;
    expect(go(foreign, true)).toBe("bad_index");
  }, 60_000);
});
