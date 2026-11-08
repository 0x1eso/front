// w86 (ww86 peace report B6, B8, B9, B11): refused peace orders say why, a
// late or lapsed accept tells the one who tapped it, a truce covers faction
// pulls, and the next waiting offer gets its full window.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_WHITE_PEACE_MIN_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import {
  offerPeace,
  replyPeace,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { joinFaction } from "@openfront/engine/ww1936/politics/Factions";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  dropPact,
  END_MAP,
  HUMAN,
  order,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

afterEach(() => usePoliticsContent(null));

async function endWorld(humans: any[]) {
  usePoliticsContent(endgameFixture());
  const { runner, updates } = await wwRunnerCapture({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { runner, updates, g, ww, eg: ww.endgame };
}

const msgs = (updates: any[], from: number): string[] =>
  updates
    .slice(from)
    .flatMap((u) => u.updates?.[GameUpdateType.DisplayEvent] ?? [])
    .map((e: any) => String(e.message))
    .filter((m) => m.includes("ww1936"));

function oldWar(g: any, ww: any, a: number, b: number): number {
  ww.setWar(a, b, g.ticks(), { kind: "declare" });
  const w = ww.endgame.warOfPair(a, b);
  ww.endgame.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  for (const x of [a, b]) ww.politics.country(x)!.ppMilli = 100_000;
  return w;
}

describe("w86 peace fixes", { timeout: 120000 }, () => {
  it("B6: a refused peace offer tells its sender and costs nothing", async () => {
    const { runner, updates, g, ww, eg } = await endWorld([
      { clientID: HUMAN, country: "DEU" },
    ]);
    const [deu, pl, fra] = [endId("DEU"), endId("POL"), endId("FRA")];
    const w = oldWar(g, ww, deu, pl);
    ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
    eg.setMemberState(w, pl, "capitulated"); // the side leader passes on
    const n0 = updates.length;
    const pp = ww.politics.country(deu)!.ppMilli;
    step(runner, 2, [
      order(HUMAN, {
        kind: "peace_offer",
        war: w,
        target: pl,
        terms: { give: [], take: [], pay: 1, demand: 0, free: [] },
      }),
    ]);
    expect(eg.peaceOffers.length).toBe(0);
    expect(ww.politics.country(deu)!.ppMilli).toBeGreaterThanOrEqual(pp);
    expect(msgs(updates, n0)).toContain("events_display.ww1936_order_refused");
  });

  it("B8: an accept of terms that no longer hold tells the target too", async () => {
    const { runner, updates, g, ww, eg } = await endWorld([
      { clientID: HUMAN, country: "POL" },
      { clientID: "HUMAN002", country: "DEU" },
    ]);
    const [deu, pl] = [endId("DEU"), endId("POL")];
    const w = oldWar(g, ww, deu, pl);
    const r = ww.scenario.landRegions.find(
      (x: any) =>
        ww.politics.legalOwner[x.id] === deu &&
        x.id !== eg.capitalRegion(deu) &&
        x.vp > 0,
    )!.id;
    expect(
      offerPeace(eg, pl, w, deu, g.ticks(), {
        give: [],
        take: [r],
        pay: 0,
        demand: 0,
        free: [],
      }),
    ).toBeNull();
    const o = eg.peaceOffers[0];
    ww.politics.setLegalOwner(r, endId("FRA"));
    const n0 = updates.length;
    step(runner, 2, [
      order("HUMAN002", { kind: "peace_reply", offer: o.id, accept: true }),
    ]);
    expect(ww.isAtWar(deu, pl)).toBe(true);
    const m = msgs(updates, n0);
    expect(m).toContain("events_display.ww1936_wpeace_lapsed");
    expect(m).toContain("events_display.ww1936_wpeace_lapsed_to");
  });

  it("B6/B8: a reply after the deadline is refused with a notice", async () => {
    const { runner, updates, g, ww, eg } = await endWorld([
      { clientID: HUMAN, country: "POL" },
      { clientID: "HUMAN002", country: "DEU" },
    ]);
    const [deu, pl] = [endId("DEU"), endId("POL")];
    const w = oldWar(g, ww, deu, pl);
    expect(offerPeace(eg, pl, w, deu, g.ticks())).toBeNull();
    const o = eg.peaceOffers[0];
    stepTo(runner, o.deadlineTick + 1);
    const n0 = updates.length;
    step(runner, 2, [
      order("HUMAN002", { kind: "peace_reply", offer: o.id, accept: true }),
    ]);
    expect(ww.isAtWar(deu, pl)).toBe(true);
    expect(msgs(updates, n0)).toContain("events_display.ww1936_order_refused");
  });

  it("B9: a truce keeps a faction pull off", async () => {
    const { g, ww, eg } = await endWorld([]);
    const [deu, pl, fra] = [endId("DEU"), endId("POL"), endId("FRA")];
    const pol = ww.politics;
    const w = oldWar(g, ww, deu, fra);
    expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
    replyPeace(eg, fra, eg.peaceOffers[0].id, true, g.ticks());
    expect(eg.truceUntil(deu, fra)).toBeGreaterThan(ww.day(g.ticks()));
    joinFaction(pol, pl, pol.factionIdx(fra), g.ticks());
    dropPact(g, "DEU", "POL");
    pol.country(deu)!.warGoals.push({
      type: "conquer",
      on: pl,
      group: "",
      untilDay: 99999,
    } as any);
    declareWar(
      g,
      ww,
      g.playerBySmallID(deu) as any,
      g.playerBySmallID(pl) as any,
      g.ticks(),
    );
    expect(ww.isAtWar(deu, pl)).toBe(true);
    expect(ww.isAtWar(deu, fra)).toBe(false);
  });

  it("B11: answering the front card gives the next offer its full window", async () => {
    const { runner, g, ww, eg } = await endWorld([
      { clientID: HUMAN, country: "POL" },
    ]);
    const [deu, pl, ita] = [endId("DEU"), endId("POL"), endId("ITA")];
    const w1 = oldWar(g, ww, deu, pl);
    const w2 = oldWar(g, ww, ita, pl);
    expect(offerPeace(eg, deu, w1, pl, g.ticks())).toBeNull();
    expect(offerPeace(eg, ita, w2, pl, g.ticks())).toBeNull();
    const [first, second] = eg.peaceOffers;
    // ww162 diplomacy: one card queue (DiploState.cardFrontId) replaced w86's
    // extension; an offer behind the front card has no deadline yet (-1).
    expect(second.deadlineTick).toBe(-1);
    const window = first.deadlineTick - first.sentTick;
    stepTo(runner, g.ticks() + 10);
    step(runner, 1, [
      order(HUMAN, { kind: "peace_reply", offer: first.id, accept: false }),
    ]);
    // In front now: its clock starts on the endgame's next step.
    step(runner);
    const left = eg.peaceOffers.find((x: any) => x.id === second.id)!;
    expect(left.deadlineTick).toBeGreaterThan(second.sentTick + window);
  });
});
