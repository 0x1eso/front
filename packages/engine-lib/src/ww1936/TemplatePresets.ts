// World War 1936: the division preset library (HOI-style presets). Pure
// data and pure functions: the engine (start templates, auto-add, the AI)
// and the template designer call the same ones. Requirements are read off
// the battalion and support tables, so they never drift from them.
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  NG_HEAVY,
  NG_SPA,
  NG_SPAA,
  NG_TD,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { BATTALIONS, SUPPORTS } from "./Battalions";

/** The role tag: what the division is for (the designer groups by it, the AI maps it to a training role). */
export type PresetRole =
  | "infantry"
  | "elite"
  | "mountain"
  | "marine"
  | "para"
  | "cavalry"
  | "motor"
  | "light_armor"
  | "armor"
  | "heavy"
  | "td"
  | "spg"
  | "spaa"
  | "mixed"
  | "artillery";

export interface TemplatePreset {
  /** The template key too (ww1936.tpl.<id>). */
  id: string;
  role: PresetRole;
  battalions: readonly (readonly [BattalionId, number])[];
  support: readonly SupportId[];
  /** The battalion type that makes this preset new to a country: auto-add skips it when a template already uses it. */
  sig: BattalionId;
  en: string;
  ko: string;
}

const p = (
  id: string,
  role: PresetRole,
  sig: BattalionId,
  battalions: [BattalionId, number][],
  support: SupportId[],
  en: string,
  ko: string,
): TemplatePreset => ({
  id: `pre_${id}`,
  role,
  sig,
  battalions,
  support,
  en,
  ko,
});

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  p(
    "line_infantry",
    "infantry",
    "infantry",
    [
      ["infantry", 9],
      ["artillery", 1],
    ],
    [],
    "Line Infantry",
    "보병",
  ),
  p(
    "engineer_infantry",
    "infantry",
    "infantry",
    [
      ["infantry", 7],
      ["artillery", 2],
    ],
    ["engineer"],
    "Engineer Infantry",
    "공병 보병",
  ),
  p(
    "elite_infantry",
    "elite",
    "anti_tank",
    [
      ["infantry", 7],
      ["artillery", 2],
      ["anti_tank", 1],
    ],
    ["engineer", "recon", "field_hospital"],
    "Elite Infantry",
    "정예 보병",
  ),
  p(
    "light_infantry",
    "infantry",
    "infantry",
    [["infantry", 6]],
    ["recon"],
    "Light Infantry",
    "경보병",
  ),
  p(
    "garrison_div",
    "infantry",
    "infantry",
    [["infantry", 6]],
    [],
    "Garrison Guard",
    "수비대",
  ),
  p(
    "anti_tank_infantry",
    "elite",
    "anti_tank",
    [
      ["infantry", 7],
      ["artillery", 1],
      ["anti_tank", 2],
    ],
    ["engineer", "support_anti_tank"],
    "Anti-Tank Infantry",
    "대전차 보병",
  ),
  p(
    "flak_infantry",
    "elite",
    "anti_air",
    [
      ["infantry", 6],
      ["artillery", 1],
      ["anti_air", 2],
    ],
    ["support_anti_air"],
    "Flak Infantry",
    "대공 보병",
  ),
  p(
    "mountain_div",
    "mountain",
    "mountain",
    [
      ["mountain", 6],
      ["artillery", 1],
    ],
    ["engineer"],
    "Mountain Troops",
    "산악",
  ),
  p(
    "marine_div",
    "marine",
    "marine",
    [
      ["marine", 6],
      ["artillery", 1],
    ],
    ["engineer"],
    "Marines",
    "해병",
  ),
  p(
    "airborne_div",
    "para",
    "paratrooper",
    [["paratrooper", 6]],
    ["engineer"],
    "Airborne",
    "공수",
  ),
  p(
    "cavalry_div",
    "cavalry",
    "cavalry",
    [["cavalry", 4]],
    [],
    "Cavalry",
    "기병",
  ),
  p(
    "mot_infantry",
    "motor",
    "motorized",
    [
      ["motorized", 6],
      ["mot_artillery", 1],
    ],
    ["engineer"],
    "Motorized Infantry",
    "차량화 보병",
  ),
  p(
    "mot_artillery_div",
    "motor",
    "mot_artillery",
    [
      ["motorized", 3],
      ["mot_artillery", 4],
    ],
    ["support_artillery"],
    "Motorized Artillery Support",
    "차량화 포병 지원 사단",
  ),
  p(
    "artillery_div",
    "artillery",
    "artillery",
    [
      ["infantry", 4],
      ["artillery", 6],
    ],
    ["support_artillery"],
    "Artillery Division",
    "포병 사단",
  ),
  p(
    "light_armored",
    "light_armor",
    "light_armor",
    [
      ["light_armor", 4],
      ["motorized", 2],
      ["mot_artillery", 1],
    ],
    ["recon"],
    "Light Armoured",
    "경기갑",
  ),
  p(
    "cav_armor",
    "mixed",
    "light_armor",
    [
      ["cavalry", 3],
      ["light_armor", 2],
      ["mot_artillery", 1],
    ],
    [],
    "Cavalry-Armour Mix",
    "기병-기갑 혼성",
  ),
  p(
    "medium_armored",
    "armor",
    "medium_armor",
    [
      ["medium_armor", 5],
      ["motorized", 4],
      ["mot_artillery", 1],
    ],
    ["recon", "engineer"],
    "Medium Armoured",
    "기갑",
  ),
  p(
    "inf_tank_support",
    "mixed",
    "medium_armor",
    [
      ["infantry", 8],
      ["artillery", 1],
      ["medium_armor", 1],
    ],
    ["engineer"],
    "Infantry-Tank Support",
    "보병-전차 지원",
  ),
  p(
    "heavy_breakthrough",
    "heavy",
    "heavy_armor",
    [
      ["heavy_armor", 2],
      ["medium_armor", 3],
      ["motorized", 4],
    ],
    ["recon", "engineer"],
    "Heavy Breakthrough",
    "중기갑 돌파",
  ),
  p(
    "tank_destroyer_div",
    "td",
    "tank_destroyer",
    [
      ["tank_destroyer", 5],
      ["motorized", 3],
      ["mot_artillery", 1],
    ],
    ["recon"],
    "Tank Destroyer Division",
    "구축전차 사단",
  ),
  p(
    "spg_armored",
    "spg",
    "sp_artillery",
    [
      ["medium_armor", 3],
      ["sp_artillery", 3],
      ["motorized", 3],
    ],
    ["recon"],
    "Self-Propelled Armoured",
    "자주포 기갑",
  ),
  p(
    "aa_armored",
    "spaa",
    "sp_anti_air",
    [
      ["medium_armor", 4],
      ["sp_anti_air", 2],
      ["motorized", 4],
    ],
    ["recon"],
    "Anti-Air Armoured",
    "대공 기갑",
  ),
];

const BY_ID: ReadonlyMap<string, TemplatePreset> = new Map(
  TEMPLATE_PRESETS.map((x) => [x.id, x]),
);
export const presetById = (id: string): TemplatePreset | undefined =>
  BY_ID.get(id);
export const presetIndex = (id: string): number =>
  TEMPLATE_PRESETS.findIndex((x) => x.id === id);

export function presetDef(x: TemplatePreset): TemplateDef {
  return {
    name: "",
    battalions: x.battalions.flatMap(([id, n]) =>
      new Array<BattalionId>(n).fill(id),
    ),
    support: [...x.support],
  };
}

/** The design-only battalions and the need group of the tank design each one needs. */
export const DESIGN_ONLY_GROUP: Readonly<Partial<Record<BattalionId, number>>> =
  {
    heavy_armor: NG_HEAVY,
    tank_destroyer: NG_TD,
    sp_artillery: NG_SPA,
    sp_anti_air: NG_SPAA,
  };

export interface PresetStatus {
  usable: boolean;
  /** Techs it still needs (WW_TECH_IDS order not guaranteed: first-seen). */
  techs: WwTechId[];
  /** Battalions that need a saved tank design the country has none of. */
  designs: BattalionId[];
}

/** Which tanks designs a country holds: its key-stat rows' groups (a Set of NEED_GROUPS indexes). */
export function presetStatus(
  x: TemplatePreset,
  researched: ReadonlySet<WwTechId>,
  designGroups: ReadonlySet<number>,
): PresetStatus {
  const techs: WwTechId[] = [];
  const designs: BattalionId[] = [];
  const need = (t: WwTechId) => {
    if (!researched.has(t) && !techs.includes(t)) techs.push(t);
  };
  for (const [id] of x.battalions) {
    BATTALIONS[id].techs.forEach(need);
    const g = DESIGN_ONLY_GROUP[id];
    if (g !== undefined && !designGroups.has(g) && !designs.includes(id)) {
      designs.push(id);
    }
  }
  for (const s of x.support) SUPPORTS[s].techs.forEach(need);
  return { usable: techs.length === 0 && designs.length === 0, techs, designs };
}

/** Every preset with its status, in library order: the "which are usable and why not" function. */
export function presetStatuses(
  researched: ReadonlySet<WwTechId>,
  designGroups: ReadonlySet<number>,
): { preset: TemplatePreset; status: PresetStatus }[] {
  return TEMPLATE_PRESETS.map((preset) => ({
    preset,
    status: presetStatus(preset, researched, designGroups),
  }));
}

/** The presets a country has not yet seen (bit i of `seen` = preset i) and may use now. */
export function newlyUsable(
  researched: ReadonlySet<WwTechId>,
  designGroups: ReadonlySet<number>,
  seen: number,
): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter(
    (x, i) =>
      (seen & (1 << i)) === 0 &&
      presetStatus(x, researched, designGroups).usable,
  );
}

/** Auto-add skips a preset whose signature battalion some template already uses. */
export function sigUsed(
  x: TemplatePreset,
  templates: readonly { def: TemplateDef }[],
): boolean {
  return templates.some((t) => t.def.battalions.includes(x.sig));
}

/** [구형 → 신형]: light → medium armour, artillery → motorized artillery (when motorized is researched). */
export function upgradeDef(
  def: TemplateDef,
  researched: ReadonlySet<WwTechId>,
): TemplateDef | null {
  const medium = researched.has("medium_tank_1");
  const motArt = researched.has("motorized_1") && researched.has("artillery_1");
  let changed = false;
  const battalions = def.battalions.map((b): BattalionId => {
    if (b === "light_armor" && medium) {
      changed = true;
      return "medium_armor";
    }
    if (b === "artillery" && motArt) {
      changed = true;
      return "mot_artillery";
    }
    return b;
  });
  return changed ? { ...def, battalions } : null;
}

/** Equipment types that idle stock is reported for, to the presets that put them to use (best first). */
export function presetsUsing(type: string): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter((x) =>
    x.battalions.some(([id]) => BATTALIONS[id].equip[0][0] === type),
  ).sort(
    (a, b) =>
      Number(BATTALIONS[b.sig].equip[0][0] === type) -
      Number(BATTALIONS[a.sig].equip[0][0] === type),
  );
}
