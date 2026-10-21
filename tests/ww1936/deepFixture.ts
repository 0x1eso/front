// World War 1936 P6 (plan Task 1 Step 19, the "test map ww1936deep"
// table): the facts of the deep test map — ww1936sea plus the scenario v5
// fields (scripts/ww1936/make-test-map.ts --variant deep writes them). Every
// P6 test reads these, never its own numbers.
import { DAM_ENERGY, DAMS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { ScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { firstPassing } from "@openfront/engine-lib/ww1936/DepthRules";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import fs from "fs";
import path from "path";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";

const scenario = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../testdata/maps/ww1936deep/scenario.json"),
    "utf8",
  ),
) as ScenarioData;

/** Each 1936 owner's factories on the map (the sea map's P1 values). */
function factoriesByTag(): Record<
  string,
  { civ: number; mil: number; dock: number }
> {
  const out: Record<string, { civ: number; mil: number; dock: number }> = {};
  for (const r of scenario.regions) {
    const f = (out[r.owner] ??= { civ: 0, mil: 0, dock: 0 });
    f.civ += r.civ ?? 0;
    f.mil += r.mil ?? 0;
    f.dock += r.dock ?? 0;
  }
  return out;
}

const dam = (
  id: (typeof DAMS)[number],
  region: number,
  downstream: number[],
) => {
  const index = DAMS.indexOf(id);
  return { index, region, downstream, energy: DAM_ENERGY[index] };
};

export const DEEP = {
  map: "ww1936deep" as const,
  /** Region name → id (ww1936sea's). */
  region: REGION,
  /** Tag → smallID (ww1936sea's). */
  tag: TAG_ID,
  factories: factoriesByTag(),
  coal: { 1: 2, 3: 4, 4: 1, 6: 1, 7: 2, 8: 1, 9: 2, 10: 3 } as Readonly<
    Record<number, number>
  >,
  uranium: { 2: 2, 7: 1 } as Readonly<Record<number, number>>,
  hydro: { 2: 2, 4: 2, 5: 3 } as Readonly<Record<number, number>>,
  landmarks: {
    lm_eiffel: 1,
    lm_brandenburg: 3,
    lm_colosseum: 5,
    lm_kremlin: 8,
    lm_westminster: 10,
  } as const,
  dam: {
    dam_mohne: dam("dam_mohne", 4, [3]),
    dam_dnipro: dam("dam_dnipro", 9, [11]),
  },
  zone: ZONE,
  sr: SR,
} as const;

/** Test helper only: a region's infrastructure level (P1's array and the effective one). */
export function setInfra(ww: WorldWar, region: number, level: number): void {
  ww.economy.infra[region] = level;
  ww.economy.infraEff[region] = level;
}

/**
 * Plan decision 30: the first n in [0, 100000) whose roll with this seed
 * and purpose passes `pred` (a test picks its uid or day with it).
 */
export function findRoll(
  seed: number,
  purpose: number,
  pred: (n: number, roll: number) => boolean,
  a = 0,
  b = 0,
): number {
  return firstPassing(seed, purpose, pred, a, b);
}
