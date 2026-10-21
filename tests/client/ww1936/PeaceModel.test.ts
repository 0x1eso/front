// World War 1936 P5 (plan Task 9, spec §20.1): the peace conference card's
// model — its prices are the engine's (engine-lib EndgameRules over the
// inputs the conference view carries), its points left subtract the draft,
// and a demand the engine would refuse carries the reason.
import type {
  WwConferenceView,
  WwDemandView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  AGG_PCT,
  aggregateCost,
  demandCost,
  dismantleCost,
  maxReparations,
  reparationsCost,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { describe, expect, it } from "vitest";
import {
  PEACE_WHY,
  PeaceModel,
  type PeaceWorld,
} from "../../../src/client/hud/ww1936/PeaceModel";

// The test map's ids (EconomyFixture): DEU 2, POL 4, ITA 3; Warsaw 6, Krakow 7.
const DEU = 2;
const ITA = 3;
const POL = 4;
const WARSAW = 6;
const KRAKOW = 7;

function conference(over: Partial<WwConferenceView> = {}): WwConferenceView {
  return {
    id: 1,
    losers: [POL],
    status: "open",
    round: 1,
    roundEndTick: 900,
    participants: [
      { id: DEU, pts: 100, sharePm: 700, order: 0, human: true, final: false },
      { id: ITA, pts: 40, sharePm: 300, order: 1, human: false, final: false },
    ],
    stake: [
      { region: WARSAW, base: 40, settledBy: 0, zone: false },
      { region: KRAKOW, base: 30, settledBy: 0, zone: false },
    ],
    mine: [{ id: DEU, submitted: null, ai: [] }],
    lastRound: [],
    releasable: [],
    claims: [],
    conquer: [],
    topple: [],
    reserved: [],
    ...over,
  };
}

/** Poland's land, Germany holding Warsaw; `over` changes any fact. */
function world(over: Partial<PeaceWorld> = {}): PeaceWorld {
  const ctrl: Record<number, number> = { [WARSAW]: DEU, [KRAKOW]: POL };
  return {
    controller: (r) => ctrl[r] ?? 0,
    legalOwner: (r) => (r === WARSAW || r === KRAKOW ? POL : 0),
    hasCore: (id, r) => id === POL && (r === WARSAW || r === KRAKOW),
    neighbours: (r) =>
      r === WARSAW ? [KRAKOW, 3] : r === KRAKOW ? [WARSAW] : [],
    regionCivs: (r) => (r === WARSAW || r === KRAKOW ? 6 : 0),
    ledFactionSize: () => 0,
    ships: () => [],
    smallIdOf: () => 0,
    tagOf: () => null,
    ...over,
  };
}

const take = (region: number, slot = 0): WwDemandView => ({
  kind: "take",
  slot,
  regions: [region],
  target: 0,
  beneficiary: 0,
  k: 0,
  pct: 0,
  cost: 0,
});

const onCountry = (
  kind: WwDemandView["kind"],
  target: number,
  over: Partial<WwDemandView> = {},
): WwDemandView => ({ ...take(0), regions: [], kind, target, ...over });

describe("World War 1936 P5: the peace conference model", () => {
  it("preview cost matches the engine formula", () => {
    const m = new PeaceModel(
      conference({ claims: [[DEU, KRAKOW]], conquer: [[DEU, POL]] }),
      world(),
    );
    // Warsaw: Germany controls it and has a conquer goal on Poland.
    const warsaw = demandCost(40, {
      controls: true,
      core: false,
      claim: false,
      conquerGoal: true,
      otherControls: false,
    });
    // Krakow: a claim and the conquer goal, Poland still holds it.
    const krakow = demandCost(30, {
      controls: false,
      core: false,
      claim: true,
      conquerGoal: true,
      otherControls: false,
    });
    expect(m.previewCost(DEU, take(WARSAW))).toBe(warsaw);
    expect(m.previewCost(DEU, take(KRAKOW))).toBe(krakow);
    expect(m.regionCost(WARSAW, DEU)).toBe(warsaw);
    // A country-wide demand: the percent of the summed region prices.
    expect(m.previewCost(DEU, onCountry("annex_rest", POL))).toBe(
      aggregateCost([warsaw, krakow], AGG_PCT.annex_rest),
    );
    expect(m.previewCost(DEU, onCountry("puppet", POL))).toBe(
      aggregateCost([warsaw, krakow], AGG_PCT.puppet),
    );
    expect(m.previewCost(DEU, onCountry("reparations", POL, { k: 2 }))).toBe(
      reparationsCost(2),
    );
    // Another participant holding the region raises Italy's price.
    const it = m.regionCost(WARSAW, ITA);
    expect(it).toBe(
      demandCost(40, {
        controls: false,
        core: false,
        claim: false,
        conquerGoal: false,
        otherControls: true,
      }),
    );
    expect(m.controlDiscount(WARSAW, DEU)).toBe(true);
    expect(m.controlDiscount(KRAKOW, DEU)).toBe(false);
  });

  it("remaining points subtract the draft", () => {
    const m = new PeaceModel(conference(), world());
    const w = m.regionCost(WARSAW, DEU);
    const k = m.regionCost(KRAKOW, DEU);
    expect(m.remainingPts(DEU, [])).toBe(100);
    expect(m.remainingPts(DEU, [take(WARSAW)])).toBe(100 - w);
    expect(m.remainingPts(DEU, [take(WARSAW), take(KRAKOW, 1)])).toBe(
      100 - w - k,
    );
    // A demand the points can't pay is not taken off.
    const poor = new PeaceModel(
      conference({
        participants: [
          {
            id: DEU,
            pts: w,
            sharePm: 1000,
            order: 0,
            human: true,
            final: false,
          },
        ],
      }),
      world(),
    );
    const rows = poor.evaluate(DEU, [take(WARSAW), take(KRAKOW, 1)]);
    expect(rows.map((e) => e.ok)).toEqual([true, false]);
    expect(rows[1].why).toEqual({ key: PEACE_WHY.score });
    expect(poor.remainingPts(DEU, [take(WARSAW), take(KRAKOW, 1)])).toBe(0);
    // The same region twice is "already demanded".
    const twice = m.evaluate(DEU, [take(WARSAW), take(WARSAW, 1)]);
    expect(twice[1].why).toEqual({ key: PEACE_WHY.used });
    expect(m.remainingPts(DEU, [take(WARSAW), take(WARSAW, 1)])).toBe(100 - w);
  });

  it("blocked country demands give a reason", () => {
    const m = new PeaceModel(
      conference({ reserved: [[KRAKOW, ITA]] }),
      world(),
    );
    const why = (d: WwDemandView, before: WwDemandView[] = []) =>
      m.evaluate(DEU, [...before, d])[before.length].why;
    // Poland leads no faction.
    expect(why(onCountry("dismantle", POL))).toEqual({
      key: PEACE_WHY.faction,
    });
    // Reparations past the loser's limit (a quarter of the civilian
    // factories it keeps: 6 in Warsaw, 6 in Krakow).
    expect(
      why(onCountry("reparations", POL, { k: maxReparations(12) + 1 })),
    ).toEqual({ key: PEACE_WHY.factories });
    // No ships to hand over.
    expect(why(onCountry("take_navy", POL, { pct: 30 }))).toEqual({
      key: PEACE_WHY.ships,
    });
    // A puppet after annexing the rest in the same list.
    expect(
      why(onCountry("puppet", POL), [onCountry("annex_rest", POL)]),
    ).toEqual({ key: PEACE_WHY.bad });
    // A tag the conference can't release: the engine refuses the whole
    // submission (expandPeaceDemand), and the card says so.
    const refused = m.evaluate(
      DEU,
      m.demandRows(DEU, [{ kind: "release", tag: "POL" }]),
    )[0];
    expect(refused.why).toEqual({ key: PEACE_WHY.bad });
    expect(refused.refused).toBe(true);
    expect(m.canRelease("POL", DEU)).toBe(false);
    // No country to free: no capital to release it from.
    expect(why(onCountry("release", POL))).toEqual({
      key: PEACE_WHY.release,
    });
    // A region its controller reserved this round names that country.
    expect(why(take(KRAKOW))).toEqual({
      key: PEACE_WHY.control,
      params: { country: ITA },
    });
    // A region settled in an earlier round.
    const later = new PeaceModel(
      conference({
        round: 2,
        stake: [
          { region: WARSAW, base: 40, settledBy: ITA, zone: false },
          { region: KRAKOW, base: 30, settledBy: 0, zone: false },
        ],
      }),
      world(),
    );
    expect(later.evaluate(DEU, [take(WARSAW)])[0].why).toEqual({
      key: PEACE_WHY.decided,
    });
    // The sixth demand of a round.
    const six = [0, 1, 2, 3, 4, 5].map((i) =>
      onCountry("reparations", POL, { k: 1, slot: i }),
    );
    expect(m.evaluate(DEU, six)[5].why).toEqual({
      key: PEACE_WHY.slots,
      params: { max: 5 },
    });
    // A faction leader can be dismantled at the engine's price.
    const leader = new PeaceModel(
      conference(),
      world({ ledFactionSize: (id) => (id === POL ? 3 : 0) }),
    );
    const ok = leader.evaluate(DEU, [onCountry("dismantle", POL)])[0];
    expect(ok.why).toBeNull();
    expect(ok.view.cost).toBe(dismantleCost(3));
  });
});
