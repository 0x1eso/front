// World War 1936 P3 (spec §18.4, §18.5): the AI's focus — the history
// path, its branch points, the three-place limit, the weights and the
// focus beat — on the test map ww1936pol. France (AI) is the chooser.
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { ContentParts } from "@openfront/engine-lib/ww1936/content/registry";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  aiPickFocus,
  forceFocusNext,
  historyPath,
} from "@openfront/engine/ww1936/politics/AiFocus";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { startFocus } from "@openfront/engine/ww1936/politics/Focus";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, stepTo, wwRunner } from "./util";

const flag = (f: string) => ({ kind: "flag" as const, flag: f });
let col = 0;
const focus = (id: string, extra: Partial<FocusDef> = {}): FocusDef => ({
  id,
  tree: "generic",
  x: col++ % 20,
  y: 4,
  days: 70,
  branch: "politics",
  icon: "flag",
  effects: [],
  ...extra,
});

interface AiGame {
  runner: GameRunner;
  p: WwPolitics;
  id: (tag: CountryTag) => number;
}

/** A game on `parts` (over the fixture) after its first tick (the roll is done). */
async function aiGame(
  parts: Partial<ContentParts> | null,
  config: Partial<GameConfig> = {},
  humans: CountryTag[] = [],
): Promise<AiGame> {
  usePoliticsContent(parts === null ? null : politicsFixture(parts));
  const runner = await wwRunner(
    config,
    humans.map((country, i) => ({ clientID: `${HUMAN}${i}`, country })),
    POL,
  );
  step(runner);
  const g = runner.game;
  return { runner, p: pol(g), id: (t) => byTag(g, t).smallID() };
}

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const pos = (p: WwPolitics, id: FocusId) => p.content.treePos.get(id)!;

afterEach(() => usePoliticsContent(null));

describe("the AI's focus", { timeout: 60_000 }, () => {
  it("an AI follows its history path", async () => {
    const { runner, p, id } = await aiGame({});
    const fra = id("FRA");
    const c = p.country(fra)!;
    p.branchDeviations.set("FRA:bp_t", null);
    expect(historyPath(p, c)).toEqual(["gen_t_a", "gen_t_b"]);
    const after = (d: number) =>
      stepTo(runner, dayStart(d) + (fra % WW_DAY_SPLIT) + 1);
    // Day 0's step: the first focus of the path, with that day's progress.
    after(0);
    expect(c.focus).toEqual({ id: "gen_t_a", progressMilli: 1000 });
    after(69);
    expect(c.focusState[pos(p, "gen_t_a")]).toBe(1);
    expect(c.focus).toBeNull();
    // The next day: the path's second, not its exclusive partner.
    after(70);
    expect(c.focus).toEqual({ id: "gen_t_b", progressMilli: 1000 });
    after(104);
    expect(c.focusState[pos(p, "gen_t_b")]).toBe(1);
    // Path done, gen_t_c closed: nothing left to pick.
    after(110);
    expect(c.focus).toBeNull();
    expect(c.focusState[pos(p, "gen_t_c")]).toBe(0);
    expect(c.focusesDone).toBe(2);
  });

  it("a human's focus is never picked for it", async () => {
    const { runner, p, id } = await aiGame({}, {}, ["FRA"]);
    stepTo(runner, dayStart(20));
    expect(p.country(id("FRA"))!.focus).toBeNull();
    expect(p.country(id("POL"))!.focus?.id).toBe("gen_t_a");
  });

  it("the path skips at most 3 blocked focuses, then picks by weight", async () => {
    const parts = (path: FocusId[]): Partial<ContentParts> => ({
      focuses: [
        // `available` false for now.
        focus("a1", { available: flag("t_open") }),
        focus("a2", { available: flag("t_open") }),
        focus("a3", { available: flag("t_open") }),
        // Startable; never picked by weight.
        focus("p_ok", { ai: { base: 0 } }),
        // The only focus the weights pick.
        focus("w_ok", { ai: { base: 10 } }),
        // Closed for good once w_ok is done: not counted as blocked.
        focus("e1", { exclusive: ["w_ok"] }),
        focus("d1", { prereq: [["e1"]] }),
      ],
      paths: { generic: path },
      branchPoints: {},
    });
    const pick = async (path: FocusId[], wDone = false) => {
      const { p, id } = await aiGame(parts(path));
      const c = p.country(id("FRA"))!;
      if (wDone) c.focusState[pos(p, "w_ok")] = 1;
      return aiPickFocus(p, id("FRA"), 0);
    };
    expect(await pick(["a1", "a2", "p_ok"])).toBe("p_ok");
    expect(await pick(["a1", "a2", "a3", "p_ok"])).toBe("w_ok");
    // e1 (exclusive) and d1 (its only prerequisite is closed) are off the path.
    expect(await pick(["a1", "e1", "a2", "d1", "p_ok"], true)).toBe("p_ok");
    expect(await pick(["a1", "a2", "a3", "p_ok"], true)).toBeNull();
    // A finished focus is passed over without counting.
    const { p, id } = await aiGame(parts(["w_ok", "a1", "a2", "p_ok"]));
    p.country(id("FRA"))!.focusState[pos(p, "w_ok")] = 1;
    expect(aiPickFocus(p, id("FRA"), 0)).toBe("p_ok");
  });

  it("a deviated branch takes the alternative", async () => {
    const { p, id } = await aiGame({});
    const fra = id("FRA");
    const c = p.country(fra)!;
    c.focusState[pos(p, "gen_t_a")] = 1;
    p.branchDeviations.set("FRA:bp_t", "gen_t_c");
    expect(historyPath(p, c)).toEqual(["gen_t_a", "gen_t_c"]);
    expect(aiPickFocus(p, fra, 0)).toBe("gen_t_c");
    p.branchDeviations.set("FRA:bp_t", null);
    expect(aiPickFocus(p, fra, 0)).toBe("gen_t_b");
    // Another country's deviation is its own.
    p.branchDeviations.set("FRA:bp_t", "gen_t_c");
    p.branchDeviations.set("POL:bp_t", null);
    expect(historyPath(p, p.country(id("POL"))!)).toEqual([
      "gen_t_a",
      "gen_t_b",
    ]);
  });

  it("a generic political deviation takes the second ideology", async () => {
    const ideos = ["dem", "com", "fas", "neu"];
    const ids = ideos.map((x) => `gen_pol_${x}`);
    const allies = [
      "gen_pol_dem_ally",
      "gen_pol_com_ally",
      "gen_pol_fas_ally",
      "gen_pol_neu_league",
    ];
    const { p, id } = await aiGame({
      focuses: [
        ...ids.map((f) => focus(f, { exclusive: ids.filter((x) => x !== f) })),
        ...allies.map((f, i) => focus(f, { prereq: [[ids[i]]] })),
      ],
      paths: { generic: ["@ideo", "@ideo_ally"] },
      branchPoints: {
        generic: [
          {
            id: "gen_politics",
            historical: "@ideo",
            alternatives: ids,
            political: true,
          },
        ],
      },
    });
    const fra = id("FRA");
    const c = p.country(fra)!;
    // No politics row: neutral, popularity 15 / 10 / 20 / 55.
    expect(c.ruling).toBe(3);
    p.branchDeviations.set("FRA:gen_politics", null);
    expect(historyPath(p, c)).toEqual(["gen_pol_neu", "gen_pol_neu_league"]);
    // Deviating (whichever alternative was rolled): the second ideology.
    p.branchDeviations.set("FRA:gen_politics", "gen_pol_dem");
    expect(historyPath(p, c)).toEqual(["gen_pol_fas", "gen_pol_fas_ally"]);
    expect(aiPickFocus(p, fra, 0)).toBe("gen_pol_fas");
    c.pop = [3000, 1000, 2000, 4000];
    expect(historyPath(p, c)).toEqual(["gen_pol_dem", "gen_pol_dem_ally"]);
    // Once an ideology focus is taken, the path keeps it.
    expect(startFocus(p, fra, "gen_pol_fas", p.mg.ticks())).toBeNull();
    expect(historyPath(p, c)).toEqual(["gen_pol_fas", "gen_pol_fas_ally"]);
    c.focus = null;
    c.focusState[pos(p, "gen_pol_fas")] = 1;
    expect(aiPickFocus(p, fra, 0)).toBe("gen_pol_fas_ally");
    // A government change moves the undeviated path with it (Japan, 1940).
    p.branchDeviations.set("FRA:gen_politics", null);
    c.focusState.fill(0);
    c.ruling = 2;
    expect(historyPath(p, c)).toEqual(["gen_pol_fas", "gen_pol_fas_ally"]);
  });

  it("every history path of the real content names real focuses", async () => {
    const { runner, p, id } = await aiGame(null);
    const tags: CountryTag[] = [
      "FRA",
      "DEU",
      "ITA",
      "POL",
      "SUN",
      "GBR",
      "AUT",
      "CSK",
      "LTU",
      "EST",
    ];
    for (const t of tags) {
      const c = p.country(id(t))!;
      for (const dev of [false, true]) {
        for (const bp of p.content.branchPoints[c.tree] ?? []) {
          p.branchDeviations.set(
            `${t}:${bp.id}`,
            dev ? bp.alternatives[0] : null,
          );
        }
        const path = historyPath(p, c);
        expect(path.length, t).toBeGreaterThan(20);
        for (const f of path) {
          expect(p.content.focusIdx.has(f), `${t} ${f}`).toBe(true);
          expect(p.content.focuses[p.content.focusIdx.get(f)!].tree).toBe(
            c.tree,
          );
        }
      }
      for (const bp of p.content.branchPoints[c.tree] ?? []) {
        p.branchDeviations.set(`${t}:${bp.id}`, null);
      }
    }
    // Day 0: every AI starts the first focus of its path.
    for (const t of tags) {
      stepTo(runner, dayStart(1));
      const c = p.country(id(t))!;
      expect(c.focus?.id, t).toBe(historyPath(p, c)[0]);
    }
  });

  it("weights follow ai.base, mods and the common factors", async () => {
    const { p, id } = await aiGame(
      {
        focuses: [
          focus("w_pol", { branch: "politics", ai: { base: 10 } }),
          focus("w_ind", {
            branch: "industry",
            ai: {
              base: 20,
              mods: [
                { if: { kind: "always", value: true }, factor: 150 },
                { if: { kind: "always", value: false }, factor: 0 },
              ],
            },
          }),
          focus("w_army", { branch: "army", ai: { base: 10 } }),
          // No `ai`: base 10.
          focus("w_dip", { branch: "diplomacy" }),
          focus("w_zero", { branch: "navy", ai: { base: 0 } }),
        ],
        paths: {},
        branchPoints: {},
      },
      { historicalAi: false },
    );
    const ww = p.ww;
    const shares = (tag: CountryTag, mil: number) => {
      const smallID = id(tag);
      p.econ.country(smallID)!.totals.mil = mil;
      const n = new Map<string, number>();
      for (let day = 0; day < 1000; day++) {
        const f = aiPickFocus(p, smallID, day)!;
        n.set(f, (n.get(f) ?? 0) + 1);
      }
      return n;
    };
    const expectShares = (
      n: Map<string, number>,
      w: Record<string, number>,
    ) => {
      const total = Object.values(w).reduce((a, b) => a + b, 0);
      for (const [f, x] of Object.entries(w)) {
        expect(Math.abs((n.get(f) ?? 0) / 1000 - x / total), f).toBeLessThan(
          0.05,
        );
      }
      expect(n.get("w_zero") ?? 0).toBe(0);
    };
    // France (democracy, 20 military factories, at war): industry
    // 20 × 150% × 130% = 39, army 10 × 200% = 20.
    ww.setWar(id("FRA"), id("DEU"), p.mg.ticks());
    expectShares(shares("FRA", 20), {
      w_pol: 10,
      w_ind: 39,
      w_army: 20,
      w_dip: 10,
    });
    // Poland (minor, no military factories): industry 30 × 150% × 150% = 67,
    // politics 10 × 70% = 7.
    expectShares(shares("POL", 0), {
      w_pol: 7,
      w_ind: 67,
      w_army: 10,
      w_dip: 10,
    });
    // Italy (aggressor): army and diplomacy × 150%.
    expectShares(shares("ITA", 0), {
      w_pol: 10,
      w_ind: 45,
      w_army: 15,
      w_dip: 15,
    });
  });

  it("a focus beat queues the focus first", async () => {
    const { p, id } = await aiGame({});
    const fra = id("FRA");
    const c = p.country(fra)!;
    // Nothing running: it starts now (from its saved progress).
    c.partial.set("gen_t_a", 5000);
    forceFocusNext(p, fra, "gen_t_a");
    expect(c.focus).toEqual({ id: "gen_t_a", progressMilli: 5000 });
    // Running: first in line, in place of what was queued — even an
    // exclusive partner of it; the running focus is not cancelled.
    c.queued = "gen_t_c";
    forceFocusNext(p, fra, "gen_t_b");
    expect(c.queued).toBe("gen_t_b");
    expect(c.focus?.id).toBe("gen_t_a");
    // Already running or finished: nothing changes.
    forceFocusNext(p, fra, "gen_t_a");
    expect(c.focus).toEqual({ id: "gen_t_a", progressMilli: 5000 });
    expect(c.queued).toBe("gen_t_b");
    // Refused (no prerequisite even with the running one): the queue stays.
    c.focus = { id: "gen_t_b", progressMilli: 0 };
    c.queued = null;
    c.focusState[pos(p, "gen_t_a")] = 0;
    forceFocusNext(p, fra, "gen_t_c");
    expect(c.queued).toBeNull();
    c.focusState[pos(p, "gen_t_a")] = 1;
    forceFocusNext(p, fra, "gen_t_a");
    expect(c.queued).toBeNull();
    // A human country is never moved.
    const { p: p2, id: id2 } = await aiGame({}, {}, ["FRA"]);
    forceFocusNext(p2, id2("FRA"), "gen_t_a");
    expect(p2.country(id2("FRA"))!.focus).toBeNull();
  });
});
