import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { AUH_PROLOGUE_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/auh_prologue";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

const SOFT = [
  "auh_pro_olmutz.ride",
  "auh_pro_olmutz.mother",
  "auh_pro_olmutz.thanks",
  "auh_pro_olmutz.names",
  "auh_pro_ischl.beside",
  "auh_pro_sadowa.ingrate",
  "auh_pro_sadowa.my_wire",
  "auh_pro_crown.keep_it",
  "auh_pro_crown.sit",
  "auh_pro_crown.regret",
  "auh_pro_crown.friend",
  "auh_pro_mayerling.say_nothing",
  "auh_pro_mayerling.drink",
  "auh_pro_mayerling.know",
  "auh_pro_geneva.her_room",
  "auh_pro_geneva.shoulder",
  "auh_pro_geneva.walk",
  "auh_pro_geneva.debt",
  "auh_pro_summer.teach",
  "auh_pro_summer.door",
  "auh_pro_summer.believe",
  "auh_pro_summer.plan",
  "auh_pro_summer.to_door",
  "auh_pro_summer.no_war",
];

describe("Franz Joseph's earlier life", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  const start = async (id: string, picks: readonly string[]) => {
    const info = startOf(id, "full", [], "AUH");
    info.config.greatWar1914Prologue = { play: false, picks: [...picks] };
    return newGame(map, info);
  };
  const raw = (r: GameRunner) => r.game.greatWar()!.s.seats[0];

  test("seven scenes in their order", () => {
    const row = AUH_PROLOGUE_SCENES.filter((s) => s.prologue !== undefined);
    expect(row.map((s) => s.prologue)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("a skipped game replays a whole life into the first papers", async () => {
    const r = await start("auh_pro_soft", SOFT);
    const seat = raw(r);
    expect(seat.flags).toEqual(
      expect.arrayContaining([
        "pro_auh_mother",
        "pro_auh_arad_names",
        "pro_auh_sisi_beside",
        "pro_auh_benedek_owed",
        "pro_auh_oath_true",
        "pro_auh_rudolf_kept",
        "pro_auh_ff_pity",
        "pro_auh_ff_door",
        "pro_auh_want_peace",
      ]),
    );
    expect(seat.prologue?.temper).toBe("gentle");
    expect(seat.prologue?.next).toBe(-1);
    expect(seat.desk.length).toBeGreaterThan(0);
  });

  test("no picks leave nothing behind", async () => {
    const r = await start("auh_pro_none", []);
    expect(raw(r).flags.filter((f) => f.startsWith("pro_auh_"))).toEqual([]);
    expect(raw(r).prologue?.temper).toBeNull();
  });
});
