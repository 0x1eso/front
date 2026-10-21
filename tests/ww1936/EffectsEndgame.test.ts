// World War 1936 P5 (plan Task 8, spec §16.4): the endgame effects lane E
// owns, run as content writes them on the end map (ww1936end) with the
// end fixture. One test per effect family.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { RegionGroupDef } from "@openfront/engine-lib/ww1936/content/types";
import type { Game, Player } from "@openfront/engine/game/Game";
import { declareWar, joinWar } from "@openfront/engine/ww1936/Diplomacy";
import { uprisingNow } from "@openfront/engine/ww1936/endgame/Occupation";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { vi } from "vitest";
import { endId } from "./endFixture";
import { END_GROUPS, endgameFixture } from "./endgameFixture";
import { END_MAP, placeArmy, stepTo, takeRegion, wwRunner } from "./util";

vi.mock("@openfront/engine/ww1936/endgame/Occupation", async (original) => {
  const real =
    await original<
      typeof import("@openfront/engine/ww1936/endgame/Occupation")
    >();
  return { ...real, uprisingNow: vi.fn(real.uprisingNow) };
});

/** Test groups: Czechoslovakia's island chain, both Polish regions, Lyon. */
const GROUPS: RegionGroupDef[] = [
  ...END_GROUPS,
  { id: "t_csk_chain", regions: [13, 14, 15, 20], owner1936: "CSK" },
  { id: "t_poland", regions: [6, 7], owner1936: "POL" },
];

beforeEach(() => usePoliticsContent(endgameFixture({ groups: GROUPS })));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(uprisingNow).mockClear();
});

const asPlayer = (g: Game, id: number): Player => {
  const p = g.playerBySmallID(id);
  if (!p.isPlayer()) throw new Error(`no player ${id}`);
  return p;
};

async function game() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const p = ww.politics;
  const id = (t: CountryTag) => endId(t);
  /** Runs effects as `self` (the actor) now. */
  const run = (self: number, effects: readonly Effect[]) =>
    applyEffects(makeCtx(p, self, 0, 0, g.ticks()), effects);
  return { runner, g, ww, p, eg: ww.endgame, id, run };
}

const T = (tag: CountryTag) => ({ tag });

// Game tests: slow under the full suite's load.
describe("World War 1936 P5: endgame effects", { timeout: 60_000 }, () => {
  it("separate_peace marks the member left and keeps other wars", async () => {
    const { g, ww, eg, id, run } = await game();
    const [deu, pl, fra] = [id("DEU"), id("POL"), id("FRA")];
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(deu, fra, g.ticks(), { kind: "declare" });
    const wPol = eg.warOfPair(deu, pl);
    const wFra = eg.warOfPair(deu, fra);
    expect(wPol).not.toBe(wFra);
    takeRegion(g, 7, "DEU");
    run(deu, [{ kind: "separate_peace", with: T("POL") }]);
    expect(ww.isAtWar(deu, pl)).toBe(false);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    expect(eg.member(eg.war(wPol)!, deu)!.state).toBe("left");
    expect(eg.member(eg.war(wFra)!, deu)!.state).toBe("active");
    // P3 end_war: the occupied Krakow goes back to Poland.
    expect(ww.land.controller[7]).toBe(pl);
    run(deu, [{ kind: "separate_peace", with: "all" }]);
    expect(ww.hasWar(deu)).toBe(false);
    expect(eg.member(eg.war(wFra)!, deu)!.state).toBe("left");
  });

  it("switch_sides moves a country to the other faction and declares on old friends", async () => {
    const { g, ww, p, eg, id, run } = await game();
    const [deu, ita, gbr, fra] = ["DEU", "ITA", "GBR", "FRA"].map((t) =>
      id(t as CountryTag),
    );
    expect(p.sameFaction(deu, ita)).toBe(true);
    // Germany declares on Britain (France comes with the Allies); Italy joins.
    declareWar(g, ww, asPlayer(g, deu), asPlayer(g, gbr), g.ticks());
    expect(ww.isAtWar(deu, fra)).toBe(true);
    expect(joinWar(g, ww, asPlayer(g, ita), asPlayer(g, gbr), g.ticks())).toBe(
      true,
    );
    const w = eg.warOfPair(deu, gbr);
    expect(eg.warOfPair(ita, gbr)).toBe(w);
    run(ita, [{ kind: "switch_sides", to: T("GBR") }]);
    expect(ww.isAtWar(ita, gbr)).toBe(false);
    expect(ww.isAtWar(ita, fra)).toBe(false);
    expect(p.factionIdx(ita)).toBe(p.factionIdx(gbr));
    expect(p.sameFaction(ita, deu)).toBe(false);
    expect(ww.isAtWar(ita, deu)).toBe(true);
    // In the same war record, now on Britain's side, fighting.
    const rec = eg.war(w)!;
    expect(eg.warOfPair(ita, deu)).toBe(w);
    expect(eg.sideIndex(rec, ita)).toBe(eg.sideIndex(rec, gbr));
    expect(eg.member(rec, ita)!.state).toBe("active");
    expect(rec.sides.flatMap((s) => s.members.map((m) => m.id))).toEqual(
      expect.arrayContaining([deu, ita, gbr, fra]),
    );
    expect(
      rec.sides.flatMap((s) => s.members).filter((m) => m.id === ita),
    ).toHaveLength(1);
  });

  it("switch_sides to a country without a faction joins its war on the old friends", async () => {
    const { g, ww, p, eg, id, run } = await game();
    const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    const w = eg.warOfPair(deu, pl);
    ww.setWar(ita, pl, g.ticks(), { kind: "into", warId: w });
    run(ita, [{ kind: "switch_sides", to: T("POL") }]);
    expect(p.factionIdx(ita)).toBe(-1);
    expect(ww.isAtWar(ita, pl)).toBe(false);
    expect(ww.isAtWar(ita, deu)).toBe(true);
    const rec = eg.war(w)!;
    expect(eg.warOfPair(ita, deu)).toBe(w);
    expect(eg.sideIndex(rec, ita)).toBe(eg.sideIndex(rec, pl));
    // No goal was made, so no penalty paid (a join).
    expect(p.hasWarGoal(ita, deu)).toBe(false);
  });

  it("surrender capitulates at once to the given receiver", async () => {
    const { g, ww, id, run } = await game();
    const [deu, pl, sun, ltu, est] = ["DEU", "POL", "SUN", "LTU", "EST"].map(
      (t) => id(t as CountryTag),
    );
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(sun, pl, g.ticks(), { kind: "into", warId: 0 });
    // Germany holds Warsaw: P0 would pick it; the effect names the Soviets.
    takeRegion(g, 6, "DEU");
    expect(ww.capitulationGauge(pl)).toBe(0);
    run(pl, [{ kind: "surrender", to: T("SUN") }]);
    expect(ww.isCapitulated(pl)).toBe(true);
    expect(ww.data().capitulated.find((c) => c.smallID === pl)!.victor).toBe(
      sun,
    );
    // Without `to`: P0's pickVictor (Germany holds Kaunas).
    ww.setWar(deu, ltu, g.ticks(), { kind: "declare" });
    takeRegion(g, 17, "DEU");
    run(ltu, [{ kind: "surrender" }]);
    expect(ww.data().capitulated.find((c) => c.smallID === ltu)!.victor).toBe(
      deu,
    );
    // A country at peace does not surrender.
    run(est, [{ kind: "surrender", to: T("SUN") }]);
    expect(ww.isCapitulated(est)).toBe(false);
  });

  it("occupation_zone with seize takes control outward from the actor's border", async () => {
    const { g, ww, eg, id, run } = await game();
    const [aut, csk, deu] = [id("AUT"), id("CSK"), id("DEU")];
    const land = ww.land;
    // Germany, at war with Austria, holds Slovakia (15) in the middle of
    // the chain 12 (Austria) - 13 - 14 - 15 - 20.
    ww.setWar(deu, aut, g.ticks(), { kind: "declare" });
    takeRegion(g, 15, "DEU");
    const ce = ww.economy.country(csk)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 10_000;
    ce.manpower += 100_000;
    const army = placeArmy(g, "CSK", 13, 1);
    const row = land.divisions.rowOf(army.divisions[0])!;
    run(aut, [{ kind: "occupation_zone", group: "t_csk_chain", seize: true }]);
    expect([13, 14, 15, 20].map((r) => land.controller[r])).toEqual([
      aut,
      aut,
      deu,
      csk,
    ]);
    expect(eg.zones).toEqual([
      { region: 13, holder: aut, untilDay: -1 },
      { region: 14, holder: aut, untilDay: -1 },
    ]);
    // The Czechoslovak division went home.
    expect(land.divisions.region[row]).not.toBe(13);
    expect(land.divisions.owner[row]).toBe(csk);
    // Handing a zone over gives what the actor holds, adjacent or not; the
    // rows already there are updated.
    const day = ww.day(g.ticks());
    run(csk, [
      {
        kind: "occupation_zone",
        group: "t_csk_chain",
        holder: T("AUT"),
        days: 30,
        seize: true,
      },
    ]);
    expect(land.controller[20]).toBe(aut);
    expect(land.controller[15]).toBe(deu);
    expect(eg.zones).toEqual([
      { region: 13, holder: aut, untilDay: day + 30 },
      { region: 14, holder: aut, untilDay: day + 30 },
      { region: 20, holder: aut, untilDay: day + 30 },
    ]);
    // Without seize: only what the holder controls already.
    run(deu, [{ kind: "occupation_zone", group: "t_csk_chain" }]);
    expect(eg.zones.find((z) => z.region === 15)).toEqual({
      region: 15,
      holder: deu,
      untilDay: -1,
    });
    expect(eg.zones).toHaveLength(4);
  });

  it("annex_occupied changes the legal owner only for a capitulated owner", async () => {
    const { g, ww, p, eg, id, run } = await game();
    const [deu, pl, ltu] = [id("DEU"), id("POL"), id("LTU")];
    takeRegion(g, 6, "DEU");
    takeRegion(g, 16, "DEU");
    takeRegion(g, 7, "SUN");
    ww.addCapitulation(pl, deu, g.ticks());
    run(deu, [
      { kind: "annex_occupied", group: "west_poland" },
      { kind: "annex_occupied", group: "memel" },
    ]);
    expect(p.legalOwner[6]).toBe(deu);
    // Lithuania has not capitulated: Memel stays Lithuanian by law.
    expect(p.legalOwner[16]).toBe(ltu);
    // The cores do not move.
    expect(eg.hasCore(deu, 6)).toBe(false);
    expect(eg.hasCore(pl, 6)).toBe(true);
    // To another country: the Soviets hand Krakow to Lithuania.
    run(id("SUN"), [
      { kind: "annex_occupied", group: "east_poland", to: T("LTU") },
    ]);
    expect(p.legalOwner[7]).toBe(ltu);
  });

  it("uprising and resistance act on administered regions only", async () => {
    const { g, ww, eg, id, run } = await game();
    const deu = id("DEU");
    takeRegion(g, 6, "DEU");
    expect(eg.isAdministered(6)).toBe(true);
    expect(eg.isAdministered(7)).toBe(false);
    run(deu, [
      { kind: "resistance", group: "t_poland", pct: 20 },
      { kind: "compliance", group: "t_poland", pct: 30 },
      { kind: "uprising", group: "t_poland" },
    ]);
    expect([eg.resBp[6], eg.resBp[7]]).toEqual([2000, 0]);
    expect([eg.compBp[6], eg.compBp[7]]).toEqual([3000, 0]);
    expect(vi.mocked(uprisingNow).mock.calls.map((c) => c[1])).toEqual([6]);
    // Compliance stops at 80% while Poland plays on; both stay in range.
    run(deu, [
      { kind: "compliance", group: "warsaw", pct: 90 },
      { kind: "resistance", group: "warsaw", pct: -50 },
    ]);
    expect(eg.compBp[6]).toBe(8000);
    expect(eg.resBp[6]).toBe(0);
    expect(ww.land.controller[6]).toBe(deu);
  });

  it("exile legitimacy, reparations and navy experience", async () => {
    const { g, ww, eg, id, run } = await game();
    const [pl, fra, gbr, csk, deu] = ["POL", "FRA", "GBR", "CSK", "DEU"].map(
      (t) => id(t as CountryTag),
    );
    for (const smallID of [fra, pl]) {
      eg.exiles.push({
        smallID,
        host: gbr,
        legitBp: 5000,
        sinceDay: 0,
        zeroDays: 0,
        lastDelta: 0,
        faction: -1,
        capital: smallID === pl ? 6 : 1,
      });
    }
    eg.rebuildDerived();
    const legit = (x: number) => eg.exiles[eg.exileIdx.get(x)!].legitBp;
    run(pl, [{ kind: "exile_legitimacy", pct: 10 }]);
    expect(legit(pl)).toBe(6000);
    // Britain's faction exiles: France (Allies), not Poland.
    run(gbr, [{ kind: "exile_legitimacy", pct: 5, scope: "faction_exiles" }]);
    expect([legit(fra), legit(pl)]).toEqual([5500, 6000]);
    run(pl, [
      { kind: "exile_legitimacy", pct: 100 },
      { kind: "exile_legitimacy", pct: 100 },
    ]);
    expect(legit(pl)).toBe(10_000);
    // Not an exile: nothing.
    run(deu, [{ kind: "exile_legitimacy", pct: 10 }]);
    expect(eg.exileIdx.has(deu)).toBe(false);
    const day = ww.day(g.ticks());
    run(csk, [{ kind: "reparations", to: T("DEU"), k: 4, days: 730 }]);
    expect(eg.reparations).toEqual([
      { from: csk, to: deu, k: 4, untilDay: day + 730 },
    ]);
    const before = ww.navy.country(gbr)!.navyXpMilli;
    run(gbr, [{ kind: "navy_xp", amount: 20 }]);
    expect(ww.navy.country(gbr)!.navyXpMilli).toBe(before + 20_000);
    run(gbr, [{ kind: "navy_xp", amount: -1000 }]);
    expect(ww.navy.country(gbr)!.navyXpMilli).toBe(0);
  });
});
