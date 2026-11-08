// Statecraft (ww157): the rows against their papers and text, and the engine
// on fixture rows: an invention from proposal to the front, the year's project
// through its chapters, the footing's big scene and terms, a shortage answered.
import { GreatWarStateSchema } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  decide,
  GwScene,
  holder,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_CONTENT,
  GwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import {
  footing,
  inCharge,
  invent,
  shortage,
} from "@openfront/engine-lib/ww1914/content/craft/kit";
import { craftScenes } from "@openfront/engine-lib/ww1914/content/scenes/craft";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "@openfront/engine-lib/ww1914/CraftRows";
import {
  craftCalledScenes,
  GW_PROJECT_SCENES,
} from "@openfront/engine-lib/ww1914/CraftRows";
import {
  craftEdge,
  craftStep,
  projectOdds,
} from "@openfront/engine/ww1914/Craft";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { runEffects } from "@openfront/engine/ww1914/SceneRun";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const res = (p: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
  );

/** What a country's rows need of its scenes and pack; empty when all is there. */
function craftProblems(c: GwContent, tag: string, pack: GwPack): string[] {
  const out: string[] = [];
  const scene = (id: string) => c.scenes.find((s) => s.id === id);
  const text = (id: string, need: readonly string[] = []) => {
    const t = pack.scenes[id];
    if (t === undefined) return out.push(`${id}: no text`);
    if (t.brief === undefined) out.push(`${id}: no brief`);
    for (const k of need) {
      if (t.opt?.[k] === undefined && t.text[k] === undefined) {
        out.push(`${id}: no ${k}`);
      }
    }
  };
  const written = (id: string) => {
    const s = scene(id);
    if (s === undefined) return out.push(`${id}: not written`);
    if (s.scheduledOnly !== true) out.push(`${id}: not scheduledOnly`);
    text(id);
  };
  const people = new Set([
    ...c.people.map((p) => p.id),
    ...Object.keys(pack.people),
  ]);
  for (const r of (c.inventions ?? []).filter((x) => x.tag === tag)) {
    if (!people.has(r.inventor)) out.push(`${r.id}: no person ${r.inventor}`);
    if (pack.craft?.[r.id] === undefined) out.push(`${r.id}: no craft name`);
    text(r.id, ["base", "back", "quiet", "refuse"]);
    text(`${r.id}_ok`, ["base", "field", "wait"]);
    text(`${r.id}_fail`, ["base", "retry", "drop"]);
    text(`${r.id}_used`, ["base", "early"]);
  }
  const projects = (c.projects ?? []).filter((x) => x.tag === tag);
  if (projects.length > 0) {
    text(`${tag.toLowerCase()}_agenda`, [
      "base",
      "later",
      ...projects.map((r) => r.id),
    ]);
  }
  for (const r of projects) {
    if (pack.craft?.[r.id] === undefined) out.push(`${r.id}: no craft name`);
    for (const ch of ["prep", "opp", "exec", "done", "fail"]) {
      written(`${r.id}_${ch}`);
    }
  }
  const f = (c.footing ?? []).find((x) => x.tag === tag);
  f?.steps.forEach((st, i) => {
    const s = scene(st.scene);
    if (s === undefined) return out.push(`${st.scene}: not written`);
    if (s.big !== true) out.push(`${st.scene}: not a big scene`);
    text(st.scene);
    const raises = Object.values(s.nodes ?? {}).some((n) =>
      n.replies.some((r) =>
        r.effects.some(
          (e) =>
            e.kind === "world" && e.of.do === "footing" && e.of.level === i + 1,
        ),
      ),
    );
    if (!raises) out.push(`${st.scene}: nothing raises to ${i + 1}`);
  });
  for (const r of (c.shortages ?? []).filter((x) => x.tag === tag)) {
    written(r.scene);
  }
  return out;
}

describe("the rows", () => {
  test.each(["DEU", "GBR", "AUH", "RUS"])(
    "%s's statecraft has its papers and text",
    async (tag) => {
      const pack = await loadGwPack(tag as "DEU", async (p) => res(p));
      expect(craftProblems(GW_CONTENT, tag, pack)).toEqual([]);
    },
  );

  // Bot runs (ww157 merge): at salience 5 Russia's labour scenes held for
  // 8-14 chapters a game and never won a draw against the war desk.
  test.each(["deu", "gbr", "auh", "rus"])(
    "%s's labour scenes can win a war desk's draw",
    (tag) => {
      const labour = GW_CONTENT.scenes.filter((s) =>
        s.id.startsWith(`${tag}_lb_`),
      );
      expect(labour.length).toBeGreaterThan(0);
      for (const s of labour) {
        expect([s.id, s.salience >= 6]).toEqual([s.id, true]);
      }
    },
  );
});

// ---- Fixture rows on the mini map, Germany ----

const INV: GwInventionRow = {
  id: "t_inv",
  tag: "DEU",
  inventor: "deu_i_test",
  opens: { kind: "chapter", min: 1 },
  against: "army",
  price: 10,
  build: 2,
  trial: 100,
  ripe: 3,
  edge: { theatres: ["west"], attack: 8 },
  solves: ["nitrates"],
};
const PJ: GwProjectRow = {
  id: "t_pj",
  tag: "DEU",
  lead: holder("chancellor"),
  odds: 100,
  months: 1,
  done: [setFlag("t_done")],
};
const FT: GwFootingRow = {
  tag: "DEU",
  steps: [
    { scene: "t_ft_war", opens: { kind: "chapter", min: 0 } },
    { scene: "t_ft_total", opens: { kind: "chapter", min: 0 } },
  ],
};
const SH: GwShortageRow = {
  id: "nitrates",
  tag: "DEU",
  when: world({ is: "war" }),
  scene: "t_sh",
  drag: [{ gauge: "shells", delta: -1, every: 1 }],
};

const wire = (id: string): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  scheduledOnly: true,
  salience: 5,
  tags: [],
  cast: id.startsWith("t_pj") ? { lead: inCharge } : {},
  variants: [{ id: "base" }],
});
const big = (id: string, level: number): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "talk",
  big: true,
  scheduledOnly: true,
  salience: 9,
  tags: [],
  cast: { chan: holder("chancellor") },
  who: "chan",
  start: "n1",
  variants: [{ id: "base" }],
  nodes: {
    n1: {
      says: [{ id: "base" }],
      replies: [decide("raise", null, [footing(level)]), decide("wait", null)],
    },
  },
});

/** The fixture rows' own scenes: the papers made from them and the written ones. */
function fixtureScenes(
  inventions: readonly GwInventionRow[],
  projects: readonly GwProjectRow[],
): GwScene[] {
  return [
    ...craftScenes(inventions, projects),
    ...GW_PROJECT_SCENES.map((x) => wire(`t_pj_${x}`)),
    wire("t_sh"),
    big("t_ft_war", 1),
    big("t_ft_total", 2),
  ];
}

function useFixture(rows: Partial<GwContent> = {}): void {
  const inventions = rows.inventions ?? [INV];
  const projects = rows.projects ?? [];
  useGwContent({
    ...GW_CONTENT,
    scenes: [...GW_CONTENT.scenes, ...fixtureScenes(inventions, projects)],
    inventions,
    projects,
    footing: rows.footing ?? [FT],
    shortages: rows.shortages ?? [SH],
  });
}
afterEach(() => useGwContent(null));

describe("the content check", () => {
  test("the scenes the rows call count as scheduled", () => {
    const rows = {
      inventions: [INV],
      projects: [PJ],
      footing: [FT],
      shortages: [SH],
    };
    const scenes = fixtureScenes(rows.inventions, rows.projects);
    const unscheduled = (outside: string[]) =>
      gwContentProblems(scenes, GW_CONTENT.people, outside).filter((x) =>
        x.includes("nothing schedules it"),
      );
    // Without the rows the papers, the pick, footing and shortage scenes are
    // flagged (the project's chapters cast `called`, which frees them anyway).
    expect(unscheduled([]).map((x) => x.split(":")[0])).toEqual(
      expect.arrayContaining([
        "t_inv",
        "t_inv_used",
        "deu_agenda",
        "t_ft_war",
        "t_sh",
      ]),
    );
    expect(unscheduled(craftCalledScenes(rows))).toEqual([]);
    expect(craftCalledScenes(rows)).toHaveLength(scenes.length);
  });
});

const ctxOf = (gw: GreatWar) => ({ gw, seat: gw.s.seats[0], cast: {} });

describe("inventions", () => {
  test("proposed, backed over the army, tried, fielded early off its paper", async () => {
    useFixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    // Nothing comes in the first chapter; then the paper is on the desk.
    playChapter(runner);
    // The desk's first open option is "back": the plain way signs it.
    while (seat(runner).world.craft?.inventions[0]?.stage !== "ready") {
      playChapter(runner);
      expect(gw.s.chapter).toBeLessThan(8);
    }
    expect(gw.s.seats[0].seen.t_inv).toBeDefined();
    expect(gw.s.seats[0].log.map((l) => l.key)).toContain("invent_overruled");
    // The ok paper's first option fields it at once: early, the secret out.
    playChapter(runner);
    const st = gw.s.seats[0].craft!.inventions[0];
    expect(st.stage).toBe("fielded");
    expect(st.early).toBe(true);
    expect(gw.s.news.map((x) => x.key)).toContain("invent_leaked");
    expect(gw.s.seats[0].craft!.shortages).toEqual([
      expect.objectContaining({ id: "nitrates", solved: true }),
    ]);
    expect(() => GreatWarStateSchema.parse(gw.s)).not.toThrow();
  });

  test("the edge: full while the surprise lasts, half once learnt or early", async () => {
    useFixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    gw.s.seats[0].craft = {
      inventions: [
        {
          id: "t_inv",
          stage: "fielded",
          since: gw.s.chapter,
          tries: 1,
          build: 2,
          early: false,
        },
      ],
      projects: [],
      picked: -1,
      footing: 0,
      footingSince: -1,
      footingAsked: -1,
      shortages: [],
    };
    expect(craftEdge(gw, n, "west", "attack")).toBe(8);
    expect(craftEdge(gw, n, "east", "attack")).toBe(0);
    expect(craftEdge(gw, n, "west", "defence")).toBe(0);
    gw.s.seats[0].craft.inventions[0].since -= 4;
    expect(craftEdge(gw, n, "west", "attack")).toBe(4);
    gw.s.seats[0].craft.inventions[0].since += 4;
    gw.s.seats[0].craft.inventions[0].early = true;
    expect(craftEdge(gw, n, "west", "attack")).toBe(4);
    expect(craftEdge(gw, gw.nation("FRA"), "west", "attack")).toBe(0);
  });

  test("a row with a research tech keeps the tech and adds no edge of its own", async () => {
    useFixture({ inventions: [{ ...INV, tech: "gas_heavy" }] });
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    gw.s.seats[0].craft = {
      inventions: [
        {
          id: "t_inv",
          stage: "ready",
          since: gw.s.chapter - 5,
          tries: 1,
          build: 2,
          early: false,
        },
      ],
      projects: [],
      picked: -1,
      footing: 0,
      footingSince: -1,
      footingAsked: -1,
      shortages: [],
    };
    order(runner, { kind: "field", invention: "t_inv" });
    expect(gw.s.seats[0].craft.inventions[0].stage).toBe("fielded");
    expect(n.techs).toContain("gas_heavy");
    expect(craftEdge(gw, n, "west", "attack")).toBe(0);
  });

  test("backing over the army costs the row's price in authority", async () => {
    useFixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    gw.s.chapter = 1;
    craftStep(gw);
    expect(gw.s.seats[0].scheduled.map((q) => q.scene)).toContain("t_inv");
    const before = n.authority;
    const army = n.inst.army!;
    runEffects(ctxOf(gw), [invent("t_inv", "back")]);
    expect(n.authority).toBe(before - 10);
    expect(n.inst.army).toBe(army - 1);
    runEffects(ctxOf(gw), [invent("t_inv", "back")]);
    expect(n.authority).toBe(before - 10);
  });

  test("a failed trial asks again; a retry gets better odds", async () => {
    useFixture({ inventions: [{ ...INV, trial: 0, against: undefined }] });
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const ctx = ctxOf(gw);
    gw.s.chapter = 1;
    craftStep(gw);
    runEffects(ctx, [invent("t_inv", "quiet")]);
    const st = ctx.seat.craft!.inventions[0];
    expect(st).toMatchObject({ stage: "building", build: 4 });
    for (let i = 0; i < 4; i++) {
      craftStep(gw);
      gw.s.chapter++;
    }
    expect(st.stage).toBe("failed");
    expect(ctx.seat.scheduled.map((q) => q.scene)).toContain("t_inv_fail");
    runEffects(ctx, [invent("t_inv", "retry")]);
    expect(st).toMatchObject({ stage: "building", build: 1, tries: 2 });
    runEffects(ctx, [invent("t_inv", "field")]);
    expect(st.stage).toBe("building");
  });
});

describe("the year's project", () => {
  test("the final odds stay between 10 and 90, whatever the choices", async () => {
    useFixture({ inventions: [], projects: [PJ] });
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const seat0 = gw.s.seats[0];
    const p = {
      id: "t_pj",
      phase: "exec" as const,
      day: gw.s.day,
      lead: null,
      push: 45,
      year: 1914,
    };
    expect(projectOdds(gw, seat0, PJ, p)).toBe(90);
    expect(
      projectOdds(gw, seat0, { ...PJ, odds: 35 }, { ...p, push: -45 }),
    ).toBe(10);
    expect(
      projectOdds(gw, seat0, { ...PJ, odds: 50 }, { ...p, push: 15 }),
    ).toBe(65);
  });

  test("picked once a year, through its chapters to done, the lead cast", async () => {
    useFixture({ inventions: [], projects: [PJ] });
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    while (gw.s.seats[0].craft?.projects[0]?.phase !== "done") {
      playChapter(runner);
      expect(view(runner).ended).toBeNull();
    }
    const s = gw.s.seats[0];
    expect(s.seen.deu_agenda).toBeDefined();
    expect(s.flags).toContain("t_done");
    const p = s.craft!.projects[0];
    expect(p.lead).not.toBeNull();
    expect(gw.person(p.lead!)!.wins).toBeGreaterThan(0);
    for (const ch of ["prep", "opp", "exec"])
      expect(s.seen[`t_pj_${ch}`]).toBeDefined();
    expect(s.seen.t_pj_done).toBe(gw.s.chapter);
    expect(seat(runner).world.craft?.past[0]).toMatchObject({
      id: "t_pj",
      phase: "done",
    });
  });
});

describe("footing and shortages", () => {
  test("the tab calls the big scene; its decide raises; the terms run at war", async () => {
    useFixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    const orderBefore = n.gauges.order;
    order(runner, { kind: "footing" });
    const card = seat(runner).desk.find((c) => c.scene === "t_ft_war")!;
    expect(card).toBeDefined();
    expect(seat(runner).world.craft?.raise).toEqual({
      open: true,
      asked: true,
    });
    order(runner, { kind: "reply", card: card.uid, reply: "raise" });
    expect(seat(runner).world.craft?.footing).toBe(1);
    expect(n.gauges.order).toBe(orderBefore - 1);
    runEffects(ctxOf(gw), [footing(2)]);
    expect(gw.s.seats[0].craft!.footing).toBe(2);
    expect(gw.s.news.map((x) => x.key)).toContain("footing_total");
    // At war, in the long chapters: shells come, the shortage comes and drags.
    n.side = "central";
    n.atWar = ["FRA"];
    n.gauges.shells = 1;
    gw.s.warChapter = 5;
    const keys: string[] = [];
    for (gw.s.chapter = 6; gw.s.chapter <= 9; gw.s.chapter++) {
      craftStep(gw);
      keys.push(...gw.s.seats[0].lines.map((l) => l.key));
    }
    expect(keys).toContain("footing_total_shells");
    expect(keys).toContain("shortage_nitrates");
    expect(gw.s.seats[0].scheduled.map((q) => q.scene)).toContain("t_sh");
    runEffects(ctxOf(gw), [shortage("nitrates", false)]);
    gw.s.seats[0].lines = [];
    craftStep(gw);
    expect(gw.s.seats[0].lines.map((l) => l.key)).not.toContain(
      "shortage_nitrates",
    );
  });
});
