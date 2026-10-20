// The World War 1936 P1 screens' tests: the test map's scenario, a real
// WwEconomyView fed fake economy updates, and a fake game around it.
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEY_COUNT,
  RESOURCE_IDS,
  WwCountryDetail,
  WwCountrySummary,
  WwRegionData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CountryLandSummary } from "@openfront/engine-api/ww1936/LandTypes";
import type { WwPolSummary } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { WwEconomyView } from "../../../src/client/view/WwEconomyView";
import { WwLandView } from "../../../src/client/view/WwLandView";
import { WwPoliticsView } from "../../../src/client/view/WwPoliticsView";

const MINI = path.join(__dirname, "../../testdata/maps/ww1936mini");

export const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(MINI, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(MINI, "regions.bin"))),
);

export const ID = (tag: CountryTag) => scenario.smallIdOf(tag);

export type Summary = WwCountrySummary;
export type Detail = WwCountryDetail;

/** Germany on the test map at the start (task-1 report), or `over`. */
export function summary(tag: CountryTag, over: Partial<Summary> = {}): Summary {
  return {
    smallID: ID(tag),
    civ: 9,
    mil: 6,
    dock: 0,
    idleMil: 0,
    freeCivMilli: 5_250,
    manpower: 1_195_000,
    recruitable: 1_675_000,
    troopCap: 630_000,
    researchedCount: 7,
    shortage: false,
    exportRoom: [0, 0, 0, 0, 0, 0],
    slotPct: 0,
    ...over,
  };
}

export function detail(tag: CountryTag, over: Partial<Detail> = {}): Detail {
  return {
    smallID: ID(tag),
    laws: {
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    },
    lawCooldownUntil: { economy: 0, trade: 0, conscription: 0 },
    queue: [],
    lines: [],
    slotCount: 3,
    slots: [null, null, null],
    researched: [
      "inf_eq_1",
      "support_eq_1",
      "artillery_1",
      "motorized_1",
      "light_tank_1",
      "fighter_1",
      "bomber_1",
    ],
    buying: [],
    selling: [],
    stock: new Array<number>(EQUIP_KEY_COUNT).fill(0),
    resources: RESOURCE_IDS.map(() => ({
      produced: 0,
      exported: 0,
      imported: 0,
      used: 0,
    })),
    consumerGoodsMilli: 3_750,
    paidCivs: 0,
    receivedCivs: 0,
    effCapBp: 6_000,
    warDays: -1,
    tradePartners: [],
    ...over,
  };
}

/** The engine's trade partners in my detail (Trade.tradePartners), by tag. */
export function partners(...tags: CountryTag[]): Partial<Detail> {
  return { tradePartners: tags.map(ID) };
}

/** A region as it is now (WwRegionData), starting from the scenario. */
export function region(
  id: number,
  over: Partial<WwRegionData> = {},
): WwRegionData {
  const r = scenario.region(id)!;
  return {
    id,
    controller: scenario.ownerByRegion()[id],
    civ: r.civ,
    mil: r.mil,
    dock: r.dock,
    infra: r.infra,
    fort: scenario.startFort(id),
    rail: scenario.startRail(id),
    hub: 0,
    ...over,
  };
}

export interface FakeOptions {
  /** My country; null: a spectator. */
  me?: CountryTag | null;
  ticks?: number;
  wars?: [CountryTag, CountryTag][];
  capitulated?: CountryTag[];
  dead?: CountryTag[];
  summaries?: WwCountrySummary[];
  details?: WwCountryDetail[];
  regions?: WwRegionData[];
  troops?: number;
  /** My troops away in attacks. */
  attacks?: number[];
  /** My troops on transport ships. */
  boats?: number[];
  /** [seller, buyer]: the seller has an embargo on the buyer. */
  embargoes?: [CountryTag, CountryTag][];
  /** P2: the land war's country summaries (WwLandView). */
  land?: CountryLandSummary[];
  /**
   * P3: my country's politics as the law ladder reads them (WwPoliticsView);
   * default: neutral, 20% war support, 500 PP, no tension.
   */
  politics?: Partial<
    Pick<WwPolSummary, "wsBp" | "ppMilli" | "ruling"> & { wtBp: number }
  >;
}

export function fakeEconGame(o: FakeOptions = {}) {
  const view = new WwEconomyView(scenario);
  view.apply({
    countries: o.summaries ?? [],
    details: o.details ?? [],
    regions: o.regions ?? [],
  });
  const pol = new WwPoliticsView(scenario);
  const me0 = o.me === undefined ? "DEU" : o.me;
  pol.apply(
    {
      countries:
        me0 === null
          ? []
          : [
              {
                smallID: ID(me0),
                ruling: o.politics?.ruling ?? 3,
                leader: "",
                pop: [1500, 1000, 2000, 5500],
                stabBp: 5000,
                wsBp: o.politics?.wsBp ?? 2000,
                ppMilli: o.politics?.ppMilli ?? 500_000,
                faction: -1,
                surrenderPct: 80,
                focus: null,
              },
            ],
      details: [],
      global: {
        wtBp: o.politics?.wtBp ?? 0,
        threat: [],
        factions: [],
        guarantees: [],
        naps: [],
        access: [],
        justifying: [],
        nextBeatDay: -1,
      },
      regions: [],
      news: [],
      cards: [],
    },
    o.ticks ?? 600,
  );
  const land = new WwLandView(scenario);
  land.apply(
    {
      armies: [],
      removedArmies: [],
      battles: [],
      endedBattles: [],
      regions: [],
      countries: o.land ?? [],
      details: [],
    },
    o.ticks ?? 600,
  );
  const players = scenario.countries.map((tag, i) => ({
    id: () => `P${i + 1}`,
    smallID: () => i + 1,
    countryTag: () => tag,
    type: () => PlayerType.Human,
    clientID: () => null,
    name: () => COUNTRIES[tag].name,
    displayName: () => COUNTRIES[tag].name,
    isPlayer: () => true,
    isAlive: () => !(o.dead ?? []).includes(tag),
    troops: () => o.troops ?? 480_000,
    outgoingAttacks: () => (o.attacks ?? []).map((troops) => ({ troops })),
    units: () => (o.boats ?? []).map((n) => ({ troops: () => n })),
    numTilesOwned: () => 1_000,
    hasEmbargoAgainst: (other: { countryTag(): CountryTag }) =>
      (o.embargoes ?? []).some(
        ([seller, buyer]) => seller === tag && buyer === other.countryTag(),
      ),
  }));
  const data = {
    prepEndTick: 600,
    wars: (o.wars ?? []).map(([a, b]) => ({
      a: ID(a),
      b: ID(b),
      sinceTick: 600,
    })),
    capitulated: (o.capitulated ?? []).map((t) => ({
      smallID: ID(t),
      victor: 0,
      tick: 600,
    })),
    gauges: [],
  };
  const me = o.me === undefined ? "DEU" : o.me;
  const owners = scenario.ownerByRegion();
  const game = {
    ticks: () => o.ticks ?? 600,
    worldWarScenario: () => scenario,
    worldWarData: () => data,
    wwEconomy: () => view,
    wwLand: () => land,
    wwPolitics: () => pol,
    playerBySmallID: (id: number) => players[id - 1],
    playerByClientID: () => null,
    myPlayer: () => (me === null ? null : players[ID(me) - 1]),
    ownerID: (t: number) => owners[scenario.regionAt(t)] ?? 0,
    usernameOf: () => null,
    numLandTiles: () => 20_300,
    inSpawnPhase: () => false,
    config: () => ({ historicalAi: () => true }),
  };
  return { game, view, players, land, pol };
}

/** A tile of the land region `id`. */
export function tileOf(id: number): number {
  return scenario.vpTile(scenario.region(id)!);
}
