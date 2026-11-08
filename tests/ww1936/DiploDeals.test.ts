// World War 1936 diplomacy D3 (ww161 Design B §3; ww162 lane L2): the deal
// table. The pure rules (shape, margin, chance); a gift applies at once; an
// AI target judges by value points (vetoing peacetime cessions except to its
// overlord); a refusal's wait and the one-pending-deal rule; a human's card
// (its deadline, the queue behind another card, the auto switch, a lapse at
// accept); each item (the ally-to-ally transfer in wartime, the equipment
// lump, lend-lease for its months, treaties); the AI side leader's
// transfers; the composer's hint rows; a restore in lockstep. End map.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { DealItem } from "@openfront/engine-api/ww1936/DiploTypes";
import {
  DIPLO_COOLDOWN_KINDS,
  WW_DEAL_CARD_TICKS,
  WW_DEAL_PP,
  WW_DEAL_REFUSAL_DAYS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_LL_LAND_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dealAcceptPct,
  dealMargin,
  dealShapeBlock,
  isGift,
  WW_DEAL_ROLL_BAND,
  WW_DEAL_VETO,
} from "@openfront/engine-lib/ww1936/DiploRules";
import type { Game } from "@openfront/engine/game/Game";
import {
  aiDealDay,
  dealItemBlock,
  dealJudgeData,
  dealMoodOf,
  dealNet,
  offerDeal,
  replyDeal,
  stepDeals,
  WW_DEAL_AI_CHECK_DAYS,
} from "@openfront/engine/ww1936/endgame/Deals";
import {
  diploCooldownUntil,
  setDiploCooldown,
} from "@openfront/engine/ww1936/endgame/DiploState";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { aiAcceptScore } from "@openfront/engine/ww1936/politics/AiPolitics";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { addOpinion } from "@openfront/engine/ww1936/politics/Treaties";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  HUMAN,
  order,
  step,
  stepTo,
  takeRegion,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const [LYON, MUNICH, WARSAW, KRAKOW] = [2, 4, 6, 7];
const INF = equipKey("infantry_equipment", 1);

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  for (let x = 1; x < ww.endgame.size; x++) {
    const c = ww.politics.country(x);
    if (c !== null) c.ppMilli = 100_000;
  }
  return { runner, g, ww, eg: ww.endgame };
}

const deal = (to: number, give: DealItem[], take: DealItem[] = []) => ({
  kind: "deal_offer" as const,
  to,
  give,
  take,
});
const region = (r: number): DealItem => ({ kind: "region", region: r });
const equipment = (count: number): DealItem => ({
  kind: "equipment",
  key: INF,
  count,
});

/** A war `a` → `b`; `allies` join on `a`'s side. */
function war(
  g: Game,
  ww: WorldWar,
  a: number,
  b: number,
  allies: number[] = [],
) {
  ww.setWar(a, b, g.ticks(), { kind: "declare" });
  for (const x of allies)
    ww.setWar(x, b, g.ticks(), { kind: "into", warId: 0 });
}

const kindIdx = (k: (typeof DIPLO_COOLDOWN_KINDS)[number]) =>
  DIPLO_COOLDOWN_KINDS.indexOf(k);

describe("diplomacy D3: the rules", () => {
  test("the shape: not empty, no item twice, a region or a pact in one list only", () => {
    expect(dealShapeBlock([], [])).toBe("deal_empty");
    expect(dealShapeBlock([region(2)], [region(3)])).toBeNull();
    expect(dealShapeBlock([region(2), region(2)], [])).toBe("deal_bad_item");
    expect(dealShapeBlock([region(2)], [region(2)])).toBe("deal_bad_item");
    expect(dealShapeBlock([{ kind: "nap" }], [{ kind: "nap" }])).toBe(
      "deal_bad_item",
    );
    expect(dealShapeBlock([{ kind: "access" }], [{ kind: "access" }])).toBe(
      null,
    );
  });

  test("the margin, the chance and a gift", () => {
    expect(dealMargin({ opinion: 0, sameIdeology: true, leader: false })).toBe(
      5,
    );
    expect(
      dealMargin({ opinion: -35, sameIdeology: false, leader: false }),
    ).toBe(5 + 4 + 5);
    expect(dealMargin({ opinion: 60, sameIdeology: true, leader: true })).toBe(
      0,
    );
    expect(dealAcceptPct(5 + WW_DEAL_ROLL_BAND, 5, false)).toBe(100);
    expect(dealAcceptPct(5, 5, false)).toBe(50);
    expect(dealAcceptPct(5 - WW_DEAL_ROLL_BAND - 1, 5, false)).toBe(0);
    expect(dealAcceptPct(0, 5, true)).toBe(100);
    expect(dealAcceptPct(WW_DEAL_VETO, 0, false)).toBe(0);
    expect(isGift([region(2)], [])).toBe(true);
    expect(isGift([{ kind: "nap" }], [])).toBe(false);
    expect(isGift([region(2)], [region(3)])).toBe(false);
  });
});

describe("diplomacy D3: the deal table", { timeout: 120_000 }, () => {
  test("a gift applies at once: the region's legal owner and control move, 10 PP paid", async () => {
    const { ww, eg, g } = await started();
    const [fra, ita] = [id("FRA"), id("ITA")];
    expect(offerDeal(eg, fra, deal(ita, [region(LYON)]), g.ticks())).toBeNull();
    expect(eg.deals).toEqual([]);
    expect(ww.politics.legalOwner[LYON]).toBe(ita);
    expect(ww.land.controller[LYON]).toBe(ita);
    expect(ww.politics.country(fra)!.ppMilli).toBe(100_000 - WW_DEAL_PP * 1000);
    // The capital never; land the giver doesn't own never.
    expect(offerDeal(eg, fra, deal(ita, [region(1)]), g.ticks())).toBe(
      "peace_capital",
    );
    expect(offerDeal(eg, fra, deal(ita, [region(MUNICH)]), g.ticks())).toBe(
      "deal_bad_item",
    );
  });

  test("an AI vetoes a peacetime cession, its proposer waits 30 days; one pending deal a pair", async () => {
    const { runner, ww, eg, g } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    ww.economy.country(deu)!.stock[INF] = 100_000;
    const ask = deal(pl, [equipment(20_000)], [region(KRAKOW)]);
    expect(dealNet(eg, deu, pl, ask.give, ask.take)).toBe(WW_DEAL_VETO);
    expect(offerDeal(eg, deu, ask, g.ticks())).toBeNull();
    expect(eg.deals).toHaveLength(1);
    expect(offerDeal(eg, pl, deal(deu, [{ kind: "access" }]), g.ticks())).toBe(
      "deal_pending",
    );
    const day = ww.day(g.ticks());
    step(runner);
    expect(eg.deals).toEqual([]);
    expect(ww.politics.legalOwner[KRAKOW]).toBe(pl);
    expect(ww.economy.country(deu)!.stock[INF]).toBe(100_000);
    expect(diploCooldownUntil(eg, deu, pl, "deal_refused")).toBe(
      day + WW_DEAL_REFUSAL_DAYS,
    );
    expect(offerDeal(eg, deu, ask, g.ticks())).toBe("deal_cooldown");
  });

  test("a subject cedes non-core land to its overlord for a price; to anyone else never", async () => {
    const { runner, ww, eg, g } = await started();
    const [deu, pl, fra, ita] = [id("DEU"), id("POL"), id("FRA"), id("ITA")];
    // Poland gets Lyon (no core comes with a cession).
    offerDeal(eg, fra, deal(pl, [region(LYON)]), g.ticks());
    expect(ww.politics.legalOwner[LYON]).toBe(pl);
    makeSubject(eg, pl, deu, "puppet", false, g.ticks());
    for (const x of [deu, ita]) ww.economy.country(x)!.stock[INF] = 100_000;
    const ask = (to: number) => deal(to, [equipment(20_000)], [region(LYON)]);
    expect(dealNet(eg, ita, pl, ask(pl).give, ask(pl).take)).toBe(WW_DEAL_VETO);
    const net = dealNet(eg, deu, pl, ask(pl).give, ask(pl).take);
    expect(net).toBeGreaterThan(
      dealMargin(dealMoodOf(eg, pl, deu)) + WW_DEAL_ROLL_BAND,
    );
    expect(offerDeal(eg, deu, ask(pl), g.ticks())).toBeNull();
    step(runner);
    expect(ww.politics.legalOwner[LYON]).toBe(deu);
    expect(ww.economy.country(deu)!.stock[INF]).toBe(80_000);
    expect(eg.inTransit.some((t) => t.from === deu && t.to === pl)).toBe(true);
  });

  test("in wartime land the giver holds goes to an ally on its side: control only, the enemy's capital never", async () => {
    const { ww, eg, g } = await started();
    const [deu, ita, pl, aut] = [id("DEU"), id("ITA"), id("POL"), id("AUT")];
    war(g, ww, deu, pl, [ita]);
    takeRegion(g, KRAKOW, "DEU");
    takeRegion(g, WARSAW, "DEU");
    expect(offerDeal(eg, deu, deal(aut, [region(KRAKOW)]), g.ticks())).toBe(
      "deal_bad_item",
    );
    expect(offerDeal(eg, deu, deal(ita, [region(WARSAW)]), g.ticks())).toBe(
      "peace_capital",
    );
    expect(
      offerDeal(eg, deu, deal(ita, [region(KRAKOW)]), g.ticks()),
    ).toBeNull();
    expect(ww.land.controller[KRAKOW]).toBe(ita);
    expect(ww.politics.legalOwner[KRAKOW]).toBe(pl);
  });

  test("the AI side leader hands an ally the occupied land that is its core", async () => {
    const { ww, eg, g } = await started();
    const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
    war(g, ww, deu, pl, [ita]);
    takeRegion(g, KRAKOW, "DEU");
    eg.addCore(ita, KRAKOW);
    const day =
      (WW_DEAL_AI_CHECK_DAYS - (deu % WW_DEAL_AI_CHECK_DAYS)) %
      WW_DEAL_AI_CHECK_DAYS;
    aiDealDay(eg, deu, day + 1, g.ticks()); // not its day
    expect(ww.land.controller[KRAKOW]).toBe(deu);
    aiDealDay(eg, deu, day, g.ticks());
    expect(ww.land.controller[KRAKOW]).toBe(ita);
  });

  test("an AI that plain access would not get offers equipment for it", async () => {
    const { ww, eg, g } = await started();
    const pol = ww.politics;
    const econ = ww.economy;
    // Any X bordering x bordering t, X not bordering t, no faction between.
    let found: [number, number, number] | null = null;
    for (let X = 1; X < eg.size && found === null; X++) {
      if (!eg.isActor(X)) continue;
      const mine = econ.countryNeighbours(X);
      for (const x of mine) {
        if (!eg.isActor(x) || pol.sameFaction(X, x)) continue;
        const t = econ
          .countryNeighbours(x)
          .find((y) => y !== X && !mine.includes(y) && eg.isActor(y));
        if (t !== undefined) {
          found = [X, x, t];
          break;
        }
      }
    }
    expect(found).not.toBeNull();
    const [X, x, t] = found!;
    war(g, ww, X, t);
    // Its opinion of X puts the plain ask's score just under the ask's 50.
    let score = aiAcceptScore(pol, "access", X, x);
    addOpinion(pol, X, x, (40 - score) * 2, 365);
    score = aiAcceptScore(pol, "access", X, x);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(50);
    econ.country(X)!.stock[INF] = 1_000_000;
    const day =
      (WW_DEAL_AI_CHECK_DAYS - (X % WW_DEAL_AI_CHECK_DAYS)) %
      WW_DEAL_AI_CHECK_DAYS;
    aiDealDay(eg, X, day, g.ticks());
    expect(eg.deals).toHaveLength(1);
    const o = eg.deals[0];
    expect([o.from, o.to, o.take]).toEqual([X, x, [{ kind: "access" }]]);
    expect(o.give[0]).toMatchObject({ kind: "equipment", key: INF });
    // Sized to clear its margin: the AI takes it.
    expect(dealNet(eg, X, x, o.give, o.take)).toBeGreaterThanOrEqual(
      dealMargin(dealMoodOf(eg, x, X)) + WW_DEAL_ROLL_BAND,
    );
    expect(diploCooldownUntil(eg, X, x, "ai_deal")).toBe(day + 90);
  });

  test("a human's card: its deadline, the second waits its turn, a reply by order, the auto switch", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { runner, ww, eg, g } = await started(humans);
    const [fra, deu, ita, est] = [id("FRA"), id("DEU"), id("ITA"), id("EST")];
    const tick = g.ticks();
    expect(
      offerDeal(
        eg,
        deu,
        deal(fra, [{ kind: "access" }], [{ kind: "nap" }]),
        tick,
      ),
    ).toBeNull();
    expect(
      offerDeal(
        eg,
        ita,
        deal(fra, [{ kind: "access" }], [{ kind: "nap" }]),
        tick,
      ),
    ).toBeNull();
    const [first, second] = eg.deals;
    expect(first.deadlineTick).toBe(tick + WW_DEAL_CARD_TICKS);
    expect(second.deadlineTick).toBe(-1);
    stepTo(runner, first.deadlineTick + 1);
    // The first ran out (refused); the second is in front with its full window.
    expect(eg.deals.map((o) => o.id)).toEqual([second.id]);
    expect(diploCooldownUntil(eg, deu, fra, "deal_refused")).toBeGreaterThan(0);
    expect(eg.deals[0].deadlineTick).toBe(
      first.deadlineTick + WW_DEAL_CARD_TICKS,
    );
    step(runner, 2, [
      order(HUMAN, { kind: "deal_reply", offer: second.id, accept: true }),
    ]);
    expect(eg.deals).toEqual([]);
    expect(ww.politics.isAtWarBlockedByNap(ita, fra)).toBe(true);
    expect(ww.politics.hasAccess(fra, ita)).toBe(true);
    // With the diplomacy switch on, its AI answers at once: no card.
    ww.setAuto(fra, "diplomacy", true);
    expect(
      offerDeal(
        eg,
        est,
        deal(fra, [{ kind: "access" }], [{ kind: "nap" }]),
        g.ticks(),
      ),
    ).toBeNull();
    step(runner);
    expect(eg.deals).toEqual([]);
  });

  test("an item no longer valid at accept lapses the deal", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { ww, eg, g } = await started(humans);
    const [fra, deu, ita] = [id("FRA"), id("DEU"), id("ITA")];
    offerDeal(
      eg,
      deu,
      deal(fra, [region(MUNICH)], [{ kind: "nap" }]),
      g.ticks(),
    );
    const o = eg.deals[0];
    ww.politics.setLegalOwner(MUNICH, ita);
    expect(replyDeal(eg, fra, o.id, true, g.ticks())).toBe("deal_lapsed");
    expect(eg.deals).toEqual([]);
    expect(ww.politics.isAtWarBlockedByNap(deu, fra)).toBe(false);
    expect(replyDeal(eg, fra, o.id, true, g.ticks())).toBe("deal_no_offer");
  });

  test("an equipment lump goes by land; lend-lease runs its months, then ends", async () => {
    const { ww, eg, g } = await started();
    const [deu, pl, sun] = [id("DEU"), id("POL"), id("SUN")];
    ww.economy.country(deu)!.stock[INF] = 1_000;
    const day = ww.day(g.ticks());
    expect(
      offerDeal(eg, deu, deal(pl, [equipment(400)]), g.ticks()),
    ).toBeNull();
    expect(ww.economy.country(deu)!.stock[INF]).toBe(600);
    expect(
      eg.inTransit.find((t) => t.from === deu && t.to === pl),
    ).toMatchObject({
      contract: 0,
      countMilli: 400_000,
      arriveDay: day + WW_LL_LAND_DAYS,
    });
    // Lend-lease needs the receiver at war in peacetime.
    const ll: DealItem = {
      kind: "lend_lease",
      item: "infantry_equipment",
      gen: 0,
      perMonth: 100,
      months: 2,
    };
    expect(dealItemBlock(eg, deu, pl, ll, day)).not.toBeNull();
    war(g, ww, sun, pl);
    expect(offerDeal(eg, deu, deal(pl, [ll]), g.ticks())).toBeNull();
    const c = eg.lendLease.find((x) => x.from === deu && x.to === pl)!;
    expect(c.perMonth).toBe(100);
    expect(
      eg.diploCooldowns.find((t) => t[3] === kindIdx("deal_lend_lease")),
    ).toEqual([deu, c.id, day + 61, kindIdx("deal_lend_lease")]);
    stepDeals(eg, g.ticks());
    expect(eg.lendLease.some((x) => x.id === c.id)).toBe(true);
    // Its last day comes.
    setDiploCooldown(eg, deu, c.id, "deal_lend_lease", day + 1);
    stepDeals(eg, g.ticks());
    expect(eg.lendLease.some((x) => x.id === c.id)).toBe(false);
  });

  test("the composer's rows: each AI country's margin toward the human, sent when changed", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { eg } = await started(humans);
    const fra = id("FRA");
    const rows = dealJudgeData(eg, true)!;
    const deu = rows.find((r) => r.to === id("DEU"))!;
    expect(deu.from).toBe(fra);
    expect(deu.margin).toBe(dealMargin(dealMoodOf(eg, id("DEU"), fra)));
    expect(rows.some((r) => r.to === fra)).toBe(false);
    expect(dealJudgeData(eg, false)).toBeNull();
  });

  test("a pending card and a deal's lend-lease timer restore in lockstep", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { runner, eg, g } = await started(humans);
    const [fra, deu] = [id("FRA"), id("DEU")];
    offerDeal(
      eg,
      deu,
      deal(fra, [{ kind: "access" }], [{ kind: "nap" }]),
      g.ticks(),
    );
    step(runner);
    const copy = await wwRestore(runner, humans, END_MAP);
    const ceg: WwEndgame = copy.game.worldWar()!.endgame;
    expect(ceg.deals).toEqual(eg.deals);
    expect(ceg.hash()).toBe(eg.hash());
    step(runner, 3);
    step(copy, 3);
    expect(ceg.hash()).toBe(eg.hash());
  });
});
