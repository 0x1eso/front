// World War 1936 P6 lane W3 (plan Task 9 Step 8): the naval treaty (spec
// §13.3) on the deep test map — Britain and France are members (the US is
// not on the map), Italy is a major outside it.
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  TREATY_LEAVE_TENSION_BP,
  treatyDay,
  treatyEscalated,
  treatyLineBlock,
  treatyMember,
} from "@openfront/engine/ww1936/depth/NavalTreaty";
import type { NavalLine } from "@openfront/engine/ww1936/economy/WwEconomy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepToDate, warAfterPrep, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const BB = SHIP_CLASSES.indexOf("bb");
const CV = SHIP_CLASSES.indexOf("cv");
const { GBR, FRA, ITA } = DEEP.tag;

function bbLine(gen: number): NavalLine {
  return {
    id: 99,
    cls: BB,
    gen,
    docks: 1,
    activeDocks: 0,
    progress: 0,
    left: 1,
    port: DEEP.region.rome,
    fill: 1000,
    lastOutput: 0,
    names: [],
    design: 0,
  };
}

describe("World War 1936 P6: the naval treaty", () => {
  it("treaty members cannot build fourth-generation battleships until the escalator", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    stepToDate(runner, "1936-01-03");
    expect(d.mech.treaty.members).toEqual([GBR, FRA].sort((a, b) => a - b));
    expect(treatyMember(d, GBR)).toBe(true);
    expect(treatyMember(d, ITA)).toBe(false);
    expect(treatyLineBlock(d, GBR, BB, 4)).toBe(true);
    expect(treatyLineBlock(d, GBR, BB, 3)).toBe(false);
    expect(treatyLineBlock(d, GBR, CV, 4)).toBe(false);
    expect(treatyLineBlock(d, ITA, BB, 4)).toBe(false);
    // A non-member major's second-generation battleship line is no escalator.
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    const ita = ww.economy.country(ITA)!;
    ita.navalLines.push(bbLine(2));
    treatyDay(d, day, tick);
    expect(treatyEscalated(d)).toBe(false);
    // A third-generation one is: the members may build them too.
    ita.navalLines[ita.navalLines.length - 1] = bbLine(3);
    treatyDay(d, day, tick);
    expect(treatyEscalated(d)).toBe(true);
    expect(treatyLineBlock(d, GBR, BB, 4)).toBe(false);
    expect(treatyMember(d, GBR)).toBe(true);
    // The treaty ends on 1942-12-31.
    treatyDay(d, dayOfDate("1942-12-31"), tick);
    expect(d.mech.treaty.ended).toBe(true);
    expect(treatyMember(d, GBR)).toBe(false);
  });

  it("the escalator event's flag escalates too", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    stepToDate(runner, "1936-01-03");
    const tick = runner.game.ticks();
    ww.politics.country(FRA)!.flags.set("treaty_escalated", [0, -1]);
    treatyDay(d, ww.day(tick), tick);
    expect(treatyEscalated(d)).toBe(true);
  });

  it("leaving the treaty takes 30 days and raises tension", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANGBR", country: "GBR" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const pol = ww.politics;
    stepToDate(runner, "1936-01-03");
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    const c = pol.country(GBR)!;
    c.ppMilli = 40_000;
    expect(d.issue(GBR, { kind: "treaty_leave" }, tick)).toBe("no_pp");
    c.ppMilli = 120_000;
    const wt = pol.wtBp;
    const own = pol.threatBp[GBR];
    expect(d.issue(GBR, { kind: "treaty_leave" }, tick)).toBeNull();
    expect(c.ppMilli).toBe(70_000);
    expect(pol.wtBp).toBe(wt + TREATY_LEAVE_TENSION_BP);
    expect(pol.threatBp[GBR]).toBe(own + TREATY_LEAVE_TENSION_BP);
    expect(d.mech.treaty.leaving).toEqual([[GBR, day + 30]]);
    expect(d.issue(GBR, { kind: "treaty_leave" }, tick)).toBe("bad_index");
    expect(d.issue(ITA, { kind: "treaty_leave" }, tick)).toBe("bad_index");
    // Still bound for 29 days; free on the 30th.
    treatyDay(d, day + 29, tick);
    expect(treatyMember(d, GBR)).toBe(true);
    expect(treatyLineBlock(d, GBR, BB, 4)).toBe(true);
    treatyDay(d, day + 30, tick);
    expect(treatyMember(d, GBR)).toBe(false);
    expect(treatyLineBlock(d, GBR, BB, 4)).toBe(false);
    expect(d.mech.treaty.leaving).toEqual([]);
  });

  it("a member at war with a major is released at once", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    warAfterPrep(runner, "HUMANITA", "FRA");
    expect(treatyLineBlock(d, FRA, BB, 4)).toBe(false);
    const tick = runner.game.ticks();
    treatyDay(d, ww.day(tick), tick);
    expect(treatyMember(d, FRA)).toBe(false);
    // Britain, France's ally, is in the war too.
    expect(treatyMember(d, GBR)).toBe(!ww.isAtWar(GBR, ITA));
  });
});
