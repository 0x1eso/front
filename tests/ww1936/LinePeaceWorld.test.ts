// World War 1936: peace on the current line on the real world1936 map and
// content — Korea never changes hands (a war occupation of it goes back to
// its owner, as in a white peace), Taiwan goes only to its claimant China,
// and Japan never receives either; Japan's other land, and land Japan
// holds, follow the line.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { WW_WHITE_PEACE_MIN_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  lineMovesOf,
  offerLinePeace,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import { replyPeace } from "@openfront/engine/ww1936/endgame/WhitePeace";
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

describe("World War 1936: peace on the current line on the world map", () => {
  it("Korea and Taiwan change hands on the line like any other region", async () => {
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
    const land = ww.land;
    const [sun, jpn, chn, usa] = (["SUN", "JPN", "CHN", "USA"] as const).map(
      (t) => sc.smallIdOf(t),
    );
    const oldWar = (a: number, b: number) => {
      ww.setWar(a, b, g.ticks(), { kind: "declare" });
      const w = eg.warOfPair(a, b);
      eg.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
      for (const x of [a, b]) pol.country(x)!.ppMilli = 100_000;
      return w;
    };
    const groups = pol.content.groupIdx;
    const [north, south, taiwan] = ["korea_north", "korea_south", "taiwan"].map(
      (k) => [...groups.get(k)!.regions].sort((a, b) => a - b),
    );
    const ws = oldWar(jpn, sun);
    const wc = oldWar(jpn, chn);
    const wu = oldWar(jpn, usa);
    for (const w of [ws, wc, wu]) expect(eg.war(w)!.sides[0].leader).toBe(jpn);
    const movesOf = (w: number, from: number) => {
      const rec = eg.war(w)!;
      return lineMovesOf(eg, rec, from, rec.sides[0].leader === from).moves;
    };
    const accept = (w: number, from: number) => {
      expect(offerLinePeace(eg, from, w, jpn, g.ticks())).toBeNull();
      replyPeace(eg, jpn, eg.peaceOffers[0].id, true, g.ticks());
      expect(ww.isAtWar(from, jpn)).toBe(false);
    };
    // War occupations (no zones): the USA in Taiwan, South Korea and one
    // of Japan's home regions; the Soviets in North Korea.
    const home = sc.landRegions.find(
      (r) =>
        pol.legalOwner[r.id] === jpn &&
        r.id !== eg.capitalRegion(jpn) &&
        land.controller[r.id] === jpn,
    )!.id;
    for (const r of [taiwan[0], south[0], home]) {
      land.setController(r, usa, g.ticks());
    }
    land.setController(north[0], sun, g.ticks());
    for (const r of [...north, ...south, ...taiwan]) {
      expect(eg.isZone(r), `zone ${r}`).toBe(false);
    }
    // The American line: Japan's home region, Taiwan and South Korea.
    const ids = (w: number, from: number) =>
      movesOf(w, from)
        .map((m) => m[0])
        .sort((x, y) => x - y);
    expect(ids(wu, usa)).toEqual(
      [taiwan[0], south[0], home].sort((x, y) => x - y),
    );
    accept(wu, usa);
    for (const r of [taiwan[0], south[0], home]) {
      expect(pol.legalOwner[r], `owner ${r}`).toBe(usa);
      expect(land.controller[r], `ctl ${r}`).toBe(usa);
    }
    // The Soviet line: North Korea.
    expect(ids(ws, sun)).toEqual([north[0]]);
    accept(ws, sun);
    expect(pol.legalOwner[north[0]]).toBe(sun);
  }, 600_000);
});
