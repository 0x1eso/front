// World War 1936 P2 (spec §15): what the land screens draw, as plain data
// from the views. No Lit here: the screens render it and the tests read
// it. STUB: Task 8 writes the bodies; the names and shapes are final.
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  BattleSummary,
  DivisionStats,
  GeneralData,
  LandTerrain,
  ModLine,
  TemplateDef,
  Weather,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  GEN1,
  templateBlock,
  templateStats,
  templateXpCost,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { TechTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";

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

export function armyRows(view: WwLandView, me: number): ArmyRowData[] {
  return [];
}

export interface ArmyCardData {
  row: ArmyRowData;
  status: { key: string; params: Record<string, string | number> };
  planBp: number;
  supplyPm: number;
  buttons: { id: string; block: WwOrderBlock | null }[];
}

export function armyCard(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  day: number,
): ArmyCardData | null {
  return null;
}

export interface AttackPreviewData {
  ratioPm: number;
  days: number;
  land: LandTerrain;
  river: 0 | 1 | 2;
  strait: boolean;
  fort: number;
  directions: number;
}

export function attackPreview(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  region: number,
  day: number,
): AttackPreviewData | null {
  return null;
}

export function movePreview(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  army: number,
  region: number,
  mode: "move" | "rail" | "sea",
): { path: number[]; ticks: number } | null {
  return null;
}

export function frontPreview(
  view: WwLandView,
  me: number,
  army: number,
  anchor: number,
): number[] {
  return [];
}

export interface BattleCardData {
  summary: BattleSummary;
  land: LandTerrain;
  weather: Weather;
  attackLines: ModLine[];
  defenseLines: ModLine[];
  mine: boolean;
}

export function battleCard(
  view: WwLandView,
  economy: WwEconomyView,
  me: number,
  region: number,
  day: number,
): BattleCardData | null {
  return null;
}

export interface RegionLandLines {
  land: LandTerrain;
  weather: Weather;
  fort: number;
  rail: number;
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
): RegionLandLines {
  return {
    land: view.scenario.landOf(region),
    weather: "clear",
    fort: 0,
    rail: 0,
    supplyMilli: 0,
    useMilli: 0,
    riverEdges: 0,
    ours: 0,
    theirs: 0,
    encircled: false,
  };
}

export interface DesignerData {
  stats: DivisionStats;
  xpCost: number;
  block: WwOrderBlock | null;
  factoryDays: number[];
}

export function designer(
  before: TemplateDef | null,
  after: TemplateDef,
  tech: TechTotals,
  researched: ReadonlySet<WwTechId>,
  xpMilli: number,
): DesignerData {
  return {
    stats: templateStats(after, tech, GEN1),
    xpCost: templateXpCost(before, after),
    block: templateBlock(after, researched, Infinity),
    factoryDays: [],
  };
}

export interface GeneralRowData {
  data: GeneralData;
  serving: boolean;
}

export function generalRows(
  view: WwLandView,
  me: number,
  day: number,
): GeneralRowData[] {
  return [];
}
