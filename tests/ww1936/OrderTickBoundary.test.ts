// World War 1936 final review A, finding 1: an order applies in its
// execution's init, after the tick's WorldWarExecution (and so after its
// end-of-tick flushes). What it leaves pending (politics' queued event
// cards, the depth stats marks) is not state, so it must be drained before
// the order returns. A snapshot taken right after the order's tick then
// continues with the same hash.
import { GRAND_DOCTRINES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { EventDef } from "@openfront/engine-lib/ww1936/content/types";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  gameHash,
  order,
  step,
  stepTo,
  wwRestore,
  wwRunner,
} from "./util";

const C_ITA = "HUMANITA";
const HUMANS = [{ clientID: C_ITA, country: "ITA" as const }];
const INF = "infantry_equipment";

/** Nothing pending is left between ticks (the review's two buffers). */
function nothingPending(ww: WorldWar): void {
  expect(ww.politics.queuedEvents()).toBe(0);
  expect(
    (ww.depth as unknown as { depthDirtyStats: Set<number> }).depthDirtyStats
      .size,
  ).toBe(0);
}

/** `ticks` ticks of both games, equal hashes and nothing pending after each. */
function lockstep(a: GameRunner, b: GameRunner, ticks: number): void {
  expect(gameHash(b)).toBe(gameHash(a));
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    step(a);
    step(b);
    if (gameHash(a) !== gameHash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
    nothingPending(a.game.worldWar()!);
  }
  expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual([]);
}

describe("World War 1936: an order's pending work never crosses the tick boundary", () => {
  afterEach(() => usePoliticsContent(null));

  it("a lend-lease request queued from an order is delivered before the snapshot", async () => {
    // K5's request card (two options without effects; the engine reads the pick).
    const LL_EVENT: EventDef = {
      id: "gen_diplo_lend_lease",
      kind: "country",
      once: "never",
      options: [
        { id: "a", ai: { base: 50 }, effects: [] },
        { id: "b", ai: { base: 50 }, effects: [] },
      ],
    };
    usePoliticsContent(
      endgameFixture({ events: [...endgameFixture().events, LL_EVENT] }),
    );
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 1);
    const ww = a.game.worldWar()!;
    const [deu, ita, sun] = (["DEU", "ITA", "SUN"] as const).map(endId);
    ww.setWar(ita, sun, a.game.ticks(), { kind: "declare" });
    // Italy out of infantry equipment (the request is a real need).
    const ce = ww.economy.country(ita)!;
    for (let gen = 1; gen <= EQUIPMENT_GENS[INF]; gen++) {
      ce.stock[equipKey(INF, gen)] = 0;
    }
    for (const r of ww.land.rowsOf(ita)) {
      const eq = ww.land.divisions.equipOf(r);
      GROUND_EQUIP_KEYS.forEach((k, j) => {
        if (EQUIP_KEYS[k][0] === INF) eq[j] = 0;
      });
    }
    step(a, 1, [
      order(C_ITA, {
        kind: "lend_lease_request",
        from: deu,
        item: INF,
        perMonth: 300,
      }),
    ]);
    const c = ww.endgame.lendLease.find((x) => x.from === deu && x.to === ita);
    expect(c).toBeDefined();
    nothingPending(ww);
    const b = await wwRestore(a, HUMANS, END_MAP);
    lockstep(a, b, 60);
    // Both games settled the request the same way.
    const settled = (g: GameRunner) =>
      g.game
        .worldWar()!
        .endgame.lendLease.filter((x) => x.from === deu && x.to === ita)
        .map((x) => [x.item, x.perMonth, x.blocked]);
    expect(settled(b)).toEqual(settled(a));
  }, 30_000);

  it("a decision whose mastery raises a track recomputes the stats before the snapshot", async () => {
    const TEST_DEC: DecisionDef = {
      id: "t_mastery",
      category: "political",
      for: "any",
      ai: { base: 0 },
      effects: [{ kind: "doctrine_mastery", domain: "land", amount: 900 }],
    };
    const base = depthFixture();
    usePoliticsContent(
      depthFixture({ decisions: [...base.decisions, TEST_DEC] }),
    );
    const a = await wwRunner({}, HUMANS, DEEP.map);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const ita = DEEP.tag.ITA;
    ww.depth.country(ita)!.doc.gd[0] = GRAND_DOCTRINES.indexOf("gd_mobile");
    const before = ww.depth.country(ita)!.doc.masteryMilli.slice(0, 3);
    step(a, 1, [
      order(C_ITA, { kind: "decision_take", decision: "t_mastery", target: 0 }),
    ]);
    const after = ww.depth.country(ita)!.doc.masteryMilli.slice(0, 3);
    expect(after[0] - before[0]).toBeGreaterThanOrEqual(300_000);
    nothingPending(ww);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    lockstep(a, b, 60);
  }, 30_000);
});
