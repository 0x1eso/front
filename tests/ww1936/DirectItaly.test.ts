// ww44: a direct attack on the real map: Italy against Ethiopia. The Italian
// home army has no land path to Ethiopia: its order is refused (no_path) and
// changes nothing; Somaliland's army borders the target and is not.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { byTag, HUMAN, land, stepTo, wwGameStart } from "./util";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);
// Italian Somaliland's army stands in region 1039; 1049 is Ethiopian ground
// next to it, 1014 is Ethiopian ground next to the Eritrean front only.
const SOMALILAND = 1039;
const NEAR = 1049;
const NORTH = 1014;
// Italy's home army: no land path to Ethiopia.
const HOME = 494;

describe("ww44: Italy's direct attack in Ethiopia", () => {
  test("no_path: an army cut off from a target's border is refused and keeps its order", async () => {
    const runner = await createGameRunner(
      wwGameStart({}, [{ clientID: HUMAN, country: "ITA" }]),
      undefined,
      await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    stepTo(runner, WW_PREP_TICKS + 10);
    const g = runner.game;
    const l = land(g);
    const ita = byTag(g, "ITA").smallID();
    const armies = [...l.armies.values()].filter((x) => x.owner === ita);
    const cut = armies.find((x) => l.armyRegion(x) === HOME)!;
    const sl = armies.find((x) => l.armyRegion(x) === SOMALILAND)!;
    const go = (army: number, t: number) =>
      l.issue(
        ita,
        { kind: "army_direct", army, targets: [t] } as never,
        "player",
      );
    const before = JSON.stringify(cut.order);
    expect(go(cut.id, NEAR)).toBe("no_path");
    expect(JSON.stringify(cut.order)).toBe(before);
    // Somaliland borders the target; the far one is reached over Ethiopian ground.
    expect(go(sl.id, NEAR)).toBe(null);
    expect(sl.order).toMatchObject({
      kind: "plan",
      direct: true,
      targets: [NEAR],
    });
    expect(go(sl.id, NORTH)).toBe(null);
  }, 120_000);
});
