// World War 1936 final review A, finding 3: the depth state the hash left
// out (raids, the nuke and rocket queues, the market, projects, MIO
// choices, intel levels, the energy extra) and WorldWar's transfers and
// last day are folded, so a desync there shows on the tick it happens.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936: every depth field is in the hash", () => {
  it("changing each field changes the hash, and undoing it restores it", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww: WorldWar = runner.game.worldWar()!;
    const d = ww.depth;
    const deu = d.country(DEEP.tag.DEU)!;
    const ita = DEEP.tag.ITA;
    const ger = DEEP.tag.DEU;
    const checked: string[] = [];
    const changes = (label: string, mutate: () => void, undo: () => void) => {
      const before = ww.hash();
      mutate();
      expect(ww.hash(), `${label} changes the hash`).not.toBe(before);
      undo();
      expect(ww.hash(), `${label} undone`).toBe(before);
      checked.push(label);
    };
    // A row in each list, then one field of that row.
    const raid = {
      uid: 901,
      owner: ger,
      kind: 0,
      unit: 1,
      target: DEEP.region.paris,
      building: 0,
      readyDay: 40,
    };
    changes(
      "raids",
      () => d.raids.push(raid),
      () => d.raids.pop(),
    );
    d.raids.push(raid);
    changes(
      "raid ready day",
      () => (raid.readyDay = 41),
      () => (raid.readyDay = 40),
    );
    d.raids.pop();
    changes(
      "nuke queue",
      () =>
        d.nukeQueue.push({
          owner: ger,
          region: DEEP.region.paris,
          zone: 0,
          rocket: false,
          day: 50,
        }),
      () => d.nukeQueue.pop(),
    );
    changes(
      "rocket queue",
      () =>
        d.rocketQueue.push({
          owner: ger,
          site: DEEP.region.berlin,
          target: DEEP.region.paris,
          kind: 0,
          count: 3,
          day: 50,
        }),
      () => d.rocketQueue.pop(),
    );
    const listing = {
      id: 77,
      seller: ger,
      key: 1,
      design: null,
      count: 500,
      reserved: 0,
    };
    changes(
      "market listing",
      () => d.market.listings.push(listing),
      () => d.market.listings.pop(),
    );
    d.market.listings.push(listing);
    changes(
      "listing count",
      () => (listing.count = 499),
      () => (listing.count = 500),
    );
    changes(
      "listing design",
      () => ((listing as { design: unknown }).design = TEST_TANK),
      () => (listing.design = null),
    );
    d.market.listings.pop();
    const deal = {
      id: 78,
      buyer: ita,
      seller: ger,
      key: 1,
      design: null,
      count: 100,
      priceMilli: 5_000,
      paidMilli: 0,
      deliveredMilli: 0,
      civs: 1,
      startDay: 10,
      endDay: 40,
    };
    changes(
      "market deal",
      () => d.market.deals.push(deal),
      () => d.market.deals.pop(),
    );
    d.market.deals.push(deal);
    changes(
      "deal paid",
      () => (deal.paidMilli = 1),
      () => (deal.paidMilli = 0),
    );
    changes(
      "deal delivered",
      () => (deal.deliveredMilli = 1),
      () => (deal.deliveredMilli = 0),
    );
    d.market.deals.pop();
    const licence = {
      id: 79,
      from: ger,
      to: ita,
      key: 1,
      ship: -1,
      slot: 0,
      sinceDay: 5,
    };
    changes(
      "licence",
      () => d.market.licences.push(licence),
      () => d.market.licences.pop(),
    );
    d.market.licences.push(licence);
    changes(
      "licence since",
      () => (licence.sinceDay = 6),
      () => (licence.sinceDay = 5),
    );
    d.market.licences.pop();
    changes(
      "pending licence",
      () =>
        d.market.pending.push({
          id: 80,
          from: ger,
          to: ita,
          key: 1,
          ship: -1,
          deadlineTick: 9_000,
        }),
      () => d.market.pending.pop(),
    );
    // Projects: done bits, scientists, atomic labs, blueprints, halved.
    const p = deu.proj;
    const done = p.done;
    changes(
      "project done bit",
      () => (p.done = done | 4),
      () => (p.done = done),
    );
    const sci = { id: 501, spec: 0, skill: 2, sinceDay: 3, project: -1 };
    changes(
      "scientist",
      () => p.scientists.push(sci),
      () => p.scientists.pop(),
    );
    p.scientists.push(sci);
    changes(
      "scientist skill",
      () => (sci.skill = 3),
      () => (sci.skill = 2),
    );
    p.scientists.pop();
    changes(
      "atomic lab",
      () => p.atomic.push([DEEP.region.berlin, 2]),
      () => p.atomic.pop(),
    );
    const bp = p.blueprints;
    changes(
      "blueprints",
      () => (p.blueprints = bp + 1),
      () => (p.blueprints = bp),
    );
    // MIO choices.
    for (const field of ["arch", "traits", "investReady"] as const) {
      const xs = deu.mio[field];
      if (xs.length === 0) xs.push(0);
      const v = xs[0];
      changes(
        `mio ${field}`,
        () => (xs[0] = v + 1),
        () => (xs[0] = v),
      );
    }
    // Intel levels (mixIntel) and the energy extra.
    const k = (ger * d.cap + ita) * 4;
    const lv = d.intelLevels[k];
    changes(
      "intel level",
      () => (d.intelLevels[k] = lv === 0 ? 1 : lv - 1),
      () => (d.intelLevels[k] = lv),
    );
    const extra = deu.mech.energyExtra;
    changes(
      "energy extra",
      () => (deu.mech.energyExtra = extra + 7),
      () => (deu.mech.energyExtra = extra),
    );
    // WorldWar's own: the transfers under way and the last day run.
    changes(
      "transfer",
      () => ww.queueTransfer(ger, ita, Uint32Array.from([5, 6, 7])),
      () => ww.transfers().pop(),
    );
    ww.queueTransfer(ger, ita, Uint32Array.from([5, 6, 7]));
    const t = ww.transfers()[ww.transfers().length - 1];
    changes(
      "transfer cursor",
      () => (t.next = 1),
      () => (t.next = 0),
    );
    ww.transfers().pop();
    const last = ww.lastDay();
    changes(
      "last day",
      () => ww.setLastDay(last + 1),
      () => ww.setLastDay(last),
    );
    expect(checked).toHaveLength(26);
  });
});
