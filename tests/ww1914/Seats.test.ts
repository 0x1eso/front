import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { GW_WRITTEN_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import { gwView } from "@openfront/engine/ww1914/View";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, newGame, playRun, startOf } from "./sim/GwSim";

const SELF = {
  GBR: "gbr_asquith",
  RUS: "rus_nicholas",
  FRA: "fra_poincare",
} as const;

describe("every written seat", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  test.each(GW_WRITTEN_TAGS)(
    "%s takes its seat and not itself",
    async (tag) => {
      const runner = await newGame(
        map,
        startOf(`seat-${tag}`, "y1914", [], tag),
      );
      const gw = runner.game.greatWar()!;
      expect(gw.s.seats[0].tag).toBe(tag);
      const view = gwView(gw).seats[0];
      expect(view.desk.length).toBeGreaterThan(0);
      const self = (SELF as Record<string, string>)[tag];
      if (self !== undefined) {
        expect(view.people.map((p) => p.id)).not.toContain(self);
      }
    },
  );

  test.each(
    GW_WRITTEN_TAGS.flatMap((t) => [
      [t, "y1914"],
      [t, "full"],
    ]) as [(typeof GW_WRITTEN_TAGS)[number], "y1914" | "full"][],
  )(
    "%s plays a whole game on %s",
    async (tag, calendar) => {
      const rec = await playRun(
        map,
        `whole-${tag}-${calendar}`,
        calendar,
        [],
        GW_SIM_PROFILES[1],
        tag,
      );
      expect(rec.ending).not.toBe("");
      expect(rec.bodies.length).toBeGreaterThan(10);
    },
    60000,
  );
});
