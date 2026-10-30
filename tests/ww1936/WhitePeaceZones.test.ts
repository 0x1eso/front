// World War 1936: a white peace leaves the Korea and Taiwan occupation
// zones alone — they are no war occupations, and nothing hands them back
// to Japan. Real world1936 map, real content.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { WW_WHITE_PEACE_MIN_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  offerPeace,
  replyPeace,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";

async function worldFiles(): Promise<MapFiles> {
  return loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

describe("World War 1936: white peace and the Korea/Taiwan zones", () => {
  it("a US–Japan white peace keeps the zones with their holders", async () => {
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      await worldFiles(),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    const pol = ww.politics;
    const sc = ww.scenario;
    const [usa, sun, jpn] = (["USA", "SUN", "JPN"] as const).map((t) =>
      sc.smallIdOf(t),
    );
    const groups = pol.content.groupIdx;
    const south = [...groups.get("korea_south")!.regions];
    const taiwan = [...groups.get("taiwan")!.regions];
    const north = [...groups.get("korea_north")!.regions];
    // The zones as the content makes them: Japan hands them over.
    applyEffects(makeCtx(pol, jpn, 0, 0, g.ticks()), [
      {
        kind: "occupation_zone",
        group: "korea_south",
        holder: { tag: "USA" },
        seize: true,
      },
      {
        kind: "occupation_zone",
        group: "taiwan",
        holder: { tag: "USA" },
        seize: true,
      },
      {
        kind: "occupation_zone",
        group: "korea_north",
        holder: { tag: "SUN" },
        seize: true,
      },
    ]);
    for (const r of [...south, ...taiwan]) {
      expect(ww.land.controller[r], `ctl ${r}`).toBe(usa);
      expect(pol.legalOwner[r], `owner ${r}`).toBe(jpn);
    }
    // At war, the USA also occupies a Japanese home region.
    ww.setWar(usa, jpn, g.ticks(), { kind: "declare" });
    const w = eg.warOfPair(usa, jpn);
    eg.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    const home = sc.landRegions.find(
      (r) =>
        pol.legalOwner[r.id] === jpn &&
        !eg.neverAdministered.has(r.id) &&
        ww.land.controller[r.id] === jpn,
    )!.id;
    ww.land.setController(home, usa, g.ticks());
    pol.country(usa)!.ppMilli = 100_000;
    expect(offerPeace(eg, usa, w, jpn, g.ticks())).toBeNull();
    replyPeace(eg, jpn, eg.peaceOffers[0].id, true, g.ticks());
    expect(ww.isAtWar(usa, jpn)).toBe(false);
    // The occupied home region goes back; the zones do not.
    expect(ww.land.controller[home]).toBe(jpn);
    const check = () => {
      for (const r of [...south, ...taiwan]) {
        expect(ww.land.controller[r], `ctl ${r}`).toBe(usa);
        expect(eg.zoneHolder(r), `zone ${r}`).toBe(usa);
      }
      for (const r of north) {
        expect(ww.land.controller[r], `ctl ${r}`).toBe(sun);
      }
    };
    check();
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 3, ww.prepEndTick()));
    check();
  }, 600_000);
});
