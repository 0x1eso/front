// World War 1936 P5 lane O: Korea (north, south) and Taiwan are never
// administered — no resistance, no compliance, no integration — however
// cores, control and legal owners are set. Real world1936 map.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  integrateBlockOf,
  uprisingNow,
} from "@openfront/engine/ww1936/endgame/Occupation";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";

const IDS = [563, 598, 604, 622, 639, 679, 686, 701, 732, 734, 761, 901];

async function worldFiles(): Promise<MapFiles> {
  return loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

async function game() {
  const runner = await createGameRunner(
    wwGameStart(),
    undefined,
    await worldFiles(),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const sc = ww.scenario;
  return { runner, g: runner.game, ww, eg: ww.endgame, sc };
}

function zero(
  eg: { resBp: ArrayLike<number> } & Record<string, any>,
  r: number,
) {
  expect(eg.resBp[r], `res ${r}`).toBe(0);
  expect(eg.compBp[r], `comp ${r}`).toBe(0);
  expect(eg.occSince[r], `since ${r}`).toBe(0);
  expect(eg.uprDays[r], `upr ${r}`).toBe(0);
}

describe("World War 1936 P5: Korea and Taiwan are never administered", () => {
  it("holds for forced cores, control and legal owners", async () => {
    const { runner, g, ww, eg, sc } = await game();
    const [usa, sun, chn] = (["USA", "SUN", "CHN"] as const).map((t) =>
      sc.smallIdOf(t),
    );
    expect([...eg.neverAdministered].sort((a, b) => a - b)).toEqual(IDS);
    IDS.forEach((r, i) => {
      for (const c of [usa, sun, chn]) eg.addCore(c, r);
      expect(eg.hasCore(usa, r)).toBe(false);
      ww.land.setController(r, i % 2 === 0 ? usa : sun, g.ticks());
      ww.politics.setLegalOwner(r, chn);
    });
    for (const r of IDS) {
      expect(eg.isAdministered(r)).toBe(false);
      expect(eg.regionShare(r)).toBeNull();
      expect(integrateBlockOf(eg, usa, r)).toBe("not_integrable");
      uprisingNow(eg, r, g.ticks());
    }
    for (const c of [usa, sun]) {
      for (const r of eg.administeredOf(c)) expect(IDS).not.toContain(r);
    }
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 40, ww.prepEndTick()));
    for (const r of IDS) {
      expect(eg.isAdministered(r)).toBe(false);
      zero(eg, r);
    }
  }, 600_000);

  it("stays so when Japan capitulates and the zones go to the USA and USSR", async () => {
    const { runner, g, ww, eg, sc } = await game();
    const [usa, sun, jpn] = (["USA", "SUN", "JPN"] as const).map((t) =>
      sc.smallIdOf(t),
    );
    IDS.forEach((r, i) => {
      ww.land.setController(r, jpn, g.ticks());
      ww.land.setController(r, i % 2 === 0 ? usa : sun, g.ticks());
    });
    eg.onCapitulated(jpn, usa, g.ticks());
    for (const r of IDS) expect(eg.isAdministered(r)).toBe(false);
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 40, ww.prepEndTick()));
    for (const r of IDS) {
      expect(eg.isAdministered(r)).toBe(false);
      zero(eg, r);
    }
  }, 600_000);
});
