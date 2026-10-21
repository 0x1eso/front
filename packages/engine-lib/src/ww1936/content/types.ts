// World War 1936 P3 (spec §20): the content types, re-exported for the data
// files (plan decision 6: content ids are strings, checked by the tests).
export type {
  Condition,
  Effect,
  LeafCondition,
  RegionPick,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
export type {
  AiWeight,
  BeatAct,
  BranchPoint,
  ClaimDef,
  CountryPoliticsDef,
  DecisionCost,
  DecisionDef,
  DecisionId,
  EventDef,
  EventId,
  FactionNameDef,
  FlagId,
  FocusDef,
  FocusId,
  HistoryBeat,
  OptionDef,
  PersonDef,
  PersonId,
  RegionGroupDef,
  RegionGroupId,
  SpiritDef,
  SpiritId,
  SpiritRule,
  TemplateUnlockDef,
  TraitDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
// P6 (plan Task 1 Step 20): the depth content shapes.
export type {
  AgencyStartDef,
  AiDesignPreset,
  ContinuousFocus,
  FocusPackDef,
  NukeTargetDef,
  ScientistDef,
  StartDoctrineDef,
  StartFmDef,
} from "@openfront/engine-api/ww1936/DepthTypes";
// P5 (plan decisions 29, 30): the endgame content shapes.
export type {
  CivilWarSeedDef,
  CoreDef,
  OccupationDefaultDef,
  PeaceDefaultDef,
  PeaceDefaultDemand,
  PeaceDefaultLine,
} from "@openfront/engine-api/ww1936/EndgameTypes";

/**
 * The white silhouette icons a focus or a spirit may name
 * (resources/images/ww1936/focus/<icon>.svg, drawn by Task 7).
 */
export const FOCUS_ICONS = [
  "industry",
  "factory",
  "factory_mil",
  "rail",
  "road",
  "research",
  "flask",
  "radio",
  "infantry",
  "tank",
  "artillery",
  "fort",
  "plane",
  "bomber",
  "ship",
  "submarine",
  "carrier",
  "handshake",
  "document",
  "flag",
  "scales",
  "megaphone",
  "map",
  "crown",
  "ballot",
  "fist",
  "eagle_plain",
  "wheat",
  "oil",
  "steel",
  "mine",
  "globe",
  "shield",
  "sword",
  "medal",
  "star_plain",
  "tower",
  "dove",
  "chain_broken",
  "compass",
] as const;
export type FocusIcon = (typeof FOCUS_ICONS)[number];
