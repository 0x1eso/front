// Plots, the dossier and allies' asks (ww158, S2) on fixture rows, Germany on
// the mini map: the fair-warning rule (no last step, so no lost game, before
// two signs and the warning, the warning two chapters ahead), the plots' ends,
// files gathered, used and found out, and an ally's ask from letter to aid.
import { GreatWarStateSchema } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  flag,
  GwScene,
  role,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  GwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { DEU_HOUSE } from "@openfront/engine-lib/ww1914/content/house/houses";
import { answerAsk } from "@openfront/engine-lib/ww1914/content/house/kit";
import {
  gwDossierActs,
  gwDossierScenes,
} from "@openfront/engine-lib/ww1914/content/scenes/dossier";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWeakRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { alliesStep } from "@openfront/engine/ww1914/Asks";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import { dossierView, gatherFile } from "@openfront/engine/ww1914/Dossier";
import { govBeaten, govView } from "@openfront/engine/ww1914/Government";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { houseStep } from "@openfront/engine/ww1914/House";
import { plotFair, plotsStep } from "@openfront/engine/ww1914/Plots";
import { runEffects } from "@openfront/engine/ww1914/SceneRun";
import { takeBack } from "@openfront/engine/ww1914/Seats";
import { settlePromises } from "@openfront/engine/ww1914/Talk";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner, order, seat as seatView } from "./util";

const ARMY: GwFactionRow = {
  id: "t_army",
  tag: "DEU",
  bloc: "army",
  leaders: [{ person: "deu_tirpitz" }],
  seats: { reichstag: 2 },
  start: "in",
  plot: "t_pl",
};

const plotRow = (over: Partial<GwPlotRow> = {}): GwPlotRow => ({
  id: "t_pl",
  tag: "DEU",
  regimes: ["empire"],
  from: "1914-01",
  feeds: [{ when: flag("t_hot"), key: "t_hot", by: 3, quiet: true }],
  steps: [
    { at: 3, scene: "t_pl_1" },
    { at: 6, scene: "t_pl_2" },
  ],
  rest: 6,
  fatal: true,
  plot: {
    by: ["t_army"],
    signs: [
      { at: 1, scene: "t_pl_s1", via: "paper" },
      { at: 2, scene: "t_pl_s2", via: "talk" },
      { at: 4, scene: "t_pl_s3", via: "report" },
    ],
    warn: "t_pl_w",
    end: "removed",
  },
  ...over,
});

const WEAK: GwWeakRow = {
  person: "deu_tirpitz",
  weak: [
    { id: "debts", odds: 100 },
    { id: "letters", odds: 0 },
  ],
};

const ASK: GwAskRow = {
  id: "t_ask",
  tag: "DEU",
  from: "AUH",
  kind: "loan",
  when: { kind: "chapter", min: 1 },
  scene: "t_ask_s",
  keep: flag("t_kept"),
  chapters: 3,
  kept: [setFlag("t_aid")],
  broken: [setFlag("t_cold")],
};

const wire = (id: string): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  scheduledOnly: true,
  salience: 5,
  tags: [],
  cast: {},
  variants: [{ id: "base" }],
});

const answer = (id: string, ask: string): GwScene => ({
  ...wire(id),
  kind: "proposal",
  fallback: "yes",
  options: [
    { id: "yes", tell: [], effects: [answerAsk(ask, true)] },
    { id: "no", tell: [], effects: [answerAsk(ask, false)] },
  ],
});

interface Rows {
  plots?: GwPlotRow[];
  asks?: GwAskRow[];
  bills?: GwBillRow[];
  /** Scene ids to leave out (a sign or warning never written). */
  without?: string[];
}

function useFixture(rows: Rows = {}): void {
  const house = {
    houses: [DEU_HOUSE],
    factions: [ARMY],
    weak: [WEAK],
    plots: rows.plots ?? [plotRow()],
    asks: rows.asks ?? [ASK],
    bills: rows.bills ?? [],
  };
  const own = [
    ...["t_pl_s1", "t_pl_s2", "t_pl_s3", "t_pl_w", "t_pl_1", "t_pl_2"].map(
      wire,
    ),
    answer("t_ask_s", "t_ask"),
    answer("t_ask_law", "t_ask_law"),
    ...gwDossierScenes(house),
  ].filter((s) => !(rows.without ?? []).includes(s.id));
  const c: GwContent = {
    ...GW_CONTENT,
    ...house,
    scenes: [...GW_CONTENT.scenes, ...own],
    acts: [...(GW_CONTENT.acts ?? []), ...gwDossierActs(house)],
  };
  useGwContent(c);
}
afterEach(() => useGwContent(null));

async function game(rows: Rows = {}) {
  useFixture(rows);
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  // A month-long chapter, well into the war; the house is made.
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.spanDays >= 28 && c.day > 0) + 6;
  gw.s.day = list[gw.s.chapter].day;
  houseStep(gw);
  expect(gw.s.seats[0].house).toBeDefined();
  return { runner, gw, seat: gw.s.seats[0] };
}

/**
 * A month: the plots move, then whatever they called is dealt and read next
 * chapter (`read` false: the seat never opens the scenes named).
 */
function month(gw: GreatWar, unread: readonly string[] = []): void {
  const seat = gw.s.seats[0];
  plotsStep(gw, seat);
  gw.s.chapter++;
  gw.s.day = gwChapters(gw.s.calendar)[gw.s.chapter].day;
  seat.scheduled = seat.scheduled.filter((q) => {
    if (!q.scene.startsWith("t_pl") || q.chapter > gw.s.chapter) return true;
    if (!unread.includes(q.scene)) seat.seen[q.scene] = gw.s.chapter;
    return unread.includes(q.scene);
  });
}

const heat = (gw: GreatWar, id = "t_pl") =>
  gw.s.seats[0].gov.find((x) => x.id === id)?.heat ?? 0;

describe("plots: the fair warning", () => {
  test("the last step comes only after two signs and the warning, two chapters on", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    let lastAt = -1;
    for (let i = 0; i < 20 && gw.s.ended === null; i++) {
      const fair = plotFair(gw, seat, "t_pl");
      const p = seat.house!.plots.find((x) => x.id === "t_pl")!;
      const was = seat.seen.t_pl_2;
      month(gw);
      if (was === undefined && seat.seen.t_pl_2 !== undefined) {
        lastAt = gw.s.chapter;
        // Called at the step before: the rule held there.
        expect(fair).toBe(true);
        expect(p.signs.length).toBeGreaterThanOrEqual(2);
        expect(gw.s.chapter - 1 - p.warned).toBeGreaterThanOrEqual(2);
      }
    }
    expect(lastAt).toBeGreaterThan(0);
    // Read and not answered: the court and the army remove the ruler.
    expect(gw.s.ended).toBe("deu_r_removed");
    expect(seat.log.map((l) => l.key)).toContain("plot_t_pl_end");
  });

  test("no fatal step fires unwarned: a warning never read holds it for good", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    for (let i = 0; i < 30; i++) month(gw, ["t_pl_w"]);
    expect(gw.s.ended).toBeNull();
    expect(seat.seen.t_pl_2).toBeUndefined();
    expect(heat(gw)).toBe(5);
    // The warning keeps coming until it is read.
    expect(seat.scheduled.map((q) => q.scene)).toContain("t_pl_w");
  });

  test("nor with one sign: a plot whose other signs were never written waits", async () => {
    const { gw, seat } = await game({ without: ["t_pl_s2", "t_pl_s3"] });
    seat.flags.push("t_hot");
    for (let i = 0; i < 30; i++) month(gw);
    expect(gw.s.ended).toBeNull();
    expect(seat.house!.plots[0].signs).toEqual(["t_pl_s1"]);
    expect(seat.seen.t_pl_w).toBeDefined();
    expect(seat.seen.t_pl_2).toBeUndefined();
  });

  test("beaten at the last step, the game goes on and the next round warns afresh", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    for (let i = 0; i < 20 && seat.seen.t_pl_2 === undefined; i++) month(gw);
    expect(seat.seen.t_pl_2).toBeDefined();
    govBeaten(gw, seat, "t_pl");
    month(gw);
    expect(gw.s.ended).toBeNull();
    const p = seat.house!.plots[0];
    expect(p.signs).toEqual([]);
    expect(p.warned).toBe(-1);
    expect(heat(gw)).toBe(0);
  });

  test("under a regent nothing warns and no last step comes: the seat can't be lost", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    seat.regent = true;
    for (let i = 0; i < 30; i++) month(gw);
    expect(gw.s.ended).toBeNull();
    expect(seat.seen.t_pl_2).toBeUndefined();
    const p = seat.house!.plots[0];
    expect(p.signs).toEqual([]);
    expect(p.warned).toBe(-1);
    expect(plotFair(gw, seat, "t_pl")).toBe(false);
  });

  test("a last step laid before the regent waits for the friend, who is warned afresh", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    for (let i = 0; i < 20 && seat.seen.t_pl_2 === undefined; i++) month(gw);
    expect(seat.seen.t_pl_2).toBeDefined();
    // The friend drops before the plot has its way.
    seat.regent = true;
    for (let i = 0; i < 5; i++) month(gw);
    expect(gw.s.ended).toBeNull();
    takeBack(gw, seat);
    const p = seat.house!.plots[0];
    expect(p.signs).toEqual([]);
    expect(p.warned).toBe(-1);
    expect(heat(gw)).toBe(5);
    // Back at the desk, the signs and the warning come again before the end.
    let warned = false;
    for (let i = 0; i < 20 && gw.s.ended === null; i++) {
      month(gw);
      warned ||= p.warned >= 0;
    }
    expect(warned).toBe(true);
    expect(gw.s.ended).toBe("deu_r_removed");
  });

  test("a red plot feeds the unrest ladder; the cabal feeds the fall track", async () => {
    const red = plotRow({
      fatal: false,
      plot: { ...plotRow().plot, end: "unrest" },
    });
    const { gw, seat } = await game({ plots: [red] });
    seat.flags.push("t_hot");
    const low = gw.nation("DEU")!.lowOrder;
    const ended = () => seat.log.some((l) => l.key === "plot_t_pl_end");
    for (let i = 0; i < 20 && !ended(); i++) month(gw);
    expect(ended()).toBe(true);
    expect(gw.s.ended).toBeNull();
    expect(gw.nation("DEU")!.lowOrder).toBe(low + 2);
    expect(() => GreatWarStateSchema.parse(gw.s)).not.toThrow();
  });

  test("a plot never shows among the government's threats", async () => {
    const { gw, seat } = await game();
    seat.flags.push("t_hot");
    month(gw);
    expect(heat(gw)).toBeGreaterThan(0);
    expect(govView(gw, seat).map((x) => x.id)).not.toContain("t_pl");
  });
});

describe("the dossier", () => {
  test("a file is true unless the police's unconfirmed word is wrong", async () => {
    const { gw, seat } = await game();
    for (let i = 0; i < 40; i++) {
      seat.house!.files = [];
      const f = gatherFile(gw, seat, "deu_tirpitz", false);
      expect(f).not.toBeNull();
      expect(f!.truth).toBe(f!.weak === "debts");
      if (f!.stamp !== "unconfirmed") expect(f!.truth).toBe(true);
      const r = gw.s.reports[gw.s.reports.length - 1];
      expect([r.fact, r.source, r.claim, r.stamp]).toEqual([
        "file",
        "police",
        1,
        f!.stamp,
      ]);
    }
    expect(() => GreatWarStateSchema.parse(gw.s)).not.toThrow();
  });

  test("never the seat's own person, never another country's man", async () => {
    const { gw, seat } = await game();
    for (const who of ["deu_wilhelm", "rus_sazonov"]) {
      expect(gatherFile(gw, seat, who, false)).toBeNull();
    }
  });

  test("used true: his faction stays away, his plot cools, he stays cold", async () => {
    const { gw, seat } = await game();
    seat.house!.files = [file(true)];
    seat.gov.push({ id: "t_pl", heat: 5, step: 1, rest: -1, beaten: 0 });
    const p = gw.person("deu_tirpitz")!;
    p.trust = 2;
    hold(gw);
    const f = seat.house!.files[0];
    expect(f.used).toBe(1);
    expect(seat.house!.factions[0].held).toBeGreaterThanOrEqual(gw.s.chapter);
    expect(heat(gw)).toBe(2);
    // Held, he can't warm past -1 (lower still if the file also came out).
    expect(p.trust).toBeLessThanOrEqual(-1);
    expect(seat.log.map((l) => l.key)).toContain("file_held");
  });

  test("used false: he refuses, the file is burnt and the police are put right", async () => {
    const { gw, seat } = await game();
    gatherFileFalse(gw);
    const p = gw.person("deu_tirpitz")!;
    p.trust = 1;
    const wrong = gw.s.sources.find((s) => s.id === "police")!.wrong;
    hold(gw);
    const f = seat.house!.files[0];
    expect(f.out).toBe(true);
    expect(p.trust).toBe(-1);
    expect(gw.s.sources.find((s) => s.id === "police")!.wrong).toBe(wrong + 1);
    expect(seat.log.map((l) => l.key)).toContain("file_refused");
    expect(dossierView(gw, seat)!.files[0].end).toBe("burnt");
  });

  test("used often it comes out: a scandal, the press and his faction turn", async () => {
    const { gw, seat } = await game();
    seat.house!.files = [{ ...file(true), used: 9 }];
    const press = seat.press.opinion.press;
    hold(gw);
    expect(seat.house!.files[0].out).toBe(true);
    expect(gw.s.news.map((n) => n.key)).toContain("file_scandal");
    expect(seat.press.opinion.press).toBe(press - 2);
    expect(seat.house!.factions[0].heat).toBeGreaterThan(0);
    expect(dossierView(gw, seat)!.files[0].end).toBe("found");
  });

  test("the schedule's entry opens a file on the man picked", async () => {
    const { runner, gw, seat } = await game();
    seat.acts = 2;
    order(runner, { kind: "act", act: "deu_a_file", picks: ["deu_tirpitz"] });
    const views = dossierView(gw, seat)?.files ?? [];
    expect(views.map((f) => f.who)).toEqual(["deu_tirpitz"]);
    expect(Object.keys(views[0])).not.toContain("truth");
    expect(seat.scheduled.map((q) => q.scene)).toContain("gw_df_deu");
    expect(seatView(runner).world.dossier?.files).toHaveLength(1);
  });
});

function file(truth: boolean) {
  return {
    uid: 1,
    who: "deu_tirpitz",
    weak: truth ? ("debts" as const) : ("letters" as const),
    stamp: "unconfirmed" as const,
    truth,
    chapter: 0,
    used: 0,
    out: false,
  };
}

/** A false file, with the police's wrong report behind it. */
function gatherFileFalse(gw: GreatWar): void {
  const seat = gw.s.seats[0];
  for (let i = 0; i < 200; i++) {
    seat.house!.files = [];
    const f = gatherFile(gw, seat, "deu_tirpitz", false);
    if (f !== null && !f.truth) return;
  }
  throw new Error("no false file in 200 tries");
}

function hold(gw: GreatWar): void {
  const seat = gw.s.seats[0];
  runEffects({ gw, seat, cast: { who: "deu_tirpitz" } }, [
    doWorld({ do: "use_file", who: role("who") }),
  ]);
}

describe("allies' asks", () => {
  /** The ask's scene to the desk and answered through the real order. */
  async function asked(pick: "yes" | "no", rows: Rows = {}) {
    const g = await game(rows);
    alliesStep(g.gw);
    const q = g.seat.scheduled.find((x) => x.scene.startsWith("t_ask"))!;
    expect(q).toBeDefined();
    q.chapter = g.gw.s.chapter;
    g.seat.desk = [];
    dealDesk(g.gw, g.seat);
    const card = g.seat.desk.find((c) => c.scene === q.scene)!;
    const trust = g.gw.nation("DEU")!.trust.AUH ?? 0;
    order(g.runner, { kind: "choose", card: card.uid, option: pick });
    return { ...g, trust };
  }

  test("yes is a promise to the head; kept, the aid comes and trust rises", async () => {
    const { gw, seat } = await asked("yes");
    const p = seat.promises.find((x) => x.key === "ask_t_ask")!;
    expect(p.who).toBe("auh_franz_joseph");
    const trust = gw.nation("DEU")!.trust.AUH ?? 0;
    seat.flags.push("t_kept");
    settlePromises(gw, seat);
    alliesStep(gw);
    expect(seat.house!.asks[0].stage).toBe("kept");
    expect(seat.flags).toContain("t_aid");
    expect(gw.nation("DEU")!.trust.AUH).toBe(trust + 1);
  });

  test("broken, the ally cools and the row's price is paid", async () => {
    const { gw, seat } = await asked("yes");
    const trust = gw.nation("DEU")!.trust.AUH ?? 0;
    gw.s.chapter += 4;
    settlePromises(gw, seat);
    alliesStep(gw);
    expect(seat.house!.asks[0].stage).toBe("broken");
    expect(seat.flags).toContain("t_cold");
    expect(gw.nation("DEU")!.trust.AUH).toBe(trust - 1);
  });

  test("no costs the ally's trust at once", async () => {
    const { gw, seat, trust } = await asked("no");
    expect(seat.house!.asks[0].stage).toBe("no");
    expect(gw.nation("DEU")!.trust.AUH).toBe(trust - 1);
  });

  test("a conference: the envoy's word first, the scene a chapter after", async () => {
    const { gw, seat } = await game({ asks: [{ ...ASK, conference: true }] });
    alliesStep(gw);
    const r = gw.s.reports[gw.s.reports.length - 1];
    expect([r.fact, r.source, r.about]).toEqual(["ally", "envoy", "t_ask"]);
    const q = seat.scheduled.find((x) => x.scene === "t_ask_s")!;
    expect(q.chapter).toBe(gw.s.chapter + 2);
  });

  test("a law ask brings the bill in with the ally's name; its foes heat", async () => {
    const law: GwAskRow = {
      ...ASK,
      id: "t_ask_law",
      kind: "law",
      law: "deu_censor",
      scene: "t_ask_law",
    };
    const bill: GwBillRow = { law: "deu_censor", stance: { t_army: -1 } };
    const { gw, seat } = await asked("yes", { asks: [law], bills: [bill] });
    const st = gw.nation("DEU")!.laws.find((l) => l.id === "deu_censor")!;
    expect([st.stage, st.origin]).toEqual(["persuade", "ally"]);
    expect(seat.house!.factions[0].heat).toBeGreaterThan(0);
  });

  test("no ask from a country whose head can't write", async () => {
    const { gw, seat } = await game({
      asks: [{ ...ASK, from: "DEU", id: "t_self" }],
    });
    alliesStep(gw);
    expect(seat.house!.asks).toEqual([]);
  });
});
