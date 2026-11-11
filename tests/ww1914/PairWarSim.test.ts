// ww171 phase 4, design ww168 B7's AI-free test: no seats, ten seeds, the full
// calendar on the real map. Most games should have a general war; no more
// than GW_PAIR_WARS_MAX wars outside the coalitions at once; and the wars
// should come out differently from seed to seed. Slow tier: run it by name.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { GW_PAIR_WARS_MAX } from "@openfront/engine/ww1914/PairWar";
import { GW_GREAT, pairWars } from "@openfront/engine/ww1914/Wars";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { startOf } from "./sim/GwSim";

const SEEDS = 10;

interface Run {
  general: boolean;
  maxPairs: number;
  shape: string;
  line: string;
}

async function play(i: number): Promise<Run> {
  const map = await loadMapFiles(
    new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const start = { ...startOf(`GWPAIRSIM${i}`, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, map, () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  expect(gw.s.seats).toEqual([]);
  let maxPairs = 0;
  const pairs = new Set<string>();
  for (let guard = 0; guard < 200 && gw.s.ended === null; guard++) {
    advanceChapter(gw, runner.game.ticks(), true);
    const now = pairWars(gw);
    maxPairs = Math.max(maxPairs, now.length);
    for (const w of now) pairs.add(`${w.a}>${w.b}`);
  }
  const s = gw.s;
  const camp = (side: string) =>
    s.nations
      .filter((n) => n.side === side)
      .map((n) => n.tag)
      .join(",");
  const great = GW_GREAT.filter(
    (t) => (gw.nation(t)?.side ?? null) !== null,
  ).length;
  const general = s.warChapter !== null && great >= 3;
  const end = s.armistice?.kind ?? s.ended ?? "-";
  const shape = `${camp("central")}|${camp("entente")}|${[...pairs].sort().join(",")}|${end}`;
  return {
    general,
    maxPairs,
    shape,
    line: `seed ${i}: war ${s.warChapter ?? "-"} central[${camp("central")}] entente[${camp("entente")}] pairs[${[...pairs].join(" ")}] max ${maxPairs} notes[${s.ladders.map((l) => `${l.from}>${l.to}:${l.step}@${l.opened}`).join(" ")}] peaces[${s.wars
      .filter(
        (w) => w.ended !== null && !gw.nation(w.a)!.out && !gw.nation(w.b)!.out,
      )
      .map((w) => `${w.a}-${w.b}`)
      .join(" ")}] end ${end} ch ${s.chapter}`,
  };
}

test("ten seeds with no seats: a general war mostly, few pair wars, shapes differ", async () => {
  const runs: Run[] = [];
  for (let i = 0; i < SEEDS; i++) runs.push(await play(i));
  const general = runs.filter((r) => r.general).length;
  const shapes = new Set(runs.map((r) => r.shape)).size;
  const report = [
    ...runs.map((r) => r.line),
    `general ${general}/${SEEDS}, shapes ${shapes}`,
  ].join("\n");
  // The test runner keeps stdout quiet: GW_SIM_OUT names a file for it.
  const out = process.env.GW_SIM_OUT;
  if (out !== undefined) fs.writeFileSync(out, report + "\n");
  expect(general).toBeGreaterThan(SEEDS / 2);
  for (const r of runs)
    expect(r.maxPairs).toBeLessThanOrEqual(GW_PAIR_WARS_MAX);
  expect(shapes).toBeGreaterThanOrEqual(SEEDS / 2);
}, 1_800_000);
