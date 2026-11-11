// World War 1936 P4 (plan decision 40): the navy and air HUD's shared
// state — the chosen fleet and air zone, the map layer, the tap mode —
// and the events that change it. Lanes R and U read it.

/** Which map layer shows (spec §18.2). */
export type SeaAirLayer = "none" | "sea" | "air";
/** The map lenses that colour land regions (the lens button's list). */
export const REGION_LENSES = [
  "terrain",
  "vp",
  "weather",
  "supply",
  "defence",
  "resources",
  "industry",
  "occupation",
  "diplomacy",
] as const;
export type RegionLens = (typeof REGION_LENSES)[number];
/** Resource chip of the resources lens: "" shows every resource. */
export type LensResource = "" | (typeof LENS_RESOURCES)[number];
export const LENS_RESOURCES = [
  "oil",
  "aluminium",
  "rubber",
  "tungsten",
  "steel",
  "chromium",
  "uranium",
  "coal",
] as const;
/** What the diplomacy lens colours by. */
export type LensDiplo = "faction" | "ideology";
/** What the next map tap means (spec §18.3). */
export type SeaAirTapMode =
  | "mission"
  | "move"
  | "port_strike"
  | "merge"
  | "invade"
  // ww177 P3: an Imjin fleet's decoy (lure) runs for the sea tile tapped.
  | "lure";

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
  /** The land-region lens on ("none": off). Sea and air (`layer`) exclude it. */
  regionLens: RegionLens | "none" = "none";
  lensResource: LensResource = "";
  lensDiplo: LensDiplo = "faction";
  tapMode: SeaAirTapMode = "mission";
  /**
   * ww177 P3: a heading drag from the chosen Imjin fleet (tiles, from the
   * fleet to the pointer) while it lasts; the map draws it as an arrow.
   */
  aim: { fx: number; fy: number; x: number; y: number } | null = null;
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
    if (layer !== "none") this.regionLens = "none";
    this.version++;
  }
  /** One lens at a time: a region lens switches the sea and air layers off. */
  setRegionLens(lens: RegionLens | "none"): void {
    if (lens === this.regionLens && (lens !== "none" || this.layer === "none"))
      return;
    this.regionLens = lens;
    this.layer = "none";
    this.version++;
  }
  setLensResource(r: LensResource): void {
    this.lensResource = r;
    this.version++;
  }
  setLensDiplo(d: LensDiplo): void {
    this.lensDiplo = d;
    this.version++;
  }
  setAim(aim: SeaAirSelection["aim"]): void {
    this.aim = aim;
    this.version++;
  }

  setTapMode(mode: SeaAirTapMode): void {
    this.tapMode = mode;
    this.version++;
  }
}
