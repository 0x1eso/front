// World War 1936, the final perf lane (item 3): P3's recomputeStats sums
// into a typed array, P6's statsPart is a sparse sum, and the doctrine and
// MIO parts keep their last answer while their inputs are equal. None of it
// may change a number: each is checked against the object sums it replaced.
import { MIO_FAMILIES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  WW_STAT_KEYS,
  type WwStatKey,
  type WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { doctrineStats } from "@openfront/engine-lib/ww1936/DoctrineRules";
import { mioStats } from "@openfront/engine-lib/ww1936/MioRules";
import {
  addSparseInto,
  addStatsInto,
  addStatsIntoArray,
  clampStats,
  emptyStats,
} from "@openfront/engine-lib/ww1936/Stats";
import {
  doctrineStatsOf,
  trackLevels,
} from "@openfront/engine/ww1936/depth/Doctrine";
import { mioStatsOf } from "@openfront/engine/ww1936/depth/Mio";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;

async function deepGame(): Promise<WorldWar> {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  step(runner, 30);
  return runner.game.worldWar()!;
}

/** The object sum recomputeStats made before: every source part, then the clamp. */
function objectSum(ww: WorldWar, id: number): WwStats {
  const pol = ww.politics;
  const total = emptyStats();
  for (const p of pol.statParts(pol.country(id)!)) addStatsInto(total, p);
  return clampStats(total);
}

/** The P6 part as an object sum of fresh (unremembered) parts. */
function freshDoctrine(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id)!;
  return doctrineStats({ gd: c.doc.gd, sub: c.doc.sub }, trackLevels(c));
}

function freshMio(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id)!;
  const out = emptyStats();
  for (let f = 0; f < MIO_FAMILIES.length; f++) {
    const a = c.mio.arch[f];
    if (a >= 0) addStatsInto(out, mioStats(f, c.mio.traits[f * 3 + a]));
  }
  return out;
}

/** `a` and `b` give every stat key the same number (a missing key is 0). */
function sameNumbers(a: Partial<WwStats>, b: Partial<WwStats>): void {
  for (const k of WW_STAT_KEYS) expect(a[k] ?? 0, k).toBe(b[k] ?? 0);
}

describe("final perf lane: the stats sums give the same numbers", () => {
  test("addSparseInto and addStatsIntoArray add what addStatsInto adds", () => {
    const parts: Partial<WwStats>[] = [
      { infAttackPct: 3, supplyUsePct: -5 },
      { infAttackPct: -1, outputPct: 7, constructionPct: 0 },
      { mioCostPct_infantry: -5, stabilityBp: 250 } as Partial<WwStats>,
      // A stray key is no stat: neither sum reads it.
      { notAStat: 9 } as unknown as Partial<WwStats>,
    ];
    const full = emptyStats();
    const sparse: Partial<WwStats> = {};
    const arr = new Float64Array(WW_STAT_KEYS.length);
    for (const p of parts) {
      addStatsInto(full, p);
      addSparseInto(sparse, p);
      addStatsIntoArray(arr, p);
    }
    sameNumbers(full, sparse);
    WW_STAT_KEYS.forEach((k: WwStatKey, i) => expect(arr[i], k).toBe(full[k]));
    expect(sparse.infAttackPct).toBe(2);
    expect(arr[WW_STAT_KEYS.indexOf("stabilityBp")]).toBe(250);
  });

  test("every country's stats are the clamped object sum of the screens' parts", async () => {
    const ww = await deepGame();
    const pol = ww.politics;
    let n = 0;
    for (let id = 1; id < ww.depth.cap; id++) {
      if (pol.country(id) === null || ww.economy.country(id) === null) continue;
      pol.recomputeStats(id);
      expect(pol.country(id)!.stats, `country ${id}`).toEqual(
        objectSum(ww, id),
      );
      n++;
    }
    expect(n).toBeGreaterThan(3);
  });

  test("doctrines, mastery, MIO traits and army spirits: the remembered parts follow every change", async () => {
    const ww = await deepGame();
    const d = ww.depth;
    const pol = ww.politics;
    const c = d.country(DEU)!;
    const check = () => {
      sameNumbers(doctrineStatsOf(d, DEU), freshDoctrine(d, DEU));
      sameNumbers(mioStatsOf(d, DEU), freshMio(d, DEU));
      pol.recomputeStats(DEU);
      expect(pol.country(DEU)!.stats).toEqual(objectSum(ww, DEU));
    };
    check();
    // A grand doctrine for each domain and the sub-doctrines.
    c.doc.gd[0] = 0;
    c.doc.gd[1] = 4;
    c.doc.gd[2] = 7;
    c.doc.sub[0] = 0;
    c.doc.sub[3] = 3;
    check();
    const before = doctrineStatsOf(d, DEU);
    // Mastery inside a level: the same answer (the same object back).
    c.doc.masteryMilli[0] = 150_000;
    check();
    c.doc.masteryMilli[0] = 160_000;
    expect(doctrineStatsOf(d, DEU)).toBe(doctrineStatsOf(d, DEU));
    // Up two levels on the infantry track: the rewards come in.
    c.doc.masteryMilli[0] = 700_000;
    check();
    expect(doctrineStatsOf(d, DEU)).not.toEqual(before);
    // A switch back (the grand doctrine off) drops them.
    c.doc.gd[0] = -1;
    check();
    // MIOs: an archetype, then traits on and off, then another archetype.
    const arm = MIO_FAMILIES.indexOf("mio_armor");
    c.mio.arch[arm] = 0;
    c.mio.traits[arm * 3] = 1 << 6;
    check();
    c.mio.traits[arm * 3] = (1 << 6) | (1 << 7) | 1;
    check();
    c.mio.traits[arm * 3 + 1] = 1 << 8;
    c.mio.arch[arm] = 1;
    check();
    c.mio.arch[arm] = -1;
    check();
    expect(mioStatsOf(d, DEU)).toEqual({});
    // The remembered parts are shared: a write into one fails loudly.
    c.mio.arch[arm] = 0;
    const shared = mioStatsOf(d, DEU) as Record<string, number>;
    expect(() => {
      shared.armorBrkPct = 99;
    }).toThrow();
    // Army spirits (a sparse sum now).
    c.cmd.spirits[0] = 0;
    c.cmd.spirits[1] = 1;
    check();
    c.cmd.spirits[0] = -1;
    c.cmd.spirits[1] = -1;
    check();
  });
});
