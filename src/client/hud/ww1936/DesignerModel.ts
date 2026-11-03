// World War 1936 P6 lane U2 (plan Task 11, spec §20.5): the tank, ship and
// plane designer's model. Every number comes from the engine-lib functions
// the engine itself uses (designStats, designBlock; Review
// Focus 2), so the preview is the engine's. The model holds the draft and
// the screen's open slot; the screens (WwDesigner, WwDesignSheet,
// WwDesignList) only draw what it returns.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_TYPES, type AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  DESIGN_NAME_MAX,
  DESIGN_SLOTS,
  DesignDef,
  DesignKind,
  DesignNameSchema,
  DesignStats,
  PLANE_BASES,
  PlaneDesignStats,
  SPECIAL_PROJECTS,
  SpecialProject,
  TANK_BASES,
  TankDesignStats,
  TankRole,
  WW_PLANE_DESIGN_SLOTS,
  WW_TANK_DESIGN_SLOTS,
  WwDesignSlotData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EquipmentType,
  RESOURCE_IDS,
  WW_TECH_IDS,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
  groundSlotOf,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  SHIP_CLASSES,
  SHIP_GENS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  applyShipDesign,
  designBlock,
  DesignBlockCtx,
  DesignCtx,
  designStats,
  PLANE_BASE_DEFS,
  PLANE_MODULE_DEFS,
  planeSlotTakes,
  planeType,
  recommendedPlane,
  recommendedShip,
  recommendedTank,
  resolvedModules,
  SHIP_MODULE_DEFS,
  shipBase,
  shipDesignMods,
  slotKinds,
  TANK_BASE_DEFS,
  TANK_MODULE_DEFS,
  tankDefault,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import {
  PLANE_CELL_TYPES,
  planeScore,
  planeTypeOnSize,
  staticPlaneScore,
} from "@openfront/engine-lib/ww1936/PlaneScore";
import { planeGenTechs } from "@openfront/engine-lib/ww1936/PlaneStats";
import {
  lineResources,
  shipStats,
} from "@openfront/engine-lib/ww1936/ShipStats";
import {
  isOldScore,
  isTankGroup,
  keyStatsWithDesigns,
  oldInfoOf,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { autoNameOf, designDisplayName } from "./DesignName";
import { statsFromArray } from "./LandSeaAir";
import { TwoTap } from "./WorldWarModel";

export { autoNameOf };

/** What the model reads from the game (a fake in tests). */
export type DesignerGame = Pick<
  GameView,
  "myPlayer" | "wwEconomy" | "wwDepth" | "wwLand" | "wwNavy" | "wwPolitics"
>;

export type StatSign = -1 | 0 | 1;

/** A changed number as a chip: "+10" with its stat (green) or "-3" (red). */
export interface StatChip {
  /** ww1936.design.stat.<id>. */
  id: string;
  text: string;
  sign: StatSign;
}

/** Draft mode: every technology and project counted as done (engine-lib checks only). */
const ALL_RESEARCH: Pick<DesignBlockCtx, "techs" | "projects"> = {
  techs: new Set<WwTechId>(WW_TECH_IDS),
  projects: (1 << SPECIAL_PROJECTS.length) - 1,
};

export interface BaseChip {
  id: string;
  /** Translation key of the chip's name (a ship base has a class and a type). */
  nameKey: string;
  /** Ship bases only: the second part of the name. */
  genKey: string | null;
  locked: boolean;
  tech: WwTechId | null;
  project: SpecialProject | null;
  year: number;
  selected: boolean;
}

/** One cell of the tank tab: a role x a chassis. */
export interface TankCell {
  base: string;
  role: TankRole;
  nameKey: string;
  locked: boolean;
  tech: WwTechId | null;
  year: number;
  selected: boolean;
  /** My own design in the cell; null when nothing is saved there. */
  saved: WwDesignSlotData | null;
  /** The saved design's performance score (0 without one). */
  score: number;
  /** The saved design is old: more than 15 % below the best of its group. */
  old: boolean;
}

/** One cell of the plane tab: a plane type x an airframe (the same shape as a tank cell). */
export type PlaneCell = Omit<TankCell, "role"> & { role: string };

/** The plane types of the designer's type row. */
export const PLANE_TYPES_LIST: readonly string[] = PLANE_CELL_TYPES;

export const TANK_ROLES_LIST: readonly TankRole[] = [
  "tank",
  "tank_destroyer",
  "sp_artillery",
  "sp_anti_air",
];

export interface SlotCard {
  index: number;
  slotKind: string;
  /** "" in a ship or plane slot (the base fitting, empty); the resolved id in a tank slot. */
  moduleId: string;
  /** The module in the draft is the chassis default (or empty). */
  isDefault: boolean;
  /** Up to two changed numbers against the base fitting of this slot. */
  chips: StatChip[];
  open: boolean;
}

export interface ModuleBlock {
  tech: WwTechId | null;
  year: number;
  project: SpecialProject | null;
  /** The module is already in another special slot. */
  duplicate: boolean;
}

export interface ModuleRow {
  /** "" is the empty or base-fit row. */
  id: string;
  current: boolean;
  /** Two or three numbers this module changes against the module now in the slot. */
  chips: StatChip[];
  /** The cost change against the module now in the slot (industry points; naval points for a ship). */
  costDiff: number;
  /** Why it cannot be taken; null when it can. */
  block: ModuleBlock | null;
  /** Draft mode: the only thing in the way is the research lock, so it can be drafted. */
  draftable: boolean;
}

export interface StatRow {
  id: string;
  text: string;
  /** The compare target's number, or null without a target. */
  compareText: string | null;
  /** +1 better than the compare target, −1 worse, 0 same or none. */
  sign: StatSign;
  /** The difference as text ("+4.5"), "" when the same or none. */
  diffText: string;
}

export interface CostInfo {
  /** Industry points (tank, plane) or naval points (ship). */
  cost: number;
  compareCost: number | null;
  /** +1 cheaper than the compare target. */
  sign: StatSign;
  resources: [string, number][];
  fuelText: string;
}

interface Numbers {
  ids: readonly string[];
  vals: number[];
  /** Divisors for the text: value / div. */
  divs: readonly number[];
  cost: number;
  costDiv: number;
  resources: number[];
  fuel: number;
  fuelIsPct: boolean;
}

const TANK_ROW_IDS = [
  "soft_attack",
  "hard_attack",
  "piercing",
  "breakthrough",
  "defense",
  "armor",
  "speed",
  "reliability",
] as const;
const TANK_DIVS = [100, 100, 100, 100, 100, 100, 100, 10] as const;
const SHIP_ROW_IDS = [
  "hp",
  "gun",
  "torpedo",
  "aa",
  "armor",
  "speed",
  "detection",
  "range",
] as const;
const SHIP_DIVS = [1000, 1, 1, 1, 1, 100, 1, 1] as const;
const PLANE_ROW_IDS = [
  "air_attack",
  "air_defense",
  "agility",
  "speed",
  "range",
  "ground_attack",
  "strategic",
  "naval_attack",
] as const;
const PLANE_DIVS = [100, 100, 1, 1, 1, 100, 100, 100] as const;

/** Number text: whole when whole, else one decimal. */
export function numText(raw: number, div: number): string {
  const v = raw / div;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function signedText(delta: number, div: number): string {
  const t = numText(Math.abs(delta), div);
  return delta < 0 ? `-${t}` : `+${t}`;
}

function techYear(t: WwTechId | undefined | null): number {
  return t === undefined || t === null ? 0 : (WW_TECHS[t]?.year ?? 0);
}

/**
 * Final review D (D1): a typed design name as DesignNameSchema takes it —
 * no `<` or `>`, no control or format characters (bidi marks, the
 * zero-width joiner inside some emoji), no lone surrogate, no space at
 * either end, and at most DESIGN_NAME_MAX UTF-16 units, cut at a whole
 * character. "Tiger " and "티거 " (an IME's trailing space) save as
 * "Tiger" and "티거".
 */
export function cleanDesignName(name: string): string {
  let s = name.replace(/[<>\p{Cc}\p{Cf}\p{Cs}]/gu, "").trim();
  if (s.length > DESIGN_NAME_MAX) {
    let cut = "";
    for (const ch of s) {
      if (cut.length + ch.length > DESIGN_NAME_MAX) break;
      cut += ch;
    }
    s = cut.trim();
  }
  return s;
}

/** The MIO family a design's reliability and cost come from (the engine's designFamily). */
function familyKey(def: DesignDef): string {
  if (def.kind === "tank") return "armor";
  if (def.kind === "ship") return "naval";
  return def.base.startsWith("small") ? "air_light" : "air_heavy";
}

export class DesignerModel {
  /** The design being edited; null before a base is picked. */
  draft: DesignDef | null = null;
  kind: DesignKind = "tank";
  /** The tank tab's role: the cells list is of this role, and the draft keeps it. */
  tankRoleSel: TankRole = "tank";
  /** The plane tab's type: the cells list is of this type, and the draft keeps it. */
  planeTypeSel = "fighter";
  /** The saved design it was opened from (a copy's base). */
  private base: DesignDef | null = null;
  /** The slot whose module sheet is open; null when closed. */
  openSlot: number | null = null;
  /** Taps spent since open(): the spec's "six taps or fewer". */
  taps = 0;
  /** Bumped on every change to the draft (the screens redraw on it). */
  rev = 0;
  /** The screen redraws through this on a change. */
  onChange: (() => void) | null = null;
  private readonly saveTap = new TwoTap();
  /**
   * "Draft for the library": locked chassis, modules and projects can be
   * picked, but the only save is the library's. The game's own checks
   * (`block()`, `save()`) never look at this flag.
   */
  draftMode = false;
  private techMemo: { src: unknown; set: ReadonlySet<WwTechId> } | null = null;
  private memo: { key: string; env: number; n: Numbers | null } | null = null;

  constructor(readonly view: DesignerGame) {}

  private bump(): void {
    this.rev++;
    this.onChange?.();
  }

  // ---- operations (each user tap is one tap) ----

  /**
   * Opens a designer of `kind`. With a base id, starts a new draft on it;
   * with a saved design (a copy), starts from that design.
   */
  open(kind: DesignKind, base?: string | DesignDef): void {
    this.taps = 1;
    this.kind = kind;
    this.base = null;
    this.openSlot = null;
    this.draft = null;
    if (typeof base === "string") this.draft = this.fresh(kind, base);
    else if (base !== undefined) {
      this.draft = { ...base, modules: [...base.modules] };
      this.base = base;
      if (base.kind === "tank") this.tankRoleSel = tankRole(base);
      if (base.kind === "plane") this.planeTypeSel = planeType(base);
    }
    this.bump();
  }

  /** The tank tab's role selector: the cells of that role; the draft is dropped. */
  setRole(role: TankRole): void {
    if (role === this.tankRoleSel) return;
    this.taps++;
    this.tankRoleSel = role;
    this.base = null;
    this.openSlot = null;
    this.draft = null;
    this.bump();
  }

  /** The plane tab's type selector: the cells of that type; the draft is dropped. */
  setPlaneType(type: string): void {
    if (type === this.planeTypeSel) return;
    this.taps++;
    this.planeTypeSel = type;
    this.base = null;
    this.openSlot = null;
    this.draft = null;
    this.bump();
  }

  /** The draft-for-the-library switch. */
  setDraftMode(on: boolean): void {
    if (on === this.draftMode) return;
    this.taps++;
    this.draftMode = on;
    this.bump();
  }

  /** The designer's kind tab. */
  setKind(kind: DesignKind): void {
    if (kind === this.kind) return;
    this.taps++;
    this.kind = kind;
    this.base = null;
    this.openSlot = null;
    this.draft = null;
    this.bump();
  }

  /**
   * A base chip (plane, ship) or a cell (tank): a fresh draft on it. A tank
   * cell loads its design, or the recommended fit of the role.
   */
  setBase(id: string): void {
    this.taps++;
    this.openSlot = null;
    const saved =
      this.kind === "tank"
        ? this.cellDesign(id)
        : this.kind === "plane"
          ? this.planeCellDesign(id)
          : null;
    this.base = saved === null ? null : saved.def;
    this.draft =
      saved === null
        ? this.fresh(this.kind, id)
        : { ...saved.def, modules: [...saved.def.modules] };
    this.bump();
  }

  /** A slot card: opens its module sheet (a second tap on it shuts the sheet). */
  selectSlot(slot: number | null): void {
    if (this.draft === null) return;
    this.taps++;
    this.openSlot = slot === this.openSlot ? null : slot;
    this.bump();
  }

  setModule(slot: number, id: string): void {
    if (this.draft === null) return;
    this.taps++;
    const modules = [...this.draft.modules];
    modules[slot] = id;
    this.draft = { ...this.draft, modules };
    this.openSlot = null;
    this.bump();
  }

  setLevel(armor: number, engine: number): void {
    if (this.draft === null || this.draft.kind !== "tank") return;
    this.taps++;
    this.draft = {
      ...this.draft,
      armorLevel: Math.max(0, Math.min(10, armor)),
      engineLevel: Math.max(0, Math.min(10, engine)),
    };
    this.bump();
  }

  /**
   * The typed name, cleaned to what the order's schema takes
   * (`cleanDesignName`); empty goes back to the automatic one ("@").
   */
  setName(name: string): void {
    if (this.draft === null) return;
    const clean = cleanDesignName(name);
    this.draft = { ...this.draft, name: clean === "" ? "@" : clean };
    this.bump();
  }

  /**
   * Final review D (D1): the draft's name passes DesignNameSchema. The
   * server kicks (and bans) a client whose order fails the schema, so a
   * name it would refuse never leaves: Save stays grey with a reason.
   */
  nameOk(): boolean {
    return (
      this.draft !== null && DesignNameSchema.safeParse(this.draft.name).success
    );
  }

  /** [Recommended fill] (spec §5.2.3): one tap, the base, the role and the name kept. */
  recommend(): void {
    const d = this.draft;
    if (d === null) return;
    this.taps++;
    const techs = this.techs();
    const r =
      d.kind === "tank"
        ? recommendedTank(d.base, techs, tankRole(d))
        : d.kind === "ship"
          ? recommendedShip(d.base)
          : this.planeFit(d.base, this.planeTypeSel);
    this.draft = { ...r, name: d.name };
    this.openSlot = null;
    this.bump();
  }

  /**
   * [Save], two taps (spec §20.5). The first arms; the confirming tap
   * returns the order, or null while armed or when the draft is refused.
   */
  tapSave(nowMs: number): WwOrder | null {
    if (
      this.draftMode ||
      this.draft === null ||
      this.block() !== null ||
      this.roleMismatch() ||
      !this.nameOk()
    ) {
      return null;
    }
    this.taps++;
    if (!this.saveTap.tap("save", nowMs)) return null;
    return this.save();
  }

  isSaveArmed(nowMs: number): boolean {
    return this.saveTap.isArmed("save", nowMs);
  }

  save(): WwOrder | null {
    if (
      this.draftMode ||
      this.draft === null ||
      this.block() !== null ||
      this.roleMismatch() ||
      !this.nameOk()
    ) {
      return null;
    }
    return { kind: "design_save", def: this.draft } as WwOrder;
  }

  // ---- reads ----

  /** The draft's numbers: engine-lib designStats, as the engine computes them. */
  stats(): DesignStats | null {
    return this.draft === null
      ? null
      : designStats(this.draft, this.ctx(this.draft));
  }

  /** Why the draft cannot be saved (engine-lib designBlock, then slots); null when it can. */
  block(): WwOrderBlock | null {
    const d = this.draft;
    if (d === null) return "bad_base";
    const b = designBlock(d, this.blockCtx());
    if (b !== null) return b;
    if (this.slotsFull(d)) return "design_slots_full";
    return null;
  }

  /**
   * No slot for this draft: a ship or plane list is full, or the tank pool
   * is full and the draft's cell has no design of mine to overwrite.
   */
  private slotsFull(d: DesignDef): boolean {
    if (d.kind === "plane") {
      return (
        this.designsOf("plane").length >= WW_PLANE_DESIGN_SLOTS &&
        this.planeCellDesign(d.base, planeType(d)) === null
      );
    }
    if (d.kind !== "tank") {
      return this.designsOf(d.kind).length >= DESIGN_SLOTS[d.kind];
    }
    return (
      this.designsOf("tank").length >= WW_TANK_DESIGN_SLOTS &&
      this.cellDesign(d.base, tankRole(d)) === null
    );
  }

  /** A tank (plane) draft whose role (type) is no more the cell's: it cannot be saved. */
  roleMismatch(): boolean {
    const d = this.draft;
    if (d === null) return false;
    if (d.kind === "plane") return planeType(d) !== this.planeTypeSel;
    return d.kind === "tank" && tankRole(d) !== this.tankRoleSel;
  }

  /** My own design in the plane cell (airframe x type); the lowest slot when an old snapshot holds several. */
  planeCellDesign(
    base: string,
    type: string = this.planeTypeSel,
  ): WwDesignSlotData | null {
    for (const r of this.designsOf("plane")) {
      if (
        r.origin === "own" &&
        r.def.base === base &&
        planeType(r.def) === type
      ) {
        return r;
      }
    }
    return null;
  }

  /**
   * The recommended fit of a plane cell: the airframe's fit for the type's
   * family, the carrier forms with the carrier hook in the last (special) slot.
   */
  planeFit(base: string, type: string): DesignDef {
    const cv = type.startsWith("cv_");
    const fam = cv ? type.slice(3) : type;
    let def = recommendedPlane(base, this.techs(), fam);
    if (cv) {
      const modules = [...def.modules];
      modules[modules.length - 1] = "m_carrier";
      def = { ...def, modules };
    }
    return def;
  }

  /** The score of a plane design on the static planes' scale (engine-lib's PlaneScore). */
  planeScoreOf(def: DesignDef): number {
    const st = designStats(def, this.ctx(def)) as PlaneDesignStats;
    return planeScore(st.type, {
      airAtk: st.airAttack,
      airDef: st.airDefense,
      agility: st.agility,
      speed: st.speed,
      range: st.range,
      ground: st.ground,
      strat: st.strategic,
      naval: st.naval,
    });
  }

  /** The best score of a plane type among the static generations my techs open and my designs. */
  private planeBest(type: string): number {
    const techs = this.techs();
    let best = 0;
    for (let g = 1; g <= 3; g++) {
      if (!planeGenTechs(type as AirType, g).every((t) => techs.has(t))) {
        continue;
      }
      if (
        g > 1 &&
        EQUIPMENT[type as EquipmentType].techs[g - 1] === undefined
      ) {
        continue;
      }
      best = Math.max(best, staticPlaneScore(type as AirType, g));
    }
    for (const r of this.designsOf("plane")) {
      if (planeType(r.def) === type) {
        best = Math.max(best, this.planeScoreOf(r.def));
      }
    }
    return best;
  }

  /** Score and old flag of a saved plane design. */
  planeScoreInfo(def: DesignDef): { score: number; old: boolean } {
    const score = this.planeScoreOf(def);
    return {
      score,
      old: isOldScore(score, this.planeBest(planeType(def))),
    };
  }

  /** The airframe cells of the plane tab's type. */
  planeCells(): PlaneCell[] {
    const techs = this.techs();
    const proj = this.projects();
    const sel = this.draft?.base ?? "";
    const out: PlaneCell[] = [];
    for (const base of PLANE_BASES) {
      const b = PLANE_BASE_DEFS[base];
      if (!planeTypeOnSize(this.planeTypeSel, b.size)) continue;
      const projectOk =
        b.project === undefined ||
        (proj & (1 << SPECIAL_PROJECTS.indexOf(b.project))) !== 0;
      const saved = this.planeCellDesign(base);
      const info = saved === null ? null : this.planeScoreInfo(saved.def);
      out.push({
        base,
        role: this.planeTypeSel,
        nameKey: `ww1936.base.plane.${base}`,
        locked: (b.tech !== undefined && !techs.has(b.tech)) || !projectOk,
        tech: b.tech ?? null,
        year: techYear(b.tech),
        selected: base === sel,
        saved,
        score: info?.score ?? 0,
        old: info?.old ?? false,
      });
    }
    return out;
  }

  /** My own design in the cell (base x role); the lowest slot when an old snapshot holds several. */
  cellDesign(
    base: string,
    role: TankRole = this.tankRoleSel,
  ): WwDesignSlotData | null {
    for (const r of this.designsOf("tank")) {
      if (
        r.origin === "own" &&
        r.def.base === base &&
        tankRole(r.def) === role
      ) {
        return r;
      }
    }
    return null;
  }

  /** The chassis cells of the tank tab's role. */
  cells(): TankCell[] {
    const techs = this.techs();
    const sel = this.draft?.base ?? "";
    const info = this.tankInfo();
    const out: TankCell[] = [];
    for (const base of TANK_BASES) {
      const tech = TANK_BASE_DEFS[base].tech;
      const saved = this.cellDesign(base);
      let score = 0;
      let old = false;
      if (saved !== null && info !== null) {
        const j = GROUND_STATIC_SLOTS + saved.slot - 1;
        score = info.ks.score[j];
        old = info.old.old[j] === 1;
      }
      out.push({
        base,
        role: this.tankRoleSel,
        nameKey: `ww1936.base.tank.${base}`,
        locked: !techs.has(tech),
        tech,
        year: techYear(tech),
        selected: base === sel,
        saved,
        score,
        old,
      });
    }
    return out;
  }

  /**
   * The production screen's mark on a line: the line's tank key is old, and
   * the best key of its need group to switch to (the highest score among the
   * static tanks my techs open and my own or licensed designs). Null for a
   * key that is no tank's.
   */
  lineOld(
    equipment: EquipmentType,
    gen: number,
  ): {
    old: boolean;
    best: { equipment: EquipmentType; gen: number } | null;
  } | null {
    if (
      equipment === "plane_design" ||
      (AIR_TYPES as readonly string[]).includes(equipment)
    ) {
      return this.planeLineOld(equipment, gen);
    }
    const j = groundSlotOf(equipKey(equipment, gen));
    const info = this.tankInfo();
    if (j < 0 || info === null || !isTankGroup(info.ks.group[j])) return null;
    if (info.old.old[j] !== 1) return { old: false, best: null };
    const g = info.ks.group[j];
    const techs = this.techs();
    const usable = new Set(
      this.designsOf("tank")
        .filter(
          (r) => !r.obsolete && (r.origin === "own" || r.origin === "licensed"),
        )
        .map((r) => r.slot),
    );
    let best = -1;
    for (let k = 0; k < GROUND_SLOTS; k++) {
      if (info.ks.group[k] !== g) continue;
      if (k < GROUND_STATIC_SLOTS) {
        const [t, n] = EQUIP_KEYS[GROUND_EQUIP_KEYS[k]];
        const tech = EQUIPMENT[t].techs[n - 1];
        if (tech === undefined || !techs.has(tech)) continue;
      } else if (!usable.has(k - GROUND_STATIC_SLOTS + 1)) {
        continue;
      }
      if (best < 0 || info.ks.score[k] > info.ks.score[best]) best = k;
    }
    if (best < 0 || best === j) return { old: true, best: null };
    const [t, n] = EQUIP_KEYS[GROUND_EQUIP_KEYS[best]];
    return { old: true, best: { equipment: t, gen: n } };
  }

  /** lineOld for a plane line: a static generation or a plane design of a type. */
  private planeLineOld(
    equipment: EquipmentType,
    gen: number,
  ): {
    old: boolean;
    best: { equipment: EquipmentType; gen: number } | null;
  } | null {
    let type: string;
    let score: number;
    if (equipment === "plane_design") {
      const row = this.designsOf("plane").find((r) => r.slot === gen);
      if (row === undefined) return null;
      type = planeType(row.def);
      score = this.planeScoreOf(row.def);
    } else {
      type = equipment;
      score = staticPlaneScore(equipment as AirType, gen);
    }
    const best = this.planeBest(type);
    if (!isOldScore(score, best)) return { old: false, best: null };
    // The best key to switch to: the highest score among my techs' statics
    // and my own or licensed designs of the type.
    const techs = this.techs();
    let pick: { equipment: EquipmentType; gen: number } | null = null;
    let top = -1;
    for (let g = 1; g <= 3; g++) {
      if (!planeGenTechs(type as AirType, g).every((t) => techs.has(t))) {
        continue;
      }
      const sc = staticPlaneScore(type as AirType, g);
      if (sc > top) {
        top = sc;
        pick = { equipment: type as EquipmentType, gen: g };
      }
    }
    for (const r of this.designsOf("plane")) {
      if (
        r.obsolete ||
        (r.origin !== "own" && r.origin !== "licensed") ||
        planeType(r.def) !== type
      ) {
        continue;
      }
      const sc = this.planeScoreOf(r.def);
      if (sc > top) {
        top = sc;
        pick = { equipment: "plane_design", gen: r.slot };
      }
    }
    if (pick === null || (pick.equipment === equipment && pick.gen === gen)) {
      return { old: true, best: null };
    }
    return { old: true, best: pick };
  }

  /** Score and old flag of a saved tank design (slot 1-based). */
  tankScore(slot: number): { score: number; old: boolean } {
    const info = this.tankInfo();
    if (info === null) return { score: 0, old: false };
    const j = GROUND_STATIC_SLOTS + slot - 1;
    return { score: info.ks.score[j], old: info.old.old[j] === 1 };
  }

  private tankMemo: {
    env: number;
    info: {
      ks: ReturnType<typeof keyStatsWithDesigns>;
      old: ReturnType<typeof oldInfoOf>;
    };
  } | null = null;

  /** The scores of the static tanks and my designs (engine-lib's table) and which are old. */
  private tankInfo() {
    const env =
      (this.view.wwEconomy?.()?.version ?? 0) * 16_777_216 +
      (this.view.wwDepth?.()?.version ?? 0) * 4096 +
      (this.view.wwPolitics?.()?.version ?? 0);
    if (this.tankMemo !== null && this.tankMemo.env === env) {
      return this.tankMemo.info;
    }
    const rows = this.designsOf("tank").map((r) => ({
      slot: r.slot,
      stats: designStats(r.def, this.ctx(r.def)) as TankDesignStats,
    }));
    const ks = keyStatsWithDesigns(rows);
    const info = { ks, old: oldInfoOf(ks, this.techs()) };
    this.tankMemo = { env, info };
    return info;
  }

  /**
   * Draft mode: why the draft cannot go to the library. The same engine-lib
   * checks as block() with the research lock lifted (every technology and
   * project counted as done); shape and slot checks still apply, and the
   * full design list does not matter for a library entry.
   */
  libraryBlock(): WwOrderBlock | null {
    const d = this.draft;
    if (d === null) return "bad_base";
    return designBlock(d, { ...this.blockCtx(), ...ALL_RESEARCH });
  }

  /**
   * For the personal library: why `def` cannot be saved as a new design now
   * (the same checks as block(), in the same order), with the technologies
   * and projects it still lacks. Touches no draft.
   */
  checkNew(def: DesignDef): {
    block: WwOrderBlock | null;
    techs: WwTechId[];
    projects: SpecialProject[];
  } {
    const techs: WwTechId[] = [];
    const projects: SpecialProject[] = [];
    const have = this.techs();
    const done = this.projects();
    const need = (t?: WwTechId, p?: SpecialProject) => {
      if (t !== undefined && !have.has(t) && !techs.includes(t)) techs.push(t);
      if (
        p !== undefined &&
        (done & (1 << SPECIAL_PROJECTS.indexOf(p))) === 0 &&
        !projects.includes(p)
      ) {
        projects.push(p);
      }
    };
    if (def.kind === "tank") {
      need(TANK_BASE_DEFS[def.base]?.tech);
      for (const m of def.modules) need(TANK_MODULE_DEFS[m]?.tech);
    } else if (def.kind === "ship") {
      const sb = shipBase(def.base);
      if (sb !== null && sb.gen > 1) need(`${sb.cls}_${sb.gen}` as WwTechId);
      for (const m of def.modules) {
        need(SHIP_MODULE_DEFS[m]?.tech, SHIP_MODULE_DEFS[m]?.project);
      }
    } else {
      need(PLANE_BASE_DEFS[def.base]?.tech, PLANE_BASE_DEFS[def.base]?.project);
      for (const m of def.modules) need(PLANE_MODULE_DEFS[m]?.tech);
    }
    let block = designBlock(def, this.blockCtx());
    if (block === null && this.slotsFull(def)) block = "design_slots_full";
    return { block, techs, projects };
  }

  /** The base chips of the kind (locked ones dimmed with their tech). */
  baseChips(): BaseChip[] {
    const techs = this.techs();
    const proj = this.projects();
    const sel = this.draft?.base ?? "";
    const out: BaseChip[] = [];
    if (this.kind === "tank") {
      for (const id of TANK_BASES) {
        const t = TANK_BASE_DEFS[id].tech;
        out.push({
          id,
          nameKey: `ww1936.base.tank.${id}`,
          genKey: null,
          locked: !techs.has(t),
          tech: t,
          project: null,
          year: techYear(t),
          selected: id === sel,
        });
      }
    } else if (this.kind === "plane") {
      for (const id of PLANE_BASES) {
        const b = PLANE_BASE_DEFS[id];
        const projectOk =
          b.project === undefined ||
          (proj & (1 << SPECIAL_PROJECTS.indexOf(b.project))) !== 0;
        out.push({
          id,
          nameKey: `ww1936.base.plane.${id}`,
          genKey: null,
          locked: (b.tech !== undefined && !techs.has(b.tech)) || !projectOk,
          tech: b.tech ?? null,
          project: b.project ?? null,
          year: techYear(b.tech),
          selected: id === sel,
        });
      }
    } else {
      for (const cls of SHIP_CLASSES) {
        for (let g = 1; g <= SHIP_GENS[cls]; g++) {
          const id = `${cls}_${g}`;
          const t = g > 1 ? (id as WwTechId) : null;
          out.push({
            id,
            nameKey: `ww1936.ship_class.${cls}`,
            genKey: `ww1936.ship_gen.${g}`,
            locked: t !== null && !techs.has(t),
            tech: t,
            project: null,
            year: t === null ? 1936 : techYear(t),
            selected: id === sel,
          });
        }
      }
    }
    return out;
  }

  /** The slot cards (2 columns × up to 4 rows in the screen). */
  slotCards(): SlotCard[] {
    const d = this.draft;
    if (d === null) return [];
    const kinds = slotKinds(d);
    const resolved = resolvedModules(d);
    const here = this.numbers(d);
    const out: SlotCard[] = [];
    for (let i = 0; i < kinds.length; i++) {
      const cur = d.modules[i] ?? "";
      // Against the base fitting of this slot, the rest as drawn.
      const mods = [...d.modules];
      mods[i] = d.kind === "plane" && i === 0 ? cur : "";
      const dflt = this.numbers({ ...d, modules: mods });
      out.push({
        index: i,
        slotKind: kinds[i],
        moduleId: resolved[i] ?? "",
        isDefault:
          cur === "" || (d.kind === "tank" && cur === tankDefault(d.base, i)),
        chips: this.chips(dflt, here, 2),
        open: this.openSlot === i,
      });
    }
    return out;
  }

  /** The module list of one slot (the bottom sheet). */
  moduleRows(slot: number): ModuleRow[] {
    const d = this.draft;
    if (d === null) return [];
    const slotKind = slotKinds(d)[slot];
    if (slotKind === undefined) return [];
    const techs = this.techs();
    const proj = this.projects();
    const nowId = resolvedModules(d)[slot] ?? "";
    const before = this.numbers(d);
    const rows: ModuleRow[] = [];
    for (const id of this.candidateIds(d, slotKind, slot)) {
      const mods = [...d.modules];
      mods[slot] = id;
      const after = this.numbers({ ...d, modules: mods });
      const asId =
        d.kind === "tank" && id === "" ? tankDefault(d.base, slot) : id;
      const block = this.moduleBlock(d, slot, id, techs, proj);
      rows.push({
        id,
        current: asId === nowId,
        chips: this.chips(before, after, 3),
        costDiff:
          before === null || after === null
            ? 0
            : (after.cost - before.cost) / after.costDiv,
        block,
        draftable: this.draftMode && block !== null && !block.duplicate,
      });
    }
    return rows;
  }

  /** The eight stat rows with the compare target's ▲▼. */
  statRows(): StatRow[] {
    const d = this.draft;
    if (d === null) return [];
    const mine = this.numbers(d);
    if (mine === null) return [];
    const cmp = this.compareNumbers();
    const rows: StatRow[] = [];
    for (let i = 0; i < mine.vals.length; i++) {
      const v = mine.vals[i];
      const c = cmp === null ? null : cmp.vals[i];
      const sign: StatSign = c === null || v === c ? 0 : v > c ? 1 : -1;
      const pct = d.kind === "tank" && i === 7 ? "%" : "";
      rows.push({
        id: mine.ids[i],
        text: numText(v, mine.divs[i]) + pct,
        compareText: c === null ? null : numText(c, mine.divs[i]) + pct,
        sign,
        diffText:
          c === null || sign === 0 ? "" : signedText(v - c, mine.divs[i]),
      });
    }
    return rows;
  }

  /** The cost, resources and fuel lines under the stat rows. */
  costInfo(): CostInfo | null {
    const d = this.draft;
    if (d === null) return null;
    const n = this.numbers(d);
    if (n === null) return null;
    const cmp = this.compareNumbers();
    const resources: [string, number][] = [];
    for (let i = 0; i < n.resources.length; i++) {
      if (n.resources[i] > 0) resources.push([RESOURCE_IDS[i], n.resources[i]]);
    }
    return {
      cost: n.cost / n.costDiv,
      compareCost: cmp === null ? null : cmp.cost / cmp.costDiv,
      // A cheaper design is the better one.
      sign:
        cmp === null || cmp.cost === n.cost ? 0 : n.cost < cmp.cost ? 1 : -1,
      resources,
      fuelText: n.fuelIsPct
        ? n.fuel === 0
          ? "0%"
          : `${n.fuel > 0 ? "+" : ""}${n.fuel}%`
        : numText(n.fuel, 1000),
    };
  }

  /** The role badge's key: ww1936.role.<tank role>, ww1936.ship_class.<cls>, ww1936.equip.<plane type>. */
  roleKey(): string | null {
    return this.draft === null
      ? null
      : roleKeyOf(this.draft, this.ctx(this.draft));
  }

  /**
   * The compare target as engine-lib stats: the newest design of the same
   * role among my saved ones, else the chassis' base fitting.
   */
  compareTo(): DesignStats | null {
    const d = this.compareDef();
    return d === null ? null : designStats(d, this.ctx(d));
  }

  /** True when the compare target is a saved design, false for the base fitting. */
  compareIsSaved(): boolean {
    return this.compareSaved() !== null;
  }

  /** The automatic name of the draft (spec §5.1): "{base} {role}" or "{base} {gun}". */
  autoName(): string {
    return this.draft === null ? "" : autoNameOf(this.draft);
  }

  /** The name the screen shows: a stored name starting with "@" is drawn as the automatic one. */
  displayName(def: DesignDef | null = this.draft): string {
    if (def === null) return "";
    return designDisplayName(def);
  }

  /** The saved designs of a kind. */
  designsOf(kind: DesignKind): readonly WwDesignSlotData[] {
    const rows = this.view.wwDepth?.()?.detail(this.me())?.designs ?? [];
    return rows.filter((r) => r.kind === kind);
  }

  /** Three key numbers of a saved design for its list card. */
  statsOf(def: DesignDef): { id: string; raw: number; div: number }[] {
    const n = this.computeNumbers(def);
    if (n === null) return [];
    const pick =
      def.kind === "tank"
        ? [0, 2, 6]
        : def.kind === "ship"
          ? [0, 1, 5]
          : [0, 3, 4];
    return pick.map((i) => ({ id: n.ids[i], raw: n.vals[i], div: n.divs[i] }));
  }

  baseLabel(def: DesignDef): string {
    if (def.kind === "ship") {
      const sb = shipBase(def.base);
      return `${translateText(`ww1936.ship_class.${sb?.cls ?? "dd"}`)} ${translateText(`ww1936.ship_gen.${sb?.gen ?? 1}`)}`;
    }
    return translateText(`ww1936.base.${def.kind}.${def.base}`);
  }

  roleLabel(def: DesignDef): string {
    return translateText(roleKeyOf(def, this.ctx(def)));
  }

  /** The country of the first licence request waiting for my answer, or null. */
  pendingLicenceFrom(): number | null {
    const me = this.me();
    const p = this.view
      .wwDepth?.()
      ?.marketData.pendingLicences.find((x) => x.to === me);
    return p === undefined ? null : p.from;
  }

  // ---- internals ----

  private me(): number {
    return this.view.myPlayer()?.smallID() ?? 0;
  }

  private techs(): ReadonlySet<WwTechId> {
    const src = this.view.wwEconomy?.()?.detail(this.me())?.researched;
    if (this.techMemo !== null && this.techMemo.src === src) {
      return this.techMemo.set;
    }
    const set = new Set<WwTechId>(src ?? []);
    this.techMemo = { src, set };
    return set;
  }

  private projects(): number {
    return this.view.wwDepth?.()?.detail(this.me())?.projects.done ?? 0;
  }

  private ctx(def: DesignDef): DesignCtx {
    const arr = this.view.wwPolitics?.()?.detail(this.me())?.stats ?? null;
    const f = familyKey(def);
    const s =
      arr === null
        ? null
        : (statsFromArray(arr) as unknown as Record<string, number>);
    return {
      techs: this.techs(),
      projects: this.projects(),
      relPp: s?.[`mioRelPp_${f}`] ?? 0,
      costPct: s?.[`mioCostPct_${f}`] ?? 0,
    };
  }

  private blockCtx(): DesignBlockCtx {
    const t = this.view.wwDepth?.()?.treatyData;
    return {
      techs: this.techs(),
      projects: this.projects(),
      treatyMember: t?.members.includes(this.me()) ?? false,
      treatyEscalated: t?.escalated ?? false,
    };
  }

  private fresh(kind: DesignKind, base: string): DesignDef {
    if (kind === "tank") {
      // A cell without a design starts on the recommended fit of its role.
      let def: DesignDef = recommendedTank(
        base,
        this.techs(),
        this.tankRoleSel,
      );
      if (tankRole(def) !== this.tankRoleSel) {
        // (The recommended tank destroyer of a late chassis carries the super
        // gun, which makes it a tank: take the best gun that keeps the role.)
        const have = this.techs();
        for (const gun of ["gun_heavy", "gun_hv", "gun_small", "howitzer"]) {
          const t = TANK_MODULE_DEFS[gun]?.tech;
          if (t !== undefined && !have.has(t)) continue;
          const modules = [...def.modules];
          modules[0] = gun;
          if (tankRole({ ...def, modules }) === this.tankRoleSel) {
            def = { ...def, modules };
            break;
          }
        }
      }
      return { ...def, name: "@" };
    }
    if (kind === "plane") {
      // A plane cell starts on the recommended fit of its type.
      return { ...this.planeFit(base, this.planeTypeSel), name: "@" };
    }
    const modules = slotKinds({ kind, base }).map(() => "");
    return { kind, base, modules, name: "@" } as DesignDef;
  }

  private candidateIds(d: DesignDef, slotKind: string, slot = -1): string[] {
    const out: string[] = [];
    if (d.kind === "tank") {
      const w = TANK_BASE_DEFS[d.base].weight;
      for (const [id, m] of Object.entries(TANK_MODULE_DEFS)) {
        if (m.slot !== slotKind) continue;
        if (m.weights !== undefined && !m.weights.includes(w)) continue;
        if (m.bases !== undefined && !m.bases.includes(d.base)) continue;
        // Only modules that keep the cell's role.
        if (!this.keepsRole(d, slotKind, id)) continue;
        out.push(id);
      }
      if (slotKind === "special") out.push("");
    } else if (d.kind === "ship") {
      out.push("");
      const sb = shipBase(d.base);
      if (sb === null) return out;
      for (const [id, m] of Object.entries(SHIP_MODULE_DEFS)) {
        if (m.slot !== slotKind || !m.classes.includes(sb.cls)) continue;
        if (m.gens !== undefined && !m.gens.includes(sb.gen)) continue;
        out.push(id);
      }
    } else {
      const size = PLANE_BASE_DEFS[d.base].size;
      if (slotKind !== "weapon" && (slot < 0 || this.keepsType(d, slot, ""))) {
        out.push("");
      }
      for (const [id, m] of Object.entries(PLANE_MODULE_DEFS)) {
        if (!planeSlotTakes(slotKind, id)) continue;
        if (m.sizes !== undefined && !m.sizes.includes(size)) continue;
        if (m.bases !== undefined && !m.bases.includes(d.base)) continue;
        // Only modules that keep the cell's plane type.
        if (slot >= 0 && !this.keepsType(d, slot, id)) continue;
        out.push(id);
      }
    }
    return out;
  }

  /** The plane draft with `id` in slot `slot` still has the cell's type. */
  private keepsType(d: DesignDef, slot: number, id: string): boolean {
    const modules = [...d.modules];
    modules[slot] = id;
    return planeType({ ...d, modules }) === this.planeTypeSel;
  }

  /** The draft with `id` in the (first) slot of `slotKind` still has the cell's role. */
  private keepsRole(d: DesignDef, slotKind: string, id: string): boolean {
    if (slotKind !== "gun" && slotKind !== "turret") return true;
    const i = slotKinds(d).indexOf(slotKind);
    const modules = [...d.modules];
    modules[i] = id;
    return tankRole({ ...d, modules }) === this.tankRoleSel;
  }

  private moduleBlock(
    d: DesignDef,
    slot: number,
    id: string,
    techs: ReadonlySet<WwTechId>,
    proj: number,
  ): ModuleBlock | null {
    if (id === "") return null;
    let tech: WwTechId | undefined;
    let project: SpecialProject | undefined;
    if (d.kind === "tank") tech = TANK_MODULE_DEFS[id]?.tech;
    else if (d.kind === "ship") {
      tech = SHIP_MODULE_DEFS[id]?.tech;
      project = SHIP_MODULE_DEFS[id]?.project;
    } else tech = PLANE_MODULE_DEFS[id]?.tech;
    const techLocked = tech !== undefined && !techs.has(tech);
    const projLocked =
      project !== undefined &&
      (proj & (1 << SPECIAL_PROJECTS.indexOf(project))) === 0;
    let duplicate = false;
    if (d.kind === "tank" && slotKinds(d)[slot] === "special") {
      const m = resolvedModules(d);
      for (let i = 0; i < m.length; i++) {
        if (i !== slot && m[i] === id) duplicate = true;
      }
    }
    if (!techLocked && !projLocked && !duplicate) return null;
    return {
      tech: techLocked ? (tech ?? null) : null,
      year: techYear(tech),
      project: projLocked ? (project ?? null) : null,
      duplicate,
    };
  }

  /** Numbers of a draft (memoised on the last one asked). */
  private numbers(d: DesignDef): Numbers | null {
    const key = `${d.kind}|${d.base}|${d.modules.join(",")}|${d.armorLevel ?? 0}|${d.engineLevel ?? 0}`;
    const env =
      (this.view.wwEconomy?.()?.version ?? 0) * 16_777_216 +
      (this.view.wwDepth?.()?.version ?? 0) * 4096 +
      (this.view.wwPolitics?.()?.version ?? 0);
    const m = this.memo;
    if (m !== null && m.key === key && m.env === env) return m.n;
    const n = this.computeNumbers(d);
    this.memo = { key, env, n };
    return n;
  }

  private computeNumbers(d: DesignDef): Numbers | null {
    const ctx = this.ctx(d);
    if (d.kind === "tank") {
      const s = designStats(d, ctx) as TankDesignStats;
      return {
        ids: TANK_ROW_IDS,
        vals: [
          s.soft,
          s.hard,
          s.pierce,
          s.brk,
          s.def,
          s.armor,
          s.speedCenti,
          s.relPm,
        ],
        divs: TANK_DIVS,
        cost: s.costMilli,
        costDiv: 1000,
        resources: s.resources,
        fuel: s.fuelPct,
        fuelIsPct: true,
      };
    }
    if (d.kind === "plane") {
      const s = designStats(d, ctx) as PlaneDesignStats;
      return {
        ids: PLANE_ROW_IDS,
        vals: [
          s.airAttack,
          s.airDefense,
          s.agility,
          s.speed,
          s.range,
          s.ground,
          s.strategic,
          s.naval,
        ],
        divs: PLANE_DIVS,
        cost: s.costMilli,
        costDiv: 1000,
        resources: s.resources,
        fuel: s.fuelPct,
        fuelIsPct: true,
      };
    }
    const sb = shipBase(d.base);
    if (sb === null) return null;
    const arr = this.view.wwPolitics?.()?.detail(this.me())?.stats ?? null;
    const base = shipStats(sb.cls, sb.gen, statsFromArray(arr), this.techs());
    const s = applyShipDesign(base, shipDesignMods(d));
    return {
      ids: SHIP_ROW_IDS,
      vals: [
        s.hpMilli,
        s.light + s.heavy,
        s.torpedo,
        s.aa,
        s.armor,
        s.speedCentiKn,
        Math.max(s.surfDetect, s.subDetect),
        s.rangeKm,
      ],
      divs: SHIP_DIVS,
      cost: s.cost,
      costDiv: 1,
      resources: lineResources(sb.cls),
      fuel: s.fuelPerDayMilli,
      fuelIsPct: false,
    };
  }

  /** Up to `max` chips of what changed from `a` to `b`, the biggest relative moves first. */
  private chips(a: Numbers | null, b: Numbers | null, max: number): StatChip[] {
    if (a === null || b === null) return [];
    const moves: { i: number; delta: number; weight: number }[] = [];
    for (let i = 0; i < b.vals.length; i++) {
      const delta = b.vals[i] - a.vals[i];
      if (delta === 0) continue;
      const denom = Math.max(1, Math.abs(a.vals[i]));
      moves.push({
        i,
        delta,
        weight: Math.floor((Math.abs(delta) * 1000) / denom),
      });
    }
    moves.sort((x, y) => y.weight - x.weight || x.i - y.i);
    const out: StatChip[] = [];
    for (const m of moves.slice(0, max)) {
      out.push({
        id: b.ids[m.i],
        text: signedText(m.delta, b.divs[m.i]),
        sign: m.delta > 0 ? 1 : -1,
      });
    }
    return out;
  }

  private compareSaved(): WwDesignSlotData | null {
    const d = this.draft;
    if (d === null) return null;
    const mine = roleKeyOf(d, this.ctx(d));
    let best: WwDesignSlotData | null = null;
    let bestYear = -1;
    for (const r of this.designsOf(d.kind)) {
      if (r.obsolete) continue;
      const ctx = this.ctx(r.def);
      if (roleKeyOf(r.def, ctx) !== mine) continue;
      const year = (designStats(r.def, ctx) as { year: number }).year;
      if (
        year > bestYear ||
        (year === bestYear && best !== null && r.slot > best.slot)
      ) {
        best = r;
        bestYear = year;
      }
    }
    return best;
  }

  private compareDef(): DesignDef | null {
    const d = this.draft;
    if (d === null) return null;
    const saved = this.compareSaved();
    if (saved !== null) return saved.def;
    // The chassis' base fitting.
    const modules = d.modules.map((m, i) =>
      d.kind === "plane" && i === 0 ? m : "",
    );
    return d.kind === "tank"
      ? { ...d, modules, armorLevel: 0, engineLevel: 0 }
      : { ...d, modules };
  }

  private compareNumbers(): Numbers | null {
    const c = this.compareDef();
    return c === null ? null : this.computeNumbers(c);
  }
}

function roleKeyOf(def: DesignDef, ctx: DesignCtx): string {
  if (def.kind === "tank") return `ww1936.role.${tankRole(def)}`;
  if (def.kind === "ship") {
    return `ww1936.ship_class.${shipBase(def.base)?.cls ?? "dd"}`;
  }
  return `ww1936.equip.${(designStats(def, ctx) as PlaneDesignStats).type}`;
}

/** Spec §20.5 sizes, CSS px. */
export const DESIGNER_CARD_W = 150;
export const DESIGNER_CARD_H = 49;
export const DESIGNER_GAP = 2;
export const DESIGNER_STATS_W = 180;
export const DESIGNER_PAD = 12;
/** Rows of the top bar, the base chips and the bottom bar. */
export const DESIGNER_BAR_H = 32;
/** The status row (24, with the tank steppers) and the button row (32), plus padding. */
export const DESIGNER_BOTTOM_H = 74;
/** A phone's width: its rows hold 40 px buttons (the status row holds the tank steppers, the button row the save buttons). */
export const DESIGNER_TOUCH_W = 640;
export const DESIGNER_BAR_H_TOUCH = 40;
export const DESIGNER_STATUS_H_TOUCH = 40;
export const DESIGNER_BOTTOM_H_TOUCH = 92;

/** The height of the top bar and the base chips for a viewport width. */
export const designerBarH = (vw: number): number =>
  vw < DESIGNER_TOUCH_W ? DESIGNER_BAR_H_TOUCH : DESIGNER_BAR_H;
/** The height of the status row above the buttons. */
export const designerStatusH = (vw: number): number =>
  vw < DESIGNER_TOUCH_W ? DESIGNER_STATUS_H_TOUCH : 24;
/** The height of the bottom bar. */
export const designerBottomH = (vw: number): number =>
  vw < DESIGNER_TOUCH_W ? DESIGNER_BOTTOM_H_TOUCH : DESIGNER_BOTTOM_H;

export interface DesignerLayout {
  drawerW: number;
  drawerH: number;
  gridW: number;
  gridH: number;
  middleH: number;
  /** The sheet's height: 55% of the drawer, over the grid only. */
  sheetH: number;
  /** The grid and the stats column fit side by side, and the grid fits the middle. */
  fits: boolean;
}

/** Where the designer's parts go for a viewport and a slot count (spec §20.5). */
export function designerLayout(
  vw: number,
  vh: number,
  slots: number,
  topInset = 40,
  bottomInset = 8,
): DesignerLayout {
  const drawerW = Math.min(Math.floor(vw * 0.64), 680);
  const drawerH = vh - topInset - bottomInset;
  const rows = Math.ceil(slots / 2);
  const gridW = 2 * DESIGNER_CARD_W + DESIGNER_GAP;
  const gridH = rows * DESIGNER_CARD_H + (rows - 1) * DESIGNER_GAP;
  const middleH = drawerH - 2 * designerBarH(vw) - designerBottomH(vw);
  return {
    drawerW,
    drawerH,
    gridW,
    gridH,
    middleH,
    sheetH: Math.floor(drawerH * 0.55),
    fits:
      gridW + DESIGNER_STATS_W + 2 * DESIGNER_PAD <= drawerW &&
      gridH <= middleH,
  };
}
