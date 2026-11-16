// ww229 (design ww227 §2, §6, §8): the engine side of the minors' national
// content: the `character` condition, old focus ids aliased to a national
// tree, rebels inheriting the tree (D6), start arms (D4) and the clamp of a
// minor's own equipment between the generic key and the majors' median (D2).
// ww232: a major's rebels inherit its tree the same way.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { KS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type DecisionDef,
  type FocusDef,
  type HistoryBeat,
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEOLOGIES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import { treePosIn } from "@openfront/engine-lib/ww1936/content/registry";
import { scaleFocusEffects } from "@openfront/engine-lib/ww1936/FocusScale";
import {
  tankStatsOfEntry,
  tankStatsRaw,
} from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { DEU_HIST } from "@openfront/engine-lib/ww1936/hist/deu";
import {
  clampGroupOf,
  majorCeiling,
} from "@openfront/engine-lib/ww1936/hist/MinorClamp";
import type { TankEntry } from "@openfront/engine-lib/ww1936/hist/Types";
import { weakGroundField } from "@openfront/engine-lib/ww1936/hist/WeakGeneric";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { applyStartArms } from "@openfront/engine/ww1936/depth/StartArms";
import {
  endCivilWar,
  startCivilWar,
  startCivilWarSlot,
} from "@openfront/engine/ww1936/endgame/CivilWar";
import { aiPickFocus } from "@openfront/engine/ww1936/politics/AiFocus";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  decisionBlock,
  decisionCards,
} from "@openfront/engine/ww1936/politics/Decisions";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import {
  focusBlock,
  focusCards,
} from "@openfront/engine/ww1936/politics/Focus";
import { runBeats } from "@openfront/engine/ww1936/politics/HistoryBeats";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, step, stepTo, wwGameStart, wwRunner } from "./util";

const focus = (id: string, y: number): FocusDef => ({
  id,
  tree: "POL",
  x: 0,
  y,
  days: 35,
  branch: "politics",
  icon: "flag",
  effects: [{ kind: "pp", amount: 10 }],
  ai: { base: 1 },
});

/** ww232: a major's tree: a done focus, one its flag opens, one on the history path. */
const DEU_T: FocusDef[] = [
  {
    ...focus("deu_t_a", 0),
    tree: "DEU",
    effects: [
      { kind: "set_flag", flag: "deu_t_ready" },
      { kind: "unlock_decision", id: "t_unlocked_by_tree" },
    ],
  },
  {
    ...focus("deu_t_b", 1),
    tree: "DEU",
    prereq: [["deu_t_a"]],
    available: { kind: "flag", flag: "deu_t_ready" },
    ai: { base: 10 },
  },
  { ...focus("deu_t_c", 2), tree: "DEU", ai: { base: 0 } },
];
/** ww229 MA1: a decision Germany's tree unlocks, and one only Germany may take. */
const DEU_DECISIONS: DecisionDef[] = [
  {
    id: "t_unlocked_by_tree",
    category: "political",
    for: "any",
    locked: true,
    ai: { base: 0 },
  },
  { id: "t_deu_only", category: "political", for: ["DEU"], ai: { base: 0 } },
];

/** ww232: beats that name Germany, never due on their own (the test runs them). */
const DEU_BEATS: HistoryBeat[] = [
  {
    id: "t_deu_focus",
    date: "1950-01-01",
    actor: "DEU",
    act: { kind: "focus", id: "deu_t_c" },
  },
  {
    id: "t_deu_effects",
    date: "1950-01-01",
    actor: "DEU",
    act: { kind: "effects", effects: [{ kind: "pp", amount: 10 }] },
  },
  {
    id: "t_ita_declares",
    date: "1950-01-01",
    actor: "ITA",
    act: { kind: "declare", target: "DEU" },
  },
];

beforeEach(() => {
  const base = endgameFixture();
  usePoliticsContent(
    endgameFixture({
      focuses: [
        ...base.focuses,
        focus("pol_t_a", 0),
        focus("pol_t_b", 1),
        ...DEU_T,
      ],
      paths: { ...base.paths, DEU: ["deu_t_c", "deu_t_b"] },
      beats: [...HISTORY_BEATS, ...DEU_BEATS],
      decisions: [...base.decisions, ...DEU_DECISIONS],
      characters: [{ tag: "POL", lean: "revisionist", patrons: ["FRA"] }],
      focusAliases: [{ tree: "POL", from: "gen_t_a", to: "pol_t_a" }],
    }),
  );
});
afterEach(() => usePoliticsContent(null));

describe("ww229: national trees in the engine", () => {
  it("character, aliases, rebels on the tree, start arms", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = ww.politics;
    const id = endId("POL");
    const c = pol.country(id)!;
    c.tree = "POL";
    c.focusState = new Uint8Array([1, 0]);
    const ctx = makeCtx(pol, id, id, 0, g.ticks());
    expect(evalCondition(ctx, { kind: "character", is: "revisionist" })).toBe(
      true,
    );
    expect(evalCondition(ctx, { kind: "character", is: "client" })).toBe(false);
    // The old generic id answers through the alias; pol_t_b is not done.
    expect(evalCondition(ctx, { kind: "focus_done", id: "gen_t_a" })).toBe(
      true,
    );
    expect(evalCondition(ctx, { kind: "focus_done", id: "pol_t_b" })).toBe(
      false,
    );

    // Start arms: a licensed Pz 38(t) in a slot and in stock, no licence record.
    const tank = DEU_HIST.find((e) => e.id === "deu_pz38t_c")!;
    const licences = ww.depth.market.licences.length;
    const [slot] = applyStartArms(ww.depth, id, [
      { entry: tank.id, origin: "licensed", count: 7, source: "test row" },
    ]);
    expect(slot).toBeGreaterThan(0);
    const s = ww.depth.designSlot(id, "tank", slot)!;
    expect([s.origin, s.def.hist, s.from]).toEqual([
      "licensed",
      tank.id,
      endId("DEU"),
    ]);
    expect(ww.economy.country(id)!.stock[equipKey("tank_design", slot)]).toBe(
      7,
    );
    expect(ww.depth.market.licences.length).toBe(licences);

    // D6: the rebels play the national tree with its done focuses.
    expect(startCivilWar(ww.endgame, id, "communist", g.ticks())).toBe(true);
    const rebel = endId("CW1");
    const r = pol.country(rebel)!;
    expect(r.tree).toBe("POL");
    expect([...r.focusState]).toEqual([1, 0]);
    expect(r.focus).toBeNull();
  }, 60_000);
});

describe("ww232: a major's rebels inherit its tree", () => {
  it("the tree, its done focuses and the flags it reads; beats naming the old tag stay clean", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = ww.politics;
    const deu = endId("DEU");
    const c = pol.country(deu)!;
    c.tree = "DEU";
    // deu_t_a done (its flag set), deu_t_c running.
    c.focusState = new Uint8Array([1, 0, 0]);
    c.focus = { id: "deu_t_c", progressMilli: 5000 };
    c.flags.set("deu_t_ready", [0, -1]);
    c.flags.set("t_not_read", [0, -1]);
    // What deu_t_a did; an unlock from elsewhere (an event) stays Germany's.
    c.unlocked.add("t_unlocked_by_tree");
    c.unlocked.add("t_unlocked_elsewhere");

    expect(startCivilWar(ww.endgame, deu, "communist", g.ticks())).toBe(true);
    const rebel = endId("CW1");
    const r = pol.country(rebel)!;
    expect(r.tree).toBe("DEU");
    expect([...r.focusState]).toEqual([1, 0, 0]);
    expect(r.focus).toBeNull();
    expect(c.focus?.id).toBe("deu_t_c");
    // The flag the tree reads came along (deu_t_b opens); the other did not.
    expect(r.flags.has("deu_t_ready")).toBe(true);
    expect(r.flags.has("t_not_read")).toBe(false);
    expect(focusBlock(pol, rebel, "deu_t_b", false)).toBeNull();
    expect(focusBlock(pol, rebel, "deu_t_a", false)).toBe("focus_done");
    // The panel reads the engine's tree.
    expect(pol.detail(r).tree).toBe("DEU");
    // ww229 MA1: the decision the tree unlocked and Germany's own table
    // come along; the rebels' cards show both.
    expect(r.unlocked.has("t_unlocked_by_tree")).toBe(true);
    expect(r.unlocked.has("t_unlocked_elsewhere")).toBe(false);
    for (const d of ["t_unlocked_by_tree", "t_deu_only"]) {
      expect(decisionBlock(pol, rebel, d, 0), d).toBeNull();
      expect(
        decisionCards(pol, rebel).some((x) => x.id === d),
        d,
      ).toBe(true);
    }
    // Another country's rebels on the generic tree claim nothing.
    expect(decisionBlock(pol, endId("ITA"), "t_deu_only", 0)).toBe(
      "decision_unavailable",
    );
    // Off the history path: the rebels pick by weight (deu_t_c weighs 0).
    const day = ww.day(g.ticks());
    expect(aiPickFocus(pol, rebel, day)).toBe("deu_t_b");

    // A beat naming Germany acts on Germany's own country, not the rebels.
    const mine = (id: string) =>
      pol.content.beats.findIndex((b) => b.id === id);
    const arm = (ids: string[]) =>
      pol.beats.forEach((s, i) => {
        const on = ids.includes(pol.content.beats[i].id);
        s.done = !on;
        s.skipped = false;
        if (on) s.fireDay = 0;
      });
    c.focus = null;
    arm(["t_deu_focus"]);
    runBeats(pol, day, g.ticks());
    expect(pol.country(deu)!.focus?.id).toBe("deu_t_c");
    expect(r.focus).toBeNull();

    // The rebels win: Germany is gone; its beats and the beats aimed at it
    // are used up without acting (no war on the rebels).
    endCivilWar(ww.endgame, ww.endgame.warOfPair(rebel, deu), 0, g.ticks());
    expect(pol.living(deu)).toBe(false);
    const pp = r.ppMilli;
    const ita = endId("ITA");
    arm(["t_deu_focus", "t_deu_effects", "t_ita_declares"]);
    expect(() => runBeats(pol, day, g.ticks())).not.toThrow();
    for (const id of ["t_deu_focus", "t_deu_effects", "t_ita_declares"]) {
      expect(pol.beats[mine(id)].done, id).toBe(true);
    }
    expect(r.ppMilli).toBe(pp);
    expect(ww.isAtWar(ita, rebel)).toBe(false);
    expect(r.tree).toBe("DEU");
  }, 60_000);
});

const MAJORS: readonly CountryTag[] = [
  "DEU",
  "ITA",
  "FRA",
  "GBR",
  "USA",
  "SUN",
  "JPN",
];

describe("ww232: the majors' rebels on the real map and content", () => {
  beforeEach(() => usePoliticsContent(null));

  it("every major's rebels play its tree; each of its focuses runs on them without errors", async () => {
    const maps = new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    );
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = ww.politics;
    // The road off history's course, as the engine runs it: Italy's
    // government out of fascist hands finishes ita_salo_republic, whose
    // effect raises the fascists. Their Salò republic plays the Italian tree
    // with the focus done, so what follows it is open to them.
    const ita = pol.idOfTag("ITA");
    const ic = pol.country(ita)!;
    ic.ruling = IDEO_DEM;
    const pos = (id: string) => treePosIn(pol.content, "ITA", id)!;
    ic.focusState[pos("ita_grand_council_vote")] = 1;
    ic.focus = { id: "ita_salo_republic", progressMilli: 69_999 };
    const salo = pol.idOfTag("CW1");
    for (let n = 0; n < 200 && !pol.living(salo); n++) step(runner);
    expect(pol.living(salo)).toBe(true);
    const sc = pol.country(salo)!;
    expect(sc.tree).toBe("ITA");
    expect(sc.ruling).toBe(IDEO_FAS);
    expect(sc.focusState[pos("ita_salo_republic")]).toBe(1);
    expect(sc.focusState[pos("ita_grand_council_vote")]).toBe(1);
    expect(focusBlock(pol, salo, "ita_partisan_war", false)).toBeNull();

    const rebels: number[] = [salo];
    for (const tag of MAJORS) {
      if (tag === "ITA") continue;
      const id = pol.idOfTag(tag);
      const c = pol.country(id)!;
      expect(c.tree, tag).toBe(tag);
      // The first two focuses done, the third bypassed, the fourth running.
      const tree = pol.content.treeFocuses[c.tree];
      c.focusState[0] = 1;
      c.focusState[1] = 1;
      c.focusState[2] = 2;
      c.focus = { id: pol.content.focuses[tree[3]].id, progressMilli: 1000 };
      const ideo = c.ruling === IDEO_COM ? "fascist" : "communist";
      const r = startCivilWarSlot(ww.endgame, id, ideo, g.ticks());
      expect(r, tag).toBeGreaterThan(0);
      const rc = pol.country(r)!;
      expect(rc.tree, tag).toBe(tag);
      expect([...rc.focusState.slice(0, 4)], tag).toEqual([1, 1, 2, 0]);
      expect(rc.focus, tag).toBeNull();
      expect(rc.ruling, tag).toBe(IDEOLOGIES.indexOf(ideo));
      expect(focusCards(pol, r).length, tag).toBe(tree.length);
      rebels.push(r);
    }
    // Every focus of the inherited tree, its effects on the rebels: nothing
    // throws (a focus naming the old tag acts on it or is skipped).
    const errors: string[] = [];
    for (const r of rebels) {
      const rc = pol.country(r)!;
      for (const fi of pol.content.treeFocuses[rc.tree]) {
        const f = pol.content.focuses[fi];
        try {
          applyEffects(
            makeCtx(pol, r, r, 0, g.ticks()),
            scaleFocusEffects(f.effects),
          );
        } catch (e) {
          errors.push(`${rc.tree} ${f.id}: ${String(e)}`);
        }
      }
      pol.flushEvents(g.ticks());
    }
    expect(errors).toEqual([]);
    // A month of play with every side on the AI: no error, the trees stay.
    step(runner, 300);
    const trees = rebels.map((r) => pol.country(r)!.tree);
    expect(trees).toEqual(["ITA", ...MAJORS.filter((t) => t !== "ITA")]);
  }, 300_000);
});

describe("ww229: a minor's own equipment is clamped (D2)", () => {
  it("between the generic key and the majors' median; majors untouched", () => {
    const mediums = DEU_HIST.filter(
      (e): e is TankEntry => e.family === "tank" && e.role === "medium",
    );
    const strong = mediums[mediums.length - 1];
    const raw = tankStatsOfEntry(strong);
    const minor: TankEntry = { ...strong, id: "pol_test", country: "POL" };
    const got = tankStatsOfEntry(minor);
    expect(clampGroupOf(minor)).toBe(clampGroupOf(strong));
    for (const f of ["soft", "hard", "brk", "pierce", "armor"] as const) {
      const ceil = majorCeiling(minor, f)!;
      expect(got[f], f).toBe(Math.min(raw[f], ceil));
    }
    // Costs and speed stay the real ones.
    expect([got.costMilli, got.speedCenti]).toEqual([
      raw.costMilli,
      raw.speedCenti,
    ]);
    // A weak minor tank is lifted to its generic key's number.
    const weak: TankEntry = {
      ...minor,
      spec: { ...minor.spec, hullFrontMm: 1, turretFrontMm: 1, penMm500: 1 },
    };
    const parts = strong.techs[0].split("_");
    const gen = Number(parts[parts.length - 1]);
    const w = tankStatsOfEntry(weak);
    for (const [f, ks] of [
      ["armor", KS.armor],
      ["pierce", KS.pierce],
    ] as const) {
      const floor = weakGroundField("medium_tank", gen, ks)!;
      expect(w[f], f).toBe(
        Math.min(
          Math.max(tankStatsRaw(weak)[f], floor),
          majorCeiling(weak, f)!,
        ),
      );
      expect(w[f], f).toBeGreaterThan(tankStatsRaw(weak)[f]);
    }
  });
});
