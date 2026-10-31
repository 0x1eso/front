// World War 1936 P4 screens' tests (plan Task 12): the sea test map
// (ww1936sea), real views (economy, land, politics, navy, air) fed fake
// updates, and a fake game around them.
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type {
  AirDeploySummary,
  AirZoneData,
  CountryAirDetail,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  COUNTRIES,
  CountryTag,
  FACTION_IDS,
} from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEY_COUNT,
  RESOURCE_IDS,
  WwCountryDetail,
  WwCountrySummary,
  WwRegionData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  ArmySummary,
  CountryLandDetail,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  CountryNavyDetail,
  FleetShipData,
  FleetSummary,
  SeaRegionData,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { setLandSeaAir } from "../../../src/client/hud/ww1936/LandSeaAir";
import { seaAirFacts } from "../../../src/client/hud/ww1936/NavyModel";
import { WwAirView } from "../../../src/client/view/WwAirView";
import { WwEconomyView } from "../../../src/client/view/WwEconomyView";
import { WwLandView } from "../../../src/client/view/WwLandView";
import { sideKeyOf, WwNavyView } from "../../../src/client/view/WwNavyView";
import { WwPoliticsView } from "../../../src/client/view/WwPoliticsView";
import { polDetail } from "./PoliticsFixture";

const DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
export const sea = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);

export const SID = (tag: CountryTag) => sea.smallIdOf(tag);

export function seaSummary(
  tag: CountryTag,
  over: Partial<WwCountrySummary> = {},
): WwCountrySummary {
  return {
    smallID: SID(tag),
    civ: 9,
    mil: 6,
    dock: 4,
    idleMil: 0,
    freeCivMilli: 5_250,
    manpower: 1_000_000,
    recruitable: 1_000_000,
    troopCap: 600_000,
    researchedCount: 7,
    shortage: false,
    exportRoom: [0, 0, 0, 0, 0, 0],
    slotPct: 0,
    fuelRatioPm: 1000,
    // P6 (spec §16.2).
    energyPm: 1000,
    ...over,
  };
}

export function seaDetail(
  tag: CountryTag,
  over: Partial<WwCountryDetail> = {},
): WwCountryDetail {
  return {
    smallID: SID(tag),
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
    researchBranchPct: [0, 0, 0, 0, 0, 0, 0, 0],
    researched: ["fighter_1", "bomber_1"],
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
    fuelMilli: 34_000_000,
    fuelCapMilli: 60_000_000,
    fuelGainMilli: 1_200_000,
    fuelUseMilli: [100_000, 200_000, 300_000],
    refineries: 0,
    ...over,
  };
}

export function seaRegion(
  id: number,
  over: Partial<WwRegionData> = {},
): WwRegionData {
  const r = sea.region(id)!;
  return {
    id,
    controller: sea.ownerByRegion()[id],
    civ: r.civ,
    mil: r.mil,
    dock: r.dock,
    infra: r.infra,
    fort: sea.startFort(id),
    rail: sea.startRail(id),
    hub: 0,
    navalBase: sea.startNavalBase(id),
    airBase: sea.startAirBase(id),
    aa: sea.startAa(id),
    radar: 0,
    coastalFort: sea.startCoastalFort(id),
    refinery: 0,
    silo: 0,
    damage: [],
    // P6 (scenario v5).
    coal: 0,
    uranium: 0,
    hydro: 0,
    facility: 0,
    rocketSite: 0,
    powerPlant: 0,
    dam: 0,
    damLevel: 0,
    ...over,
  };
}

export function ship(
  id: number,
  cls: FleetShipData["cls"],
  over: Partial<FleetShipData> = {},
): FleetShipData {
  return {
    id,
    cls,
    gen: 1,
    nameIdx: -id,
    nameOwner: SID("GBR"),
    hpPm: 1000,
    ...over,
  };
}

/** A fleet summary; its counts follow its ships when it has them. */
export function fleet(over: Partial<FleetSummary>): FleetSummary {
  const ships = over.ships ?? [];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const order = ["dd", "cl", "ca", "bc", "bb", "cv", "ss"];
  for (const s of ships) counts[order.indexOf(s.cls)]++;
  return {
    id: 1,
    owner: SID("GBR"),
    nameIdx: 0,
    num: 1,
    counts,
    hpPm: 1000,
    orgPm: 1000,
    zone: 40001,
    docked: 0,
    path: [],
    progPm: 0,
    stepPm: 0,
    mission: "hold",
    missionSr: 0,
    state: "on_station",
    flags: 0,
    admiral: 0,
    engage: "always",
    returnAtPct: 50,
    ships,
    ...over,
  };
}

export function navyDetail(
  tag: CountryTag,
  over: Partial<CountryNavyDetail> = {},
): CountryNavyDetail {
  return {
    smallID: SID(tag),
    lines: [],
    docks: 4,
    docksLent: 0,
    docksIdle: 4,
    convoys: 35,
    convoysByUse: [0, 0, 0],
    routes: [],
    invasions: [],
    admirals: [],
    navyXpMilli: 0,
    convoyLoss30: new Array<number>(30).fill(0),
    fuelMilli: 0,
    fuelCapMilli: 0,
    fuelRatioPm: 1000,
    ...over,
  };
}

export function airDetail(
  tag: CountryTag,
  over: Partial<CountryAirDetail> = {},
): CountryAirDetail {
  return {
    smallID: SID(tag),
    bases: [],
    stock: new Array<number>(10).fill(0),
    deployed: new Array<number>(10).fill(0),
    decks: new Array<number>(10).fill(0),
    tally30: [0, 0, 0, 0, 0, 0],
    bombedRegions: [],
    ...over,
  };
}

export interface SeaOptions {
  me?: CountryTag;
  ticks?: number;
  wars?: [CountryTag, CountryTag][];
  summaries?: WwCountrySummary[];
  details?: WwCountryDetail[];
  regions?: WwRegionData[];
  fleets?: FleetSummary[];
  navy?: CountryNavyDetail;
  seaRegions?: SeaRegionData[];
  air?: CountryAirDetail;
  zones?: AirZoneData[];
  deployments?: AirDeploySummary[];
  armies?: ArmySummary[];
  landDetails?: CountryLandDetail[];
}

export function seaGame(o: SeaOptions = {}) {
  const me = o.me ?? "GBR";
  const ticks = o.ticks ?? 700;
  const economy = new WwEconomyView(sea);
  economy.apply({
    countries: o.summaries ?? [seaSummary(me)],
    details: o.details ?? [seaDetail(me)],
    regions: o.regions ?? [],
  });
  const pol = new WwPoliticsView(sea);
  pol.apply(
    {
      countries: sea.countries.map((t) => ({
        smallID: SID(t),
        ruling: 3,
        leader: "",
        pop: [1500, 1000, 2000, 5500],
        stabBp: 5000,
        wsBp: 2000,
        ppMilli: 500_000,
        faction: -1,
        surrenderPct: 80,
        focus: null,
      })),
      details: [polDetail(me, { smallID: SID(me) })],
      global: {
        wtBp: 0,
        threat: [],
        factions: FACTION_IDS.slice(0, 0).map((key, idx) => ({
          idx,
          key,
          name: "",
          nameTag: "" as const,
          leader: 0,
          members: [],
        })),
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
    ticks,
  );
  const land = new WwLandView(sea);
  land.apply(
    {
      armies: o.armies ?? [],
      removedArmies: [],
      battles: [],
      endedBattles: [],
      regions: [],
      countries: [],
      details: o.landDetails ?? [],
    },
    ticks,
  );
  const myId = () => SID(me);
  const side = (id: number) => sideKeyOf(id, -1);
  const navy = new WwNavyView(sea, myId, () => side(myId()));
  navy.apply(
    {
      fleets: o.fleets ?? [],
      removedFleets: [],
      battles: [],
      endedBattles: [],
      seaRegions: o.seaRegions ?? [],
      details: [o.navy ?? navyDetail(me)],
    },
    ticks,
  );
  const air = new WwAirView(sea, myId, () => side(myId()));
  air.apply({
    zones: o.zones ?? [],
    deployments: o.deployments ?? [],
    removedDeployments: [],
    details: [o.air ?? airDetail(me)],
  });
  const players = sea.countries.map((tag) => ({
    id: () => `P${SID(tag)}`,
    smallID: () => SID(tag),
    countryTag: () => tag,
    type: () => PlayerType.Human,
    clientID: () => null,
    name: () => COUNTRIES[tag].name,
    displayName: () => COUNTRIES[tag].name,
    isPlayer: () => true,
    isAlive: () => true,
    troops: () => 0,
    outgoingAttacks: () => [],
    units: () => [],
    numTilesOwned: () => 1_000,
  }));
  const data = {
    prepEndTick: 600,
    wars: (o.wars ?? []).map(([a, b]) => ({
      a: SID(a),
      b: SID(b),
      sinceTick: 600,
    })),
    capitulated: [],
    gauges: [],
  };
  const owners = sea.ownerByRegion();
  const game = {
    ticks: () => ticks,
    worldWarScenario: () => sea,
    worldWarData: () => data,
    wwEconomy: () => economy,
    wwLand: () => land,
    wwPolitics: () => pol,
    wwNavy: () => navy,
    wwAir: () => air,
    playerBySmallID: (id: number) => players.find((p) => p.smallID() === id),
    playerByClientID: () => null,
    myPlayer: () => players.find((p) => p.smallID() === SID(me)) ?? null,
    ownerID: (t: number) => owners[sea.regionAt(t)] ?? 0,
    usernameOf: () => null,
    numLandTiles: () => 20_000,
    inSpawnPhase: () => false,
    config: () => ({ historicalAi: () => true }),
  };
  setLandSeaAir(land, seaAirFacts(game as never, navy, air));
  return { game, economy, land, pol, navy, air };
}
