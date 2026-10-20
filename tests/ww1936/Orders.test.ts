// World War 1936 P2 (plan Task 3 Step 5): army orders (P2 spec §7, §8.2–
// §8.5, §16.3) — the refusals in order, auto off on a player's order,
// split, merge, disband, halt and the paradrop; and the shared check over
// plain data (LandOrderChecks), as the army card calls it.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  MOVE_NONE,
  MOVE_WALK,
  ROLE_ATTACK,
  WW_MAX_ARMIES,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  landOrderBlockOf,
  type OrderCheckArmy,
  type OrderCheckWorld,
} from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { Game } from "@openfront/engine/game/Game";
import { startHopInto } from "@openfront/engine/ww1936/land/Movement";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import fs from "fs";
import path from "path";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

const rowOf = (g: Game, a: Army, i = 0) =>
  land(g).divisions.rowOf(a.divisions[i]);

/** Germany and Poland at war, nothing on the board. */
async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  return { runner, g, l: land(g), deu: byTag(g, "DEU").smallID() };
}

describe("World War 1936 P2: army orders (P2 spec §16.3)", () => {
  test("the refusals, each in its turn", async () => {
    const { g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 2);
    const pol = placeArmy(g, "POL", 6, 1);
    const issue = (o: Parameters<typeof l.issue>[1]) => l.issue(deu, o);
    // Every army order: ours, and a land region.
    expect(issue({ kind: "army_halt", army: 999 })).toBe("no_army");
    expect(issue({ kind: "army_halt", army: pol.id })).toBe("no_army");
    expect(issue({ kind: "army_move", army: a.id, region: 0 })).toBe(
      "bad_region",
    );
    expect(issue({ kind: "army_move", army: a.id, region: 40001 })).toBe(
      "bad_region",
    );
    // army_move: Moscow is neutral.
    expect(issue({ kind: "army_move", army: a.id, region: 8 })).toBe("no_path");
    // army_rail: Krakow has none; a division in battle cannot board.
    expect(issue({ kind: "army_rail", army: a.id, region: 7 })).toBe("no_rail");
    l.divisions.battle[rowOf(g, a)] = 6;
    expect(issue({ kind: "army_rail", army: a.id, region: 4 })).toBe(
      "army_busy",
    );
    // army_sea: Berlin is no port.
    expect(issue({ kind: "army_sea", army: a.id, region: 10 })).toBe("no_port");
    l.divisions.battle[rowOf(g, a)] = 0;
    // army_attack / army_plan: at war, within reach of our front.
    expect(issue({ kind: "army_attack", army: a.id, region: 8 })).toBe(
      "not_at_war",
    );
    expect(
      issue({
        kind: "army_plan",
        army: a.id,
        targets: [6, 9],
        stance: "careful",
      }),
    ).toBe("not_at_war");
    // At war with the Soviets too: Moscow lies behind Poland, which we
    // fight, two edges from Berlin: in reach.
    g.worldWar()!.setWar(deu, byTag(g, "SUN").smallID(), g.ticks());
    expect(issue({ kind: "army_attack", army: a.id, region: 8 })).toBe(null);
    // army_front: the anchor must face that enemy.
    expect(
      issue({
        kind: "army_front",
        army: a.id,
        anchor: 3,
        enemy: byTag(g, "SUN").smallID(),
      }),
    ).toBe("not_adjacent");
    expect(issue({ kind: "army_front", army: a.id, anchor: 6, enemy: 0 })).toBe(
      "not_adjacent",
    );
    // A named enemy need not be at war (a front before the war).
    expect(
      issue({
        kind: "army_front",
        army: a.id,
        anchor: 3,
        enemy: byTag(g, "FRA").smallID(),
      }),
    ).toBe(null);
    // army_split: at least one stays; at most 40 armies.
    expect(
      issue({ kind: "army_split", army: a.id, count: 2, template: 0 }),
    ).toBe("bad_index");
    expect(
      issue({ kind: "army_split", army: a.id, count: 1, template: 9 }),
    ).toBe("bad_index");
    while (l.armiesOf(deu).length < WW_MAX_ARMIES) l.newArmy(deu);
    expect(
      issue({ kind: "army_split", army: a.id, count: 1, template: 0 }),
    ).toBe("too_many_armies");
    // army_merge: ours, a shared region, 24 at most.
    expect(issue({ kind: "army_merge", army: a.id, into: pol.id })).toBe(
      "no_army",
    );
    // paradrop: every division a paratrooper's.
    expect(issue({ kind: "paradrop", army: a.id, region: 6 })).toBe(
      "bad_template",
    );
  });

  test("an enemy target out of reach of our front", async () => {
    const { g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 1);
    // At war with the Soviets but not Poland: neutral Poland is in between.
    const ww = g.worldWar()!;
    ww.endWarsOf(byTag(g, "POL").smallID());
    ww.setWar(deu, byTag(g, "SUN").smallID(), g.ticks());
    expect(l.issue(deu, { kind: "army_attack", army: a.id, region: 8 })).toBe(
      "not_adjacent",
    );
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 9 })).toBe(
      "not_adjacent",
    );
  });

  test("a human order turns auto off", async () => {
    const { g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 1);
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    expect(a.auto).toBe(true);
    // The AI's own orders leave it on.
    expect(l.issue(deu, { kind: "army_halt", army: a.id }, "ai")).toBe(null);
    expect(a.auto).toBe(true);
    // A refused order changes nothing.
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 8 })).toBe(
      "no_path",
    );
    expect(a.auto).toBe(true);
    expect(l.issue(deu, { kind: "army_halt", army: a.id })).toBe(null);
    expect(a.auto).toBe(false);
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: false })).toBe(
      null,
    );
    expect(a.auto).toBe(false);
  });

  test("split takes the highest division ids", async () => {
    const { runner, g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 6);
    const ids = [...a.divisions];
    a.general = 1;
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: 0 }),
    ).toBe(null);
    step(runner);
    expect(
      l.issue(deu, { kind: "army_split", army: a.id, count: 2, template: 0 }),
    ).toBe(null);
    const b = l.armiesOf(deu).find((x) => x.id !== a.id)!;
    expect(b.divisions).toEqual(ids.slice(4));
    expect(a.divisions).toEqual(ids.slice(0, 4));
    // The new army waits, without a general.
    expect(b.order.kind).toBe("idle");
    expect(b.general).toBe(0);
    expect(a.general).toBe(1);
    step(runner);
    for (const id of b.divisions) {
      const r = l.divisions.rowOf(id);
      expect(l.divisions.dest[r]).toBe(
        l.divisions.mode[r] === MOVE_NONE
          ? l.divisions.region[r]
          : l.divisions.next[r],
      );
    }
    // By template: only that template's divisions.
    const tpl = l.divisions.template[rowOf(g, a)];
    expect(
      l.issue(deu, { kind: "army_split", army: a.id, count: 1, template: tpl }),
    ).toBe(null);
    expect(l.armiesOf(deu)).toHaveLength(3);
  });

  test("merge needs a shared region and ≤ 24", async () => {
    const { runner, g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 2);
    const b = placeArmy(g, "DEU", 4, 3);
    b.general = 2;
    expect(l.issue(deu, { kind: "army_merge", army: a.id, into: b.id })).toBe(
      "not_adjacent",
    );
    expect(l.issue(deu, { kind: "army_merge", army: a.id, into: a.id })).toBe(
      "bad_index",
    );
    // One of a's divisions walks to Munich: now they share a region.
    startHopInto(l, rowOf(g, a, 1), 4, MOVE_WALK);
    for (let i = 0; i < 200 && l.divisions.region[rowOf(g, a, 1)] !== 4; i++) {
      step(runner);
    }
    const ids = [...a.divisions, ...b.divisions].sort((x, y) => x - y);
    expect(l.issue(deu, { kind: "army_merge", army: a.id, into: b.id })).toBe(
      null,
    );
    expect(l.armies.has(a.id)).toBe(false);
    expect(b.divisions).toEqual(ids);
    expect(b.general).toBe(2);
    const big = placeArmy(g, "DEU", 4, 20);
    expect(l.issue(deu, { kind: "army_merge", army: b.id, into: big.id })).toBe(
      "army_full",
    );
  });

  test("disband returns men and equipment", async () => {
    const { g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 2);
    const ce = l.econ.country(deu)!;
    const men = a.divisions.reduce(
      (s, id) => s + l.divisions.men[l.divisions.rowOf(id)],
      0,
    );
    const equip = new Array<number>(GROUND_SLOTS).fill(0);
    for (const id of a.divisions) {
      const e = l.divisions.equipOf(l.divisions.rowOf(id));
      for (let j = 0; j < GROUND_SLOTS; j++) equip[j] += e[j];
    }
    expect(men).toBe(2 * 10_500);
    const manpower = ce.manpower;
    const stock = GROUND_EQUIP_KEYS.map((k) => ce.stock[k]);
    expect(l.issue(deu, { kind: "army_disband", army: a.id })).toBe(null);
    expect(l.armies.has(a.id)).toBe(false);
    expect(l.fieldMen(deu)).toBe(0);
    expect(ce.manpower).toBe(manpower + men);
    expect(GROUND_EQUIP_KEYS.map((k) => ce.stock[k])).toEqual(
      stock.map((s, j) => s + equip[j]),
    );
  });

  test("halt finishes the current edge", async () => {
    const { runner, g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 1);
    // Berlin → Munich → Rome (an ally's).
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 5 })).toBe(
      null,
    );
    step(runner, 5);
    const r = rowOf(g, a);
    expect(l.divisions.mode[r]).toBe(MOVE_WALK);
    expect(l.divisions.next[r]).toBe(4);
    const prog = l.divisions.prog[r];
    expect(prog).toBeGreaterThan(0);
    expect(l.issue(deu, { kind: "army_halt", army: a.id })).toBe(null);
    step(runner);
    expect(l.divisions.prog[rowOf(g, a)]).toBeGreaterThan(prog);
    expect(l.divisions.dest[rowOf(g, a)]).toBe(4);
    for (let i = 0; i < 200 && l.divisions.region[rowOf(g, a)] !== 4; i++) {
      step(runner);
    }
    expect(l.divisions.region[rowOf(g, a)]).toBe(4);
    step(runner, 60);
    expect(l.divisions.region[rowOf(g, a)]).toBe(4);
    expect(l.divisions.mode[rowOf(g, a)]).toBe(MOVE_NONE);
    expect(a.order.kind).toBe("idle");
  });

  test("an attacker leaves its battle on a new order", async () => {
    const { runner, g, l, deu } = await atWar();
    const a = placeArmy(g, "DEU", 3, 1);
    // As a battle (Task 4) would have it.
    l.divisions.battle[rowOf(g, a)] = 6;
    l.divisions.role[rowOf(g, a)] = ROLE_ATTACK;
    expect(l.issue(deu, { kind: "army_move", army: a.id, region: 4 })).toBe(
      null,
    );
    step(runner);
    expect(l.divisions.role[rowOf(g, a)]).toBe(0);
  });

  test("paradrop lands after ten days", async () => {
    const { runner, g, l, deu } = await atWar();
    const cl = l.country(deu)!;
    const ce = l.econ.country(deu)!;
    ce.addTech("paratroopers");
    const tpl = cl.nextTemplateId++;
    cl.templates.push({
      id: tpl,
      key: "",
      def: {
        name: "Fallschirmjäger",
        battalions: Array(6).fill("paratrooper"),
        support: [],
      },
    });
    const a = placeArmy(g, "DEU", 3, 2, tpl);
    const ww = g.worldWar()!;
    // Berlin–Warsaw 163 km; Kiev's Soviets are not at war with us.
    expect(l.scenario.regionKm(3, 6)).toBe(163);
    expect(l.issue(deu, { kind: "paradrop", army: a.id, region: 9 })).toBe(
      "not_at_war",
    );
    expect(l.issue(deu, { kind: "paradrop", army: a.id, region: 6 })).toBe(
      null,
    );
    const day = ww.day(g.ticks());
    expect(a.order.readyDay).toBe(day + 10);
    stepTo(runner, dayStartTick(day + 10, WW_PREP_TICKS));
    expect(l.divisions.region[rowOf(g, a)]).toBe(3);
    expect(l.controller[6]).toBe(byTag(g, "POL").smallID());
    step(runner);
    // Empty Warsaw: taken, the paratroopers on 40% org — plus one tick of
    // recovery: the drop happens in applyArmyOrders and stepRecovery runs
    // later in the same tick (spec §9.8: floor(300 × 1.829 h) = 548 at full
    // supply, no organizer, signal company or recovery tech).
    for (let i = 0; i < a.divisions.length; i++) {
      const r = rowOf(g, a, i);
      expect(l.divisions.region[r]).toBe(6);
      expect(l.divisions.org[r]).toBe(
        Math.floor((l.orgMaxOf(r) * 40) / 100) + 548,
      );
    }
    expect(l.controller[6]).toBe(deu);
    expect(a.paraLastDay).toBe(day + 10);
    expect(a.order.kind).toBe("idle");
    // Once in thirty days.
    expect(l.issue(deu, { kind: "paradrop", army: a.id, region: 7 })).toBe(
      "para_cooldown",
    );
    expect(l.issue(deu, { kind: "paradrop", army: a.id, region: 9 })).toBe(
      "not_at_war",
    );
  });
});

// ---- The shared check over plain data (the army card's view) ----

const DIR = path.join(__dirname, "../testdata/maps/ww1936mini");
const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(DIR, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);
const sid = (tag: "DEU" | "GBR" | "SUN" | "POL" | "FRA") =>
  scenario.smallIdOf(tag);

function world(
  me: number,
  wars: [number, number][],
  armies: Record<number, OrderCheckArmy>,
  day = 100,
): OrderCheckWorld {
  const faction = (s: number) => {
    const tag = scenario.tagOfSmallId(s);
    return tag === undefined ? null : COUNTRIES[tag].faction;
  };
  return {
    scenario,
    controller: Array.from(scenario.ownerByRegion()),
    sameSide: (a, b) =>
      a > 0 &&
      b > 0 &&
      (a === b || (faction(a) !== null && faction(a) === faction(b))),
    isEnemy: (a, b) =>
      wars.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
    me,
    day,
    rail: (r) => scenario.startRail(r),
    isPort: (r) => scenario.isPort(r),
    vp: (r) => scenario.region(r)?.vp ?? 0,
    army: (id) => armies[id] ?? null,
    armyCount: () => Object.keys(armies).length,
  };
}

function army(
  owner: number,
  regions: number[],
  over: Partial<OrderCheckArmy> = {},
): OrderCheckArmy {
  return {
    owner,
    divisions: 4,
    regions,
    fighting: false,
    allPara: true,
    paraLastDay: -1,
    ...over,
  };
}

describe("World War 1936 P2: the shared order check (LandOrderChecks)", () => {
  test("paradrop: airfield cities, range, cooldown", () => {
    const gbr = sid("GBR");
    const sun = sid("SUN");
    const w = world(gbr, [[gbr, sun]], {
      1: army(gbr, [10]),
      2: army(gbr, [10], { paraLastDay: 80 }),
      3: army(gbr, [10], { paraLastDay: 70 }),
      4: army(gbr, [2, 10]),
    });
    // London–Moscow 607 km, London–Kiev 520 km.
    expect(scenario.regionKm(10, 8)).toBe(607);
    expect(landOrderBlockOf(w, { kind: "paradrop", army: 1, region: 8 })).toBe(
      "para_range",
    );
    expect(landOrderBlockOf(w, { kind: "paradrop", army: 1, region: 9 })).toBe(
      null,
    );
    expect(landOrderBlockOf(w, { kind: "paradrop", army: 2, region: 9 })).toBe(
      "para_cooldown",
    );
    expect(landOrderBlockOf(w, { kind: "paradrop", army: 3, region: 9 })).toBe(
      null,
    );
    // Every division at a city of 5+ victory points (Lyon has 3).
    expect(landOrderBlockOf(w, { kind: "paradrop", army: 4, region: 9 })).toBe(
      "para_range",
    );
    expect(
      landOrderBlockOf(
        world(gbr, [[gbr, sun]], { 1: army(gbr, [10], { allPara: false }) }),
        {
          kind: "paradrop",
          army: 1,
          region: 9,
        },
      ),
    ).toBe("bad_template");
  });

  test("rail from every region of the army, sea from one port", () => {
    const deu = sid("DEU");
    const w = world(deu, [], {
      1: army(deu, [3, 4]),
      2: army(deu, [3], { fighting: true }),
      3: army(sid("FRA"), [2]),
    });
    expect(landOrderBlockOf(w, { kind: "army_rail", army: 1, region: 3 })).toBe(
      null,
    );
    expect(landOrderBlockOf(w, { kind: "army_rail", army: 1, region: 5 })).toBe(
      null,
    );
    expect(landOrderBlockOf(w, { kind: "army_rail", army: 2, region: 4 })).toBe(
      "army_busy",
    );
    expect(landOrderBlockOf(w, { kind: "army_sea", army: 3, region: 10 })).toBe(
      "no_army",
    );
    const f = world(sid("FRA"), [], {
      1: army(sid("FRA"), [2]),
      2: army(sid("FRA"), [1, 2]),
    });
    expect(landOrderBlockOf(f, { kind: "army_sea", army: 1, region: 10 })).toBe(
      null,
    );
    expect(landOrderBlockOf(f, { kind: "army_sea", army: 2, region: 10 })).toBe(
      "no_port",
    );
    expect(landOrderBlockOf(f, { kind: "army_sea", army: 1, region: 2 })).toBe(
      "no_port",
    );
  });

  test("plans and execution need a front", () => {
    const deu = sid("DEU");
    const pol = sid("POL");
    const peace = world(deu, [], {
      1: army(deu, [3], { front: false }),
      2: army(deu, [3], { front: true }),
      3: army(deu, [3]),
    });
    expect(
      landOrderBlockOf(peace, {
        kind: "army_plan",
        army: 1,
        targets: [],
        stance: "balanced",
      }),
    ).toBe("not_adjacent");
    expect(
      landOrderBlockOf(peace, {
        kind: "army_plan",
        army: 2,
        targets: [],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(
      landOrderBlockOf(peace, {
        kind: "army_plan",
        army: 3,
        targets: [],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(
      landOrderBlockOf(peace, { kind: "army_execute", army: 1, on: true }),
    ).toBe("not_adjacent");
    expect(
      landOrderBlockOf(peace, { kind: "army_execute", army: 1, on: false }),
    ).toBe(null);
    const war = world(deu, [[deu, pol]], {
      1: army(deu, [3], { front: false }),
    });
    expect(
      landOrderBlockOf(war, {
        kind: "army_plan",
        army: 1,
        targets: [],
        stance: "balanced",
      }),
    ).toBe(null);
    expect(
      landOrderBlockOf(war, {
        kind: "army_plan",
        army: 1,
        targets: [7],
        stance: "careful",
      }),
    ).toBe(null);
  });
});
