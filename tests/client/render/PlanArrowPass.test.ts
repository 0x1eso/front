// ww162 (battle planner, design §3): the pieces PlanArrowPass builds for the
// offensive line — a band in the army's hue through its regions with arrows
// from the front (broad), or one arrow chain (spearhead) — its handles, the
// dotted lines to pinned divisions, and the plan view's other armies, on
// the test map ww1936mini with a GL that records nothing.
import {
  type ArmyOrder,
  type ArmySummary,
  idleOrder,
} from "@openfront/engine-api/ww1936/LandTypes";
import { describe, expect, test } from "vitest";
import { WwLandSelection } from "../../../src/client/hud/ww1936/LandSelection";
import {
  PlanArrowPass,
  STYLE_BAND,
  STYLE_DOTS,
  STYLE_HEAD,
  STYLE_RING,
} from "../../../src/client/render/gl/passes/PlanArrowPass";
import { LandFrontWorld } from "../../../src/client/view/LandFrontWorld";
import { WwLandView } from "../../../src/client/view/WwLandView";
import { army, ID, mine, scenario } from "../ww1936/LandFixture";

const DEU = ID("DEU");
const POL = ID("POL");

function nullGL(): WebGL2RenderingContext {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "getProgramParameter" || prop === "getShaderParameter") {
          return () => true;
        }
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
}

interface Piece {
  hue: number;
  style: number;
  width: number;
  alpha: number;
  fromToken: boolean;
}

function build(armies: ArmySummary[], sel: WwLandSelection): Piece[] {
  const v = new WwLandView(scenario);
  v.apply(
    {
      armies,
      removedArmies: [],
      battles: [],
      endedBattles: [],
      regions: [],
      countries: [],
      details: [],
    },
    700,
  );
  const world = new LandFrontWorld(v, {
    war: () => ({
      prepEndTick: 600,
      wars: [{ a: DEU, b: POL, sinceTick: 0 }],
      capitulated: [],
      gauges: [],
    }),
    ticks: () => 700,
  });
  const pass = new PlanArrowPass(nullGL());
  pass.update(v, sel, DEU, 0.25, world);
  const d = (pass as unknown as { data: number[] }).data;
  const out: Piece[] = [];
  for (let i = 0; i < d.length; i += 12) {
    out.push({
      hue: d[i + 5],
      style: d[i + 6],
      width: d[i + 7],
      alpha: d[i + 8],
      fromToken: d[i + 10] === 1,
    });
  }
  return out;
}

const order = (over: Partial<ArmyOrder>): ArmyOrder => ({
  ...idleOrder(),
  kind: "front",
  enemy: POL,
  ...over,
});
const chosen = (id: number) => {
  const s = new WwLandSelection();
  s.select(id);
  return s;
};

describe("PlanArrowPass: the offensive line (ww162)", () => {
  test("a broad line: a band in the army's hue at 60 %, arrows from the front, waypoint handles", () => {
    const a = army(1, "DEU", 3, {
      mine: mine({ front: [3, 4], order: order({ goal: [6, 7] }) }),
    });
    const ps = build([a], chosen(1));
    // Army 1: ZONE_HUES[1] (hue 2 in the piece).
    const band = ps.filter((p) => p.hue === 2 && p.style === STYLE_BAND);
    expect(band).toHaveLength(1);
    expect(band[0].alpha).toBeCloseTo(0.6);
    // One arrow per 3 zone regions (2 regions: one), in today's red.
    expect(
      ps.filter((p) => p.style === STYLE_HEAD && p.hue === 0),
    ).toHaveLength(1);
    const rings = ps.filter((p) => p.style === STYLE_RING);
    expect(rings.map((p) => [p.hue, p.width])).toEqual([
      [2, 10],
      [2, 10],
    ]);
  });

  test("a spearhead: one chain through its waypoints, a head on the last only", () => {
    const a = army(1, "DEU", 3, {
      mine: mine({
        front: [3, 4],
        order: order({ goal: [6, 7], spear: true }),
      }),
    });
    const ps = build([a], chosen(1));
    expect(ps.filter((p) => p.hue === 2 && p.style === STYLE_BAND)).toEqual([]);
    expect(ps.filter((p) => p.style === STYLE_HEAD)).toHaveLength(1);
  });

  test("the front's end handles in [전선]; dotted lines to the pinned divisions", () => {
    const a = army(1, "DEU", 3, {
      mine: mine({
        front: [3, 4],
        order: order({ ends: [3, 4] }),
        pins: [
          [11, 4],
          [12, 4],
          [13, 3],
        ],
      }),
    });
    const sel = chosen(1);
    sel.setDraw("front");
    const ps = build([a], sel);
    expect(
      ps.filter((p) => p.style === STYLE_RING).map((p) => p.width),
    ).toEqual([12, 12]);
    // Munich's two pins: one dotted line from the token; Berlin's is its own region.
    expect(
      ps.filter((p) => p.style === STYLE_DOTS && p.fromToken),
    ).toHaveLength(1);
  });

  test("the plan view adds my other armies' offensive lines at 40 %", () => {
    const a = army(1, "DEU", 3, { mine: mine({ front: [3] }) });
    const b = army(2, "DEU", 4, {
      mine: mine({ front: [4], order: order({ goal: [7] }) }),
    });
    const sel = chosen(1);
    expect(build([a, b], sel)).toEqual([]);
    sel.planView = true;
    const heads = build([a, b], sel).filter((p) => p.style === STYLE_HEAD);
    expect(heads).toHaveLength(1);
    expect(heads[0].alpha).toBeCloseTo(0.95 * 0.4);
  });
});
