// World War 1936 ww88 (lane Y): peace offers on the real world1936 map — the
// small test map hides these (ww86 report): a beaten side's line, war
// weariness for an unhurt target, the stalemate of a war with no land front,
// the one-line reason and the points still missing.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { WW_WHITE_PEACE_MIN_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  negPeaceChance,
  negPeaceMissing,
  warWearinessPct,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  aiWantsLinePeace,
  lineJudgeOf,
  linePeaceData,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import {
  peaceJudgeData,
  peaceJudgeOf,
  peaceReasonOf,
} from "@openfront/engine/ww1936/endgame/NegPeace";
import {
  acceptPct,
  AI_PEACE_REFUSE_CAP_PM,
  heldPm,
  stalemateDays,
  stepFronts,
  surrenderPm,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";

async function world() {
  const files = await loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner = await createGameRunner(
    wwGameStart(),
    undefined,
    files,
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
  const day = () => ww.day(g.ticks());
  const id = (t: string) => sc.smallIdOf(t as never);
  const war = (a: number, b: number, age = WW_WHITE_PEACE_MIN_DAYS) => {
    ww.setWar(a, b, g.ticks(), { kind: "declare" });
    const w = eg.warOfPair(a, b);
    eg.war(w)!.startDay = day() - age;
    for (const x of [a, b]) pol.country(x)!.ppMilli = 100_000;
    return w;
  };
  /** `b` takes `a`'s land (not the capital) until it holds `goalPm` ‰ of it. */
  const takeFrom = (a: number, b: number, goalPm: number) => {
    const mine = sc.landRegions
      .filter((r) => pol.legalOwner[r.id] === a && r.id !== eg.capitalRegion(a))
      .map((r) => r.id)
      .sort((x, y) => x - y);
    for (const r of mine) {
      if (heldPm(eg, [b], [a]) >= goalPm) break;
      if (land.controller[r] === a) land.setController(r, b, g.ticks());
    }
  };
  return { g, ww, eg, pol, sc, day, id, war, takeFrom };
}

describe("ww88 peace offers on the real map", () => {
  it("a losing side's line is judged at full value, and refused flat past 70% of its way to surrender", async () => {
    const W = await world();
    const { eg, day, id, war, takeFrom } = W;
    const [fra, deu] = [id("FRA"), id("DEU")];
    const w = war(fra, deu);
    const rec = eg.war(w)!;
    const chances: [number, number, number][] = [];
    for (const goal of [70, 110, 250, 330, 540]) {
      takeFrom(fra, deu, goal);
      const j = lineJudgeOf(eg, rec, fra, deu, true, day());
      chances.push([
        surrenderPm(eg, fra),
        heldPm(eg, [deu], [fra]),
        negPeaceChance(j.j, j.value),
      ]);
    }
    // France far from surrender, a few regions lost: the line passes.
    expect(chances[0][2]).toBeGreaterThanOrEqual(80);
    // Never above the flat refusal's line.
    for (const [cap, , chance] of chances) {
      if (cap >= AI_PEACE_REFUSE_CAP_PM) expect(chance).toBe(0);
    }
    // Lost more: the chance only falls, with no cliff at 0 (it was 100 → 0 at 24%).
    for (let i = 1; i < chances.length; i++) {
      expect(chances[i][2]).toBeLessThanOrEqual(chances[i - 1][2]);
    }
    const last = chances[chances.length - 1];
    expect(last[0]).toBeGreaterThanOrEqual(AI_PEACE_REFUSE_CAP_PM);
    expect(last[2]).toBe(0);
  });

  it("an unhurt target tires of a long war, with or without a land front", async () => {
    const W = await world();
    const { eg, day, id, war } = W;
    const [fra, deu, usa, jpn] = [id("FRA"), id("DEU"), id("USA"), id("JPN")];
    const probe = (wid: number, from: number, to: number) => {
      const rec = eg.war(wid)!;
      return acceptPct(eg, rec, from, to, true, day());
    };
    const w1 = war(fra, deu, 100);
    const w2 = war(usa, jpn, 100);
    const young = [probe(w1, fra, deu), probe(w2, usa, jpn)];
    eg.war(w1)!.startDay = day() - 365;
    eg.war(w2)!.startDay = day() - 365;
    const year = [probe(w1, fra, deu), probe(w2, usa, jpn)];
    eg.war(w1)!.startDay = day() - 365 - 30 * 9;
    eg.war(w2)!.startDay = day() - 365 - 30 * 9;
    const later = [probe(w1, fra, deu), probe(w2, usa, jpn)];
    eg.war(w1)!.startDay = day() - 3000;
    eg.war(w2)!.startDay = day() - 3000;
    const old = [probe(w1, fra, deu), probe(w2, usa, jpn)];
    // Stalemate adds 15 after 180 quiet days; weariness is 1% at a year, +1 per 30 days, max 30.
    for (let i = 0; i < 2; i++) {
      expect(year[i]).toBeGreaterThan(young[i]);
      expect(later[i]).toBeGreaterThan(year[i]);
      expect(old[i]).toBeGreaterThan(later[i]);
    }
    expect(warWearinessPct(365 + 30 * 9, false)).toBe(10);
  });

  it("a war with no land front counts its stalemate from its start", async () => {
    const W = await world();
    const { eg, day, id, war } = W;
    const w = war(id("USA"), id("JPN"), 200);
    stepFronts(eg, day());
    expect(stalemateDays(eg, w, day())).toBe(200);
  });

  it("the composer's reason: winning, much stronger, no front, not hurt; and the price in points", async () => {
    const W = await world();
    const { eg, day, id, war, takeFrom } = W;
    const [fra, deu, usa, jpn] = [id("FRA"), id("DEU"), id("USA"), id("JPN")];
    const w1 = war(fra, deu);
    const w2 = war(usa, jpn);
    const r1 = eg.war(w1)!;
    const r2 = eg.war(w2)!;
    const reason = (w: typeof r1, from: number, to: number) => {
      const j = acceptPct(eg, w, from, to, true, day());
      return peaceReasonOf(eg, w, from, to, true, day(), j);
    };
    // Unhurt: the US and Japan share no land front; France and Germany do.
    expect(reason(r2, usa, jpn).reason).toBe("no_front");
    expect(reason(r1, fra, deu).reason).toBe("not_hurt");
    // Past 70% of the way to surrender: they are winning.
    takeFrom(fra, deu, 540);
    expect(surrenderPm(eg, fra)).toBeGreaterThanOrEqual(AI_PEACE_REFUSE_CAP_PM);
    expect(reason(r1, fra, deu).reason).toBe("winning");
  });

  it("the rows carry the reason and the missing points; the points do make a high chance", async () => {
    const W = await world();
    const { eg, day, id, war, takeFrom } = W;
    const [fra, deu] = [id("FRA"), id("DEU")];
    const w = war(fra, deu);
    const rec = eg.war(w)!;
    const j = peaceJudgeOf(eg, rec, fra, deu, true, day());
    const missing = negPeaceMissing(j, 0);
    expect(missing).toBeGreaterThan(0);
    expect(negPeaceChance(j, missing)).toBeGreaterThanOrEqual(60);
    expect(
      negPeaceChance(j, missing - Math.ceil(j.unit / 1000) * 5),
    ).toBeLessThan(60);
    // The worker rows show them for a human's country (the judge row and the line row).
    eg.humanOf.set(fra, "h");
    const row = peaceJudgeData(eg, true)?.find((x) => x.from === fra);
    const line = linePeaceData(eg, true)?.find((x) => x.from === fra);
    expect(row).toBeDefined();
    expect(line).toBeDefined();
    if (row !== undefined) {
      expect(row.reason).toBe("not_hurt");
      expect(row.weary).toBe(0);
    }
    if (line !== undefined) expect(line.reason).toBeDefined();
    takeFrom(fra, deu, 110);
  });

  it("the AI's own line offers: a losing AI with a moving front asks, and stops asking once it is refused flat", async () => {
    const W = await world();
    const { eg, day, id, war, takeFrom } = W;
    const [fra, deu] = [id("FRA"), id("DEU")];
    const w = war(fra, deu, 200);
    const rec = eg.war(w)!;
    takeFrom(fra, deu, 260);
    eg.fronts = [[w, 4, 0, day() - 10]];
    expect(surrenderPm(eg, fra)).toBeLessThan(AI_PEACE_REFUSE_CAP_PM);
    const j = lineJudgeOf(eg, rec, fra, deu, true, day());
    expect(negPeaceChance(j.j, j.value)).toBeGreaterThanOrEqual(25);
    expect(aiWantsLinePeace(eg, rec, fra, day())).toBe(true);
    takeFrom(fra, deu, 540);
    expect(surrenderPm(eg, fra)).toBeGreaterThanOrEqual(AI_PEACE_REFUSE_CAP_PM);
    expect(aiWantsLinePeace(eg, rec, fra, day())).toBe(false);
  });
});
