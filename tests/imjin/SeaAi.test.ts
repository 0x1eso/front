// Imjin sea AI (ww177 lane I5b): the AI's choices on an open test sea, with
// the orders a player has: Japan masses before it seeks battle and sends
// fire ships into a packed line, waits while a channel's current runs against
// it; Joseon keeps its fleet in being, springs a lure from lee water, and
// breaks off a lost fight; a ship without an admiral rejoins a fleet.
import type { ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import {
  currentSpeedPct,
  currentState,
  fireShipWindOk,
  MT,
  windAt,
} from "@openfront/engine-lib/imjin/SeaRules";
import type { SeaFlags } from "@openfront/engine-lib/imjin/Terrain";
import {
  seaAiDay,
  seaAiVolley,
  type SeaAiView,
} from "@openfront/engine/imjin/sea/SeaAi";
import { detectBattles } from "@openfront/engine/imjin/sea/SeaBattle";
import type { SeaCtx } from "@openfront/engine/imjin/sea/SeaCtx";
import { seaOrder } from "@openfront/engine/imjin/sea/SeaFleets";
import {
  addFleet,
  emptySeaState,
  newAdmiral,
  type SeaState,
} from "@openfront/engine/imjin/sea/SeaState";
import { seaTick } from "@openfront/engine/imjin/sea/SeaTick";
import { describe, expect, it } from "vitest";

const W = 200;
const H = 100;
const JOSEON = 1;
const JAPAN = 2;
const JOSEON_PORT = 50 * W + 190;
const JAPAN_PORT = 50 * W + 5;

const OPEN: SeaFlags = {
  coastal: false,
  lee: false,
  channel: false,
  shoal: false,
  current: 0,
  currentDir: 0,
};

function testCtx(
  seed: number,
  flags: (x: number, y: number) => SeaFlags = () => OPEN,
): SeaCtx {
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
    flags: (t) => flags(t % W, Math.floor(t / W)),
    zoneOf: () => 0,
    hostile: (a, b) => a !== b,
    path: (from, to) => {
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
    nearestPort: (owner) => (owner === JOSEON ? JOSEON_PORT : JAPAN_PORT),
    portLevelAt: () => 0,
    currentAxis: () => 0,
    keepsPrizes: (owner) => owner === JAPAN,
  };
}

/** Water A* stand-in: a breadth-first path round land (8 neighbours). */
function bfsPath(wet: (x: number, y: number) => boolean) {
  return (from: number, to: number): number[] | null => {
    const prev = new Int32Array(W * H).fill(-2);
    prev[from] = -1;
    const q = [from];
    for (let i = 0; i < q.length; i++) {
      const t = q[i];
      if (t === to) break;
      const x = t % W;
      const y = Math.floor(t / W);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (prev[n] !== -2 || !wet(nx, ny)) continue;
          prev[n] = t;
          q.push(n);
        }
    }
    if (prev[to] === -2) return null;
    const out: number[] = [];
    for (let t = to; t !== from; t = prev[t]) out.push(t);
    return out.reverse();
  };
}

function view(st: SeaState, ctx: SeaCtx): SeaAiView {
  return {
    st,
    ctx,
    jos: JOSEON,
    jpn: JAPAN,
    min: 3,
    steers: () => true,
    atWar: () => true,
    friends: (a, b) => a === b,
    ports: (o) => [o === JOSEON ? JOSEON_PORT : JAPAN_PORT],
    routes: [],
  };
}

function ships(...rows: [ShipKind, number][]): ShipKind[] {
  const out: ShipKind[] = [];
  for (const [k, n] of rows) for (let i = 0; i < n; i++) out.push(k);
  return out;
}

/** Tile centre in milli-tiles. */
const at = (t: number) => t * MT + MT / 2;
const lastTile = (path: number[]) => path[path.length - 1];

describe("Imjin sea AI", () => {
  it("Japan gathers its fleets before it seeks a fight, then goes for it", () => {
    const st = emptySeaState();
    const ctx = testCtx(1);
    const lead = addFleet(
      st,
      JAPAN,
      at(30),
      at(50),
      ships(["atakebune", 2], ["sekibune", 20], ["kobaya", 6]),
      { admiral: { tactics: 3, nerve: 3 } },
    );
    const late = addFleet(st, JAPAN, at(30), at(80), ships(["sekibune", 10]));
    addFleet(st, JOSEON, at(100), at(50), ships(["panokseon", 6]));
    seaAiDay(view(st, ctx));
    // The follower sails to the leader; the leader waits for it.
    expect(late.path.length).toBeGreaterThan(0);
    expect(lastTile(late.path)).toBe(50 * W + 30);
    expect(lead.path.length).toBe(0);
    // Gathered, the mass goes for the Joseon squadron to board.
    late.x = lead.x;
    late.y = lead.y + 2 * MT;
    late.path = [];
    seaAiDay(view(st, ctx));
    expect(lastTile(lead.path)).toBe(50 * W + 100);
    expect(lead.order).toBe("board");
    expect(lead.formationTo).toBe("wedge");
  });

  it("Joseon keeps its fleet in being: outweighed, it falls back to port", () => {
    const st = emptySeaState();
    const ctx = testCtx(2);
    const js = addFleet(st, JOSEON, at(150), at(50), ships(["panokseon", 8]), {
      admiral: { tactics: 1 },
    });
    addFleet(
      st,
      JAPAN,
      at(125),
      at(50),
      ships(["atakebune", 4], ["sekibune", 30]),
    );
    seaAiDay(view(st, ctx));
    expect(lastTile(js.path)).toBe(JOSEON_PORT);
    expect(js.order).not.toBe("board");
  });

  it("Joseon springs a lure: the main fleet lies in lee water, a squadron draws the foe", () => {
    const st = emptySeaState();
    const lee = (x: number, y: number) =>
      x >= 163 && x <= 168 && y >= 45 && y <= 55;
    const ctx = testCtx(3, (x, y) => ({ ...OPEN, lee: lee(x, y) }));
    const main = addFleet(
      st,
      JOSEON,
      at(160),
      at(50),
      ships(["panokseon", 20], ["turtle", 2]),
      { admiral: { gunnery: 5, tactics: 5, nerve: 5 } },
    );
    const bait = addFleet(
      st,
      JOSEON,
      at(170),
      at(60),
      ships(["hyeopseon", 4], ["panokseon", 2]),
    );
    const jp = addFleet(
      st,
      JAPAN,
      at(130),
      at(50),
      ships(["atakebune", 6], ["sekibune", 60], ["kobaya", 10]),
      { admiral: { tactics: 2, nerve: 4 } },
    );
    const v = view(st, ctx);
    seaAiDay(v);
    const spot = lastTile(main.path);
    expect(lee(spot % W, Math.floor(spot / W))).toBe(true);
    expect(main.formationTo).toBe("crane");
    expect(bait.lureTo).toBe(spot);
    expect(lastTile(bait.path)).toBe(50 * W + 130);
    // Within sight of the foe, the bait runs for the trap.
    bait.x = jp.x + 10 * MT;
    bait.y = jp.y;
    seaAiDay(v);
    expect(bait.order).toBe("lure");
    expect(bait.target).toBe(spot);
  });

  it("Japan sends a fire ship downwind into a packed line", () => {
    // A seed whose wind lets a boat run east.
    let seed = 1;
    for (; seed < 200; seed++) {
      const w = windAt(seed, 0, 0, 8);
      if (w.strength > 0 && fireShipWindOk(w.to, w.strength, 0)) break;
    }
    const st = emptySeaState();
    const ctx = testCtx(seed);
    const jp = addFleet(
      st,
      JAPAN,
      at(100),
      at(50),
      ships(["atakebune", 1], ["sekibune", 4], ["kobaya", 4]),
    );
    addFleet(st, JOSEON, at(104), at(50), ships(["panokseon", 8]), {
      heading: 256,
    });
    detectBattles(st, ctx);
    expect(jp.battle).not.toBe(0);
    seaAiVolley(view(st, ctx));
    const lit = st.ships.filter((s) => s.fireShip === 1);
    expect(lit.length).toBe(1);
    expect(lit[0].kind).toBe("kobaya");
    expect(lit[0].owner).toBe(JAPAN);
  });

  it("Japan holds while a channel's current runs against it, and boards when it turns", () => {
    const flags = () => ({ ...OPEN, channel: true, current: 1 });
    const seen = new Set<string>();
    for (let seed = 1; seed < 40 && seen.size < 2; seed++) {
      const st = emptySeaState();
      const ctx = testCtx(seed, flags);
      const jp = addFleet(st, JAPAN, at(100), at(50), ships(["sekibune", 4]), {
        heading: 0,
      });
      addFleet(st, JOSEON, at(105), at(50), ships(["panokseon", 3]));
      detectBattles(st, ctx);
      const b = st.battles[0];
      expect(b.current).toBe(1);
      const cur = currentState(seed, b.id, 0);
      const against = currentSpeedPct(jp.heading, 0, cur.sign) < 0;
      seaAiVolley(view(st, ctx));
      expect(jp.order).toBe(against ? "hold" : "board");
      seen.add(jp.order);
    }
    expect([...seen].sort()).toEqual(["board", "hold"]);
  });

  it("a beaten Joseon fleet breaks off; Japan presses on at the same morale", () => {
    const st = emptySeaState();
    const ctx = testCtx(5);
    const js = addFleet(st, JOSEON, at(100), at(50), ships(["panokseon", 4]));
    const jp = addFleet(
      st,
      JAPAN,
      at(104),
      at(50),
      ships(["atakebune", 2], ["sekibune", 16]),
    );
    detectBattles(st, ctx);
    js.morale = 400;
    jp.morale = 400;
    seaAiVolley(view(st, ctx));
    expect(js.order).toBe("break_off");
    expect(jp.order).toBe("board");
  });

  it("ships without an admiral rejoin a fleet of their own at the end of a voyage", () => {
    const st = emptySeaState();
    const ctx = testCtx(6);
    const main = addFleet(st, JOSEON, at(185), at(50), ships(["panokseon", 6]));
    const lone = addFleet(
      st,
      JOSEON,
      at(175),
      at(50),
      ships(["panokseon", 1]),
      {
        admiral: newAdmiral({ alive: 0 }),
      },
    );
    seaAiDay(view(st, ctx));
    expect(lastTile(lone.path)).toBe(50 * W + 185);
    for (let t = 1; t <= 20 && st.fleets.includes(lone); t++) {
      ctx.tick = t;
      seaTick(st, ctx);
    }
    expect(st.fleets.includes(lone)).toBe(false);
    expect(main.ships.length).toBe(7);
    expect(seaOrder(st, ctx, JOSEON, lone.id, { kind: "hold" })).toBe(false);
  });

  it("a flagship blocked by an island sails round it instead of standing on the shore", () => {
    const wet = (x: number, y: number) => !(x === 104 && y >= 40 && y <= 60);
    const ctx: SeaCtx = {
      ...testCtx(7),
      isWater: (t) => wet(t % W, Math.floor(t / W)),
      path: bfsPath(wet),
    };
    const st = emptySeaState();
    const jp = addFleet(st, JAPAN, at(100), at(50), ships(["sekibune", 3]), {
      heading: 0,
    });
    const js = addFleet(st, JOSEON, at(108), at(50), ships(["panokseon", 3]));
    seaOrder(st, ctx, JAPAN, jp.id, { kind: "engage", mode: "board" });
    seaOrder(st, ctx, JOSEON, js.id, { kind: "hold" });
    let closest = Infinity;
    for (let t = 1; t <= 400; t++) {
      ctx.tick = t;
      seaTick(st, ctx);
      const flag = st.ships.find((s) => s.id === jp.ships[0]);
      if (flag) closest = Math.min(closest, Math.abs(flag.x - at(108)));
    }
    // It got past the wall (x 104) to the Joseon side.
    expect(closest).toBeLessThan(3 * MT);
  });
});
