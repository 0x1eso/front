// World War 1936 P5 lane A (plan Task 6 Step 7; spec §13): lend-lease on
// the end map between human countries (no AI economy moves their stock).
// Italy borders Poland (Rome–Krakow): the land route.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_LL_LAND_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { LL_STOP_REASONS } from "@openfront/engine/ww1936/endgame/LendLease";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import fs from "fs";
import path from "path";
import { messages } from "./convoyUtil";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  clearStartSetup,
  END_MAP,
  order,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const C_ITA = "HUMANITA";
const C_POL = "HUMANPOL";
const INF1 = equipKey("infantry_equipment", 1);

async function game() {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [
      { clientID: C_ITA, country: "ITA" },
      { clientID: C_POL, country: "POL" },
    ],
    END_MAP,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const [ita, pl, sun] = [endId("ITA"), endId("POL"), endId("SUN")];
  // A blank board: no division draws on the stock, no line adds to it.
  clearLand(g);
  for (const id of [ita, pl]) {
    clearStartSetup(ww.economy, ww.economy.country(id)!);
  }
  ww.economy.country(ita)!.stock[INF1] = 10_000;
  ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
  const stock = (id: number) => ww.economy.country(id)!.stock[INF1];
  const dayTick = (d: number) => dayStartTick(d, ww.prepEndTick());
  return {
    runner,
    updates,
    g,
    ww,
    eg: ww.endgame,
    ita,
    pl,
    sun,
    stock,
    dayTick,
  };
}

function until(runner: GameRunner, done: () => boolean, max = 2000): void {
  for (let i = 0; i < max && !done(); i++) step(runner);
  if (!done()) throw new Error("condition not reached");
}

const llOrder = (to: number, perMonth: number) =>
  ({
    kind: "lend_lease",
    to,
    item: "infantry_equipment",
    gen: 1,
    perMonth,
  }) as const;

describe("World War 1936 P5: lend-lease", () => {
  it("lend-lease takes stock daily and arrives after the land delay", async () => {
    const { runner, updates, g, ww, eg, ita, pl, stock, dayTick } =
      await game();
    step(runner, 2, [order(C_ITA, llOrder(pl, 300))]);
    expect(eg.lendLease).toHaveLength(1);
    const c = eg.lendLease[0];
    expect([c.from, c.to, c.item, c.gen, c.perMonth]).toEqual([
      ita,
      pl,
      "infantry_equipment",
      1,
      300,
    ]);
    // Italy's first day of it: 300 a month is 10 a day, out of the stock.
    until(runner, () => eg.inTransit.length > 0);
    const d = ww.day(g.ticks());
    expect(eg.inTransit).toHaveLength(1);
    const t = eg.inTransit[0];
    expect([t.from, t.to, t.gen, t.countMilli, t.sea]).toEqual([
      ita,
      pl,
      1,
      10_000,
      false,
    ]);
    expect(t.arriveDay).toBe(d + WW_LL_LAND_DAYS);
    expect(c.route).toBe(1);
    expect(stock(ita)).toBe(9_990);
    // A shipment a day; the first is in Poland's stock on day d + 10.
    const before = stock(pl);
    stepTo(runner, dayTick(d + WW_LL_LAND_DAYS));
    expect(stock(pl)).toBe(before);
    expect(eg.inTransit).toHaveLength(WW_LL_LAND_DAYS);
    expect(stock(ita)).toBe(10_000 - 10 * WW_LL_LAND_DAYS);
    step(runner);
    expect(stock(pl)).toBe(before + 10);
    expect(c.arrivedMonth).toBe(10);
    // Poland's day: one line, from Italy (lane T's {fromTag}).
    stepTo(runner, dayTick(d + WW_LL_LAND_DAYS) + 7);
    const got = messages(updates, "events_display.ww1936_ll_arrived");
    expect(got).toHaveLength(1);
    expect(got[0].params).toEqual({
      fromTag: "ITA",
      items: `${ita}:${INF1}:10`,
    });
  });

  it("a democracy needs 40% tension or the lend_lease flag", async () => {
    const { g, ww, eg, ita, pl } = await game();
    const pol = ww.politics;
    const it = pol.country(ita)!;
    it.ruling = IDEO_DEM;
    pol.wtBp = 3_900;
    const issue = () => eg.issue(ita, llOrder(pl, 300), g.ticks());
    expect(issue()).toBe("ll_conditions");
    pol.wtBp = 4_000;
    expect(issue()).toBeNull();
    expect(eg.lendLease).toHaveLength(1);
    eg.issue(ita, { kind: "lend_lease_cancel", id: eg.lendLease[0].id }, 0);
    expect(eg.lendLease).toHaveLength(0);
    pol.wtBp = 1_000;
    expect(issue()).toBe("ll_conditions");
    it.flags.set("lend_lease", [0, -1]);
    expect(issue()).toBeNull();
    // Not a democracy: no tension needed (the receiver is at war).
    it.flags.clear();
    it.ruling = 3;
    expect(issue()).toBeNull();
  });

  it("a contract stops while its conditions fail and resumes after", async () => {
    const { runner, updates, g, ww, eg, ita, pl, sun, stock, dayTick } =
      await game();
    expect(eg.issue(ita, llOrder(pl, 300), g.ticks())).toBeNull();
    const c = eg.lendLease[0];
    until(runner, () => eg.inTransit.length > 0);
    const d = ww.day(g.ticks());
    // Poland makes peace; tension is under 50%: Italy's next day stops it.
    ww.endWar(pl, sun);
    expect(ww.politics.wtBp).toBeLessThan(5_000);
    stepTo(runner, dayTick(d + 1) + 7);
    expect(c.blocked).toBe("ll_conditions");
    const left = stock(ita);
    stepTo(runner, dayTick(d + 4) + 7);
    expect(stock(ita)).toBe(left);
    expect(eg.lendLease).toEqual([c]);
    // One translated line per reason: Poland at peace, tension under 50%.
    expect(
      messages(updates, "events_display.ww1936_ll_stopped_ll_peace").map(
        (m) => m.params,
      ),
    ).toEqual([{ need: 50 }]);
    // The war again: it runs on.
    ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
    stepTo(runner, dayTick(d + 5) + 7);
    expect(c.blocked).toBeNull();
    expect(stock(ita)).toBe(left - 10);
  });

  it("arrival adds war score on the same side", async () => {
    const { runner, g, ww, eg, ita, pl, sun, stock, dayTick } = await game();
    // Italy joins Poland's war on Poland's side.
    ww.setWar(ita, sun, g.ticks(), { kind: "into", warId: 0 });
    const w = eg.war(eg.warOfPair(pl, sun))!;
    expect(eg.sideIndex(w, ita)).toBe(eg.sideIndex(w, pl));
    expect(eg.issue(ita, llOrder(pl, 3_000), g.ticks())).toBeNull();
    until(runner, () => eg.inTransit.length > 0);
    const d = ww.day(g.ticks());
    expect(eg.inTransit[0].countMilli).toBe(100_000);
    const ws = () => eg.member(w, ita)!.wsMilli;
    const before = ws();
    const pBefore = stock(pl);
    stepTo(runner, dayTick(d + WW_LL_LAND_DAYS) + 1);
    // 100 infantry equipment cost 50 industry: one point (1,000 milli).
    expect(stock(pl)).toBe(pBefore + 100);
    expect(ws()).toBe(before + 1_000);
    expect(eg.member(w, pl)!.wsMilli).toBe(0);
  });

  it("a contract to a country that no longer plays ends; what is on its way goes back", async () => {
    const { runner, g, ww, eg, ita, pl, sun, stock, dayTick } = await game();
    expect(eg.issue(ita, llOrder(pl, 300), g.ticks())).toBeNull();
    until(runner, () => eg.inTransit.length >= 3);
    const d = ww.day(g.ticks());
    const out = eg.inTransit.reduce((n, t) => n + t.countMilli / 1000, 0);
    expect(out).toBe(30);
    const left = stock(ita);
    // Poland capitulates: not an actor any more.
    ww.addCapitulation(pl, sun, g.ticks());
    stepTo(runner, dayTick(d + 1) + 7);
    expect(eg.lendLease).toEqual([]);
    expect(eg.inTransit).toEqual([]);
    expect(stock(ita)).toBe(left + out);
  });

  it("every stop reason has its en and ko line", () => {
    const lang = (f: string) =>
      JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../../resources/lang/${f}.json`),
          "utf8",
        ),
      ).events_display as Record<string, string>;
    const [en, ko] = [lang("en"), lang("ko")];
    for (const r of LL_STOP_REASONS) {
      const key = `ww1936_ll_stopped_${r}`;
      expect(typeof en[key], key).toBe("string");
      expect(typeof ko[key], key).toBe("string");
      // Korean ICU arguments are followed by a space.
      expect(ko[key], key).not.toMatch(/\}[^\s]/);
    }
  });
});
