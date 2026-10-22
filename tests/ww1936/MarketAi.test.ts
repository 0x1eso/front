// World War 1936 P6 (plan Task 4, spec §19.4): the AI's MIOs, licences,
// market and embargoes. Each test leaves one country to the AI and calls
// its day directly on a day of its rhythm (plan decision 39: at peace
// every 30th day for the market, every 10th for the MIOs).
import { MIO_FAMILIES } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  aiMarketDay,
  aiTraitOrder,
} from "@openfront/engine/ww1936/depth/AiMarket";
import { setEmbargo } from "@openfront/engine/ww1936/depth/Embargo";
import { freeCivsOf } from "@openfront/engine/ww1936/depth/Licences";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { addOpinion } from "@openfront/engine/ww1936/politics/Treaties";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const { DEU, ITA, GBR, FRA, SUN, POL, TUR } = DEEP.tag;
const INF1 = equipKey("infantry_equipment", 1);
const ART1 = equipKey("artillery", 1);
const ART2 = equipKey("artillery", 2);
const ARM = MIO_FAMILIES.indexOf("mio_armor");
const AIR_LIGHT = MIO_FAMILIES.indexOf("mio_air_light");
const INF = MIO_FAMILIES.indexOf("mio_infantry");

async function deep(human: "DEU" | "FRA" | "POL" = "POL") {
  const runner = await wwRunner(
    {},
    [{ clientID: `HUMAN${human}`, country: human }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const tick = runner.game.ticks();
  return { runner, ww, d: ww.depth, tick, day: ww.day(tick) };
}

/** A day ≥ 30 of `id`'s rhythm (`every` days). */
const rhythm = (id: number, every: number, k = 1) => every * k + (id % every);

describe("World War 1936 P6: the market AI", () => {
  it("AI accepts a licence from its faction leader", async () => {
    const { ww, d } = await deep("FRA");
    const econ = ww.economy;
    econ.country(DEU)!.addTech("artillery_2");
    const ita = econ.country(ITA)!;
    expect(ita.researched.has("artillery_2")).toBe(false);
    expect(ita.lines.some((l) => l.key === ART1)).toBe(true);
    // Italy's day: it asks its faction leader for the artillery Germany
    // makes and it does not (Germany's fighters are no newer, it has no
    // medium tanks); Germany, an AI of the same faction, says yes.
    aiMarketDay(d, ITA, rhythm(ITA, 30));
    expect(d.market.licences).toEqual([
      expect.objectContaining({ from: DEU, to: ITA, key: ART2, ship: 0 }),
    ]);
    expect(d.civsOut(ITA)).toBe(0);
    // And it builds it: its artillery line moves to the licensed generation.
    expect(ita.lines.some((l) => l.key === ART2)).toBe(true);
    expect(ita.lines.some((l) => l.key === ART1)).toBe(false);
    // Asked again on its next day: nothing new.
    aiMarketDay(d, ITA, rhythm(ITA, 30, 2));
    expect(d.market.licences).toHaveLength(1);
  });

  it("an AI asks a human faction leader only every 90th day", async () => {
    const { ww, d } = await deep("DEU");
    ww.economy.country(DEU)!.addTech("artillery_2");
    aiMarketDay(d, ITA, rhythm(ITA, 30));
    expect(d.market.pending).toEqual([]);
    aiMarketDay(d, ITA, rhythm(ITA, 90));
    expect(d.market.pending).toEqual([
      expect.objectContaining({ from: ITA, to: DEU, key: ART2 }),
    ]);
    expect(d.market.licences).toEqual([]);
  });

  it("an AI licensor outside the faction weighs opinion and threat", async () => {
    const { ww, d, tick } = await deep("FRA");
    const pol = ww.politics;
    const msg = vi.spyOn(d, "message");
    const ask = (key: number) =>
      d.issue(FRA, { kind: "licence_request", from: DEU, key }, tick);
    // Germany thinks 20 of France (same ideology, no faction): below 25.
    expect(ask(ART1)).toBeNull();
    expect(d.market.licences).toEqual([]);
    expect(d.market.pending).toEqual([]);
    expect(msg).toHaveBeenCalledWith(
      FRA,
      "ww1936_licence_denied",
      expect.objectContaining({ countryTag: "DEU" }),
    );
    addOpinion(pol, DEU, FRA, 10, 365);
    expect(ask(ART1)).toBeNull();
    expect(d.market.licences).toEqual([
      expect.objectContaining({ from: DEU, to: FRA, key: ART1 }),
    ]);
    // France among the three countries that made the most tension: no.
    ww.economy.country(DEU)!.addTech("artillery_2");
    pol.threatBp[FRA] = 300;
    expect(ask(ART2)).toBeNull();
    expect(d.market.licences).toHaveLength(1);
    pol.threatBp[SUN] = 400;
    pol.threatBp[ITA] = 500;
    pol.threatBp[GBR] = 600;
    expect(ask(ART2)).toBeNull();
    expect(d.market.licences).toHaveLength(2);
  });

  it("AI lists surplus old equipment", async () => {
    const { ww, d } = await deep();
    const tur = ww.economy.country(TUR)!;
    expect(ww.land.rowsOf(TUR)).toHaveLength(0);
    tur.stock[INF1] = 1000;
    // Its newest rifle is the 1936 one: nothing is old yet.
    aiMarketDay(d, TUR, rhythm(TUR, 30));
    expect(d.market.listings).toEqual([]);
    // Rifles of 1939: the 1936 ones are 3 years behind. No divisions need
    // them, so half of the 1,000 goes on the market.
    tur.addTech("inf_eq_2");
    aiMarketDay(d, TUR, rhythm(TUR, 30, 2) + 1);
    expect(d.market.listings).toEqual([]); // not its day
    aiMarketDay(d, TUR, rhythm(TUR, 30, 2));
    expect(d.market.listings).toEqual([
      expect.objectContaining({ seller: TUR, key: INF1, count: 500 }),
    ]);
    expect(tur.stock[INF1]).toBe(500);
  });

  it("an AI keeps old equipment its divisions are short of", async () => {
    const { ww, d } = await deep("DEU");
    const land = ww.land;
    const pol = ww.economy.country(POL)!;
    pol.addTech("inf_eq_2");
    pol.stock[INF1] = 100_000;
    const j = GROUND_EQUIP_KEYS.indexOf(INF1);
    const rows = land.rowsOf(POL);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) land.addEquip(r, j, -land.divisions.equipOf(r)[j]);
    aiMarketDay(d, POL, rhythm(POL, 30));
    expect(d.market.listings.filter((l) => l.seller === POL)).toEqual([]);
  });

  it("AI picks archetypes by its character and buys traits", async () => {
    const { ww, d, tick } = await deep();
    ww.politics.country(GBR)!.ruling = IDEO_DEM;
    for (const id of [DEU, ITA, GBR, TUR]) aiMarketDay(d, id, rhythm(id, 10));
    // Spec §19.4: the aggressor majors' armour and light aircraft are
    // design bureaus, their other families state arsenals; a democracy's
    // are private combines; anyone else's state arsenals.
    const bureau = [0, 0, 2, 2, 0, 0];
    expect(d.country(DEU)!.mio.arch).toEqual(bureau);
    expect(d.country(ITA)!.mio.arch).toEqual(bureau);
    expect(d.country(GBR)!.mio.arch).toEqual([1, 1, 1, 1, 1, 1]);
    expect(d.country(TUR)!.mio.arch).toEqual([0, 0, 0, 0, 0, 0]);
    // The free column up first, then the others row by row; an aggressor
    // takes q3, anyone else p3.
    expect(aiTraitOrder(2, true)).toEqual([7, 8, 0, 3, 1, 4, 5]);
    expect(aiTraitOrder(0, false)).toEqual([1, 2, 3, 6, 4, 7, 8]);
    expect(aiTraitOrder(1, false)).toEqual([4, 0, 6, 1, 7, 2, 8]);
    const deu = d.country(DEU)!;
    deu.mio.fundsMilli[ARM * 3 + 2] = 3_600_000; // size 3
    aiMarketDay(d, DEU, rhythm(DEU, 10, 2));
    expect(deu.mio.traits[ARM * 3 + 2]).toBe(
      (1 << 6) | (1 << 7) | (1 << 8) | (1 << 0),
    );
    expect(deu.mio.traits[AIR_LIGHT * 3 + 2]).toBe(1 << 6);
    // At war with 200 political power it invests in its main family (its
    // biggest line makes rifles).
    ww.setWar(DEU, POL, tick);
    ww.politics.country(DEU)!.ppMilli = 250_000;
    aiMarketDay(d, DEU, rhythm(DEU, 10, 2) + 3);
    expect(deu.mio.fundsMilli[INF * 3]).toBe(600_000);
    expect(ww.politics.country(DEU)!.ppMilli).toBe(200_000);
  });

  it("a democracy embargoes its top threats at high tension", async () => {
    const { ww, d } = await deep();
    const pol = ww.politics;
    pol.country(GBR)!.ruling = IDEO_DEM;
    pol.threatBp[DEU] = 800;
    pol.threatBp[SUN] = 700;
    pol.threatBp[ITA] = 600;
    // A faction mate's embargo goes.
    setEmbargo(d, GBR, FRA, true);
    pol.wtBp = 3_999;
    aiMarketDay(d, GBR, rhythm(GBR, 30));
    expect(d.market.embargoes).toEqual([]);
    pol.wtBp = 4_000;
    const pp = pol.country(GBR)!.ppMilli;
    aiMarketDay(d, GBR, rhythm(GBR, 30, 2));
    expect(d.market.embargoes).toEqual([
      [GBR, DEU],
      [GBR, SUN],
    ]);
    expect(pol.country(GBR)!.ppMilli).toBe(pp - 50_000);
  });

  it("an AI at war buys what its divisions are short of", async () => {
    const { ww, d, tick, day } = await deep("DEU");
    const land = ww.land;
    const fra = ww.economy.country(FRA)!;
    // Germany offers 2,000 rifles.
    expect(
      d.issue(DEU, { kind: "market_list", key: INF1, count: 2000 }, tick),
    ).toBeNull();
    // France's divisions and stock hold no rifles.
    const j = GROUND_EQUIP_KEYS.indexOf(INF1);
    for (const r of land.rowsOf(FRA)) {
      land.addEquip(r, j, -land.divisions.equipOf(r)[j]);
    }
    for (let g = 1; g <= 3; g++) {
      fra.stock[equipKey("infantry_equipment", g)] = 0;
    }
    fra.totals.civ = 20;
    // At peace: no purchase.
    aiMarketDay(d, FRA, rhythm(FRA, 30));
    expect(d.market.deals).toEqual([]);
    ww.setWar(FRA, SUN, tick);
    const budget = Math.floor((freeCivsOf(d, FRA) * 30) / 100);
    expect(budget).toBeGreaterThan(0);
    aiMarketDay(d, FRA, rhythm(FRA, 10, 5));
    expect(d.market.deals).toEqual([
      expect.objectContaining({ buyer: FRA, seller: DEU, key: INF1 }),
    ]);
    const deal = d.market.deals[0];
    expect(deal.civs).toBeLessThanOrEqual(budget);
    expect(deal.count).toBeGreaterThan(0);
    expect(deal.startDay).toBe(rhythm(FRA, 10, 5));
    void day;
    // Not the same gap again while the deal brings it.
    aiMarketDay(d, FRA, rhythm(FRA, 10, 6));
    expect(d.market.deals).toHaveLength(1);
  });
});
