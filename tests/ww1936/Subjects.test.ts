// World War 1936 P5 lane S (plan Task 4): subjects — war binding by level,
// autonomy and flows, upgrades, limits, trade and the independence glue.
import {
  SUBJECT_LEVELS,
  type SubjectLevel,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  levelAfter,
  paidCivsAt,
  subjectActionBlocked,
  subjectFlows,
  subjectTradeCivPct,
  subjectWarRule,
  WW_DOMINION_TRADE_PCT,
  WW_SUBJECT_CALL_PCT,
  WW_SUBJECT_DOWN_AUT_BP,
  WW_SUBJECT_UP_AUT_BP,
} from "@openfront/engine-lib/ww1936/SubjectRules";
import { declareWarBlock } from "@openfront/engine/ww1936/Diplomacy";
import {
  endSubject,
  FLAG_AUTONOMY_FULL,
  makeSubject,
  settleSubjects,
  stepSubject,
  subjectBlock,
  subjectCallRoll,
  subjectEconomy,
  subjectLine,
  tradeCivFactorPct,
} from "@openfront/engine/ww1936/endgame/Subjects";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { subjectFixture } from "./subjectFixture";
import {
  dropPact,
  END_MAP,
  HUMAN,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "./util";

afterEach(() => usePoliticsContent(null));

async function started(humans: { clientID: string; country: "POL" }[] = []) {
  usePoliticsContent(subjectFixture());
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

const T = (t: "DEU" | "POL" | "CSK" | "LTU" | "GBR" | "SVK") => endId(t);

describe("World War 1936 P5: subject rules (pure)", () => {
  it("levels step up and down; up from a dominion is independence", () => {
    expect(levelAfter("integrated", "up")).toBe("puppet");
    expect(levelAfter("colony", "up")).toBe("dominion");
    expect(levelAfter("dominion", "up")).toBeNull();
    expect(levelAfter("puppet", "down")).toBe("integrated");
    expect(levelAfter("integrated", "down")).toBe("integrated");
    expect(WW_SUBJECT_UP_AUT_BP).toBe(2000);
    expect(WW_SUBJECT_DOWN_AUT_BP).toBe(8000);
  });

  it("war rule by level: join, call or none", () => {
    expect(subjectWarRule("integrated", false, false)).toBe("join");
    expect(subjectWarRule("puppet", false, false)).toBe("join");
    expect(subjectWarRule("colony", false, true)).toBe("join");
    expect(subjectWarRule("colony", false, false)).toBe("call");
    expect(subjectWarRule("dominion", false, false)).toBe("call");
    expect(subjectWarRule("puppet", true, false)).toBe("none");
  });

  it("actions are blocked by level", () => {
    expect(SUBJECT_LEVELS.length).toBe(4);
    const lv = (
      l: SubjectLevel,
      a: Parameters<typeof subjectActionBlocked>[2],
    ) => subjectActionBlocked(l, false, a);
    expect(lv("integrated", "faction")).toBe(true);
    expect(lv("puppet", "faction")).toBe(true);
    expect(lv("dominion", "faction")).toBe(false);
    expect(lv("dominion", "leave_faction")).toBe(true);
    expect(lv("dominion", "justify")).toBe(false);
  });

  it("flows grow with the level and the dominion trades at half price", () => {
    const res = Array.from({ length: 6 }, () => 1000);
    const a = subjectFlows("integrated", res, 100, 10_000);
    const b = subjectFlows("dominion", res, 100, 10_000);
    expect(a.civ).toBeGreaterThan(b.civ);
    expect(a.manpower).toBeGreaterThan(b.manpower);
    expect(a.res.reduce((x, y) => x + y, 0)).toBeGreaterThan(
      b.res.reduce((x, y) => x + y, 0),
    );
    expect(WW_DOMINION_TRADE_PCT).toBe(50);
    expect(paidCivsAt(10, 50)).toBeLessThan(10);
    expect(paidCivsAt(10, 100)).toBe(10);
    expect(subjectTradeCivPct(null, 1)).toBe(100);
  });
});

describe("World War 1936 P5: subjects in a game", () => {
  it("subjects join the overlord's wars by level", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, pl, csk, ltu] = [T("DEU"), T("POL"), T("CSK"), T("LTU")];
    // LTU puppet (joins), CSK colony (defensive only), none vs. POL.
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    makeSubject(eg, csk, deu, "colony", false, g.ticks());
    expect(subjectLine(eg, ltu)!.autBp).toBe(2000);
    dropPact(g, "DEU", "POL");
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    expect(ww.isAtWar(ltu, pl)).toBe(true);
    // A colony answers an offensive war by a call to arms (the AI rolls).
    expect(ww.isAtWar(csk, pl)).toBe(
      subjectCallRoll(eg, csk, ww.politics.day()) < WW_SUBJECT_CALL_PCT.colony,
    );
    expect(ww.isAtWar(deu, pl)).toBe(true);
  });

  it("a colony follows when its overlord is declared on", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, pl, csk] = [T("DEU"), T("POL"), T("CSK")];
    makeSubject(eg, csk, deu, "colony", false, g.ticks());
    dropPact(g, "DEU", "POL");
    ww.setWar(pl, deu, g.ticks(), { kind: "declare" });
    expect(ww.isAtWar(csk, pl)).toBe(true);
  });

  it("a neutral collaborator does not join but its overlord defends it", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, pl, csk] = [T("DEU"), T("POL"), T("CSK")];
    makeSubject(eg, csk, deu, "puppet", true, g.ticks());
    dropPact(g, "DEU", "POL");
    dropPact(g, "CSK", "POL");
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    expect(ww.isAtWar(csk, pl)).toBe(false);
    // POL declares on the collaborator: its overlord defends it.
    ww.setWar(pl, csk, g.ticks(), { kind: "declare" });
    expect(ww.isAtWar(deu, pl)).toBe(true);
  });

  it("a dominion upgraded becomes independent and stays in the faction", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, ltu] = [T("DEU"), T("LTU")];
    makeSubject(eg, ltu, deu, "dominion", false, g.ticks());
    const pol = ww.politics;
    pol.markCountry(ltu);
    makeSubject(eg, ltu, deu, "up", false, g.ticks());
    expect(eg.subjectOf(ltu)).toBeNull();
    expect(pol.sameFaction(ltu, deu)).toBe(pol.sameFaction(deu, ltu));
  });

  it("up and down move one step and reset autonomy", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, ltu] = [T("DEU"), T("LTU")];
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    makeSubject(eg, ltu, deu, "up", false, g.ticks());
    expect(eg.subjectOf(ltu)!.level).toBe("colony");
    expect(subjectLine(eg, ltu)!.autBp).toBe(WW_SUBJECT_UP_AUT_BP);
    makeSubject(eg, ltu, deu, "down", false, g.ticks());
    expect(eg.subjectOf(ltu)!.level).toBe("puppet");
    expect(subjectLine(eg, ltu)!.autBp).toBe(WW_SUBJECT_DOWN_AUT_BP);
  });

  it("subject flows move resources, factories and manpower by level", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, ltu] = [T("DEU"), T("LTU")];
    makeSubject(eg, ltu, deu, "integrated", false, g.ticks());
    const ce = ww.economy.country(ltu)!;
    ce.totals.produced = ce.totals.produced.map(() => 1000);
    ce.totals.civ = 20;
    stepSubject(eg, ltu, ww.day(g.ticks()));
    const s = subjectLine(eg, ltu)!;
    expect(s.flowRes.some((x) => x > 0)).toBe(true);
    expect(s.flowCiv).toBeGreaterThan(0);
    const mine = {
      res: s.flowRes.map(() => 0),
      civIn: 0,
      civOut: 0,
      manpower: 0,
      virtualMil: 0,
    };
    const theirs = {
      res: s.flowRes.map(() => 0),
      civIn: 0,
      civOut: 0,
      manpower: 0,
      virtualMil: 0,
    };
    subjectEconomy(eg, ltu, mine);
    subjectEconomy(eg, deu, theirs);
    expect(mine.civOut).toBe(s.flowCiv);
    expect(theirs.civIn).toBe(s.flowCiv);
    expect(mine.res.every((x, k) => x === -theirs.res[k])).toBe(true);
    // A paused bond moves nothing.
    s.suspended = true;
    const none = {
      res: s.flowRes.map(() => 0),
      civIn: 0,
      civOut: 0,
      manpower: 0,
      virtualMil: 0,
    };
    subjectEconomy(eg, ltu, none);
    expect(none.civOut).toBe(0);
  });

  it("limits and trade: subjectBlock, subject_restricted, dominion trade", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, ltu, pl] = [T("DEU"), T("LTU"), T("POL")];
    expect(subjectBlock(eg, ltu, "faction")).toBe(false);
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    expect(subjectBlock(eg, ltu, "faction")).toBe(true);
    const p = (id: number) => {
      const x = g.playerBySmallID(id);
      if (!x.isPlayer()) throw new Error("no player");
      return x;
    };
    expect(declareWarBlock(g, ww, p(ltu), p(pl), g.ticks())).toBe(
      "subject_restricted",
    );
    expect(tradeCivFactorPct(eg, deu, ltu)).toBe(100);
    makeSubject(eg, ltu, deu, "dominion", false, g.ticks());
    expect(tradeCivFactorPct(eg, deu, ltu)).toBe(50);
    expect(tradeCivFactorPct(eg, pl, ltu)).toBe(100);
  });

  it("autonomy at 100% sets the flag; a gone overlord frees its subjects", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, ltu] = [T("DEU"), T("LTU")];
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    subjectLine(eg, ltu)!.autBp = 10_000;
    stepSubject(eg, ltu, ww.day(g.ticks()));
    expect(ww.politics.country(ltu)!.flags.has(FLAG_AUTONOMY_FULL)).toBe(true);
    ww.politics.country(ltu)!.flags.delete(FLAG_AUTONOMY_FULL);
    endSubject(eg, ltu, g.ticks());
    expect(eg.subjectOf(ltu)).toBeNull();
    // A gone overlord.
    makeSubject(eg, ltu, deu, "puppet", false, g.ticks());
    vi.spyOn(eg, "countryState").mockImplementation((id: number) =>
      id === deu ? "gone" : "active",
    );
    settleSubjects(eg, g.ticks());
    expect(eg.subjectOf(ltu)).toBeNull();
    vi.restoreAllMocks();
  });

  it("a human subject declaring on its overlord needs independence_denied", async () => {
    const { runner, g, ww } = await started([
      { clientID: HUMAN, country: "POL" },
    ]);
    const eg = ww.endgame;
    const [deu, pl] = [T("DEU"), T("POL")];
    dropPact(g, "DEU", "POL");
    makeSubject(eg, pl, deu, "puppet", false, g.ticks());
    const declare = () =>
      step(runner, 2, [
        stamped(HUMAN, {
          type: "declare_war",
          target: g.playerBySmallID(deu).id(),
        } as never),
      ]);
    declare();
    expect(ww.isAtWar(pl, deu)).toBe(false);
    ww.politics
      .country(pl)!
      .flags.set("independence_denied", [ww.politics.day(), -1]);
    declare();
    expect(ww.isAtWar(pl, deu)).toBe(true);
    expect(subjectLine(eg, pl)!.suspended).toBe(true);
  });
});
