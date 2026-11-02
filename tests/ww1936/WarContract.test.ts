// War overhaul (ww7) lane C0: the shared contract. New state (an order's
// zone, an army's autoLevel, a battle's band / tactics / phase round, the
// regions' band progress, taker and position arrays) round-trips through the
// snapshot and the hash, the two new intents (army_zone, army_auto_level) go
// through land.issue and the order path, and both cross the zbin wire.
// No gameplay changes here: the digests stay as they were.
import { IntentSchema, WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  LAND_ORDER_KINDS,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { winPctOf } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  predictAttack,
  predictAttackRange,
} from "@openfront/engine/ww1936/land/Plans";
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
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  order,
  placeArmy,
  step,
  warAfterPrep,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];

/** Germany at war with Poland, an empty board, an army of 3 in region 3 holding a front. */
async function board() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  const a = placeArmy(g, "DEU", 3, 3);
  const ours = l.scenario.landRegions
    .map((r) => r.id)
    .filter((r) => l.controller[r] === deu);
  const theirs = l.scenario.landRegions
    .map((r) => r.id)
    .filter((r) => l.controller[r] === pol);
  expect(
    l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: 0 }),
  ).toBe(null);
  return { runner, g, l, deu, pol, a, ours, theirs };
}

describe("war overhaul C0: the contract", () => {
  test("the new kinds are appended at the end of the lists", () => {
    expect(LAND_ORDER_KINDS.slice(-2)).toEqual([
      "army_zone",
      "army_auto_level",
    ]);
    const kinds = WwOrderSchema.options.map((o) => o.shape.kind.value);
    // The air overhaul (ww8) appends its six after them.
    expect(kinds.slice(-8, -6)).toEqual(["army_zone", "army_auto_level"]);
  });

  test("army_zone and army_auto_level go through land.issue", async () => {
    const { l, deu, a, ours, theirs } = await board();
    const issue = (o: Parameters<typeof l.issue>[1], by?: "player" | "ai") =>
      l.issue(deu, o, by);
    expect(ours.length).toBeGreaterThanOrEqual(2);
    const [r1, r2] = ours;
    // Refused: not our army, a region of the enemy or none at all.
    expect(issue({ kind: "army_zone", army: 999, regions: [r1] })).toBe(
      "no_army",
    );
    expect(issue({ kind: "army_auto_level", army: 999, level: 1 })).toBe(
      "no_army",
    );
    expect(
      issue({ kind: "army_zone", army: a.id, regions: [r1, theirs[0]] }),
    ).toBe("bad_region");
    expect(issue({ kind: "army_zone", army: a.id, regions: [0] })).toBe(
      "bad_region",
    );
    expect(a.order.zone).toEqual([]);
    expect(issue({ kind: "army_zone", army: a.id, regions: [r2, r1] })).toBe(
      null,
    );
    expect(a.order.zone).toEqual([r2, r1]);
  });

  test("a zone keeps the tap order and drops repeats; empty is automatic", async () => {
    const { l, deu, a, ours } = await board();
    const [r1, r2] = ours;
    a.pending = false;
    expect(
      l.issue(deu, {
        kind: "army_zone",
        army: a.id,
        regions: [r2, r1, r2, r1],
      }),
    ).toBe(null);
    expect(a.order.zone).toEqual([r2, r1]);
    expect(a.order.kind).toBe("front");
    expect(a.pending).toBe(true);
    // The mine data carries it.
    expect(l.armySummary(a).mine!.order.zone).toEqual([r2, r1]);
    expect(l.issue(deu, { kind: "army_zone", army: a.id, regions: [] })).toBe(
      null,
    );
    expect(a.order.zone).toEqual([]);
    // A plan keeps its zone.
    expect(l.issue(deu, { kind: "army_zone", army: a.id, regions: [r2] })).toBe(
      null,
    );
    expect(
      l.issue(deu, {
        kind: "army_plan",
        army: a.id,
        targets: [],
        stance: "careful",
      }),
    ).toBe(null);
    expect(a.order.kind).toBe("plan");
    expect(a.order.zone).toEqual([r2]);
  });

  test("a zone is refused for an army with no front or plan", async () => {
    const { g, l, deu, ours } = await board();
    const b = placeArmy(g, "DEU", 3, 1);
    expect(b.order.kind).toBe("idle");
    expect(
      l.issue(deu, { kind: "army_zone", army: b.id, regions: [ours[0]] }),
    ).toBe("not_adjacent");
    expect(b.order.zone).toEqual([]);
    expect(b.pending).toBe(false);
  });

  test("auto levels: army_auto is 2 or 0, a player's other order turns auto off", async () => {
    const { l, deu, a, ours } = await board();
    const lv = () => [a.auto, a.autoLevel];
    expect(lv()).toEqual([false, 0]);
    expect(
      l.issue(deu, { kind: "army_auto_level", army: a.id, level: 1 }),
    ).toBe(null);
    expect(lv()).toEqual([true, 1]);
    expect(
      l.issue(deu, { kind: "army_auto_level", army: a.id, level: 2 }),
    ).toBe(null);
    expect(lv()).toEqual([true, 2]);
    expect(
      l.issue(deu, { kind: "army_auto_level", army: a.id, level: 0 }),
    ).toBe(null);
    expect(lv()).toEqual([false, 0]);
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    expect(lv()).toEqual([true, 2]);
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: false })).toBe(
      null,
    );
    expect(lv()).toEqual([false, 0]);
    // The AI's own orders leave the level; a player's turn it off, level too.
    expect(
      l.issue(deu, { kind: "army_auto_level", army: a.id, level: 1 }),
    ).toBe(null);
    expect(
      l.issue(deu, { kind: "army_zone", army: a.id, regions: [ours[0]] }, "ai"),
    ).toBe(null);
    expect(lv()).toEqual([true, 1]);
    expect(
      l.issue(deu, { kind: "army_zone", army: a.id, regions: [ours[1]] }),
    ).toBe(null);
    expect(lv()).toEqual([false, 0]);
    // The summary sends the level only when set.
    expect(l.armySummary(a).mine!.autoLevel).toBeUndefined();
    l.issue(deu, { kind: "army_auto_level", army: a.id, level: 1 });
    expect(l.armySummary(a).mine!.autoLevel).toBe(1);
  });

  test("the intents reach the land war through the order path", async () => {
    const { runner, a, ours } = await board();
    step(runner, 1, [
      order(HUMAN, {
        kind: "army_zone",
        army: a.id,
        regions: [ours[1], ours[0]],
      }),
      order(HUMAN, { kind: "army_auto_level", army: a.id, level: 1 }),
    ]);
    // The zone order came first: a player's order turns auto off, then the level is set.
    expect(a.order.zone).toEqual([ours[1], ours[0]]);
    expect(a.autoLevel).toBe(1);
    expect(a.auto).toBe(true);
  });

  test("the new state round-trips through the snapshot and the hash sees it", async () => {
    const { runner, g, l, deu, pol, a, ours, theirs } = await board();
    const [r1, r2] = ours;
    expect(
      l.issue(deu, { kind: "army_zone", army: a.id, regions: [r2, r1] }),
    ).toBe(null);
    expect(
      l.issue(deu, { kind: "army_auto_level", army: a.id, level: 1 }),
    ).toBe(null);
    const b = {
      region: theirs[0],
      sinceTick: g.ticks(),
      round: 3,
      attackers: [],
      defenders: [],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 0,
      attLead: deu,
      defLead: pol,
      band: 2,
      tacticAtt: 3,
      tacticDef: 4,
      phaseRound: 5,
    };
    l.addBattle(b);
    l.bandProg[theirs[1]] = 2;
    l.bandTaker[theirs[1]] = deu;
    l.posLevel[r1] = 3;
    l.posDays[r1] = 4;
    const r2g = await wwRestore(runner, DEU_POL);
    const l2 = land(r2g.game);
    const a2 = l2.armies.get(a.id)!;
    expect(a2.order.zone).toEqual([r2, r1]);
    expect(a2.autoLevel).toBe(1);
    expect(a2.auto).toBe(true);
    const b2 = l2.battles.get(theirs[0])!;
    expect([b2.band, b2.tacticAtt, b2.tacticDef, b2.phaseRound]).toEqual([
      2, 3, 4, 5,
    ]);
    expect([l2.bandProg[theirs[1]], l2.bandTaker[theirs[1]]]).toEqual([2, deu]);
    expect([l2.posLevel[r1], l2.posDays[r1]]).toEqual([3, 4]);
    expect(l2.hash()).toBe(l.hash());
    expect(gameHash(r2g)).toBe(gameHash(runner));
    expect(JSON.stringify(l2.snapshot())).toBe(JSON.stringify(l.snapshot()));
    // The screens: a battle of band 2 and the region's progress.
    expect(l.battleSummary(b).band).toBe(2);
    expect([
      l.battleSummary(b).tacticAtt,
      l.battleSummary(b).tacticDef,
    ]).toEqual([3, 4]);
    expect(l.regionData(theirs[1])).toMatchObject({ prog: 2, taker: deu });
    expect(l.regionData(r1).pos).toBe(3);
    l.endBattle(theirs[0]);
  });

  test("each new field moves the hash, and back again", async () => {
    const { g, l, deu, pol, a, ours, theirs } = await board();
    const [r1] = ours;
    l.addBattle({
      region: theirs[0],
      sinceTick: g.ticks(),
      round: 0,
      attackers: [],
      defenders: [],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 0,
      attLead: deu,
      defLead: pol,
      band: 0,
      tacticAtt: 0,
      tacticDef: 0,
      phaseRound: 0,
    });
    const bt = l.battles.get(theirs[0])!;
    const base = l.hash();
    const pos0 = l.posLevel[r1];
    const days0 = l.posDays[r1];
    const changes: [string, () => void, () => void][] = [
      ["zone", () => a.order.zone.push(r1), () => a.order.zone.pop()],
      [
        "zone order",
        () => a.order.zone.push(r1, ours[1]),
        () => (a.order.zone = []),
      ],
      [
        "autoLevel 1",
        () => {
          a.auto = true;
          a.autoLevel = 1;
        },
        () => {
          a.auto = false;
          a.autoLevel = 0;
        },
      ],
      ["band", () => (bt.band = 1), () => (bt.band = 0)],
      ["tacticAtt", () => (bt.tacticAtt = 1), () => (bt.tacticAtt = 0)],
      ["tacticDef", () => (bt.tacticDef = 1), () => (bt.tacticDef = 0)],
      ["phaseRound", () => (bt.phaseRound = 1), () => (bt.phaseRound = 0)],
      ["bandProg", () => (l.bandProg[r1] = 1), () => (l.bandProg[r1] = 0)],
      ["bandTaker", () => (l.bandTaker[r1] = 1), () => (l.bandTaker[r1] = 0)],
      // (The daily step of the positions may have set them already: move them.)
      [
        "posLevel",
        () => (l.posLevel[r1] = pos0 + 1),
        () => (l.posLevel[r1] = pos0),
      ],
      [
        "posDays",
        () => (l.posDays[r1] = days0 + 1),
        () => (l.posDays[r1] = days0),
      ],
    ];
    for (const [what, change, undo] of changes) {
      change();
      expect(l.hash(), what).not.toBe(base);
      undo();
      expect(l.hash(), what).toBe(base);
    }
    // Auto on at level 2 hashes as auto always did: only level 1 adds a fold.
    a.auto = true;
    a.autoLevel = 2;
    const level2 = l.hash();
    a.autoLevel = 1;
    expect(l.hash()).not.toBe(level2);
    a.auto = false;
    a.autoLevel = 0;
    expect(l.hash()).toBe(base);
    l.endBattle(theirs[0]);
  });

  test("an old snapshot (no new fields) restores with the defaults", async () => {
    const { l, deu, a, ours } = await board();
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    const snap = JSON.parse(JSON.stringify(l.snapshot()));
    // Defaults are not written; a level-2 army is the old `auto: true`.
    const mine = snap.armies.find((x: { id: number }) => x.id === a.id);
    expect(mine.auto).toBe(true);
    expect(mine.autoLevel).toBe(2);
    expect("zone" in mine.order).toBe(false);
    expect("bandProg" in snap || "posLevel" in snap).toBe(false);
    expect(snap.battles.every((b: object) => !("band" in b))).toBe(true);
    delete mine.autoLevel;
    l.issue(deu, { kind: "army_zone", army: a.id, regions: [ours[0]] });
    expect(a.order.zone).toEqual([ours[0]]);
    l.restoreState(WwLandStateSchema.parse(snap));
    const back = l.armies.get(a.id)!;
    expect(back.autoLevel).toBe(2);
    expect(back.auto).toBe(true);
    expect(back.order.zone).toEqual([]);
    expect(l.bandProg.every((v) => v === 0)).toBe(true);
  });

  test("predictBattleRange brackets predictBattle (lane A), winPctOf is monotone", async () => {
    const { g, l, a, theirs } = await board();
    placeArmy(g, "POL", theirs[0], 2);
    const row = l.divisions.rowOf(a.divisions[0]);
    const p = predictAttack(l, [row], theirs[0]);
    const range = predictAttackRange(l, [row], theirs[0]);
    expect(range.midPm).toBe(p.ratioPm);
    expect(range.lowPm).toBeLessThanOrEqual(range.midPm);
    expect(range.highPm).toBeGreaterThanOrEqual(range.midPm);
    expect(range.winPct).toBe(winPctOf(p.ratioPm));
    expect(range.days).toBe(p.days);
    let last = -1;
    for (const r of [0, 1, 100, 500, 1000, 1500, 3000, 10_000, 1_000_000]) {
      const w = winPctOf(r);
      expect(w).toBeGreaterThanOrEqual(last);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(100);
      last = w;
    }
    expect(winPctOf(0)).toBe(0);
    expect(winPctOf(1_000_000)).toBe(100);
  });
});

describe("war overhaul C0: the wire", () => {
  const PLAYERS = [{ clientID: "aB3dEf7h" }, { clientID: "Xk9mNp2q" }];
  const [P1] = PLAYERS.map((p) => p.clientID);
  const zone60 = Array.from({ length: WW_ZONE_MAX }, (_, i) => 3 + i);

  test("army_zone and army_auto_level round-trip through zbin", () => {
    const orders = [
      { kind: "army_zone" as const, army: 2, regions: [4, 9, 3] },
      { kind: "army_zone" as const, army: 40, regions: [] },
      { kind: "army_zone" as const, army: 7, regions: zone60 },
      { kind: "army_auto_level" as const, army: 2, level: 0 },
      { kind: "army_auto_level" as const, army: 2, level: 1 },
      { kind: "army_auto_level" as const, army: 2, level: 2 },
    ];
    const msg: ServerMessage = {
      type: "turn",
      turn: {
        turnNumber: 11,
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

  test("the schema refuses a zone over the limit and a level over 2", () => {
    const intent = (order: unknown) => ({
      type: "ww_order",
      clientID: P1,
      order,
    });
    const ok = (order: unknown) =>
      IntentSchema.safeParse(intent(order)).success;
    expect(ok({ kind: "army_zone", army: 1, regions: zone60 })).toBe(true);
    expect(ok({ kind: "army_zone", army: 1, regions: [...zone60, 99] })).toBe(
      false,
    );
    expect(ok({ kind: "army_auto_level", army: 1, level: 2 })).toBe(true);
    expect(ok({ kind: "army_auto_level", army: 1, level: 3 })).toBe(false);
  });
});
