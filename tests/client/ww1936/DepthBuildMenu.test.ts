// World War 1936 (owner report 2026-10-30, USA on 1942-10-13): the build
// menu offered no region for a nuclear, rocket or science facility, a rocket
// launch site, a power plant or a dam's repair, whatever was researched —
// the screen's build check never handed engine-lib's buildBlockOf the
// depth rules' answer (depthBlock), so every region read "not_buildable".
// The real world1936 map, a human USA, a real GameView fed by the engine's
// own updates and the real industry drawer: each of the six is listed and
// queued once its conditions are met (the rules read no date: a 1942 game
// answers as this one does), the screen judges every region as the engine
// does (a destroyed dam by the depth world's dam levels, which the engine
// reads), and a building no region takes says why.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  DAMS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { DEPTH_BUILDINGS } from "@openfront/engine-lib/ww1936/WorldRules";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { destroyDam } from "@openfront/engine/ww1936/depth/Dams";
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
  buildBlock,
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

describe("the P6 buildings in the build menu (owner report, USA 1942)", () => {
  it("lists regions for each of the six, queues it, and judges as the engine", async () => {
    const g = await usaGame();
    const { ww, id } = g;
    const econ = ww.economy;
    const ce = econ.country(id)!;

    // Not yet: no region takes them, and the menu says why (it showed
    // nothing at all).
    expect(ce.researched.has("nuclear_physics")).toBe(false);
    expect(await g.pick("facility_nuclear")).toMatchObject({
      candidates: 0,
      block: "no_tech",
    });
    expect(await g.pick("rocket_site")).toMatchObject({
      candidates: 0,
      block: "project_locked",
    });
    // Every US dam stands: there is nothing to repair.
    const dam = await g.pick("dam");
    expect(dam.candidates).toBe(0);
    expect(dam.block).toBeTruthy();

    // The conditions met: the techs, the flying bomb project, a US dam
    // destroyed by a raid (its repair is the dam's build).
    for (const t of [
      "nuclear_physics",
      "rocketry_1",
      "electronics_1",
    ] as const) {
      ce.addTech(t);
    }
    ww.depth.country(id)!.proj.done |=
      1 << SPECIAL_PROJECTS.indexOf("sp_flying_bomb");
    const hoover = DAMS.indexOf("dam_hoover");
    const damRegion = ww.scenario.damRegion[hoover];
    expect(econ.controllerOf(damRegion)).toBe(id);
    // The region's infrastructure at the flood's floor: the flood cuts
    // none, so the economy does not resend the region (its dam level
    // there stays 1); the depth world's dam levels are the fresh ones.
    econ.addBuilding(damRegion, "infra", 1 - econ.infra[damRegion]);
    g.run(1);
    destroyDam(ww.depth, hoover, 0, g.runner.game.ticks());
    econ.markCountryDirty(id);
    ww.depth.markCountry(id);
    g.run(2);
    expect(g.view.wwDepth()!.worldData.damLevel[hoover]).toBe(0);

    // The screen's judgement is the engine's, region by region.
    const ev = g.view.wwEconomy()!;
    const slotPct = slotPctOf(ev.detail(id));
    const depth = buildDepthInputs(g.view, id);
    for (const b of DEPTH_BUILDINGS) {
      for (const r of econ.regionsOf(id)) {
        expect(
          buildBlock(
            ev,
            ww.scenario,
            id,
            r,
            b,
            1,
            slotPct,
            fightingFn(g.view),
            g.view.wwEndgame(),
            depth,
          ),
          `${b} in ${r}`,
        ).toBe(engineBuildBlock(econ, ce, r, b, 1));
      }
    }

    // Each is listed, and the engine takes the menu's order.
    for (const b of DEPTH_BUILDINGS) {
      const m = await g.pick(b);
      expect(m.candidates, b).toBeGreaterThan(0);
      expect(m.block, b).toBeUndefined();
      expect(m.add!.disabled, b).toBe(false);
      m.add!.click();
      const o = g.sent[g.sent.length - 1];
      expect(o).toMatchObject({ kind: "build", building: b });
      if (o.kind !== "build") throw new Error("not a build order");
      g.run(2, [o]);
      expect(
        ce.queue.some((q) => q.building === b && q.region === o.region),
        b,
      ).toBe(true);
      await g.redraw();
    }
  }, 120_000);
});
