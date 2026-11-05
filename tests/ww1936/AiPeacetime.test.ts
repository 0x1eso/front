// World War 1936 ww79: at peace the AI shares its armies across its borders
// by threat and by what a region's supply feeds. Before, every army went to
// the one neighbour with the most divisions, however far and poorly supplied.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";

describe("the AI's peacetime placement (ww79)", () => {
  test("no country piles its army on a poorly supplied far border", async () => {
    const files = await loadMapFiles(
      new NodeGameMapLoader(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../resources/maps",
        ),
      ),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await createGameRunner(
      { ...wwGameStart(), gameID: "WWSIM001" },
      undefined,
      files,
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const l = g.worldWar()!.land;
    const sc = l.scenario;
    stepTo(runner, dayStartTick(dayOfDate("1936-02-15"), WW_PREP_TICKS));
    const t = l.divisions;
    for (const tag of ["SUN", "CHN"] as const) {
      const id = sc.smallIdOf(tag);
      let n = 0;
      let supply = 0;
      for (let r = 0; r < t.rows; r++) {
        if (t.id[r] === 0 || t.owner[r] !== id) continue;
        n++;
        supply += t.supply[r];
      }
      expect(n).toBeGreaterThan(30);
      // Divisions are fed (before: SUN stood at 86 and CHN at 225 here).
      expect(Math.floor(supply / n)).toBeGreaterThanOrEqual(700);
    }
  }, 300_000);
});
