// World War 1936: peace on the current line on the real world1936 map and
// content — Korea never changes hands (a war occupation of it goes back to
// its owner, as in a white peace), Taiwan goes only to its claimant China,
// and Japan never receives either; Japan's other land, and land Japan
// holds, follow the line.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { WW_WHITE_PEACE_MIN_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { peaceClaimantTags } from "@openfront/engine-lib/ww1936/PeaceRules";
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
  it("Korea never changes hands, Taiwan only to China, Japan never receives either", async () => {
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
    // China is Taiwan's claimant in the content.
    expect(peaceClaimantTags(pol.content.claims)).toContain("CHN");
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
        !eg.neverAdministered.has(r.id) &&
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
    // The American line: Japan's home region only — not Taiwan, not Korea,
    // which go back to Japan as in a white peace.
    expect(movesOf(wu, usa)).toEqual([[home, jpn, usa]]);
    accept(wu, usa);
    expect(pol.legalOwner[home]).toBe(usa);
    expect(land.controller[home]).toBe(usa);
    for (const r of [taiwan[0], south[0]]) {
      expect(pol.legalOwner[r], `owner ${r}`).toBe(jpn);
      expect(land.controller[r], `ctl ${r}`).toBe(jpn);
    }
    // The Soviet line: nothing changes hands; North Korea goes back.
    expect(movesOf(ws, sun)).toEqual([]);
    accept(ws, sun);
    expect(land.controller[north[0]]).toBe(jpn);
    expect(pol.legalOwner[north[0]]).toBe(jpn);
    // The Chinese line: Taiwan to China, its claimant; China's region the
    // Japanese hold to Japan.
    const chinese = sc.landRegions.find(
      (r) =>
        pol.legalOwner[r.id] === chn &&
        r.id !== eg.capitalRegion(chn) &&
        land.controller[r.id] === chn,
    )!.id;
    land.setController(taiwan[0], chn, g.ticks());
    land.setController(chinese, jpn, g.ticks());
    expect(movesOf(wc, chn)).toEqual(
      [
        [taiwan[0], jpn, chn],
        [chinese, chn, jpn],
      ].sort((a, b) => a[0] - b[0]),
    );
    accept(wc, chn);
    expect(pol.legalOwner[taiwan[0]]).toBe(chn);
    expect(land.controller[taiwan[0]]).toBe(chn);
    expect(pol.legalOwner[chinese]).toBe(jpn);

    // Japan never receives either: Taiwan (China's by law now) and a Korea
    // region the USA's by law, both held by Japan in new wars.
    const wc2 = oldWar(jpn, chn);
    land.setController(taiwan[0], jpn, g.ticks());
    expect(movesOf(wc2, jpn)).toEqual([]);
    const wu2 = oldWar(jpn, usa);
    pol.setLegalOwner(south[0], usa);
    expect(land.controller[south[0]]).toBe(jpn);
    expect(movesOf(wu2, jpn)).toEqual([]);
  }, 600_000);
});
