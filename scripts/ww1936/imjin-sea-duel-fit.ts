/**
 * ww177 P7b: the sea duel fit (doctrine §7.2.4), seeded like
 * scripts/ww1936/duel-fit.ts:
 *
 *   npx tsx scripts/ww1936/imjin-sea-duel-fit.ts [--duels 40] [--seed 1]
 *
 * plays `--duels` duels of each target row on an open test sea (a channel
 * for Myeongnyang) through the real sea tick and the real sea AI's battle
 * orders, and prints each row's Joseon win %, the mean and range of the
 * battle's length in seconds, and the ships each side lost (sunk, taken or
 * burnt). Each duel draws its seed from `--seed` and its number, and shifts
 * the fleets' start a little, so the same arguments print the same table.
 *
 * Rows (doctrine §7.2.4):
 *   a: 8 panokseon against 12 sekibune in open water: Joseon wins in 40-90 s.
 *   b: 8 against 24 sekibune boarding: Japan wins or breaks even.
 *   c: 13 against 60 in a channel at the current's turn: Joseon wins.
 *   d: the crane wing on a lured column at 2.5×: Joseon wins.
 */
import type { ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import { MT, VOLLEY_TICKS } from "@openfront/engine-lib/imjin/SeaRules";
import type { SeaFlags } from "@openfront/engine-lib/imjin/Terrain";
import {
  seaAiVolley,
  type SeaAiView,
} from "../../packages/engine/src/imjin/sea/SeaAi";
import type { SeaCtx } from "../../packages/engine/src/imjin/sea/SeaCtx";
import { seaOrder } from "../../packages/engine/src/imjin/sea/SeaFleets";
import {
  addFleet,
  emptySeaState,
  type SeaState,
} from "../../packages/engine/src/imjin/sea/SeaState";
import { seaTick } from "../../packages/engine/src/imjin/sea/SeaTick";

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const DUELS = arg("duels", 40);
const SEED = arg("seed", 1);
const W = 160;
const H = 80;
const JOSEON = 1;
const JAPAN = 2;

const OPEN: SeaFlags = {
  coastal: false,
  lee: false,
  channel: false,
  shoal: false,
  current: 0,
  currentDir: 0,
};
const CHANNEL: SeaFlags = {
  coastal: true,
  lee: false,
  channel: true,
  shoal: false,
  current: 1,
  currentDir: 0,
};

function ctxOf(seed: number, channel: boolean): SeaCtx {
  return {
    seed,
    tick: 0,
    month: 9,
    day: 0,
    night: false,
    width: W,
    height: H,
    ref: (x, y) => y * W + x,
    tileX: (t) => t % W,
    tileY: (t) => Math.floor(t / W),
    // The channel: a strait 7 tiles wide between x 60 and 100.
    isWater: (t) => {
      if (!channel) return true;
      const x = t % W;
      const y = Math.floor(t / W);
      return x < 60 || x > 100 || (y >= 37 && y <= 43);
    },
    flags: (t) => {
      if (!channel) return OPEN;
      const x = t % W;
      return x >= 55 && x <= 105 ? CHANNEL : OPEN;
    },
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
    nearestPort: (owner) => (owner === JOSEON ? 40 * W + 155 : 40 * W + 4),
    portLevelAt: () => 0,
    // The current runs west to east (+x) at its + sign.
    currentAxis: () => 0,
    keepsPrizes: (owner) => owner === JAPAN,
    japan: JAPAN,
  };
}

interface Row {
  key: string;
  joseon: ShipKind[];
  japan: ShipKind[];
  channel: boolean;
  jpFormation: "wedge" | "column";
  /** The Joseon fleet starts east of the Japanese, this many tiles off. */
  gap: number;
  /** Joseon's fleet lies in wait (the crane on a column chasing a lure). */
  lured: boolean;
}

const rep = <T>(k: T, n: number): T[] => Array.from({ length: n }, () => k);
const ROWS: Row[] = [
  {
    key: "a 8 vs 12 open",
    joseon: rep("panokseon", 8),
    japan: rep("sekibune", 12),
    channel: false,
    jpFormation: "wedge",
    gap: 10,
    lured: false,
  },
  {
    key: "b 8 vs 24 board",
    joseon: rep("panokseon", 8),
    japan: rep("sekibune", 24),
    channel: false,
    jpFormation: "wedge",
    gap: 10,
    lured: false,
  },
  {
    key: "c 13 vs 60 channel",
    joseon: rep("panokseon", 13),
    japan: [
      ...rep("atakebune" as ShipKind, 6),
      ...rep("sekibune" as ShipKind, 54),
    ],
    channel: true,
    jpFormation: "column",
    gap: 8,
    lured: false,
  },
  {
    key: "d crane on lured column 2.5x",
    joseon: rep("panokseon", 10),
    japan: [
      ...rep("atakebune" as ShipKind, 4),
      ...rep("sekibune" as ShipKind, 21),
    ],
    channel: false,
    jpFormation: "column",
    gap: 6,
    lured: true,
  },
];

function seedOf(n: number): number {
  let h = (SEED * 2654435761 + n * 40503) >>> 0;
  h ^= h >>> 15;
  return Math.imul(h, 2246822507) >>> 0;
}

function duel(row: Row, n: number) {
  const seed = seedOf(n);
  const st: SeaState = emptySeaState();
  const ctx = ctxOf(seed, row.channel);
  const dy = (seed % 5) - 2;
  // Myeongnyang: Joseon holds the strait's east mouth, Japan comes in from the west.
  const jx = row.channel ? 70 : 60;
  const kx = jx + row.gap;
  const jp = addFleet(
    st,
    JAPAN,
    jx * MT + 500,
    (40 + dy) * MT + 500,
    row.japan,
    {
      formation: row.jpFormation,
      heading: 0,
      admiral: { gunnery: 2, tactics: 3, boarding: 4, nerve: 3 },
    },
  );
  const js = addFleet(st, JOSEON, kx * MT + 500, 40 * MT + 500, row.joseon, {
    formation: row.lured ? "crane" : "line",
    heading: 512,
    admiral: { gunnery: 5, tactics: 5, boarding: 2, nerve: 5 },
  });
  if (row.lured) js.ambush = 1;
  seaOrder(st, ctx, JAPAN, jp.id, { kind: "engage", mode: "board" });
  seaOrder(st, ctx, JOSEON, js.id, { kind: "engage", mode: "keep_range" });
  const view: SeaAiView = {
    st,
    ctx,
    jos: JOSEON,
    jpn: JAPAN,
    min: 3,
    steers: () => true,
    atWar: () => true,
    friends: (a, b) => a === b,
    ports: (o) => [ctx.nearestPort(o, 0, 0)],
    routes: [],
    caution: false,
  };
  const shipsOf = (o: number) => st.ships.filter((s) => s.owner === o).length;
  const j0 = shipsOf(JOSEON);
  const n0 = shipsOf(JAPAN);
  const josIds = st.ships.filter((s) => s.owner === JOSEON).map((s) => s.id);
  const jpnIds = st.ships.filter((s) => s.owner === JAPAN).map((s) => s.id);
  let opened = -1;
  let ended = -1;
  for (let t = 1; t <= 6000 && ended < 0; t++) {
    ctx.tick = t;
    if (t % VOLLEY_TICKS === 0 && st.battles.length > 0) seaAiVolley(view);
    seaTick(st, ctx);
    if (process.env.TRACE && t % 100 === 0)
      console.log(
        t,
        st.fleets
          .map(
            (f) =>
              `${f.owner}:${f.ships.length}@${(f.x / MT).toFixed(1)},${(f.y / MT).toFixed(1)} ${f.order} ${f.formation} m${f.morale} b${f.battle} fl${f.fleeing}`,
          )
          .join(" | "),
        st.ships.filter((s) => s.fouled).length,
      );
    for (const e of st.events) {
      if (process.env.TRACE && e.kind !== "battle_join")
        console.log(t, e.kind, e.a, e.b);
      if (e.kind === "battle_open" && opened < 0) opened = t;
      if (e.kind === "battle_end") ended = t;
    }
    st.events = [];
  }
  if (ended < 0) ended = 6000;
  // Lost: sunk, burnt or taken.
  const lostOf = (ids: number[], o: number) =>
    ids.filter((id) => !st.ships.some((s) => s.id === id && s.owner === o))
      .length;
  const josLost = lostOf(josIds, JOSEON);
  const jpnLost = lostOf(jpnIds, JAPAN);
  // The side whose fleets all fled or went down lost; else the one that lost the larger share.
  const fled = (o: number) =>
    st.fleets
      .filter((f) => f.owner === o && f.ships.length > 0)
      .every((f) => f.fleeing === 1);
  const josShare = (josLost * 1000) / j0;
  const jpnShare = (jpnLost * 1000) / n0;
  let joseonWins: boolean;
  if (fled(JAPAN) && !fled(JOSEON)) joseonWins = true;
  else if (fled(JOSEON) && !fled(JAPAN)) joseonWins = false;
  else joseonWins = jpnShare > josShare;
  return {
    secs: (ended - Math.max(0, opened)) / 10,
    joseonWins,
    josLost,
    jpnLost,
  };
}

for (const row of ROWS.filter(
  (r) => !process.env.ROW || r.key.startsWith(process.env.ROW),
)) {
  let wins = 0;
  let secs = 0;
  let lo = Infinity;
  let hi = 0;
  let jl = 0;
  let nl = 0;
  for (let n = 0; n < DUELS; n++) {
    const d = duel(row, n);
    if (d.joseonWins) wins++;
    secs += d.secs;
    lo = Math.min(lo, d.secs);
    hi = Math.max(hi, d.secs);
    jl += d.josLost;
    nl += d.jpnLost;
  }
  console.log(
    `${row.key.padEnd(32)} joseon wins ${Math.round((wins * 100) / DUELS)}%  ` +
      `length ${(secs / DUELS).toFixed(0)} s (${lo.toFixed(0)}-${hi.toFixed(0)})  ` +
      `lost: joseon ${(jl / DUELS).toFixed(1)}/${row.joseon.length}, japan ${(nl / DUELS).toFixed(1)}/${row.japan.length}`,
  );
}
