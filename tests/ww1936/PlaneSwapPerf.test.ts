// Plane design reform, phase 2: what the generation swap costs a rearm — 300
// wings of an old design when nothing better is in stock (the rank memo is
// all it reads), when nothing is old, and when every wing swaps its five.
// Rough by design (the machine is shared): the numbers are the point.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { recommendedPlane } from "@openfront/engine-lib/ww1936/DesignRules";
import { rearmWing } from "@openfront/engine/ww1936/air/Wings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";
import { giveWing } from "./wingUtil";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const WINGS = 300;
const best = (f: () => void, n = 7): number => {
  let b = Infinity;
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    f();
    b = Math.min(b, performance.now() - t);
  }
  return b;
};

it("300 wings: nothing to swap, nothing old, everything to swap", async () => {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(GBR)!;
  for (const t of WW_TECH_IDS) ce.addTech(t);
  for (const t of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) ce.stock[equipKey(t, g)] = 0;
  }
  const def = {
    ...recommendedPlane("small_1", new Set(WW_TECH_IDS), "fighter"),
    name: "old",
    modules: ["w_mg2", "", "", ""],
  } as never;
  expect(
    ww.depth.issue(GBR, { kind: "design_save", def }, runner.game.ticks()),
  ).toBeNull();
  const key = equipKey("plane_design", 1);
  const newest = equipKey("fighter", 3);
  const wings: ReturnType<typeof giveWing>[] = [];
  for (let i = 0; i < WINGS; i++) {
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 0],
      base: DEEP.region.london,
    });
    w.dcounts[0] = 150;
    wings.push(w);
  }
  ce.planesDeployed[key] = 150 * WINGS;
  const pass = () => {
    for (const w of wings) rearmWing(ww.air, w, runner.game.ticks());
  };
  const out: string[] = [];
  out.push(
    `nothing better in stock: ${best(pass).toFixed(3)} ms for ${WINGS} rearms`,
  );
  // Every wing swaps its five for the newest static fighter.
  ce.stock[newest] = 1_000_000;
  out.push(
    `every wing swaps five: ${best(() => {
      for (const w of wings) {
        w.dcounts[0] = 150;
        w.counts[2] = 0;
      }
      ce.planesDeployed[key] = 150 * WINGS;
      ce.planesDeployed[newest] = 0;
      ce.stock[newest] = 1_000_000;
      ce.stock[key] = 0;
      pass();
    }).toFixed(3)} ms for ${WINGS} rearms`,
  );
  for (const w of wings) {
    w.dcounts[0] = 0;
    w.counts[2] = 150;
  }
  ce.stock[key] = 0;
  ce.planesDeployed[newest] = 150 * WINGS;
  ce.stock[newest] = 1_000;
  out.push(
    `nothing old in the wings: ${best(pass).toFixed(3)} ms for ${WINGS} rearms`,
  );
  console.log(out.join("\n"));
}, 120_000);
