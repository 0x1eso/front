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
  type PeaceGame,
  peaceMapRegions,
  peaceMapSource,
  peaceMapTap,
  PeaceModel,
  peaceModelOf,
  peaceUiOf,
  type PeaceWorld,
} from "../../../src/client/hud/ww1936/PeaceModel";
import {
  PEACE_DECIDED,
  PEACE_FREE,
  PEACE_LABEL_CELL_PX,
  PEACE_MINE,
  PEACE_OTHER,
  PEACE_SELECTED,
  PEACE_TEX_SIZE,
  peaceDigits,
  peaceLabelCellPx,
  peaceRegionTable,
  peaceTableOffset,
} from "../../../src/client/render/gl/passes/PeaceMapPass";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { fakePolGame } from "./PoliticsFixture";

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

// ---- The conference map mode's data (PeaceMapPass helpers, the map's states, its taps) ----

describe("World War 1936 P5: the conference map mode", () => {
  it("the region table and the price labels", () => {
    expect(peaceTableOffset(7)).toBe(28);
    expect(peaceTableOffset(PEACE_TEX_SIZE + 1)).toBe((PEACE_TEX_SIZE + 1) * 4);
    const t = peaceRegionTable([
      {
        region: 7,
        state: PEACE_MINE | PEACE_SELECTED,
        rgb: 0x123456,
        value: 8,
        x: 0,
        y: 0,
      },
      // Outside the table: skipped.
      { region: 0, state: PEACE_FREE, rgb: 0xffffff, value: 1, x: 0, y: 0 },
      {
        region: PEACE_TEX_SIZE * PEACE_TEX_SIZE,
        state: PEACE_FREE,
        rgb: 0xffffff,
        value: 1,
        x: 0,
        y: 0,
      },
    ]);
    expect([...t.slice(28, 32)]).toEqual([
      0x12,
      0x34,
      0x56,
      PEACE_MINE | PEACE_SELECTED,
    ]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(
      0x12 + 0x34 + 0x56 + (PEACE_MINE | PEACE_SELECTED),
    );
    expect([0, 9, 10, 99, 100, 999, 1000, 123456].map(peaceDigits)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    // Full size from zoom 1.5, half size at the 0.5 threshold.
    expect(peaceLabelCellPx(3)).toBe(PEACE_LABEL_CELL_PX);
    expect(peaceLabelCellPx(1.5)).toBe(PEACE_LABEL_CELL_PX);
    expect(peaceLabelCellPx(0.75)).toBe(PEACE_LABEL_CELL_PX / 2);
    expect(peaceLabelCellPx(0.5)).toBe(PEACE_LABEL_CELL_PX / 2);
  });

  /** Germany (me), Italy and the Soviet Union against Poland; Munich, Warsaw, Krakow and Kiev at stake. */
  function mapGame() {
    const { game: base, land } = fakePolGame({ me: "DEU" });
    const eg = new WwEndgameView();
    const SUN = 5;
    const conf = {
      id: 4,
      losers: [POL],
      status: "open" as const,
      round: 2,
      roundEndTick: 900,
      participants: [DEU, ITA, SUN].map((id, i) => ({
        id,
        pts: 100,
        sharePm: 400 - i * 100,
        order: i,
        human: id === DEU,
        final: false,
      })),
      stake: [
        { region: 4, base: 10, settledBy: 0, zone: false },
        { region: WARSAW, base: 40, settledBy: ITA, zone: false },
        { region: KRAKOW, base: 30, settledBy: 0, zone: false },
        { region: 9, base: 20, settledBy: 0, zone: false },
      ],
      mine: [{ id: DEU, submitted: null, ai: [] }],
      lastRound: [],
      releasable: [],
      claims: [],
      conquer: [],
      topple: [],
      reserved: [],
    };
    eg.apply({ news: [], conference: conf });
    // Italy holds Krakow.
    land.controller[KRAKOW] = ITA;
    const game = { ...base, wwEndgame: () => eg } as unknown as PeaceGame;
    return { game, eg, conf };
  }

  it("the map's states: decided over mine over another participant's control", () => {
    const { game } = mapGame();
    const ui = peaceUiOf(game);
    expect(peaceMapRegions(game)).toEqual([]);
    ui.openMap();
    ui.setDraft([
      { kind: "take", region: WARSAW },
      { kind: "take", region: KRAKOW },
    ]);
    ui.pick(KRAKOW);
    const state = new Map(
      peaceMapRegions(game).map((r) => [r.region, r.state]),
    );
    // Munich: mine to take, nobody's demand (I control it).
    expect(state.get(4)).toBe(PEACE_FREE);
    // Warsaw: settled before, though in my draft.
    expect(state.get(WARSAW)).toBe(PEACE_DECIDED);
    // Krakow: Italy controls it, but it is my demand; and it is the tapped one.
    expect(state.get(KRAKOW)).toBe(PEACE_MINE | PEACE_SELECTED);
    // Kiev: the Soviet Union (a participant) controls it.
    expect(state.get(9)).toBe(PEACE_OTHER);
  });

  it("map taps and the map's key", () => {
    const { game, eg } = mapGame();
    const ui = peaceUiOf(game);
    const src = peaceMapSource(game);
    // Off: the land flow keeps its taps and the map draws nothing.
    expect(peaceMapTap(game, KRAKOW)).toBe(false);
    expect(src.key()).toBe("");
    ui.openMap();
    const k1 = src.key();
    expect(k1).not.toBe("");
    expect(src.key()).toBe(k1);
    // On: a stake region is picked, anywhere else picks nothing.
    expect(peaceMapTap(game, KRAKOW)).toBe(true);
    expect(ui.region).toBe(KRAKOW);
    expect(src.key()).not.toBe(k1);
    expect(peaceMapTap(game, 10)).toBe(true);
    expect(ui.region).toBe(0);
    // One model per conference update.
    expect(peaceModelOf(game)).toBe(peaceModelOf(game));
    // The conference closed: the mode ends and the tap goes back to the land flow.
    eg.apply({ news: [], conference: null });
    expect(peaceMapTap(game, KRAKOW)).toBe(false);
    expect(ui.map).toBe(false);
  });
});
