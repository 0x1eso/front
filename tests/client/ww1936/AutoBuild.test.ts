// World War 1936: the build menu's [알아서 짓기] (auto-place) on the real world1936
// map with a human USA.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { BUILDABLE } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { buildBlock as engineBuildBlock } from "@openfront/engine/ww1936/economy/Construction";
import { EventBus } from "@openfront/shared/EventBus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import type { WirePlayer } from "@openfront/shared/WireSchemas";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  autoPlace,
  buildDepthInputs,
  fightingFn,
  slotPctOf,
} from "../../../src/client/hud/ww1936/EconomyModel";
import { OpenWwIndustryEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { GameView } from "../../../src/client/view/GameView";
import { NodeGameMapLoader } from "../../perf/fullgame/NodeGameMapLoader";
import { stubWorker } from "../../util/viewStubs";
import { HUMAN, order, step, stepTo, wwGameStart } from "../../ww1936/util";

const HUMANS = [{ clientID: HUMAN, country: "USA" as const }];

async function usaGame() {
  const files = await loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const start = wwGameStart({}, HUMANS);
  const updates: GameUpdateViewData[] = [];
  const runner = await createGameRunner(start, undefined, files, (gu) => {
    if ("errMsg" in gu) throw new Error(gu.errMsg);
    updates.push(gu);
  });
  stepTo(runner, WW_PREP_TICKS + 2);
  const view = new GameView(
    stubWorker(),
    new Config(start.config, false),
    await loadTerrainMap(files),
    HUMAN,
    "player0",
    null,
    start.gameID,
    start.players as WirePlayer[],
  );
  let done = 0;
  /** The engine runs `n` ticks with `orders`; the view takes every update. */
  const run = (n: number, orders: WwOrder[] = []) => {
    step(
      runner,
      n,
      orders.map((o) => order(HUMAN, o)),
    );
    for (; done < updates.length; done++) view.update(updates[done]);
  };
  run(1);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-industry-panel") as WwIndustryPanel;
  el.game = view;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new OpenWwIndustryEvent("construction", null));
  const redraw = async () => {
    el.tick();
    await el.updateComplete;
  };
  await redraw();
  const pick = async (b: BuildingId) => {
    el.querySelector<HTMLButtonElement>(`[data-ww-building='${b}']`)!.click();
    await redraw();
    return {
      candidates: el.querySelectorAll("[data-ww-candidate]").length,
      block: el.querySelector("[data-ww-block]")?.getAttribute("data-ww-block"),
      add: el.querySelector<HTMLButtonElement>("[data-ww-add-build]"),
    };
  };
  const ww = runner.game.worldWar()!;
  const id = runner.game.playerByClientID(HUMAN)!.smallID();
  return { runner, view, ww, id, run, el, sent, redraw, pick };
}

describe("auto-place (알아서 짓기) on the real world map, a human USA", () => {
  it("picks valid regions for each building type, never blocked or NO_STRIKE", async () => {
    const g = await usaGame();
    const { ww, id } = g;
    const econ = ww.economy;
    const ce = econ.country(id)!;
    for (const t of [
      "nuclear_physics",
      "rocketry_1",
      "electronics_1",
    ] as const) {
      ce.addTech(t);
    }
    ww.depth.country(id)!.proj.done |=
      1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
    g.run(2);
    const ev = g.view.wwEconomy()!;
    const slotPct = slotPctOf(ev.detail(id));
    const depth = buildDepthInputs(g.view, id);
    let withPlan = 0;
    for (const b of BUILDABLE) {
      const plan = autoPlace(
        ev,
        ww.scenario,
        id,
        b,
        5,
        slotPct,
        fightingFn(g.view),
        false,
        g.view.wwEndgame(),
        depth,
      );
      if (plan.placed === 0) {
        expect(plan.block, b).toBeTruthy();
        continue;
      }
      withPlan++;
      expect(plan.placed, b).toBeLessThanOrEqual(5);
      for (const p of plan.placements) {
        expect(isNoStrike(ww.scenario, p.region), `${b} ${p.region}`).toBe(
          false,
        );
        expect(econ.controllerOf(p.region), b).toBe(id);
        expect(
          engineBuildBlock(econ, ce, p.region, b, p.count),
          `${b} in ${p.region}`,
        ).toBeNull();
      }
    }
    expect(withPlan).toBeGreaterThanOrEqual(10);
  }, 120_000);

  it("the x5 tap spreads over regions and the engine queues every order", async () => {
    const g = await usaGame();
    const { ww, id } = g;
    const ce = ww.economy.country(id)!;
    await g.redraw();
    g.el.querySelector<HTMLButtonElement>("[data-ww-building='civ']")!.click();
    await g.redraw();
    g.el.querySelector<HTMLButtonElement>("[data-ww-auto-count='5']")!.click();
    await g.redraw();
    const before = g.sent.length;
    g.el.querySelector<HTMLButtonElement>("[data-ww-auto-build]")!.click();
    await g.redraw();
    const orders = g.sent.slice(before);
    expect(orders.length).toBeGreaterThan(0);
    let total = 0;
    const regions = new Set<number>();
    for (const o of orders) {
      if (o.kind !== "build") throw new Error("not a build order");
      total += o.count;
      regions.add(o.region);
    }
    expect(total).toBe(5);
    expect(regions.size, JSON.stringify(orders)).toBeGreaterThan(1);
    const msg = g.el.querySelector("[data-ww-auto-msg]")!.textContent!;
    expect(msg).toContain("ww1936.econ.auto_done");
    g.run(2, orders);
    for (const o of orders) {
      if (o.kind === "build") {
        expect(
          ce.queue.some((q) => q.building === "civ" && q.region === o.region),
        ).toBe(true);
      }
    }
  }, 120_000);

  it("says why when nothing can be built", async () => {
    const g = await usaGame();
    await g.redraw();
    g.el
      .querySelector<HTMLButtonElement>(
        "[data-ww-building='facility_nuclear']",
      )!
      .click();
    await g.redraw();
    g.el.querySelector<HTMLButtonElement>("[data-ww-auto-build]")!.click();
    await g.redraw();
    expect(g.el.querySelector("[data-ww-auto-msg]")!.textContent).toContain(
      "ww1936.econ.block.no_tech",
    );
  }, 120_000);
});
