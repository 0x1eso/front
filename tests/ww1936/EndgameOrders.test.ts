// World War 1936 P5 (plan decision 10): the 13 endgame orders reach
// WwEndgame.issue; who may send them (plan decision 6).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, order, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const HUMAN = "HUMANPOL";

/** One sample of each order and the foundation's stub answer. */
const SAMPLES: [WwOrder, string | null][] = [
  [{ kind: "peace_submit", conf: 1, demands: [] }, "not_participant"],
  [{ kind: "peace_pass", conf: 1 }, "not_participant"],
  [{ kind: "occupation_law", of: 0, law: "occ_civil" }, "not_integrable"],
  [{ kind: "integrate_region", region: 15 }, "not_integrable"],
  [
    {
      kind: "lend_lease",
      to: 4,
      item: "infantry_equipment",
      gen: 1,
      perMonth: 100,
    },
    "ll_conditions",
  ],
  [{ kind: "lend_lease_cancel", id: 1 }, "ll_conditions"],
  [
    { kind: "lend_lease_request", from: 3, item: "fuel", perMonth: 50 },
    "ll_conditions",
  ],
  [{ kind: "volunteers_send", army: 1, to: 4 }, "ll_conditions"],
  [{ kind: "volunteers_recall", army: 1 }, "ll_conditions"],
  [
    {
      kind: "air_volunteers",
      to: 4,
      zone: 1,
      plane: "fighter",
      count: 10,
    },
    "ll_conditions",
  ],
  [{ kind: "ships_transfer", to: 4, ships: [1] }, "ll_conditions"],
  [{ kind: "takeover_pick", smallID: 2 }, "no_takeover"],
  [{ kind: "army_garrison", army: 999_999, scope: 0 }, "no_army"],
];

const asPlayer = (g: Game, id: number): Player => {
  const p = g.playerBySmallID(id);
  if (!p.isPlayer()) throw new Error(`no player ${id}`);
  return p;
};

describe("World War 1936 P5: the endgame's orders", () => {
  it("each of the 13 orders reaches the endgame", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const p = asPlayer(g, endId("POL"));
    const issue = vi.spyOn(ww.endgame, "issue");
    for (const [o, block] of SAMPLES) {
      expect(applyWwOrder(g, ww.economy, p, o, ww.day(g.ticks())), o.kind).toBe(
        block,
      );
    }
    // takeover_pick goes by clientID instead (the next test).
    expect(issue.mock.calls.map((c) => c[1].kind)).toEqual(
      SAMPLES.map(([o]) => o.kind).filter((k) => k !== "takeover_pick"),
    );
    issue.mockRestore();
  });

  it("a gone human's takeover_pick reaches the endgame", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "POL" }],
      END_MAP,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pick = vi.spyOn(ww.endgame, "takeoverPickBy");
    // Capitulated, still its player: past the dead-sender check.
    ww.addCapitulation(endId("POL"), endId("DEU"), g.ticks());
    step(runner, 1, [
      order(HUMAN, { kind: "takeover_pick", smallID: endId("GBR") }),
    ]);
    // Spectating: no player at all (playerByClientID is null).
    ww.endgame.setControl(HUMAN, 0);
    expect(g.playerByClientID(HUMAN)).toBeNull();
    step(runner, 1, [
      order(HUMAN, { kind: "takeover_pick", smallID: endId("FRA") }),
    ]);
    expect(pick.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [HUMAN, endId("GBR")],
      [HUMAN, endId("FRA")],
    ]);
    pick.mockRestore();
  });

  it("an army garrison order takes the army off fronts and plans", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "POL" }],
      END_MAP,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const a = ww.land.armiesOf(endId("POL"))[0];
    step(runner, 2, [
      order(HUMAN, { kind: "army_garrison", army: a.id, scope: 0 }),
    ]);
    expect(ww.land.armies.get(a.id)!.order.kind).toBe("garrison");
    expect(ww.land.armies.get(a.id)!.order.enemy).toBe(0);
  });

  it("a dormant or gone country's orders stop at the door; an exile's go through", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const day = ww.day(g.ticks());
    const o = SAMPLES[0][0];
    const svk = asPlayer(g, endId("SVK"));
    expect(applyWwOrder(g, ww.economy, svk, o, day)).toBe("dead");
    const plId = endId("POL");
    const pl = asPlayer(g, plId);
    ww.addCapitulation(plId, endId("DEU"), g.ticks());
    expect(applyWwOrder(g, ww.economy, pl, o, day)).toBe("dead");
    ww.endgame.exiles.push({
      smallID: plId,
      host: endId("GBR"),
      legitBp: 5000,
      sinceDay: day,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: 6,
    });
    ww.endgame.rebuildDerived();
    expect(applyWwOrder(g, ww.economy, pl, o, day)).toBe("not_participant");
  });
});
