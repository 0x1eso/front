// World War 1936 P2 Task 7: where army tokens and battle markers stand, what
// a tap hits (spec §15.2, §15.3, §15.9), and the passes that draw them, on
// the test map ww1936mini with fake land updates.
import {
  ARMY_PARA,
  ArmySummary,
  BattleSummary,
  idleOrder,
  WwLandData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { WwLandSelection } from "../../../src/client/hud/ww1936/LandSelection";
import {
  LandTickClock,
  ParadropFlights,
} from "../../../src/client/render/gl/LandFrame";
import { ArmyTokenPass } from "../../../src/client/render/gl/passes/ArmyTokenPass";
import { BattleMarkerPass } from "../../../src/client/render/gl/passes/BattleMarkerPass";
import {
  PlanArrowPass,
  STYLE_BAND,
  STYLE_DOTS,
  STYLE_FLOW,
  STYLE_HEAD,
} from "../../../src/client/render/gl/passes/PlanArrowPass";
import {
  UT_TRANSPORT_PLANE,
  type UnitState,
} from "../../../src/client/render/types";
import { LandFrontWorld } from "../../../src/client/view/LandFrontWorld";
import {
  battleMarkers,
  fanSlot,
  hitToken,
  layoutTokens,
  TOKEN_STEP_PX,
  TokenLayoutCache,
  tokenLod,
  type TokenPlacement,
} from "../../../src/client/view/LandTokenLayout";
import { WwLandView } from "../../../src/client/view/WwLandView";

const MINI = path.join(__dirname, "../../testdata/maps/ww1936mini");
const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(MINI, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(MINI, "regions.bin"))),
);
const DEU = scenario.smallIdOf("DEU");
const POL = scenario.smallIdOf("POL");
// Test map v3 centers (plan table): Berlin 3 (65, 17), Warsaw 6 (105, 25).
const BERLIN = 3;
const MUNICH = 4;
const WARSAW = 6;
const KRAKOW = 7;

function army(over: Partial<ArmySummary> = {}): ArmySummary {
  return {
    id: 1,
    owner: DEU,
    nameNo: 1,
    general: 0,
    divisions: 12,
    strengthPm: 1000,
    orgPm: 1000,
    state: 0,
    region: BERLIN,
    move: null,
    sum: {
      divisions: 12,
      width: 0,
      soft: 0,
      hard: 0,
      def: 0,
      brk: 0,
      armor: 0,
      pierce: 0,
      hardnessPm: 0,
      orgMilli: 0,
      hpMilli: 0,
    },
    symbol: 0,
    mine: null,
    ...over,
  };
}

function mine(over: Partial<NonNullable<ArmySummary["mine"]>> = {}) {
  return {
    order: idleOrder(),
    front: [],
    planBp: 0,
    auto: false,
    path: [],
    supplyPm: 1000,
    etaTicks: -1,
    paraLastDay: -1,
    ...over,
  };
}

function battle(region: number, over: Partial<BattleSummary> = {}) {
  return {
    region,
    attacker: DEU,
    defender: POL,
    attLine: 3,
    attReserve: 0,
    defLine: 2,
    defReserve: 0,
    width: 90,
    attWidth: 90,
    defWidth: 60,
    directions: 1,
    progressPm: 250,
    attOrgPm: 800,
    defOrgPm: 600,
    attStrPm: 1000,
    defStrPm: 1000,
    ...over,
  };
}

function data(over: Partial<WwLandData> = {}): WwLandData {
  return {
    armies: [],
    removedArmies: [],
    battles: [],
    endedBattles: [],
    regions: [],
    countries: [],
    details: [],
    ...over,
  };
}

function viewWith(d: Partial<WwLandData>, tick = 0): WwLandView {
  const v = new WwLandView(scenario);
  v.apply(data(d), tick);
  return v;
}

const at = (ps: readonly TokenPlacement[], id: number) =>
  ps.find((p) => p.army === id)!;

describe("token places (spec §15.2)", () => {
  test("a moving token glides from the start center at 0‰ to the middle at 500‰", () => {
    const moving = army({
      state: 1,
      move: { from: BERLIN, to: WARSAW, progPm: 0, stepPm: 100 },
    });
    const v = viewWith({ armies: [moving] }, 10);
    expect(at(layoutTokens(v, 10, 4), 1)).toMatchObject({ x: 65, y: 17 });
    // Five ticks at 100‰ a tick: half way between (65, 17) and (105, 25).
    expect(at(layoutTokens(v, 15, 4), 1)).toMatchObject({ x: 85, y: 21 });
    v.apply(
      data({
        armies: [
          {
            ...moving,
            move: { from: BERLIN, to: WARSAW, progPm: 500, stepPm: 100 },
          },
        ],
      }),
      30,
    );
    expect(at(layoutTokens(v, 30, 4), 1)).toMatchObject({ x: 85, y: 21 });
  });

  test("three tokens in one region fan out vertically by army id, alternating up and down", () => {
    const v = viewWith({
      armies: [army({ id: 9 }), army({ id: 2 }), army({ id: 5 })],
    });
    const zoom = 4;
    const step = TOKEN_STEP_PX[0] / zoom; // one token height in tiles
    const ps = layoutTokens(v, 0, zoom);
    expect(ps.map((p) => p.army)).toEqual([2, 5, 9]);
    expect(at(ps, 2)).toMatchObject({ x: 65, y: 17 });
    expect(at(ps, 5)).toMatchObject({ x: 65, y: 17 - step });
    expect(at(ps, 9)).toMatchObject({ x: 65, y: 17 + step });
    expect([0, 1, 2, 3, 4].map(fanSlot)).toEqual([0, -1, 1, -2, 2]);
  });

  test("a region with a battle keeps its center for the battle marker", () => {
    const v = viewWith({
      armies: [army({ id: 1, region: WARSAW, owner: POL })],
      battles: [battle(WARSAW)],
    });
    const zoom = 2; // LOD 1: chips
    const p = at(layoutTokens(v, 0, zoom), 1);
    expect(p).toMatchObject({
      x: 105,
      y: 25 - TOKEN_STEP_PX[1] / zoom,
      lod: 1,
    });
    expect(battleMarkers(v)).toEqual([{ region: WARSAW, x: 105, y: 25 }]);
  });

  test("moving tokens are not fanned", () => {
    const v = viewWith({
      armies: [
        army({ id: 1 }),
        army({
          id: 2,
          move: { from: BERLIN, to: MUNICH, progPm: 0, stepPm: 0 },
        }),
      ],
    });
    const ps = layoutTokens(v, 0, 4);
    expect(at(ps, 1).y).toBe(17);
    expect(at(ps, 2).y).toBe(17);
  });

  test("LOD thresholds: dots under 1.5, chips under 3, tokens from 3", () => {
    expect([0.5, 1.49, 1.5, 2.99, 3, 8].map(tokenLod)).toEqual([
      2, 2, 1, 1, 0, 0,
    ]);
    const v = viewWith({ armies: [army()] });
    expect(layoutTokens(v, 0, 1).map((p) => p.lod)).toEqual([2]);
    expect(layoutTokens(v, 0, 2).map((p) => p.lod)).toEqual([1]);
    expect(layoutTokens(v, 0, 3).map((p) => p.lod)).toEqual([0]);
  });

  test("battle markers stand at the defending regions' centers, by region", () => {
    const v = viewWith({ battles: [battle(KRAKOW), battle(WARSAW)] });
    expect(battleMarkers(v)).toEqual([
      { region: WARSAW, x: 105, y: 25 },
      { region: KRAKOW, x: 105, y: 75 },
    ]);
  });
});

describe("hitToken (spec §15.3-1, §15.9)", () => {
  const p = (army: number, x: number, y: number): TokenPlacement => ({
    army,
    x,
    y,
    lod: 0,
  });

  test("the nearest token inside the radius; none outside it", () => {
    const ps = [p(4, 10, 10), p(7, 13, 10)];
    expect(hitToken(ps, 10.5, 10, 2, null)).toBe(4);
    expect(hitToken(ps, 12.5, 10, 2, null)).toBe(7);
    expect(hitToken(ps, 10, 12, 2, null)).toBe(4); // on the radius
    expect(hitToken(ps, 10, 12.01, 2, null)).toBeNull();
    expect(hitToken(ps, 30, 30, 5, null)).toBeNull();
  });

  test("tapping the chosen army's stack again cycles to the next id, round", () => {
    const ps = [p(9, 10, 10), p(2, 10, 11), p(5, 10, 9)];
    expect(hitToken(ps, 10, 10, 3, null)).toBe(9); // nearest
    expect(hitToken(ps, 10, 10, 3, 9)).toBe(2); // after 9: round to 2
    expect(hitToken(ps, 10, 10, 3, 2)).toBe(5);
    expect(hitToken(ps, 10, 10, 3, 5)).toBe(9);
    // The chosen army out of reach: the nearest one.
    expect(hitToken(ps, 10, 10, 3, 40)).toBe(9);
  });

  test("ties go to the smaller army id", () => {
    expect(hitToken([p(8, 9, 10), p(3, 11, 10)], 10, 10, 2, null)).toBe(3);
  });
});

describe("TokenLayoutCache (the renderer's layout)", () => {
  test("equals layoutTokens at a whole tick and glides between ticks", () => {
    const v = viewWith(
      {
        armies: [
          army({ id: 1 }),
          army({ id: 2 }),
          army({
            id: 3,
            move: { from: BERLIN, to: WARSAW, progPm: 0, stepPm: 100 },
          }),
        ],
      },
      10,
    );
    const cache = new TokenLayoutCache();
    expect(cache.update(v, 12, 4)).toBe(true);
    expect(cache.placements.slice(0, cache.count)).toEqual(
      layoutTokens(v, 12, 4),
    );
    expect(cache.update(v, 12.5, 4)).toBe(true);
    const a = layoutTokens(v, 12, 4).find((q) => q.army === 3)!;
    const b = layoutTokens(v, 13, 4).find((q) => q.army === 3)!;
    const mid = cache.placements[cache.indexOf(3)];
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2, 9);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2, 9);
  });

  test("nothing standing still: no work until the view, the tick or the zoom changes", () => {
    const v = viewWith({ armies: [army()] });
    const cache = new TokenLayoutCache();
    expect(cache.update(v, 3.2, 4)).toBe(true);
    expect(cache.update(v, 3.7, 4)).toBe(false);
    expect(cache.update(v, 3.7, 5)).toBe(true);
    expect(cache.update(v, 4.1, 5)).toBe(true); // a new tick re-samples
    v.apply(data({ armies: [army({ divisions: 3 })] }), 4);
    expect(cache.update(v, 4.1, 5)).toBe(true);
    expect(cache.armies[0].divisions).toBe(3);
  });
});

// ---- the passes, on a GL that counts ----

function countingGL() {
  const counts = { instanced: 0, uploads: [] as number[], textures: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArraysInstanced") {
          return (_m: number, _f: number, _c: number, n: number) => {
            counts.instanced++;
            return n;
          };
        }
        if (prop === "bufferSubData") {
          return (
            _t: number,
            _o: number,
            _d: Float32Array,
            _s: number,
            n: number,
          ) => counts.uploads.push(n);
        }
        if (prop === "texImage2D") return () => counts.textures++;
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

const cam = new Float32Array(9);
const tex = {} as WebGLTexture;

describe("ArmyTokenPass", () => {
  test("draws nothing and uploads nothing without armies", () => {
    const { gl, counts } = countingGL();
    const pass = new ArmyTokenPass(gl, tex, tex);
    const v = viewWith({});
    const layout = new TokenLayoutCache();
    pass.update(v, layout, layout.update(v, 0, 4), new WwLandSelection(), DEU);
    pass.draw(cam, 0.25, 0);
    expect(counts.instanced).toBe(0);
    expect(counts.uploads).toEqual([]);
  });

  test("writes one instance a token plus a row per front region, only when something changed", () => {
    const { gl, counts } = countingGL();
    const pass = new ArmyTokenPass(gl, tex, tex);
    const v = viewWith({
      armies: [
        army({ id: 1, mine: mine({ front: [BERLIN, MUNICH] }) }),
        army({ id: 2, owner: POL, region: WARSAW }),
      ],
      details: [
        {
          smallID: DEU,
          armyXpMilli: 0,
          templates: [],
          training: [],
          generals: [],
          divisions: [BERLIN, BERLIN, MUNICH, 1].map((region, i) => ({
            id: i + 1,
            army: 1,
            template: 1,
            region,
            strengthPm: 1000,
            orgPm: 1000,
            exp: 0,
            supplyPm: 1000,
            equipPm: 1000,
            battle: 0,
            role: 0,
          })),
        },
      ],
    });
    const sel = new WwLandSelection();
    sel.select(1);
    const layout = new TokenLayoutCache();
    pass.update(v, layout, layout.update(v, 0, 4), sel, DEU);
    expect(pass.instanceCount).toBe(2 + 2); // two tokens, two front rows
    pass.draw(cam, 0.25, 0);
    pass.update(v, layout, layout.update(v, 0, 4), sel, DEU);
    pass.draw(cam, 0.25, 1);
    expect(counts.uploads).toHaveLength(1);
    expect(counts.instanced).toBe(2);
    // Zoomed out to dots: the front rows go.
    pass.update(v, layout, layout.update(v, 0, 1), sel, DEU);
    expect(pass.instanceCount).toBe(2);
    expect(counts.uploads).toHaveLength(2);
  });
});

describe("BattleMarkerPass", () => {
  test("a marker per battle, rewritten when the view changes", () => {
    const { gl, counts } = countingGL();
    const pass = new BattleMarkerPass(gl, tex, tex);
    const v = viewWith({});
    pass.update(v, 0);
    pass.draw(cam, 0.25);
    expect(counts.instanced).toBe(0);
    v.apply(data({ battles: [battle(WARSAW), battle(KRAKOW)] }), 1);
    pass.update(v, 0);
    pass.update(v, 0);
    pass.draw(cam, 0.25);
    expect(pass.instanceCount).toBe(2);
    expect(counts.uploads).toEqual([2 * 8]);
    expect(counts.instanced).toBe(1);
  });
});

describe("PlanArrowPass", () => {
  // Instance floats: [x0, y0, x1, y1, arc, -, style, width px, alpha, -, fromToken, -].
  function recordingGL() {
    const { gl, counts } = countingGL();
    const written: Float32Array[] = [];
    const spy = new Proxy(gl, {
      get: (t, prop) =>
        prop === "bufferSubData"
          ? (_t: number, _o: number, d: Float32Array, _s: number, n: number) =>
              written.push(d.slice(0, n))
          : (t as unknown as Record<string | symbol, unknown>)[prop],
    }) as WebGL2RenderingContext;
    return { gl: spy, counts, written };
  }
  const rowsOf = (f: Float32Array) =>
    Array.from({ length: f.length / 12 }, (_, i) =>
      Array.from(f.subarray(i * 12, i * 12 + 12)),
    );
  const ofStyle = (f: Float32Array, style: number) =>
    rowsOf(f).filter((r) => r[6] === style);
  const TPP = 0.25; // zoom 4

  test("only the viewer's chosen army: a curved arrow a target, flowing while it executes", () => {
    const { gl, counts, written } = recordingGL();
    const pass = new PlanArrowPass(gl);
    const order = {
      ...idleOrder(),
      kind: "plan" as const,
      targets: [WARSAW, KRAKOW],
      executing: true,
    };
    const v = viewWith({
      armies: [
        army({ id: 1, mine: mine({ order, front: [BERLIN, MUNICH] }) }),
        army({ id: 2, owner: POL, region: WARSAW, mine: mine({ order }) }),
      ],
    });
    const sel = new WwLandSelection();
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    expect(pass.instanceCount).toBe(0);
    sel.select(2); // not the viewer's
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    expect(pass.instanceCount).toBe(0);
    sel.select(1);
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    const f = written[written.length - 1];
    expect(ofStyle(f, STYLE_HEAD)).toHaveLength(2);
    expect(ofStyle(f, STYLE_FLOW).length).toBeGreaterThan(20);
    expect(ofStyle(f, STYLE_BAND)).toHaveLength(0);
    // The band starts in the middle of the front: Berlin (65, 17), Munich (65, 52).
    expect(rowsOf(f)[0].slice(0, 2)).toEqual([65, 34.5]);
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v)); // nothing changed: no upload
    pass.draw(cam, TPP, 0, 65, 17);
    expect(counts.instanced).toBe(1);
    expect(written).toHaveLength(1);
  });

  test("the head stops short of the target's center, the band ends inside it; zooming rebuilds", () => {
    const { gl, written } = recordingGL();
    const pass = new PlanArrowPass(gl);
    const order = { ...idleOrder(), kind: "plan" as const, targets: [WARSAW] };
    const v = viewWith({ armies: [army({ id: 1, mine: mine({ order }) })] });
    const sel = new WwLandSelection();
    sel.select(1);
    const tipGap = (tpp: number) => {
      pass.update(v, sel, DEU, tpp, new LandFrontWorld(v));
      const f = written[written.length - 1];
      const [head] = ofStyle(f, STYLE_HEAD);
      const bands = ofStyle(f, STYLE_BAND);
      const last = bands[bands.length - 1];
      const d = (x: number, y: number) => Math.hypot(105 - x, 25 - y);
      // The band's end lies between the head's base and its tip.
      expect(d(last[2], last[3])).toBeLessThan(d(head[0], head[1]));
      expect(d(last[2], last[3])).toBeGreaterThan(d(head[2], head[3]));
      return d(head[2], head[3]);
    };
    // 20 px short of Warsaw along the curve: 5 tiles at zoom 4, 2 at zoom 10.
    expect(tipGap(0.25)).toBeCloseTo(5, 0);
    expect(tipGap(0.1)).toBeCloseTo(2, 0);
  });

  test("the move path is dotted from the token; the plan draft is faint", () => {
    const { gl, written } = recordingGL();
    const pass = new PlanArrowPass(gl);
    const v = viewWith({
      armies: [army({ id: 1, mine: mine({ path: [BERLIN, MUNICH, KRAKOW] }) })],
    });
    const sel = new WwLandSelection();
    sel.select(1);
    sel.targets = [WARSAW];
    sel.version++;
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    const rows = rowsOf(written[written.length - 1]);
    // Berlin is where the army stands: dots to Munich (from the token), then Krakow.
    expect(rows[0][6]).toBe(STYLE_DOTS);
    expect(rows[0][10]).toBe(1);
    expect(rows[0].slice(2, 4)).toEqual([65, 52]);
    expect(rows[1][6]).toBe(STYLE_DOTS);
    expect(rows[1].slice(0, 4)).toEqual([65, 52, 105, 75]);
    // The draft: one faint arrow.
    const draft = rows.slice(2);
    expect(draft.filter((r) => r[6] === STYLE_HEAD)).toHaveLength(1);
    expect(draft.every((r) => Math.abs(r[8] - 0.45) < 1e-6)).toBe(true);
  });

  test("a first tap: the walking path to one of ours, an arrow to anyone else", () => {
    const { gl, written } = recordingGL();
    const pass = new PlanArrowPass(gl);
    const v = viewWith({ armies: [army({ id: 1, mine: mine() })] });
    const sel = new WwLandSelection();
    sel.select(1);
    sel.pending = 5; // Rome: Italy, our side — Berlin, Munich, Rome
    sel.version++;
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    const dots = ofStyle(written[written.length - 1], STYLE_DOTS);
    expect(dots.map((r) => r.slice(2, 4))).toEqual([
      [65, 52],
      [65, 85],
    ]);
    sel.pending = WARSAW;
    sel.version++;
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    const f = written[written.length - 1];
    expect(ofStyle(f, STYLE_DOTS)).toHaveLength(0);
    expect(ofStyle(f, STYLE_HEAD)).toHaveLength(1);
  });

  test("an executing plan's band flows", () => {
    const { gl, written } = recordingGL();
    const pass = new PlanArrowPass(gl);
    const order = { ...idleOrder(), kind: "plan" as const, targets: [WARSAW] };
    const v = viewWith({ armies: [army({ id: 1, mine: mine({ order }) })] });
    const sel = new WwLandSelection();
    sel.select(1);
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    expect(written[written.length - 1][6]).toBe(STYLE_BAND);
    v.apply(
      data({
        armies: [
          army({ id: 1, mine: mine({ order: { ...order, executing: true } }) }),
        ],
      }),
      1,
    );
    pass.update(v, sel, DEU, TPP, new LandFrontWorld(v));
    expect(written[written.length - 1][6]).toBe(STYLE_FLOW);
  });
});

describe("TokenLayoutCache bounds", () => {
  test("placements never hold an army that left; hitToken counts only `count`", () => {
    const v = viewWith({
      armies: [
        army({ id: 1 }),
        army({ id: 2, region: WARSAW }),
        army({ id: 3, region: MUNICH }),
      ],
    });
    const cache = new TokenLayoutCache();
    cache.update(v, 0, 4);
    expect(cache.placements).toHaveLength(3);
    const kept = cache.placements[0];
    v.apply(data({ removedArmies: [3] }), 1);
    cache.update(v, 1, 4);
    expect(cache.count).toBe(2);
    expect(cache.placements).toHaveLength(2);
    expect(cache.placements[0]).toBe(kept); // the pool is reused
    // Munich's army is gone: nothing to tap there.
    expect(hitToken(cache.placements, 65, 52, 3, null)).toBeNull();
    // A pooled array with a stale entry past `count`.
    const p = (a: number, x: number, y: number): TokenPlacement => ({
      army: a,
      x,
      y,
      lod: 0,
    });
    const pooled = [p(1, 10, 10), p(9, 50, 50)];
    expect(hitToken(pooled, 50, 50, 2, null, 1)).toBeNull();
    expect(hitToken(pooled, 50, 50, 2, null)).toBe(9);
  });
});

describe("ParadropFlights (spec §7.6, pre-flight R2)", () => {
  const units = new Map<number, UnitState>();

  test("ARMY_PARA cleared with a region jump flies a transport plane, then opens the parachutes", () => {
    const flights = new ParadropFlights();
    const landed: number[][] = [];
    const land = (x: number, y: number, owner: number) =>
      landed.push([x, y, owner]);
    const v = viewWith({ armies: [army({ state: ARMY_PARA })] }, 10);
    expect(flights.withFlights(v, units, 10, land)).toBe(units);
    v.apply(data({ armies: [army({ state: 0, region: WARSAW })] }), 11);
    const m = flights.withFlights(v, units, 11, land);
    expect(m).not.toBe(units);
    expect(flights.count).toBe(1);
    const plane = [...m.values()][0];
    expect(plane).toMatchObject({
      unitType: UT_TRANSPORT_PLANE,
      ownerID: DEU,
      pos: scenario.centerTile(BERLIN),
      targetTile: scenario.centerTile(WARSAW),
    });
    expect(plane.id).toBeLessThan(0);
    // Berlin (65, 17) to Warsaw (105, 25): 40.8 tiles at 3 a tick = 14 ticks.
    const w = scenario.width;
    flights.withFlights(v, units, 18, land);
    expect(plane.pos).toBe(21 * w + 85); // half way
    for (let t = 19; t <= 25; t++) {
      expect(flights.withFlights(v, units, t, land).size).toBe(1);
    }
    expect(landed).toEqual([]);
    expect(flights.withFlights(v, units, 26, land)).toBe(units);
    expect(landed).toEqual([[105, 25, DEU]]);
    expect(flights.count).toBe(0);
  });

  test("a paradrop called off (the bit clears, the token stays) flies nothing", () => {
    const flights = new ParadropFlights();
    const land = () => {
      throw new Error("no drop");
    };
    const v = viewWith({ armies: [army({ state: ARMY_PARA })] }, 10);
    flights.withFlights(v, units, 10, land);
    v.apply(data({ armies: [army({ state: 0 })] }), 11);
    expect(flights.withFlights(v, units, 11, land)).toBe(units);
    // A walk without a paradrop order flies nothing either.
    v.apply(data({ armies: [army({ state: 0, region: MUNICH })] }), 12);
    expect(flights.withFlights(v, units, 12, land)).toBe(units);
    expect(flights.count).toBe(0);
  });
});

describe("LandTickClock and the renderer's land war start", () => {
  test("the clock starts at the tick it is given and glides at most one tick ahead", () => {
    const clock = new LandTickClock(100);
    clock.reset(5000, 1000);
    expect(clock.at(1000)).toBe(5000);
    expect(clock.at(1050)).toBe(5000.5);
    expect(clock.at(5000)).toBe(5001);
    clock.note(5001, 1100);
    expect(clock.at(1100)).toBe(5001);
  });

  test("setWwLand starts the glide at the game's tick, not 0", async () => {
    const { GPURenderer } =
      await import("../../../src/client/render/gl/Renderer");
    const { gl } = countingGL();
    const r = Object.create(GPURenderer.prototype) as Record<string, unknown>;
    Object.assign(r, {
      gl,
      paletteTex: tex,
      wwPasses: null,
      wwLand: null,
      landClock: new LandTickClock(100),
      paradrops: new ParadropFlights(),
      landFlagsStale: false,
      namePass: { setTroopFog: () => {} },
    });
    const v = viewWith({}, 4990);
    (r as unknown as InstanceType<typeof GPURenderer>).setWwLand(
      v,
      new WwLandSelection(),
      () => DEU,
      { war: () => null, ticks: () => 5000 },
    );
    const clock = r.landClock as LandTickClock;
    expect(Math.floor(clock.at(performance.now()))).toBe(5000);
    expect(r.landFlagsStale).toBe(true);
  });
});
