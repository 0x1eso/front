// World War 1936: negotiated peace on the real world1936 map and content —
// Korea and Taiwan are never ceded or demanded (P5 PeaceRules' zone_only
// and claim_only, whoever gives or asks), Japan's other land may be; and
// the AI ahead demands only land it holds, keeping the target's chance at
// its aim.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import {
  WW_WHITE_PEACE_MIN_DAYS,
  WwPeaceTerms,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  AI_NEG_AIM_PCT,
  negPeaceChance,
  noPeaceTerms,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  aiPeaceTerms,
  offerValue,
  peaceJudgeOf,
} from "@openfront/engine/ww1936/endgame/NegPeace";
import { offerPeace } from "@openfront/engine/ww1936/endgame/WhitePeace";
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

const terms = (t: Partial<WwPeaceTerms>): WwPeaceTerms => ({
  ...noPeaceTerms(),
  ...t,
});

describe("World War 1936: negotiated peace on the world map", () => {
  it("never cedes or demands Korea or Taiwan; the AI ahead demands what it holds", async () => {
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
    const [sun, jpn, chn, deu, pl] = (
      ["SUN", "JPN", "CHN", "DEU", "POL"] as const
    ).map((t) => sc.smallIdOf(t));
    const oldWar = (a: number, b: number) => {
      ww.setWar(a, b, g.ticks(), { kind: "declare" });
      const w = eg.warOfPair(a, b);
      eg.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
      for (const x of [a, b]) pol.country(x)!.ppMilli = 100_000;
      return w;
    };
    const groups = pol.content.groupIdx;
    const [north, south, taiwan] = ["korea_north", "korea_south", "taiwan"].map(
      (k) => [...groups.get(k)!.regions],
    );
    // Japan owns them by law in 1936.
    for (const r of [...north, ...south, ...taiwan]) {
      expect(pol.legalOwner[r], `owner ${r}`).toBe(jpn);
    }
    const ws = oldWar(jpn, sun);
    const wc = oldWar(jpn, chn);
    expect(eg.war(ws)!.sides[1].leader).toBe(sun);
    expect(eg.war(wc)!.sides[1].leader).toBe(chn);
    const t = g.ticks();
    // Korea: zone-only — the Soviets can't demand it, Japan can't cede it.
    expect(offerPeace(eg, sun, ws, jpn, t, terms({ take: [north[0]] }))).toBe(
      "zone_only",
    );
    expect(offerPeace(eg, jpn, ws, sun, t, terms({ give: [south[0]] }))).toBe(
      "zone_only",
    );
    // Taiwan: not even its claimant, China, gets it this way.
    expect(offerPeace(eg, chn, wc, jpn, t, terms({ take: [taiwan[0]] }))).toBe(
      "claim_only",
    );
    expect(offerPeace(eg, jpn, wc, chn, t, terms({ give: [taiwan[0]] }))).toBe(
      "claim_only",
    );
    // Mixed with another region, the offer is refused as a whole.
    const other = sc.landRegions.find(
      (r) =>
        pol.legalOwner[r.id] === jpn &&
        !eg.neverAdministered.has(r.id) &&
        r.id !== eg.capitalRegion(jpn),
    )!.id;
    expect(
      offerPeace(eg, jpn, ws, sun, t, terms({ give: [other, north[0]] })),
    ).toBe("zone_only");
    expect(eg.peaceOffers).toEqual([]);
    // Japan's other land may go.
    expect(
      offerPeace(eg, jpn, ws, sun, t, terms({ give: [other] })),
    ).toBeNull();
    expect(eg.peaceOffers).toHaveLength(1);

    // Germany ahead in Poland: it demands only the Polish land it holds,
    // keeping Poland's chance at the aim.
    const wp = oldWar(deu, pl);
    const rec = eg.war(wp)!;
    const polish = sc.landRegions
      .filter((r) => pol.legalOwner[r.id] === pl)
      .map((r) => r.id)
      .sort((a, b) => a - b);
    const held = polish.slice(0, 3);
    for (const r of held) ww.land.setController(r, deu, g.ticks());
    const day = ww.day(g.ticks());
    const demand = aiPeaceTerms(eg, rec, deu, pl, day);
    expect(demand).not.toBeNull();
    expect(demand!.give).toEqual([]);
    expect(demand!.take.length).toBeGreaterThan(0);
    for (const r of demand!.take) expect(held).toContain(r);
    const j = peaceJudgeOf(eg, rec, deu, pl, true, day);
    const v = offerValue(eg, rec, {
      id: 1,
      war: wp,
      from: deu,
      to: pl,
      whole: true,
      sentTick: 0,
      deadlineTick: 0,
      terms: demand!,
    });
    expect(v).toBeLessThan(0);
    expect(negPeaceChance(j, v)).toBeGreaterThanOrEqual(AI_NEG_AIM_PCT);
    expect(negPeaceChance(j, v)).toBeLessThan(negPeaceChance(j, 0));
  }, 600_000);
});
