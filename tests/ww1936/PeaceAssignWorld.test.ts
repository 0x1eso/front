// World War 1936 (ww88 lane X): the conference's assignment on the real map
// and content: a two-winner split of France, a sole winner, the two-thirds
// line, the connection rule, compensation, an AI democracy, a loser gone or
// living on, Ask for terms, hash and restore.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_ASK_TERMS_MIN_POOL_PCT,
  WW_WHITE_PEACE_MIN_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import {
  aiAskTermsDay,
  askForTerms,
  askTermsBlock,
  termsPoolPct,
} from "@openfront/engine/ww1936/endgame/AskTerms";
import { conferenceView } from "@openfront/engine/ww1936/endgame/Conference";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import {
  replyPeace,
  surrenderPm,
  truceUntil,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type { Conference } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { joinFaction } from "@openfront/engine/ww1936/politics/Factions";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { step, stepTo, wwGameStart } from "./util";

// The real map takes seconds to load.
vi.setConfig({ testTimeout: 30_000 });

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

// France's strategic regions (scenario.json), and regions by name.
const NORTH = 53;
const EAST = 55;
const WEST = 59;
const CENTRE = 64;
const SOUTH = 74;
const MOSELLE = 390;
const DOUBS = 403;
const MEUSE = 376;
const VOSGES = 419;
const PARIS = 396;

async function start() {
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
  return { runner, g, ww, eg: ww.endgame, sc: ww.scenario };
}
type T = Awaited<ReturnType<typeof start>>;

const idOf = (t: T, tag: CountryTag) => t.sc.smallIdOf(tag);
const playerOf = (g: Game, id: number): Player => {
  const p = g.playerBySmallID(id);
  if (!p.isPlayer()) throw new Error(`no player ${id}`);
  return p;
};
/** France's regions in a strategic region. */
const srOf = (t: T, sr: number) =>
  t.sc.landRegions
    .filter(
      (r) =>
        t.sc.regionSr(r.id) === sr &&
        t.ww.politics.legalOwner[r.id] === idOf(t, "FRA"),
    )
    .map((r) => r.id);

/**
 * `winners` beat France: each its score and regions; the first declares,
 * and France capitulates to `to` (the first winner when not named).
 */
function beatFrance(
  t: T,
  winners: [CountryTag, number, number[]][],
  to: CountryTag = winners[0][0],
): Conference {
  const fra = idOf(t, "FRA");
  const { g, ww, eg } = t;
  const first = idOf(t, winners[0][0]);
  ww.setWar(first, fra, g.ticks());
  const w = eg.war(eg.warOfPair(first, fra))!;
  for (const [tag] of winners.slice(1)) {
    ww.setWar(idOf(t, tag), fra, g.ticks(), { kind: "into", warId: w.id });
  }
  for (const [tag, ws, regions] of winners) {
    addWarScore(eg, w.id, idOf(t, tag), ws);
    for (const r of regions) ww.land.setController(r, idOf(t, tag), g.ticks());
  }
  const before = eg.conferences.length;
  capitulate(
    g,
    ww as WorldWar,
    playerOf(g, fra),
    g.ticks(),
    playerOf(g, idOf(t, to)),
  );
  expect(eg.conferences).toHaveLength(before + 1);
  return eg.conferences[before];
}

/** Every participant passes every round: the treaty is the assignment alone. */
function passAll(t: T, c: Conference): void {
  while (c.status === 1) {
    c.ai = [];
    c.subs = c.parts.map((p) => ({ id: p.id, demands: [], passed: true }));
    c.roundEndTick = Math.min(c.roundEndTick, t.g.ticks() + 1);
    step(t.runner);
  }
}

const assignOf = (c: Conference) => new Map(c.assign ?? []);
const valueOf = (c: Conference, regions: readonly number[]) => {
  let v = 0;
  for (const r of regions) v += c.base[c.stake.indexOf(r)];
  return v;
};
const countOf = (c: Conference, id: number) =>
  (c.assign ?? []).filter(([, p]) => p === id).length;

describe("World War 1936 ww88: the assignment on the real map", () => {
  it("two winners split France along the strategic regions, and it's gone", async () => {
    const t = await start();
    const [deu, ita, fra] = [idOf(t, "DEU"), idOf(t, "ITA"), idOf(t, "FRA")];
    const north = [...srOf(t, NORTH), ...srOf(t, EAST), ...srOf(t, WEST)];
    const south = srOf(t, SOUTH);
    // A German spearhead deep in the south and an Italian one in the north:
    // each group's two thirds tidy them away.
    const c = beatFrance(t, [
      ["DEU", 1000, [...north.slice(1), south[0]]],
      ["ITA", 500, [north[0], ...south.slice(1)]],
    ]);
    const a = assignOf(c);
    for (const r of south) expect(a.get(r)).toBe(ita);
    for (const r of srOf(t, EAST)) expect(a.get(r)).toBe(deu);
    expect(a.get(PARIS)).toBe(deu);
    // Everything of France is someone's: no land goes back.
    expect(
      t.sc.landRegions
        .filter((r) => t.ww.politics.legalOwner[r.id] === fra)
        .every((r) => a.has(r.id)),
    ).toBe(true);
    // The treaty keeps to it: AI demands may buy, but nobody revives France.
    step(t.runner);
    step(t.runner);
    expect(c.status).toBe(2);
    expect(t.eg.countryState(fra)).toBe("gone");
    expect(t.ww.politics.legalOwner[PARIS]).toBe(deu);
    expect(t.ww.land.controller[PARIS]).toBe(deu);
  });

  it("a sole winner keeps all, hand-over land and colonies too, and gets no compensation", async () => {
    const t = await start();
    const [deu, fra] = [idOf(t, "DEU"), idOf(t, "FRA")];
    const c = beatFrance(t, [["DEU", 1000, srOf(t, NORTH)]]);
    expect(c.assign).toHaveLength(c.stake.length);
    expect(countOf(c, deu)).toBe(c.stake.length);
    expect(c.comp).toEqual([]);
    expect((c.handed ?? []).length).toBeGreaterThan(0);
    expect(c.handed!.every(([r]) => !srOf(t, NORTH).includes(r))).toBe(true);
    expect(conferenceView(t.eg, c.id).gone).toEqual([fra]);
  });

  it("the winner that forced the capitulation gets no free country", async () => {
    const t = await start();
    const [deu, ita] = [idOf(t, "DEU"), idOf(t, "ITA")];
    // Italy conquered most of metropolitan France; Germany took one region
    // and forced the capitulation, so everything else was handed to it.
    const most = [
      ...srOf(t, SOUTH),
      ...srOf(t, CENTRE),
      ...srOf(t, WEST),
      ...srOf(t, NORTH),
    ];
    const c = beatFrance(
      t,
      [
        ["DEU", 2000, [MOSELLE]],
        ["ITA", 500, most],
      ],
      "DEU",
    );
    const a = assignOf(c);
    // Hand-over land was recorded as such, and none of it counted as held.
    const handed = new Set((c.handed ?? []).map(([r]) => r));
    expect(handed.size).toBeGreaterThan(0);
    expect(handed.has(MOSELLE)).toBe(false);
    for (const r of most) {
      expect(handed.has(r)).toBe(false);
      expect(a.get(r)).toBe(ita);
    }
    const of = (id: number) =>
      valueOf(
        c,
        [...a].filter(([, p]) => p === id).map(([r]) => r),
      );
    expect(of(ita)).toBeGreaterThan(of(deu) * 2);
    // Hand-over land pays nobody.
    expect((c.comp ?? []).find(([p]) => p === deu)).toBeUndefined();
  });

  it("the two-thirds line of Alsace-Lorraine (value 24)", async () => {
    const t = await start();
    const [deu, ita] = [idOf(t, "DEU"), idOf(t, "ITA")];
    // Exactly 16 of 24 for Germany: it takes all, and pays Italy's 8.
    const c = beatFrance(t, [
      ["DEU", 1000, [MOSELLE, DOUBS]],
      ["ITA", 500, [MEUSE, VOSGES]],
    ]);
    expect(valueOf(c, srOf(t, EAST))).toBe(24);
    const a = assignOf(c);
    expect([MEUSE, VOSGES].map((r) => a.get(r))).toEqual([deu, deu]);
    expect(c.comp).toEqual([[ita, 8]]);
  });

  it("just under two thirds each keeps its regions (real values), so compensation is none", async () => {
    const t = await start();
    const [deu, ita] = [idOf(t, "DEU"), idOf(t, "ITA")];
    const c = beatFrance(t, [
      ["DEU", 1000, [MOSELLE, VOSGES]],
      ["ITA", 500, [MEUSE, DOUBS]],
    ]);
    const a = assignOf(c);
    expect(a.get(MOSELLE)).toBe(deu);
    expect(a.get(DOUBS)).toBe(ita);
    expect(c.comp).toEqual([]);
  });

  it("compensation lands in the points at the opening", async () => {
    const t = await start();
    const ita = idOf(t, "ITA");
    const c = beatFrance(t, [
      ["DEU", 1000, [MOSELLE, DOUBS]],
      ["ITA", 1000, [MEUSE, VOSGES]],
    ]);
    const [a, b] = c.parts.map((p) => p.pts);
    const deuPts = c.parts.find((p) => p.id !== ita)!.pts;
    const itaPts = c.parts.find((p) => p.id === ita)!.pts;
    expect(a + b).toBe(deuPts + itaPts);
    expect(itaPts - deuPts).toBe(8);
  });

  it("no land link and no port: the holder gives way to the next that connects", async () => {
    const t = await start();
    const [deu, jpn] = [idOf(t, "DEU"), idOf(t, "JPN")];
    const north = srOf(t, NORTH);
    const small = north.find((r) => r !== PARIS)!;
    // Japan holds Northern France but for one region; Germany holds that
    // one and Alsace-Lorraine, next to Germany.
    const c = beatFrance(t, [
      ["DEU", 1000, [...srOf(t, EAST), small]],
      ["JPN", 500, north.filter((r) => r !== small)],
    ]);
    const a = assignOf(c);
    for (const r of north) expect(a.get(r)).toBe(deu);
    expect(c.comp![0][0]).toBe(jpn);
  });

  it("a port in the group connects a far winner", async () => {
    const t = await start();
    const jpn = idOf(t, "JPN");
    const west = srOf(t, WEST);
    expect(west.some((r) => t.sc.isPort(r))).toBe(true);
    const c = beatFrance(t, [
      ["DEU", 1000, [...srOf(t, NORTH), ...srOf(t, EAST)]],
      ["JPN", 500, west],
    ]);
    const a = assignOf(c);
    for (const r of west) expect(a.get(r)).toBe(jpn);
  });

  it("a human takes most of France and an AI democracy holds the rest: its regions are zones, France is gone", async () => {
    const t = await start();
    const [deu, gbr, fra] = [idOf(t, "DEU"), idOf(t, "GBR"), idOf(t, "FRA")];
    const real = t.eg.isHumanControlled.bind(t.eg);
    t.eg.isHumanControlled = (id: number) => id === deu || real(id);
    const west = srOf(t, WEST);
    const rest = t.sc.landRegions
      .filter(
        (r) => t.ww.politics.legalOwner[r.id] === fra && !west.includes(r.id),
      )
      .map((r) => r.id);
    const c = beatFrance(t, [
      ["DEU", 2000, rest],
      ["GBR", 500, west],
    ]);
    expect(c.demPuppets).toEqual([]);
    const a = assignOf(c);
    for (const r of west) expect(a.get(r)).toBe(gbr);
    expect([...(c.dem ?? [])].sort((x, y) => x - y)).toEqual(
      [...west].sort((x, y) => x - y),
    );
    expect(conferenceView(t.eg, c.id).gone).toEqual([fra]);
    // The human passes; the treaty makes the zones and nothing revives.
    passAll(t, c);
    expect(t.eg.countryState(fra)).toBe("gone");
    for (const r of west) {
      expect(t.eg.isZone(r)).toBe(true);
      expect(t.ww.land.controller[r]).toBe(gbr);
      expect(t.ww.politics.legalOwner[r]).toBe(fra);
    }
    expect(t.ww.politics.legalOwner[PARIS]).toBe(deu);
  });

  it("with a third of the stake or more an AI democracy gets France as a puppet on that land", async () => {
    const t = await start();
    const [sun, gbr, fra] = [idOf(t, "SUN"), idOf(t, "GBR"), idOf(t, "FRA")];
    const east = srOf(t, EAST);
    const c = beatFrance(
      t,
      [
        ["GBR", 1000, srOf(t, NORTH)],
        ["SUN", 500, east],
      ],
      "GBR",
    );
    expect(c.demPuppets).toEqual([[fra, gbr]]);
    const a = assignOf(c);
    for (const r of east) expect(a.get(r)).toBe(sun);
    expect(conferenceView(t.eg, c.id).gone).toEqual([]);
    passAll(t, c);
    expect(t.eg.countryState(fra)).toBe("active");
    expect(t.ww.isCapitulated(fra)).toBe(false);
    expect(t.eg.subjectOf(fra)?.overlord).toBe(gbr);
    expect(t.eg.subjectOf(fra)?.level).toBe("puppet");
    expect(t.ww.politics.legalOwner[PARIS]).toBe(fra);
    expect(t.ww.land.controller[PARIS]).toBe(fra);
    expect(t.ww.politics.legalOwner[east[0]]).toBe(sun);
  });

  it("a human keeps what it holds whatever its government", async () => {
    const t = await start();
    const gbr = idOf(t, "GBR");
    const real = t.eg.isHumanControlled.bind(t.eg);
    t.eg.isHumanControlled = (id: number) => id === gbr || real(id);
    const north = srOf(t, NORTH);
    const c = beatFrance(t, [["GBR", 1000, north]]);
    const a = assignOf(c);
    for (const r of north) expect(a.get(r)).toBe(gbr);
  });

  it("the conference's view shows the assignment, the compensation and the hand-over land", async () => {
    const t = await start();
    const ita = idOf(t, "ITA");
    const c = beatFrance(t, [
      ["DEU", 1000, [MOSELLE, DOUBS]],
      ["ITA", 500, [MEUSE, VOSGES]],
    ]);
    const v = conferenceView(t.eg, c.id);
    expect(v.assign).toEqual(c.assign);
    expect(v.comp).toEqual([[ita, 8]]);
    expect(v.handed!.length).toBe(c.handed!.length);
  });

  it("a hand-over waiting for its conference is hashed and survives a snapshot", async () => {
    const t = await start();
    const h = t.eg.hash();
    t.eg.handedOver = [[PARIS, 1]];
    const moved = t.eg.hash();
    expect(moved).not.toBe(h);
    const saved = t.eg.snapshot();
    t.eg.handedOver = [];
    t.eg.restoreState(saved);
    expect(t.eg.handedOver).toEqual([[PARIS, 1]]);
    expect(t.eg.hash()).toBe(moved);
  });

  it("the assignment moves the hash and survives a snapshot", async () => {
    const t = await start();
    const c = beatFrance(t, [
      ["DEU", 1000, [MOSELLE, DOUBS]],
      ["ITA", 500, [MEUSE, VOSGES]],
    ]);
    const h = t.eg.hash();
    const saved = t.eg.snapshot();
    const keep = c.assign![0][1];
    c.assign![0][1] = keep === 1 ? 2 : 1;
    expect(t.eg.hash()).not.toBe(h);
    t.eg.restoreState(saved);
    expect(t.eg.hash()).toBe(h);
    expect(t.eg.conferences[0].assign).toEqual(saved.conferences[0].assign);
    expect(t.eg.conferences[0].handed).toEqual(saved.conferences[0].handed);
  });
});

describe("World War 1936 ww88: Ask for terms on the real map", () => {
  /** Germany at war with France, holding `regions`, the war old enough to end. */
  function warOn(t: T, regions: readonly number[]) {
    const { g, ww, eg } = t;
    const [deu, fra] = [idOf(t, "DEU"), idOf(t, "FRA")];
    ww.setWar(deu, fra, g.ticks());
    const w = eg.war(eg.warOfPair(deu, fra))!;
    w.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    ww.politics.country(fra)!.ppMilli = 100_000;
    addWarScore(eg, w.id, deu, 1000);
    for (const r of regions) ww.land.setController(r, deu, g.ticks());
    return w;
  }

  it("the pool scales with how far the side had fallen", () => {
    expect(termsPoolPct(400)).toBe(WW_ASK_TERMS_MIN_POOL_PCT);
    expect(termsPoolPct(700)).toBe(95);
    expect(termsPoolPct(1000)).toBe(130);
  });

  it("not before 40 % of the way to surrender", async () => {
    const t = await start();
    const w = warOn(t, [MOSELLE]);
    const day = t.ww.day(t.g.ticks());
    expect(surrenderPm(t.eg, idOf(t, "FRA"))).toBeLessThan(400);
    expect(askTermsBlock(t.eg, idOf(t, "FRA"), w.id, day)).toBe(
      "peace_not_beaten",
    );
  });

  it("terms stop the war: held land is assigned, the loser keeps the rest, its army and its capital", async () => {
    const t = await start();
    const [deu, fra] = [idOf(t, "DEU"), idOf(t, "FRA")];
    const north = srOf(t, NORTH);
    const w = warOn(t, [...north, ...srOf(t, EAST)]);
    const pm = surrenderPm(t.eg, fra);
    expect(pm).toBeGreaterThanOrEqual(400);
    const divisions = [...t.ww.land.rowsOf(fra)].length;
    expect(askForTerms(t.eg, fra, w.id, t.g.ticks())).toBeNull();
    const offer = t.eg.peaceOffers.find((o) => o.ask === true)!;
    expect(offer.to).toBe(deu);
    expect(replyPeace(t.eg, deu, offer.id, true, t.g.ticks())).toBeNull();
    expect(w.ended?.winner).toBe(0);
    expect(t.ww.isAtWar(deu, fra)).toBe(false);
    const c = t.eg.conferences[t.eg.conferences.length - 1];
    expect(c.asked).toBe(true);
    // At stake: what Germany holds and what borders it, no colony.
    const a = assignOf(c);
    expect(c.stake.includes(srOf(t, SOUTH)[0])).toBe(false);
    expect(a.has(PARIS)).toBe(false);
    for (const r of srOf(t, EAST)) expect(a.get(r)).toBe(deu);
    const before = c.parts[0].pts;
    expect(before).toBeLessThan(
      Math.floor((c.base.reduce((x, y) => x + y, 0) * 130) / 100),
    );
    // AI winners only: the treaty comes next tick.
    step(t.runner);
    step(t.runner);
    expect(c.status).toBe(2);
    expect(t.eg.countryState(fra)).toBe("active");
    expect(t.ww.isCapitulated(fra)).toBe(false);
    expect(t.ww.politics.legalOwner[PARIS]).toBe(fra);
    expect(t.ww.land.controller[PARIS]).toBe(fra);
    expect(t.ww.politics.legalOwner[MOSELLE]).toBe(deu);
    expect(t.ww.politics.legalOwner[srOf(t, SOUTH)[0]]).toBe(fra);
    expect([...t.ww.land.rowsOf(fra)].length).toBe(divisions);
    const day = t.ww.day(t.g.ticks());
    expect(truceUntil(t.eg, deu, fra)).toBeGreaterThan(day);
  });

  it("a loser left under a tenth of its land can't stand, and capitulates after the treaty", async () => {
    const t = await start();
    const [deu, tur] = [idOf(t, "DEU"), idOf(t, "TUR")];
    const { g, ww, eg } = t;
    ww.setWar(deu, tur, g.ticks());
    const w = eg.war(eg.warOfPair(deu, tur))!;
    w.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    ww.politics.country(tur)!.ppMilli = 100_000;
    addWarScore(eg, w.id, deu, 1000);
    const tile = t.sc.capitalTileOrNull("TUR")!;
    const cap = t.sc.regionAt(tile);
    for (const r of t.sc.landRegions) {
      if (ww.politics.legalOwner[r.id] === tur && r.id !== cap) {
        ww.land.setController(r.id, deu, g.ticks());
      }
    }
    expect(askForTerms(eg, tur, w.id, g.ticks())).toBeNull();
    const offer = eg.peaceOffers.find((o) => o.ask === true)!;
    expect(replyPeace(eg, deu, offer.id, true, g.ticks())).toBeNull();
    const c = eg.conferences[eg.conferences.length - 1];
    expect(c.stake.includes(cap)).toBe(false);
    passAll(t, c);
    expect(ww.isCapitulated(tur)).toBe(true);
    expect(ww.land.controller[cap]).toBe(deu);
    // ww100: no war is left to bring a conference: its last land is settled now.
    expect(ww.politics.legalOwner[cap]).toBe(deu);
    expect(eg.countryState(tur)).toBe("gone");
    expect(eg.handedOver.some(([r]) => r === cap)).toBe(false);
  });

  it("an AI democracy gets the last land of one that fell after terms as a zone", async () => {
    const t = await start();
    const [gbr, tur] = [idOf(t, "GBR"), idOf(t, "TUR")];
    const { g, ww, eg } = t;
    ww.setWar(gbr, tur, g.ticks());
    const w = eg.war(eg.warOfPair(gbr, tur))!;
    // Its whole side: with a keeping winner the land would go there.
    for (const m of w.sides[eg.sideIndex(w, gbr) as 0 | 1].members) {
      ww.politics.country(m.id)!.ruling = IDEO_DEM;
    }
    w.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    ww.politics.country(tur)!.ppMilli = 100_000;
    addWarScore(eg, w.id, gbr, 1000);
    const cap = t.sc.regionAt(t.sc.capitalTileOrNull("TUR")!);
    for (const r of t.sc.landRegions) {
      if (ww.politics.legalOwner[r.id] === tur && r.id !== cap) {
        ww.land.setController(r.id, gbr, g.ticks());
      }
    }
    expect(askForTerms(eg, tur, w.id, g.ticks())).toBeNull();
    const offer = eg.peaceOffers.find((o) => o.ask === true)!;
    expect(replyPeace(eg, gbr, offer.id, true, g.ticks())).toBeNull();
    passAll(t, eg.conferences[eg.conferences.length - 1]);
    expect(ww.isCapitulated(tur)).toBe(true);
    expect(ww.land.controller[cap]).toBe(gbr);
    expect(ww.politics.legalOwner[cap]).toBe(tur);
    expect(eg.isZone(cap)).toBe(true);
  });

  it("one that falls after terms is still in its faction for the takeover card", async () => {
    const t = await start();
    const [deu, tur, gbr] = [idOf(t, "DEU"), idOf(t, "TUR"), idOf(t, "GBR")];
    const { g, ww, eg } = t;
    const pol = ww.politics;
    const f = pol.factionIdx(gbr);
    expect(f).toBeGreaterThanOrEqual(0);
    joinFaction(pol, tur, f, g.ticks());
    expect(pol.factionIdx(tur)).toBe(f);
    ww.setWar(deu, tur, g.ticks());
    const w = eg.war(eg.warOfPair(deu, tur))!;
    w.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    pol.country(tur)!.ppMilli = 100_000;
    addWarScore(eg, w.id, deu, 1000);
    const cap = t.sc.regionAt(t.sc.capitalTileOrNull("TUR")!);
    for (const r of t.sc.landRegions) {
      if (pol.legalOwner[r.id] === tur && r.id !== cap) {
        ww.land.setController(r.id, deu, g.ticks());
      }
    }
    expect(askForTerms(eg, tur, w.id, g.ticks())).toBeNull();
    const offer = eg.peaceOffers.find((o) => o.ask === true)!;
    expect(replyPeace(eg, deu, offer.id, true, g.ticks())).toBeNull();
    passAll(t, eg.conferences[eg.conferences.length - 1]);
    expect(ww.isCapitulated(tur)).toBe(true);
    expect(pol.factionIdx(tur)).toBe(f);
  });

  it("an AI side leader asks from 70 %, and not before", async () => {
    const t = await start();
    const fra = idOf(t, "FRA");
    const w = warOn(t, [...srOf(t, NORTH)]);
    const pm = surrenderPm(t.eg, fra);
    const day = t.ww.day(t.g.ticks());
    aiAskTermsDay(t.eg, fra, day, t.g.ticks());
    expect(t.eg.peaceOffers.some((o) => o.ask === true)).toBe(pm >= 700);
    if (pm < 700) {
      for (const r of [
        ...srOf(t, EAST),
        ...srOf(t, WEST),
        ...srOf(t, CENTRE),
      ]) {
        t.ww.land.setController(r, idOf(t, "DEU"), t.g.ticks());
      }
      expect(surrenderPm(t.eg, fra)).toBeGreaterThanOrEqual(700);
      aiAskTermsDay(t.eg, fra, day, t.g.ticks());
      expect(t.eg.peaceOffers.some((o) => o.ask === true)).toBe(true);
    }
    expect(w.ended).toBeNull();
  });

  it("an AI minor doesn't ask over the head of a great power on its side", async () => {
    const t = await start();
    const { g, ww, eg } = t;
    const [deu, pol, fra] = [idOf(t, "DEU"), idOf(t, "POL"), idOf(t, "FRA")];
    ww.setWar(deu, pol, g.ticks());
    const w = eg.war(eg.warOfPair(deu, pol))!;
    ww.setWar(deu, fra, g.ticks(), { kind: "into", warId: w.id });
    expect(eg.sideIndex(w, fra)).toBe(eg.sideIndex(w, pol));
    w.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
    ww.politics.country(pol)!.ppMilli = 100_000;
    const cap = t.sc.regionAt(t.sc.capitalTileOrNull("POL")!);
    for (const r of t.sc.landRegions) {
      if (ww.politics.legalOwner[r.id] === pol && r.id !== cap) {
        ww.land.setController(r.id, deu, g.ticks());
      }
    }
    expect(surrenderPm(eg, pol)).toBeGreaterThanOrEqual(700);
    expect(surrenderPm(eg, fra)).toBeLessThan(400);
    const day = ww.day(g.ticks());
    aiAskTermsDay(eg, pol, day, g.ticks());
    expect(eg.peaceOffers.some((o) => o.ask === true)).toBe(false);
    // France beaten too: the side is, and its leader speaks for it.
    for (const sr of [NORTH, EAST, WEST, CENTRE]) {
      for (const r of srOf(t, sr)) ww.land.setController(r, deu, g.ticks());
    }
    expect(surrenderPm(eg, fra)).toBeGreaterThanOrEqual(400);
    aiAskTermsDay(eg, pol, day, g.ticks());
    expect(eg.peaceOffers.some((o) => o.ask === true)).toBe(true);
  });

  it("an AI winner refuses when it isn't clearly ahead", async () => {
    const t = await start();
    const [deu, fra] = [idOf(t, "DEU"), idOf(t, "FRA")];
    const w = warOn(t, [...srOf(t, NORTH), ...srOf(t, EAST)]);
    // Germany has lost as much as France.
    const home = t.sc.landRegions
      .filter((r) => t.ww.politics.legalOwner[r.id] === deu)
      .sort((a, b) => b.vp - a.vp)
      .slice(0, 4)
      .map((r) => r.id);
    for (const r of home) t.ww.land.setController(r, fra, t.g.ticks());
    expect(askForTerms(t.eg, fra, w.id, t.g.ticks())).toBeNull();
    step(t.runner);
    expect(w.ended).toBeNull();
    expect(t.eg.peaceOffers).toHaveLength(0);
  });
});
