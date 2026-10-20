// The World War 1936 P2 land screens' tests: EconomyFixture's fake game
// with a WwLandView fed fake land updates (armies, divisions, templates,
// battles), and the game's sides registered as GameRenderer does.
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  ArmyMineData,
  ArmySummary,
  BattleSummary,
  CountryLandDetail,
  DivisionData,
  GeneralData,
  idleOrder,
  RegionLandData,
  SideSum,
  TemplateData,
  TrainingData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { emptySide } from "@openfront/engine-lib/ww1936/CombatRules";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import {
  landSidesOf,
  mergeSides,
  setLandSides,
} from "../../../src/client/hud/ww1936/LandModel";
import { fakeEconGame, FakeOptions, ID, scenario } from "./EconomyFixture";

export { ID, scenario };

/** The test map's first 1936 template of `tag` as a TemplateData. */
export function startTemplate(
  tag: CountryTag,
  id = 1,
  over: Partial<TemplateData> = {},
): TemplateData {
  const s = startTemplates(tag, scenario.devOf(tag, 9))[0];
  return {
    id,
    name: "",
    key: s.key,
    battalions: [...s.def.battalions],
    support: [...s.def.support],
    inUse: 0,
    ...over,
  };
}

/** `n` divisions of a template at full strength, as a side sum. */
export function sideOf(t: TemplateData, n: number): SideSum {
  const s = templateStats(
    { name: t.name, battalions: t.battalions, support: t.support },
    techTotals(new Set()),
    GEN1,
  );
  let sum = emptySide();
  for (let i = 0; i < n; i++) {
    sum = mergeSides(sum, {
      divisions: 1,
      width: s.width,
      soft: s.soft,
      hard: s.hard,
      def: s.def,
      brk: s.brk,
      armor: s.armor,
      pierce: s.pierce,
      hardnessPm: s.hardnessPm,
      orgMilli: s.orgMilli,
      hpMilli: s.hpMilli,
    });
  }
  return sum;
}

export function mine(over: Partial<ArmyMineData> = {}): ArmyMineData {
  return {
    order: idleOrder(),
    front: [],
    planBp: 0,
    auto: false,
    path: [],
    supplyPm: 1000,
    etaTicks: -1,
    paraLastDay: -1,
    ...over,
  };
}

/** An army of `tag` with `divisions` of its first template in `region`. */
export function army(
  id: number,
  tag: CountryTag,
  region: number,
  over: Partial<ArmySummary> = {},
): ArmySummary {
  const divisions = over.divisions ?? 3;
  return {
    id,
    owner: ID(tag),
    nameNo: id,
    general: 0,
    divisions,
    strengthPm: 1000,
    orgPm: 1000,
    state: 0,
    region,
    move: null,
    sum: sideOf(startTemplate(tag), divisions),
    symbol: 0,
    mine: tag === "DEU" ? mine() : null,
    ...over,
  };
}

export function division(
  id: number,
  armyId: number,
  region: number,
  over: Partial<DivisionData> = {},
): DivisionData {
  return {
    id,
    army: armyId,
    template: 1,
    region,
    strengthPm: 1000,
    orgPm: 1000,
    exp: 0,
    supplyPm: 1000,
    equipPm: 1000,
    battle: 0,
    role: 0,
    ...over,
  };
}

export function general(
  id: number,
  over: Partial<GeneralData> = {},
): GeneralData {
  return {
    id,
    key: "rundstedt",
    titleNo: 0,
    att: 4,
    def: 4,
    plan: 3,
    log: 3,
    traits: 0,
    level: 1,
    xp: 0,
    army: 0,
    from: -1,
    until: -1,
    ...over,
  };
}

export function training(
  id: number,
  over: Partial<TrainingData> = {},
): TrainingData {
  return {
    id,
    template: 1,
    remaining: 1,
    trainees: [],
    army: 0,
    region: 0,
    waiting: "",
    ...over,
  };
}

export function landDetail(
  tag: CountryTag,
  over: Partial<CountryLandDetail> = {},
): CountryLandDetail {
  return {
    smallID: ID(tag),
    armyXpMilli: 20_000,
    templates: [startTemplate(tag)],
    training: [],
    generals: [],
    divisions: [],
    ...over,
  };
}

export function battle(
  region: number,
  attacker: CountryTag,
  defender: CountryTag,
  over: Partial<BattleSummary> = {},
): BattleSummary {
  return {
    region,
    attacker: ID(attacker),
    defender: ID(defender),
    attLine: 3,
    attReserve: 0,
    defLine: 2,
    defReserve: 0,
    width: 90,
    attWidth: 75,
    defWidth: 36,
    directions: 1,
    progressPm: 200,
    attOrgPm: 800,
    defOrgPm: 600,
    attStrPm: 950,
    defStrPm: 900,
    ...over,
  };
}

export function landRegion(
  id: number,
  over: Partial<RegionLandData> = {},
): RegionLandData {
  return {
    id,
    controller: scenario.ownerByRegion()[id],
    supplyMilli: -1,
    useMilli: -1,
    encircled: false,
    counts: [],
    ...over,
  };
}

export interface LandOptions extends FakeOptions {
  armies?: ArmySummary[];
  landDetails?: CountryLandDetail[];
  battles?: BattleSummary[];
  landRegions?: RegionLandData[];
}

/** EconomyFixture's game with the land war's data; my country DEU unless `me`. */
export function fakeLandGame(o: LandOptions = {}) {
  const base = fakeEconGame(o);
  base.land.apply(
    {
      armies: o.armies ?? [],
      removedArmies: [],
      battles: o.battles ?? [],
      endedBattles: [],
      regions: o.landRegions ?? [],
      countries: [],
      details: o.landDetails ?? [],
    },
    o.ticks ?? 600,
  );
  setLandSides(base.land, landSidesOf(base.game as never));
  return base;
}
