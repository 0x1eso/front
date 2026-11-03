// The US fascist path: the tree's shape and the congress_dissolve effect.
// The deep test map has no US: Britain stands in for it, as in Congress.test.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  USA_BRANCHES,
  USA_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/usa";
import { USA_FASCIST_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/usa_fascist";
import { treePosIn } from "@openfront/engine-lib/ww1936/content/registry";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import {
  createGameRunner,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import {
  addCongressPp,
  congressBlockFor,
  congressDay,
  dissolveCongress,
} from "@openfront/engine/ww1936/depth/Congress";
import { declareWarBlock } from "@openfront/engine/ww1936/Diplomacy";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { openOptions } from "@openfront/engine/ww1936/politics/Events";
import { focusFinished } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { byTag, HUMAN, order, pol, step, wwGameStart, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const US = DEEP.tag.GBR;

describe("USA fascist path: the tree", () => {
  const byId = new Map(USA_FOCUSES.map((f) => [f.id, f]));
  it("adds about 27 focuses in four groups, with symmetric forks", () => {
    expect(USA_FASCIST_FOCUSES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(USA_FASCIST_FOCUSES.map((f) => f.group))).toEqual(
      new Set([
        "usa_strongman",
        "usa_seizure",
        "usa_new_order",
        "usa_new_order_fate",
      ]),
    );
    for (const f of USA_FASCIST_FOCUSES) {
      for (const e of f.exclusive ?? []) {
        expect(byId.get(e)?.exclusive, f.id).toContain(f.id);
      }
      for (const g of f.prereq ?? []) {
        for (const p of g) expect(byId.has(p), `${f.id} needs ${p}`).toBe(true);
      }
    }
    // The war branches behind preparedness stay open on this path: no exclusive.
    expect(byId.get("usa_preparedness")?.exclusive ?? []).not.toContain(
      "usa_share_wealth",
    );
    expect(byId.get("usa_share_wealth")?.exclusive ?? []).toEqual([]);
    expect(byId.get("usa_share_wealth")?.available).toEqual({
      not: { kind: "focus_done", id: "usa_preparedness" },
    });
    expect(USA_BRANCHES.length).toBe(10);
  });

  it("the final focuses seize the regime and dissolve Congress, nothing more", () => {
    for (const id of ["usa_suspend_congress", "usa_seize_washington"]) {
      const kinds = byId.get(id)!.effects.map((e) => e.kind);
      expect(kinds.slice(0, 2)).toEqual([
        "set_government",
        "congress_dissolve",
      ]);
      expect(kinds).not.toContain("civil_war");
      expect(byId.get(id)!.effects).toContainEqual({
        kind: "set_flag",
        flag: "usa_regime_seized",
      });
    }
  });
});

describe("USA fascist path: congress_dissolve", () => {
  it("lifts every block, freezes the value and the effect, opens the gates", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const c = pol(runner.game).country(US)!;
    c.spirits.push({ id: "usa_isolation", untilDay: -1, addedDay: 0 });
    const deu = DEEP.tag.DEU;
    expect(congressBlockFor(d, US, US, "declare", deu)).toBe(true);
    c.ruling = IDEO_FAS;
    dissolveCongress(d, US);
    expect(d.mech.congressDissolved).toBe(true);
    expect(c.hasSpirit("usa_isolation")).toBe(false);
    for (const a of ["declare", "lend_lease", "law", "faction"] as const) {
      expect(congressBlockFor(d, US, US, a, deu), a).toBe(false);
    }
    const bp = d.mech.congressBp;
    ww.politics.wtBp = 8_000;
    congressDay(d, US, 10, DEEP.tag.ITA);
    congressDay(d, US, 11, DEEP.tag.ITA);
    expect(d.mech.congressBp).toBe(bp);
    addCongressPp(d, US, 40);
    expect(d.mech.congressBp).toBe(bp);
    const ctx = makeCtx(pol(runner.game), US, US, 0, 0);
    expect(evalCondition(ctx, { kind: "congress_above", pct: 99 })).toBe(true);
  });

  it("comes back when the US is democratic again, from the frozen value", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const c = pol(runner.game).country(US)!;
    c.ruling = IDEO_FAS;
    c.flags.set("usa_congress_gone", [0, -1]);
    dissolveCongress(d, US);
    const bp = d.mech.congressBp;
    congressDay(d, US, 20, DEEP.tag.ITA);
    expect(d.mech.congressDissolved).toBe(true);
    c.ruling = IDEO_DEM;
    congressDay(d, US, 21, DEEP.tag.ITA);
    expect(d.mech.congressDissolved).toBe(false);
    expect(c.flags.has("usa_congress_gone")).toBe(false);
    expect(Math.abs(d.mech.congressBp - bp)).toBeLessThanOrEqual(20);
  });

  it("moves the depth hash, and survives a snapshot round trip", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const before = d.hash();
    dissolveCongress(d, US);
    const h = d.hash();
    expect(h).not.toBe(before);
    d.restoreState(d.snapshot());
    expect(d.mech.congressDissolved).toBe(true);
    expect(d.hash()).toBe(h);
  });
});

// ---- The real world1936 map, USA human, driven by real orders ----

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);
const UPRISING = "usa_democratic_uprising";

async function usaGame(): Promise<GameRunner> {
  usePoliticsContent(null);
  const runner = await createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: "USA" }]),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(runner, 700);
  const c = me(runner);
  // The door (usa_long_populism, dated 1938) is taken as done: its popularity
  // effect (x3) is applied, the date is not waited for.
  mark(runner, ["usa_long_populism"]);
  addPopularity(c.pop, 2, 1500);
  addPopularity(c.pop, 0, 900);
  return runner;
}
const me = (r: GameRunner) => pol(r.game).country(pol(r.game).idOfTag("USA"))!;
function mark(r: GameRunner, ids: string[]) {
  const p = pol(r.game);
  const c = me(r);
  for (const id of ids) c.focusState[treePosIn(p.content, c.tree, id)!] = 1;
}
const fired = new WeakMap<GameRunner, number[]>();
/** Runs n ticks, noting each uprising card's day. */
function run(r: GameRunner, n: number) {
  const seen = new Set<number>();
  const days = fired.get(r) ?? [];
  fired.set(r, days);
  const known = new Set<number>(days);
  for (let i = 0; i < n; i++) {
    step(r);
    for (const p of me(r).pending) {
      if (p.eventId === UPRISING && !seen.has(p.uid)) {
        seen.add(p.uid);
        days.push(p.uid);
        known.add(p.uid);
      }
    }
  }
}
function runFocus(r: GameRunner, id: string) {
  const c = me(r);
  const p = pol(r.game);
  step(r, 1, [order(HUMAN, { kind: "focus_start", focus: id })]);
  expect(c.focus?.id ?? id).toBe(id);
  let n = 0;
  while (!focusFinished(p, c, id) && n++ < 4000) run(r, 1);
  expect(focusFinished(p, c, id), id).toBe(true);
}
const uprisings = (r: GameRunner) => (fired.get(r) ?? []).length;
/** The civil wars the US is a party to (Spain's is not ours). */
const civilWars = (r: GameRunner) => {
  const usa = pol(r.game).idOfTag("USA");
  return r.game
    .worldWar()!
    .endgame.wars.filter(
      (w) =>
        w.kind === "civil" &&
        w.sides.some((x) => x.members.some((m) => m.id === usa)),
    );
};
const dayOf = (r: GameRunner) => r.game.worldWar()!.day(r.game.ticks());

describe("USA fascist path on the real map", () => {
  it("legal route: a prepared player is not rebelled against, and may declare on Mexico", async () => {
    const r = await usaGame();
    for (const f of [
      "usa_share_wealth",
      "usa_radio_priest",
      "usa_silver_shirts",
      "usa_legal_path",
      "usa_emergency_powers",
      "usa_court_neutered",
    ]) {
      runFocus(r, f);
    }
    const c = me(r);
    expect(c.pop[2]).toBeGreaterThanOrEqual(3500);
    expect(c.pop[0]).toBeLessThan(2000);
    runFocus(r, "usa_suspend_congress");
    const d = r.game.worldWar()!.depth;
    expect(c.ruling).toBe(IDEO_FAS);
    expect(d.mech.congressDissolved).toBe(true);
    run(r, 9000); // about 300 days after the seizure
    expect(uprisings(r)).toBe(0);
    expect(civilWars(r)).toHaveLength(0);
    expect(c.ruling).toBe(IDEO_FAS);
    const g = r.game;
    expect(
      declareWarBlock(
        g,
        g.worldWar()!,
        byTag(g, "USA"),
        byTag(g, "MEX"),
        g.ticks(),
      ),
    ).toBeNull();
    expect(
      declareWarBlock(
        g,
        g.worldWar()!,
        byTag(g, "USA"),
        byTag(g, "CAN"),
        g.ticks(),
      ),
    ).toBeNull();
  }, 600_000);

  it("suppress: with a steady regime and democrats over 20% the only option is to suppress", async () => {
    const r = await usaGame();
    mark(r, ["usa_share_wealth", "usa_radio_priest", "usa_coup_path"]);
    runFocus(r, "usa_seize_washington");
    const c = me(r);
    c.stabBaseBp = 9500; // steady: stability stays at 25% or more
    const before = c.pop[0];
    expect(before).toBeGreaterThanOrEqual(2000);
    let card = c.pending.find((p) => p.eventId === UPRISING);
    for (let i = 0; i < 6000 && card === undefined; i++) {
      run(r, 1);
      card = c.pending.find((p) => p.eventId === UPRISING);
    }
    expect(card).toBeDefined();
    expect(openOptions(pol(r.game), pol(r.game).idOfTag("USA"), card!)).toEqual(
      ["a"],
    );
    const stab = c.stabBaseBp;
    // The card times out onto its only option.
    let n = 0;
    while (c.pending.some((p) => p.eventId === UPRISING) && n++ < 6000)
      run(r, 1);
    expect(c.pop[0]).toBeLessThan(before);
    expect(c.stabBaseBp).toBeLessThan(stab);
    expect(c.ruling).toBe(IDEO_FAS);
    expect(civilWars(r)).toHaveLength(0);
  }, 600_000);

  it("coup route: the democrats rise, the country splits, the human keeps the USA", async () => {
    const r = await usaGame();
    for (const f of [
      "usa_share_wealth",
      "usa_radio_priest",
      "usa_coup_path",
      "usa_seize_washington",
    ]) {
      runFocus(r, f);
    }
    const c = me(r);
    const split = dayOf(r);
    expect(civilWars(r)).toHaveLength(0); // the focus itself starts nothing
    run(r, 9000);
    expect(uprisings(r)).toBeGreaterThanOrEqual(1);
    const wars = civilWars(r);
    expect(wars).toHaveLength(1);
    expect(dayOf(r)).toBeGreaterThan(split);
    const usa = pol(r.game).idOfTag("USA");
    const sc = r.game.worldWar()!.scenario;
    let mine = 0;
    let rebels = 0;
    for (const reg of sc.landRegions) {
      const o = pol(r.game).legalOwner[reg.id];
      if (o === usa) mine += reg.vp ?? 0;
      else if (wars[0].sides.some((s) => s.members.some((m) => m.id === o))) {
        rebels += reg.vp ?? 0;
      }
    }
    expect(rebels).toBeGreaterThan(0);
    expect(mine).toBeGreaterThan(0);
    expect(c.tag).toBe("USA");
    expect(c.ruling).toBe(IDEO_FAS);
    expect(r.game.worldWar()!.depth.mech.congressDissolved).toBe(true);
    expect(rebels / (mine + rebels)).toBeGreaterThan(0.25);
  }, 600_000);

  it("civil-war slots full: the uprising's civil war leaves the US fascist and Congress dissolved", async () => {
    const r = await usaGame();
    mark(r, ["usa_share_wealth", "usa_radio_priest", "usa_coup_path"]);
    runFocus(r, "usa_seize_washington");
    const c = me(r);
    const eg = r.game.worldWar()!.endgame;
    for (const t of CIVIL_WAR_SLOTS) {
      eg.countryStateArr[r.game.worldWar()!.scenario.smallIdOf(t)] = CS_GONE;
    }
    c.stabBaseBp = 0; // not steady: the only option is the civil war
    let n = 0;
    while (uprisings(r) === 0 && n++ < 6000) run(r, 1);
    expect(uprisings(r)).toBeGreaterThanOrEqual(1);
    run(r, 4500); // the card times out onto the civil war, which cannot start
    expect(civilWars(r)).toHaveLength(0);
    expect(c.ruling).toBe(IDEO_FAS);
    expect(r.game.worldWar()!.depth.mech.congressDissolved).toBe(true);
    expect(c.hasSpirit("gen_civil_strife")).toBe(true);
  }, 600_000);
});
