// World War 1936 P2 (spec §15): what the land screens draw, as plain data
// from the views. No Lit here: the screens render it and the tests read
// it. Every rule is engine-lib's (spec §15.4 "the same judging function's
// reason"): the order checks, the template numbers, the battle forecast,
// the paths, the fronts and the weather.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  EquipmentType,
  WW_MIL_OUTPUT_MILLI,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  ARMY_EXECUTING,
  ARMY_MOVING,
  ARMY_PARA,
  ARMY_RAIL,
  ARMY_RETREAT,
  ARMY_SEA,
  ArmySummary,
  BattleSummary,
  DivisionData,
  DivisionStats,
  GeneralData,
  LandTerrain,
  ModLine,
  ROLE_ATTACK,
  ROLE_DEFEND,
  SideSum,
  TemplateData,
  TemplateDef,
  TrainingData,
  Weather,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TARGETS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  combatWidth,
  divisionMods,
  emptySide,
  excessWidthBp,
  ModInput,
  predictBattle,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import {
  borderRegionsOf,
  frontOf,
  frontSize,
  FrontWorld,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { landFuelSpeedPm } from "@openfront/engine-lib/ww1936/FuelRules";
import {
  GENERALS,
  isTitledGeneral,
  titleNoOfGeneral,
} from "@openfront/engine-lib/ww1936/Generals";
import {
  landOrderBlockOf,
  OrderCheckArmy,
  OrderCheckWorld,
} from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  edgeTicks,
  moveNeed,
  moveStep,
  railStep,
  seaTicks,
  shortestPath,
} from "@openfront/engine-lib/ww1936/MoveRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  GEN1,
  templateBlock,
  templateCounts,
  templateStats,
  templateXpCost,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { techTotals, TechTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";
import { LandFrontWorld, type LandWarInputs } from "../../view/LandFrontWorld";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { blockText } from "./EconomyModel";
import {
  airBpOf,
  airMoveOf,
  ArmyLift,
  fuelBpOf,
  landingBpsOf,
  landSeaAirOf,
  paraBlockFor,
  seaMoveBlock,
  shoreBpOf,
} from "./LandSeaAir";
import type { LandMode } from "./LandSelection";
import { factionOfId, isKoreanUi, type WwGame } from "./WorldWarModel";

// ---- Sides (spec §7.1): who is a friend, who may be fought now ----

/** The engine's WwLand.sameSide / isEnemy, as the screens see them. */
export interface LandSides {
  sameSide(a: number, b: number): boolean;
  isEnemy(a: number, b: number): boolean;
  /**
   * Changes whenever isEnemy may answer differently (a war, the end of the
   * preparation minute): the model's caches key on it. Absent: never.
   */
  stamp?(): string;
}

/** A country's 1936 faction (no game to read the live one from: tools, tests). */
function factionOf(scenario: ScenarioIndex, smallID: number) {
  const tag = scenario.tagOfSmallId(smallID);
  return tag === undefined ? null : COUNTRIES[tag].faction;
}

/** The same country, or the same 1936 faction (the engine's sideOf at the start). */
function sameSideIn(scenario: ScenarioIndex, a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  if (a === b) return true;
  const f = factionOf(scenario, a);
  return f !== null && f === factionOf(scenario, b);
}

/** Sides with no war at all (before the screens know the war list). */
export function peaceSides(scenario: ScenarioIndex): LandSides {
  return {
    sameSide: (a, b) => sameSideIn(scenario, a, b),
    isEnemy: () => false,
  };
}

/** A game the land screens read: WwGame plus its land view. */
export type LandGame = WwGame & { wwLand(): WwLandView | null };

/**
 * The World War data and tick the land screens and the renderer read
 * (GameView.worldWarData, GameView.ticks): GameRenderer hands the same to
 * setWwLand, so the map's flags and the cards see the same wars.
 */
export function landWarInputsOf(game: WwGame): LandWarInputs {
  return {
    war: () => game.worldWarData(),
    ticks: () => game.ticks(),
    // P3: the live factions (politics' state), not the 1936 ones.
    factions: () => game.wwPolitics?.()?.global?.factions ?? null,
  };
}

/** Changes whenever isEnemy may answer differently: the fight starting, a war, a capitulation. */
function warStamp(game: WwGame): string {
  const data = game.worldWarData();
  if (data === null) return "";
  const fight = game.ticks() >= data.prepEndTick;
  return `${fight}:${data.wars.length}:${data.capitulated.length}`;
}

/**
 * LandSides over the renderer's adapter (engine-lib FrontRules' world),
 * made on first use.
 */
function landSidesFromWorld(
  world: () => LandFrontWorld,
  game: WwGame,
): LandSides {
  return {
    sameSide: (a, b) => world().sameSide(a, b),
    isEnemy: (a, b) => world().isEnemy(a, b),
    stamp: () => warStamp(game),
  };
}

const sidesByGame = new WeakMap<object, LandSides>();

/**
 * The live sides of a game: the faction, and P0's war list once the
 * preparation minute is over (the engine's WorldWar.canFight). With a land
 * view, one per game over a LandFrontWorld (the renderer's adapter: the
 * cards, the map flags and the engine share the rule); without one, read
 * on every call.
 */
export function landSidesOf(game: LandGame): LandSides {
  const cached = sidesByGame.get(game);
  if (cached !== undefined) return cached;
  const view = game.wwLand();
  if (view !== null) {
    let world: LandFrontWorld | null = null;
    const sides = landSidesFromWorld(
      () => (world ??= new LandFrontWorld(view, landWarInputsOf(game))),
      game,
    );
    sidesByGame.set(game, sides);
    return sides;
  }
  return {
    // P3: the live factions (politics' state, WorldWarModel.factionOfId).
    sameSide: (a, b) => {
      if (a <= 0 || b <= 0) return false;
      if (a === b) return true;
      const f = factionOfId(game, a);
      return f !== null && f === factionOfId(game, b);
    },
    isEnemy: (a, b) => {
      if (a <= 0 || b <= 0 || a === b) return false;
      const data = game.worldWarData();
      if (data === null) return false;
      if (game.ticks() < data.prepEndTick) return false;
      return data.wars.some(
        (w) => (w.a === a && w.b === b) || (w.a === b && w.b === a),
      );
    },
    stamp: () => warStamp(game),
  };
}

const sidesByView = new WeakMap<object, LandSides>();

/** The sides the land model reads for this view (GameRenderer gives the game's). */
export function setLandSides(view: object, sides: LandSides): void {
  sidesByView.set(view, sides);
}

/** The sides registered for this view; peace (factions only) when none is. */
export function sidesOf(view: WwLandView): LandSides {
  return sidesByView.get(view) ?? peaceSides(view.scenario);
}

// ---- Names ----

const ARMY_NAME_KEYS = {
  1: "ww1936.land.army_name_1",
  2: "ww1936.land.army_name_2",
  3: "ww1936.land.army_name_3",
  n: "ww1936.land.army_name_n",
} as const;

/** "2nd Army" / "제2군" (spec §18: the state keeps the number only). */
export function armyName(nameNo: number): string {
  const teen = nameNo % 100 >= 11 && nameNo % 100 <= 13;
  const last = nameNo % 10;
  const key =
    teen || last < 1 || last > 3
      ? ARMY_NAME_KEYS.n
      : ARMY_NAME_KEYS[last as 1 | 2 | 3];
  return translateText(key, { n: nameNo });
}

/** A general by its game id: a named one (GENERALS index + 1) or a titled one. */
export function generalName(id: number): string {
  if (id <= 0) return "";
  if (isTitledGeneral(id)) {
    return translateText("ww1936.land.titled_general", {
      n: titleNoOfGeneral(id),
    });
  }
  const g = GENERALS[id - 1];
  return g === undefined ? "" : translateText(`ww1936.general.${g.id}`);
}

/** A roster entry's name. */
export function rosterName(g: GeneralData): string {
  return g.key === ""
    ? translateText("ww1936.land.titled_general", { n: g.titleNo })
    : translateText(`ww1936.general.${g.key}`);
}

/** A 1936 default by its key (ww1936.tpl.<key>), a player's own by its name. */
export function templateName(t: TemplateData): string {
  return t.key !== "" ? translateText(`ww1936.tpl.${t.key}`) : t.name;
}

/** A region's name in the UI's language (scenario.json carries both, P0 spec §11). */
export function regionName(
  scenario: ScenarioIndex,
  id: number,
  korean = isKoreanUi(),
): string {
  const r = scenario.region(id);
  if (r === undefined) return "";
  return korean ? r.nameKo : r.name;
}

export type ExpLevel = "recruit" | "regular" | "veteran" | "elite";

/** A division's experience level (spec §5.4), ww1936.exp.<level>. */
export function expLevel(exp: number): ExpLevel {
  if (exp < 250) return "recruit";
  if (exp < 500) return "regular";
  return exp < 750 ? "veteran" : "elite";
}

/** Days for `ticks` (7.5 a day): one decimal under ten days ("0.8"). */
export function daysOf(ticks: number): number {
  const d = Math.max(0, ticks) / 7.5;
  return d < 10 ? Math.round(d * 10) / 10 : Math.round(d);
}

// ---- Shared lookups ----

function detailOf(view: WwLandView, me: number) {
  return view.details.get(me) ?? null;
}

function myArmy(
  view: WwLandView,
  me: number,
  army: number,
): ArmySummary | null {
  const a = view.armies.get(army);
  return a !== undefined && me > 0 && a.owner === me ? a : null;
}

function divisionsOf(view: WwLandView, me: number, army: number) {
  return (detailOf(view, me)?.divisions ?? [])
    .filter((d) => d.army === army)
    .sort((a, b) => a.id - b.id);
}

function templateOf(
  view: WwLandView,
  me: number,
  id: number,
): TemplateData | null {
  return detailOf(view, me)?.templates.find((t) => t.id === id) ?? null;
}

export function templateDef(t: TemplateData): TemplateDef {
  return { name: t.name, battalions: t.battalions, support: t.support };
}

export function researchedOf(
  economy: WwEconomyView,
  me: number,
): Set<WwTechId> {
  return new Set(economy.detail(me)?.researched ?? []);
}

export function techOf(economy: WwEconomyView, me: number): TechTotals {
  return techTotals(researchedOf(economy, me));
}

const NEUTRAL_TECH = techTotals(new Set());

function weatherOf(scenario: ScenarioIndex, region: number, day: number) {
  return weatherAt(
    day,
    scenario.latC(region),
    scenario.landOf(region),
    scenario.wcell(region),
  );
}

/** The template most of these divisions use (ties: the smaller id); 0: none. */
function mainTemplate(divs: readonly DivisionData[]): number {
  const n = new Map<number, number>();
  for (const d of divs) n.set(d.template, (n.get(d.template) ?? 0) + 1);
  let best = 0;
  let most = 0;
  for (const [t, c] of [...n].sort((a, b) => a[0] - b[0])) {
    if (c > most) {
      best = t;
      most = c;
    }
  }
  return best;
}

function generalData(
  view: WwLandView,
  me: number,
  id: number,
): GeneralData | null {
  if (id <= 0) return null;
  return detailOf(view, me)?.generals.find((g) => g.id === id) ?? null;
}

// ---- The order checks' world (spec §15.4) ----

/** One army as LandOrderChecks reads it, from the views. */
export function orderCheckArmy(
  view: WwLandView,
  me: number,
  a: ArmySummary,
): OrderCheckArmy {
  const divs = a.owner === me ? divisionsOf(view, me, a.id) : [];
  const regions =
    divs.length === 0
      ? [a.region]
      : [...new Set(divs.map((d) => d.region))].sort((x, y) => x - y);
  const para = (d: DivisionData) =>
    templateOf(view, me, d.template)?.battalions.includes("paratrooper") ??
    false;
  const order = a.mine?.order.kind;
  // `templates` and `front` let the checks judge a split by template and
  // a plan or execute without a front (Task 3's optional fields): known
  // for my own armies only.
  const out = {
    owner: a.owner,
    divisions: a.divisions,
    regions,
    fighting:
      divs.some((d) => d.battle !== 0) ||
      (a.state & (ARMY_BATTLE | ARMY_RAIL | ARMY_SEA)) !== 0,
    allPara: divs.length > 0 && divs.every(para),
    paraLastDay: a.mine?.paraLastDay ?? -1,
    ...(a.mine === null
      ? {}
      : {
          templates: divs.map((d) => d.template),
          front: order === "front" || order === "plan",
        }),
  };
  return out;
}

/** The world the engine-lib order checks read, built from the screens' views. */
export function orderCheckWorld(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  day: number,
  sides: LandSides = sidesOf(view),
): OrderCheckWorld {
  return {
    scenario: view.scenario,
    controller: view.controller,
    sameSide: sides.sameSide,
    isEnemy: sides.isEnemy,
    me,
    day,
    rail: (r) => economy.rail[r] ?? 0,
    // P4 plan decision 11: a working naval base now (the region updates).
    isPort: (r) => economy.navalPort(r),
    vp: (r) => view.scenario.region(r)?.vp ?? 0,
    army: (id) => {
      const a = view.armies.get(id);
      return a === undefined ? null : orderCheckArmy(view, me, a);
    },
    armyCount: () => view.armiesOf(me).length,
    // P4 (plan decision 35): the air war's conditions first, as the engine.
    ...(landSeaAirOf(view) === null
      ? {}
      : {
          paraBlock: (army: number, target: number) =>
            paraBlockFor(
              landSeaAirOf(view),
              view.scenario,
              economy,
              me,
              armyLift(view, economy, me, army),
              target,
              researchedOf(economy, me),
            ),
        }),
  };
}

/**
 * P4: my army as the sea and air checks see it — its divisions' regions,
 * weights (convoys, transport planes) and marines, and whether one fights.
 */
export function armyLift(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
): ArmyLift {
  const a = myArmy(view, me, army);
  if (a === null) {
    return {
      regions: [],
      weightsCenti: [],
      allMarines: false,
      inBattle: false,
    };
  }
  const tech = techOf(economy, me);
  const divs = divisionsOf(view, me, army);
  const stats = new Map<number, DivisionStats | null>();
  const statsOf = (id: number) => {
    if (!stats.has(id)) {
      const t = templateOf(view, me, id);
      stats.set(
        id,
        t === null ? null : templateStats(templateDef(t), tech, GEN1),
      );
    }
    return stats.get(id) ?? null;
  };
  const check = orderCheckArmy(view, me, a);
  return {
    regions: [...check.regions],
    weightsCenti: divs.map((d) => statsOf(d.template)?.weightCenti ?? 0),
    allMarines:
      divs.length > 0 &&
      divs.every(
        (d) =>
          templateOf(view, me, d.template)?.battalions.includes("marine") ??
          false,
      ),
    inBattle: check.fighting,
  };
}

function frontWorld(view: WwLandView, sides: LandSides): FrontWorld {
  return {
    scenario: view.scenario,
    controller: view.controller,
    sameSide: sides.sameSide,
    isEnemy: sides.isEnemy,
  };
}

/** Spec §8.1: my side's regions touching any enemy (front mode picks among these). */
export function borderRegions(
  view: WwLandView,
  me: number,
  sides: LandSides = sidesOf(view),
): number[] {
  return borderRegionsOf(frontWorld(view, sides), me, 0);
}

// ---- The army list (spec §15.5 tab 1) ----

export interface ArmyRowData {
  id: number;
  nameNo: number;
  generalKey: string;
  titleNo: number;
  divisions: number;
  strengthPm: number;
  orgPm: number;
  state: number;
  region: number;
}

function rowOf(a: ArmySummary): ArmyRowData {
  const g = a.general;
  return {
    id: a.id,
    nameNo: a.nameNo,
    generalKey: g > 0 && !isTitledGeneral(g) ? (GENERALS[g - 1]?.id ?? "") : "",
    titleNo: titleNoOfGeneral(g),
    divisions: a.divisions,
    strengthPm: a.strengthPm,
    orgPm: a.orgPm,
    state: a.state,
    region: a.region,
  };
}

/** My armies, by id. */
export function armyRows(view: WwLandView, me: number): ArmyRowData[] {
  return view.armiesOf(me).map(rowOf);
}

/** The row's general: a named one, "Commander No. 3", or "" without one. */
export function rowGeneralName(row: ArmyRowData): string {
  if (row.titleNo > 0) {
    return translateText("ww1936.land.titled_general", { n: row.titleNo });
  }
  return row.generalKey === ""
    ? ""
    : translateText(`ww1936.general.${row.generalKey}`);
}

// ---- The army card (spec §15.4) ----

export interface StatusLine {
  key: string;
  params: Record<string, string | number>;
}

/** Written out so the translation check sees every key. */
const STATE_KEYS = {
  idle: "ww1936.land.state_idle",
  moving: "ww1936.land.state_moving",
  battle: "ww1936.land.state_battle",
  encircled: "ww1936.land.state_encircled",
  rail: "ww1936.land.state_rail",
  sea: "ww1936.land.state_sea",
  retreat: "ww1936.land.state_retreat",
  executing: "ww1936.land.state_executing",
  para: "ww1936.land.state_para",
} as const;

/** The card's state line, the most pressing first (encircled, airborne, retreating…). */
export function armyStatus(
  view: WwLandView,
  me: number,
  a: ArmySummary,
  day: number,
): StatusLine {
  const s = a.state;
  const line = (
    key: keyof typeof STATE_KEYS,
    params: StatusLine["params"] = {},
  ) => ({
    key: STATE_KEYS[key],
    params,
  });
  const eta = daysOf(a.mine?.etaTicks ?? 0);
  if (s & ARMY_ENCIRCLED) return line("encircled");
  if (s & ARMY_PARA) {
    const ready = a.mine?.order.readyDay ?? day;
    return line("para", { days: Math.max(0, ready - day) });
  }
  if (s & ARMY_RETREAT) return line("retreat");
  if (s & ARMY_BATTLE) {
    const fights = new Set(
      divisionsOf(view, me, a.id)
        .filter((d) => d.battle !== 0)
        .map((d) => d.battle),
    );
    return line("battle", { n: Math.max(1, fights.size) });
  }
  if (s & ARMY_RAIL) return line("rail", { days: eta });
  if (s & ARMY_SEA) return line("sea", { days: eta });
  if (s & ARMY_MOVING) {
    const path = a.mine?.path ?? [];
    const order = a.mine?.order;
    const to =
      order?.kind === "move"
        ? order.to
        : (path[path.length - 1] ?? a.move?.to ?? a.region);
    return line("moving", {
      region: regionName(view.scenario, to),
      days: eta,
    });
  }
  if (s & ARMY_EXECUTING) return line("executing");
  return line("idle");
}

/** The army card's buttons, in the order the card draws them (spec §15.4). */
export const ARMY_BUTTONS = [
  "move",
  "attack",
  "front",
  "plan",
  "rail",
  "sea",
  "split",
  "merge",
  "auto",
  "more",
] as const;
export type ArmyButton = (typeof ARMY_BUTTONS)[number];

/**
 * Why a card button is greyed: an order check's refusal, or "split_single"
 * (an army of one division has nothing to split off; its own text).
 */
export type CardBlock = WwOrderBlock | "split_single";

/** A card button's refusal, in words. */
export function cardBlockText(b: CardBlock): string {
  return b === "split_single"
    ? translateText("ww1936.land.block_split_single")
    : blockText(b);
}

export interface ArmyCardData {
  row: ArmyRowData;
  status: StatusLine;
  planBp: number;
  supplyPm: number;
  buttons: { id: string; block: CardBlock | null }[];
  /** The general's numbers and traits; null without one. */
  general: GeneralData | null;
  auto: boolean;
  /** The plan runs (army_execute on). */
  executing: boolean;
  /** My armies this one can merge into now (army_merge passes the checks). */
  mergeWith: number[];
  /** The "⋯" panel's paradrop button (to the nearest enemy region). */
  paradropBlock: WwOrderBlock | null;
}

/**
 * Per-view memo of the card's searches (the nearest enemy region, the
 * armies to merge with), dropped whenever the view, the economy, the day,
 * the viewer or the wars move on: the card redraws every few ticks.
 */
const memos = new WeakMap<
  object,
  { key: string; values: Map<string, unknown> }
>();

function memo<T>(
  view: WwLandView,
  key: string,
  name: string,
  make: () => T,
): T {
  let m = memos.get(view);
  if (m === undefined || m.key !== key) {
    m = { key, values: new Map() };
    memos.set(view, m);
  }
  if (!m.values.has(name)) m.values.set(name, make());
  return m.values.get(name) as T;
}

function memoKey(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  day: number,
  sides: LandSides,
): string {
  return `${view.version}|${economy.version}|${me}|${day}|${sides.stamp?.() ?? ""}`;
}

/** The nearest enemy region from `from` over the land graph (BFS, ids ascending). */
function nearestEnemy(
  view: WwLandView,
  me: number,
  from: number,
  sides: LandSides,
): number | null {
  const seen = new Set([from]);
  let layer = [from];
  while (layer.length > 0) {
    const next: number[] = [];
    for (const r of layer) {
      for (const e of view.scenario.edgesOf(r)) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        if (sides.isEnemy(me, view.controller[e.to])) return e.to;
        next.push(e.to);
      }
    }
    layer = next.sort((a, b) => a - b);
  }
  return null;
}

/** My armies other than `a` with a division in one of its regions, by id. */
function sharingArmies(view: WwLandView, me: number, a: ArmySummary): number[] {
  const mine = new Set(orderCheckArmy(view, me, a).regions);
  return view
    .armiesOf(me)
    .filter(
      (b) =>
        b.id !== a.id &&
        orderCheckArmy(view, me, b).regions.some((r) => mine.has(r)),
    )
    .map((b) => b.id);
}

/**
 * The armies `a` can merge into now: those sharing a region whose merge
 * the order checks accept; else, with none, the first one's refusal.
 */
function mergeTargets(
  w: OrderCheckWorld,
  view: WwLandView,
  me: number,
  a: ArmySummary,
): { into: number[]; block: WwOrderBlock | null } {
  const sharing = sharingArmies(view, me, a);
  const into: number[] = [];
  let block: WwOrderBlock | null = null;
  for (const id of sharing) {
    const b = landOrderBlockOf(w, { kind: "army_merge", army: a.id, into: id });
    if (b === null) into.push(id);
    else block ??= b;
  }
  return { into, block: into.length > 0 ? null : (block ?? "no_army") };
}

/**
 * Each button's block (spec §15.4: a greyed button says why), asked of
 * LandOrderChecks with the order the button leads to: the army's own
 * region where it needs one (a region without a railway or a port says
 * no_rail / no_port), the nearest enemy region for an attack, my first
 * border region for a front. The region tapped on the map afterwards is
 * checked again then (tapBlock).
 */
function buttonBlocks(
  w: OrderCheckWorld,
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  a: ArmySummary,
  sides: LandSides,
  enemy: number | null,
  merge: WwOrderBlock | null,
): { id: ArmyButton; block: CardBlock | null }[] {
  const army = a.id;
  const at = a.region;
  const check = (o: LandOrder | null, none: WwOrderBlock) =>
    o === null ? none : landOrderBlockOf(w, o);
  const border = borderRegionsOf(frontWorld(view, sides), me, 0)[0] ?? at;
  // A sea move needs another port of my side to sail to.
  const port = view.scenario.landRegions.find(
    (r) =>
      r.id !== at &&
      w.isPort(r.id) &&
      sides.sameSide(me, view.controller[r.id]),
  )?.id;
  const blocks: Record<ArmyButton, CardBlock | null> = {
    move: check({ kind: "army_move", army, region: at }, "no_army"),
    attack: check(
      enemy === null ? null : { kind: "army_attack", army, region: enemy },
      "not_at_war",
    ),
    front: check(
      { kind: "army_front", army, anchor: border, enemy: 0 },
      "no_army",
    ),
    plan: check(
      { kind: "army_plan", army, targets: [], stance: "balanced" },
      "no_army",
    ),
    rail: check({ kind: "army_rail", army, region: at }, "no_army"),
    sea:
      check(
        port === undefined ? null : { kind: "army_sea", army, region: port },
        "no_port",
      ) ??
      (port === undefined
        ? null
        : seaMoveBlock(
            landSeaAirOf(view),
            view.scenario,
            economy,
            sides,
            me,
            armyLift(view, economy, me, army),
            port,
          )),
    split:
      a.divisions < 2
        ? "split_single"
        : check({ kind: "army_split", army, count: 1, template: 0 }, "no_army"),
    merge,
    auto: check(
      { kind: "army_auto", army, on: !(a.mine?.auto ?? false) },
      "no_army",
    ),
    more: null,
  };
  return ARMY_BUTTONS.map((id) => ({ id, block: blocks[id] }));
}

export function armyCard(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  day: number,
  sides: LandSides = sidesOf(view),
): ArmyCardData | null {
  const a = myArmy(view, me, army);
  if (a === null) return null;
  const w = orderCheckWorld(view, economy, me, day, sides);
  const key = memoKey(view, economy, me, day, sides);
  const enemy = memo(view, key, `enemy:${a.region}`, () =>
    nearestEnemy(view, me, a.region, sides),
  );
  const merge = memo(view, key, `merge:${a.id}`, () =>
    mergeTargets(w, view, me, a),
  );
  return {
    row: rowOf(a),
    status: armyStatus(view, me, a, day),
    planBp: a.mine?.planBp ?? 0,
    supplyPm: a.mine?.supplyPm ?? 1000,
    buttons: buttonBlocks(w, view, economy, me, a, sides, enemy, merge.block),
    general: generalData(view, me, a.general),
    auto: a.mine?.auto ?? false,
    executing: a.mine?.order.executing ?? false,
    mergeWith: merge.into,
    paradropBlock:
      enemy === null
        ? "not_at_war"
        : landOrderBlockOf(w, { kind: "paradrop", army: a.id, region: enemy }),
  };
}

// ---- Taps on the map (spec §15.3) ----

/** What a tap on a region means in a mode; null: "elsewhere" (it cancels). */
export type TapKind =
  | "move"
  | "attack"
  | "rail"
  | "sea"
  | "paradrop"
  | "front"
  | "plan";

export function tapKind(
  view: WwLandView,
  me: number,
  mode: LandMode,
  region: number,
  sides: LandSides = sidesOf(view),
): TapKind | null {
  if (view.scenario.region(region) === undefined) return null;
  const c = view.controller[region];
  const ours = sides.sameSide(me, c);
  const enemy = sides.isEnemy(me, c);
  switch (mode) {
    case "none":
      return ours ? "move" : enemy ? "attack" : null;
    case "move":
      return ours ? "move" : null;
    case "attack":
      return enemy ? "attack" : null;
    case "rail":
      return ours ? "rail" : null;
    case "sea":
      return ours ? "sea" : null;
    case "paradrop":
      return enemy ? "paradrop" : null;
    case "plan":
      return enemy ? "plan" : null;
    case "front":
      return borderRegions(view, me, sides).includes(region) ? "front" : null;
  }
}

/** The order a confirming tap sends; null for a plan target (the card runs plans). */
export function tapOrder(
  kind: TapKind,
  army: number,
  region: number,
): LandOrder | null {
  switch (kind) {
    case "move":
      return { kind: "army_move", army, region };
    case "attack":
      return { kind: "army_attack", army, region };
    case "rail":
      return { kind: "army_rail", army, region };
    case "sea":
      return { kind: "army_sea", army, region };
    case "paradrop":
      return { kind: "paradrop", army, region };
    case "front":
      return { kind: "army_front", army, anchor: region, enemy: 0 };
    case "plan":
      return null;
  }
}

/** A plan draft after a tap on `region` (spec §15.3-5: add or drop, at most 3). */
export function toggleTarget(
  targets: readonly number[],
  region: number,
): number[] {
  if (targets.includes(region)) return targets.filter((t) => t !== region);
  return targets.length >= WW_MAX_TARGETS ? [...targets] : [...targets, region];
}

/** Why an order would be refused now: the engine's own check, on the screens' data. */
export function orderBlock(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  day: number,
  order: LandOrder,
  sides: LandSides = sidesOf(view),
): WwOrderBlock | null {
  const block = landOrderBlockOf(
    orderCheckWorld(view, economy, me, day, sides),
    order,
  );
  // P4 (plan decision 34): a sea move also needs its convoys (lane C).
  if (block !== null || order.kind !== "army_sea") return block;
  return seaMoveBlock(
    landSeaAirOf(view),
    view.scenario,
    economy,
    sides,
    me,
    armyLift(view, economy, me, order.army),
    order.region,
  );
}

// ---- Previews (spec §9.9, §7.2–§7.5, §8.1) ----

export interface AttackPreviewData {
  ratioPm: number;
  days: number;
  land: LandTerrain;
  river: 0 | 1 | 2;
  strait: boolean;
  fort: number;
  directions: number;
}

/** Two side sums as one (armour, pierce and hardness width-weighted, as addToSide). */
export function mergeSides(a: SideSum, b: SideSum): SideSum {
  const w = a.width + b.width;
  const mix = (x: number, y: number) =>
    w === 0 ? 0 : Math.floor((x * a.width + y * b.width) / w);
  return {
    divisions: a.divisions + b.divisions,
    width: w,
    soft: a.soft + b.soft,
    hard: a.hard + b.hard,
    def: a.def + b.def,
    brk: a.brk + b.brk,
    armor: mix(a.armor, b.armor),
    pierce: mix(a.pierce, b.pierce),
    hardnessPm: mix(a.hardnessPm, b.hardnessPm),
    orgMilli: a.orgMilli + b.orgMilli,
    hpMilli: a.hpMilli + b.hpMilli,
  };
}

/** `n` divisions of `s` as a side (pre-flight U-c's stand-in for unseen armies). */
function sideOfStats(s: DivisionStats, n: number): SideSum {
  return {
    divisions: n,
    width: s.width * n,
    soft: s.soft * n,
    hard: s.hard * n,
    def: s.def * n,
    brk: s.brk * n,
    armor: s.armor,
    pierce: s.pierce,
    hardnessPm: s.hardnessPm,
    orgMilli: s.orgMilli * n,
    hpMilli: s.hpMilli * n,
  };
}

/**
 * The defenders of `region` as the screen knows them (pre-flight U-c): the
 * sums of the armies of other sides standing there; without one, the
 * region's division counts × each country's first 1936 template.
 */
export function enemySideAt(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  region: number,
  sides: LandSides = sidesOf(view),
): SideSum {
  let sum = emptySide();
  const armies = view
    .armiesAt(region)
    .filter((a) => !sides.sameSide(me, a.owner));
  for (const a of armies) sum = mergeSides(sum, a.sum);
  if (armies.length > 0) return sum;
  for (const [id, n] of view.regions.get(region)?.counts ?? []) {
    if (n <= 0 || sides.sameSide(me, id)) continue;
    const tag = view.scenario.tagOfSmallId(id);
    if (tag === undefined) continue;
    const civ = economy.summary(id)?.civ ?? 0;
    const first = startTemplates(tag, view.scenario.devOf(tag, civ))[0];
    if (first === undefined) continue;
    sum = mergeSides(
      sum,
      sideOfStats(templateStats(first.def, NEUTRAL_TECH, GEN1), n),
    );
  }
  return sum;
}

/** Where an attack on `region` starts: the army's regions next to it, else my side's first. */
function attackOrigins(
  view: WwLandView,
  me: number,
  a: ArmySummary,
  region: number,
  sides: LandSides,
): number[] {
  const touching = (r: number) => view.scenario.edgeBetween(r, region) >= 0;
  const own = orderCheckArmy(view, me, a).regions.filter(touching);
  if (own.length > 0) return own;
  return view.scenario
    .edgesOf(region)
    .map((e) => e.to)
    .filter((r) => sides.sameSide(me, view.controller[r]))
    .slice(0, 1);
}

/** A division the screen can only guess at: no general, no plan, full supply. */
function plainInput(
  attacking: boolean,
  land: LandTerrain,
  weather: Weather,
): ModInput {
  return {
    attacking,
    genAtt: 0,
    genDef: 0,
    traits: 0,
    flags: 0,
    tech: NEUTRAL_TECH,
    exp: 0,
    planBp: 0,
    land,
    weather,
    river: 0,
    strait: false,
    fort: 0,
    entrench: 0,
    excessBp: 0,
    supplyPm: 1000,
    encircled: false,
    // P4 (pre-flight ruling 3): p4Fields fills these from the navy and air views.
    airBp: 0,
    fuelBp: 0,
    landingBp: 0,
    coastalFortBp: 0,
    shoreBp: 0,
    // P6 (pre-flight §0-2): the engine's flat depth fields; neutral until
    // the depth screens (U1–U3) read them from WwDepthView.
    ...NEUTRAL_DEPTH_INPUT,
  };
}

/** P6: ModInput's depth fields at their neutral values (the engine's with no depth system). */
export const NEUTRAL_DEPTH_INPUT: Pick<
  ModInput,
  | "fmAtt"
  | "fmDef"
  | "fmTraits"
  | "cmdAttBp"
  | "cmdDefBp"
  | "enemyPlanCutBp"
  | "fortCut"
  | "halfSupply"
  | "designFlags"
  | "artSoftPm"
  | "fmPlanBp"
> = {
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
};

type P4Fields = Pick<
  ModInput,
  "airBp" | "fuelBp" | "landingBp" | "coastalFortBp" | "shoreBp"
>;

/**
 * P4 (pre-flight ruling 3): the five lines the engine's modInputOf fills
 * from its hooks — enemy air superiority over the region's zone, the
 * owner's fuel, my landing's cuts, the attacker's shore bombardment — from
 * the navy and air views (LandSeaAir). `div`: the division's template
 * numbers (null: unknown, an enemy's stand-in: no anti-air, no fuel).
 */
function p4Fields(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  sides: LandSides,
  owner: number,
  region: number,
  attacking: boolean,
  opponent: number,
  div: Pick<DivisionStats, "airAtk" | "fuelWidthPm" | "flags"> | null,
  divisions: readonly number[],
): P4Fields {
  void sides;
  const p4 = landSeaAirOf(view);
  const techs = researchedOf(economy, me);
  const regionOf = (id: number) =>
    detailOf(view, me)?.divisions.find((d) => d.id === id)?.region ?? 0;
  const landing =
    attacking && owner === me && divisions.length > 0
      ? landingBpsOf(
          p4,
          economy,
          me,
          divisions,
          regionOf,
          region,
          div?.flags ?? 0,
          techs,
        )
      : { landingBp: 0, coastalFortBp: 0 };
  return {
    airBp: airBpOf(p4, view.scenario, region, owner, div?.airAtk ?? 0),
    fuelBp: div === null ? 0 : fuelBpOf(economy, owner, div.fuelWidthPm),
    ...landing,
    shoreBp: attacking
      ? 0
      : shoreBpOf(p4, view.scenario, me, techs, region, opponent, owner),
  };
}

/** My army's representative division: its main template, average experience, general. */
function armyInput(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  a: ArmySummary,
  attacking: boolean,
  land: LandTerrain,
  weather: Weather,
  region: number,
  sides: LandSides,
  opponent: number,
): ModInput {
  const divs = divisionsOf(view, me, a.id);
  const tech = techOf(economy, me);
  const t = templateOf(view, me, mainTemplate(divs));
  const ts = t === null ? null : templateStats(templateDef(t), tech, GEN1);
  const g = generalData(view, me, a.general);
  const exp =
    divs.length === 0
      ? 0
      : Math.floor(divs.reduce((s, d) => s + d.exp, 0) / divs.length);
  return {
    ...plainInput(attacking, land, weather),
    genAtt: g?.att ?? 0,
    genDef: g?.def ?? 0,
    traits: g?.traits ?? 0,
    flags: ts?.flags ?? 0,
    tech,
    exp,
    planBp: a.mine?.planBp ?? 0,
    supplyPm: a.mine?.supplyPm ?? 1000,
    encircled: (a.state & ARMY_ENCIRCLED) !== 0,
    ...p4Fields(
      view,
      economy,
      me,
      sides,
      me,
      region,
      attacking,
      opponent,
      ts,
      divs.map((d) => d.id),
    ),
  };
}

/** The worst crossing from `origins` into `region`. */
function crossing(
  scenario: ScenarioIndex,
  origins: readonly number[],
  region: number,
): { river: 0 | 1 | 2; strait: boolean } {
  let river: 0 | 1 | 2 = 0;
  let strait = false;
  for (const r of origins) {
    const i = scenario.edgeBetween(r, region);
    if (i < 0) continue;
    const e = scenario.edge(i);
    if (e.river > river) river = e.river;
    if (e.strait === 1) strait = true;
  }
  return { river, strait };
}

/**
 * A side of `n` divisions with `s`'s per-division values (the sums
 * scaled, the width-weighted averages kept): the fog's stand-in count.
 */
export function sideScaledTo(s: SideSum, n: number): SideSum {
  if (n === s.divisions || s.divisions <= 0) return s;
  const k = (x: number) => Math.floor((x * n) / s.divisions);
  return {
    divisions: n,
    width: k(s.width),
    soft: k(s.soft),
    hard: k(s.hard),
    def: k(s.def),
    brk: k(s.brk),
    armor: s.armor,
    pierce: s.pierce,
    hardnessPm: s.hardnessPm,
    orgMilli: k(s.orgMilli),
    hpMilli: k(s.hpMilli),
  };
}

/**
 * Spec §9.9, §15.3-3: my army's sum against the defenders' sum in
 * `region` through predictBattle, each side with its modifiers.
 *
 * P6 (spec §8.9, T1b): `enemyValue` is the fog's preview count
 * (FogModel.previewEnemyValue(count, owner)); the defenders' sum is
 * scaled to it, so the ratio and the days never show more than the
 * observer's intel on the region's holder. An empty region stays empty
 * (no token shows there either).
 */
export function attackPreview(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  region: number,
  day: number,
  sides: LandSides = sidesOf(view),
  enemyValue?: (count: number, owner: number) => number,
): AttackPreviewData | null {
  const a = myArmy(view, me, army);
  if (a === null || view.scenario.region(region) === undefined) return null;
  const s = view.scenario;
  const land = s.landOf(region);
  const weather = weatherOf(s, region, day);
  const origins = attackOrigins(view, me, a, region, sides);
  const directions = Math.max(1, Math.min(4, origins.length));
  const { river, strait } = crossing(s, origins, region);
  const fort = economy.effectiveBuildings("fort", region);
  const width = combatWidth(land, directions);
  const holder = view.controller[region] ?? 0;
  const seen = enemySideAt(view, economy, me, region, sides);
  const def =
    enemyValue === undefined || seen.divisions <= 0
      ? seen
      : sideScaledTo(
          seen,
          enemyValue(seen.divisions, sides.sameSide(me, holder) ? 0 : holder),
        );
  const att = divisionMods({
    ...armyInput(
      view,
      economy,
      me,
      a,
      true,
      land,
      weather,
      region,
      sides,
      holder,
    ),
    river,
    strait,
    fort,
    excessBp: excessWidthBp(a.sum.width, width),
  }).mods;
  const dm = divisionMods({
    ...plainInput(false, land, weather),
    ...p4Fields(view, economy, me, sides, holder, region, false, me, null, []),
    excessBp: excessWidthBp(def.width, width),
    encircled: view.regions.get(region)?.encircled ?? false,
  }).mods;
  const p = predictBattle(a.sum, def, {
    land,
    directions,
    attackerAttackBp: att.attackBp,
    attackerBlockBp: att.defenseBp,
    defenderAttackBp: dm.attackBp,
    defenderBlockBp: dm.defenseBp,
  });
  return {
    ratioPm: p.ratioPm,
    days: p.days,
    land,
    river,
    strait,
    fort,
    directions,
  };
}

/** The army's pace: its slowest division's template speed (spec §7.2). */
/** P4: a division of the army burns fuel to move (fuel battalions, spec §15.3). */
function armyUsesFuel(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
): boolean {
  const tech = techOf(economy, me);
  return divisionsOf(view, me, army).some((d) => {
    const t = templateOf(view, me, d.template);
    return (
      t !== null && templateStats(templateDef(t), tech, GEN1).fuelHourMilli > 0
    );
  });
}

function armySpeed(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
): number {
  const tech = techOf(economy, me);
  let speed = Number.MAX_SAFE_INTEGER;
  for (const d of divisionsOf(view, me, army)) {
    const t = templateOf(view, me, d.template);
    if (t === null) continue;
    speed = Math.min(
      speed,
      templateStats(templateDef(t), tech, GEN1).speedCenti,
    );
  }
  return speed === Number.MAX_SAFE_INTEGER ? 400 : speed;
}

/**
 * Spec §7.3–§7.5: the path an order would take and its ticks — on foot
 * over my side's regions (with that day's weather where the engine's
 * pathTicks plans on clear weather), by rail over railway regions, or
 * straight across the sea. Null when there is no way. `day` < 0: clear.
 */
export function movePreview(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  region: number,
  mode: "move" | "rail" | "sea",
  day = -1,
  sides: LandSides = sidesOf(view),
): { path: number[]; ticks: number } | null {
  const a = myArmy(view, me, army);
  const s = view.scenario;
  if (a === null || s.region(region) === undefined) return null;
  const from = a.region;
  if (mode === "sea") {
    return { path: [from, region], ticks: seaTicks(s.regionKm(from, region)) };
  }
  const ours = (r: number) => sides.sameSide(me, view.controller[r]);
  let pass: (r: number) => boolean;
  let cost: (edge: number, to: number) => number;
  if (mode === "rail") {
    const step = railStep(techOf(economy, me).railSpeedPct);
    pass = (r) => ours(r) && (economy.rail[r] ?? 0) >= 1;
    cost = (e) => edgeTicks(s.edge(e).km * 1000, step);
  } else {
    const speed = armySpeed(view, economy, me, army);
    const supply = a.mine?.supplyPm ?? 1000;
    // P4 (spec §14.6, §15.4): the engine's air and fuel cuts of a step.
    const p4 = landSeaAirOf(view);
    const fuel = armyUsesFuel(view, economy, me, army)
      ? (economy.summary(me)?.fuelRatioPm ?? 1000)
      : 1000;
    pass = ours;
    cost = (e, to) => {
      let step = moveStep(
        speed,
        economy.infra[to] ?? 1,
        day < 0 ? "clear" : weatherOf(s, to, day),
        supply,
        0,
      );
      const air = airMoveOf(p4, s, to, me);
      if (air !== 1000) step = Math.floor((step * air) / 1000);
      if (fuel < 1000) step = Math.floor((step * landFuelSpeedPm(fuel)) / 1000);
      return edgeTicks(moveNeed(s.edge(e), s.landOf(to)), step);
    };
  }
  const path = shortestPath(s, from, region, pass, cost);
  if (path.length === 0) return null;
  let ticks = 0;
  for (let i = 1; i < path.length; i++) {
    ticks += Math.max(1, cost(s.edgeBetween(path[i - 1], path[i]), path[i]));
  }
  return { path, ticks };
}

/** Spec §8.1: the front an army would hold from `anchor` (front mode's preview). */
export function frontPreview(
  view: WwLandView,
  me: number,
  army: number,
  anchor: number,
  sides: LandSides = sidesOf(view),
): number[] {
  const a = myArmy(view, me, army);
  if (a === null) return [];
  return frontOf(
    frontWorld(view, sides),
    me,
    0,
    anchor,
    frontSize(a.divisions),
  );
}

// ---- The battle card (spec §15.6) ----

export interface BattleCardData {
  summary: BattleSummary;
  land: LandTerrain;
  weather: Weather;
  /** The attacker's attack modifiers. */
  attackLines: ModLine[];
  /** The defender's defence modifiers. */
  defenseLines: ModLine[];
  /** I attack there with a division. */
  mine: boolean;
  /** My armies attacking there ("leave this battle" stops their plans). */
  leaveArmies: number[];
}

/**
 * Spec §15.6: with a division of mine in the battle, its own divisionMods
 * lines on its side; the other side (both, when I'm not in it) a
 * representative division's.
 */
export function battleCard(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  region: number,
  day: number,
  sides: LandSides = sidesOf(view),
): BattleCardData | null {
  const b = view.battles.get(region);
  if (b === undefined) return null;
  const s = view.scenario;
  const land = s.landOf(region);
  const weather = weatherOf(s, region, day);
  const fort = economy.effectiveBuildings("fort", region);
  const attackerOrigins = s
    .edgesOf(region)
    .map((e) => e.to)
    .filter((r) => sides.sameSide(b.attacker, view.controller[r]));
  let att: ModInput = {
    ...plainInput(true, land, weather),
    ...p4Fields(
      view,
      economy,
      me,
      sides,
      b.attacker,
      region,
      true,
      b.defender,
      null,
      [],
    ),
    ...crossing(s, attackerOrigins, region),
    fort,
    excessBp: excessWidthBp(b.attWidth, b.width),
  };
  let def: ModInput = {
    ...plainInput(false, land, weather),
    ...p4Fields(
      view,
      economy,
      me,
      sides,
      b.defender,
      region,
      false,
      b.attacker,
      null,
      [],
    ),
    excessBp: excessWidthBp(b.defWidth, b.width),
    encircled: view.regions.get(region)?.encircled ?? false,
  };
  const divs = (detailOf(view, me)?.divisions ?? [])
    .filter((d) => d.battle === region)
    .sort((x, y) => x.id - y.id);
  const tech = techOf(economy, me);
  const own = (d: DivisionData, attacking: boolean): ModInput | null => {
    const a = myArmy(view, me, d.army);
    if (a === null) return null;
    const t = templateOf(view, me, d.template);
    const ts = t === null ? null : templateStats(templateDef(t), tech, GEN1);
    const opponent = attacking ? b.defender : b.attacker;
    return {
      ...armyInput(
        view,
        economy,
        me,
        a,
        attacking,
        land,
        weather,
        region,
        sides,
        opponent,
      ),
      flags: ts?.flags ?? 0,
      exp: d.exp,
      supplyPm: d.supplyPm,
      ...p4Fields(
        view,
        economy,
        me,
        sides,
        me,
        region,
        attacking,
        opponent,
        ts,
        [d.id],
      ),
    };
  };
  const mineAtt = divs.find((d) => d.role === ROLE_ATTACK);
  const mineDef = divs.find((d) => d.role === ROLE_DEFEND);
  if (mineAtt !== undefined) {
    const x = own(mineAtt, true);
    if (x !== null) {
      att = {
        ...x,
        // Dropped in (paradrop): no crossing.
        ...crossing(s, [mineAtt.region], region),
        fort,
        excessBp: att.excessBp,
      };
    }
  }
  if (mineDef !== undefined) {
    const x = own(mineDef, false);
    if (x !== null) def = { ...x, excessBp: def.excessBp };
  }
  const leave = [
    ...new Set(divs.filter((d) => d.role === ROLE_ATTACK).map((d) => d.army)),
  ].sort((x, y) => x - y);
  return {
    summary: b,
    land,
    weather,
    attackLines: divisionMods(att).attackLines,
    defenseLines: divisionMods(def).defenseLines,
    mine: leave.length > 0,
    leaveArmies: leave,
  };
}

// ---- The region card (spec §15.7) ----

export interface RegionLandLines {
  land: LandTerrain;
  weather: Weather;
  fort: number;
  rail: number;
  /** My side's supply there and what its divisions use, milli; -1 off my side. */
  supplyMilli: number;
  useMilli: number;
  riverEdges: number;
  ours: number;
  theirs: number;
  encircled: boolean;
}

export function regionLandLines(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  region: number,
  day: number,
  sides: LandSides = sidesOf(view),
): RegionLandLines {
  const s = view.scenario;
  const r = view.regions.get(region);
  let ours = 0;
  let theirs = 0;
  for (const [id, n] of r?.counts ?? []) {
    if (sides.sameSide(me, id)) ours += n;
    else theirs += n;
  }
  const mySide = sides.sameSide(me, view.controller[region]);
  return {
    land: s.landOf(region),
    weather: weatherOf(s, region, day),
    fort: economy.effectiveBuildings("fort", region),
    rail: economy.rail[region] ?? 0,
    supplyMilli: mySide ? (r?.supplyMilli ?? -1) : -1,
    useMilli: mySide ? (r?.useMilli ?? -1) : -1,
    riverEdges: s.edgesOf(region).filter((e) => s.edge(e.edge).river > 0)
      .length,
    ours,
    theirs,
    encircled: r?.encircled ?? false,
  };
}

/** "■■■□□": a level out of five (forts). */
export function levelBoxes(level: number, max = 5): string {
  const n = Math.max(0, Math.min(max, level));
  return "■".repeat(n) + "□".repeat(max - n);
}

/** "●●○○○": a level out of five (railways). */
export function levelDots(level: number, max = 5): string {
  const n = Math.max(0, Math.min(max, level));
  return "●".repeat(n) + "○".repeat(max - n);
}

// ---- The template designer (spec §15.5 tab 3) ----

export interface DesignerData {
  stats: DivisionStats;
  xpCost: number;
  block: WwOrderBlock | null;
  factoryDays: number[];
}

/**
 * Pre-flight U-d: the days one military factory at base efficiency takes
 * to make one division's need of each type, EQUIPMENT_TYPES order.
 */
export function factoryDaysOf(stats: DivisionStats): number[] {
  return EQUIPMENT_TYPES.map((t, i) =>
    stats.need[i] === 0
      ? 0
      : Math.ceil((stats.need[i] * unitCostMilli(t, 1)) / WW_MIL_OUTPUT_MILLI),
  );
}

export function designer(
  before: TemplateDef | null,
  after: TemplateDef,
  tech: TechTotals,
  researched: ReadonlySet<WwTechId>,
  xpMilli: number,
): DesignerData {
  const stats = templateStats(after, tech, GEN1);
  const xpCost = templateXpCost(before, after);
  const block =
    templateBlock(after, researched, Infinity) ??
    (xpCost > xpMilli ? "no_xp" : null);
  return { stats, xpCost, block, factoryDays: factoryDaysOf(stats) };
}

/** "Infantry ×9 · Artillery ×2": a template's battalions, most first. */
export function battalionSummary(def: TemplateDef): string {
  return templateCounts(def)
    .map(([id, n]) => `${translateText(`ww1936.battalion.${id}`)} ×${n}`)
    .join(" · ");
}

// ---- The divisions and the training queue (spec §15.5 tabs 1, 2) ----

export interface DivisionRow {
  data: DivisionData;
  template: TemplateData | null;
  level: ExpLevel;
}

export function divisionRows(
  view: WwLandView,
  me: number,
  army: number,
): DivisionRow[] {
  return divisionsOf(view, me, army).map((d) => ({
    data: d,
    template: templateOf(view, me, d.template),
    level: expLevel(d.exp),
  }));
}

export interface TrainingRow {
  data: TrainingData;
  template: TemplateData | null;
  /** The first division in training: days done ÷ needed, 0..1. */
  progress: number;
  /** Its equipment fill, ‰ (what "waiting for equipment" shows). */
  fillPm: number;
}

export function trainingRows(view: WwLandView, me: number): TrainingRow[] {
  return (detailOf(view, me)?.training ?? []).map((t) => {
    const first = t.trainees[0];
    return {
      data: t,
      template: templateOf(view, me, t.template),
      progress:
        first === undefined || first.need <= 0
          ? 0
          : Math.min(1, first.days / first.need),
      fillPm: first?.fillPm ?? 0,
    };
  });
}

/**
 * The equipment the queue waits on (spec §15.5 tab 2's "short"): one
 * division's need of each type over the entries waiting for equipment (or
 * the first entry), beyond what the stockpile holds of every generation.
 */
export function shortTypes(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
): EquipmentType[] {
  const rows = trainingRows(view, me);
  const waiting = rows.filter((r) => r.data.waiting === "equipment");
  const pick = waiting.length > 0 ? waiting : rows.slice(0, 1);
  const tech = techOf(economy, me);
  const need = new Array<number>(EQUIPMENT_TYPES.length).fill(0);
  for (const r of pick) {
    if (r.template === null) continue;
    templateStats(templateDef(r.template), tech, GEN1).need.forEach(
      (n, i) => (need[i] += n),
    );
  }
  const stock = economy.detail(me)?.stock ?? [];
  const have = new Array<number>(EQUIPMENT_TYPES.length).fill(0);
  EQUIP_KEYS.forEach(([t], k) => {
    have[EQUIPMENT_TYPES.indexOf(t)] += stock[k] ?? 0;
  });
  return EQUIPMENT_TYPES.filter((_, i) => need[i] > have[i]);
}

/** The army new divisions join (the train order's `army`): the chosen one unless full. */
export function trainTarget(
  view: WwLandView,
  me: number,
  army: number | null,
): ArmySummary | null {
  const a = army === null ? null : myArmy(view, me, army);
  return a !== null && a.divisions < WW_MAX_ARMY_DIVISIONS ? a : null;
}

// ---- The generals (spec §15.5 tab 4) ----

export interface GeneralRowData {
  data: GeneralData;
  serving: boolean;
}

/** Whether a roster entry can serve on `day` (GeneralData.from/until, -1: open). */
export function generalServing(g: GeneralData, day: number): boolean {
  return (g.from < 0 || day >= g.from) && (g.until < 0 || day < g.until);
}

/** My roster: those who can serve first, each group in the engine's order. */
export function generalRows(
  view: WwLandView,
  me: number,
  day: number,
): GeneralRowData[] {
  const rows = (detailOf(view, me)?.generals ?? []).map((data) => ({
    data,
    serving: generalServing(data, day),
  }));
  return [...rows.filter((r) => r.serving), ...rows.filter((r) => !r.serving)];
}

// ---- The ⚔ dial (spec §15.1) ----

export interface ArmyDialModel {
  /** The first division in training, 0..1. */
  progress: number;
  training: number;
  /** My armies in a battle; my encircled armies (the badge shows these, blinking). */
  fighting: number;
  encircled: number;
}

export function armyDial(view: WwLandView, me: number): ArmyDialModel {
  const rows = trainingRows(view, me);
  let fighting = 0;
  let encircled = 0;
  for (const a of view.armiesOf(me)) {
    if (a.state & ARMY_ENCIRCLED) encircled++;
    if (a.state & ARMY_BATTLE) fighting++;
  }
  return {
    progress: rows[0]?.progress ?? 0,
    training: rows.length,
    fighting,
    encircled,
  };
}

// ---- The diplomacy drawer (spec §13.3) ----

/** Enemies my side touches nowhere on land: no front until landings (P4). */
export function isOverseas(
  view: WwLandView,
  me: number,
  enemy: number,
  sides: LandSides = sidesOf(view),
): boolean {
  return borderRegionsOf(frontWorld(view, sides), me, enemy).length === 0;
}
