// ww229 (design ww227 §6, owner D2): a minor's own catalogue entry is
// converted like a major's, then each fight number is held in a band: never
// below the generic number of its key (what the minor had without it), never
// above the median of the majors' entries of the same kind and generation.
// Costs, speed, range and reliability stay the real ones. The majors' numbers
// are never touched, so nothing of theirs moves.
import type {
  PlaneDesignStats,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { KS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { ShipStats } from "@openfront/engine-api/ww1936/NavyTypes";
import { shipStats } from "../ShipStats";
import { emptyStats } from "../Stats";
import { genOfTechs } from "./ConvertCost";
import type { GearStats } from "./ConvertGear";
import {
  gunStatsOfEntry,
  infantryStatsOfEntry,
  supportStatsOfEntry,
} from "./ConvertGear";
import { planeStatsOfEntry } from "./ConvertPlane";
import { shipStatsOfEntry } from "./ConvertShip";
import { tankStatsOfEntry } from "./ConvertTank";
import { HIST_MAJOR_ALL } from "./index";
import type {
  GunEntry,
  HistEntry,
  InfantryEntry,
  PlaneEntry,
  ShipEntry,
  SupportEntry,
  TankEntry,
} from "./Types";
import {
  weakGearPct,
  weakGroundField,
  weakPlaneNumbers,
  weakShipStats,
} from "./WeakGeneric";

const TANK_FIGHT = [
  "soft",
  "hard",
  "def",
  "brk",
  "pierce",
  "armor",
  "aa",
] as const satisfies readonly (keyof TankDesignStats)[];
const TANK_KS: Readonly<Record<(typeof TANK_FIGHT)[number], number>> = {
  soft: KS.soft,
  hard: KS.hard,
  def: KS.def,
  brk: KS.brk,
  pierce: KS.pierce,
  armor: KS.armor,
  aa: KS.aa,
};
const PLANE_FIGHT = [
  "airAttack",
  "airDefense",
  "agility",
  "ground",
  "strategic",
  "naval",
] as const satisfies readonly (keyof PlaneDesignStats)[];
const SHIP_FIGHT = [
  "hpMilli",
  "light",
  "lightPierce",
  "heavy",
  "heavyPierce",
  "torpedo",
  "depth",
  "armor",
  "aa",
] as const satisfies readonly (keyof ShipStats)[];
const GEAR_FIGHT = ["statPct", "pierceCenti"] as const;

const planePrefix = (type: string): string =>
  type.startsWith("cv_") ? type.slice(3) : type;

/** The comparison group of an entry: family, kind and generation. */
export function clampGroupOf(e: HistEntry): string {
  switch (e.family) {
    case "tank":
      return `tank:${e.role}:${e.techs[0] ?? ""}`;
    case "plane":
      return `plane:${e.type}:${genOfTechs(e.techs, planePrefix(e.type))}`;
    case "ship":
      return `ship:${e.cls}:${genOfTechs(e.techs, e.cls)}`;
    case "infantry":
      return `infantry::${e.techs[0] ?? ""}`;
    case "support":
      return `support:${e.spec.kind}:${e.techs[0] ?? ""}`;
    case "gun":
      return `gun:${e.role}:${e.techs[0] ?? ""}`;
  }
}

/** The group without its generation (the fallback when no major has the generation). */
const kindOf = (group: string): string =>
  group.slice(0, group.lastIndexOf(":"));

function median(v: readonly number[]): number | undefined {
  if (v.length === 0) return undefined;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

type Nums = Readonly<Record<string, number>>;

function majorNumbers(e: HistEntry): Nums {
  switch (e.family) {
    case "tank":
      return tankStatsOfEntry(e) as unknown as Nums;
    case "plane":
      return planeStatsOfEntry(e) as unknown as Nums;
    case "ship":
      return shipStatsOfEntry(e) as unknown as Nums;
    case "infantry":
      return infantryStatsOfEntry(e) as unknown as Nums;
    case "support":
      return supportStatsOfEntry(e) as unknown as Nums;
    case "gun":
      return gunStatsOfEntry(e) as unknown as Nums;
  }
}

let BY_GROUP: Map<string, Nums[]> | undefined;
let BY_KIND: Map<string, Nums[]> | undefined;

function groups(): [Map<string, Nums[]>, Map<string, Nums[]>] {
  if (BY_GROUP === undefined || BY_KIND === undefined) {
    BY_GROUP = new Map();
    BY_KIND = new Map();
    for (const e of HIST_MAJOR_ALL) {
      const g = clampGroupOf(e);
      const n = majorNumbers(e);
      for (const [m, k] of [
        [BY_GROUP, g],
        [BY_KIND, kindOf(g)],
      ] as const) {
        const l = m.get(k);
        if (l === undefined) m.set(k, [n]);
        else l.push(n);
      }
    }
  }
  return [BY_GROUP, BY_KIND];
}

/** The majors' median of `field` for the entry's group (its kind when no major has the generation). */
export function majorCeiling(e: HistEntry, field: string): number | undefined {
  const [byGroup, byKind] = groups();
  const g = clampGroupOf(e);
  const list = byGroup.get(g) ?? byKind.get(kindOf(g)) ?? [];
  return median(list.map((n) => n[field]).filter((v) => v !== undefined));
}

function band(v: number, floor: number | undefined, ceil: number | undefined) {
  let out = v;
  if (floor !== undefined) out = Math.max(out, floor);
  if (ceil !== undefined) out = Math.min(out, ceil);
  return out;
}

function clampFields<T extends object>(
  e: HistEntry,
  s: T,
  fields: readonly string[],
  floorOf: (f: string) => number | undefined,
): T {
  const out = { ...s };
  const rec = out as unknown as Record<string, number>;
  for (const f of fields) {
    rec[f] = band(rec[f], floorOf(f), majorCeiling(e, f));
  }
  return out;
}

export function clampMinorTank<T extends TankDesignStats>(
  e: TankEntry,
  s: T,
): T {
  const key =
    e.role === "light"
      ? "light_tank"
      : e.role === "medium"
        ? "medium_tank"
        : null;
  const gen = key === null ? 0 : genOfTechs(e.techs, key);
  return clampFields(e, s, TANK_FIGHT, (f) =>
    key === null ? undefined : weakGroundField(key, gen, TANK_KS[f as keyof typeof TANK_KS]),
  );
}

export function clampMinorPlane(
  e: PlaneEntry,
  s: PlaneDesignStats,
): PlaneDesignStats {
  const n = weakPlaneNumbers(
    e.type as AirType,
    genOfTechs(e.techs, planePrefix(e.type)),
  );
  const floor: Readonly<Record<(typeof PLANE_FIGHT)[number], number>> = {
    airAttack: n.airAtk,
    airDefense: n.airDef,
    agility: n.agility,
    ground: n.ground,
    strategic: n.strat,
    naval: n.naval,
  };
  return clampFields(
    e,
    s,
    PLANE_FIGHT,
    (f) => floor[f as keyof typeof floor],
  );
}

export function clampMinorShip(e: ShipEntry, s: ShipStats): ShipStats {
  const gen = genOfTechs(e.techs, e.cls);
  const generic = weakShipStats(
    shipStats(e.cls, gen, emptyStats(), new Set()),
    e.cls,
    gen,
  );
  return clampFields(
    e,
    s,
    SHIP_FIGHT,
    (f) => (generic as unknown as Record<string, number>)[f],
  );
}

export function clampMinorGear(
  e: InfantryEntry | SupportEntry | GunEntry,
  s: GearStats,
): GearStats {
  const key =
    e.family === "gun"
      ? e.role
      : e.family === "infantry"
        ? "infantry_equipment"
        : null;
  const prefix =
    e.family === "gun" ? e.role : e.family === "infantry" ? "inf_eq" : "";
  const gen = genOfTechs(e.techs, prefix);
  return clampFields(e, s, GEAR_FIGHT, (f) => {
    if (key === null) return undefined;
    if (f === "statPct") return weakGearPct(key, gen);
    return s.pierceCenti > 0
      ? weakGroundField(key, gen, KS.pierce)
      : undefined;
  });
}
