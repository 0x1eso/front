// World War 1936 P5 lane X (plan Task 5 Step 6, spec §11): a human whose
// country fell takes over an AI country of its faction, or watches.
import { WW_TAKEOVER_CARD_TICKS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  formExile,
  offerTakeover,
  resolveTakeovers,
  takeoverPick,
} from "@openfront/engine/ww1936/endgame/Exile";
import { takeoverCandidates } from "@openfront/engine/ww1936/endgame/Takeover";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { joinFaction } from "@openfront/engine/ww1936/politics/Factions";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, HUMAN, stepTo, WwHuman, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

const HUMAN2 = "HUMAN002";

async function started(humans: WwHuman[]) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

describe("World War 1936 P5: takeover", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));

  it("a human without a host gets a takeover card for same-faction AI countries", async () => {
    const { g, ww } = await started([{ clientID: HUMAN, country: "FRA" }]);
    const eg = ww.endgame;
    const [deu, fra, gbr] = [endId("DEU"), endId("FRA"), endId("GBR")];
    expect(eg.isHumanControlled(fra)).toBe(true);
    const tick = g.ticks();
    // Germany fights France alone: France has no host.
    ww.setWar(deu, fra, tick, { kind: "declare" });
    ww.addCapitulation(fra, deu, tick);
    expect(formExile(eg, fra, deu, tick)).toBe(false);
    expect(takeoverCandidates(eg, fra)).toEqual([gbr]);
    offerTakeover(eg, HUMAN, fra, tick);
    expect(eg.takeoverCards).toEqual([
      {
        client: HUMAN,
        from: fra,
        candidates: [gbr],
        deadlineTick: tick + WW_TAKEOVER_CARD_TICKS,
        pick: 0,
      },
    ]);
    // Only a candidate may be picked.
    expect(takeoverPick(eg, HUMAN, deu, tick)).toBe("no_takeover");
    expect(takeoverPick(eg, "NOBODY01", gbr, tick)).toBe("no_takeover");
  });

  it("the card's first candidate is taken at the deadline", async () => {
    const { runner, g, ww } = await started([
      { clientID: HUMAN, country: "FRA" },
    ]);
    const eg = ww.endgame;
    const [deu, fra, gbr] = [endId("DEU"), endId("FRA"), endId("GBR")];
    const tick = g.ticks();
    ww.setWar(deu, fra, tick, { kind: "declare" });
    ww.addCapitulation(fra, deu, tick);
    offerTakeover(eg, HUMAN, fra, tick);
    const deadline = eg.takeoverCards[0].deadlineTick;
    stepTo(runner, deadline - 1);
    expect(eg.takeoverCards).toHaveLength(1);
    expect(eg.controlledBy(HUMAN)).toBeNull();
    stepTo(runner, deadline + 1);
    expect(eg.takeoverCards).toEqual([]);
    expect(eg.controlledBy(HUMAN)).toBe(gbr);
    expect(eg.isHumanControlled(gbr)).toBe(true);
    expect(eg.isHumanControlled(fra)).toBe(false);
    expect(g.playerByClientID(HUMAN)?.smallID()).toBe(gbr);
  });

  it("with no candidate the human spectates", async () => {
    const { g, ww } = await started([{ clientID: HUMAN, country: "POL" }]);
    const eg = ww.endgame;
    const [deu, pl] = [endId("DEU"), endId("POL")];
    const tick = g.ticks();
    // Poland is in no faction.
    expect(ww.politics.factionIdx(pl)).toBe(-1);
    ww.setWar(deu, pl, tick, { kind: "declare" });
    ww.addCapitulation(pl, deu, tick);
    expect(formExile(eg, pl, deu, tick)).toBe(false);
    offerTakeover(eg, HUMAN, pl, tick);
    expect(eg.takeoverCards).toEqual([]);
    expect(eg.controlledBy(HUMAN)).toBe(0);
    expect(eg.isHumanControlled(pl)).toBe(false);
  });

  it("two humans picking one country: the smaller clientID wins, the other gets the next", async () => {
    const { g, ww } = await started([
      { clientID: HUMAN, country: "FRA" },
      { clientID: HUMAN2, country: "POL" },
    ]);
    const eg = ww.endgame;
    const pol = ww.politics;
    const [fra, pl, gbr, ltu] = ["FRA", "POL", "GBR", "LTU"].map((t) =>
      endId(t as "FRA"),
    );
    const tick = g.ticks();
    // The Allies: France and Poland (humans), Britain and Lithuania (AI).
    const allies = pol.factionIdx(gbr);
    joinFaction(pol, pl, allies, tick);
    joinFaction(pol, ltu, allies, tick);
    expect(takeoverCandidates(eg, fra)).toEqual([gbr, ltu]);
    // Poland's card first: the cards still go in clientID order.
    offerTakeover(eg, HUMAN2, pl, tick);
    offerTakeover(eg, HUMAN, fra, tick);
    expect(eg.takeoverCards.map((c) => c.client)).toEqual([HUMAN, HUMAN2]);
    expect(takeoverPick(eg, HUMAN2, gbr, tick)).toBeNull();
    expect(takeoverPick(eg, HUMAN, gbr, tick)).toBeNull();
    resolveTakeovers(eg, tick);
    expect(eg.controlledBy(HUMAN)).toBe(gbr);
    expect(eg.controlledBy(HUMAN2)).toBe(ltu);
    expect(eg.takeoverCards).toEqual([]);
  });
});
