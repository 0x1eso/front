// World War 1936 P1 (plan Task 9): the economy's snapshot oracle. A game
// restored at any moment of the economy (mid-day, orders just in, a project
// half built, a line just retooled, research under way, a deal open, a law
// cooling down) goes on exactly like the original: the game hash and the
// economy's snapshot equal tick by tick, the whole snapshot every 50 ticks.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { StampedIntent, WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  RESOURCE_IDS,
  WW_TRADE_UNITS_PER_CIV,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  exportRoom,
  tradePartners,
} from "@openfront/engine/ww1936/economy/Trade";
import type { WwEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import {
  byTag,
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
  wwGameStart,
  WwHuman,
  wwRunner,
} from "./util";

const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();
const econOf = (g: Game): WwEconomy => g.worldWar()!.economy;
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

async function miniFiles(): Promise<MapFiles> {
  return loadMapFiles(
    new TestDataMapLoader(MINI),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

let worldFilesMemo: Promise<MapFiles> | null = null;
function worldFiles(): Promise<MapFiles> {
  return (worldFilesMemo ??= loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  ));
}

/** A new runner from `runner`'s snapshot; `updates` collects its view data. */
async function restore(
  runner: GameRunner,
  humans: WwHuman[],
  files: MapFiles,
  updates: GameUpdateViewData[] = [],
): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({}, humans),
    runner.snapshot(),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
      updates.push(gu);
    },
  );
}

/**
 * Runs both with the same turns: the game hash and the economy's snapshot
 * equal after every tick, the whole game snapshot every `fullEvery` ticks
 * and at the end, the live object graphs at both ends.
 */
function lockstep(
  a: GameRunner,
  b: GameRunner,
  ticks: number,
  intents: (tick: number) => StampedIntent[] = () => [],
  fullEvery = 50,
): void {
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    const turn = intents(a.game.ticks());
    step(a, 1, turn);
    step(b, 1, turn);
    if (hash(a) !== hash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
    const ea = JSON.stringify(econOf(a.game).snapshot());
    const eb = JSON.stringify(econOf(b.game).snapshot());
    if (ea !== eb) {
      expect(JSON.parse(eb)).toEqual(JSON.parse(ea));
    }
    if ((i + 1) % fullEvery === 0 || i + 1 === ticks) {
      expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
        [],
      );
    }
  }
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

const DEU_HUMAN: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];

/**
 * Five kinds of order from human Germany (test map: Munich is region 4); the
 * deal is with the first partner that has a deal's worth of anything left.
 */
function germanOrders(g: Game): StampedIntent[] {
  const econ = econOf(g);
  const deu = byTag(g, "DEU").smallID();
  let deal: WwOrder | null = null;
  for (const s of tradePartners(econ, deu)) {
    const r = RESOURCE_IDS.findIndex(
      (_, k) => exportRoom(econ, s, k) >= WW_TRADE_UNITS_PER_CIV,
    );
    if (r < 0) continue;
    const seller = (g.playerBySmallID(s) as Player).id();
    deal = { kind: "open_trade", seller, resource: RESOURCE_IDS[r], civs: 1 };
    break;
  }
  if (deal === null) throw new Error("nobody sells Germany anything");
  const orders: WwOrder[] = [
    { kind: "build", region: 4, building: "civ", count: 2 },
    { kind: "add_line", equipment: "infantry_equipment", gen: 1, factories: 4 },
    { kind: "add_line", equipment: "support_equipment", gen: 1, factories: 2 },
    { kind: "research", tech: "tools_2" },
    { kind: "set_law", law: "trade", value: "export_focus" },
    deal,
  ];
  return orders.map((order) => stamped(HUMAN, { type: "ww_order", order }));
}

describe("the economy restores exactly (P1 plan Task 9)", () => {
  test("restoring mid-day continues exactly", async () => {
    const files = await miniFiles();
    const a = await wwRunner();
    // The day's third tick: countries with smallID % 7 < 3 ran today.
    stepTo(a, dayStart(40) + 3);
    const b = await restore(a, [], files);
    lockstep(a, b, 2000);
  }, 180_000);

  test("restoring with orders in flight", async () => {
    const files = await miniFiles();
    const a = await wwRunner({}, DEU_HUMAN);
    stepTo(a, dayStart(3) + 1);
    step(a, 1, germanOrders(a.game));
    const deu = econOf(a.game).country(byTag(a.game, "DEU").smallID())!;
    // Every order took effect.
    expect(deu.queue).toHaveLength(1);
    expect(deu.lines).toHaveLength(2);
    expect(deu.slots.some((s) => s?.tech === "tools_2")).toBe(true);
    expect(deu.laws.trade).toBe("export_focus");
    expect(
      econOf(a.game)
        .trades()
        .filter((t) => t.buyer === deu.smallID),
    ).toHaveLength(1);
    const b = await restore(a, DEU_HUMAN, files);
    lockstep(a, b, 600);
  }, 180_000);

  test("restoring at the economy's moments: a project half built, a line just retooled, research under way, a deal open, a law cooling down", async () => {
    const files = await miniFiles();
    const a = await wwRunner({}, DEU_HUMAN);
    const g = a.game;
    stepTo(a, dayStart(2) + 2);
    step(a, 1, germanOrders(g));
    const deu = econOf(g).country(byTag(g, "DEU").smallID())!;
    // Day 6: the support line retools to anti-tank guns.
    stepTo(a, dayStart(6) + 2);
    const support = deu.lines[1];
    step(a, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: {
          kind: "change_line",
          line: support.id,
          equipment: "anti_tank",
          gen: 1,
        },
      }),
    ]);
    stepTo(a, dayStart(12) + 4);
    const day = econOf(g).day();
    expect(deu.queue[0].progress).toBeGreaterThan(0);
    expect(deu.queue[0].progress).toBeLessThan(10_800_000);
    expect(deu.lines[1].progress).toBeGreaterThan(0);
    expect(deu.lines[1].effBp).toBeLessThan(deu.lines[0].effBp);
    expect(
      deu.slots.find((s) => s?.tech === "tools_2")!.progress,
    ).toBeGreaterThan(0);
    expect(econOf(g).trades().length).toBeGreaterThan(0);
    expect(deu.lawCooldownUntil.trade).toBeGreaterThan(day);
    const b = await restore(a, DEU_HUMAN, files);
    // Past the cooldown and the first factory.
    lockstep(a, b, 700);
    expect(deu.lawCooldownUntil.trade).toBeLessThan(econOf(g).day());
  }, 180_000);

  test("derived fields rebuild the same", async () => {
    const files = await miniFiles();
    const a = await wwRunner({}, DEU_HUMAN);
    const g = a.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(a, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    // Germany takes Warsaw: the graph is no longer the starting one.
    const warsaw = ww.scenario.landRegions.find((r) => r.name === "Warsaw")!;
    for (const t of [...pol.tiles()]) {
      if (ww.scenario.regionAt(t) === warsaw.id) deu.conquer(t);
    }
    stepTo(a, dayStart(3) + 2);
    const ea = econOf(g);
    expect(ea.controllerOf(warsaw.id)).toBe(deu.smallID());
    const b = await restore(a, DEU_HUMAN, files);
    const eb = econOf(b.game);
    for (const ce of ea.countries()) {
      const id = ce.smallID;
      expect([...eb.countryNeighbours(id)]).toEqual([
        ...ea.countryNeighbours(id),
      ]);
      expect([...eb.countrySeaZones(id)]).toEqual([...ea.countrySeaZones(id)]);
      expect([...eb.regionsOf(id)]).toEqual([...ea.regionsOf(id)]);
      expect(eb.country(id)!.tech).toEqual(ce.tech);
      expect([...eb.country(id)!.researched]).toEqual([...ce.researched]);
      expect(tradePartners(eb, id)).toEqual(tradePartners(ea, id));
    }
  }, 120_000);

  test("a restored game sends every country and every region to its screens", async () => {
    const files = await miniFiles();
    const a = await wwRunner();
    stepTo(a, dayStart(5) + 3);
    const updates: GameUpdateViewData[] = [];
    const b = await restore(a, [], files, updates);
    step(b);
    const [first] = updates.flatMap((u) => u.updates[GameUpdateType.WwEconomy]);
    const ww = b.game.worldWar()!;
    expect(first.data.regions.map((r) => r.id)).toEqual(
      ww.scenario.landRegions.map((r) => r.id),
    );
    expect(first.data.countries.map((c) => c.smallID)).toEqual(
      ww.economy.countries().map((c) => c.smallID),
    );
    // Each region as the engine holds it.
    for (const r of first.data.regions) {
      expect(r).toEqual({
        id: r.id,
        controller: ww.economy.controller[r.id],
        civ: ww.economy.civ[r.id],
        mil: ww.economy.mil[r.id],
        dock: ww.economy.dock[r.id],
        infra: ww.economy.infra[r.id],
      });
    }
  }, 60_000);

  test("the economy hash sees docks, line progress and activity, deal sizes, law cooldowns, construction and research progress and the field infantry", async () => {
    const a = await wwRunner({}, DEU_HUMAN);
    const g = a.game;
    stepTo(a, dayStart(2) + 2);
    step(a, 1, germanOrders(g));
    stepTo(a, dayStart(5) + 2);
    const econ = econOf(g);
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    const slot = () => deu.slots.find((s) => s?.tech === "tools_2")!;
    expect(deu.queue[0].progress).toBeGreaterThan(0);
    expect(slot().progress).toBeGreaterThan(0);
    const base = econ.hash();
    const changes: [string, () => void, () => void][] = [
      ["dock", () => (econ.dock[4] += 1), () => (econ.dock[4] -= 1)],
      [
        "line progress",
        () => (deu.lines[0].progress += 1),
        () => (deu.lines[0].progress -= 1),
      ],
      [
        "line activity",
        () => (deu.lines[0].active -= 1),
        () => (deu.lines[0].active += 1),
      ],
      [
        "deal size",
        () => ((econ.trades()[0] as { civs: number }).civs += 1),
        () => ((econ.trades()[0] as { civs: number }).civs -= 1),
      ],
      [
        "law cooldown",
        () => (deu.lawCooldownUntil.economy += 1),
        () => (deu.lawCooldownUntil.economy -= 1),
      ],
      [
        "construction progress",
        () => (deu.queue[0].progress += 1),
        () => (deu.queue[0].progress -= 1),
      ],
      [
        "research progress",
        () => (slot().progress += 1),
        () => (slot().progress -= 1),
      ],
      [
        "field infantry",
        () => (deu.fieldInfUnits += 1),
        () => (deu.fieldInfUnits -= 1),
      ],
    ];
    for (const [what, change, undo] of changes) {
      change();
      expect(econ.hash(), what).not.toBe(base);
      undo();
      expect(econ.hash(), what).toBe(base);
    }
  }, 60_000);
});

describe("the economy restores exactly on the world1936 map", () => {
  // 78 AI economies and a human Germany with an order of every kind.
  const humans: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];
  test("a short window after a restore at day 25", async () => {
    const files = await worldFiles();
    const a = await createGameRunner(
      wwGameStart({}, humans),
      undefined,
      files,
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = a.game;
    const econ = econOf(g);
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    stepTo(a, dayStart(1) + 2);
    // Germany: a factory, a line, research, a law and a deal for oil from
    // whoever sells the most of it now.
    const oil = RESOURCE_IDS.indexOf("oil");
    const seller = tradePartners(econ, deu.smallID)
      .map((id) => econ.country(id)!)
      .sort(
        (x, y) =>
          y.totals.produced[oil] - x.totals.produced[oil] ||
          x.smallID - y.smallID,
      )[0];
    expect(seller.totals.produced[oil]).toBeGreaterThan(
      2 * WW_TRADE_UNITS_PER_CIV,
    );
    const region = econ
      .regionsOf(deu.smallID)
      .find(
        (id) =>
          econ.regionSlots(id, deu.tech.slotPct) >
          econ.civ[id] + econ.mil[id] + econ.dock[id],
      )!;
    const orders: WwOrder[] = [
      { kind: "build", region, building: "mil", count: 1 },
      {
        kind: "add_line",
        equipment: "infantry_equipment",
        gen: 1,
        factories: 10,
      },
      { kind: "research", tech: "tools_2" },
      { kind: "set_law", law: "trade", value: "export_focus" },
      {
        kind: "open_trade",
        seller: (g.playerBySmallID(seller.smallID) as Player).id(),
        resource: "oil",
        civs: 1,
      },
    ];
    step(
      a,
      1,
      orders.map((order) => stamped(HUMAN, { type: "ww_order", order })),
    );
    stepTo(a, dayStart(25) + 3);
    // The moments this restore lands in.
    const day = econ.day();
    expect(deu.queue[0].progress).toBeGreaterThan(0);
    expect(deu.lines[0].progress).toBeGreaterThan(0);
    expect(deu.slots.some((s) => s !== null && s.progress > 0)).toBe(true);
    expect(deu.lawCooldownUntil.trade).toBeGreaterThan(day);
    expect(econ.trades().length).toBeGreaterThan(5);
    const tags = new Set<CountryTag>(
      econ.trades().map((t) => econ.country(t.buyer)!.tag),
    );
    expect(tags.has("DEU")).toBe(true);
    const b = await restore(a, humans, files);
    lockstep(a, b, 120, () => [], 120);
  }, 300_000);
});
