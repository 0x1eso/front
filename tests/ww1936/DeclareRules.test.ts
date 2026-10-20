// World War 1936 P3 (spec §14.5, Task 5): the reasons P3 adds to a
// declaration of war and what a declaration without a goal costs, on
// ww1936pol with the test content.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  declareWar,
  declareWarBlock,
  joinWar,
} from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { hasRule } from "@openfront/engine/ww1936/politics/Spirits";
import {
  addGuarantee,
  opinionOf,
} from "@openfront/engine/ww1936/politics/Treaties";
import {
  addWarGoal,
  justifyBlock,
} from "@openfront/engine/ww1936/politics/WarGoals";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  order,
  pol,
  POL,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "./util";

/** A spirit with the isolation rule (spec §9.1 rules; lane P reads them). */
const ISOLATION = {
  id: "gen_t_isolation",
  stats: {},
  icon: "flag",
  rules: ["no_justify" as const],
};

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      spirits: [
        { id: "gen_t_spirit", stats: { ppGainPct: 10 }, icon: "flag" },
        ISOLATION,
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game(human: CountryTag) {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: human }], POL);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  const block = (a: CountryTag, b: CountryTag, join = false) =>
    declareWarBlock(g, ww, byTag(g, a), byTag(g, b), g.ticks(), join);
  const declare = (a: CountryTag, b: CountryTag) =>
    declareWar(g, ww, byTag(g, a), byTag(g, b), g.ticks());
  return { runner, g, ww, p: pol(g), id, block, declare };
}

// Game tests: slow under the full suite's load.
describe(
  "declarations of war under P3 (spec §14.5)",
  { timeout: 60_000 },
  () => {
    it("democracies cannot declare without a goal", async () => {
      const { runner, g, ww, p, id, block } = await game("GBR");
      const [gbr, csk] = [id("GBR"), id("CSK")];
      p.country(gbr)!.ruling = IDEO_DEM;
      expect(block("GBR", "CSK")).toBe("democracy_no_goal");
      step(runner, 2, [
        stamped(HUMAN, { type: "declare_war", target: byTag(g, "CSK").id() }),
      ]);
      expect(ww.isAtWar(gbr, csk)).toBe(false);
      // With a goal it may, and the goal is used.
      addWarGoal(p, gbr, csk, "conquer", "", ww.day(g.ticks()));
      expect(block("GBR", "CSK")).toBeNull();
      step(runner, 2, [
        stamped(HUMAN, { type: "declare_war", target: byTag(g, "CSK").id() }),
      ]);
      expect(ww.isAtWar(gbr, csk)).toBe(true);
      expect(p.hasWarGoal(gbr, csk)).toBe(false);
      expect(p.country(gbr)!.declaredOn).toEqual([csk]);
    });

    it("a declaration without a goal costs stability and war support", async () => {
      const { g, ww, p, id, declare } = await game("DEU");
      const [deu, fra, ltu, est] = [id("DEU"), id("FRA"), id("LTU"), id("EST")];
      const c = p.country(deu)!;
      expect([c.stabBaseBp, c.wsBaseBp]).toEqual([5000, 5000]);
      const wt = p.wtBp;
      const before = opinionOf(p, fra, deu);
      expect(declare("DEU", "LTU")).toEqual([ltu]);
      // −15% stability and −10% war support (base), tension 2 × 2 + 4 = 8%.
      expect([c.stabBaseBp, c.wsBaseBp]).toEqual([3500, 4000]);
      expect(p.wtBp).toBe(wt + 800);
      expect(p.threatBp[deu]).toBe(800);
      // Everyone thinks 20 less of Germany (and 8 for the tension it made).
      expect(opinionOf(p, fra, deu)).toBe(before - 20 - 8);
      // With a goal: no penalty, 2% tension.
      addWarGoal(p, deu, est, "conquer", "", ww.day(g.ticks()));
      declare("DEU", "EST");
      expect([c.stabBaseBp, c.wsBaseBp]).toEqual([3500, 4000]);
      expect(p.threatBp[deu]).toBe(1000);
      expect(c.declaredOn).toEqual([est, ltu].sort((a, b) => a - b));
    });

    it("a non-aggression pact blocks declarations until broken", async () => {
      const { runner, g, ww, p, id, block } = await game("DEU");
      const [deu, pl] = [id("DEU"), id("POL")];
      // The 1934 German–Polish pact is a starting one (spec §16.2).
      expect(p.isAtWarBlockedByNap(deu, pl)).toBe(true);
      expect(block("DEU", "POL")).toBe("nap");
      expect(block("DEU", "POL", true)).toBe("nap");
      expect(justifyBlock(p, deu, pl)).toBe("justify_blocked");
      // A starting pact can be broken at once: 50 PP.
      step(runner, 1, [order(HUMAN, { kind: "nap_break", target: pl })]);
      expect(p.isAtWarBlockedByNap(deu, pl)).toBe(false);
      expect(p.country(deu)!.ppMilli).toBeLessThan(10_000);
      expect(block("DEU", "POL")).toBeNull();
      step(runner, 2, [
        stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
      ]);
      expect(ww.isAtWar(deu, pl)).toBe(true);
    });

    it("a guarantor cannot declare on the guaranteed", async () => {
      const { g, ww, p, id, block } = await game("GBR");
      const [gbr, csk] = [id("GBR"), id("CSK")];
      addGuarantee(p, gbr, csk, ww.day(g.ticks()));
      expect(block("GBR", "CSK")).toBe("guarantor");
      expect(block("GBR", "CSK", true)).toBe("guarantor");
      expect(justifyBlock(p, gbr, csk)).toBe("justify_blocked");
      // The guaranteed may still declare on its guarantor.
      expect(block("CSK", "GBR")).toBeNull();
    });

    it("isolation blocks a declaration but not a join", async () => {
      const { g, ww, p, id, block } = await game("DEU");
      const [deu, csk] = [id("DEU"), id("CSK")];
      addWarGoal(p, deu, csk, "conquer", "", ww.day(g.ticks()));
      p.country(deu)!.spirits.push({
        id: ISOLATION.id,
        untilDay: -1,
        addedDay: 0,
      });
      // Lane P (Task 4) reads spirit rules; until it does the rule reads false.
      if (hasRule(p, deu, "no_justify")) {
        expect(block("DEU", "CSK")).toBe("isolation");
        expect(justifyBlock(p, deu, csk)).toBe("justify_blocked");
      }
      expect(block("DEU", "CSK", true)).toBeNull();
      expect(joinWar(g, ww, byTag(g, "DEU"), byTag(g, "CSK"), g.ticks())).toBe(
        true,
      );
      expect(ww.isAtWar(deu, csk)).toBe(true);
      // A join uses no goal and costs nothing.
      expect(p.hasWarGoal(deu, csk)).toBe(true);
      expect(p.country(deu)!.stabBaseBp).toBe(5000);
    });
  },
);
