// World War 1936 P3 (plan decisions 1, 2, 8, 9, 15, 17; Task 1 Steps
// 11–13): politics wired into P0–P2, on the test map ww1936pol with the
// test content.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { simpleHash } from "@openfront/engine-lib/Util";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import { idHash, P_BEAT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { checkCapitulations } from "@openfront/engine/ww1936/Capitulation";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  createScriptedRunner,
  scriptedGameStart,
  stepScripted,
} from "../util/ScriptedGame";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  land,
  pol,
  POL,
  step,
  stepTo,
  takeRegion,
  wwRestore,
  wwRunner,
  wwRunnerCapture,
} from "./util";

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

/** Only beat `i` is left, due on `day` (its rolled skip kept). */
function onlyBeat(runner: GameRunner, i: number, day: number): void {
  const p = pol(runner.game);
  p.beats = p.beats.map((b, j) =>
    j === i ? { ...b, fireDay: day } : { ...b, skipped: true },
  );
}

const DEU_POL = HISTORY_BEATS.findIndex((b) => b.id === "b1939_09_01_deu_pol");

/** Whether the DEU→POL beat is skipped for this game id (plan decisions 2, 16). */
const skippedFor = (gameID: string) =>
  wwRoll(
    simpleHash(gameID) + 1937,
    P_BEAT,
    idHash(HISTORY_BEATS[DEU_POL].id),
    1,
  ) %
    10 ===
  0;

describe("politics wiring", () => {
  it("the vanilla rules are untouched when the mode is off", async () => {
    const runner = await createScriptedRunner("world", scriptedGameStart({}));
    for (let i = 0; i < 30; i++) stepScripted(runner);
    expect(runner.game.worldWar()).toBeNull();
    // tests/VanillaDigest.test.ts pins the vanilla digests themselves.
  }, 60_000);

  it("the economy's stats are the politics' stats object, also after a restore", async () => {
    const a = await wwRunner({}, DEU_HUMAN, POL);
    stepTo(a, WW_PREP_TICKS + 20);
    for (const runner of [a, await wwRestore(a, DEU_HUMAN, POL)]) {
      const ww = runner.game.worldWar()!;
      for (const c of ww.politics.list()) {
        expect(ww.economy.country(c.smallID)!.stats).toBe(c.stats);
      }
    }
  });

  it("a finished tech updates the stats the same tick", async () => {
    const runner = await wwRunner({}, [], POL);
    step(runner);
    const g = runner.game;
    const ce = g.worldWar()!.economy.country(byTag(g, "EST").smallID())!;
    const tech = WW_TECH_IDS.find(
      (t) =>
        !ce.researched.has(t) && (WW_TECHS[t].effects.constructionPct ?? 0) > 0,
    )!;
    const before = ce.stats.constructionPct;
    ce.addTech(tech);
    expect(ce.stats.constructionPct).toBe(
      before + WW_TECHS[tech].effects.constructionPct!,
    );
    expect(ce.stats.constructionPct).toBe(ce.tech.constructionPct);
  });

  it("legal owners start as the 1936 owners and capitulation hands them to the victor", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const p = ww.politics;
    const owners = ww.scenario.ownerByRegion();
    for (const r of ww.scenario.landRegions) {
      expect(p.legalOwner[r.id]).toBe(owners[r.id]);
      expect(p.isCore(r.id)).toBe(true);
    }
    const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pl.smallID(), g.ticks());
    takeRegion(g, 6, "DEU");
    ww.setCapitulationGauge(pl.smallID(), WW_CAPITULATION_DAYS - 1);
    stepTo(runner, dayStart(ww.day(g.ticks()) + 1) + 1);
    expect(ww.isCapitulated(pl.smallID())).toBe(true);
    for (const r of [6, 7]) {
      expect(p.legalOwner[r]).toBe(deu.smallID());
      expect(p.isCore(r)).toBe(false);
    }
    // The screens hear of the two regions.
    const regions = updates
      .flatMap((u) => u.updates[GameUpdateType.WwPolitics] ?? [])
      .flatMap((u) => u.data.regions);
    expect(regions).toEqual(
      expect.arrayContaining([
        { id: 6, legalOwner: deu.smallID() },
        { id: 7, legalOwner: deu.smallID() },
      ]),
    );
    // The P1 economy's shares read the legal owner: Germany's own now.
    expect(ww.economy.shares(6)).toMatchObject({
      occupied: false,
      controlPct: 100,
    });
  });

  it("the surrender line uses stability and war support", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
    const c = ww.politics.country(pl.smallID())!;
    expect(ww.politics.surrenderPct(pl.smallID())).toBe(80);
    c.stabBp = 10_000;
    c.wsBp = 10_000;
    expect(ww.politics.surrenderPct(pl.smallID())).toBe(95);
    c.wsBp = 0;
    c.stabBp = 0;
    expect(ww.politics.surrenderPct(pl.smallID())).toBe(65);
    // Warsaw is 21 of Poland's 24 points (87%): past 80%, short of 95%.
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pl.smallID(), g.ticks());
    takeRegion(g, 6, "DEU");
    c.stabBp = 10_000;
    c.wsBp = 10_000;
    checkCapitulations(g, ww, g.ticks());
    expect(ww.capitulationGauge(pl.smallID())).toBe(0);
    c.stabBp = 5000;
    c.wsBp = 5000;
    checkCapitulations(g, ww, g.ticks());
    expect(ww.capitulationGauge(pl.smallID())).toBe(1);
  });

  it("factions are state: the start members, factionOf and sameFaction", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const id = (t: "DEU" | "ITA" | "GBR" | "FRA" | "SUN" | "POL") =>
      byTag(g, t).smallID();
    expect(
      ww.politics.factions.map((f) => [f.name, f.leader, f.members]),
    ).toEqual([
      ["axis", id("DEU"), [id("DEU"), id("ITA")]],
      ["allies", id("GBR"), [id("GBR"), id("FRA")]],
      ["comintern", id("SUN"), [id("SUN")]],
    ]);
    expect(ww.factionOf(id("ITA"))).toBe("axis");
    expect(ww.factionOf(id("POL"))).toBeNull();
    expect(ww.factionMembers("allies")).toEqual([id("GBR"), id("FRA")]);
    expect(ww.sameFaction(id("DEU"), id("ITA"))).toBe(true);
    expect(ww.sameFaction(id("DEU"), id("DEU"))).toBe(false);
    expect(ww.sameFaction(id("DEU"), id("GBR"))).toBe(false);
  });

  it("P2 sides follow politics factions", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pl, cz] = [byTag(g, "DEU"), byTag(g, "POL"), byTag(g, "CSK")];
    expect(land(g).sameSide(deu.smallID(), pl.smallID())).toBe(false);
    // Poland joins the axis; Czechoslovakia makes a faction of its own (f3).
    ww.politics.factions[0].members.push(pl.smallID());
    ww.politics.factions.push({
      idx: ww.politics.nextFactionIdx++,
      name: "auto",
      nameTag: "CSK",
      leader: cz.smallID(),
      members: [cz.smallID()],
      createdDay: 0,
    });
    ww.politics.factionsChanged();
    expect(land(g).sameSide(deu.smallID(), pl.smallID())).toBe(true);
    expect(ww.sameFaction(deu.smallID(), pl.smallID())).toBe(true);
    expect(ww.factionOf(cz.smallID())).toBe("f3");
    expect(ww.factionMembers("f3")).toEqual([cz.smallID()]);
    expect(land(g).sideOf(cz.smallID())).toBe(100_003);
  });

  it("a restored game keeps politics' sides (controller ruling C1)", async () => {
    const a = await wwRunner({}, DEU_HUMAN, POL);
    stepTo(a, WW_PREP_TICKS + 10);
    const [deu, pl] = [byTag(a.game, "DEU"), byTag(a.game, "POL")];
    // Poland joins the Axis.
    const p = pol(a.game);
    p.factions[0].members.push(pl.smallID());
    p.factionsChanged();
    expect(land(a.game).sameSide(deu.smallID(), pl.smallID())).toBe(true);
    const b = await wwRestore(a, DEU_HUMAN, POL);
    expect(land(b.game).sameSide(deu.smallID(), pl.smallID())).toBe(true);
    expect(land(b.game).sideOf(pl.smallID())).toBe(
      land(a.game).sideOf(pl.smallID()),
    );
    expect(b.game.worldWar()!.sameFaction(deu.smallID(), pl.smallID())).toBe(
      true,
    );
  });

  it("military access lets armies enter", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
    expect(land(g).canEnter(deu.smallID(), 6)).toBe(false);
    ww.politics.access.push({ by: deu.smallID(), from: pl.smallID() });
    expect(land(g).canEnter(deu.smallID(), 6)).toBe(true);
    expect(land(g).canEnter(pl.smallID(), 3)).toBe(false);
  });

  it("history beats declare the P0 wars", async () => {
    const ids = Array.from(
      { length: 60 },
      (_, i) => `WWBEAT${String(i).padStart(2, "0")}`,
    );
    const fires = ids.find((x) => !skippedFor(x))!;
    const skips = ids.find((x) => skippedFor(x))!;
    expect(fires).toBeDefined();
    expect(skips).toBeDefined();
    for (const [gameID, war] of [
      [fires, true],
      [skips, false],
    ] as const) {
      const { runner } = await wwRunnerCapture({}, [], POL, gameID);
      const g = runner.game;
      step(runner);
      const s = pol(g).beats[DEU_POL];
      expect(s.skipped, gameID).toBe(!war);
      const date = dayOfDate("1939-09-01");
      expect(s.fireDay >= date && s.fireDay <= date + 20, gameID).toBe(true);
      // The rolled beat moved to day 2 (no 13,000-tick wait); its skip kept.
      onlyBeat(runner, DEU_POL, 2);
      stepTo(runner, dayStart(3));
      const ww = g.worldWar()!;
      expect(
        ww.isAtWar(byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()),
        gameID,
      ).toBe(war);
      // On the history path the 1934 pact goes first and a goal is made
      // on the spot, which the declaration uses up (spec §14.2): no
      // penalty for a goal-less war.
      if (war) {
        const [d, p] = [byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()];
        expect(pol(g).isAtWarBlockedByNap(d, p)).toBe(false);
        expect(pol(g).hasWarGoal(d, p)).toBe(false);
        expect(pol(g).country(d)!.declaredOn).toContain(p);
      }
    }
  });

  it("with historical AI off no beat fires", async () => {
    const runner = await wwRunner({ historicalAi: false }, [], POL);
    step(runner);
    const p = pol(runner.game);
    expect(p.beats.every((b) => b.skipped)).toBe(true);
    p.beats = p.beats.map((b) => ({ ...b, fireDay: 2 }));
    stepTo(runner, dayStart(3));
    expect(runner.game.worldWar()!.data().wars).toEqual([]);
  });
});
