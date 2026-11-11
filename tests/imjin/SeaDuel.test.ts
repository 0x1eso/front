// Imjin sea layer (ww177 lane I2): the pure SeaRules checks and one seeded
// duel of two fleets on an open test sea, run twice to the same end.
import {
  angleOf,
  bears,
  chaseDisorderVolleys,
  craneFocus,
  currentState,
  engagedLoss,
  formationSlot,
  hitPct,
  icos,
  isin,
  MORALE_MAX,
  MT,
  shipBreaks,
  shipStats,
  steadied,
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
      currentDir: 0,
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
    // ww177 P7b (doctrine §7.2): 80 − 15 a tile, capped at 80.
    expect(near).toBe(65);
    expect(far).toBe(20);
    expect(hitPct({ ...base, distMt: 4000, targetFormation: "column" })).toBe(
      24,
    );
    expect(hitPct({ ...base, distMt: 4000, targetFormation: "loose" })).toBe(
      16,
    );
    expect(
      hitPct({
        ...base,
        distMt: 0,
        density: 3,
        gunnery: 5,
        targetFormation: "column",
      }),
    ).toBe(80);
    expect(
      hitPct({ ...base, distMt: 3000, targetFormation: "line", night: true }),
    ).toBe(15);
    expect(
      hitPct({ ...base, distMt: 2000, targetFormation: "line", night: true }),
    ).toBe(50);
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

describe("SeaRules morale (ww177 merge 2)", () => {
  it("losses by the share engaged, the flagship steadies, ships break alone", () => {
    expect(engagedLoss(80, 2, 8)).toBe(20);
    expect(engagedLoss(80, 0, 8)).toBe(10);
    expect(engagedLoss(80, 8, 8)).toBe(80);
    expect(steadied(100, true)).toBe(75);
    expect(steadied(100, false)).toBe(100);
    expect(shipBreaks(450, 1000, 900)).toBe(true);
    expect(shipBreaks(550, 1000, 900)).toBe(false);
    expect(shipBreaks(550, 1000, 200)).toBe(true);
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
        "ended": 376,
        "fled": 8,
        "hash": 195174531,
        "japan": 2,
        "joseon": 8,
        "opened": 1,
        "sunk": 9,
        "taken": 0,
      }
    `);
  });

  it("a fleet chasing a lure comes in disordered, the crane's guns on its head", () => {
    // ww177 final (design §6.2, Hansan).
    const play = (decoy: boolean) => {
      const st: SeaState = emptySeaState();
      const ctx = testCtx(7);
      const jp = addFleet(
        st,
        JAPAN,
        30_500,
        30_500,
        ["atakebune", "sekibune", "sekibune", "sekibune"],
        { formation: "column", heading: 0, admiral: { tactics: 3 } },
      );
      const js = addFleet(st, JOSEON, 39_500, 30_500, ["panokseon"], {
        formation: "line",
        heading: 512,
      });
      if (decoy) js.lureTo = 30 * W + 50;
      seaOrder(st, ctx, JAPAN, jp.id, { kind: "engage", mode: "board" });
      ctx.tick = 1;
      seaTick(st, ctx);
      return { st, ctx, jp };
    };
    const { st, ctx, jp } = play(true);
    expect(jp.battle).not.toBe(0);
    expect(jp.disorder).toBe(chaseDisorderVolleys(3));
    // It cannot re-form while disordered.
    expect(
      seaOrder(st, ctx, JAPAN, jp.id, {
        kind: "formation",
        formation: "wedge",
      }),
    ).toBe(false);
    expect(play(false).jp.disorder).toBeUndefined();
    // The bowl's focus lies R ahead of the flagship, abreast of the wing tips.
    expect(craneFocus(0, 0, 0, 10)).toEqual({ x: 3500, y: 0 });
    const tip = formationSlot("crane", 9, 10);
    expect(tip.fwd).toBe(3500);
    expect(Math.abs(tip.stbd)).toBe(3500);
  });

  it("a range fleet holds a channel's mouth; a contrary current shakes the crowd", () => {
    // ww177 final (design §6.2, Myeongnyang): a strait 3 tiles wide, x 40-55.
    const play = (seed: number) => {
      const st: SeaState = emptySeaState();
      const ctx: SeaCtx = {
        ...testCtx(seed),
        isWater: (t) => {
          const x = t % W;
          const y = Math.floor(t / W);
          return x < 40 || x > 55 || (y >= 29 && y <= 31);
        },
        flags: (t) => {
          const x = t % W;
          const ch = x >= 40 && x <= 55;
          return {
            coastal: ch,
            lee: false,
            channel: ch,
            shoal: false,
            current: ch ? 1 : 0,
            currentDir: 0,
          };
        },
        holdsShores: (owner) => owner === JOSEON,
      };
      const jp = addFleet(
        st,
        JAPAN,
        52 * MT + 500,
        30_500,
        Array.from({ length: 10 }, () => "sekibune" as const),
        { formation: "column", heading: 0 },
      );
      const js = addFleet(
        st,
        JOSEON,
        60 * MT + 500,
        30_500,
        ["panokseon", "panokseon", "panokseon"],
        { formation: "line", heading: 512 },
      );
      seaOrder(st, ctx, JOSEON, js.id, { kind: "engage", mode: "keep_range" });
      const sign = currentState(seed, st.nextId, 0).sign;
      let entered = false;
      let fouled = 0;
      for (let t = 1; t <= 250; t++) {
        ctx.tick = t;
        seaTick(st, ctx);
        st.events = [];
        if (js.x < 56 * MT) entered = true;
        fouled = Math.max(fouled, st.ships.filter((s) => s.fouled).length);
      }
      return { sign, entered, fouled, morale: jp.morale, battle: jp.battle };
    };
    const runs = [1, 2, 3, 4, 5, 6].map(play);
    // With the flow (+x, the way Japan heads) Joseon keeps out of the
    // narrows and Japan's crowd stands fast.
    const withJapan = runs.find((r) => r.sign === 1)!;
    expect(withJapan.battle).not.toBe(0);
    expect(withJapan.entered).toBe(false);
    expect(withJapan.morale).toBe(MORALE_MAX);
    // Against it the crowd fouls, the whole fleet is shaken, and Joseon presses in.
    const against = runs.find((r) => r.sign === -1)!;
    expect(against.fouled).toBeGreaterThan(0);
    expect(against.morale).toBeLessThan(MORALE_MAX);
    expect(against.entered).toBe(true);
  });
});
