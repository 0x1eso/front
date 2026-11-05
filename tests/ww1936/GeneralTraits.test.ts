// ww97 (national design area G): the seven named generals' traits.
import {
  GENERAL_TRAITS,
  TPL_ARMOR_ANY,
  TPL_INFANTRY_DIV,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import {
  AT_INFILTRATION,
  attackWeights,
  initiativeOf,
  newTacticSide,
} from "@openfront/engine-lib/ww1936/TacticRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { traitSpeedBp } from "@openfront/engine/ww1936/land/Movement";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const NEW = [
  "deep_thrust",
  "reserve_master",
  "hard_pursuit",
  "set_piece",
  "fast_infiltration",
  "rearguard",
  "line_breaker",
] as const;

describe("named generals' traits", () => {
  it("sit on bits 23-29, after the old list, and the roster carries them", () => {
    NEW.forEach((t, i) => expect(GENERAL_TRAITS.indexOf(t)).toBe(23 + i));
    expect(GENERAL_TRAITS.length).toBe(30);
    const who = (t: (typeof NEW)[number]) =>
      GENERALS.filter((g) => g.traits.includes(t)).map((g) => g.id);
    expect(who("deep_thrust")).toEqual(["guderian", "rommel"]);
    expect(who("reserve_master")).toEqual(["zhukov", "rokossovsky"]);
    expect(who("hard_pursuit")).toEqual(["patton"]);
    expect(who("set_piece")).toEqual(["montgomery"]);
    expect(who("fast_infiltration")).toEqual(["yamashita"]);
    expect(who("rearguard")).toEqual(["messe"]);
    expect(who("line_breaker")).toEqual(["juin"]);
  });

  it("fast infiltration: initiative +6 and infiltration weight 30", () => {
    const s = newTacticSide();
    const base = initiativeOf(s, false);
    s.traits = traitBit("fast_infiltration");
    expect(initiativeOf(s, false)).toBe(base + 6);
    const w: number[] = [];
    attackWeights(s, w);
    expect(w[AT_INFILTRATION]).toBe(30);
  });
});

const mod = (o: object) =>
  divisionMods({
    attacking: true,
    genAtt: 0,
    genDef: 0,
    traits: 0,
    flags: TPL_INFANTRY_DIV,
    tech: null as never,
    exp: 0,
    planBp: 0,
    river: 1,
    strait: false,
    fort: 2,
    entrench: 0,
    excessBp: 0,
    supplyPm: 1000,
    encircled: false,
    airBp: 0,
    fuelBp: 0,
    landingBp: 0,
    coastalFortBp: 0,
    shoreBp: 0,
    fmAtt: 0,
    fmDef: 0,
    fmTraits: 0,
    cmdAttBp: 0,
    cmdDefBp: 0,
    enemyPlanCutBp: 0,
    fortCut: 0,
    halfSupply: false,
    designFlags: 0,
    artSoftPm: 0,
    fmPlanBp: 0,
    ...o,
  } as never);

describe("named generals' traits in the rules", () => {
  it("line breaker cuts river and fort penalties as a sapper officer does", () => {
    const tech = techTotals(new Set());
    const at = (r: ReturnType<typeof mod>, id: string) =>
      r.attackLines.find((l) => l.id === id)?.bp ?? 0;
    const plain = mod({ tech });
    const lb = mod({ tech, traits: traitBit("line_breaker") });
    const eo = mod({ tech, traits: traitBit("engineer_officer") });
    expect(at(lb, "river")).toBeGreaterThan(at(plain, "river"));
    expect(at(lb, "fort")).toBe(at(eo, "fort"));
    expect(at(lb, "river")).toBe(at(eo, "river"));
  });
});

describe("named generals in a game", () => {
  it("set piece, reserves and rearguard reach the army's mods; hard pursuit speeds the armour", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    const ww = runner.game.worldWar()!;
    const land = ww.land;
    const d = ww.depth;
    const DEU = DEEP.tag.DEU;
    const cl = land.country(DEU)!;
    const a = land.armiesOf(DEU)[0];
    const g = cl.generals.find((x) => x.army === 0)!;
    g.army = a.id;
    a.general = g.id;
    const set = (names: (typeof NEW)[number][]) => {
      g.traits = names.reduce((m, t) => m | traitBit(t), 0);
      // a fresh tick value: the memo is keyed by the general, not the mask
      a.general = 0;
      d.armyMods(DEU, a.id);
      a.general = g.id;
      return d.armyMods(DEU, a.id);
    };
    const sp = set(["set_piece"]);
    expect([sp.planMaxBp, sp.planSpeedPct]).toEqual([1000, -10]);
    const rm = set(["reserve_master"]);
    expect(rm.recoveryPct).toBe(-10);
    const rg = set(["rearguard"]);
    expect(rg.recoveryPct).toBe(10);
    set(["hard_pursuit"]);
    const row = land.divisions.rowOf(a.divisions[0]);
    expect(traitSpeedBp(land, row, TPL_ARMOR_ANY)).toBe(1000);
    expect(traitSpeedBp(land, row, TPL_INFANTRY_DIV)).toBe(0);
    set(["fast_infiltration"]);
    expect(traitSpeedBp(land, row, TPL_INFANTRY_DIV)).toBe(1000);
    expect(traitSpeedBp(land, row, TPL_ARMOR_ANY)).toBe(0);
  });
});
