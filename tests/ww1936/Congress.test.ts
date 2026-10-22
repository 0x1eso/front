// World War 1936 P6 lane W3 (plan Task 9 Step 8): the US congress (spec
// §13.1). The deep test map has no US (nor Japan): the tests call the
// congress's own functions with a stand-in — Britain plays the US, Italy
// Japan — as the public ones do with the US's smallID.
import { CONGRESS } from "@openfront/engine-lib/ww1936/MechRules";
import {
  congressBlock,
  congressBlockFor,
  congressDay,
  setCongressBp,
} from "@openfront/engine/ww1936/depth/Congress";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { pol, warAfterPrep, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const US = DEEP.tag.GBR;
const JP = DEEP.tag.ITA;

describe("World War 1936 P6: the US congress", () => {
  it("congress blocks war declaration under 60 percent", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const deu = DEEP.tag.DEU;
    expect(d.mech.congressBp).toBe(3_000);
    const block = (a: Parameters<typeof congressBlockFor>[3], t?: number) =>
      congressBlockFor(d, US, US, a, t);
    expect(block("declare", deu)).toBe(true);
    expect(block("lend_lease")).toBe(true);
    expect(block("law")).toBe(true);
    expect(block("faction")).toBe(true);
    // Only the US is held back; the public check passes the real US (none here).
    expect(congressBlockFor(d, US, DEEP.tag.FRA, "declare", deu)).toBe(false);
    expect(congressBlock(d, US, "declare", deu)).toBe(false);
    d.mech.congressBp = CONGRESS.declare - 1;
    expect(block("declare", deu)).toBe(true);
    expect(block("law")).toBe(false);
    expect(block("lend_lease")).toBe(false);
    d.mech.congressBp = CONGRESS.declare;
    expect(block("declare", deu)).toBe(false);
    expect(block("faction")).toBe(true);
    d.mech.congressBp = CONGRESS.faction;
    expect(block("faction")).toBe(false);
    // Under 50%, the lend-lease flag lets aid through.
    d.mech.congressBp = 4_000;
    pol(runner.game).country(US)!.flags.set("lend_lease", [0, -1]);
    expect(block("lend_lease")).toBe(false);
  });

  it("a declaration on someone who declared on the US passes under 60 percent", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    warAfterPrep(runner, "HUMANITA", "GBR");
    expect(ww.isAtWar(JP, US)).toBe(true);
    expect(d.mech.congressBp).toBeLessThan(CONGRESS.declare);
    expect(congressBlockFor(d, US, US, "declare", JP)).toBe(false);
    expect(congressBlockFor(d, US, US, "declare", DEEP.tag.TUR)).toBe(true);
  });

  it("Pearl Harbor sets congress to 100 percent for a year", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    warAfterPrep(runner, "HUMANITA", "GBR");
    const day = ww.day(runner.game.ticks());
    congressDay(d, US, day, JP);
    expect(d.mech.congressBp).toBe(10_000);
    expect(d.mech.congressFull).toBe(day + CONGRESS.pearlDays);
    expect(d.mech.attackedUntil).toBe(day + CONGRESS.attackedDays);
    // A year at 100%, whatever the tension.
    ww.politics.wtBp = 0;
    congressDay(d, US, day + CONGRESS.pearlDays, JP);
    expect(d.mech.congressBp).toBe(10_000);
    // Then it drifts toward 20% + tension / 2 again, 0.2 points a day.
    congressDay(d, US, day + CONGRESS.pearlDays + 1, JP);
    expect(d.mech.congressBp).toBe(10_000 - CONGRESS.stepBp);
  });

  it("an attack on a member of the US faction adds 40 percent for 90 days", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    warAfterPrep(runner, "HUMANITA", "FRA");
    expect(ww.politics.sameFaction(US, DEEP.tag.FRA)).toBe(true);
    const day = ww.day(runner.game.ticks());
    ww.politics.wtBp = 0;
    d.mech.congressBp = 5_000;
    // Another country (not Japan) declared: no Pearl Harbor. The target is
    // 20% + 0 + 40%: up 0.2 points a day.
    congressDay(d, US, day, DEEP.tag.TUR);
    expect(d.mech.congressFull).toBe(-1);
    expect(d.mech.attackedUntil).toBeGreaterThanOrEqual(day + 89);
    expect(d.mech.congressBp).toBe(5_000 + CONGRESS.stepBp);
    // After the 90 days the target is 20% again: down.
    congressDay(d, US, d.mech.attackedUntil + 1, DEEP.tag.TUR);
    expect(d.mech.congressBp).toBe(5_000);
  });

  it("the isolation spirit goes at 50 percent", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const c = ww.politics.country(US)!;
    c.spirits.push({ id: "usa_isolation", untilDay: -1, addedDay: 0 });
    ww.politics.wtBp = 8_000; // target 20% + 40% = 60%
    d.mech.congressBp = 4_970;
    congressDay(d, US, 10, JP);
    expect(d.mech.congressBp).toBe(4_990);
    expect(c.hasSpirit("usa_isolation")).toBe(true);
    congressDay(d, US, 11, JP);
    expect(d.mech.congressBp).toBe(5_010);
    expect(c.hasSpirit("usa_isolation")).toBe(false);
    expect(d.mech.isolationCleared).toBe(true);
    // Only the first time: a spirit put back later stays.
    setCongressBp(d, US, 4_000);
    c.spirits.push({ id: "usa_isolation", untilDay: -1, addedDay: 0 });
    setCongressBp(d, US, 5_500);
    expect(c.hasSpirit("usa_isolation")).toBe(true);
  });
});
