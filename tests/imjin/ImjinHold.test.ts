// ww181: what lets Japan hold on in Korea by the rules: the truce leaves
// it its coast forts, the grain that lands feeds the port it reached, the
// realm's levies stand behind the first wave, Joseon's levy has its
// ceiling, besiegers inside a town's outer bands count, and boarders in
// order share the grappled ship's crew.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  DOCTRINE_FLAGS,
  JOS_MOBILISED_MAX_MEN,
  uprisingRoom,
} from "@openfront/engine-lib/imjin/Doctrine";
import { japanStats, REALM_LEVY_PCT } from "@openfront/engine-lib/imjin/Japan";
import { TRUCE_PHASE } from "@openfront/engine/imjin/japan/ImjinJapan";
import { joseonLevyCap } from "@openfront/engine/imjin/land/ImjinDoctrine";
import {
  imjinAim,
  imjinNextStep,
} from "@openfront/engine/imjin/land/ImjinLandAi";
import { siegeDays } from "@openfront/engine/imjin/land/Sieges";
import type { SeaCtx } from "@openfront/engine/imjin/sea/SeaCtx";
import { seaOrder } from "@openfront/engine/imjin/sea/SeaFleets";
import { addFleet, emptySeaState } from "@openfront/engine/imjin/sea/SeaState";
import { seaTick } from "@openfront/engine/imjin/sea/SeaTick";
import { returnLiberated } from "@openfront/engine/ww1936/endgame/Liberation";
import { USE_SUPPLY } from "@openfront/engine/ww1936/navy/Convoys";
import { describe, expect, it } from "vitest";
import {
  byTag,
  clearLand,
  HUMAN,
  placeArmy,
  stepTo,
  takeRegion,
  wwRunner,
} from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

async function game() {
  const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
  stepTo(r, WW_PREP_TICKS + 1);
  const g = r.game;
  const ww = g.worldWar()!;
  const id = (t: "JOS" | "JPN" | "MIN") => byTag(g, t).smallID();
  const region = (name: string) =>
    ww.scenario.landRegions.find((x) => x.name === name)!.id;
  return { r, g, ww, im: ww.imjinWar!, id, region };
}

describe("Japan holds on by the rules (ww181)", () => {
  it("the truce leaves Japan the Korean land it holds; going home gives it back", async () => {
    const { g, ww, id, region } = await game();
    const jp = ww.japan!;
    const chungju = region("Chungju");
    ww.land.setController(chungju, id("JPN"), g.ticks(), false);
    const day = ww.day(g.ticks());
    jp.restoreState({ ...jp.snapshot(), phase: TRUCE_PHASE.truce });
    returnLiberated(ww.endgame, day, g.ticks());
    expect(ww.land.controller[chungju]).toBe(id("JPN"));
    jp.restoreState({ ...jp.snapshot(), phase: TRUCE_PHASE.withdrawn });
    returnLiberated(ww.endgame, day, g.ticks());
    expect(ww.land.controller[chungju]).toBe(id("JOS"));
  });

  it("grain that lands feeds its port, though the route was drawn again", async () => {
    const { g, ww, im, id, region } = await game();
    const hub = region("Daegu");
    const route = {
      id: 901,
      use: USE_SUPPLY,
      owner: id("JPN"),
      ref: hub,
      zones: [],
      km: 100,
      srs: [],
      need: 1,
      got: 1,
    };
    ww.navy.routes.set(901, route as never);
    const day = ww.day(g.ticks());
    // The group sailed on route 77, dropped since; it carried 3 days of grain.
    im.st.sea.arrivals.push({
      owner: id("JPN"),
      route: 77,
      hub,
      convoys: 1,
      cargo: 3000,
      tick: g.ticks(),
    });
    (im as unknown as { drainSea(d: number): void }).drainSea(day);
    expect(im.landedPerDay(901)).toBe(1000);
    ww.navy.routes.delete(901);
  });

  it("the realm's levies once the war is on; Joseon's levy has its ceiling", async () => {
    expect(japanStats(1000, 0, false, true).recruitablePct).toBe(
      REALM_LEVY_PCT,
    );
    expect(japanStats(1000, 0, false).recruitablePct).toBe(0);
    expect(uprisingRoom(0, 2, 5000)).toBe(2);
    expect(uprisingRoom(JOS_MOBILISED_MAX_MEN - 7000, 2, 5000)).toBe(1);
    expect(uprisingRoom(JOS_MOBILISED_MAX_MEN, 2, 5000)).toBe(0);
    const { g, ww, im, id } = await game();
    expect(joseonLevyCap(im, id("MIN"))).toBeNull();
    expect(joseonLevyCap(im, id("JOS"))).toBe("limited");
    ww.politics
      .country(id("JOS"))!
      .flags.set(DOCTRINE_FLAGS.josHullyeon, ww.day(g.ticks()));
    expect(joseonLevyCap(im, id("JOS"))).toBe("service");
  });

  it("besiegers standing in a walled town's outer bands lay its siege", async () => {
    const { g, ww, im, id, region } = await game();
    ww.setWar(id("JPN"), id("JOS"), g.ticks());
    const chungju = region("Chungju");
    ww.economy.buildingArray("fort")[chungju] = 1;
    // Japan holds two of its three neighbours (Daegu, and Hanseong taken);
    // one division holds the walls, two Japanese ones stand inside, none
    // outside.
    takeRegion(g, region("Hanseong"), "JPN");
    clearLand(g);
    placeArmy(g, "JOS", chungju, 1);
    placeArmy(g, "JPN", chungju, 2);
    siegeDays(im, ww.day(g.ticks()));
    expect(im.st.sieges.map((s) => s.region)).toContain(chungju);
  });

  it("the drive goes round held walls, and walks into empty ones", async () => {
    const { g, ww, id, region } = await game();
    ww.setWar(id("JPN"), id("JOS"), g.ticks());
    const hanseong = region("Hanseong");
    ww.economy.buildingArray("fort")[hanseong] = 1;
    clearLand(g);
    const aim = imjinAim(ww.land, id("JPN"));
    expect(aim).toBe(hanseong);
    expect(imjinNextStep(ww.land, id("JPN"), aim)).toBe(hanseong);
    placeArmy(g, "JOS", hanseong, 1);
    expect(imjinNextStep(ww.land, id("JPN"), aim)).not.toBe(hanseong);
  });
});

describe("boarding in order (ww181, doctrine §3)", () => {
  it("three sekibune closing together take a panokseon that one alone cannot", () => {
    const W = 120;
    const ctx: SeaCtx = {
      seed: 5,
      tick: 0,
      month: 8,
      day: 0,
      night: false,
      width: W,
      height: 60,
      ref: (x, y) => y * W + x,
      tileX: (t) => t % W,
      tileY: (t) => Math.floor(t / W),
      isWater: () => true,
      flags: () => ({
        coastal: false,
        lee: false,
        channel: false,
        shoal: false,
        current: 0,
        currentDir: 0,
      }),
      zoneOf: () => 0,
      hostile: (a, b) => a !== b,
      path: () => [],
      nearestPort: (o) => (o === 1 ? 30 * W + 110 : 30 * W + 2),
      portLevelAt: () => 0,
      currentAxis: () => 0,
      keepsPrizes: () => true,
    };
    const play = (n: number) => {
      const st = emptySeaState();
      const jp = addFleet(st, 2, 30_000, 30_500, Array(n).fill("sekibune"), {
        formation: "wedge",
        heading: 0,
      });
      addFleet(st, 1, 30_900, 30_500, ["panokseon"], {
        formation: "line",
        heading: 512,
      });
      seaOrder(st, ctx, 2, jp.id, { kind: "engage", mode: "board" });
      for (let t = 1; t <= 40; t++) {
        ctx.tick = t;
        seaTick(st, ctx);
        st.events = [];
      }
      return st.ships.some((s) => s.kind === "panokseon" && s.owner === 2);
    };
    expect(play(1)).toBe(false);
    expect(play(3)).toBe(true);
  });
});
