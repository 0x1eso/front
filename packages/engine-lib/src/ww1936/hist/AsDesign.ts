// World War 1936 historical catalogue: a catalogue entry as a design slot.
// A DesignDef with `hist` set takes its numbers from the entry; the tank and
// plane stats are the design stats themselves, a ship's are expressed as
// the percent modifiers over the class's generation-1 base that ship designs
// already use (ShipDesignMods), plus `add` where that base is 0.
import type {
  DesignDef,
  PlaneDesignStats,
  ShipDesignMods,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { SHIP_BASE } from "../ShipStats";
import { planeStatsOfEntry } from "./ConvertPlane";
import { shipStatsOfEntry } from "./ConvertShip";
import { tankStatsOfEntry } from "./ConvertTank";
import { histEntry } from "./index";
import { roundInt } from "./Num";
import type { ShipEntry } from "./Types";

const pct = (abs: number, base: number): number =>
  base <= 0 ? 0 : Math.max(-90, roundInt((abs * 100) / base) - 100);

export function histShipMods(e: ShipEntry): ShipDesignMods {
  const s = shipStatsOfEntry(e);
  const b = SHIP_BASE[e.cls];
  const add: NonNullable<ShipDesignMods["add"]> = {};
  const fix = (
    key: "light" | "heavy" | "torpedo" | "depth" | "armor" | "aa",
    abs: number,
    base: number,
  ) => {
    // Base stats are points; the stats table is centi.
    if (base <= 0 && abs > 0) add[key] = abs;
  };
  fix("light", s.light, b.light);
  fix("heavy", s.heavy, b.heavy);
  fix("torpedo", s.torpedo, b.torpedo);
  fix("depth", s.depth, b.depth);
  fix("armor", s.armor, b.armor);
  fix("aa", s.aa, b.aa);
  if (b.lightPierce <= 0 && s.lightPierce > 0) add.lightPierce = s.lightPierce;
  if (b.heavyPierce <= 0 && s.heavyPierce > 0) add.heavyPierce = s.heavyPierce;
  const pierceAbs = b.heavy > 0 && s.heavy > 0 ? s.heavyPierce : s.lightPierce;
  const pierceBase = b.heavy > 0 && s.heavy > 0 ? b.heavyPierce : b.lightPierce;
  return {
    kind: "ship",
    lightPct: pct(s.light, b.light * 100),
    heavyPct: pct(s.heavy, b.heavy * 100),
    torpedoPct: pct(s.torpedo, b.torpedo * 100),
    depthPct: pct(s.depth, b.depth * 100),
    aaPct: pct(s.aa, b.aa * 100),
    armorPct: pct(s.armor, b.armor * 100),
    hpPct: pct(s.hpMilli, b.hp * 1000),
    piercePct: pct(pierceAbs, pierceBase * 100),
    deckPct: e.cls === "cv" ? pct(s.deck, 40) : 0,
    damageTakenPct: 0,
    surfDetectPct: 0,
    subDetectPct: 0,
    visPct: 0,
    rangePct: pct(s.rangeKm, b.rangeKm),
    fuelPct: 0,
    hitPct: 0,
    speedCentiKn: s.speedCentiKn - b.speedKn * 100,
    costPct: pct(s.cost, b.cost),
    flags: 0,
    year: e.year,
    ...(Object.keys(add).length > 0 ? { add } : {}),
  };
}

/** The stats of a design slot that holds a catalogue entry (null: unknown id or wrong kind). */
export function histDesignStats(
  def: DesignDef,
  ctx: { relPp: number; costPct: number } = { relPp: 0, costPct: 0 },
): TankDesignStats | ShipDesignMods | PlaneDesignStats | null {
  const e = def.hist === undefined ? undefined : histEntry(def.hist);
  if (e === undefined) return null;
  // The country's MIO cost and reliability points apply as to any design.
  const cost = (v: number) =>
    Math.floor((v * (100 + Math.max(-90, ctx.costPct))) / 100);
  const rel = (v: number) => Math.max(400, Math.min(990, v + ctx.relPp * 10));
  if (e.family === "tank" && def.kind === "tank") {
    const s = tankStatsOfEntry(e);
    return { ...s, costMilli: cost(s.costMilli), relPm: rel(s.relPm) };
  }
  if (e.family === "plane" && def.kind === "plane") {
    const s = planeStatsOfEntry(e);
    return { ...s, costMilli: cost(s.costMilli), relPm: rel(s.relPm) };
  }
  if (e.family === "ship" && def.kind === "ship") return histShipMods(e);
  return null;
}
