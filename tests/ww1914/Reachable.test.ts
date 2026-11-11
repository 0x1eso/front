// ww179 (design ww168 B6, 9A): every place of a country that can go to war
// can be taken by some path in a war against it, while that war runs: the
// fronts to their last line, then occupation on into the interior and over
// the sea, a group a chapter inside the land budget. On the real 1914 set.
import {
  GW_FRONT_UP,
  GW_LINE_STEP,
  GW_LINES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { frontLandStep, holderOf } from "@openfront/engine/ww1914/Land";
import {
  canAskFor,
  GW_OCC_TILES,
  landGraph,
  occupationStep,
} from "@openfront/engine/ww1914/Occupation";
import { frontsBetween } from "@openfront/engine/ww1914/Tables";
import { declareWar, memberEnd } from "@openfront/engine/ww1914/Wars";
import { expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

const FLEETS: readonly GwTag[] = ["GBR", "DEU", "FRA", "RUS", "AUH"];

/** Every open front `o` fights on at the far end against it; the sea to `t`'s side. */
function winThrough(gw: GreatWar, o: GwTag, t: GwTag): void {
  for (const th of gw.s.theatres) {
    if (th.since === null) continue;
    const top = (GW_LINES[th.id].length - 1) * GW_LINE_STEP;
    let pos: number | null = null;
    if (th.id === "sea") {
      const side = gw.nation(t)?.side ?? null;
      if (side !== null) pos = side === "central" ? top : 0;
    } else {
      const end = memberEnd(gw, th.id, o);
      if (end !== null) pos = end === GW_FRONT_UP[th.id] ? 0 : top;
    }
    if (pos === null) continue;
    th.line = Math.floor(pos / GW_LINE_STEP);
    th.progress = pos - th.line * GW_LINE_STEP;
  }
}

test("every place of a country that can go to war can be taken while the war runs", async () => {
  const start = { ...startOf("GWREACH", "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  const long = gwChapters(gw.s.calendar).findIndex(
    (c, i) => i >= 8 && c.spanDays >= 28,
  );
  const fresh = structuredClone(gw.s);
  const graph = landGraph(gw);
  const tags = gw.s.nations.map((n) => n.tag);
  const warring = tags.filter((o) =>
    tags.some((t) => frontsBetween(o, t).length > 0),
  );
  const missed: string[] = [];
  for (const o of warring) {
    const mine = GW_PLACE_KEYS.filter(
      (p) => GW_PLACES[p].owner === o && gw.world.places.has(p),
    );
    if (mine.length === 0) continue;
    const taken = new Set<GwPlace>();
    const foes = tags.filter(
      (t) => frontsBetween(o, t).length > 0 || (FLEETS.includes(t) && t !== o),
    );
    for (const t of foes) {
      gw.s = structuredClone(fresh);
      gw.s.chapter = long;
      if (!declareWar(gw, t, o, "test")) continue;
      winThrough(gw, o, t);
      for (let i = 0, still = 0; i < 60 && still < 2; i++) {
        frontLandStep(gw);
        occupationStep(gw);
        const occ = gw.s.landMoves.filter((m) => m.how === "occupation");
        const groups = new Set(occ.map((m) => GW_PLACES[m.place].group));
        const tiles = occ.reduce((k, m) => k + graph.tiles.get(m.place)!, 0);
        // The budget: past the first group, no more than GW_OCC_TILES.
        if (groups.size > 1) expect(tiles).toBeLessThanOrEqual(GW_OCC_TILES);
        still = gw.s.landMoves.length === 0 ? still + 1 : 0;
      }
      for (const p of mine) {
        const h = holderOf(gw, p);
        if (h === o) continue;
        taken.add(p);
        // 9A: the table can ask for any place one holds.
        expect(canAskFor(gw, h, p, () => false)).toBe(true);
      }
      if (taken.size === mine.length) break;
    }
    for (const p of mine) if (!taken.has(p)) missed.push(`${o}:${p}`);
  }
  expect(missed).toEqual([]);
}, 300_000);
