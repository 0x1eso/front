// ww8 lane F: the wing tokens, the flights drawn from schedule rows, the
// air battle flags and the fog on all of them (design §8.2, §8.3, §9).
import {
  type WingFlightRow,
  WP_BACK,
  WP_FERRY,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
} from "@openfront/engine-api/ww1936/AirTypes";
import { ID_AIR } from "@openfront/engine-api/ww1936/DepthTypes";
import { describe, expect, it } from "vitest";
import { fogModelOf } from "../../../src/client/hud/ww1936/FogModel";
import {
  ShipSpriteProgram,
  TEXT_OWNER,
} from "../../../src/client/render/gl/passes/FleetTokenPass";
import {
  packTextStyle,
  WingTokenPass,
} from "../../../src/client/render/gl/passes/WingTokenPass";
import {
  airLayerColors,
  airLayerFlags,
  LAYER_FLAG_FIGHT,
} from "../../../src/client/view/AirZoneColors";
import {
  flightPose,
  layoutWings,
  MERGED_COLUMN_PX,
  pickWingSlot,
  rangeEllipseTiles,
  SLOT_BASE,
  SLOT_GROUP,
  SLOT_MERGED,
  SLOT_TOKEN,
  STATION_KEY,
  WING_COLUMN_PX,
  wingPhase,
  type WingPose,
  type WingSlot,
} from "../../../src/client/view/WingTokenLayout";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { REGION, SR } from "../../ww1936/seaFixture";
import { sea, seaGame, type SeaOptions, SID, wingBrief } from "./SeaAirFixture";

function fakeGL(): WebGL2RenderingContext {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "getParameter") return () => 256;
        if (/^[A-Z0-9_]+$/.test(prop)) return 0;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
}

/** I am Britain; `level` is my air intel on Germany. */
function fogged(level: number, o: SeaOptions) {
  const s = seaGame({ me: "GBR", ...o });
  const depth = new WwDepthView();
  const row = new Array<number>((sea.countries.length + 1) * 4).fill(0);
  row[SID("DEU") * 4 + ID_AIR] = level;
  depth.apply({ intel: [{ observer: SID("GBR"), row }], fx: [], news: [] });
  const game = {
    ...s.game,
    wwDepth: () => depth,
    isSpectator: () => false,
    gameOver: () => false,
  };
  return { ...s, game, fog: fogModelOf(game as never) };
}

const GBR = () => SID("GBR");
const DEU = () => SID("DEU");
const none = new Set<number>();

const gbrWings = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    wingBrief({
      id: i + 1,
      owner: GBR(),
      side: GBR(),
      base: REGION.london,
      planes: 100 + i,
    }),
  );

const foreign = (n: number) =>
  gbrWings(n).map((w) => ({ ...w, owner: DEU(), side: DEU() }));

describe("wing token layout", () => {
  it("shows a base chip with the air layer off, a group chip from three wings, tokens below", () => {
    const g = seaGame({ wings: foreign(3) });
    const out: WingSlot[] = [];
    const lay = (airLayer: boolean, chosen = none, expanded = none, zoom = 4) =>
      layoutWings(
        g.air,
        g.navy,
        undefined,
        { zoom, airLayer, chosen, expanded },
        out,
      );
    expect(lay(false)).toBe(1);
    expect(out[0].kind).toBe(SLOT_BASE);
    expect(out[0].planes).toBe(303);
    expect(lay(true)).toBe(1);
    expect(out[0].kind).toBe(SLOT_GROUP);
    expect(out[0].wings).toBe(3);
    // A tap opened the base: three tokens, fanned apart.
    expect(lay(true, none, new Set([REGION.london]))).toBe(3);
    expect(new Set(out.map((s) => s.y)).size).toBe(3);
    expect(out.every((s) => s.kind === SLOT_TOKEN)).toBe(true);
    // A chosen wing is a token whatever the layer says.
    expect(lay(false, new Set([2]))).toBe(2);
    expect(out.filter((s) => s.kind === SLOT_TOKEN).map((s) => s.wing)).toEqual(
      [2],
    );
    // Fewer than three wings are tokens; ww162: below zoom 3 a base is one
    // merged chip per owner.
    const two = seaGame({ wings: foreign(2) });
    expect(lay(true, none, none, 4)).toBe(1);
    expect(
      layoutWings(
        two.air,
        two.navy,
        undefined,
        { zoom: 4, airLayer: true, chosen: none, expanded: none },
        out,
      ),
    ).toBe(2);
    expect(out[0].lod).toBe(0);
    for (const zoom of [2, 1]) {
      expect(
        layoutWings(
          two.air,
          two.navy,
          undefined,
          { zoom, airLayer: true, chosen: none, expanded: none },
          out,
        ),
      ).toBe(1);
      expect(out[0]).toMatchObject({
        kind: SLOT_MERGED,
        wings: 2,
        planes: 201,
        mine: false,
      });
    }
  });

  it("ww162: wings group by zoom — merged per owner below 3, today's rule to 6, one token each from 6", () => {
    const wings = [
      ...gbrWings(2),
      ...foreign(3).map((w) => ({ ...w, id: w.id + 10 })),
    ];
    const g = seaGame({ wings });
    const out: WingSlot[] = [];
    const lay = (
      zoom: number,
      airLayer = true,
      chosen = none,
      expanded = none,
      split?: boolean,
    ) =>
      layoutWings(
        g.air,
        g.navy,
        undefined,
        { zoom, airLayer, chosen, expanded, split },
        out,
      );
    // Below 3: one chip for my two wings, one for Germany's three.
    expect(lay(2)).toBe(2);
    expect(out.map((s) => [s.kind, s.owner, s.wings, s.mine])).toEqual([
      [SLOT_MERGED, GBR(), 2, true],
      [SLOT_MERGED, DEU(), 3, false],
    ]);
    expect(out[0].planes).toBe(201);
    expect(out[0].pm).toBeGreaterThan(0);
    expect(out[0].y).not.toBe(out[1].y); // fanned apart
    // Only my chip takes a tap (it opens the fan).
    expect(pickWingSlot(out, out[0].x, out[0].y, 2)?.kind).toBe(SLOT_MERGED);
    expect(pickWingSlot(out, out[1].x, out[1].y, 2)).toBeNull();
    // Opened: every wing at the base is a token again.
    expect(lay(2, true, none, new Set([REGION.london]))).toBe(5);
    expect(out.every((s) => s.kind === SLOT_TOKEN)).toBe(true);
    // A chosen wing keeps its token; the rest stays merged.
    expect(lay(2, true, new Set([1]))).toBe(3);
    expect(out.filter((s) => s.kind === SLOT_TOKEN).map((s) => s.wing)).toEqual(
      [1],
    );
    // 3 to 6: today's rule (my wings tokens, three foreign ones a group chip).
    expect(lay(4)).toBe(3);
    expect(out.filter((s) => s.kind === SLOT_GROUP)).toHaveLength(1);
    // From 6 (or split by the pass's hysteresis): every wing a token.
    expect(lay(6)).toBe(5);
    expect(lay(5.5, true, none, none, true)).toBe(5);
    expect(lay(5.5, true, none, none, false)).toBe(3);
    // The layer off: only mine and the chosen keep tokens, the rest a base chip.
    expect(lay(8, false)).toBe(3);
    expect(out.filter((s) => s.kind === SLOT_BASE)).toHaveLength(1);
  });

  it("ww162: below zoom 3 wings on station are chipped over their air zone", () => {
    const station = wingBrief({
      id: 1,
      owner: GBR(),
      side: GBR(),
      base: REGION.london,
      planes: 90,
      flySr: SR.westLand,
    });
    const home = wingBrief({
      id: 2,
      owner: GBR(),
      side: GBR(),
      base: REGION.london,
      planes: 80,
    });
    const g = seaGame({
      wings: [station, home],
      flights: [[1, WP_STATION, 800, 20, 0, 12, REGION.paris, 100]],
    });
    const out: WingSlot[] = [];
    const input = {
      zoom: 2,
      airLayer: true,
      chosen: none,
      expanded: none,
      tick: 700,
    };
    expect(layoutWings(g.air, g.navy, undefined, input, out)).toBe(2);
    const zone = out.find((s) => s.base === STATION_KEY + SR.westLand)!;
    expect(zone).toMatchObject({ kind: SLOT_MERGED, planes: 90, wings: 1 });
    const c = g.air.scenario.sr(SR.westLand)!.center;
    expect([zone.x, zone.y]).toEqual([
      c % g.air.scenario.width,
      Math.floor(c / g.air.scenario.width),
    ]);
    // After the station the wing is back in its base's chip.
    expect(
      layoutWings(g.air, g.navy, undefined, { ...input, tick: 900 }, out),
    ).toBe(1);
    expect(out[0]).toMatchObject({ base: REGION.london, wings: 2 });
  });

  it("ww162: a merged chip's style packs its strength bar and wing count", () => {
    expect(packTextStyle(TEXT_OWNER, -1, 0)).toBe(TEXT_OWNER);
    const v = packTextStyle(TEXT_OWNER, 655, 3);
    expect(v & 3).toBe(TEXT_OWNER);
    expect(((v >> 2) & 127) - 1).toBe(66);
    expect(v >> 9).toBe(3);
  });

  it("my own planes are tokens whatever the lens says, never a chip (w51)", () => {
    const g = seaGame({ wings: gbrWings(4) });
    const out: WingSlot[] = [];
    const n = layoutWings(
      g.air,
      g.navy,
      undefined,
      { zoom: 4, airLayer: false, chosen: none, expanded: none },
      out,
    );
    expect(n).toBe(4);
    expect(out.every((s) => s.kind === SLOT_TOKEN)).toBe(true);
  });

  it("ww162: at a base where land counters stand the wings take a column of their own", () => {
    const g = seaGame({ wings: gbrWings(2) });
    const out: WingSlot[] = [];
    const lay = (zoom: number, landAt?: ReadonlySet<number>) => {
      layoutWings(
        g.air,
        g.navy,
        undefined,
        { zoom, airLayer: true, chosen: none, expanded: none, landAt },
        out,
      );
      return out.map((s) => [s.x, s.y]);
    };
    const free = lay(8);
    // Land elsewhere: nothing moves.
    expect(lay(8, new Set([REGION.paris]))).toEqual(free);
    // Land at the base: the same fan, WING_COLUMN_PX east (a token wide and more).
    expect(lay(8, new Set([REGION.london]))).toEqual(
      free.map(([x, y]) => [x + WING_COLUMN_PX / 8, y]),
    );
    expect(WING_COLUMN_PX).toBeGreaterThanOrEqual(31 + 26);
    // Below zoom 3 the merged chip steps aside as well.
    const merged = lay(2);
    expect(lay(2, new Set([REGION.london]))).toEqual(
      merged.map(([x, y]) => [x + MERGED_COLUMN_PX / 2, y]),
    );
  });

  it("a tap hits the nearest slot within the tap radius", () => {
    const g = seaGame({ wings: gbrWings(2) });
    const out: WingSlot[] = [];
    layoutWings(
      g.air,
      g.navy,
      undefined,
      { zoom: 4, airLayer: true, chosen: none, expanded: none },
      out,
    );
    const s = out[1];
    expect(pickWingSlot(out, s.x + 1, s.y, 4)?.wing).toBe(s.wing);
    expect(pickWingSlot(out, s.x + 500, s.y, 4)).toBeNull();
  });

  it("works the phase out from the latest schedule row", () => {
    const b = wingBrief({ id: 1 });
    const row: WingFlightRow = [1, WP_OUT, 60, 20, 10, 12, REGION.berlin, 100];
    const at = (t: number) => wingPhase(b, row, t);
    expect([at(59), at(60), at(70), at(89), at(90), at(101), at(102)]).toEqual([
      WP_OUT,
      WP_STATION,
      WP_BACK,
      WP_BACK,
      WP_REARM,
      WP_REARM,
      WP_GROUND,
    ]);
    expect(wingPhase(b, [1, WP_FERRY, 30, 30, 0, 0, 0, 90], 29)).toBe(WP_FERRY);
    expect(wingPhase(b, undefined, 5)).toBe(WP_GROUND);
  });
});

describe("wing flights from schedule rows", () => {
  const W = 1000;
  const base = [100, 100] as const;
  const target = [300, 100] as const;
  const pose: WingPose = {
    x: 0,
    y: 0,
    heading: 0,
    progress: 0,
    flown: 0,
    loiter: false,
  };
  const row = (leg: number): WingFlightRow => [
    1,
    WP_OUT,
    60,
    leg,
    10,
    12,
    5,
    100,
  ];

  it("flies out, circles the target, and flies back", () => {
    expect(flightPose(W, base, target, row(20), 39, 0, pose)).toBe(false);
    expect(flightPose(W, base, target, row(20), 50, 0, pose)).toBe(true);
    expect(pose.x).toBeCloseTo(200);
    expect(pose.heading).toBeCloseTo(0);
    expect(flightPose(W, base, target, row(20), 65, 0, pose)).toBe(true);
    expect(pose.loiter).toBe(true);
    expect(Math.hypot(pose.x - 300, pose.y - 100)).toBeLessThan(5);
    expect(flightPose(W, base, target, row(20), 75, 0, pose)).toBe(true);
    expect(pose.x).toBeCloseTo(250);
    expect(Math.abs(pose.heading)).toBeCloseTo(Math.PI);
    expect(flightPose(W, base, target, row(20), 95, 0, pose)).toBe(false);
  });

  it("a ferry flies from the base it left, then rests on the ground", () => {
    // Takes off at 25, lands at 45, rests until 60; `target` is the base it left.
    const f: WingFlightRow = [1, WP_FERRY, 60, 20, 0, 15, 5, 100];
    expect(flightPose(W, base, target, f, 24, 0, pose)).toBe(false);
    expect(flightPose(W, base, target, f, 35, 0, pose)).toBe(true);
    expect(pose.x).toBeCloseTo(200);
    expect(Math.abs(pose.heading)).toBeCloseTo(Math.PI);
    expect(flightPose(W, base, target, f, 46, 0, pose)).toBe(false);
  });

  it("draws a short leg at least as long as the minimum, on screen only", () => {
    // A 2-tick leg shown over 4 ticks: half way at 2 ticks in.
    expect(flightPose(W, base, target, row(2), 60, 4, pose)).toBe(true);
    expect(pose.x).toBeCloseTo(200);
    // It lands late, not early.
    expect(flightPose(W, base, target, row(2), 73, 4, pose)).toBe(true);
    expect(flightPose(W, base, target, row(2), 78, 4, pose)).toBe(false);
  });

  it("takes the short way across the date line", () => {
    expect(flightPose(W, [990, 50], [10, 50], row(20), 50, 0, pose)).toBe(true);
    expect(pose.x).toBeCloseTo(0, 0);
  });

  it("makes the range ellipse from the map's own km", () => {
    const e = rangeEllipseTiles(sea, 10, 10, 600);
    expect(e.rx).toBeGreaterThan(0);
    expect(e.ry).toBeGreaterThan(0);
  });
});

describe("the air layer's battle flags", () => {
  it("flags a zone for a moment, only where the fog shows the battle", () => {
    const g = seaGame({
      wings: [],
      fights: [[SR.approaches, DEU(), 5]],
      fightsAtMs: 1000,
    });
    const idx = sea.srIdxOf(SR.approaches);
    expect(g.air.activeFights(1500)).toBe(1);
    expect(g.air.activeFights(5000)).toBe(0);
    expect(airLayerFlags(g.air, 1500, () => true)[idx] & LAYER_FLAG_FIGHT).toBe(
      LAYER_FLAG_FIGHT,
    );
    expect(airLayerFlags(g.air, 5000, () => true)[idx]).toBe(0);
    expect(airLayerFlags(g.air, 1500, () => false)[idx]).toBe(0);
  });

  it("colours each air zone on its own", () => {
    const g = seaGame({
      zones: [SR.approaches, SR.central].map((sr, i) => ({
        sr,
        sides: [{ side: GBR(), supPm: i === 0 ? 900 : 100, sorties: [] }],
        result: [],
      })) as never,
    });
    const t = airLayerColors(g.air);
    const a = sea.srIdxOf(SR.approaches) * 4;
    const b = sea.srIdxOf(SR.central) * 4;
    expect(t.slice(a, a + 3)).not.toEqual(t.slice(b, b + 3));
  });
});

describe("the fog on wings", () => {
  const enemy = (over = {}) =>
    wingBrief({
      id: 9,
      owner: DEU(),
      side: DEU(),
      base: REGION.berlin,
      planes: 77,
      ...over,
    });

  it("a hidden wing gets no slot and no place on the GPU; a seen one does", () => {
    const run = (level: number) => {
      const g = fogged(level, { wings: [...gbrWings(1), enemy()] });
      const pass = new WingTokenPass(
        fakeGL(),
        new ShipSpriteProgram(fakeGL(), {}, {}),
      );
      pass.update(g.air, g.navy, 700, 4, true, none, none, 0);
      const t = sea.centerTile(REGION.berlin);
      const bx = (t % sea.width) + 0.5;
      const by = Math.floor(t / sea.width) + 0.5;
      let at = false;
      for (let i = 0; i < pass.drawn; i++) {
        if (pass.floats[i * 12] === bx && pass.floats[i * 12 + 1] === by)
          at = true;
      }
      return { drawn: pass.drawn, at, slots: pass.placed.map((s) => s.wing) };
    };
    const hidden = run(0);
    expect(hidden.at).toBe(false);
    expect(hidden.slots).toEqual([1]);
    expect(hidden.drawn).toBe(1);
    const seen = run(80);
    expect(seen.at).toBe(true);
    expect(seen.slots).toEqual([1, 9]);
  });

  it("an enemy wing's planes go through the air band; mine are exact", () => {
    const g = fogged(50, { wings: [...gbrWings(1), enemy()] });
    expect(g.fog.wingView(gbrWings(1)[0])).toEqual({
      visible: true,
      planes: 100,
      approx: false,
    });
    const v = g.fog.wingView(enemy());
    expect(v.visible).toBe(true);
    if (v.visible) {
      expect(v.planes).not.toBe(77);
      expect(v.approx).toBe(true);
    }
  });

  it("a hidden enemy flight and a hidden battle stay hidden; my own show", () => {
    const g = fogged(0, { wings: [enemy({ flySr: SR.approaches })] });
    expect(g.fog.wingFlightVisible(enemy({ flySr: SR.approaches }))).toBe(
      false,
    );
    expect(g.fog.fightVisible(SR.approaches, DEU())).toBe(false);
    expect(g.fog.fightVisible(SR.approaches, GBR())).toBe(true);
    const mine = wingBrief({
      id: 2,
      owner: GBR(),
      side: GBR(),
      base: REGION.london,
    });
    expect(g.fog.wingFlightVisible(mine)).toBe(true);
    g.fog.forceOff(true);
    expect(g.fog.wingFlightVisible(enemy())).toBe(true);
  });
});
