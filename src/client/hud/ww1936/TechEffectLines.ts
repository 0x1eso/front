// World War 1936: the lines of a research card's detail. Everything a tech
// really does, read from the tables the rules read (equipment generations,
// battalions, buildings, special projects, the designers' module and chassis
// tables, the tech's stat effects), plus a small table of rules the engine
// hard-codes by tech id. No Lit here. This file imports nothing from
// EconomyModel (which re-exports it), so the two never form a cycle.
import type { SpecialProject } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_TECH,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WW_TECH_IDS,
  type EquipmentType,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BATTALION_IDS,
  SUPPORT_IDS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES, SHIP_GENS } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { BATTALIONS, SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import {
  PLANE_BASE_DEFS,
  PLANE_MODULE_DEFS,
  SHIP_MODULE_DEFS,
  TANK_BASE_DEFS,
  TANK_MODULE_DEFS,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { EQUIPMENT, genTech } from "@openfront/engine-lib/ww1936/Equipment";
import { PROJECT_DEFS } from "@openfront/engine-lib/ww1936/ProjectRules";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";

/** P2 (pre-flight T-b): the line of a land tech that opens a battalion or a company. */
export const UNLOCK_UNIT_KEY = "ww1936.effect.unlock_unit";
/** The line of a tech that opens an equipment generation. */
export const UNLOCK_EQUIPMENT_KEY = "ww1936.effect.unlock";
/** A tech that does nothing of its own yet. */
export const NO_EFFECT_KEY = "ww1936.techfx.none";

/** The equipment generation a tech opens, if it opens one. */
export function techUnlock(
  tech: WwTechId,
): { equipment: EquipmentType; gen: number } | null {
  for (const equipment of EQUIPMENT_TYPES) {
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      if (genTech(equipment, gen) === tech) return { equipment, gen };
    }
  }
  return null;
}

/**
 * The battalions and support companies a tech that opens no equipment
 * generation lets templates use (P2's land techs: mountaineers, marines,
 * paratroopers and the companies), as their names.
 */
export function techUnits(tech: WwTechId): string[] {
  if (techUnlock(tech) !== null) return [];
  return [
    ...BATTALION_IDS.filter((id) => BATTALIONS[id].techs.includes(tech)).map(
      (id) => translateText(`ww1936.battalion.${id}`),
    ),
    ...SUPPORT_IDS.filter((id) => SUPPORTS[id].techs.includes(tech)).map((id) =>
      translateText(`ww1936.support.${id}`),
    ),
  ];
}

const CARRIER_TYPES: ReadonlySet<EquipmentType> = new Set([
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
]);

/** Every equipment generation a tech opens, carrier planes aside (their own rule line). */
export function techEquipment(
  tech: WwTechId,
): { equipment: EquipmentType; gen: number }[] {
  const out: { equipment: EquipmentType; gen: number }[] = [];
  for (const equipment of EQUIPMENT_TYPES) {
    if (CARRIER_TYPES.has(equipment)) continue;
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      if (genTech(equipment, gen) === tech) out.push({ equipment, gen });
    }
  }
  return out;
}

/** The ship class and generation a tech `<cls>_<gen>` opens (naval lines and the ship designer). */
export function techShip(tech: WwTechId): { cls: string; gen: number } | null {
  const m = /^([a-z]+)_(\d)$/.exec(tech);
  if (m === null) return null;
  const cls = m[1];
  const gen = Number(m[2]);
  if (!(SHIP_CLASSES as readonly string[]).includes(cls)) return null;
  const max = SHIP_GENS[cls as (typeof SHIP_CLASSES)[number]];
  return gen >= 2 && gen <= max ? { cls, gen } : null;
}

/** The designer parts a tech opens, from the designers' tables. */
export interface TechParts {
  tankModules: string[];
  tankChassis: string[];
  shipModules: { id: string; project?: SpecialProject }[];
  planeModules: string[];
  planeChassis: { id: string; project?: SpecialProject }[];
}

export function techParts(tech: WwTechId): TechParts {
  const ids = <T extends { tech?: WwTechId }>(t: Readonly<Record<string, T>>) =>
    Object.entries(t)
      .filter(([, d]) => d.tech === tech)
      .map(([id]) => id);
  return {
    tankModules: ids(TANK_MODULE_DEFS),
    tankChassis: ids(TANK_BASE_DEFS),
    shipModules: Object.entries(SHIP_MODULE_DEFS)
      .filter(([, d]) => d.tech === tech)
      .map(([id, d]) => ({
        id,
        ...(d.project === undefined ? {} : { project: d.project }),
      })),
    planeModules: ids(PLANE_MODULE_DEFS),
    planeChassis: Object.entries(PLANE_BASE_DEFS)
      .filter(([, d]) => d.tech === tech)
      .map(([id, d]) => ({
        id,
        ...(d.project === undefined ? {} : { project: d.project }),
      })),
  };
}

/** Buildings a tech opens (BUILDING_TECH). */
export function techBuildings(tech: WwTechId): string[] {
  return Object.entries(BUILDING_TECH)
    .filter(([, t]) => t === tech)
    .map(([b]) => b);
}

/** Special projects a tech is a condition of (PROJECT_DEFS). */
export function techProjects(tech: WwTechId): SpecialProject[] {
  return (Object.entries(PROJECT_DEFS) as [SpecialProject, { techs: readonly WwTechId[] }][])
    .filter(([, d]) => d.techs.includes(tech))
    .map(([p]) => p);
}

/** The researchable techs that list `tech` as a prerequisite. */
export function techOpens(tech: WwTechId): WwTechId[] {
  return WW_TECH_IDS.filter(
    (id) => WW_TECHS[id].retired !== true && WW_TECHS[id].prereqs.includes(tech),
  );
}

/**
 * Rules the engine reads by tech id in code, not from a table: a short line
 * each, the numbers copied from the rule (ShipStats, NavalBattles,
 * InvasionRules, Mines, Fuel, IntelRules, EconomyChecks). A test keeps the
 * ids real; the rule tests keep the numbers.
 */
export const TECH_RULE_LINES: Readonly<
  Partial<Record<WwTechId, readonly (readonly [string, Record<string, number>?])[]>>
> = {
  landing_craft_1: [
    ["landing_capacity", { n: 5 }],
    ["landing_prep", { n: 20 }],
  ],
  landing_craft_2: [
    ["landing_capacity", { n: 5 }],
    ["landing_prep", { n: 20 }],
    ["landing_cut", { n: 10 }],
  ],
  sonar_1: [["sonar", { dc: 15, sub: 30 }]],
  sonar_2: [["sonar", { dc: 15, sub: 30 }]],
  torpedo_1: [["torpedo", { n: 15 }]],
  naval_radar_1: [["naval_radar", { n: 20, hit: 5 }]],
  fire_control_1: [["fire_control", { n: 10 }]],
  synthetic_oil_2: [["synthetic_oil_2"]],
  synthetic_rubber_1: [["synthetic_rubber"]],
  mine_warfare_2: [["mines", { n: 50 }]],
  cryptography_1: [["cipher", { c: 40, d: 15 }]],
  cryptography_2: [["cipher", { c: 40, d: 15 }]],
  cryptography_3: [["cipher", { c: 40, d: 15 }]],
  computing_1: [["cipher", { c: 25, d: 10 }], ["agency_upgrade"]],
  computing_2: [["cipher", { c: 25, d: 10 }]],
  radar_2: [["radar_level"]],
  carrier_aviation: [["carrier_planes"]],
};

/**
 * Stat keys whose tech values are negative: their line says "−{n}" and shows
 * the size of the cut. Every other key is a gain.
 */
export const CUT_EFFECTS: ReadonlySet<string> = new Set([
  "bombDamageTakenPct",
  "convoyLossPct",
  "garrisonNeedPct",
  "invasionPrepPct",
  "navalDamageTakenPct",
  "paradropPrepPct",
  "subVisibilityPct",
  "supplyUsePct",
]);

/** How a stat key's stored value turns into the number its line shows (default: as is). */
const SHOWN: Readonly<Partial<Record<string, (v: number) => number>>> = {
  effCapBp: (v) => v / 100,
  retentionBp: (v) => v / 100,
  planMaxBp: (v) => v / 100,
  interceptShareBp: (v) => v / 100,
  nightBombBp: (v) => v / 100,
  fortDefPerLevelBp: (v) => v / 100,
  armyXpMilli: (v) => v / 1000,
  // The recon company's attack bonus is 5% plus 0.05%p per point.
  reconPct: (v) => v / 20,
};

/** One line per stat effect of a tech, in the stat list's order. */
export function statEffectLines(tech: WwTechId): string[] {
  const effects = WW_TECHS[tech].effects;
  const out: string[] = [];
  for (const k of WW_STAT_KEYS) {
    const v = effects[k];
    if (v === undefined || v === 0) continue;
    const n = Math.abs((SHOWN[k] ?? ((x: number) => x))(v));
    out.push(translateText(`ww1936.effect.${k}`, { n }));
  }
  return out;
}

const TECH_OPENS_SHOWN = 4;

const list = (names: string[]) => names.join(", ");
const withProject = (name: string, project?: SpecialProject) =>
  project === undefined
    ? name
    : translateText("ww1936.techfx.with_project", {
        name,
        project: translateText(`ww1936.project.${project}`),
      });

/** What a tech opens or lets one do, by name, one line each. */
export function unlockLines(tech: WwTechId): string[] {
  const out: string[] = [];
  for (const u of techEquipment(tech)) {
    out.push(
      translateText(UNLOCK_EQUIPMENT_KEY, {
        equipment: translateText(`ww1936.equip.${u.equipment}`),
        gen: translateText(`ww1936.gen.${u.gen}`),
      }),
    );
  }
  const ship = techShip(tech);
  if (ship !== null) {
    out.push(
      translateText("ww1936.techfx.ship_class", {
        cls: translateText(`ww1936.ship_class.${ship.cls}`),
        gen: translateText(`ww1936.ship_gen.${ship.gen}`),
      }),
    );
  }
  for (const unit of techUnits(tech)) {
    out.push(translateText(UNLOCK_UNIT_KEY, { unit }));
  }
  const buildings = techBuildings(tech);
  if (buildings.length > 0) {
    out.push(
      translateText("ww1936.techfx.buildings", {
        list: list(buildings.map((b) => translateText(`ww1936.building.${b}`))),
      }),
    );
  }
  const p = techParts(tech);
  if (p.tankChassis.length > 0) {
    out.push(
      translateText("ww1936.techfx.tank_chassis", {
        list: list(
          p.tankChassis.map((id) => translateText(`ww1936.base.tank.${id}`)),
        ),
      }),
    );
  }
  if (p.tankModules.length > 0) {
    out.push(
      translateText("ww1936.techfx.tank_modules", {
        list: list(
          p.tankModules.map((id) => translateText(`ww1936.module.${id}`)),
        ),
      }),
    );
  }
  if (p.shipModules.length > 0) {
    out.push(
      translateText("ww1936.techfx.ship_modules", {
        list: list(
          p.shipModules.map((m) =>
            withProject(translateText(`ww1936.module.${m.id}`), m.project),
          ),
        ),
      }),
    );
  }
  if (p.planeChassis.length > 0) {
    out.push(
      translateText("ww1936.techfx.plane_chassis", {
        list: list(
          p.planeChassis.map((m) =>
            withProject(translateText(`ww1936.base.plane.${m.id}`), m.project),
          ),
        ),
      }),
    );
  }
  if (p.planeModules.length > 0) {
    out.push(
      translateText("ww1936.techfx.plane_modules", {
        list: list(
          p.planeModules.map((id) => translateText(`ww1936.module.${id}`)),
        ),
      }),
    );
  }
  const projects = techProjects(tech);
  if (projects.length > 0) {
    out.push(
      translateText("ww1936.techfx.projects", {
        list: list(projects.map((x) => translateText(`ww1936.project.${x}`))),
      }),
    );
  }
  return out;
}

/** Lines about what the tech leads to: the techs it opens. */
export function leadLines(tech: WwTechId): string[] {
  const out: string[] = [];
  const opens = techOpens(tech).map((id) => translateText(`ww1936.tech.${id}`));
  if (opens.length > 0) {
    out.push(
      opens.length <= TECH_OPENS_SHOWN
        ? translateText("ww1936.techfx.opens", { list: list(opens) })
        : translateText("ww1936.techfx.opens_more", {
            list: list(opens.slice(0, TECH_OPENS_SHOWN - 1)),
            total: opens.length,
          }),
    );
  }
  return out;
}

/** The lines of what a tech does itself: its unlocks, hard-coded rules and stat effects. */
export function ownEffectLines(tech: WwTechId): string[] {
  return [
    ...unlockLines(tech),
    ...(TECH_RULE_LINES[tech] ?? []).map(([name, params]) =>
      translateText(`ww1936.techfx.r_${name}`, params),
    ),
    ...statEffectLines(tech),
  ];
}

/**
 * A research card's effect lines, one per effect: what it opens (equipment,
 * ships, units, buildings, designer parts), the rules it changes, its
 * bonuses, then what it leads to. A tech with nothing of its own says so.
 */
export function effectLines(tech: WwTechId): string[] {
  const own = ownEffectLines(tech);
  return [
    ...(own.length === 0 ? [translateText(NO_EFFECT_KEY)] : own),
    ...leadLines(tech),
  ];
}
