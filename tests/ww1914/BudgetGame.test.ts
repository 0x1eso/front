import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { budgetRow } from "@openfront/engine-lib/ww1914/BudgetRules";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, playRun } from "./sim/GwSim";

const SEATS: GwTag[] = ["DEU", "GBR", "AUH", "RUS"];
/** Not every game has a war that lasts: look through this many for one. */
const TRIES = 10;

describe("a whole game on the real map", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  test.each(SEATS)(
    "%s runs past 1916 on its budgets",
    async (tag) => {
      for (let i = 0; i < TRIES; i++) {
        let year = 0;
        let signed = 0;
        let lastSeen = -9;
        let debt = 0;
        let prices = 0;
        let war = false;
        await playRun(
          map,
          `budget-${tag}-${i}`,
          "full",
          [],
          GW_SIM_PROFILES[1],
          tag,
          (gw) => {
            const b = gw.nation(tag)!.budget;
            year = civilFromDays(gw.s.day).year;
            war = war || gw.nation(tag)!.atWar.length > 0;
            if (b.lastChapter !== lastSeen) {
              lastSeen = b.lastChapter;
              signed++;
            }
            debt = b.debt;
            prices = b.prices;
          },
        );
        if (year < 1917 || !war) continue;
        expect(signed).toBeGreaterThanOrEqual(3);
        expect(debt).toBeGreaterThan(budgetRow(tag).debt);
        expect(prices).toBeGreaterThan(1000);
        return;
      }
      throw new Error(`${tag}: no war past 1916 in ${TRIES} games`);
    },
    240000,
  );
});
