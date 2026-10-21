// World War 1936 P3 (spec §8.1, §8.4; plan decision 19; controller ruling
// R9): advisors, on the test map ww1936pol with the test content and a
// few test persons for Britain.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { TRAITS } from "@openfront/engine-lib/ww1936/content/advisors";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { assignGeneral } from "@openfront/engine/ww1936/land/GeneralsRun";
import {
  candidatesFor,
  fireAdvisor,
  hireAdvisor,
} from "@openfront/engine/ww1936/politics/Advisors";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { setGovernment } from "@openfront/engine/ww1936/politics/Ideology";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  placeArmy,
  pol,
  POL,
  step,
  stepTo,
  wwRunner,
} from "./util";

const person = (
  id: string,
  slot: "political" | "army_chief" | "research",
  trait: (typeof TRAITS)[number]["id"],
  extra: object = {},
) => ({
  id,
  nameKey: `ww1936.person.${id}`,
  country: "GBR" as const,
  roles: ["advisor" as const],
  advisor: { slot, traits: [trait] },
  source: "test",
  ...extra,
});

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      persons: [
        person("t_dated", "political", "hawk", {
          from: "1936-01-11",
          until: "1936-02-01",
        }),
        person("t_locked", "research", "rs_science", { locked: true }),
        person("t_gort", "army_chief", "chief_defense", {
          alsoGeneral: "gort",
        }),
        person("t_dem", "political", "orator", { ideology: "democratic" }),
        person("t_planner", "political", "planner"),
      ],
      spirits: [
        { id: "t_cheap", stats: { advisorCostPct: -50 }, icon: "flag" },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "GBR" }], POL);
  step(runner);
  const g = runner.game;
  const p = pol(g);
  const gbr = byTag(g, "GBR").smallID();
  const c = p.country(gbr)!;
  c.ppMilli = 1_000_000;
  return { runner, g, p, gbr, c };
}

/** The titled cards a neutral government is offered (no communist planner). */
const TITLES = TRAITS.filter((t) => t.generic && t.ideology === undefined).map(
  (t) => `title:${t.id}`,
);

describe("advisors", () => {
  it("advisors cost PP and cannot be rehired for free", async () => {
    const { p, gbr, c } = await game();
    expect(hireAdvisor(p, gbr, 0, "title:administrator", 0)).toBeNull();
    expect(c.ppMilli).toBe(850_000);
    expect(c.advisors[0]).toBe("title:administrator");
    expect(c.stats.ppGainPct).toBe(10);
    // One seat a person; a seat takes its own branch.
    expect(hireAdvisor(p, gbr, 1, "title:administrator", 0)).toBe(
      "advisor_unavailable",
    );
    expect(hireAdvisor(p, gbr, 4, "title:hawk", 0)).toBe("advisor_unavailable");
    expect(hireAdvisor(p, gbr, 4, "title:theorist_land", 0)).toBeNull();
    expect(c.ppMilli).toBe(750_000);
    // P4: seats 8 and 9 are the navy and air chiefs'.
    expect(hireAdvisor(p, gbr, 8, "title:hawk", 0)).toBe("advisor_unavailable");
    expect(hireAdvisor(p, gbr, 10, "title:hawk", 0)).toBe("bad_index");
    expect(hireAdvisor(p, gbr, 1, "title:war_leader", 0)).toBe(
      "advisor_unavailable",
    );
    // advisorCostPct: an army chief for 50.
    c.spirits.push({ id: "t_cheap", untilDay: -1, addedDay: 0 });
    p.recomputeStats(gbr);
    expect(hireAdvisor(p, gbr, 3, "title:chief_offense", 0)).toBeNull();
    expect(c.ppMilli).toBe(700_000);
    // Dismissal is free; hiring again pays again.
    expect(fireAdvisor(p, gbr, 0, 30)).toBeNull();
    expect(c.ppMilli).toBe(700_000);
    expect(c.stats.ppGainPct).toBe(0);
    expect(hireAdvisor(p, gbr, 0, "title:administrator", 60)).toBeNull();
    expect(c.ppMilli).toBe(625_000);
    // Short of PP: refused, nothing paid.
    c.ppMilli = 10_000;
    expect(hireAdvisor(p, gbr, 1, "title:orator", 60)).toBe("no_pp");
    expect(c.ppMilli).toBe(10_000);
    expect(c.advisors[1]).toBeNull();
  });

  it("a seat is locked for 30 days after a change", async () => {
    const { p, gbr, c } = await game();
    expect(hireAdvisor(p, gbr, 0, "title:administrator", 10)).toBeNull();
    expect(c.advisorLockUntil[0]).toBe(40);
    expect(fireAdvisor(p, gbr, 0, 39)).toBe("slot_locked");
    // Another seat is free.
    expect(hireAdvisor(p, gbr, 1, "title:orator", 39)).toBeNull();
    expect(fireAdvisor(p, gbr, 0, 40)).toBeNull();
    expect(hireAdvisor(p, gbr, 0, "title:administrator", 69)).toBe(
      "slot_locked",
    );
    expect(fireAdvisor(p, gbr, 2, 69)).toBe("advisor_unavailable");
    expect(hireAdvisor(p, gbr, 0, "title:administrator", 70)).toBeNull();
    // A seated advisor is replaced by a hire (the seat's lock permitting).
    expect(hireAdvisor(p, gbr, 0, "title:security_chief", 100)).toBeNull();
    expect(c.advisors[0]).toBe("title:security_chief");
  });

  it("a person outside their dates is not a candidate", async () => {
    const { runner, g, p, gbr, c } = await game();
    // Persons in content order, then every generic trait's titled card.
    expect(candidatesFor(p, gbr, 9)).toEqual(["t_gort", ...TITLES]);
    expect(candidatesFor(p, gbr, 10)).toEqual(["t_dated", "t_gort", ...TITLES]);
    expect(candidatesFor(p, gbr, 31)).toEqual(["t_gort", ...TITLES]);
    expect(hireAdvisor(p, gbr, 0, "t_dated", 9)).toBe("advisor_unavailable");
    expect(hireAdvisor(p, gbr, 7, "t_locked", 9)).toBe("advisor_unavailable");
    // Controller ruling R9: an effect opens a person whatever the dates,
    // a locked one only so.
    applyEffects(makeCtx(p, gbr, gbr, 0, g.ticks()), [
      { kind: "add_advisor_candidate", person: "t_locked" },
    ]);
    expect(c.candidates).toEqual(["t_locked"]);
    expect(candidatesFor(p, gbr, 9)).toContain("t_locked");
    expect(hireAdvisor(p, gbr, 7, "t_locked", 9)).toBeNull();
    // A seated person leaves on their `until` (an opened one stays).
    expect(hireAdvisor(p, gbr, 0, "t_dated", 20)).toBeNull();
    const msg = vi.spyOn(g, "displayMessage");
    const at = (d: number) =>
      stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (gbr % WW_DAY_SPLIT) + 1);
    at(30);
    expect(c.advisors[0]).toBe("t_dated");
    at(31);
    expect(c.advisors[0]).toBeNull();
    expect(c.advisors[7]).toBe("t_locked");
    expect(msg).toHaveBeenCalledWith(
      "events_display.ww1936_advisor_left",
      expect.anything(),
      byTag(g, "GBR").id(),
      undefined,
      { person: "t_dated" },
    );
    // Seated people are not offered again.
    expect(candidatesFor(p, gbr, 31)).not.toContain("t_locked");
  }, 60_000);

  it("a general leading an army cannot be hired, an advisor cannot lead (decision 19)", async () => {
    const { g, p, gbr, c } = await game();
    const land = g.worldWar()!.land;
    const cl = land.country(gbr)!;
    const gort = cl.generals.find(
      (x) => x.roster === GENERALS.findIndex((d) => d.id === "gort"),
    )!;
    const army = land.armiesOf(gbr)[0] ?? placeArmy(g, "GBR", 10, 1);
    expect(assignGeneral(land, cl, army.id, gort.id)).toBeNull();
    expect(candidatesFor(p, gbr, 0)).not.toContain("t_gort");
    expect(hireAdvisor(p, gbr, 3, "t_gort", 0)).toBe("advisor_unavailable");
    expect(assignGeneral(land, cl, army.id, 0)).toBeNull();
    expect(candidatesFor(p, gbr, 0)).toContain("t_gort");
    expect(hireAdvisor(p, gbr, 3, "t_gort", 0)).toBeNull();
    expect(c.stats.defensePct).toBe(5);
    expect(assignGeneral(land, cl, army.id, gort.id)).toBe(
      "general_unavailable",
    );
    expect(fireAdvisor(p, gbr, 3, 30)).toBeNull();
    expect(assignGeneral(land, cl, army.id, gort.id)).toBeNull();
  });

  it("an advisor whose trait is bound to an ideology serves that government only (spec §5.6-5)", async () => {
    const { g, p, gbr, c } = await game();
    // Neutral Britain: neither the communist planner card nor a planner.
    expect(candidatesFor(p, gbr, 0)).not.toContain("title:planner");
    expect(candidatesFor(p, gbr, 0)).not.toContain("t_planner");
    expect(hireAdvisor(p, gbr, 0, "title:planner", 0)).toBe(
      "advisor_unavailable",
    );
    c.ruling = IDEO_COM;
    expect(candidatesFor(p, gbr, 0)).toContain("title:planner");
    expect(candidatesFor(p, gbr, 0)).toContain("t_planner");
    expect(hireAdvisor(p, gbr, 0, "title:planner", 0)).toBeNull();
    expect(hireAdvisor(p, gbr, 1, "t_planner", 0)).toBeNull();
    expect(hireAdvisor(p, gbr, 2, "title:orator", 0)).toBeNull();
    expect(c.stats.milConstructionPct).toBe(20);
    setGovernment(p, gbr, IDEO_FAS, g.ticks());
    expect(c.advisors.slice(0, 3)).toEqual([null, null, "title:orator"]);
    expect(c.stats.milConstructionPct).toBe(0);
  });

  it("a government change dismisses advisors of another ideology", async () => {
    const { g, p, gbr, c } = await game();
    // Neutral Britain: no democratic advisor.
    expect(candidatesFor(p, gbr, 0)).not.toContain("t_dem");
    c.ruling = IDEO_DEM;
    expect(candidatesFor(p, gbr, 0)).toContain("t_dem");
    expect(hireAdvisor(p, gbr, 0, "t_dem", 0)).toBeNull();
    expect(hireAdvisor(p, gbr, 1, "title:orator", 0)).toBeNull();
    const pp = c.ppMilli;
    setGovernment(p, gbr, IDEO_FAS, g.ticks());
    expect(c.advisors.slice(0, 2)).toEqual([null, "title:orator"]);
    // No refund; the seat's lock stays as it was.
    expect(c.ppMilli).toBe(pp);
    expect(candidatesFor(p, gbr, 0)).not.toContain("t_dem");
  });
});
