// World War 1936: Taiwan and Seoul keep a level-1 naval base, so the sea
// can supply them (Taiwan's garrison stood at 0 ‰ supply from day 1: no
// rail, no land link, and a port without a naval base is no sea hub).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { byTag, HUMAN, land, step, wwGameStart } from "./util";

test("Japan's Taiwan garrison is supplied by sea", async () => {
  const maps = new NodeGameMapLoader(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../resources/maps",
    ),
  );
  const runner = await createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: "JPN" }]),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(runner, 2);
  const l = land(runner.game);
  const sc = l.scenario;
  expect(sc.startNavalBase(901)).toBe(1);
  expect(sc.startNavalBase(679)).toBe(1);
  const id = byTag(runner.game, "JPN").smallID();
  step(runner, 1200);
  const t = l.divisions;
  const taiwan = l.rowsOf(id).filter((r) => t.region[r] === 901);
  expect(taiwan.length).toBeGreaterThan(0);
  for (const r of taiwan) expect(t.supply[r]).toBeGreaterThan(0);
}, 120_000);
