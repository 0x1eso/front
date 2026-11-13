// ww208 S1: the society (design /home/eser/dev/ww207-factions.md §11, cases
// 1, 2, 3 and 6; S2 writes the utopias' cases). Fixture content: the W lanes
// fill the real communities, ideals and pushes; these give a few of their own.
import type { GwNationState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwLawStart } from "@openfront/engine-api/ww1914/GwLaw";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
  type GwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import type { GwFactionRow } from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { GW_RALLY_SCENE } from "@openfront/engine-lib/ww1914/PowerRows";
import type { GwSocietyContent } from "@openfront/engine-lib/ww1914/SocietyRows";
import {
  factionOf,
  houseRow,
  houseStep,
  houseView,
} from "@openfront/engine/ww1914/House";
import { lawAiStep, lawStep, lawViews } from "@openfront/engine/ww1914/Laws";
import { runEffects } from "@openfront/engine/ww1914/SceneRun";
import {
  axisStep,
  electionDue,
  generalElection,
  lawAxes,
  societyStep,
  societyView,
  supportOf,
} from "@openfront/engine/ww1914/Society";
import { utopiaStep } from "@openfront/engine/ww1914/Utopia";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

afterEach(() => useGwContent(null));

const LAWS = GW_LAWS as GwLawRow[];

/** Runs `fn` with these law rows in the book, then takes them out. */
function withLaws<T>(rows: readonly GwLawRow[], fn: () => T): T {
  LAWS.push(...rows);
  try {
    return fn();
  } finally {
    LAWS.splice(LAWS.length - rows.length, rows.length);
  }
}

function fixture(
  ideals: Record<string, GwFactionRow["ideals"]>,
  society: GwSocietyContent = {},
  /** ww208 merge: the other factions hold no ideals (the W lanes' aside). */
  only = false,
): GwContent {
  return {
    ...GW_CONTENT,
    factions: (GW_CONTENT.factions ?? []).map((f) =>
      ideals[f.id] !== undefined
        ? { ...f, ideals: ideals[f.id] }
        : only
          ? { ...f, ideals: {} }
          : f,
    ),
    society: {
      communities: society.communities ?? [],
      births: society.births ?? [],
      generic: [
        ...(GW_CONTENT.society?.generic ?? []),
        ...(society.generic ?? []),
      ],
    },
  };
}

async function deu() {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  houseStep(gw);
  const seat = gw.s.seats[0];
  return { gw, seat, n: gw.nation("DEU")! as GwNationState };
}

/** Runs the society step over these chapters, as the clock would. */
function chapters(
  gw: Awaited<ReturnType<typeof deu>>["gw"],
  from: number,
  to: number,
) {
  for (let c = from; c <= to; c++) {
    gw.s.chapter = c;
    societyStep(gw);
  }
}

describe("ww208 society", () => {
  test("a peace bill opens in peace and when neutral, and works after the armistice", async () => {
    const { gw, seat, n } = await deu();
    const base = LAWS.find((r) => r.tag === "DEU")!;
    const peace: GwLawRow = {
      ...base,
      id: "deu_t_peace",
      peace: true,
      opens: all(),
      term: [{ gauge: "order", delta: 1, every: 1 }],
      settled: undefined,
      after: undefined,
      flag: undefined,
      replaces: undefined,
    };
    withLaws([peace], () => {
      const open = () => lawViews(gw, seat).some((v) => v.id === peace.id);
      n.atWar = [];
      expect(open()).toBe(true);
      n.atWar = ["FRA"];
      expect(open()).toBe(false);
      // Neutral while the others fight: no war of its own.
      n.atWar = [];
      expect(open()).toBe(true);
      // In force after the armistice, its terms still work.
      n.laws.push({ ...gwLawStart(peace.id), stage: "force" });
      gw.s.warChapter = 0;
      gw.s.chapter = 10;
      gw.s.armistice = {} as never;
      n.gauges.order = 1;
      lawStep(gw);
      expect(n.gauges.order).toBe(2);
    });
  });

  test("a passed bill moves an axis; support follows; an election redraws the seats", async () => {
    useGwContent(
      fixture({
        deu_spd: { rule: 1, class: 1, force: 1 },
        deu_cons: { rule: -1, class: -1, force: -1 },
      }),
    );
    const { gw, seat, n } = await deu();
    const row: GwLawRow = {
      ...LAWS.find((r) => r.tag === "DEU")!,
      draft: [
        { ...LAWS.find((r) => r.tag === "DEU")!.draft[0], axes: { class: 1 } },
      ],
    };
    lawAxes(gw, seat, row, null);
    expect(n.axes?.class).toBe(1);
    // Twenty bills later, the country stands two steps toward labour.
    n.axes = { class: 20 };
    expect(axisStep(n, "class")).toBe(2);
    const spd = factionOf(seat, "deu_spd")!;
    const cons = factionOf(seat, "deu_cons")!;
    const spd0 = supportOf(spd);
    const cons0 = supportOf(cons);
    chapters(gw, 8, 20);
    expect(supportOf(spd)).toBeGreaterThan(spd0);
    expect(supportOf(cons)).toBeLessThan(cons0);
    const e = generalElection(gw, seat, "reichstag", "due")!;
    const of = (id: string) => e.seats.find((s) => s.faction === id)!;
    expect(of("deu_spd").after).toBeGreaterThan(of("deu_spd").before);
    expect(of("deu_cons").after).toBeLessThan(of("deu_cons").before);
    const sum = (k: "before" | "after") =>
      e.seats.reduce((a, s) => a + s[k], 0);
    expect(sum("after")).toBe(sum("before"));
    expect(societyView(gw, seat)!.election.last?.uid).toBe(e.uid);
  });

  test("a hot community with no voice gives birth; a party at no support is gone after an election", async () => {
    useGwContent(
      fixture(
        { deu_fatherland: { rule: -1, class: -1, force: -1 } },
        {
          communities: [
            {
              id: "deu_t_patriots",
              tag: "DEU",
              ideal: { axis: "force", side: -1 },
              size: 2,
            },
            {
              id: "deu_t_villages",
              tag: "DEU",
              ideal: { axis: "class", side: 1 },
              size: 3,
            },
          ],
          births: [
            { faction: "deu_fatherland", tag: "DEU", from: "deu_t_patriots" },
          ],
        },
        true,
      ),
    );
    const { gw, seat, n } = await deu();
    // The country leans away from both: accommodation and property.
    n.axes = { force: 20, class: -20 };
    chapters(gw, 8, 12);
    const fp = factionOf(seat, "deu_fatherland")!;
    expect(fp.status).toBe("in");
    expect(seat.society!.births.map((b) => b.id)).toContain("deu_fatherland");
    // The villages' party comes a few chapters later: a generic one.
    chapters(gw, 13, 18);
    const peasants = factionOf(seat, "deu_g_peasants")!;
    expect(peasants.status).toBe("in");
    const strip = societyView(gw, seat)!.factions.map((f) => f.id);
    expect(strip).toContain("deu_g_peasants");
    // A party nobody votes for is gone after the next election.
    const minor = factionOf(seat, "deu_progress")!;
    minor.support = 0;
    generalElection(gw, seat, "reichstag", "dissolved");
    expect(minor.status).toBe("gone");
    expect(
      houseView(gw, seat)!.factions.some((f) => f.id === "deu_progress"),
    ).toBe(false);
    const chip = societyView(gw, seat)!.factions.find(
      (f) => f.id === "deu_progress",
    );
    expect(chip?.status).toBe("gone");
  });

  test("an AI country's passed law moves its axes", async () => {
    const { gw } = await deu();
    // France is the AI's: short of shells, it takes up the three years.
    const fra = gw.nation("FRA")!;
    fra.gauges.shells = 0;
    const at = LAWS.findIndex((r) => r.id === "fra_law_three_years");
    const was = LAWS[at];
    // The text the house would carry first, with a push on the axes.
    const carried = was.draft.find((d) => d.id === "thirty_months")!;
    LAWS[at] = {
      ...was,
      draft: [
        { ...carried, axes: { rule: -1, church: -1 } },
        ...was.draft.filter((d) => d !== carried),
      ],
    };
    // ww208 merge: France's other bills (W-FRA's peace rows) stay out of it.
    const others = LAWS.filter((r) => r.tag === "FRA" && r.id !== was.id);
    const kept = LAWS.filter((r) => !others.includes(r));
    const book = [...LAWS];
    LAWS.splice(0, LAWS.length, ...kept);
    try {
      for (let c = 6; c <= 30 && fra.laws.length === 0; c += 6) {
        gw.s.chapter = c;
        lawAiStep(gw);
      }
    } finally {
      LAWS.splice(0, LAWS.length, ...book);
      LAWS[at] = was;
    }
    expect(fra.laws.find((l) => l.id === was.id)?.stage).toBe("force");
    expect(fra.axes).toEqual({ rule: -1, church: -1 });
    // AI countries keep no society.
    expect(gw.s.seats.some((x) => x.tag === "FRA")).toBe(false);
  });
});

describe("ww208 merge seams", () => {
  test("a war postponement holds the election, by its law or its flag", async () => {
    // GBR's bill is also set by a power and two scenes: the flag counts.
    expect(LAWS.find((r) => r.id === "gbr_postpone")?.flag).toBe(
      "f_gbr_parliament_extended",
    );
    const { gw, seat, n } = await deu();
    const reichstag = houseRow("DEU")!.chambers.find(
      (c) => c.id === "reichstag",
    )!;
    expect(reichstag.elect?.postpone).toBe("deu_postpone");
    const at = LAWS.findIndex((r) => r.id === "deu_postpone");
    const was = LAWS[at];
    LAWS[at] = { ...was, flag: "f_test_postponed" };
    try {
      n.atWar = ["FRA"];
      seat.flags.push("f_test_postponed");
      const due = electionDue(gw, seat, reichstag)!;
      chapters(gw, due, due);
      expect(seat.society!.elections).toEqual([]);
      // No postponement: the war election comes.
      seat.flags = seat.flags.filter((f) => f !== "f_test_postponed");
      chapters(gw, due + 1, due + 1);
      expect(seat.society!.elections.map((e) => e.cause)).toEqual(["due"]);
    } finally {
      LAWS[at] = was;
    }
  });

  test("born and generic parties have their template's ability", () => {
    const powers = GW_CONTENT.powers ?? [];
    const of = (faction: string) =>
      powers.find((p) => p.ability?.faction === faction);
    for (const id of [
      "deu_g_peasants",
      "gbr_g_veterans",
      "deu_spartacus",
      "rus_sr",
    ]) {
      const row = of(id);
      expect(row, id).toBeDefined();
      expect(row!.group).toBe("factions");
    }
    // A party with its own row keeps it.
    expect(of("deu_spd")?.id).toBe("deu_pw_ab_spd");
    expect(powers.filter((p) => p.ability?.faction === "deu_spd").length).toBe(
      1,
    );
  });

  test("a rally lays a card; the player picks its reward", async () => {
    const { gw, seat } = await deu();
    const spd = factionOf(seat, "deu_spd")!;
    spd.trust = 2;
    spd.step = 2;
    spd.heat = 4;
    const support = supportOf(spd);
    for (let c = 8; c < 8 + 3 && seat.society?.rally === undefined; c++) {
      gw.s.chapter = c;
      spd.step = 2;
      utopiaStep(gw);
    }
    expect(seat.society!.rally).toBe("deu_spd");
    expect(seat.desk.some((d) => d.scene === GW_RALLY_SCENE)).toBe(true);
    const morale = gw.nation("DEU")!.gauges.morale;
    runEffects({ gw, seat, cast: {} }, [
      { kind: "world", of: { do: "rally_reward", reward: "morale" } },
    ]);
    expect(gw.nation("DEU")!.gauges.morale).toBe(Math.min(5, morale + 1));
    expect(seat.society!.rally).toBeUndefined();
    expect(supportOf(spd)).toBe(support);
  });
});
