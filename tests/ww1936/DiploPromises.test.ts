// World War 1936 diplomacy D4 (ww161 Design B §4; ww162 lane L3): promised
// land. The pure rules (a promise's receiver fights for it, the government
// gate, the strength ratio); the item checks; an accepted promise for
// joining a war (the join, the granted claim goal, the record); the AI's
// values; the conference handing the promised land over first, at the
// promiser's points; the lapse when the promiser leaves or the war ends in
// a white peace; the AI side leader's offer to a neutral; a restore in
// lockstep. End map: Italy (Rome borders Krakow) is promised east_poland.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  type DealItem,
  DIPLO_COOLDOWN_KINDS,
  WW_PROMISE_AI_DAYS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { DealFacts } from "@openfront/engine-lib/ww1936/DiploRules";
import { WW_DEAL_VETO } from "@openfront/engine-lib/ww1936/DiploRules";
import {
  promiseGateBlock,
  promisePairBlock,
  promiseStrengthOk,
  WW_PROMISE_ALLY_PTS,
  WW_PROMISE_JOIN_PTS,
} from "@openfront/engine-lib/ww1936/PromiseRules";
import type { Game, Player } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { regionBase } from "@openfront/engine/ww1936/endgame/Conference";
import { offerDeal, replyDeal } from "@openfront/engine/ww1936/endgame/Deals";
import {
  aiPromiseDay,
  promiseItemValue,
  WW_PROMISE_AI_CHECK_DAYS,
} from "@openfront/engine/ww1936/endgame/Promises";
import {
  addWarScore,
  checkWarEnds,
} from "@openfront/engine/ww1936/endgame/Wars";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  HUMAN,
  order,
  step,
  stepTo,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ claims: [{ tag: "ITA", groups: ["east_poland"] }] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const [WARSAW, KRAKOW] = [6, 7];
const ITA_HUMAN: WwHuman[] = [{ clientID: HUMAN, country: "ITA" }];

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  for (let x = 1; x < ww.endgame.size; x++) {
    const c = ww.politics.country(x);
    if (c !== null) c.ppMilli = 100_000;
  }
  // Italy fascist: no tension gate for its joining (the fixture's are neutral).
  ww.politics.country(id("ITA"))!.ruling = IDEO_FAS;
  return { runner, g, ww, eg: ww.endgame };
}

/** Germany's war on Poland (its id). */
function war(g: Game, ww: WorldWar): number {
  ww.setWar(id("DEU"), id("POL"), g.ticks(), { kind: "declare" });
  return ww.endgame.warOfPair(id("DEU"), id("POL"));
}

type Item<K extends DealItem["kind"]> = Extract<DealItem, { kind: K }>;
const promise = (target: number, group = "east_poland"): Item<"promise"> => ({
  kind: "promise",
  target,
  group,
});
const joinWar = (w: number, target: number): Item<"join_war"> => ({
  kind: "join_war",
  war: w,
  target,
});
const deal = (to: number, give: DealItem[], take: DealItem[] = []) => ({
  kind: "deal_offer" as const,
  to,
  give,
  take,
});

/** Germany promises Italy (a human) east Poland for joining; Italy accepts. */
function promised(t: Awaited<ReturnType<typeof started>>, w: number) {
  const { g, eg } = t;
  const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
  expect(
    offerDeal(eg, deu, deal(ita, [promise(pl)], [joinWar(w, pl)]), g.ticks()),
  ).toBeNull();
  const o = eg.deals[0];
  expect(replyDeal(eg, ita, o.id, true, g.ticks())).toBeNull();
  return o.id;
}

const player = (g: Game, tag: CountryTag): Player => {
  const p = g.playerBySmallID(id(tag));
  if (!p.isPlayer()) throw new Error(`no ${tag}`);
  return p;
};

/** Counts the notices `key` shown so far (spied on displayMessage). */
function notices(g: Game) {
  const spy = vi.spyOn(g, "displayMessage");
  return (key: string) =>
    spy.mock.calls.filter((c) => c[0] === `events_display.${key}`).length;
}

describe("diplomacy D4: the rules", () => {
  const facts = (
    atWar: [number, number][],
    sameSide: [number, number][],
  ): Pick<DealFacts, "atWar" | "sameSide"> => {
    const has = (l: [number, number][], a: number, b: number) =>
      l.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    return {
      atWar: (a, b) => has(atWar, a, b),
      sameSide: (a, b) => has(sameSide, a, b),
    };
  };

  test("a promise goes to one that joins the war on its target in the deal, or fights it already beside the promiser", () => {
    const f = facts([[2, 9]], []);
    expect(promisePairBlock(f, 1, 3, [promise(9)], [])).toBe(
      "promise_bad_target",
    );
    expect(promisePairBlock(f, 1, 3, [promise(9)], [joinWar(4, 9)])).toBe(null);
    expect(promisePairBlock(f, 1, 3, [promise(9)], [joinWar(4, 8)])).toBe(
      "promise_bad_target",
    );
    // The receiver asks for it: it gives the join, it takes the promise.
    expect(promisePairBlock(f, 3, 1, [joinWar(4, 9)], [promise(9)])).toBe(null);
    // An ally already at war with the target, on the promiser's side.
    const ally = facts([[2, 9]], [[1, 2]]);
    expect(promisePairBlock(ally, 1, 2, [promise(9)], [])).toBe(null);
    expect(promisePairBlock(facts([[2, 9]], []), 1, 2, [promise(9)], [])).toBe(
      "promise_bad_target",
    );
  });

  test("the gate: a democracy at 50% world tension, a neutral at 25%; the strength ratio", () => {
    expect(promiseGateBlock(IDEO_DEM, 4999)).toBe("tension_gate");
    expect(promiseGateBlock(IDEO_DEM, 5000)).toBe(null);
    expect(promiseGateBlock(IDEO_NEU, 2499)).toBe("tension_gate");
    expect(promiseGateBlock(IDEO_NEU, 2500)).toBe(null);
    expect(promiseGateBlock(IDEO_FAS, 0)).toBe(null);
    expect(promiseStrengthOk(130, 100)).toBe(true);
    expect(promiseStrengthOk(129, 100)).toBe(false);
    expect(promiseStrengthOk(1, 0)).toBe(true);
  });
});

describe("diplomacy D4: promised land", { timeout: 120_000 }, () => {
  test("the items' checks: a war on the target, its land, a receiver that may join", async () => {
    const t = await started(ITA_HUMAN);
    const { g, ww, eg } = t;
    const [deu, ita, pl, sun, fra] = [
      id("DEU"),
      id("ITA"),
      id("POL"),
      id("SUN"),
      id("FRA"),
    ];
    const tick = g.ticks();
    // No war on Poland yet.
    expect(
      offerDeal(eg, deu, deal(ita, [promise(pl)], [joinWar(1, pl)]), tick),
    ).toBe("deal_bad_item");
    const w = war(g, ww);
    // A group without Polish land; a promise with nobody joining.
    expect(
      offerDeal(
        eg,
        deu,
        deal(ita, [promise(pl, "slovakia")], [joinWar(w, pl)]),
        tick,
      ),
    ).toBe("deal_bad_item");
    expect(offerDeal(eg, deu, deal(ita, [promise(pl)]), tick)).toBe(
      "promise_bad_target",
    );
    // The Soviet pact with Poland.
    expect(
      offerDeal(eg, deu, deal(sun, [promise(pl)], [joinWar(w, pl)]), tick),
    ).toBe("promise_bad_target");
    // A democracy under 50% world tension.
    ww.politics.country(fra)!.ruling = IDEO_DEM;
    ww.politics.wtBp = 1000;
    expect(
      offerDeal(eg, deu, deal(fra, [promise(pl)], [joinWar(w, pl)]), tick),
    ).toBe("tension_gate");
    expect(
      offerDeal(eg, deu, deal(ita, [promise(pl)], [joinWar(w, pl)]), tick),
    ).toBeNull();
  });

  test("accepted: the receiver joins the promiser's side with a claim goal used; the promise is kept on record", async () => {
    const t = await started(ITA_HUMAN);
    const { g, ww, eg } = t;
    const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
    const w = war(g, ww);
    const tension = ww.politics.threatBp[ita];
    const faction = ww.politics.factionIdx(ita);
    const dealId = promised(t, w);
    expect(ww.isAtWar(ita, pl)).toBe(true);
    const rec = eg.war(w)!;
    expect(eg.sideIndex(rec, ita)).toBe(eg.sideIndex(rec, deu));
    // Its side, not its faction.
    expect(ww.politics.factionIdx(ita)).toBe(faction);
    // The declaration used its granted goal: claim tension, no goal left.
    expect(ww.politics.country(ita)!.warGoals.some((x) => x.on === pl)).toBe(
      false,
    );
    expect(ww.politics.threatBp[ita]).toBeGreaterThan(tension);
    expect(eg.promises).toEqual([
      {
        id: dealId,
        war: w,
        from: deu,
        to: ita,
        target: pl,
        group: "east_poland",
        regions: [KRAKOW],
      },
    ]);
    // The group is promised once.
    expect(
      offerDeal(
        eg,
        id("FRA"),
        deal(ita, [promise(pl)], [joinWar(w, pl)]),
        g.ticks(),
      ),
    ).not.toBeNull();
  });

  test("the AI's values: a wanted promise, the join's cost and veto, a new ally, the promiser's own core", async () => {
    const t = await started();
    const { g, ww, eg } = t;
    const [deu, ita, pl, gbr] = [id("DEU"), id("ITA"), id("POL"), id("GBR")];
    const w = war(g, ww);
    const base = Math.max(1, regionBase(eg, KRAKOW));
    // Italy claims it: twice its value; Britain neither claims nor borders it.
    expect(promiseItemValue(eg, deu, ita, promise(pl), ita)).toBe(2 * base);
    expect(promiseItemValue(eg, deu, gbr, promise(pl), gbr)).toBe(0);
    // To the promiser: half; its own core never.
    expect(promiseItemValue(eg, deu, ita, promise(pl), deu)).toBe(
      -Math.floor(base / 2),
    );
    eg.addCore(deu, KRAKOW);
    expect(promiseItemValue(eg, deu, ita, promise(pl), deu)).toBe(WW_DEAL_VETO);
    // Joining: never under 40% war support; the ally's worth to the side.
    const c = ww.politics.country(ita)!;
    c.wsBp = 3900;
    expect(promiseItemValue(eg, ita, deu, joinWar(w, pl), ita)).toBe(
      WW_DEAL_VETO,
    );
    c.wsBp = 9000;
    const v = promiseItemValue(eg, ita, deu, joinWar(w, pl), ita);
    expect([WW_DEAL_VETO, -WW_PROMISE_JOIN_PTS]).toContain(v);
    expect(promiseItemValue(eg, ita, deu, joinWar(w, pl), deu)).toBe(
      ww.land.rowsOf(ita).length > 0 ? WW_PROMISE_ALLY_PTS : 0,
    );
  });

  test("the conference hands the promised land to its receiver first, at the promiser's points", async () => {
    const t = await started(ITA_HUMAN);
    const { runner, g, ww, eg } = t;
    const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
    const w = war(g, ww);
    promised(t, w);
    const shown = notices(g);
    addWarScore(eg, w, deu, 8000);
    addWarScore(eg, w, ita, 2000);
    ww.land.setController(WARSAW, deu, g.ticks());
    ww.land.setController(KRAKOW, deu, g.ticks());
    const before = eg.conferences.length;
    capitulate(g, ww, player(g, "POL"), g.ticks());
    const c = eg.conferences[before];
    expect(c.losers).toEqual([pl]);
    expect(eg.promises).toEqual([]);
    const row = c.settled.find((s) => s.beneficiary === ita)!;
    expect(row).toMatchObject({
      by: deu,
      regions: [KRAKOW],
      round: 0,
      beneficiary: ita,
    });
    expect(row.cost).toBeGreaterThan(0);
    expect(shown("ww1936_promise_kept")).toBe(1);
    // Italy passes every round: the treaty gives Krakow to Italy.
    for (let i = 0; i < 20 && c.status !== 2; i++) {
      step(runner, 2, [order(HUMAN, { kind: "peace_pass", conf: c.id })]);
    }
    expect(c.status).toBe(2);
    expect(ww.politics.legalOwner[KRAKOW]).toBe(ita);
  });

  test("a promise lapses when its promiser leaves the war", async () => {
    const t = await started(ITA_HUMAN);
    const { g, ww, eg } = t;
    const deu = id("DEU");
    const w = war(g, ww);
    promised(t, w);
    const shown = notices(g);
    const day = ww.day(g.ticks());
    checkWarEnds(eg, day, g.ticks());
    expect(eg.promises).toHaveLength(1);
    eg.setMemberState(w, deu, "left");
    checkWarEnds(eg, day, g.ticks());
    expect(eg.promises).toEqual([]);
    expect(shown("ww1936_promise_lapsed")).toBe(1);
  });

  test("a whole-war white peace lapses it", async () => {
    const t = await started(ITA_HUMAN);
    const { g, ww, eg } = t;
    const w = war(g, ww);
    promised(t, w);
    const shown = notices(g);
    eg.war(w)!.ended = { day: ww.day(g.ticks()), winner: -1 };
    checkWarEnds(eg, ww.day(g.ticks()), g.ticks());
    expect(eg.promises).toEqual([]);
    expect(shown("ww1936_promise_lapsed")).toBe(1);
  });

  test("an AI side leader promises a neutral that claims the enemy's land, once every 180 days", async () => {
    const t = await started(ITA_HUMAN);
    const { g, ww, eg } = t;
    const [deu, ita, pl, sun] = [id("DEU"), id("ITA"), id("POL"), id("SUN")];
    const w = war(g, ww);
    // Poland gets the Soviets beside it: Germany is not clearly winning.
    ww.setWar(sun, deu, g.ticks(), { kind: "into", warId: w });
    const day =
      (WW_PROMISE_AI_CHECK_DAYS - (deu % WW_PROMISE_AI_CHECK_DAYS)) %
      WW_PROMISE_AI_CHECK_DAYS;
    aiPromiseDay(eg, deu, day + 1, g.ticks()); // not its day
    expect(eg.deals).toEqual([]);
    aiPromiseDay(eg, deu, day, g.ticks());
    expect(eg.deals).toHaveLength(1);
    const o = eg.deals[0];
    expect([o.from, o.to, o.give, o.take]).toEqual([
      deu,
      ita,
      [promise(pl)],
      [joinWar(w, pl)],
    ]);
    expect(
      eg.diploCooldowns.find(
        (c) =>
          c[0] === deu &&
          c[1] === ita &&
          c[3] === DIPLO_COOLDOWN_KINDS.indexOf("ai_promise"),
      )?.[2],
    ).toBe(day + WW_PROMISE_AI_DAYS);
  });

  test("a kept promise restores in lockstep", async () => {
    const t = await started(ITA_HUMAN);
    const { runner, g, ww, eg } = t;
    promised(t, war(g, ww));
    step(runner);
    const copy = await wwRestore(runner, ITA_HUMAN, END_MAP);
    const ceg: WwEndgame = copy.game.worldWar()!.endgame;
    expect(ceg.promises).toEqual(eg.promises);
    expect(ceg.hash()).toBe(eg.hash());
    step(runner, 3);
    step(copy, 3);
    expect(ceg.hash()).toBe(eg.hash());
  });
});
