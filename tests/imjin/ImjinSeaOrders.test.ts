// ww177 merge 3: the player's fire ship and escort orders (the AI already
// sends both), and the wind and current the client reads from ImjinData.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { channelShores } from "@openfront/engine-lib/imjin/SeaRules";
import { addFleet } from "@openfront/engine/imjin/sea/SeaState";
import { issueImjinOrder } from "@openfront/engine/imjin/WwImjin";
import { USE_SUPPLY } from "@openfront/engine/ww1936/navy/Convoys";
import type { SeaRoute } from "@openfront/engine/ww1936/navy/WwNavy";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, wwRunner } from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

describe("the Imjin sea's player orders and view (merge 3)", () => {
  test("a channel's shores lie across its axis", () => {
    // Land rows 0-1 (region 1) and 6-7 (region 2), water between; east flow.
    const land = (tx: number, ty: number) =>
      tx < 0 || ty < 0 || tx >= 10 || ty >= 8
        ? -1
        : ty <= 1
          ? 1
          : ty >= 6
            ? 2
            : 0;
    expect(channelShores(land, 5_000, 4_000, 0)).toEqual([2, 1]);
    expect(channelShores(land, 5_000, 4_000, 0, 1)).toEqual([0, 0]);
  });

  test("fire ship and escort, by hand", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    step(r, WW_PREP_TICKS + 2);
    const g = r.game;
    const ww = g.worldWar()!;
    const im = ww.imjinWar!;
    const sea = im.st.sea;
    const jos = byTag(g, "JOS").smallID();
    const jpn = byTag(g, "JPN").smallID();
    const map = g.map();
    let water = -1;
    for (let t = 0; t < map.width() * map.height() && water < 0; t++) {
      const x = map.x(t);
      const y = map.y(t);
      if (x < 4 || x >= map.width() - 4) continue;
      if ([0, 1, 2, 3].every((d) => map.isWater(map.ref(x + d, y)))) water = t;
    }
    expect(water).toBeGreaterThanOrEqual(0);
    const x = map.x(water) * 1000 + 500;
    const y = map.y(water) * 1000 + 500;
    const mine = addFleet(sea, jos, x, y, ["panokseon", "hyeopseon"]);
    const foe = addFleet(sea, jpn, x + 3000, y, ["atakebune"]);
    const order = (o: "fire_ship" | "escort") =>
      issueImjinOrder(
        ww,
        jos,
        {
          kind: "imjin_fleet",
          fleet: mine.id,
          order: o,
          tile: 0,
          formation: "line",
        },
        g.ticks(),
      );

    // Out of battle there is nothing to burn.
    expect(order("fire_ship")).toBe("bad_index");
    ww.setWar(jpn, jos, g.ticks());
    sea.battles.push({
      id: 900,
      cx: x,
      cy: y,
      startTick: g.ticks(),
      current: 0,
    });
    mine.battle = 900;
    foe.battle = 900;
    expect(order("fire_ship")).toBeNull();
    const boat = sea.ships.find(
      (s) => s.fleet === mine.id && s.kind === "hyeopseon",
    )!;
    expect(boat.fireShip).toBe(1);
    // The panokseon is no fire ship; the only boat is alight already.
    expect(
      sea.ships.find((s) => s.fleet === mine.id && s.kind === "panokseon")!
        .fireShip ?? 0,
    ).toBe(0);
    expect(order("fire_ship")).toBe("bad_index");

    // The view: the battle, its current (none here) and the wind over both fleets.
    const d = im.takeData()!;
    expect(d.battles.find((b) => b.id === 900)).toMatchObject({
      current: 0,
      shores: 0,
    });
    const zone = ww.scenario.regionAt(water);
    expect(d.winds.some((w) => w[0] === zone)).toBe(true);

    // Escort: no supply route, refused; with one, the fleet sails with it.
    mine.battle = 0;
    expect(order("escort")).toBe("bad_index");
    const route: SeaRoute = {
      id: 77,
      use: USE_SUPPLY,
      owner: jos,
      ref: 0,
      zones: [],
      km: 100,
      srs: [],
      need: 5,
      got: 5,
      nextDay: 0,
    };
    ww.navy.routes.set(route.id, route);
    expect(order("escort")).toBeNull();
    expect(mine.order).toBe("escort");
    expect(mine.target).toBe(77);
    ww.navy.routes.delete(route.id);
  });
});
