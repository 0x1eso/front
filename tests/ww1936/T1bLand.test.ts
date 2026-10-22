// World War 1936 P6 T1b-L: the deferred land reads — lane D's guerrilla_fighter
// (org recovery while encircled) and swamp_expert (movement into a marsh),
// on the deep map with a human Germany (plan decision 30).
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LandTerrain,
  MOVE_WALK,
  traitBit,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { stepRecovery } from "@openfront/engine/ww1936/land/Battles";
import {
  startHopInto,
  stepMovement,
  traitSpeedBp,
} from "@openfront/engine/ww1936/land/Movement";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearLand, placeArmy, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const H = "HUMANDEU";
const DEU = DEEP.tag.DEU;
const BERLIN = DEEP.region.berlin;
const MUNICH = DEEP.region.munich;
const BASE = Math.floor((300 * WW_ROUND_HOUR_MILLI) / 1000);

async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: H, country: "DEU" }],
    DEEP.map,
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  clearLand(g);
  const ce = ww.economy.country(DEU)!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
  return { runner, g, ww, land: ww.land };
}

/** A serving general of Germany (never a field marshal) put at the army's head with `traits`. */
function lead(l: WwLand, a: Army, traits: number): void {
  const gen = l.country(DEU)!.generals.find((x) => !x.fm && x.army === 0)!;
  gen.traits = traits;
  gen.army = a.id;
  a.general = gen.id;
}

describe("T1b-L: lane D's land traits", () => {
  it("guerrilla_fighter: an encircled army recovers org at half the supply penalty", async () => {
    const { g, land: l } = await germany();
    const plain = placeArmy(g, "DEU", BERLIN, 1);
    const guer = placeArmy(g, "DEU", BERLIN, 2);
    lead(l, guer, traitBit("guerrilla_fighter"));
    const t = l.divisions;
    expect(l.depthHooks.armyMods(DEU, guer.id).halfSupply).toBe(true);
    expect(l.depthHooks.armyMods(DEU, plain.id).halfSupply).toBe(false);
    const p = t.rowOf(plain.divisions[0]);
    const [cut, open] = guer.divisions.map((id) => t.rowOf(id));
    // Both encircled and cut off; one more of the guerrilla army in supply.
    for (const r of [p, cut]) {
      t.encircled[r] = 1;
      t.supply[r] = 0;
    }
    t.supply[open] = 1000;
    for (const r of [p, cut, open]) t.org[r] = 0;
    stepRecovery(l);
    // Without the trait nothing; with it half of the in-supply rate.
    expect(t.org[p]).toBe(0);
    const full = t.org[open];
    expect(full).toBeGreaterThanOrEqual(BASE);
    expect(t.org[cut]).toBe(Math.floor((full * 500) / 1000));
    // A partly supplied division takes half the penalty: 400‰ → 700‰.
    t.encircled[cut] = 0;
    t.supply[cut] = 400;
    t.org[cut] = 0;
    stepRecovery(l);
    expect(t.org[cut]).toBe(Math.floor((full * 700) / 1000));
    // The plain army at 400‰ keeps the whole penalty.
    t.encircled[p] = 0;
    t.supply[p] = 400;
    t.org[p] = 0;
    stepRecovery(l);
    expect(t.org[p]).toBe(Math.floor((full * 400) / 1000));
  }, 60_000);

  it("swamp_expert: +10% walking into a marsh region, nothing elsewhere", async () => {
    const { g, land: l } = await germany();
    const a = placeArmy(g, "DEU", BERLIN, 1);
    const b = placeArmy(g, "DEU", BERLIN, 1);
    lead(l, a, traitBit("swamp_expert"));
    const t = l.divisions;
    const ra = t.rowOf(a.divisions[0]);
    const rb = t.rowOf(b.divisions[0]);
    const flags = l.baseStatsOf(ra).flags;
    // The deep map has no marsh: Munich becomes one for this test.
    // (A test-only write: the scenario's region is read-only data.)
    const munich = l.scenario.region(MUNICH)! as { land?: LandTerrain };
    const was = munich.land;
    try {
      expect(traitSpeedBp(l, ra, flags, MUNICH)).toBe(0);
      munich.land = "marsh";
      expect(l.scenario.landOf(MUNICH)).toBe("marsh");
      expect(traitSpeedBp(l, ra, flags, MUNICH)).toBe(1000);
      expect(traitSpeedBp(l, rb, flags, MUNICH)).toBe(0);
      expect(traitSpeedBp(l, ra, flags, BERLIN)).toBe(0);
      // The tick's step: the expert's division walks faster into the marsh.
      startHopInto(l, ra, MUNICH, MOVE_WALK);
      startHopInto(l, rb, MUNICH, MOVE_WALK);
      stepMovement(l, g.ticks());
      expect(t.step[ra]).toBeGreaterThan(t.step[rb]);
    } finally {
      munich.land = was;
    }
  }, 60_000);
});
