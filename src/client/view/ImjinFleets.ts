// ww177 merge 1 (Imjin design §6.2): the Imjin War's tile fleets as the
// screens read them. Each fleet is shown as a 1936 fleet summary at its own
// tile position (the fleet token and card frames stay), with an id moved
// past every 1936 fleet's so the two never meet. P3 polishes the look.
import type { ImjinData } from "@openfront/engine-api/imjin/ImjinTypes";
import { IMJIN_SHIP_KINDS } from "@openfront/engine-api/imjin/ImjinTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type {
  FleetSummary,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/** A tile fleet's id on the screens: its engine id plus this. */
export const IMJIN_FLEET_ID_BASE = 1_000_000;
/** Milli-tiles a tile (SeaRules.MT). */
export const IMJIN_MT = 1000;
/** Gun range in tiles (SeaRules.GUN_RANGE_MT), the selected fleet's circle. */
export const IMJIN_GUN_RANGE_TILES = 4;

export function isImjinFleet(id: number): boolean {
  return id > IMJIN_FLEET_ID_BASE;
}

/** The 1936 silhouette each era hull is drawn with. */
const CLASS_OF_KIND: Readonly<
  Record<(typeof IMJIN_SHIP_KINDS)[number], ShipClass>
> = {
  panokseon: "ca",
  turtle: "bb",
  hyeopseon: "dd",
  atakebune: "bb",
  sekibune: "cl",
  kobaya: "dd",
  fuchuan: "ca",
  shachuan: "cl",
  transport: "dd",
};

export function classOfKind(kind: number): ShipClass {
  return CLASS_OF_KIND[IMJIN_SHIP_KINDS[kind] ?? "transport"] ?? "dd";
}

/** The tile fleets as fleet summaries, by screen id. */
export function imjinFleetSummaries(
  d: ImjinData,
  sc: ScenarioIndex,
): FleetSummary[] {
  const counts = new Map<number, number[]>();
  for (const s of d.ships) {
    const fleet = s[1];
    let c = counts.get(fleet);
    if (c === undefined) {
      c = SHIP_CLASSES.map(() => 0);
      counts.set(fleet, c);
    }
    c[SHIP_CLASSES.indexOf(classOfKind(s[6]))]++;
  }
  return d.fleets.map((f) => {
    const tx = Math.floor(f.x / IMJIN_MT);
    const ty = Math.floor(f.y / IMJIN_MT);
    const tile = ty * sc.width + tx;
    return {
      id: IMJIN_FLEET_ID_BASE + f.id,
      owner: f.owner,
      nameIdx: 0,
      num: f.id,
      counts: counts.get(f.id) ?? SHIP_CLASSES.map(() => 0),
      hpPm: f.hullPm,
      orgPm: f.morale,
      zone: tile >= 0 && tile < sc.width * sc.height ? sc.regionAt(tile) : 0,
      docked: 0,
      path: [],
      progPm: 0,
      stepPm: 0,
      mission: "hold",
      missionSr: 0,
      state:
        f.battle !== 0 ? "battle" : f.target >= 0 ? "moving" : "on_station",
      flags: 0,
      admiral: 0,
      engage: f.order === "keep_range" ? "if_stronger" : "always",
      returnAtPct: 50,
      ships: [],
    };
  });
}

/** An Imjin fleet order for the screen fleet `id`. */
export function imjinFleetOrder(
  id: number,
  order: Extract<WwOrder, { kind: "imjin_fleet" }>["order"],
  opts: {
    tile?: number;
    formation?: Extract<WwOrder, { kind: "imjin_fleet" }>["formation"];
  } = {},
): WwOrder {
  return {
    kind: "imjin_fleet",
    fleet: id - IMJIN_FLEET_ID_BASE,
    order,
    tile: opts.tile ?? 0,
    formation: opts.formation ?? "line",
  };
}
