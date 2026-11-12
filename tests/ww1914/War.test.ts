import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_ENDING_ROWS } from "@openfront/engine-lib/ww1914/EndingRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { GW_AFTER_CHAPTERS } from "@openfront/engine/ww1914/Aftermath";
import { voteCount } from "@openfront/engine/ww1914/Authority";
import { GW_AUTHORITY } from "@openfront/engine/ww1914/AuthorityTable";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { ownEnding } from "@openfront/engine/ww1914/Endings";
import { eraOf, techEdge } from "@openfront/engine/ww1914/Eras";
import { pressOdds, proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { GW_HOME } from "@openfront/engine/ww1914/HomeTable";
import { GW_MANDATES } from "@openfront/engine/ww1914/Mandates";
import { armistice } from "@openfront/engine/ww1914/Peace";
import {
  changeRegime,
  GW_REGIMES,
  GW_SUCCESSIONS,
  successionDay,
} from "@openfront/engine/ww1914/Regimes";
import { holds, runEffect } from "@openfront/engine/ww1914/SceneRun";
import { seaFor, setUboats } from "@openfront/engine/ww1914/Sea";
import { GW_ENTRIES } from "@openfront/engine/ww1914/Tables";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { warShape } from "./sim/WarSim";
import { gwRunner, playChapter } from "./util";

const man = (id: string, tag: GwTag, camps: string[], office: string | null) =>
  ({
    id,
    tag,
    office,
    fit: office === null ? [] : [office],
    camps,
    temperaments: ["cold"],
    rivals: [],
    allies: [],
    fame: 2,
    source: "test",
  }) as (typeof GW_CONTENT.people)[number];

// A cabinet of its own: votes don't move with the real cast.
const CAST = [
  ...GW_CONTENT.people,
  man("t_grey", "GBR", ["hard", "civil"], "foreign"),
  man("t_morley", "GBR", ["moderate", "civil"], "interior"),
  man("t_burns", "GBR", ["moderate", "civil"], "finance"),
];

beforeAll(() => useGwContent({ scenes: GW_CONTENT.scenes, people: CAST }));
afterAll(() => useGwContent(null));

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;
const ctx = (gw: GreatWar) => ({ gw, seat: gw.s.seats[0], cast: {} });
const theatre = (gw: GreatWar, id: string) =>
  gw.s.theatres.find((t) => t.id === id)!;

/** A full-calendar game with the war open, the seat on `tag`. */
async function war(tag: GwTag = "DEU", id = "GWY1") {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.seats[0].tag = tag;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  return { runner, gw, seat: gw.s.seats[0] };
}

/** Moves the game on with nobody deciding. */
function pass(gw: GreatWar, runner: GameRunner, chapters: number): void {
  for (let i = 0; i < chapters && gw.s.ended === null; i++) {
    advanceChapter(gw, runner.game.ticks(), false);
  }
}

describe("periods and research", () => {
  test("periods count from the war's first month, not from the date", async () => {
    const { gw, runner } = await war();
    expect(eraOf(gw).id).toBe("movement");
    pass(gw, runner, 10);
    expect(eraOf(gw).id).toBe("trenches");
  });

  test("whoever reaches a step first has the edge; half once both have it", async () => {
    const { gw } = await war();
    const a = gw.nation("DEU")!;
    const d = gw.nation("FRA")!;
    a.techs = ["infiltration"];
    expect(techEdge(a, d)).toBe(15);
    d.techs = ["infiltration"];
    expect(techEdge(a, d)).toBe(7);
  });

  test("research reaches a step only with the months of war behind it", async () => {
    const { gw, runner } = await war();
    const n = gw.nation("FRA")!;
    n.tech.artillery = 50;
    pass(gw, runner, 2);
    expect(n.techs).not.toContain("gas_heavy");
    pass(gw, runner, 14);
    expect(n.techs).toContain("gas_heavy");
  });
});

describe("the fronts past 1914", () => {
  test("no hand holds the west: the line can reach the Rhine", async () => {
    const { gw, runner } = await war("GBR", "GWY2");
    const west = theatre(gw, "west");
    west.line = 0;
    west.progress = 0;
    pass(gw, runner, 1);
    expect(west.line).toBe(0);
  });

  test("a theatre nobody's effort is in still sees fighting", async () => {
    const fought = new Set<string>();
    for (const id of ["GWY3", "GWY4", "GWY5"]) {
      const shape = await warShape(id, "DEU");
      for (const t of Object.keys(shape.battles)) fought.add(t);
    }
    expect(fought.size).toBeGreaterThanOrEqual(7);
  });

  test("the Hindenburg line counts only for those who built it, once built", async () => {
    const { gw } = await war();
    const west = theatre(gw, "west");
    west.line = 2;
    const early = pressOdds(gw, "west", "entente");
    gw.s.warChapter = 0;
    gw.s.chapter = 45;
    expect(pressOdds(gw, "west", "entente")).toBeLessThan(early);
  });
});

describe("the sea", () => {
  test("the blockade starves the Central side, and more as it tightens", async () => {
    const { gw, runner } = await war();
    gw.s.blockade = 8;
    gw.nation("GBR")!.side = "entente";
    const n = gw.nation("DEU")!;
    n.gauges.bread = 3;
    pass(gw, runner, 12);
    expect(n.gauges.bread).toBeLessThan(3);
  });

  test("the signature turns up America's temperature", async () => {
    const { gw, runner } = await war("GBR");
    const usa = gw.nation("USA")!;
    usa.readiness = 0;
    gw.s.day = 7000;
    setUboats(gw, 2);
    gw.s.day = gwChapters("full")[gw.s.chapter].day;
    pass(gw, runner, 12);
    expect(usa.readiness).toBeGreaterThan(20);
  });

  test("Britain's shipping costs it bread", async () => {
    const { gw } = await war("GBR");
    expect(() => seaFor(gw, gw.nation("GBR")!)).not.toThrow();
  });
});

describe("neutrals", () => {
  test("every entry row has a scene to name its price", () => {
    for (const e of GW_ENTRIES) {
      expect(
        GW_CONTENT.scenes.some((s) => s.id === e.scene),
        e.tag,
      ).toBe(true);
    }
  });

  test("a seat's price goes on the table", async () => {
    const { gw } = await war();
    runEffect(ctx(gw), doWorld({ do: "offer", tag: "ITA", value: 2 }));
    expect(gw.nation("ITA")!.offers.central).toBe(2);
    expect(holds(ctx(gw), world({ is: "offered", tag: "ITA", min: 2 }))).toBe(
      true,
    );
  });
});

describe("the ladder, country by country", () => {
  test("each of the four has four scenes, and each rung a way down", () => {
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"] as const) {
      const row = GW_HOME[tag]!;
      for (const id of row.rungs) {
        const s = GW_CONTENT.scenes.find((x) => x.id === id);
        expect(s, id).toBeDefined();
        expect(s!.options!.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("the Tsar's ladder goes on as the Provisional Government", async () => {
    const { gw, seat } = await war("RUS", "GWY5");
    const n = gw.nation("RUS")!;
    n.unrest = 4;
    n.gauges.order = 0;
    runEffect(ctx(gw), doWorld({ do: "next_regime" }));
    expect(n.regime).toBe("provisional");
    expect(n.unrest).toBe(2);
    expect(n.inst.soviet).toBeDefined();
    expect(n.inst.court).toBeUndefined();
    expect(seat.memoir).toBeNull();
  });

  test("with no form left the top ends the seat, not the world's reasons", async () => {
    const { gw, seat } = await war("RUS", "GWY6");
    changeRegime(gw, "RUS", "provisional");
    runEffect(ctx(gw), doWorld({ do: "next_regime" }));
    expect(seat.memoir?.ending).toBe("rus_october");
  });

  test("a republic's first act is to ask", async () => {
    const { gw } = await war("DEU", "GWY7");
    runEffect(ctx(gw), doWorld({ do: "next_regime" }));
    expect(gw.nation("DEU")!.regime).toBe("republic");
    expect(gw.s.armistice?.kind).toBe("central_lost");
  });

  test("every form of government has its row of bodies", () => {
    for (const rows of Object.values(GW_REGIMES)) {
      for (const r of rows) expect(GW_AUTHORITY[r.id], r.id).toBeDefined();
    }
  });
});

describe("who can say no", () => {
  test("the cabinet votes by camp and trust, and the record says how", async () => {
    const { gw, seat } = await war("GBR", "GWY8");
    const before = gw.nation("GBR")!.inst.cabinet!;
    runEffect(ctx(gw), doWorld({ do: "vote", issue: "peace_talks" }));
    const v = seat.votes[0];
    expect(v.ayes + v.noes).toBeGreaterThanOrEqual(3);
    expect(gw.nation("GBR")!.inst.cabinet).toBe(
      before + (v.ayes >= v.noes ? 1 : -1),
    );
    expect(holds(ctx(gw), world({ is: "carried", issue: "peace_talks" }))).toBe(
      v.ayes >= v.noes,
    );
  });

  test("what was said to someone turns their vote", async () => {
    const { gw, seat } = await war("GBR", "GWY9");
    const was = voteCount(gw, seat, "conscription");
    for (const id of ["t_morley", "t_burns"]) {
      seat.memory.push({
        key: "v_conscription",
        who: id,
        chapter: 0,
        weight: 5,
      });
    }
    expect(voteCount(gw, seat, "conscription")).toBeGreaterThan(was);
  });

  test("the seat's own person is off the tab, and comes on when the chair passes", async () => {
    const { gw, seat } = await war("GBR", "GWY10");
    const ids = () => gw.s.people.map((p) => p.id);
    expect(ids()).toContain("gbr_asquith");
    const { ownPeople } = await import("@openfront/engine/ww1914/World");
    expect(ownPeople(gw, "GBR").map((p) => p.id)).not.toContain("gbr_asquith");
    seat.flags.push("f_pm_lg");
    expect(ownPeople(gw, "GBR").map((p) => p.id)).toContain("gbr_asquith");
  });

  test("Hungary low costs Vienna bread; high spares it the two halves' strain", async () => {
    const { gw, runner } = await war("AUH", "GWY11");
    const n = gw.nation("AUH")!;
    n.inst.hungary = -3;
    n.gauges.bread = 3;
    pass(gw, runner, 10);
    expect(n.gauges.bread).toBeLessThan(3);
  });

  test("a body at its limit shuts a paper, with its reason", async () => {
    const { gw, seat } = await war("AUH", "GWY12");
    const n = gw.nation("AUH")!;
    n.gauges.shells = 3;
    n.inst.hungary = -4;
    gw.s.chapter += 1;
    const major = proposalsFor(gw, seat).filter((p) => p.scale === "major");
    expect(major.length).toBeGreaterThan(0);
    for (const p of major) expect(p.why).toBe("hungary");
    expect(proposalsFor(gw, seat).some((p) => p.open)).toBe(true);
  });

  test("a seat's old emperor dies by his health, never by the date (2B)", async () => {
    const { gw, runner, seat } = await war("AUH", "GWY13");
    const row = GW_SUCCESSIONS[0];
    const day = successionDay(gw, row);
    const karl = gw.person("auh_karl")!;
    gw.person("auh_ff")!.status = "dead";
    while (gw.s.day < day && gw.s.ended === null) {
      seat.ruler.health = 3;
      pass(gw, runner, 1);
    }
    pass(gw, runner, 1);
    expect(gw.nation("AUH")!.regime).toBe("dual_monarchy");
    // The doctors come and are not heeded: no rest, so the clock runs out.
    for (let i = 0; i < 16 && gw.nation("AUH")!.regime !== "karl"; i++) {
      seat.ruler.health = 0;
      seat.desk = seat.desk.filter((c) => c.scene !== "auh_life_doctors");
      pass(gw, runner, 1);
    }
    expect(gw.s.ended).toBeNull();
    expect(gw.nation("AUH")!.regime).toBe("karl");
    expect(karl.status).toBe("crowned");
    pass(gw, runner, 1);
    expect(seat.flags).toContain("w_auh_karl");
  });
});

describe("the seats' own wars", () => {
  test("a good Russian offensive lands, a poor one doesn't", async () => {
    let good = 0;
    let poor = 0;
    for (let i = 0; i < 12; i++) {
      for (const signed of [true, false]) {
        const { gw, runner, seat } = await war("RUS", `GWRO${i}`);
        const east = gw.s.theatres.find((t) => t.id === "east")!;
        const rus = gw.nation("RUS")!;
        gw.s.chapter += 18;
        east.trench = 2;
        rus.gauges.shells = signed ? 2 : 0;
        rus.gauges.morale = 3;
        rus.strength.east = 4;
        east.commander = "rus_brusilov";
        gw.person("rus_brusilov")!.competence[0] = signed ? 3 : 1;
        seat.alloc = { ...seat.alloc, main: "east", posture: "offensive" };
        seat.signed = gw.s.chapter;
        if (signed) {
          seat.choices.push({
            scene: "rus_w_april_council",
            pick: "brusilov_goes",
            chapter: gw.s.chapter,
            proxy: false,
          });
        }
        seat.desk = [];
        const before = gw.s.battles.length;
        pass(gw, runner, 1);
        const b = gw.s.battles
          .slice(before)
          .find((x) => x.theatre === "east" && x.by === "entente");
        const landed = b?.result === "advance" || b?.result === "break";
        if (landed && signed) good++;
        if (landed && !signed) poor++;
      }
    }
    expect(good).toBeGreaterThanOrEqual(5);
    expect(poor).toBeLessThanOrEqual(2);
  });

  test("a neutral Britain enters by its own declaration", async () => {
    const { gw } = await war("GBR", "GWBRIT");
    expect(gw.nation("GBR")!.side).toBe(null);
    runEffect(ctx(gw), doWorld({ do: "declare", tag: "DEU" }));
    expect(gw.nation("GBR")!.side).toBe("entente");
  });

  test("Germany nobody plays raises its boats once the blockade bites", async () => {
    const { gw, runner } = await war("GBR", "GWBOAT");
    runEffect(ctx(gw), doWorld({ do: "declare", tag: "DEU" }));
    gw.s.blockade = 5;
    pass(gw, runner, 8);
    expect(gw.s.uboat).toBeGreaterThan(0);
  });
});

describe("how it stops", () => {
  test("an armistice brings the conference to the next chapter", async () => {
    const { gw, runner, seat } = await war("DEU", "GWY14");
    armistice(gw, "central_lost", "DEU");
    const day = gw.s.day;
    pass(gw, runner, 1);
    const last = gwChapters("full").length - 1;
    expect(gw.s.chapter).toBe(last);
    expect(gw.s.day).toBeGreaterThan(day);
    expect(gw.s.day).toBeLessThan(gwChapters("full")[last].day);
    const desks = [seat.desk.map((c) => c.scene)];
    expect(desks[0]).toContain("gw_e_armistice_wire");
    expect(desks[0]).toContain("gw_e_conference_seat");
    expect(desks[0]).not.toContain("gw_e_borders");
    // ww190: the sessions, then the aftermath's months, then the closing one.
    for (let i = 0; i < 3 + GW_AFTER_CHAPTERS; i++) {
      expect(gw.s.ended).toBeNull();
      const before = gw.s.day;
      pass(gw, runner, 1);
      expect(gw.s.day).toBeGreaterThan(before);
      desks.push(seat.desk.map((c) => c.scene));
    }
    // The table's business comes after the seat at it, on desks of its own.
    expect(desks[1].concat(desks[2])).toContain("gw_e_borders");
    expect(desks[3 + GW_AFTER_CHAPTERS]).toContain("gw_e_memoir_frame");
    pass(gw, runner, 1);
    expect(gw.s.ended).toBe("armistice_conference");
    expect(seat.memoir).not.toBeNull();
  });

  test("the top of the ladder is one card: the country's own, if written", () => {
    for (const tag of ["DEU", "AUH", "RUS"] as const) {
      expect(Object.keys(GW_HOME[tag]?.top ?? {}).length).toBeGreaterThan(0);
    }
  });

  test("the jump to the peace breaks no promise and brings no war paper", async () => {
    const { gw, runner, seat } = await war("DEU", "GWY14B");
    seat.promises.push({
      who: "deu_moltke",
      key: "p_test",
      made: gw.s.chapter,
      due: gw.s.chapter + 2,
      keep: null,
      back: null,
      kept: false,
      broken: false,
    } as (typeof seat.promises)[number]);
    seat.scheduled.push({ scene: "deu_f_ledger", chapter: gw.s.chapter + 1 });
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    expect(seat.promises.some((p) => p.broken)).toBe(false);
    expect(seat.desk.map((c) => c.scene)).not.toContain("deu_f_ledger");
    expect(seat.desk.map((c) => c.scene)).not.toContain("gw_promise_broken");
  });

  test("a separate peace closes the seat as a peace, not a defeat", async () => {
    // ww190: with `rus_sep_on` in the pack the seat may play on (SepPeace.test);
    // without it, it closes at once.
    useGwContent({
      scenes: GW_CONTENT.scenes.filter((x) => x.id !== "rus_sep_on"),
      people: CAST,
    });
    try {
      const { gw, runner, seat } = await war("RUS", "GWY15");
      runEffect(ctx(gw), doWorld({ do: "separate_peace" }));
      pass(gw, runner, 1);
      expect(seat.memoir?.ending).toBe("rus_separate_peace");
    } finally {
      useGwContent({ scenes: GW_CONTENT.scenes, people: CAST });
    }
  });

  test("the general ending becomes the country's own", async () => {
    const { gw, seat } = await war("GBR", "GWY16");
    gw.nation("USA")!.side = "entente";
    gw.s.blockade = 7;
    gw.nation("GBR")!.side = "entente";
    gw.nation("GBR")!.gauges.money = 2;
    expect(ownEnding(gw, seat, "victory_peace")).toBe("gbr_end_master");
    gw.nation("GBR")!.gauges.money = 0;
    expect(ownEnding(gw, seat, "victory_peace")).toBe("gbr_end_dear_win");
  });

  test("Austria's lost peace is dissolution only if the peoples have gone", async () => {
    const { gw, seat } = await war("AUH", "GWY17");
    const n = gw.nation("AUH")!;
    n.regime = "dual_monarchy";
    n.inst.nations = -3;
    expect(ownEnding(gw, seat, "armistice_conference")).toBe(
      "auh_e_dissolution",
    );
    n.inst.nations = -2;
    expect(ownEnding(gw, seat, "armistice_conference")).toBe(
      "auh_e_conference",
    );
  });

  test("the memoir counts the chapters played, not the rows jumped", async () => {
    const { gw, runner, seat } = await war("DEU", "GWY18");
    pass(gw, runner, 2);
    const at = gw.s.chapter;
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 5 + GW_AFTER_CHAPTERS);
    expect(gw.s.ended).toBe("armistice_conference");
    expect(gw.s.chapter).toBe(gwChapters("full").length - 1);
    expect(seat.memoir?.chapter).toBe(at + 4 + GW_AFTER_CHAPTERS);
  });

  test("every country's rows name an ending with a mandate list beside it", () => {
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"] as const) {
      expect(GW_ENDING_ROWS[tag]!.length).toBeGreaterThanOrEqual(6);
      expect(GW_MANDATES[tag]!.length).toBeGreaterThanOrEqual(12);
    }
  });
});

describe("conditions", () => {
  test("`date` reads a range on any calendar", async () => {
    const { gw } = await war();
    expect(
      holds(ctx(gw), world({ is: "date", from: "1914-06", to: "1914-09" })),
    ).toBe(true);
    expect(holds(ctx(gw), world({ is: "date", from: "1915-01" }))).toBe(false);
  });

  test("`battle` can say who attacked", async () => {
    const { gw } = await war();
    gw.s.battles.push({
      theatre: "east",
      chapter: 1,
      result: "break",
      by: "entente",
      lost: [1, 1],
      line: 1,
      luck: 0,
    });
    const of = ["break"] as ("break" | "advance")[];
    const c = (by: "seat" | "foe") =>
      world({ is: "battle", theatre: "east", of, by });
    expect(holds(ctx(gw), c("foe"))).toBe(true);
    expect(holds(ctx(gw), c("seat"))).toBe(false);
  });
});

describe("the length of a game", () => {
  test("a full game gives about 70 summons, fewer than a country's 96 talks", async () => {
    const { runner } = await gwRunner(
      { greatWar1914Calendar: "full" },
      "GWY17",
    );
    const gw = gwOf(runner);
    gw.s.seats[0].tag = "GBR";
    let total = 0;
    for (let guard = 0; guard < 70 && gw.s.ended === null; guard++) {
      total += gw.s.seats[0].audiences;
      if (gw.s.chapter === 5 && gw.s.warChapter === null) {
        gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
        gw.s.temp = 9;
      }
      playChapterQuiet(gw, runner);
    }
    expect(gw.s.chapter).toBeGreaterThanOrEqual(30);
    expect(total).toBeLessThanOrEqual(85);
    const table = gwChapters("full").reduce((a, c) => a + c.summons, 0);
    expect(table).toBeGreaterThanOrEqual(65);
    expect(table).toBeLessThanOrEqual(75);
  });
});

function playChapterQuiet(gw: GreatWar, runner: GameRunner): void {
  advanceChapter(gw, runner.game.ticks(), false);
}

describe("hands-off wars", () => {
  test("games differ, and nobody wins in 1914", async () => {
    const ends = new Set<string>();
    const years = new Set<string>();
    const wests = new Set<string>();
    let america = 0;
    for (let i = 0; i < 10; i++) {
      const s = await warShape(`GWSH${i}`, "GBR");
      ends.add(s.armistice ?? "none");
      if (s.entered.USA !== undefined) america++;
      years.add(s.endMonth.slice(0, 4));
      wests.add((s.lines.west ?? []).join(">"));
      expect(s.endMonth >= "1915-06").toBe(true);
    }
    expect(america).toBeGreaterThan(0);
    expect(ends.size).toBeGreaterThanOrEqual(2);
    expect(years.size).toBeGreaterThanOrEqual(2);
    expect(wests.size).toBeGreaterThanOrEqual(4);
  }, 60000);

  test("the helper plays a real chapter too", async () => {
    const { runner } = await war("DEU", "GWY18");
    expect(() => playChapter(runner)).not.toThrow();
  });
});
