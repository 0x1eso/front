import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  prepSentFor,
  setPrepArmies,
  setPrepTemplate,
} from "../../../src/client/components/ww1936/PrepPlan";
import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import {
  lobbyGame,
  lobbyResearched,
  lobbyStartTemplates,
  OOB_CONFIRM_TICKS,
  planProblem,
  START_WINDOW_TICKS,
  StartPrep,
  startPreviews,
} from "../../../src/client/hud/ww1936/LobbyPrep";
import { oobTemplateRows } from "../../../src/client/hud/ww1936/PrepOob";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

const MINE = {
  key: "infantry",
  name: "Mine",
  battalions: ["infantry", "infantry", "infantry", "artillery"],
  support: ["engineer"],
};

interface Fake {
  ticks?: number;
  tag?: string;
  replay?: boolean;
  catching?: boolean;
  gameID?: string;
  prepEnd?: number;
  techs?: readonly string[];
}

/** A live game in its first seconds: DEU with its 1936 templates. */
function live(o: Fake = {}) {
  const tag = (o.tag ?? "DEU") as never;
  const adapter = lobbyGame(tag, { mode: "start" }) as any;
  const game = {
    ...adapter,
    wwEconomy: () => ({
      version: 1,
      detail: () => ({
        researched: o.techs ?? [...lobbyResearched(tag)],
        lines: [],
        stock: [],
      }),
    }),
    worldWarScenario: () => ({}),
    worldWarData: () => ({ prepEndTick: o.prepEnd ?? WW_PREP_TICKS }),
    ticks: () => o.ticks ?? 5,
    gameID: () => o.gameID ?? "g1",
    isCatchingUp: () => o.catching ?? false,
    config: () => ({ isReplay: () => o.replay ?? false }),
  };
  return game as any;
}

function prep() {
  const sent: any[] = [];
  const notes: string[] = [];
  return {
    sent,
    notes,
    sp: new StartPrep(
      (o) => sent.push(o),
      (t) => notes.push(t),
    ),
  };
}

describe("the start templates of the lobby", () => {
  it("a major lists its 1936 templates, a minor its main one only", () => {
    expect(lobbyStartTemplates("DEU").map((t) => t.key)).toEqual(
      expect.arrayContaining(["infantry", "armored", "mountain", "cavalry"]),
    );
    expect(lobbyStartTemplates("POL")).toHaveLength(1);
    expect(lobbyStartTemplates("POL")[0].key).toBe("infantry");
  });

  it("allows only what the country researched in 1936", () => {
    const researched = lobbyResearched("DEU");
    const ok = { name: "x", battalions: ["infantry" as const], support: [] };
    expect(planProblem(ok, researched, new Set())).toBeNull();
    expect(
      planProblem(
        { ...ok, battalions: ["heavy_armor" as const] },
        new Set([...researched, "heavy_tank_1" as never]),
        new Set(),
      ),
    ).toContain("needs_design");
    expect(
      planProblem({ ...ok, battalions: [] }, researched, new Set()),
    ).not.toBeNull();
  });

  it("the adapter feeds the designer model with start research and no modifiers", () => {
    const g = lobbyGame("DEU", { mode: "start" });
    const m = new DesignerModel(g as never);
    m.open("tank");
    expect(m.cells().length).toBeGreaterThan(0);
    expect(m.cells().some((c) => c.locked)).toBe(true);
    const all = new DesignerModel(
      lobbyGame("DEU", { mode: "library" }) as never,
    );
    all.open("tank");
    expect(all.cells().some((c) => c.locked)).toBe(false);
  });
});

describe("the preview", () => {
  const infantry = () =>
    lobbyStartTemplates("DEU").find((t) => t.key === "infantry")!;
  const plus = (extra: "infantry" | "artillery", n = 1) => ({
    key: "infantry",
    name: "Big",
    battalions: [
      ...infantry().def.battalions,
      ...new Array<string>(n).fill(extra),
    ],
    support: [...infantry().def.support],
  });

  it("Germany with one more infantry battalion: the men budget sets the count, not support equipment", () => {
    const p = startPreviews("DEU", [plus("infantry")]).get("infantry")!;
    expect(p.original).toBe(36);
    // 18 while the support equipment cut the count (browser, 2026-11-03);
    // now the men budget does, and no equipment.
    expect(p.count).toBe(32);
    expect(p.limitedBy).toBeNull();
  });

  it("an unedited template has no preview; a smaller one is cut by the budget, not the stock", () => {
    expect(startPreviews("DEU", []).size).toBe(0);
    const small = {
      ...plus("infantry"),
      battalions: infantry().def.battalions.slice(0, 6),
    };
    const p = startPreviews("DEU", [small]).get("infantry")!;
    expect(p.count).toBeGreaterThan(0);
    expect(p.count).toBeLessThanOrEqual(72);
  });

  it("several edits share the stock in the plan's order", () => {
    const mountain = lobbyStartTemplates("DEU").find(
      (t) => t.key === "mountain",
    )!;
    const m = {
      key: "mountain",
      name: "M",
      battalions: [...mountain.def.battalions, "mountain"],
      support: [...mountain.def.support],
    };
    const both = startPreviews("DEU", [plus("infantry"), m]);
    expect(both.size).toBe(2);
    expect(both.get("infantry")!.count).toBe(
      startPreviews("DEU", [plus("infantry")]).get("infantry")!.count,
    );
  });

  it("is unknown where the lobby has no 1936 count (a minor, a template nobody uses)", () => {
    const st = lobbyStartTemplates("POL")[0];
    expect(
      startPreviews("POL", [
        { key: st.key, name: "x", battalions: ["infantry"], support: [] },
      ]).size,
    ).toBe(0);
    expect(
      startPreviews("DEU", [
        { key: "no_such", name: "x", battalions: ["infantry"], support: [] },
      ]).size,
    ).toBe(0);
  });
});

describe("applying the plan at the start", () => {
  it("a major sends one start_oob for its plan, once", () => {
    setPrepTemplate("DEU", MINE);
    const { sp, sent, notes } = prep();
    const g = live();
    expect(sp.tick(g)).toBe(1);
    expect(sp.tick(g)).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe("start_oob");
    expect(sent[0].templates[0]).toMatchObject({
      key: "infantry",
      name: "Mine",
      battalions: MINE.battalions,
      support: MINE.support,
    });
    // The 1936 armies as they are: three, Germany's counts.
    expect(sent[0].armies).toHaveLength(3);
    const infantry = sent[0].templates.findIndex(
      (t: any) => t.key === "infantry",
    );
    expect(sent[0].armies[0][0]).toEqual({ template: infantry, count: 14 });
    // The success text waits for the game to show the plan applied.
    expect(notes).toEqual([]);
    g.wwLand().details.get(1).startOob = true;
    sp.tick(g);
    expect(notes.some((n) => n.includes("ww1936.prep.oob_applied"))).toBe(true);
    expect(prepSentFor()).toBe("g1");
  });

  it("a start_oob the game never applies is told as refused, not as fielded", () => {
    setPrepTemplate("DEU", MINE);
    const { sp, sent, notes } = prep();
    let now = 5;
    const g = { ...live(), ticks: () => now };
    expect(sp.tick(g)).toBe(1);
    now += OOB_CONFIRM_TICKS - 1;
    sp.tick(g);
    expect(notes).toEqual([]);
    now += 1;
    sp.tick(g);
    expect(sent).toHaveLength(1);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("ww1936.prep.oob_refused");
    expect(notes.some((n) => n.includes("oob_applied"))).toBe(false);
  });

  it("renaming a start template with unresearched parts is not a problem; changing it is", () => {
    const sun = lobbyStartTemplates("SUN").find(
      (t) => t.key === "mountain_rifle",
    )!;
    const rename = {
      key: "mountain_rifle",
      name: "Alpine",
      battalions: [...sun.def.battalions],
      support: [...sun.def.support],
    };
    const row = (p: typeof rename) =>
      oobTemplateRows("SUN", [p]).find((r) => r.key === "mountain_rifle")!;
    expect(row(rename).problem).toBeNull();
    expect(row({ ...rename, support: ["engineer"] }).problem).not.toBeNull();
    expect(
      row({ ...rename, battalions: ["mountain", "mountain", "mountain"] })
        .problem,
    ).not.toBeNull();
  });

  it("a minor keeps its template_save", () => {
    const plain = {
      ...MINE,
      battalions: ["infantry", "infantry"],
      support: [],
    };
    setPrepTemplate("POL", plain);
    const { sp, sent } = prep();
    const g = live({ tag: "POL" });
    expect(sp.tick(g)).toBe(1);
    expect(sent[0]).toMatchObject({
      kind: "template_save",
      base: 0,
      name: "Mine",
      battalions: plain.battalions,
    });
    const id = g
      .wwLand()
      .details.get(1)
      .templates.find((t: any) => t.key === "infantry").id;
    expect(sent[0].template).toBe(id);
  });

  it("an army plan alone sends too; an empty operation army is not sent", () => {
    setPrepArmies("ITA", [[{ key: "binary", count: 3 }], [], [], [], []]);
    const a = prep();
    expect(a.sp.tick(live({ tag: "ITA" }))).toBe(0);
    expect(a.sent).toHaveLength(0);
    expect(a.notes.some((n) => n.includes("ww1936.prep.oob_blocked"))).toBe(
      true,
    );
    setPrepArmies("DEU", [
      [{ key: "infantry", count: 5 }],
      [],
      [{ key: "armored", count: 1 }],
    ]);
    const b = prep();
    expect(b.sp.tick(live())).toBe(1);
    expect(b.sent[0].armies[1]).toEqual([]);
  });

  it("is not sent again by a reloaded page of the same game", () => {
    setPrepTemplate("DEU", MINE);
    const a = prep();
    a.sp.tick(live());
    const b = prep();
    expect(b.sp.tick(live())).toBe(0);
    expect(b.sent).toHaveLength(0);
  });

  it("is not sent on a resumed game, a replay, or while catching up", () => {
    setPrepTemplate("DEU", MINE);
    for (const o of [
      { ticks: START_WINDOW_TICKS + 1 },
      { prepEnd: 0 },
      { replay: true },
      { catching: true },
    ] as Fake[]) {
      const { sp, sent } = prep();
      expect(sp.tick(live(o))).toBe(0);
      expect(sent).toHaveLength(0);
    }
  });

  it("waits out a catch-up that ends inside the first seconds", () => {
    setPrepTemplate("DEU", MINE);
    const { sp, sent } = prep();
    expect(sp.tick(live({ catching: true }))).toBe(0);
    expect(sp.tick(live())).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("uses the country actually played, not the one planned for", () => {
    setPrepTemplate("DEU", MINE);
    const { sp, sent } = prep();
    expect(sp.tick(live({ tag: "FRA" }))).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("leaves out what is now invalid, with a notice", () => {
    setPrepTemplate("DEU", {
      ...MINE,
      key: "armored",
      battalions: ["heavy_armor"],
    });
    setPrepTemplate("DEU", MINE);
    const { sp, sent, notes } = prep();
    expect(sp.tick(live())).toBe(1);
    expect(sent[0].templates.map((t: any) => t.key)).toContain("infantry");
    expect(sent[0].templates.map((t: any) => t.key)).not.toContain("armored");
    expect(notes.some((n) => n.includes("ww1936.prep.skipped"))).toBe(true);
  });

  it("does nothing without a plan and never marks the game", () => {
    const { sp, sent } = prep();
    expect(sp.tick(live())).toBe(0);
    expect(sent).toHaveLength(0);
    expect(prepSentFor()).toBe("");
  });
});
