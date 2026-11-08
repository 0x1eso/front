// ww162 lane L0 (design ww162 §1, §6): the battle planner's contract. The
// new orders are appended to the order union and LAND_ORDER_KINDS, cross
// the zbin wire, and reach land.issue (refused until lanes L1/L2); the new
// army and group state round-trips through the snapshot and moves the hash
// only when set, so the digests stay as they were.
import { IntentSchema, WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  LAND_MESSAGE_KEYS,
  LAND_ORDER_KINDS,
  WW_GOAL_MAX,
  WW_MAX_ARMY_DIVISIONS,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WwDepthStateSchema } from "@openfront/engine/ww1936/depth/WwDepth";
import { WwLandStateSchema } from "@openfront/engine/ww1936/land/WwLand";
import { replacer } from "@openfront/shared/SharedUtil";
import {
  type ServerMessage,
  ServerMessageSchema,
} from "@openfront/shared/WireSchemas";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import en from "../../resources/lang/en.json";
import ko from "../../resources/lang/ko.json";
import { PLANNER_KEYS } from "../../src/client/hud/ww1936/PlannerKeys";
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  warAfterPrep,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const NEW_KINDS = [
  "army_front_line",
  "army_goal",
  "army_fallback",
  "army_fall_back",
  "division_move",
  "division_release",
  "group_front_line",
  "group_goal",
  "group_fallback",
];

const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];

async function board() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  const a = placeArmy(g, "DEU", 3, 3);
  const ours = l.scenario.landRegions
    .map((r) => r.id)
    .filter((r) => l.controller[r] === deu);
  // Any land regions: the contract stores lists, it does not judge them.
  const all = l.scenario.landRegions.map((r) => r.id);
  const d = g.worldWar()!.depth;
  return { runner, g, l, d, deu, a, ours, all };
}

function lookup(obj: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

describe("ww162 L0: the battle planner's contract", () => {
  test("the new kinds are appended after template_auto, in both lists", () => {
    const at = LAND_ORDER_KINDS.indexOf("template_auto");
    expect(LAND_ORDER_KINDS.slice(at + 1, at + 1 + NEW_KINDS.length)).toEqual(
      NEW_KINDS,
    );
    const kinds = WwOrderSchema.options.map((o) => o.shape.kind.value);
    const k = kinds.indexOf("template_auto");
    expect(kinds.slice(k + 1, k + 1 + NEW_KINDS.length)).toEqual(NEW_KINDS);
    expect(LAND_MESSAGE_KEYS).toContain("events_display.ww1936_fell_back");
    expect(LAND_MESSAGE_KEYS).toContain("events_display.ww1936_goal_reached");
  });

  test("every planner key and notice is in en.json and ko.json", () => {
    const keys = [
      ...Object.values(PLANNER_KEYS),
      "events_display.ww1936_fell_back",
      "events_display.ww1936_goal_reached",
    ];
    for (const key of keys) {
      expect(typeof lookup(en, key), key).toBe("string");
      expect(typeof lookup(ko, key), key).toBe("string");
    }
  });

  test("the marshal orders reach land.issue, which refuses them for a group that is not there", async () => {
    // ww162 L1 gave the three line orders their rules (ArmyPlannerLines),
    // L2 the pins and the marshal's lines (ArmyPlannerPins).
    const { l, deu, ours } = await board();
    const before = l.hash();
    const orders = [
      {
        kind: "group_front_line",
        group: 1,
        ends: [ours[0], ours[0]],
        enemy: 0,
      },
      { kind: "group_goal", group: 1, regions: [], spear: true, split: true },
      { kind: "group_fallback", group: 1, regions: [] },
    ] as const;
    for (const o of orders) {
      const parsed = WwOrderSchema.parse(o);
      expect(l.issue(deu, parsed), o.kind).toBe("bad_index");
    }
    expect(l.hash()).toBe(before);
  });

  test("the army's new state round-trips through the snapshot and the hash", async () => {
    const { runner, l, a, ours, all } = await board();
    a.order = {
      ...a.order,
      kind: "front",
      ends: [ours[0], ours[1]],
      goal: [all[2], all[3]],
      spear: true,
      fallback: [ours[1], ours[0]],
      fbManual: true,
    };
    a.pins = [[a.divisions[0], ours[0]]];
    a.fbDays = 1;
    const r2 = await wwRestore(runner, DEU_POL);
    const l2 = land(r2.game);
    const a2 = l2.armies.get(a.id)!;
    expect(a2.order.ends).toEqual([ours[0], ours[1]]);
    expect(a2.order.goal).toEqual([all[2], all[3]]);
    expect(a2.order.spear).toBe(true);
    expect(a2.order.fallback).toEqual([ours[1], ours[0]]);
    expect(a2.order.fbManual).toBe(true);
    expect(a2.pins).toEqual([[a.divisions[0], ours[0]]]);
    expect(a2.fbDays).toBe(1);
    expect(l2.hash()).toBe(l.hash());
    expect(gameHash(r2)).toBe(gameHash(runner));
    expect(JSON.stringify(l2.snapshot())).toBe(JSON.stringify(l.snapshot()));
    // The screen's copy shares no list with the engine.
    const mine = l.armySummary(a).mine!;
    expect(mine.pins).toEqual([[a.divisions[0], ours[0]]]);
    expect(mine.order.goal).toEqual(a.order.goal);
    expect(mine.order.goal).not.toBe(a.order.goal);
    expect(mine.order.ends).not.toBe(a.order.ends);
  });

  test("each new army field moves the hash only when set, and back again", async () => {
    const { l, a, ours, all } = await board();
    const base = l.hash();
    const o = a.order;
    const changes: [string, () => void, () => void][] = [
      ["ends", () => (o.ends = [ours[0], ours[1]]), () => delete o.ends],
      ["goal", () => (o.goal = [all[2]]), () => delete o.goal],
      ["spear", () => (o.spear = true), () => delete o.spear],
      ["fallback", () => (o.fallback = [ours[0]]), () => delete o.fallback],
      ["fbManual", () => (o.fbManual = true), () => delete o.fbManual],
      [
        "pins",
        () => (a.pins = [[a.divisions[0], ours[0]]]),
        () => (a.pins = []),
      ],
      ["fbDays", () => (a.fbDays = 2), () => (a.fbDays = 0)],
    ];
    for (const [what, change, undo] of changes) {
      change();
      expect(l.hash(), what).not.toBe(base);
      undo();
      expect(l.hash(), what).toBe(base);
    }
    // At their defaults (empty lists, false) they hash and snapshot as absent.
    o.goal = [];
    o.fallback = [];
    o.spear = false;
    o.fbManual = false;
    expect(l.hash()).toBe(base);
    const mine = l.snapshot().armies.find((x) => x.id === a.id)!;
    for (const k of ["ends", "goal", "spear", "fallback", "fbManual"]) {
      expect(k in mine.order, k).toBe(false);
    }
    expect("pins" in mine || "fbDays" in mine).toBe(false);
  });

  test("an old snapshot (no new fields) restores with the defaults", async () => {
    const { l, a, ours } = await board();
    const snap = JSON.parse(JSON.stringify(l.snapshot()));
    a.order.ends = [ours[0], ours[0]];
    a.pins = [[a.divisions[0], ours[0]]];
    a.fbDays = 3;
    l.restoreState(WwLandStateSchema.parse(snap));
    const back = l.armies.get(a.id)!;
    expect(back.order.ends).toBeUndefined();
    expect(back.pins).toEqual([]);
    expect(back.fbDays).toBe(0);
  });

  test("a group's lines round-trip, hash only when set, and reach the screen", async () => {
    const { d, deu, a, ours, all } = await board();
    d.groups.push({ id: 900, owner: deu, fm: 0, armies: [a.id], auto: false });
    const base = d.hash();
    const g = d.groups[d.groups.length - 1];
    const changes: [string, () => void, () => void][] = [
      [
        "ends",
        () => {
          g.ends = [ours[0], ours[1]];
          g.enemy = 0;
        },
        () => {
          delete g.ends;
          delete g.enemy;
        },
      ],
      ["goal", () => (g.goal = [all[2]]), () => delete g.goal],
      ["fallback", () => (g.fallback = [ours[0]]), () => delete g.fallback],
    ];
    for (const [what, change, undo] of changes) {
      change();
      expect(d.hash(), what).not.toBe(base);
      undo();
      expect(d.hash(), what).toBe(base);
    }
    g.ends = [ours[0], ours[1]];
    g.enemy = 0;
    g.goal = [all[2], all[3]];
    g.spear = true;
    g.split = true;
    g.fallback = [ours[1]];
    const snap = d.snapshot();
    const sg = snap.groups.find((x) => x.id === 900)!;
    expect(sg.goal).not.toBe(g.goal);
    expect(sg.ends).not.toBe(g.ends);
    const h = d.hash();
    d.restoreState(WwDepthStateSchema.parse(JSON.parse(JSON.stringify(snap))));
    expect(d.hash()).toBe(h);
    expect(d.groups.find((x) => x.id === 900)).toMatchObject({
      ends: [ours[0], ours[1]],
      goal: [all[2], all[3]],
      spear: true,
      split: true,
      fallback: [ours[1]],
    });
    d.markGlobal();
    const view = d.takeData()?.armyGroups?.find((x) => x.id === 900);
    expect(view).toMatchObject({
      ends: [ours[0], ours[1]],
      enemy: 0,
      goal: [all[2], all[3]],
      spear: true,
      split: true,
      fallback: [ours[1]],
    });
  });
});

describe("ww162 L0: the wire", () => {
  const PLAYERS = [{ clientID: "aB3dEf7h" }, { clientID: "Xk9mNp2q" }];
  const [P1] = PLAYERS.map((p) => p.clientID);
  const goal24 = Array.from({ length: WW_GOAL_MAX }, (_, i) => 3 + i);
  const zone60 = Array.from({ length: WW_ZONE_MAX }, (_, i) => 3 + i);
  const divs24 = Array.from({ length: WW_MAX_ARMY_DIVISIONS }, (_, i) => 1 + i);

  test("the new orders round-trip through zbin", () => {
    const orders = [
      {
        kind: "army_front_line" as const,
        army: 2,
        ends: [4, 9] as [number, number],
        enemy: 0,
      },
      {
        kind: "army_front_line" as const,
        army: 2,
        ends: [7, 7] as [number, number],
        enemy: 12,
      },
      {
        kind: "army_goal" as const,
        army: 3,
        regions: goal24,
        spear: false,
        stance: "careful" as const,
      },
      {
        kind: "army_goal" as const,
        army: 3,
        regions: [],
        spear: true,
        stance: "aggressive" as const,
      },
      {
        kind: "army_fallback" as const,
        army: 4,
        regions: zone60,
        manual: true,
      },
      { kind: "army_fallback" as const, army: 4, regions: [], manual: false },
      { kind: "army_fall_back" as const, army: 40 },
      {
        kind: "division_move" as const,
        army: 5,
        divisions: divs24,
        region: 77,
      },
      { kind: "division_release" as const, army: 5, divisions: [] },
      { kind: "division_release" as const, army: 5, divisions: [3, 1] },
      {
        kind: "group_front_line" as const,
        group: 6,
        ends: [4, 9] as [number, number],
        enemy: 3,
      },
      {
        kind: "group_goal" as const,
        group: 6,
        regions: [8, 9],
        spear: false,
        split: true,
      },
      { kind: "group_fallback" as const, group: 6, regions: [5] },
    ];
    const msg: ServerMessage = {
      type: "turn",
      turn: {
        turnNumber: 12,
        intents: orders.map((o) => ({
          type: "ww_order" as const,
          clientID: P1,
          order: o,
        })),
      },
    };
    const sctx = createGameWireContext(PLAYERS);
    const cctx = createGameWireContext(PLAYERS);
    const decoded = decodeServerMessage(encodeServerMessage(msg, sctx), cctx);
    expect(decoded).toEqual(
      ServerMessageSchema.parse(JSON.parse(JSON.stringify(msg, replacer))),
    );
    expect(decoded).toEqual(msg);
  });

  test("the schema refuses lines over their limits and bad shapes", () => {
    const ok = (order: unknown) =>
      IntentSchema.safeParse({ type: "ww_order", clientID: P1, order }).success;
    const goal = {
      kind: "army_goal",
      army: 1,
      spear: false,
      stance: "balanced",
    };
    expect(ok({ ...goal, regions: goal24 })).toBe(true);
    expect(ok({ ...goal, regions: [...goal24, 99] })).toBe(false);
    const fb = { kind: "army_fallback", army: 1, manual: false };
    expect(ok({ ...fb, regions: zone60 })).toBe(true);
    expect(ok({ ...fb, regions: [...zone60, 99] })).toBe(false);
    const front = { kind: "army_front_line", army: 1, enemy: 0 };
    expect(ok({ ...front, ends: [3, 4] })).toBe(true);
    expect(ok({ ...front, ends: [3] })).toBe(false);
    expect(ok({ ...front, ends: [3, 4, 5] })).toBe(false);
    const move = { kind: "division_move", army: 1, region: 3 };
    expect(ok({ ...move, divisions: divs24 })).toBe(true);
    expect(ok({ ...move, divisions: [] })).toBe(false);
    expect(ok({ ...move, divisions: [...divs24, 99] })).toBe(false);
  });
});
