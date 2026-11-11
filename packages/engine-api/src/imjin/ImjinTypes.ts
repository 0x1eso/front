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
  // ww177 merge 3, appended: a small boat of a fleet in battle is set
  // alight (the engine picks the one nearest the enemy), and the fleet
  // sails with its side's nearest supply convoys.
  "fire_ship",
  "escort",
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
  /**
   * ww177 merge 3: `current`, the channel current's id (0: none); while it
   * runs, `turnIn` ticks to its next turn and `flow` 1 with its axis, -1
   * against; `shores`, the owner of both its shores when one side holds
   * them (0: nobody). Design §6.2: only that side's screen shows the turn.
   */
  battles: {
    id: number;
    cx: number;
    cy: number;
    current: number;
    turnIn: number;
    flow: number;
    shores: number;
  }[];
  /** ww177 merge 3: [sea zone, blows to (binary angle), strength] over each zone a fleet is in. */
  winds: number[][];
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
  /** ww177 P7a: the war's end, once the state or the calendar gives it. */
  ending: ImjinEndingCard | null;
}

/**
 * ww177 P7a (design §10): the ending cards the state gives, in plain words
 * on the client (append only).
 */
export const IMJIN_ENDINGS = [
  "partition",
  "investiture_peace",
  "expulsion",
  "court_in_exile",
  "japan_in_liaodong",
  "truce_held",
  "second_war",
] as const;
export type ImjinEnding = (typeof IMJIN_ENDINGS)[number];

/** Why the game ended: the calendar, or earlier by state (append only). */
export const IMJIN_END_CAUSES = [
  "calendar",
  "capitulation",
  "expelled",
  "treaty",
] as const;
export type ImjinEndCause = (typeof IMJIN_END_CAUSES)[number];

/** The end of an Imjin game, as the end card reads it. */
export interface ImjinEndingCard {
  ending: ImjinEnding;
  cause: ImjinEndCause;
  /** The game day and its date (the profile's calendar). */
  day: number;
  year: number;
  month: number;
  /** Each side's aims met. */
  jos: boolean;
  jpn: boolean;
  min: boolean;
  /** Per mille of Korea's regions Japan held at the end. */
  jpnHeldPm: number;
  /** The Joseon court's seat (CourtRules.SEAT_*). */
  seat: number;
  /** Ming's silver spent and its limit, thousands of taels. */
  silver: number;
  silverLimit: number;
  /** Ming's regions Japan held. */
  liaodong: number;
}
