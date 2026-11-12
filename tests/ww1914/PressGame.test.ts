import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_BLOC_AGAINST } from "@openfront/engine-api/ww1914/GwPress";
import { blocViews } from "@openfront/engine/ww1914/Blocs";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, playRun } from "./sim/GwSim";

const SEATS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];

const read = (file: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../resources/ww1914/ko/${file}`),
      "utf8",
    ),
  );
const headsOf = (tag: GwTag) =>
  read(`${tag}.press.json`).press.heads as Record<
    string,
    Record<string, unknown>
  >;
/** A house story (ww158): the house pack's head serves every paper. */
const houseHeads = (tag: GwTag) =>
  ({
    ...read("common.house.json").heads,
    ...read(`${tag}.house.json`).heads,
  }) as Record<string, unknown>;

describe("the papers through a whole game on the real map", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  test.each(SEATS)(
    "%s has an edition each chapter, in text, and blocs that move",
    async (tag) => {
      const heads = headsOf(tag);
      const house = houseHeads(tag);
      const stories = new Set<string>();
      const seen = new Set<string>();
      let chapters = 0;
      let lowest = 9;
      let war = false;
      await playRun(
        map,
        `press-${tag}`,
        "full",
        [],
        GW_SIM_PROFILES[1],
        tag,
        (gw) => {
          const seat = gw.s.seats[0];
          const e = seat.press.edition;
          expect(e).not.toBeNull();
          expect(e!.heads.length).toBeGreaterThanOrEqual(2);
          for (const h of e!.heads) {
            const own = e!.faction ? house[`${e!.story}_${e!.faction}`] : null;
            expect(
              heads[e!.story]?.[h.paper] ?? own ?? house[e!.story],
            ).toBeDefined();
          }
          stories.add(e!.story);
          war = war || gw.nation(tag)!.atWar.length > 0;
          chapters++;
          for (const b of blocViews(gw, seat)) {
            seen.add(`${b.id}:${b.support}`);
            lowest = Math.min(lowest, b.support);
          }
        },
      );
      expect(chapters).toBeGreaterThan(10);
      // A run that keeps the peace has no war stories: since Vienna signs
      // July itself, Austria's bot run here never goes to war (long_peace).
      expect(stories.size).toBeGreaterThan(
        Math.min(12, chapters / (war ? 3 : 4)),
      );
      expect(seen.size).toBeGreaterThan(12);
      expect(lowest).toBeGreaterThanOrEqual(-5);
      expect(GW_BLOC_AGAINST).toBe(-3);
    },
    240000,
  );
});
