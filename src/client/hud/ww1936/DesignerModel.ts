// World War 1936 P6 lane U2 (plan Task 11, spec §20.5): the tank, ship and
// plane designer's model. Every number comes from the engine-lib functions
// the engine itself uses (designStats, designBlock, designXpCost; Review
// Focus 2), so the preview is the engine's. The model holds the draft and
// the screen's open slot; the screens (WwDesigner, WwDesignSheet,
// WwDesignList) only draw what it returns.
import type { WwOrder } from "@openfront/engine-api/Schemas";
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
  WwDesignSlotData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  RESOURCE_IDS,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
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
  designXpCost,
  PLANE_BASE_DEFS,
  PLANE_MODULE_DEFS,
  planeSlotTakes,
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
import {
  lineResources,
  shipStats,
} from "@openfront/engine-lib/ww1936/ShipStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { statsFromArray } from "./LandSeaAir";
import { TwoTap } from "./WorldWarModel";

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
  /** The saved design it was opened from (the xp cost is a copy's). */
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
    }
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

  /** A base chip: a fresh draft on it, the saved design forgotten. */
  setBase(id: string): void {
    this.taps++;
    this.base = null;
    this.openSlot = null;
    this.draft = this.fresh(this.kind, id);
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
          : recommendedPlane(d.base, techs);
    this.draft = { ...r, name: d.name };
    this.openSlot = null;
    this.bump();
  }

  /**
   * [Save], two taps (spec §20.5). The first arms; the confirming tap
   * returns the order, or null while armed or when the draft is refused.
   */
  tapSave(nowMs: number): WwOrder | null {
    if (this.draft === null || this.block() !== null || !this.nameOk()) {
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
    if (this.draft === null || this.block() !== null || !this.nameOk()) {
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

  /** Why the draft cannot be saved (engine-lib designBlock, then xp and slots); null when it can. */
  block(): WwOrderBlock | null {
    const d = this.draft;
    if (d === null) return "bad_base";
    const b = designBlock(d, this.blockCtx());
    if (b !== null) return b;
    const have = this.xpHave();
    if (have !== null && this.xpCost() * 1000 > have) return "no_xp";
    if (this.designsOf(d.kind).length >= DESIGN_SLOTS[d.kind]) {
      return "design_slots_full";
    }
    return null;
  }

  xpCost(): number {
    return this.draft === null ? 0 : designXpCost(this.base, this.draft);
  }

  /**
   * The experience in hand in milli; null when the view does not carry it.
   * The air force's comes from lane D's detail.doctrine.xp[2] (whole points).
   */
  xpHave(): number | null {
    const kind = this.draft?.kind ?? this.kind;
    if (kind === "tank") {
      return this.view.wwLand?.()?.details.get(this.me())?.armyXpMilli ?? 0;
    }
    if (kind === "ship") return this.view.wwNavy?.()?.detail?.navyXpMilli ?? 0;
    const air = this.view.wwDepth?.()?.detail(this.me())?.doctrine.xp?.[2];
    return air === undefined ? null : air * 1000;
  }

  /** The experience kind's name (ww1936.design.tab_<kind>) for xp_cost. */
  xpKey(): string {
    return `ww1936.design.tab_${this.draft?.kind ?? this.kind}`;
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
    for (const id of this.candidateIds(d, slotKind)) {
      const mods = [...d.modules];
      mods[slot] = id;
      const after = this.numbers({ ...d, modules: mods });
      const asId =
        d.kind === "tank" && id === "" ? tankDefault(d.base, slot) : id;
      rows.push({
        id,
        current: asId === nowId,
        chips: this.chips(before, after, 3),
        costDiff:
          before === null || after === null
            ? 0
            : (after.cost - before.cost) / after.costDiv,
        block: this.moduleBlock(d, slot, id, techs, proj),
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
    return def.name.startsWith("@") ? autoNameOf(def) : def.name;
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
    const modules = slotKinds({ kind, base }).map(() => "");
    // The weapon slot cannot stay empty (designBlock).
    if (kind === "plane") {
      modules[0] = recommendedPlane(base, this.techs()).modules[0];
    }
    return kind === "tank"
      ? { kind, base, modules, armorLevel: 0, engineLevel: 0, name: "@" }
      : { kind, base, modules, name: "@" };
  }

  private candidateIds(d: DesignDef, slotKind: string): string[] {
    const out: string[] = [];
    if (d.kind === "tank") {
      const w = TANK_BASE_DEFS[d.base].weight;
      for (const [id, m] of Object.entries(TANK_MODULE_DEFS)) {
        if (m.slot !== slotKind) continue;
        if (m.weights !== undefined && !m.weights.includes(w)) continue;
        if (m.bases !== undefined && !m.bases.includes(d.base)) continue;
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
      if (slotKind !== "weapon") out.push("");
      for (const [id, m] of Object.entries(PLANE_MODULE_DEFS)) {
        if (!planeSlotTakes(slotKind, id)) continue;
        if (m.sizes !== undefined && !m.sizes.includes(size)) continue;
        if (m.bases !== undefined && !m.bases.includes(d.base)) continue;
        out.push(id);
      }
    }
    return out;
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

/** The automatic name of a design (spec §5.1). */
export function autoNameOf(def: DesignDef): string {
  if (def.kind === "tank") {
    const role = tankRole(def);
    const base = translateText(`ww1936.base.tank.${def.base}`);
    const gun = resolvedModules(def)[0];
    if (role === "tank" && gun !== tankDefault(def.base, 0) && gun !== "") {
      return translateText("ww1936.design.auto_gun", {
        base,
        gun: translateText(`ww1936.module.${gun}`),
      });
    }
    return translateText("ww1936.design.auto", {
      base,
      role: translateText(`ww1936.role.${role}`),
    });
  }
  if (def.kind === "ship") {
    const sb = shipBase(def.base);
    return translateText("ww1936.design.auto", {
      base: translateText(`ww1936.ship_gen.${sb?.gen ?? 1}`),
      role: translateText(`ww1936.ship_class.${sb?.cls ?? "dd"}`),
    });
  }
  const plane = designStats(def, {
    techs: new Set(),
    projects: 0,
    relPp: 0,
    costPct: 0,
  }) as PlaneDesignStats;
  return translateText("ww1936.design.auto", {
    base: translateText(`ww1936.base.plane.${def.base}`),
    role: translateText(`ww1936.equip.${plane.type}`),
  });
}

/** Spec §20.5 sizes, CSS px. */
export const DESIGNER_CARD_W = 150;
export const DESIGNER_CARD_H = 52;
export const DESIGNER_GAP = 2;
export const DESIGNER_STATS_W = 180;
export const DESIGNER_PAD = 12;
/** Rows of the top bar, the base chips and the bottom bar. */
export const DESIGNER_BAR_H = 32;
/** The xp row (24, with the tank steppers) and the button row (32), plus padding. */
export const DESIGNER_BOTTOM_H = 64;

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
  const middleH = drawerH - 2 * DESIGNER_BAR_H - DESIGNER_BOTTOM_H;
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
