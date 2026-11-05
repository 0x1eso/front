// World War 1936 w28: the resource shortage — deposits x 1.5 (tungsten,
// chromium, rubber), the alloy plant and the mine, on the test map
// ww1936sea with the Soviet Union played by a human (Kiev: oil 8,
// tungsten 1, chromium 4, infrastructure 3).
import {
  EQUIP_KEYS,
  METAL_PER_BUILDING,
  METAL_PER_BUILDING_2,
  RESOURCE_IDS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { buildBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { extraction } from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { aiP4Builds } from "@openfront/engine/ww1936/economy/AiEconomy";
import {
  buildBlock,
  hasDeposit,
} from "@openfront/engine/ww1936/economy/Construction";
import { alloyOf, smelterOf } from "@openfront/engine/ww1936/economy/Fuel";
import fs from "node:fs";
import path from "node:path";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, stepTo, withTestPolitics, wwRunnerCapture } from "./util";

withTestPolitics();

const SUN = TAG_ID.SUN;
const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
const CHROMIUM = RESOURCE_IDS.indexOf("chromium");
const OIL = RESOURCE_IDS.indexOf("oil");
const STEEL = RESOURCE_IDS.indexOf("steel");
const ALUMINIUM = RESOURCE_IDS.indexOf("aluminium");

async function soviets() {
  const { runner } = await wwRunnerCapture(
    {},
    [{ clientID: HUMAN, country: "SUN" }],
    SEA.map,
  );
  const ww = runner.game.worldWar()!;
  return { runner, ww, econ: ww.economy, ce: ww.economy.country(SUN)! };
}

function turnTick(d: number): number {
  return dayStartTick(d, WW_PREP_TICKS) + (SUN % 7);
}

describe("w28: deposits", () => {
  test("tungsten, chromium, rubber, aluminium and steel are x1.5 rounded up; oil is as it was", () => {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../resources/maps/world1936/scenario.json"),
        "utf8",
      ),
    ) as { regions: { res: number[] }[] };
    const total = (k: number) => data.regions.reduce((s, r) => s + r.res[k], 0);
    expect(total(RESOURCE_IDS.indexOf("rubber"))).toBe(165);
    expect(total(TUNGSTEN)).toBe(246);
    expect(total(CHROMIUM)).toBe(174);
    expect(total(OIL)).toBe(265);
    expect(total(RESOURCE_IDS.indexOf("aluminium"))).toBe(321);
    expect(total(RESOURCE_IDS.indexOf("steel"))).toBe(842);
  });
});

describe("w28: the alloy plant", () => {
  test("it needs metal_substitute_1, which starts for no one", async () => {
    const { econ, ce } = await soviets();
    expect(ce.researched.has("metal_substitute_1")).toBe(false);
    expect(buildBlock(econ, ce, REGION.kiev, "alloy_plant", 1)).toBe("no_tech");
    ce.addTech("metal_substitute_1");
    expect(buildBlock(econ, ce, REGION.kiev, "alloy_plant", 1)).toBeNull();
    expect(WW_TECHS.metal_substitute_1.prereqs).toEqual(["excavation_1"]);
    const at = WW_TECH_IDS.indexOf("metal_substitute_1");
    expect(WW_TECH_IDS[at + 1]).toBe("metal_substitute_2");
  });

  test("working plants add tungsten and chromium after the infrastructure factor; tech 2 raises it", async () => {
    const { runner, econ, ce } = await soviets();
    stepTo(runner, turnTick(0) + 1);
    const w = ce.totals.produced[TUNGSTEN];
    const c = ce.totals.produced[CHROMIUM];
    econ.addBuilding(REGION.kiev, "alloy_plant", 2);
    stepTo(runner, turnTick(1) + 1);
    expect(ce.totals.produced[TUNGSTEN]).toBe(w + 2 * METAL_PER_BUILDING);
    expect(ce.totals.produced[CHROMIUM]).toBe(c + 2 * METAL_PER_BUILDING);
    ce.addTech("metal_substitute_2");
    stepTo(runner, turnTick(2) + 1);
    expect(ce.totals.produced[TUNGSTEN]).toBe(w + 2 * METAL_PER_BUILDING_2);
    expect(ce.totals.produced[CHROMIUM]).toBe(c + 2 * METAL_PER_BUILDING_2);
  });

  test("control scales the output the way the refinery's is scaled", async () => {
    const { econ, ce } = await soviets();
    econ.addBuilding(REGION.kiev, "alloy_plant", 3);
    expect(alloyOf(econ, ce, REGION.kiev, 100)).toBe(3 * METAL_PER_BUILDING);
    expect(alloyOf(econ, ce, REGION.kiev, 50)).toBe(
      Math.floor((3 * METAL_PER_BUILDING * 50) / 100),
    );
    expect(alloyOf(econ, ce, REGION.kiev, 0)).toBe(0);
    expect(alloyOf(econ, ce, REGION.moscow, 100)).toBe(0);
  });

  test("a bombed-out plant does not work", async () => {
    const { econ, ce } = await soviets();
    econ.addBuilding(REGION.kiev, "alloy_plant", 2);
    econ.damage[REGION.kiev * 22 + 0] = 0;
    const idx = econ.buildingArray("alloy_plant");
    expect(idx[REGION.kiev]).toBe(2);
    expect(alloyOf(econ, ce, REGION.kiev, 100)).toBe(2 * METAL_PER_BUILDING);
  });
});

describe("w28: the smelter", () => {
  test("it shares the alloy plant's techs", async () => {
    const { econ, ce } = await soviets();
    expect(buildBlock(econ, ce, REGION.kiev, "smelter", 1)).toBe("no_tech");
    ce.addTech("metal_substitute_1");
    expect(buildBlock(econ, ce, REGION.kiev, "smelter", 1)).toBeNull();
  });

  test("working smelters add steel and aluminium; tech 2 raises both; control scales", async () => {
    const { runner, econ, ce } = await soviets();
    stepTo(runner, turnTick(0) + 1);
    const s0 = ce.totals.produced[STEEL];
    const a0 = ce.totals.produced[ALUMINIUM];
    econ.addBuilding(REGION.kiev, "smelter", 2);
    stepTo(runner, turnTick(1) + 1);
    expect(ce.totals.produced[STEEL]).toBe(s0 + 2 * METAL_PER_BUILDING);
    expect(ce.totals.produced[ALUMINIUM]).toBe(a0 + 2 * METAL_PER_BUILDING);
    ce.addTech("metal_substitute_2");
    stepTo(runner, turnTick(2) + 1);
    expect(ce.totals.produced[STEEL]).toBe(s0 + 2 * METAL_PER_BUILDING_2);
    expect(ce.totals.produced[ALUMINIUM]).toBe(a0 + 2 * METAL_PER_BUILDING_2);
    expect(smelterOf(econ, ce, REGION.kiev, 50)).toBe(
      Math.floor((2 * METAL_PER_BUILDING_2 * 50) / 100),
    );
  });

  test("a mine does not multiply it", async () => {
    const { runner, econ, ce } = await soviets();
    econ.addBuilding(REGION.kiev, "smelter", 2);
    stepTo(runner, turnTick(0) + 1);
    const s0 = ce.totals.produced[STEEL];
    econ.addBuilding(REGION.kiev, "mine", 3);
    stepTo(runner, turnTick(1) + 1);
    const infra = econ.infraEff[REGION.kiev];
    const pct = ce.stats.extractionPct;
    expect(ce.totals.produced[STEEL]).toBe(
      s0 +
        extraction(30, infra, 100, pct, 3) -
        extraction(30, infra, 100, pct, 0),
    );
  });
});

describe("w28: the mine", () => {
  test("it is refused without a deposit and needs no tech", async () => {
    const { econ, ce } = await soviets();
    expect(hasDeposit(econ, REGION.kiev)).toBe(true);
    expect(hasDeposit(econ, REGION.warsaw)).toBe(false);
    expect(buildBlock(econ, ce, REGION.kiev, "mine", 1)).toBeNull();
    const base = {
      building: "mine" as const,
      count: 1,
      controlled: true,
      occupied: false,
      queueLength: 0,
      levelWithQueue: 0,
      usedSlots: 0,
      slots: 4,
      coastal: false,
      harbor: false,
      researched: new Set<never>(),
    };
    expect(buildBlockOf({ ...base })).toBe("no_deposit");
    expect(buildBlockOf({ ...base, hasDeposit: true })).toBeNull();
    expect(buildBlockOf({ ...base, hasDeposit: true, levelWithQueue: 3 })).toBe(
      "infra_max",
    );
  });

  test("each level adds 25 % to every deposit before the infrastructure factor, rounding down", async () => {
    const { runner, econ, ce } = await soviets();
    stepTo(runner, turnTick(0) + 1);
    const infra = econ.infraEff[REGION.kiev];
    const oil0 = ce.totals.produced[OIL];
    const seen = [oil0];
    for (let lv = 1; lv <= 3; lv++) {
      econ.addBuilding(REGION.kiev, "mine", 1);
      stepTo(runner, turnTick(lv) + 1);
      seen.push(ce.totals.produced[OIL]);
      const want =
        extraction(8, infra, 100, ce.stats.extractionPct, lv) -
        extraction(8, infra, 100, ce.stats.extractionPct, 0);
      expect(seen[lv] - oil0).toBe(want);
    }
    expect(extraction(100, 5, 100, 0, 1)).toBe(125);
    expect(extraction(100, 5, 100, 0, 2)).toBe(150);
    expect(extraction(100, 5, 100, 0, 3)).toBe(175);
    expect(extraction(7, 5, 100, 0, 1)).toBe(8);
    expect(seen[3]).toBeGreaterThan(seen[0]);
  });

  test("it does not multiply synthetic or alloy output", async () => {
    const { runner, econ, ce } = await soviets();
    econ.addBuilding(REGION.kiev, "synthetic_refinery", 2);
    econ.addBuilding(REGION.kiev, "alloy_plant", 2);
    stepTo(runner, turnTick(0) + 1);
    const w = ce.totals.produced[TUNGSTEN];
    const oil = ce.totals.produced[OIL];
    econ.addBuilding(REGION.kiev, "mine", 3);
    stepTo(runner, turnTick(1) + 1);
    const infra = econ.infraEff[REGION.kiev];
    const gain = (k: number, dep: number) =>
      extraction(dep, infra, 100, ce.stats.extractionPct, 3) -
      extraction(dep, infra, 100, ce.stats.extractionPct, 0);
    // Oil rises by the deposit's gain only; the 2 refineries' oil is the same 2.
    expect(ce.totals.produced[OIL]).toBe(oil + gain(OIL, 8));
    // Kiev's tungsten 1: the mine adds its own deposit's gain, the plants' 4 stay 4.
    expect(ce.totals.produced[TUNGSTEN]).toBe(w + gain(TUNGSTEN, 1));
  });

  test("a mine is a level, not a slot", async () => {
    const { econ, ce } = await soviets();
    const used = (r: number) => econ.civ[r] + econ.mil[r] + econ.dock[r];
    const before = used(REGION.kiev);
    econ.addBuilding(REGION.kiev, "mine", 2);
    expect(used(REGION.kiev)).toBe(before);
    expect(buildBlock(econ, ce, REGION.kiev, "mine", 2)).toBe("infra_max");
  });
});

describe("w28: snapshot and restore", () => {
  test("the plants and mine levels survive; an old save's damage array is spread", async () => {
    const { runner, econ } = await soviets();
    econ.addBuilding(REGION.kiev, "alloy_plant", 2);
    econ.addBuilding(REGION.moscow, "mine", 3);
    const snap = JSON.parse(JSON.stringify(econ.snapshot()));
    expect(snap.alloy_plant[REGION.kiev]).toBe(2);
    expect(snap.mine[REGION.moscow]).toBe(3);
    econ.addBuilding(REGION.kiev, "alloy_plant", 1);
    econ.addBuilding(REGION.moscow, "mine", -3);
    econ.restoreState(snap);
    expect(econ.buildingArray("alloy_plant")[REGION.kiev]).toBe(2);
    expect(econ.buildingArray("mine")[REGION.moscow]).toBe(3);
    expect(JSON.stringify(econ.snapshot())).toBe(JSON.stringify(snap));
    // A save from before the two ids: shorter rows, no arrays for them.
    const size = econ.civ.length;
    const nb = snap.damage.length / size - 2;
    const old = { ...snap, damage: new Array(size * nb).fill(0) };
    old.damage[REGION.kiev * nb + 1] = 1500;
    delete old.alloy_plant;
    delete old.mine;
    old.repair = new Array(size * nb).fill(0);
    econ.restoreState(old);
    expect(econ.buildingArray("mine")[REGION.moscow]).toBe(0);
    expect(econ.damage[REGION.kiev * (nb + 2) + 1]).toBe(1500);
    stepTo(runner, turnTick(0) + 1);
  });
});

describe("w28: the AI", () => {
  const lineNeeding = (k: number) => {
    let found = -1;
    EQUIP_KEYS.forEach(([type], i) => {
      if (found < 0 && EQUIPMENT[type].resources[k] > 0) found = i;
    });
    return found;
  };
  function setup(
    ce: Awaited<ReturnType<typeof soviets>>["ce"],
    short: boolean,
  ) {
    const key = lineNeeding(TUNGSTEN);
    ce.lines = [
      {
        id: 90,
        key,
        factories: 4,
        active: 4,
        effBp: 10000,
        progress: 0,
        fill: 1000,
        lastOutput: 0,
        convertFrom: -1,
      },
    ];
    const need = EQUIPMENT[EQUIP_KEYS[key][0]].resources.map((v) => v * 4);
    ce.totals.produced = need.map((v) => (short ? 0 : v + 50));
    ce.totals.exported = need.map(() => 0);
    ce.totals.imported = need.map(() => 0);
    ce.queue = [];
  }

  test("an alloy plant when short of tungsten, not when it has enough or lacks the tech", async () => {
    const { econ, ce } = await soviets();
    ce.addTech("metal_substitute_1");
    setup(ce, true);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.some((q) => q.building === "alloy_plant")).toBe(true);
    setup(ce, false);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.some((q) => q.building === "alloy_plant")).toBe(false);
    expect(ce.queue.some((q) => q.building === "mine")).toBe(false);
    const noTech = await soviets();
    setup(noTech.ce, true);
    aiP4Builds(noTech.econ, noTech.ce, 5);
    expect(noTech.ce.queue.some((q) => q.building === "alloy_plant")).toBe(
      false,
    );
  });

  test("it stops at its limit of plants", async () => {
    const { econ, ce } = await soviets();
    ce.addTech("metal_substitute_1");
    econ.addBuilding(REGION.moscow, "alloy_plant", 5);
    setup(ce, true);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.some((q) => q.building === "alloy_plant")).toBe(false);
  });

  test("a smelter only when steel or aluminium is well short, a few at most", async () => {
    const { econ, ce } = await soviets();
    ce.addTech("metal_substitute_1");
    const key = lineNeeding(STEEL);
    const line = (n: number) => [
      {
        id: 91,
        key,
        factories: n,
        active: n,
        effBp: 10000,
        progress: 0,
        fill: 1000,
        lastOutput: 0,
        convertFrom: -1,
      },
    ];
    const per = EQUIPMENT[EQUIP_KEYS[key][0]].resources;
    const give = (n: number, pct: number) => {
      ce.lines = line(n);
      ce.totals.produced = per.map((v) => Math.floor((v * n * pct) / 100));
      ce.totals.exported = per.map(() => 0);
      ce.totals.imported = per.map(() => 0);
      ce.queue = [];
    };
    // A small dip (95 % filled): no smelter.
    give(20, 95);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.some((q) => q.building === "smelter")).toBe(false);
    // Well short (50 %): one, never two at once.
    give(20, 50);
    aiP4Builds(econ, ce, 5);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.filter((q) => q.building === "smelter").length).toBe(1);
    // At its limit: none.
    give(20, 50);
    econ.addBuilding(REGION.moscow, "smelter", 4);
    aiP4Builds(econ, ce, 5);
    expect(ce.queue.some((q) => q.building === "smelter")).toBe(false);
  });

  test("a mine where the short resource lies, not elsewhere", async () => {
    const { econ, ce } = await soviets();
    setup(ce, true);
    aiP4Builds(econ, ce, 5);
    const mine = ce.queue.find((q) => q.building === "mine");
    // Kiev has the only tungsten the Soviets hold.
    expect(mine?.region).toBe(REGION.kiev);
  });
});
