// Imjin sea layer (ww177 lane I2): the pure SeaRules checks and one seeded
// duel of two fleets on an open test sea, run twice to the same end.
import {
  angleOf,
  bears,
  currentState,
  formationSlot,
  hitPct,
  icos,
  isin,
  shipStats,
  windAt,
} from "@openfront/engine-lib/imjin/SeaRules";
import type { SeaCtx } from "@openfront/engine/imjin/sea/SeaCtx";
import { seaOrder } from "@openfront/engine/imjin/sea/SeaFleets";
import {
  addFleet,
  emptySeaState,
  seaHash,
  SeaState,
} from "@openfront/engine/imjin/sea/SeaState";
import { seaTick } from "@openfront/engine/imjin/sea/SeaTick";
import { describe, expect, it } from "vitest";

const W = 120;
const H = 60;
const JOSEON = 1;
const JAPAN = 2;

function testCtx(seed: number): SeaCtx {
  return {
    seed,
    tick: 0,
    month: 8,
    day: 0,
    night: false,
    width: W,
    height: H,
    ref: (x, y) => y * W + x,
    tileX: (t) => t % W,
    tileY: (t) => Math.floor(t / W),
    isWater: () => true,
    flags: () => ({
      coastal: false,
      lee: false,
      channel: false,
      shoal: false,
      current: 0,
    }),
    zoneOf: () => 0,
    hostile: (a, b) => a !== b,
    path: (from, to) => {
      // Straight line on the open test sea.
      const out: number[] = [];
      let x = from % W;
      let y = Math.floor(from / W);
      const tx = to % W;
      const ty = Math.floor(to / W);
      while (x !== tx || y !== ty) {
        x += Math.sign(tx - x);
        y += Math.sign(ty - y);
        out.push(y * W + x);
      }
      return out;
    },
    nearestPort: (owner) => (owner === JOSEON ? 30 * W + 110 : 30 * W + 2),
    portLevelAt: () => 0,
    currentAxis: () => 0,
    keepsPrizes: (owner) => owner === JAPAN,
  };
}

function duel(seed: number) {
  const st: SeaState = emptySeaState();
  const ctx = testCtx(seed);
  const jp = addFleet(
    st,
    JAPAN,
    30_500,
    30_500,
    [
      "atakebune",
      "sekibune",
      "sekibune",
      "sekibune",
      "sekibune",
      "sekibune",
      "sekibune",
      "kobaya",
      "kobaya",
      "kobaya",
      "kobaya",
    ],
    { formation: "wedge", heading: 0, admiral: { boarding: 3, nerve: 2 } },
  );
  const js = addFleet(
    st,
    JOSEON,
    40_500,
    30_500,
    [
      "panokseon",
      "turtle",
      "panokseon",
      "panokseon",
      "panokseon",
      "panokseon",
      "panokseon",
      "panokseon",
    ],
    {
      formation: "crane",
      heading: 512,
      admiral: { gunnery: 5, tactics: 5, nerve: 5 },
    },
  );
  expect(
    seaOrder(st, ctx, JAPAN, jp.id, { kind: "engage", mode: "board" }),
  ).toBe(true);
  expect(
    seaOrder(st, ctx, JOSEON, js.id, { kind: "engage", mode: "keep_range" }),
  ).toBe(true);
  expect(seaOrder(st, ctx, JOSEON, jp.id, { kind: "hold" })).toBe(false);
  const kinds: string[] = [];
  let opened = -1;
  let ended = -1;
  for (let t = 1; t <= 3000 && ended < 0; t++) {
    ctx.tick = t;
    seaTick(st, ctx);
    for (const e of st.events) {
      kinds.push(e.kind);
      if (e.kind === "battle_open" && opened < 0) opened = t;
      if (e.kind === "battle_end") ended = t;
    }
    st.events = [];
  }
  const side = (o: number) => st.ships.filter((s) => s.owner === o).length;
  const count = (k: string) => kinds.filter((x) => x === k).length;
  return {
    opened,
    ended,
    joseon: side(JOSEON),
    japan: side(JAPAN),
    sunk: count("sunk"),
    taken: count("taken") + count("burnt"),
    fled: count("flee"),
    hash: seaHash(st),
  };
}

describe("SeaRules", () => {
  it("integer trig and bearings agree", () => {
    expect(isin(0)).toBe(0);
    expect(isin(256)).toBe(1024);
    expect(icos(512)).toBe(-1024);
    expect(angleOf(10, 0)).toBe(0);
    expect(angleOf(0, 10)).toBe(256);
    expect(angleOf(-10, 0)).toBe(512);
    expect(angleOf(0, -10)).toBe(768);
    expect(Math.abs(angleOf(1000, 1000) - 128)).toBeLessThanOrEqual(1);
  });

  it("broadsides bear abeam, the turtle all round", () => {
    const p = shipStats("panokseon");
    expect(bears(p, 0, 256)).toBe(true);
    expect(bears(p, 0, 768)).toBe(true);
    expect(bears(p, 0, 0)).toBe(false);
    expect(bears(p, 0, 512)).toBe(false);
    expect(bears(p, 0, 0, true)).toBe(true);
    expect(bears(shipStats("turtle"), 0, 0)).toBe(true);
  });

  it("hit chance falls with range and rises against tight formations", () => {
    const base = { targetSize: 0, density: 0, gunnery: 0 } as const;
    const near = hitPct({ ...base, distMt: 1000, targetFormation: "line" });
    const far = hitPct({ ...base, distMt: 4000, targetFormation: "line" });
    expect(near).toBe(75);
    expect(far).toBe(30);
    expect(hitPct({ ...base, distMt: 4000, targetFormation: "column" })).toBe(
      36,
    );
    expect(hitPct({ ...base, distMt: 4000, targetFormation: "loose" })).toBe(
      24,
    );
    expect(hitPct({ ...base, distMt: 99_000, targetFormation: "line" })).toBe(
      5,
    );
  });

  it("the crane wing reaches forward on both sides", () => {
    const l = formationSlot("crane", 7, 9);
    const r = formationSlot("crane", 8, 9);
    expect(l.fwd).toBeGreaterThan(2000);
    expect(Math.sign(l.stbd)).toBe(-Math.sign(r.stbd));
  });

  it("a channel current turns every 30-60 s on the battle clock", () => {
    const a = currentState(7, 3, 0);
    expect(a.ticksToTurn).toBeGreaterThanOrEqual(300);
    expect(a.ticksToTurn).toBeLessThanOrEqual(600);
    const b = currentState(7, 3, a.ticksToTurn);
    expect(b.sign).toBe(-a.sign);
    expect(b.turns).toBe(1);
  });

  it("summer winds lean southerly", () => {
    let north = 0;
    for (let p = 0; p < 200; p++) {
      const w = windAt(11, 2, p, 7);
      if (Math.abs(((w.to - 768 + 1536) % 1024) - 512) < 128) north++;
    }
    expect(north).toBeGreaterThan(100);
  });
});

describe("SeaDuel", () => {
  it("two fleets fight to the same end on the same seed", () => {
    const a = duel(1592);
    const b = duel(1592);
    expect(b).toEqual(a);
    expect(a.opened).toBe(1);
    expect(a.ended).toBeGreaterThan(a.opened);
    expect(a).toMatchInlineSnapshot(`
      {
        "ended": 246,
        "fled": 1,
        "hash": 2608373883,
        "japan": 5,
        "joseon": 8,
        "opened": 1,
        "sunk": 6,
        "taken": 0,
      }
    `);
  });
});
