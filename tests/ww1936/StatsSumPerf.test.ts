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
import { mioStats } from "@openfront/engine-lib/ww1936/MioRules";
import {
  addSparseInto,
  addStatsInto,
  addStatsIntoArray,
  clampStats,
  emptyStats,
} from "@openfront/engine-lib/ww1936/Stats";
import {
  thoughtNotch,
  thoughtStats,
} from "@openfront/engine-lib/ww1936/ThoughtRules";
import { mioStatsOf } from "@openfront/engine/ww1936/depth/Mio";
import {
  thoughtStatsOf,
  thoughtYearPctOf,
} from "@openfront/engine/ww1936/depth/Thought";
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

/** The thought part as a fresh (unremembered) answer. */
function freshThought(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id)!;
  if (!c.th.started) return {};
  return thoughtStats(
    c.th.curMilli.map((m) => thoughtNotch(m)),
    thoughtYearPctOf(d),
  );
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

  test("thought sliders, MIO traits and army spirits: the remembered parts follow every change", async () => {
    const ww = await deepGame();
    const d = ww.depth;
    const pol = ww.politics;
    const c = d.country(DEU)!;
    const check = () => {
      sameNumbers(thoughtStatsOf(d, DEU), freshThought(d, DEU));
      sameNumbers(mioStatsOf(d, DEU), freshMio(d, DEU));
      pol.recomputeStats(DEU);
      expect(pol.country(DEU)!.stats).toEqual(objectSum(ww, DEU));
    };
    check();
    // The sliders start, move inside a notch (the same object back), then
    // across notches and an end star.
    c.th.started = true;
    d.markStats(DEU);
    check();
    const before = thoughtStatsOf(d, DEU);
    c.th.curMilli[0] = 300;
    check();
    expect(thoughtStatsOf(d, DEU)).toBe(before);
    c.th.curMilli[0] = -9_000;
    c.th.curMilli[4] = 7_000;
    check();
    expect(thoughtStatsOf(d, DEU)).not.toEqual(before);
    c.th.curMilli[0] = 0;
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
