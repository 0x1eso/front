// The Imjin War's screens (ww177 merge 1): what WwImjin sends the client
// (GameUpdateType.WwImjin) when its sea layer, land orders or sieges change.
// Positions are milli-tiles; indices are SeaRules' and LandRules' lists.

/** The tile fleet orders a player gives (the imjin_fleet order). */
export const IMJIN_FLEET_ORDERS = [
  "move",
  "hold",
  "board",
  "keep_range",
  "break_off",
  "lure",
  "formation",
] as const;
export type ImjinFleetOrder = (typeof IMJIN_FLEET_ORDERS)[number];

/** SeaRules.FORMATIONS, in order. */
export const IMJIN_FORMATIONS = [
  "line",
  "column",
  "crane",
  "wedge",
  "loose",
] as const;

/** SeaRules.SHIP_KINDS, in order (the client's silhouettes). */
export const IMJIN_SHIP_KINDS = [
  "panokseon",
  "turtle",
  "hyeopseon",
  "atakebune",
  "sekibune",
  "kobaya",
  "fuchuan",
  "shachuan",
  "transport",
] as const;

export interface ImjinData {
  fleets: {
    id: number;
    owner: number;
    x: number;
    y: number;
    heading: number;
    ships: number;
    order: string;
    formation: string;
    morale: number;
    battle: number;
    target: number;
    hullPm: number;
  }[];
  /** [id, fleet, owner, x, y, heading, kind, fire]. */
  ships: number[][];
  battles: { id: number; cx: number; cy: number }[];
  groups: {
    id: number;
    owner: number;
    x: number;
    y: number;
    convoys: number;
  }[];
  orders: {
    region: number;
    att: number;
    def: number;
    pendAtt: number;
    pendDef: number;
    edge: number;
    ambushed: number;
  }[];
  sieges: { region: number; grainDays: number; fort: number; morale: number }[];
}
