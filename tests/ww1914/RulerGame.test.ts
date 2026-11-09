import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_RULER_SIDES } from "@openfront/engine-api/ww1914/GwRuler";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, playRun } from "./sim/GwSim";

const SEATS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
/** Not every game has a war that lasts: look through this many for one. */
const TRIES = 8;

describe("a whole game with the ruler's card", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  test.each(SEATS)(
    "%s: the card moves, its scenes come, a game still ends",
    async (tag) => {
      for (let i = 0; i < TRIES; i++) {
        const box: { gw?: GreatWar } = {};
        const start: Record<string, number> = {};
        await playRun(
          map,
          `ruler-${tag}-${i}`,
          "full",
          [],
          GW_SIM_PROFILES[1],
          tag,
          (g) => {
            box.gw = g;
            const r = g.s.seats[0].ruler;
            if (start.health !== undefined) return;
            for (const x of GW_RULER_SIDES) start[x] = r[x];
          },
        );
        const seat = box.gw?.s.seats[0];
        if (seat === undefined) continue;
        const life = Object.keys(seat.seen).filter((k) => k.includes("_life_"));
        if (life.length < 3) continue;
        expect(seat.memoir !== null || box.gw?.s.ended !== null).toBe(true);
        const r = seat.ruler;
        const moved = GW_RULER_SIDES.some((x) => r[x] !== start[x]);
        expect(moved || r.id === null).toBe(true);
        return;
      }
      throw new Error(
        `${tag}: no game of ${TRIES} reached three of its scenes`,
      );
    },
    240000,
  );
});
