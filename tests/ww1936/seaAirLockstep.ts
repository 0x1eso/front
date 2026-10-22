// World War 1936 P4 Task 16: the sea and air war on ww1936sea for the
// restore oracle (lockstep.ts). Britain and Italy are humans (no AI moves
// their fleets or planes); the other five countries are AI. Britain
// declares war on Italy after the preparation minute; a few ticks later
// the scenario's hand sets the board, the same in every copy restored
// before it (later copies are restored from a game that has it):
// a naval battle off London, a patrol sailing east over the date line,
// a landing at Rome under a British battle fleet, Italian submarines on
// Britain's trade lane, British and Italian fighters and bombers over
// the central sea and London, a bombed factory, Italy without fuel.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type {
  GameStartInfo,
  StampedIntent,
} from "@openfront/engine-api/Schemas";
import type {
  AirMission,
  AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIPMENT } from "@openfront/engine-api/ww1936/LandTypes";
import { INVASION_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "@openfront/engine/game/Game";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { openTrade } from "@openfront/engine/ww1936/economy/Trade";
import { startNavalBattle } from "@openfront/engine/ww1936/navy/NavalBattles";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { fleetAtSea } from "./convoyUtil";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { byTag, HUMAN, placeArmy, wwGameStart, type WwHuman } from "./util";

export const GBR_ITA: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "ITA" },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
/** The tick the war is declared (a human's turn, as warAfterPrep). */
export const WAR_TICK = WW_PREP_TICKS + 1;
/** The tick the hand sets the board (after the declaration ran). */
export const SET_TICK = WW_PREP_TICKS + 3;
const STEEL = RESOURCE_IDS.indexOf("steel");
const READY = INVASION_STATES.indexOf("ready");

export function seaAirStart(gameID = "WWSEAAIR"): GameStartInfo {
  const s = wwGameStart({}, GBR_ITA);
  s.gameID = gameID;
  return s;
}

let filesMemo: Promise<MapFiles> | null = null;
/** ww1936sea's files (loaded once; lockstep clones them per game). */
export function seaFiles(): Promise<MapFiles> {
  return (filesMemo ??= loadMapFiles(
    new TestDataMapLoader(SEA.map),
    GameMapType.World1936,
    GameMapSize.Normal,
  ));
}

/** Britain's declaration on Italy at WAR_TICK (read from the main game). */
export function seaAirIntents(g: Game): StampedIntent[] {
  if (g.ticks() !== WAR_TICK) return [];
  return [
    {
      type: "declare_war",
      target: byTag(g, "ITA").id(),
      clientID: HUMAN,
    } as StampedIntent,
  ];
}

function stockUp(g: Game, tag: CountryTag): void {
  const ww = g.worldWar()!;
  const ce = ww.economy.country(byTag(g, tag).smallID())!;
  for (const t of GROUND_EQUIPMENT) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

function planes(g: Game, id: number, type: AirType, n: number): void {
  const ce = g.worldWar()!.economy.country(id)!;
  for (let gen = 1; gen <= EQUIPMENT_GENS[type]; gen++) {
    ce.stock[equipKey(type, gen)] = gen === 1 ? n : 0;
  }
}

function deploy(
  g: Game,
  id: number,
  sr: number,
  type: AirType,
  mission: AirMission,
  count: number,
): void {
  const block = g
    .worldWar()!
    .air.issue(id, { kind: "air_deploy", sr, type, mission, count }, g.ticks());
  if (block !== null) throw new Error(`air_deploy ${type}: ${block}`);
}

/**
 * The scenario's hand (lockstep's `hand`: after every tick, on the main
 * game and every copy, reading only the game it gets): the board at
 * SET_TICK; afterwards Britain sails each invasion as soon as it is ready
 * (a human's invasion_execute, through navy.issue).
 */
export function seaAirHand(opts: { air: boolean }): (g: Game) => void {
  return (g) => {
    const ww = g.worldWar()!;
    const navy = ww.navy;
    if (g.ticks() === SET_TICK) setBoard(g, opts.air);
    for (const inv of navy.invasions.values()) {
      if (inv.owner !== GBR || inv.state !== READY) continue;
      navy.issue(GBR, { kind: "invasion_execute", army: inv.army }, g.ticks());
    }
  };
}

function setBoard(g: Game, air: boolean): void {
  const ww = g.worldWar()!;
  const navy = ww.navy;
  const tick = g.ticks();
  if (!ww.land.isEnemy(GBR, ITA)) throw new Error("no war of GBR and ITA");
  stockUp(g, "GBR");
  stockUp(g, "ITA");
  // A battle off London: two battleships and six destroyers against one
  // battleship, three destroyers and two submarines.
  fleetAtSea(
    navy,
    GBR,
    REGION.london,
    [
      ["bb", 1, 2],
      ["dd", 1, 6],
    ],
    ZONE.west,
    "patrol",
    SR.approaches,
  );
  const it = fleetAtSea(
    navy,
    ITA,
    REGION.rome,
    [
      ["bb", 1, 1],
      ["dd", 1, 3],
      ["ss", 1, 2],
    ],
    ZONE.west,
    "patrol",
    SR.approaches,
  );
  startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), it.id, tick);
  // A patrol sails from London to the eastern sea (over the date line).
  const p = navy.createFleet(GBR, REGION.london, [
    ["cl", 1, 2],
    ["dd", 1, 4],
  ]);
  const ord = navy.issue(
    GBR,
    { kind: "fleet_mission", fleet: p, mission: "patrol", sr: SR.eastern },
    tick,
  );
  if (ord !== null) throw new Error(`fleet_mission: ${ord}`);
  // Destroyers hold the western sea for the landing's route.
  fleetAtSea(
    navy,
    GBR,
    REGION.london,
    [["dd", 1, 8]],
    ZONE.west,
    "patrol",
    SR.approaches,
  );
  // The landing's sea: a British battle fleet off Rome.
  fleetAtSea(
    navy,
    GBR,
    REGION.london,
    [
      ["bb", 1, 4],
      ["dd", 1, 12],
    ],
    ZONE.middle,
    "invasion_support",
    SR.central,
  );
  // Italy holds Rome; Britain prepares a landing there from London (a
  // short preparation: the oracle needs the voyage and the landing).
  placeArmy(g, "ITA", REGION.rome, 1);
  const a = placeArmy(g, "GBR", REGION.london, 2);
  const inv = navy.issue(
    GBR,
    { kind: "army_invade", army: a.id, target: REGION.rome },
    tick,
  );
  if (inv !== null) throw new Error(`army_invade: ${inv}`);
  navy.invasions.get(a.id)!.prepDays = 12;
  // Britain's trade over the western sea; Italian boats raid it.
  const sun = ww.economy.country(TAG_ID.SUN)!;
  sun.laws.trade = "export_focus";
  const deal = openTrade(
    ww.economy,
    ww.economy.country(GBR)!,
    TAG_ID.SUN,
    STEEL,
    1,
  );
  if (deal !== null) throw new Error(`openTrade: ${deal}`);
  fleetAtSea(
    navy,
    ITA,
    REGION.rome,
    [["ss", 2, 30]],
    ZONE.west,
    "raid",
    SR.approaches,
  );
  if (!air) return;
  // The air war over the central sea and London: fighters both sides,
  // Italian bombers on London's industry, a factory there already hit.
  planes(g, GBR, "fighter", 400);
  planes(g, ITA, "fighter", 400);
  planes(g, ITA, "bomber", 300);
  deploy(g, GBR, SR.central, "fighter", "air_superiority", 200);
  deploy(g, GBR, SR.westLand, "fighter", "interception", 150);
  deploy(g, ITA, SR.central, "fighter", "air_superiority", 250);
  deploy(g, ITA, SR.westLand, "fighter", "air_superiority", 100);
  deploy(g, ITA, SR.westLand, "bomber", "strategic_bombing", 250);
  const econ = ww.economy;
  econ.addBuilding(REGION.london, "civ", 6);
  damageBuilding(econ, REGION.london, "civ", 2500);
  // Italy's fuel is gone: its sorties and fleets run short.
  econ.country(ITA)!.fuelMilli = 0;
}
