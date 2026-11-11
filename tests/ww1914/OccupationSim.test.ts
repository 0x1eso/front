// ww172 phase 5's AI-free run: no seats, ten seeds, the full calendar on the
// real map. How much land moves in a chapter at most (the fronts, occupation
// and the tables together), how many bilateral tables sat, and how each game
// ended: the world's ending, and what the state would say to each great
// power if it had been played. Slow tier: run it by name; GW_SIM_OUT names a
// file for the report.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { generalEnding } from "@openfront/engine/ww1914/Endings";
import { GW_OCC_PLACES, landGraph } from "@openfront/engine/ww1914/Occupation";
import { GW_GREAT } from "@openfront/engine/ww1914/Wars";
import fs from "node:fs";
import { expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

const SEEDS = Number(process.env.GW_SIM_SEEDS ?? 10);

interface Run {
  maxPlaces: number;
  maxTiles: number;
  maxOccTiles: number;
  overBudget: number;
  maxFrontTiles: number;
  maxTableTiles: number;
  occupied: number;
  tables: number;
  ended: string;
  powers: string[];
  line: string;
}

async function play(i: number): Promise<Run> {
  const map = realMap();
  const start = { ...startOf(`GWOCCSIM${i}`, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, map, () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  expect(gw.s.seats).toEqual([]);
  expect(gw.world.places.size).toBeGreaterThan(200);
  const tiles = landGraph(gw).tiles;
  let maxPlaces = 0;
  let maxTiles = 0;
  let maxOccTiles = 0;
  let maxFrontTiles = 0;
  let maxTableTiles = 0;
  // Past the first group of a chapter, occupation keeps to its budget.
  let overBudget = 0;
  const isOcc = (k: string) => k === "land_occupied" || k === "land_freed";
  for (let guard = 0; guard < 200 && gw.s.ended === null; guard++) {
    const before = gw.s.news.filter((x) => isOcc(x.key)).length;
    advanceChapter(gw, runner.game.ticks(), true);
    const groups = gw.s.news.filter((x) => isOcc(x.key)).length - before;
    const moves = gw.s.landMoves;
    const sum = (ms: typeof moves) =>
      ms.reduce((n, m) => n + (tiles.get(m.place) ?? 0), 0);
    const occ = moves.filter((m) => m.how === "occupation");
    maxPlaces = Math.max(maxPlaces, moves.length);
    maxTiles = Math.max(maxTiles, sum(moves));
    maxOccTiles = Math.max(maxOccTiles, sum(occ));
    if (groups > 1 && occ.length > GW_OCC_PLACES) overBudget++;
    const front = moves.filter((m) => m.theatre !== null);
    maxFrontTiles = Math.max(maxFrontTiles, sum(front));
    const table = moves.filter((m) => m.how === "table");
    maxTableTiles = Math.max(maxTableTiles, sum(table));
  }
  const occupied = gw.s.news.filter((x) => x.key === "land_occupied").length;
  const s = gw.s;
  const tables = (s.pairTables ?? []).filter((r) => r.signed !== null);
  const powers = GW_GREAT.map((tag) => {
    const seat = { tag, flags: [] } as unknown as GwSeatState;
    return `${tag}:${generalEnding(gw, seat)}`;
  });
  const ended = s.armistice?.kind ?? s.ended ?? "-";
  return {
    maxPlaces,
    maxTiles,
    maxOccTiles,
    overBudget,
    maxFrontTiles,
    maxTableTiles,
    occupied,
    tables: tables.length,
    ended,
    powers,
    line: `seed ${i}: end ${ended} ch ${s.chapter} | land/chapter max ${maxPlaces} places ${maxTiles} tiles (fronts ${maxFrontTiles}, occupation ${maxOccTiles}, tables ${maxTableTiles}) | occupied ${occupied} [${s.news
      .filter((x) => x.key === "land_occupied" || x.key === "land_freed")
      .map((x) => `${x.a}<${x.b}:${x.place}@${x.chapter}`)
      .join(
        " ",
      )}] | pair peaces ${s.news.filter((x) => x.key === "pair_peace").length} | conference ${s.table !== null && s.table.pair === undefined ? "signed" : "-"} | beaten [${(s.beaten ?? []).map((b) => b.tag).join(" ")}] | tables [${tables.map((r) => `${r.a}-${r.b}:${r.winner ?? "even"}`).join(" ")}] | ${powers.join(" ")}`,
  };
}

test("ten seeds with no seats: land moves within budget, tables sit, endings vary", async () => {
  const runs: Run[] = [];
  for (let i = 0; i < SEEDS; i++) runs.push(await play(i));
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m]
      .sort()
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
  };
  const report = [
    ...runs.map((r) => r.line),
    `land per chapter at most: ${Math.max(...runs.map((r) => r.maxPlaces))} places, ${Math.max(...runs.map((r) => r.maxTiles))} tiles; fronts ${Math.max(...runs.map((r) => r.maxFrontTiles))}, occupation ${Math.max(...runs.map((r) => r.maxOccTiles))}, tables ${Math.max(...runs.map((r) => r.maxTableTiles))} tiles`,
    `occupations ${runs.reduce((n, r) => n + r.occupied, 0)}, tables ${runs.reduce((n, r) => n + r.tables, 0)}`,
    `world endings: ${count(runs.map((r) => r.ended))}`,
    `powers' endings: ${count(runs.flatMap((r) => r.powers.map((p) => p.split(":")[1])))}`,
  ].join("\n");
  const out = process.env.GW_SIM_OUT;
  if (out !== undefined) fs.writeFileSync(out, report + "\n");
  for (const r of runs) expect(r.overBudget).toBe(0);
}, 1_800_000);
