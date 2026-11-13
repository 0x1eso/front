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
import type { GwSocietyContent } from "@openfront/engine-lib/ww1914/SocietyRows";
import {
  factionOf,
  houseStep,
  houseView,
} from "@openfront/engine/ww1914/House";
import { lawAiStep, lawStep, lawViews } from "@openfront/engine/ww1914/Laws";
import {
  axisStep,
  generalElection,
  lawAxes,
  societyStep,
  societyView,
  supportOf,
} from "@openfront/engine/ww1914/Society";
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
): GwContent {
  return {
    ...GW_CONTENT,
    factions: (GW_CONTENT.factions ?? []).map((f) =>
      ideals[f.id] === undefined ? f : { ...f, ideals: ideals[f.id] },
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
    try {
      for (let c = 6; c <= 30 && fra.laws.length === 0; c += 6) {
        gw.s.chapter = c;
        lawAiStep(gw);
      }
    } finally {
      LAWS[at] = was;
    }
    expect(fra.laws.find((l) => l.id === was.id)?.stage).toBe("force");
    expect(fra.axes).toEqual({ rule: -1, church: -1 });
    // AI countries keep no society.
    expect(gw.s.seats.some((x) => x.tag === "FRA")).toBe(false);
  });
});
