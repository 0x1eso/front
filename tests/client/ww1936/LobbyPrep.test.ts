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

import { START_OOB } from "@openfront/engine-lib/ww1936/LandStart";
import { startReformCount } from "@openfront/engine-lib/ww1936/StartReform";
import {
  prepSentFor,
  setPrepTemplate,
} from "../../../src/client/components/ww1936/PrepPlan";
import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import {
  lobbyGame,
  lobbyResearched,
  lobbyStartTemplates,
  planProblem,
  START_WINDOW_TICKS,
  StartPrep,
  startPreview,
} from "../../../src/client/hud/ww1936/LobbyPrep";

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
  it("is the engine's rule with the stock not limiting", () => {
    const st = lobbyStartTemplates("DEU").find((t) => t.key === "infantry")!;
    const edited = {
      name: "Big",
      battalions: [...st.def.battalions, "infantry" as const],
      support: st.def.support,
    };
    const p = startPreview("DEU", "infantry", st.def, edited)!;
    const original = START_OOB.DEU!.reduce(
      (n, a) =>
        n +
        a.divisions
          .filter(([k]) => k === "infantry")
          .reduce((m, [, k]) => m + k, 0),
      0,
    );
    expect(p.original).toBe(original);
    expect(p.count).toBeGreaterThan(0);
    expect(p.count).toBeLessThanOrEqual(2 * original);
    // A bigger division makes fewer of them from the same men.
    expect(p.count).toBeLessThan(original);
    expect(p.count).toBe(
      startReformCount(
        p.count === 0 ? 0 : p.count * 1e9,
        original,
        1e9,
        Infinity,
      ),
    );
  });

  it("is unknown where the lobby has no 1936 count (a minor, a template nobody uses)", () => {
    const st = lobbyStartTemplates("POL")[0];
    expect(startPreview("POL", st.key, st.def, st.def)).toBeNull();
    const deu = lobbyStartTemplates("DEU")[0];
    expect(startPreview("DEU", "no_such", deu.def, deu.def)).toBeNull();
  });
});

describe("applying the plan at the start", () => {
  it("sends one template_save per edited template, once", () => {
    setPrepTemplate("DEU", MINE);
    const { sp, sent } = prep();
    const g = live();
    expect(sp.tick(g)).toBe(1);
    expect(sp.tick(g)).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: "template_save",
      base: 0,
      name: "Mine",
      battalions: MINE.battalions,
      support: MINE.support,
    });
    const id = g
      .wwLand()
      .details.get(1)
      .templates.find((t: any) => t.key === "infantry").id;
    expect(sent[0].template).toBe(id);
    expect(prepSentFor()).toBe("g1");
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

  it("skips what is now invalid, with a notice, and what already holds the plan", () => {
    setPrepTemplate("DEU", {
      ...MINE,
      key: "armored",
      battalions: ["heavy_armor"],
    });
    setPrepTemplate("DEU", {
      ...MINE,
      key: "mountain",
      name: "Same",
      battalions: [
        ...lobbyStartTemplates("DEU").find((t) => t.key === "mountain")!.def
          .battalions,
      ],
      support: [
        ...lobbyStartTemplates("DEU").find((t) => t.key === "mountain")!.def
          .support,
      ],
    });
    setPrepTemplate("DEU", MINE);
    const { sp, sent, notes } = prep();
    expect(sp.tick(live())).toBe(1);
    expect(sent.map((o) => o.name)).toEqual(["Mine"]);
    expect(notes.some((n) => n.includes("ww1936.prep.skipped"))).toBe(true);
  });

  it("does nothing without a plan and never marks the game", () => {
    const { sp, sent } = prep();
    expect(sp.tick(live())).toBe(0);
    expect(sent).toHaveLength(0);
    expect(prepSentFor()).toBe("");
  });
});
