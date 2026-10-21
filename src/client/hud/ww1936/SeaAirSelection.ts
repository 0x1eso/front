// World War 1936 P4 (plan decision 40): the navy and air HUD's shared
// state — the chosen fleet and air zone, the map layer, the tap mode —
// and the events that change it. Lanes R and U read it.

/** Which map layer shows (spec §18.2). */
export type SeaAirLayer = "none" | "sea" | "air";
/** What the next map tap means (spec §18.3). */
export type SeaAirTapMode =
  | "mission"
  | "move"
  | "port_strike"
  | "merge"
  | "invade";

/** The sea or air layer was switched (the dials). */
export class WwSeaLayerEvent {
  constructor(public readonly on: boolean) {}
}
export class WwAirLayerEvent {
  constructor(public readonly on: boolean) {}
}
/** A fleet was chosen (0: none). */
export class WwFleetSelectedEvent {
  constructor(public readonly fleet: number) {}
}
/** An air zone was chosen (strategic region id, 0: none). */
export class WwAirZoneSelectedEvent {
  constructor(public readonly sr: number) {}
}

export class SeaAirSelection {
  fleet = 0;
  sr = 0;
  layer: SeaAirLayer = "none";
  tapMode: SeaAirTapMode = "mission";
  /** Bumped on every change; screens redraw when it moves. */
  version = 0;

  selectFleet(fleet: number): void {
    this.fleet = fleet;
    this.version++;
  }
  selectZone(sr: number): void {
    this.sr = sr;
    this.version++;
  }
  setLayer(layer: SeaAirLayer): void {
    this.layer = layer;
    this.version++;
  }
  setTapMode(mode: SeaAirTapMode): void {
    this.tapMode = mode;
    this.version++;
  }
}
