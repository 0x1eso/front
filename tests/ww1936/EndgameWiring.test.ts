// World War 1936 P5 (plan Task 1 Step 16, Review Focus 4): the dormant
// slots and the controllers leave the earlier phases' rules alone.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { DORMANT_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { CS_ACTIVE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { NationExecution } from "@openfront/engine/execution/NationExecution";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import type { Game } from "@openfront/engine/game/Game";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { activateCountry } from "@openfront/engine/ww1936/endgame/Activate";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { scoreInputs } from "@openfront/engine/ww1936/Victory";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  order,
  step,
  stepTo,
  wwRunner,
  wwRunnerCapture,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const POL_CLIENT = "HUMANPOL";

function executionsOf(g: Game, id: number) {
  return g
    .executions()
    .filter(
      (e) =>
        (e instanceof PlayerExecution && e.playerRef().smallID() === id) ||
        (e instanceof NationExecution &&
          e.nationPlayerId() === g.playerBySmallID(id).id()),
    );
}

describe("World War 1936 P5: the endgame's wiring", () => {
  it("dormant countries exist from tick 0 with no land and no executions", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    step(runner, 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    expect(g.allPlayers()).toHaveLength(24);
    for (let id = 11; id <= 24; id++) {
      const p = g.playerBySmallID(id);
      expect(p.isPlayer() && p.numTilesOwned()).toBe(0);
      expect(ww.tagOf(id)).toBe(DORMANT_TAGS[id - 11]);
      expect(ww.endgame.countryState(id)).toBe("dormant");
      expect(ww.isActor(id)).toBe(false);
      expect(executionsOf(g, id)).toEqual([]);
    }
    // Every scenario country has its executions.
    expect(executionsOf(g, endId("DEU")).length).toBe(2);
    // Not in the score (P5 spec §16.1), not in the leaderboard's inputs.
    expect(scoreInputs(g, ww).map((s) => s.smallID)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
  });

  it("a woken country gets its executions and economy on the tick its land arrives", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const svk = endId("SVK");
    expect(
      activateCountry(ww.endgame, "SVK", { regions: [15, 20] }, g.ticks()),
    ).toBe(svk);
    step(runner);
    const p = g.playerBySmallID(svk);
    expect(p.isPlayer() && p.numTilesOwned()).toBeGreaterThan(0);
    for (const r of [15, 20]) {
      const vp = ww.scenario.vpTile(ww.scenario.region(r)!);
      expect(g.ownerID(vp)).toBe(svk);
      expect(ww.land.controller[r]).toBe(svk);
      expect(ww.politics.legalOwner[r]).toBe(svk);
    }
    expect(ww.endgame.countryStateArr[svk]).toBe(CS_ACTIVE);
    expect(ww.isActor(svk)).toBe(true);
    const execs = executionsOf(g, svk);
    expect(execs.some((e) => e instanceof PlayerExecution)).toBe(true);
    expect(execs.some((e) => e instanceof NationExecution)).toBe(true);
    // Never twice.
    activateCountry(ww.endgame, "SVK", { regions: [] }, g.ticks());
    step(runner);
    expect(executionsOf(g, svk)).toHaveLength(execs.length);
    // Its next economy turn counts both regions' factories (one each).
    const ce = ww.economy.country(svk)!;
    for (let i = 0; i < 16; i++) step(runner);
    expect(ce.totals.civ).toBe(2);
  });

  it("a human command reaches the country the client now controls", async () => {
    const { runner, updates } = await wwRunnerCapture(
      {},
      [{ clientID: POL_CLIENT, country: "POL" }],
      END_MAP,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [plId, csk] = [endId("POL"), endId("CSK")];
    expect(ww.isHumanControlled(plId)).toBe(true);
    ww.endgame.setControl(POL_CLIENT, csk);
    expect(ww.isHumanControlled(csk)).toBe(true);
    expect(ww.isHumanControlled(plId)).toBe(false);
    expect(ww.controlledBy(POL_CLIENT)).toBe(csk);
    expect(g.playerByClientID(POL_CLIENT)!.smallID()).toBe(csk);
    const cskArmy = ww.land.armiesOf(csk)[0];
    const polArmies = ww.land.armiesOf(plId).map((a) => a.auto);
    step(runner, 2, [
      order(POL_CLIENT, { kind: "army_auto", army: cskArmy.id, on: true }),
    ]);
    expect(ww.land.armies.get(cskArmy.id)!.auto).toBe(true);
    expect(ww.land.armiesOf(plId).map((a) => a.auto)).toEqual(polArmies);
    // The human's screens: Czechoslovakia's economy details, not Poland's.
    const from = updates.length;
    for (let i = 0; i < 16; i++) step(runner);
    const details = updates
      .slice(from)
      .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
      .flatMap((u) => u.data.details.map((d) => d.smallID));
    expect(details).toContain(csk);
    expect(details).not.toContain(plId);
    // Spectating: no country.
    ww.endgame.setControl(POL_CLIENT, 0);
    expect(g.playerByClientID(POL_CLIENT)).toBeNull();
    expect(ww.isHumanControlled(csk)).toBe(false);
  });

  it("an exiled human's orders are accepted", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: POL_CLIENT, country: "POL" }],
      END_MAP,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const plId = endId("POL");
    const p = g.playerBySmallID(plId);
    if (!p.isPlayer()) throw new Error("no Poland");
    ww.addCapitulation(plId, endId("DEU"), g.ticks());
    const set = { kind: "set_law", law: "economy", value: "civilian" } as const;
    expect(applyWwOrder(g, ww.economy, p, set, ww.day(g.ticks()))).toBe("dead");
    ww.endgame.exiles.push({
      smallID: plId,
      host: endId("GBR"),
      legitBp: 5000,
      sinceDay: 0,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: 6,
    });
    ww.endgame.rebuildDerived();
    expect(ww.isActor(plId)).toBe(true);
    expect(applyWwOrder(g, ww.economy, p, set, ww.day(g.ticks()))).not.toBe(
      "dead",
    );
  });

  it("a 1936 colony (its owner without a core, another core holder) is not administered", async () => {
    // The US Philippines (pre-flight §0-3): legal owner = controller = the
    // 1936 owner, a core of someone else only.
    const runner = await wwRunner({}, [], END_MAP);
    const g = runner.game;
    const eg = g.worldWar()!.endgame;
    eg.removeCore(endId("CSK"), 15);
    expect(eg.coreHolders(15)).toEqual([endId("SVK")]);
    expect(eg.isAdministered(15)).toBe(false);
    // Occupied by Germany (control ≠ legal owner) …
    g.worldWar()!.land.setController(15, endId("DEU"), g.ticks());
    expect(eg.isAdministered(15)).toBe(true);
    // … then annexed (the legal owner changed since 1936): still administered.
    g.worldWar()!.politics.setLegalOwner(15, endId("DEU"));
    expect(eg.isAdministered(15)).toBe(true);
    // Back to its 1936 owner: a colony again.
    g.worldWar()!.politics.setLegalOwner(15, endId("CSK"));
    g.worldWar()!.land.setController(15, endId("CSK"), g.ticks());
    expect(eg.isAdministered(15)).toBe(false);
  });

  it("the vanilla rules are untouched when the mode is off", async () => {
    // tests/VanillaDigest.test.ts pins the vanilla games tick by tick; P5
    // adds no state outside the mode: no endgame, no dormant player.
    const runner = await wwRunner({ worldWar1936: false }, [], END_MAP);
    expect(runner.game.worldWar()).toBeNull();
    expect(runner.game.allPlayers().every((p) => p.name() !== "Slovakia")).toBe(
      true,
    );
  });
});
