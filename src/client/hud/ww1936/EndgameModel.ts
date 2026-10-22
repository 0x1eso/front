// World War 1936 P5: what the occupation, aid, subjects and wars tabs read
// (spec §8–§13, §20.3–§20.7, §21.4). Every rule the engine also checks comes
// from engine-lib's EndgameRules (occLawBlock, integrateBlock, llBlock,
// volunteerBlock…), so a greyed button gives the engine's answer.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_TYPES, type AirType } from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LendLeaseItem,
  type MemberState,
  OCCUPATION_LAWS,
  type OccupationLaw,
  type SubjectLevel,
  type WarKind,
  WW_AIR_VOLUNTEER_MAX,
  WW_AIR_VOLUNTEER_PCT,
  WW_LL_TENSION_DEMOCRACY_PCT,
  WW_LL_TENSION_RECEIVER_PCT,
  WW_UPRISING_RES_BP,
  WW_VOLUNTEER_MIN_DIV,
  WW_VOLUNTEER_TENSION_PCT,
  type WwAidView,
  type WwOccView,
  type WwSubjectView,
  type WwWarSummary,
  type WwZoneView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  type TemplateData,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  coveragePct,
  divisionSuppression,
  integrateBlock,
  integrateCostPp,
  llBlock,
  type LlIn,
  llLimitBlock,
  occLawBlock,
  subjectShares,
  volunteerBlock,
  volunteerCap,
  type VolunteerIn,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { CONGRESS } from "@openfront/engine-lib/ww1936/MechRules";
import {
  paidCivsAt,
  subjectFlows,
  subjectTradeCivPct,
} from "@openfront/engine-lib/ww1936/SubjectRules";
import {
  OCC_BLINK,
  OCC_HATCH,
  type OccupationCell,
  type OccupationSource,
} from "../../render/gl/passes/OccupationPass";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import type { WwEndgameView } from "../../view/WwEndgameView";
import { equipmentName, genName, menText } from "./EconomyModel";
import { countryFlagUrl, countryText } from "./EndgameNames";
import type { FogModel } from "./FogModel";
import { regionName } from "./LandModel";
import { fleetName } from "./NavyModel";
import {
  decisionName,
  decisionTab,
  type DecisionView,
  type PolGame,
  politicsInput,
} from "./PoliticsModel";
import {
  countryName,
  dateLabel,
  enemiesOf,
  today,
  translateCountryParams,
  wwActive,
} from "./WorldWarModel";

/** What the endgame screens read from the game (a fake in tests). */
export type EndgameGame = PolGame &
  Partial<Pick<GameView, "wwNavy" | "wwAir" | "wwDepth">>;

function egView(game: EndgameGame): WwEndgameView | null {
  return game.wwEndgame?.() ?? null;
}

function myId(game: EndgameGame): number {
  return game.myPlayer()?.smallID() ?? 0;
}

// ---- Names and flags ----

/** A country's name on screen (spec §3.5: civil war slots, renames); "" for none. */
export function egName(game: EndgameGame, id: number): string {
  return countryText(game, id);
}

/** A country's flag image (a civil war slot's ideology flag); null for none. */
export function egFlag(game: EndgameGame, id: number): string | null {
  return countryFlagUrl(game, id) || null;
}

/**
 * The seat of a government in exile (spec §20.6, "망명 정부 — 런던"): the
 * host's capital region, else the host country (as lane U3's band).
 */
export function exileSeat(game: EndgameGame, host: number): string {
  const sc = game.worldWarScenario();
  const tag = sc?.tagOfSmallId(host);
  const tile = sc && tag ? sc.capitalTileOrNull(tag) : null;
  const region = sc && tile !== null ? regionName(sc, sc.regionAt(tile)) : "";
  return region || egName(game, host);
}

/**
 * The politics drawer's government tab line for a government in exile
 * (spec §10, §20.6): "Seat: London · Legitimacy 54% · Virtual factories
 * 3"; null unless `me` is one.
 */
export function exileLine(game: EndgameGame, me: number): string | null {
  const e = egView(game)?.exiles.find((x) => x.smallID === me);
  if (e === undefined) return null;
  return [
    translateText("ww1936.exile.host", { host: exileSeat(game, e.host) }),
    `${translateText("ww1936.exile.legitimacy")} ${pctOf(e.legitBp)}%`,
    `${translateText("ww1936.exile.virtual_factories")} ${e.virtualMil}`,
  ].join(" · ");
}

/** The diplomacy drawer's badges beside a country (spec §20.5–§20.6): exile, subject. */
export function countryBadges(game: EndgameGame, id: number): string[] {
  const v = egView(game);
  if (v === null) return [];
  const out: string[] = [];
  if (v.isExile(id)) out.push(translateText("ww1936.exile.badge"));
  if (v.subjectOf(id) !== null) out.push(translateText("ww1936.subject.badge"));
  return out;
}

export const occLawName = (law: OccupationLaw) =>
  translateText(`ww1936.occ_law.${law}`);
export const memberStateName = (s: MemberState) =>
  translateText(`ww1936.member_state.${s}`);
export const subjectLevelName = (l: SubjectLevel) =>
  translateText(`ww1936.subject_level.${l}`);

/** "3.2": tenths of suppression as the region line shows them. */
export function deciText(deci: number): string {
  return (Math.max(0, deci) / 10).toFixed(1);
}

/** Whole suppression points, as the tab's totals show them. */
export function deciWhole(deci: number): number {
  return Math.round(Math.max(0, deci) / 10);
}

export const pctOf = (bp: number) => Math.floor(Math.max(0, bp) / 100);

// ---- Redraw key ----

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
function oid(o: object | null | undefined): number {
  if (o === null || o === undefined) return 0;
  let n = objectIds.get(o);
  if (n === undefined) objectIds.set(o, (n = nextObjectId++));
  return n;
}

/**
 * Changes whenever the endgame view took an update the tabs show: every
 * replaced list and every replaced row (the view swaps objects, it never
 * edits them). Cheap enough for a 250 ms tick while a drawer shows.
 */
export function endgameKey(game: EndgameGame): number {
  const v = egView(game);
  if (v === null) return 0;
  let h = 17;
  const mix = (n: number) => (h = (Math.imul(h, 31) + n) | 0);
  mix(oid(v.wars));
  mix(oid(v.peaceLog));
  mix(oid(v.zones));
  mix(oid(v.subjects));
  mix(oid(v.exiles));
  mix(oid(v.occLaws));
  mix(oid(v.controllers));
  mix(v.occupation.size);
  for (const o of v.occupation.values()) mix(oid(o));
  for (const a of v.aid.values()) mix(oid(a));
  for (const c of v.countries.values()) mix(oid(c));
  for (const c of v.cores.values()) mix(oid(c));
  return h;
}

// ---- Occupation (spec §8, §20.3–§20.4) ----

/** The holders of a region's core now (the scenario's 1936 core until the endgame says otherwise). */
export function coreHoldersNow(
  game: EndgameGame,
  region: number,
): readonly number[] {
  const held = egView(game)?.coreHolders(region) ?? null;
  if (held !== null) return held;
  const sc = game.worldWarScenario();
  const r = sc?.region(region);
  return sc !== null && r?.core === true ? [sc.ownerByRegion()[region]] : [];
}

function controllerNow(game: EndgameGame, region: number, dflt: number) {
  const land = game.wwLand?.() ?? null;
  if (land !== null) return land.controller[region] ?? dflt;
  const econ = game.wwEconomy?.() ?? null;
  return econ?.controller[region] ?? dflt;
}

/** The region's legal owner (P3), the 1936 owner without politics. */
export function legalOwnerOf(game: EndgameGame, region: number): number {
  const pol = game.wwPolitics?.() ?? null;
  return (
    pol?.legalOwner[region] ??
    game.worldWarScenario()?.ownerByRegion()[region] ??
    0
  );
}

/**
 * An occupation row is current: its controller still holds the region,
 * has no core there, and someone else has one (spec §8.1). The view keeps
 * a region's last row after it stops being administered.
 */
export function isLiveOcc(game: EndgameGame, o: WwOccView): boolean {
  if (controllerNow(game, o.region, o.controller) !== o.controller) {
    return false;
  }
  const holders = coreHoldersNow(game, o.region);
  return !holders.includes(o.controller) && holders.some((h) => h !== 0);
}

export interface OccRow {
  occ: WwOccView;
  region: number;
  owner: number;
  name: string;
  coveredPct: number;
  /** The garrison is short of the need (the map hatches it). */
  short: boolean;
  /** Resistance at the uprising mark (the map's blinking rim). */
  uprising: boolean;
}

function occRow(game: EndgameGame, o: WwOccView): OccRow {
  const sc = game.worldWarScenario();
  return {
    occ: o,
    region: o.region,
    owner: legalOwnerOf(game, o.region),
    name: sc === null ? "" : regionName(sc, o.region),
    coveredPct: coveragePct(o.supDeci, o.needDeci),
    short: o.supDeci < o.needDeci,
    uprising: o.resBp >= WW_UPRISING_RES_BP,
  };
}

/** The administered regions `me` controls, by region id. */
export function myOccRows(game: EndgameGame, me: number): OccRow[] {
  const v = egView(game);
  if (v === null || me <= 0) return [];
  return [...v.occupation.values()]
    .filter((o) => o.controller === me && isLiveOcc(game, o))
    .sort((a, b) => a.region - b.region)
    .map((o) => occRow(game, o));
}

export interface OccSummary {
  regions: number;
  avgResBp: number;
  avgCompBp: number;
  /** Garrison need and supply, tenths of suppression. */
  needDeci: number;
  supDeci: number;
  coveredPct: number;
}

export function summarize(rows: readonly OccRow[]): OccSummary {
  let res = 0;
  let comp = 0;
  let need = 0;
  let sup = 0;
  for (const r of rows) {
    res += r.occ.resBp;
    comp += r.occ.compBp;
    need += r.occ.needDeci;
    sup += r.occ.supDeci;
  }
  const n = rows.length;
  return {
    regions: n,
    avgResBp: n === 0 ? 0 : Math.floor(res / n),
    avgCompBp: n === 0 ? 0 : Math.floor(comp / n),
    needDeci: need,
    supDeci: sup,
    coveredPct: coveragePct(sup, need),
  };
}

/** The band chip "🗺 Occupation 38 · resistance 41%" (spec §20.3); null without administered regions. */
export function occupationChip(
  game: EndgameGame,
): { n: number; resPct: number } | null {
  const s = summarize(myOccRows(game, myId(game)));
  return s.regions === 0 ? null : { n: s.regions, resPct: pctOf(s.avgResBp) };
}

/** The occupation law `me` applies to `of`'s land and the day its lock ends. */
export function lawFor(
  game: EndgameGame,
  me: number,
  of: number,
): { law: OccupationLaw; lockUntilDay: number } {
  const laws = egView(game)?.occLaws ?? [];
  const own = laws.find((l) => l.by === me && l.of === of);
  const dflt = laws.find((l) => l.by === me && l.of === 0);
  return {
    law: own?.law ?? dflt?.law ?? "occ_military",
    lockUntilDay: own?.lockUntilDay ?? -1,
  };
}

export interface LawButton {
  law: OccupationLaw;
  name: string;
  current: boolean;
  block: WwOrderBlock | null;
  /** The days the lock still holds (0: none). */
  lockDays: number;
  why: string | null;
}

function ppMilliOf(game: EndgameGame, me: number): number {
  return game.wwPolitics?.()?.summary(me)?.ppMilli ?? 0;
}

function occWhy(block: WwOrderBlock, lockDays: number): string {
  return block === "law_locked"
    ? translateText("ww1936.occ.law_lock", { days: lockDays })
    : translateText(`ww1936.occ.why.${block}`);
}

/** The three law buttons for `of`'s land (spec §20.4: cost 25, lock days, why). */
export function lawButtons(
  game: EndgameGame,
  me: number,
  of: number,
  current: OccupationLaw,
): LawButton[] {
  const { lockUntilDay } = lawFor(game, me, of);
  const day = today(game);
  const pp = ppMilliOf(game, me);
  const lockDays = Math.max(0, lockUntilDay - day);
  return OCCUPATION_LAWS.map((law) => {
    const isCurrent = law === current;
    const block = isCurrent ? null : occLawBlock(lockUntilDay, day, pp);
    return {
      law,
      name: occLawName(law),
      current: isCurrent,
      block,
      lockDays,
      why: block === null ? null : occWhy(block, lockDays),
    };
  });
}

export interface OwnerRow {
  owner: number;
  name: string;
  flag: string | null;
  /** By resistance, highest first (ties: region id). */
  regions: OccRow[];
  avgResBp: number;
  avgCompBp: number;
  law: OccupationLaw;
  laws: LawButton[];
}

/** My administered regions by legal owner (spec §20.4), owners by smallID. */
export function ownerRows(game: EndgameGame, me: number): OwnerRow[] {
  const by = new Map<number, OccRow[]>();
  for (const r of myOccRows(game, me)) {
    const list = by.get(r.owner) ?? [];
    list.push(r);
    by.set(r.owner, list);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .map(([owner, rows]) => {
      const s = summarize(rows);
      // The law list is sent whenever a law changes; a row only when its region does.
      const law = lawFor(game, me, owner).law;
      return {
        owner,
        name: egName(game, owner),
        flag: egFlag(game, owner),
        regions: [...rows].sort(
          (a, b) => b.occ.resBp - a.occ.resBp || a.region - b.region,
        ),
        avgResBp: s.avgResBp,
        avgCompBp: s.avgCompBp,
        law,
        laws: lawButtons(game, me, owner, law),
      };
    });
}

export interface IntegrateRow {
  region: number;
  name: string;
  costPp: number;
  block: WwOrderBlock | null;
  why: string | null;
}

/**
 * The days a region's compliance has stayed at 90% (spec §7.3), as the
 * engine counts them; a row without the count counts none, so "Integrate"
 * never shows where the engine would refuse it.
 */
export function compHighDaysOf(o: WwOccView): number {
  return o.compHighDays ?? 0;
}

/**
 * The regions I could integrate (spec §7.3): mine by law, held, someone
 * else's core, compliance at 90% for 180 days (integrateBlock).
 */
export function integrateRows(game: EndgameGame, me: number): IntegrateRow[] {
  const sc = game.worldWarScenario();
  if (sc === null) return [];
  const enemies = new Set(enemiesOf(game, me));
  const pp = ppMilliOf(game, me);
  const out: IntegrateRow[] = [];
  for (const r of myOccRows(game, me)) {
    if (r.owner !== me) continue;
    const vp = sc.region(r.region)?.vp ?? 0;
    const block = integrateBlock({
      legalOwner: true,
      controls: true,
      hasCore: false,
      compBp: r.occ.compBp,
      compHighDays: compHighDaysOf(r.occ),
      enemyHoldsCore: coreHoldersNow(game, r.region).some((h) =>
        enemies.has(h),
      ),
      ppMilli: pp,
      vp,
    });
    if (block !== null && block !== "no_pp") continue;
    out.push({
      region: r.region,
      name: r.name,
      costPp: integrateCostPp(vp),
      block,
      why: block === null ? null : occWhy(block, 0),
    });
  }
  return out;
}

/** The region card's occupation line (spec §20.3); null when not administered. */
export function occRegionLine(
  game: EndgameGame,
  region: number,
  fog?: Pick<FogModel, "bandOf" | "countLabel">,
): string | null {
  const o = egView(game)?.occupation.get(region);
  if (o === undefined || !isLiveOcc(game, o)) return null;
  // P6 (spec §8.9, pre-flight A18): resistance, compliance, the law and
  // the share are public (HOI4 shows them on any occupied state); the
  // occupier's garrison is an army number — whole divisions' worth at the
  // observer's army band on the occupier, its coverage only when exact.
  const hidden =
    fog !== undefined && fog.bandOf(o.controller, ID_ARMY) < 3 ? fog : null;
  return translateText("ww1936.occ.region_line", {
    res: pctOf(o.resBp),
    target: pctOf(o.targetBp),
    comp: pctOf(o.compBp),
    have:
      hidden === null
        ? deciText(o.supDeci)
        : hidden.countLabel(o.controller, Math.round(o.supDeci / 10), ID_ARMY),
    need: deciText(o.needDeci),
    pct: hidden === null ? coveragePct(o.supDeci, o.needDeci) : "?",
    share: o.factoryPct,
    law: occLawName(lawFor(game, o.controller, legalOwnerOf(game, region)).law),
  });
}

let koreaCache: Set<number> | null = null;
/**
 * Spec §1.3 (owner decision 6): the 38th-parallel zones read as such —
 * control only, a neutral label, no resistance.
 */
export function isKoreaZone(region: number): boolean {
  if (koreaCache === null) {
    koreaCache = new Set<number>();
    for (const g of ["korea_north", "korea_south"]) {
      for (const r of CONTENT.groupIdx.get(g)?.regions ?? []) koreaCache.add(r);
    }
  }
  return koreaCache.has(region);
}

/** The region card's neutral zone line ("Occupation zone · USA"); null outside a zone. */
export function zoneLine(game: EndgameGame, region: number): string | null {
  const z = egView(game)?.zones.find((x) => x.region === region);
  if (z === undefined) return null;
  const label = translateText(
    isKoreaZone(region) ? "ww1936.occ.zone_korea" : "ww1936.occ.zone",
  );
  return `${label} · ${egName(game, z.holder)}`;
}

/** The occupation zones `me` holds (control only, no resistance). */
export function myZones(game: EndgameGame, me: number): WwZoneView[] {
  return (egView(game)?.zones ?? [])
    .filter((z) => z.holder === me)
    .sort((a, b) => a.region - b.region);
}

// ---- The occupation map mode (spec §20.3) ----

/** Whether the occupation map shows; shared by the band chip and the pass. */
export class OccupationMode {
  on = false;
  version = 0;
  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.version++;
  }
  toggle(): void {
    this.set(!this.on);
  }
}

const modes = new WeakMap<object, OccupationMode>();
/** One occupation map mode per game view. */
export function occupationModeOf(game: object): OccupationMode {
  let m = modes.get(game);
  if (m === undefined) modes.set(game, (m = new OccupationMode()));
  return m;
}

type Rgb = readonly [number, number, number];
const GREEN: Rgb = [46, 204, 64];
const YELLOW: Rgb = [250, 204, 21];
const RED: Rgb = [220, 38, 38];
const ZONE_GREY: Rgb = [190, 190, 190];
/** Fill strength (of 63) of my administered regions, my cores held by others, zones. */
const LEVEL_MINE = 36;
const LEVEL_MY_CORE = 14;
const LEVEL_ZONE = 16;

/** Resistance 0% green → 50% yellow → 100% red. */
export function resistanceColor(resBp: number): [number, number, number] {
  const t = Math.max(0, Math.min(10000, resBp)) / 10000;
  const [a, b, f] =
    t < 0.5
      ? ([GREEN, YELLOW, t * 2] as const)
      : ([YELLOW, RED, t * 2 - 1] as const);
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * f);
  return [mix(0), mix(1), mix(2)];
}

/**
 * The map mode's regions: mine by resistance (hatched when the garrison is
 * short, a blinking rim near an uprising), my cores others hold faintly
 * (the resistance on our side), occupation zones neutral grey.
 */
export function occupationCells(
  game: EndgameGame,
  me: number,
): OccupationCell[] {
  const v = egView(game);
  if (v === null || me <= 0) return [];
  const out: OccupationCell[] = [];
  const done = new Set<number>();
  const rows = [...v.occupation.values()].sort((a, b) => a.region - b.region);
  for (const o of rows) {
    if (!isLiveOcc(game, o)) continue;
    if (o.controller === me) {
      out.push({
        region: o.region,
        rgb: resistanceColor(o.resBp),
        level: LEVEL_MINE,
        flags:
          (o.supDeci < o.needDeci ? OCC_HATCH : 0) |
          (o.resBp >= WW_UPRISING_RES_BP ? OCC_BLINK : 0),
      });
      done.add(o.region);
    } else if (coreHoldersNow(game, o.region).includes(me)) {
      out.push({
        region: o.region,
        rgb: resistanceColor(o.resBp),
        level: LEVEL_MY_CORE,
        flags: 0,
      });
      done.add(o.region);
    }
  }
  for (const z of v.zones) {
    if (done.has(z.region)) continue;
    done.add(z.region);
    out.push({ region: z.region, rgb: ZONE_GREY, level: LEVEL_ZONE, flags: 0 });
  }
  return out;
}

/** Who controls each region with an occupation row now (the cells' liveness). */
function occControlKey(game: EndgameGame): number {
  const v = egView(game);
  const land = game.wwLand?.() ?? null;
  if (v === null || land === null) return 0;
  let h = 7;
  for (const r of v.occupation.keys()) {
    h = (Math.imul(h, 31) + r * 65_537 + (land.controller[r] ?? 0)) | 0;
  }
  return h;
}

/**
 * What GameRenderer hands the renderer (MapRenderer.setOccupationMap). The
 * key moves only when what the map shows may have: the mode, my country,
 * the endgame's rows (endgameKey) or who holds those regions — worked out
 * at most once a tick, so a steady map costs one string compare a frame.
 */
export function occupationMapSource(game: EndgameGame): OccupationSource {
  const mode = occupationModeOf(game);
  let tick = -1;
  let modeVersion = -1;
  let key = "";
  return {
    on: () => mode.on,
    key: () => {
      const t = game.ticks();
      if (t !== tick || mode.version !== modeVersion) {
        tick = t;
        modeVersion = mode.version;
        key = [
          mode.version,
          myId(game),
          endgameKey(game),
          occControlKey(game),
        ].join(":");
      }
      return key;
    },
    cells: () => occupationCells(game, myId(game)),
  };
}

// ---- "Raise garrison forces" (spec §17.2, §20.4) ----

export interface GarrisonPlan {
  /** The divisions picked, weakest first. */
  picks: number[];
  /** Suppression wanted beyond today's garrison armies, and what the picks bring (tenths). */
  wantDeci: number;
  gotDeci: number;
  /** army_split orders that cut the picks out of their armies. */
  splits: { army: number; count: number; template: number }[];
  /** Armies picked whole. */
  whole: number[];
}

/**
 * The engine AI's pick (spec §17.2): with administered regions needing N,
 * divisions from the weakest (cavalry first, then strength and experience
 * lowest) until their suppression reaches 90% of N beyond today's garrison
 * armies, at most one army (24). Divisions in a battle, in a garrison army
 * or abroad as volunteers are not taken. Null without land data or need.
 * army_split takes the last divisions of a template from an army, so the
 * picks are cut out per (army, template).
 */
export function garrisonPlan(
  game: EndgameGame,
  me: number,
): GarrisonPlan | null {
  const land = game.wwLand?.() ?? null;
  const detail = land?.details.get(me) ?? null;
  if (land === null || detail === null) return null;
  const need = summarize(myOccRows(game, me)).needDeci;
  if (need <= 0) return null;
  const tpl = new Map<number, TemplateData>(
    detail.templates.map((t) => [t.id, t]),
  );
  const supp = (template: number, strengthPm: number) => {
    const t = tpl.get(template);
    return t === undefined ? 0 : divisionSuppression(t, strengthPm);
  };
  const garrisons = new Set(
    land
      .armiesOf(me)
      .filter((a) => a.mine?.order.kind === "garrison")
      .map((a) => a.id),
  );
  const abroad = new Set(
    (egView(game)?.aid.get(me)?.volunteersOut ?? []).map((v) => v.army),
  );
  let have = 0;
  for (const d of detail.divisions) {
    if (garrisons.has(d.army)) have += supp(d.template, d.strengthPm);
  }
  const want = Math.ceil((need * 90) / 100) - have;
  const plan: GarrisonPlan = {
    picks: [],
    wantDeci: Math.max(0, want),
    gotDeci: 0,
    splits: [],
    whole: [],
  };
  if (want <= 0) return plan;
  const cands = detail.divisions
    .filter(
      (d) =>
        d.army > 0 &&
        d.battle === 0 &&
        !garrisons.has(d.army) &&
        !abroad.has(d.army),
    )
    .map((d) => ({
      d,
      s: supp(d.template, d.strengthPm),
      cav: tpl.get(d.template)?.battalions.includes("cavalry") === true,
    }))
    .filter((c) => c.s > 0)
    .sort(
      (a, b) =>
        Number(b.cav) - Number(a.cav) ||
        a.d.strengthPm - b.d.strengthPm ||
        a.d.exp - b.d.exp ||
        a.d.id - b.d.id,
    );
  for (const c of cands) {
    if (plan.gotDeci >= want || plan.picks.length >= WW_MAX_ARMY_DIVISIONS) {
      break;
    }
    plan.picks.push(c.d.id);
    plan.gotDeci += c.s;
  }
  const picked = new Set(plan.picks);
  const armies = [
    ...new Set(
      detail.divisions.filter((d) => picked.has(d.id)).map((d) => d.army),
    ),
  ].sort((a, b) => a - b);
  for (const army of armies) {
    const all = detail.divisions.filter((d) => d.army === army);
    const mine = all.filter((d) => picked.has(d.id));
    if (mine.length === all.length) {
      plan.whole.push(army);
      continue;
    }
    const byTpl = new Map<number, number>();
    for (const d of mine) {
      byTpl.set(d.template, (byTpl.get(d.template) ?? 0) + 1);
    }
    for (const [template, count] of [...byTpl.entries()].sort(
      ([a], [b]) => a - b,
    )) {
      plan.splits.push({ army, count, template });
    }
  }
  return plan;
}

interface GarrisonJob {
  known: Set<number>;
  expect: number;
  whole: number[];
  startedMs: number;
}
const garrisonJobs = new WeakMap<object, GarrisonJob>();
/** How long a garrison job waits for its split armies to show up. */
const GARRISON_JOB_MS = 15_000;

function finishGarrison(armies: number[], send: (o: WwOrder) => void): void {
  const all = [...armies].sort((a, b) => a - b);
  if (all.length === 0) return;
  const into = all[0];
  for (const army of all.slice(1)) send({ kind: "army_merge", army, into });
  send({ kind: "army_garrison", army: into, scope: 0 });
}

/**
 * Starts "raise garrison forces": cuts the picks out of their armies
 * (army_split); once the new armies show (pumpGarrison) they and the
 * armies picked whole merge into one, which gets army_garrison over all my
 * administered regions. False when there is nothing to pick.
 *
 * Approximate by design: army_split moves the *last* divisions of a
 * template, so the divisions that go can differ from the picks (same
 * template, same count), and an army of mine that appears for another
 * reason while the job waits (GARRISON_JOB_MS) is taken as a split one.
 */
export function startGarrison(
  game: EndgameGame,
  me: number,
  send: (o: WwOrder) => void,
  nowMs: number,
): boolean {
  const plan = garrisonPlan(game, me);
  const land = game.wwLand?.() ?? null;
  if (plan === null || land === null || plan.picks.length === 0) return false;
  if (plan.splits.length === 0) {
    finishGarrison(plan.whole, send);
    return true;
  }
  garrisonJobs.set(game, {
    known: new Set(land.armies.keys()),
    expect: plan.splits.length,
    whole: plan.whole,
    startedMs: nowMs,
  });
  for (const s of plan.splits) send({ kind: "army_split", ...s });
  return true;
}

/** Finishes a started garrison job once its new armies arrived (call every tick). */
export function pumpGarrison(
  game: EndgameGame,
  me: number,
  send: (o: WwOrder) => void,
  nowMs: number,
): void {
  const job = garrisonJobs.get(game);
  const land = game.wwLand?.() ?? null;
  if (job === undefined || land === null) return;
  const fresh = land
    .armiesOf(me)
    .map((a) => a.id)
    .filter((id) => !job.known.has(id));
  if (fresh.length >= job.expect) {
    garrisonJobs.delete(game);
    finishGarrison([...job.whole, ...fresh.slice(0, job.expect)], send);
  } else if (nowMs - job.startedMs > GARRISON_JOB_MS) {
    garrisonJobs.delete(game);
    if (fresh.length > 0) finishGarrison([...job.whole, ...fresh], send);
  }
}

/** A garrison job is waiting for its armies. */
export function garrisonPending(game: EndgameGame): boolean {
  return garrisonJobs.has(game);
}

/** The army card's "Garrison" scopes: every country, then each legal owner of my administered land. */
export function garrisonScopes(
  game: EndgameGame,
  me: number,
): { scope: number; name: string }[] {
  return [
    { scope: 0, name: translateText("ww1936.pol.sel.all") },
    ...ownerRows(game, me).map((o) => ({ scope: o.owner, name: o.name })),
  ];
}

// ---- Aid (spec §12, §13, §20.5, §20.7) ----

export interface Why {
  key: string;
  params: Record<string, string | number>;
}
export const whyText = (w: Why) => translateText(w.key, w.params);

function tensionPct(game: EndgameGame): number {
  return Math.floor((game.wwPolitics?.()?.global?.wtBp ?? 0) / 100);
}

function isDemocracy(game: EndgameGame, id: number): boolean {
  const s = game.wwPolitics?.()?.summary(id) ?? null;
  return s !== null && IDEOLOGIES[s.ruling] === "democratic";
}

function hasRule(
  game: EndgameGame,
  id: number,
  test: (r: unknown) => boolean,
): boolean {
  const d = game.wwPolitics?.()?.detail(id) ?? null;
  return (d?.spirits ?? []).some((x) =>
    (CONTENT.spiritIdx.get(x.id)?.rules ?? []).some(test),
  );
}

export interface LlCheckIn extends LlIn {
  tensionPct: number;
  contracts: number;
  /**
   * P6 (spec §13.1, T1b): the US congress support, whole percent, when it
   * holds lend-lease back (under 50% and no `lend_lease` flag); absent or
   * null when it does not.
   */
  congressPct?: number | null;
}

/**
 * Why a lend-lease contract may not run (spec §13.2), in llBlock's order,
 * with the democracy line's numbers (spec §20.7: "Democratic government:
 * world tension 40% needed (now 31%)"); null when it may. P6 (T1b): the
 * US congress first, as the engine's order checks it.
 */
export function llWhy(i: LlCheckIn): Why | null {
  if (llLimitBlock(i.contracts) !== null) {
    return { key: "ww1936.aid.why.ll_limit", params: {} };
  }
  if (i.congressPct !== undefined && i.congressPct !== null) {
    return {
      key: "ww1936.aid.why.congress",
      params: {
        need: Math.floor(CONGRESS.lendLease / 100),
        now: i.congressPct,
      },
    };
  }
  if (llBlock(i) === null) return null;
  if (i.self || !i.bothActors) {
    return { key: "ww1936.aid.why.ll_conditions", params: {} };
  }
  if (i.atWarWithEachOther) return { key: "ww1936.aid.why.at_war", params: {} };
  if (!i.receiverAtWar && i.tensionPct < WW_LL_TENSION_RECEIVER_PCT) {
    return { key: "ww1936.aid.why.ll_peace", params: {} };
  }
  if (i.senderNoLendLeaseRule) {
    return { key: "ww1936.aid.why.ll_rule", params: {} };
  }
  return {
    key: "ww1936.aid.why.ll_tension",
    params: { need: WW_LL_TENSION_DEMOCRACY_PCT, now: i.tensionPct },
  };
}

/** My aid lines (the engine's, human countries only); null before they arrive. */
export function myAid(game: EndgameGame, me: number): WwAidView | null {
  return egView(game)?.aid.get(me) ?? null;
}

/**
 * Lend-lease contracts others run to `me` (spec §20.5 "lend-lease I
 * receive"): the client sees the aid lines of human countries only, so an
 * AI sender's shows as its shipments on the way (WwAidView.incoming).
 */
export function llReceived(
  game: EndgameGame,
  me: number,
): { from: number; item: LendLeaseItem; arrivedMonth: number }[] {
  const v = egView(game);
  if (v === null) return [];
  const out: { from: number; item: LendLeaseItem; arrivedMonth: number }[] = [];
  for (const a of [...v.aid.values()].sort((x, y) => x.smallID - y.smallID)) {
    if (a.smallID === me) continue;
    for (const c of a.contracts) {
      if (c.to === me) {
        out.push({
          from: a.smallID,
          item: c.item,
          arrivedMonth: c.arrivedMonth,
        });
      }
    }
  }
  return out;
}

/** llWhy's inputs for `me` sending to `to`, from the views. */
export function llInputs(
  game: EndgameGame,
  me: number,
  to: number,
  newContract: boolean,
): LlCheckIn {
  const tension = tensionPct(game);
  const democracy = isDemocracy(game, me);
  const aid = myAid(game, me);
  // P6 (W3's congress, T1b): the engine's own judge for the United States
  // (50% support or the lend_lease flag: WwDepthView.congressLl); before
  // it arrives, the support alone.
  const depth = game.wwDepth?.() ?? null;
  const usa = game.worldWarScenario()?.tagOfSmallId(me) === "USA";
  const congressOk =
    depth === null || !usa
      ? true
      : (depth.congressLl ?? depth.congressBp >= CONGRESS.lendLease);
  const congressPct =
    congressOk || depth === null ? null : Math.floor(depth.congressBp / 100);
  // The client does not see P3 flags: a contract of mine running under the
  // democracy's tension mark means the lend-lease flag is set. The US's
  // shows through its congress: let through under 50% support, it is set.
  const usFlag =
    usa &&
    depth !== null &&
    depth.congressLl === true &&
    depth.congressBp < CONGRESS.lendLease;
  const flag =
    usFlag ||
    (democracy &&
      tension < WW_LL_TENSION_DEMOCRACY_PCT &&
      (aid?.contracts ?? []).some((c) => c.blocked === null));
  return {
    self: me === to,
    atWarWithEachOther: enemiesOf(game, me).includes(to),
    bothActors: wwActive(game, me) && wwActive(game, to),
    receiverAtWar: enemiesOf(game, to).length > 0,
    tensionPct: tension,
    senderDemocracy: democracy,
    senderLendLeaseFlag: flag,
    senderNoLendLeaseRule: hasRule(game, me, (r) => r === "no_lend_lease"),
    contracts: newContract ? (aid?.contracts.length ?? 0) : 0,
    congressPct,
  };
}

/** Why `me` may not send lend-lease (or ships) to `to`; null when it may. */
export function llGate(
  game: EndgameGame,
  me: number,
  to: number,
  newContract = true,
): Why | null {
  return llWhy(llInputs(game, me, to, newContract));
}

/** A running contract's stop reason (the engine's block id), as text. */
export function contractWhy(game: EndgameGame, blocked: string): string {
  return translateText("ww1936.aid.blocked_line", {
    reason: translateText(`ww1936.aid.why.${blocked}`, {
      need: WW_LL_TENSION_DEMOCRACY_PCT,
      now: tensionPct(game),
    }),
  });
}

export function llItemName(item: LendLeaseItem): string {
  if (item === "fuel") return translateText("ww1936.aid.item_fuel");
  if (item === "convoy") return translateText("ww1936.aid.item_convoy");
  return equipmentName(item);
}

export interface LlItemRow {
  item: LendLeaseItem;
  name: string;
  /** Generations in stock: [gen, count] (fuel: [1, n]). */
  gens: [number, number][];
}

/** What I can send (stock > 0), in EQUIPMENT_TYPES order, then fuel. */
export function llItems(game: EndgameGame, me: number): LlItemRow[] {
  const d = game.wwEconomy?.()?.detail(me) ?? null;
  if (d === null) return [];
  const out: LlItemRow[] = [];
  for (const t of EQUIPMENT_TYPES) {
    const gens: [number, number][] = [];
    for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) {
      const n = d.stock[equipKey(t, g)] ?? 0;
      if (n > 0) gens.push([g, n]);
    }
    if (gens.length > 0) out.push({ item: t, name: llItemName(t), gens });
  }
  const fuel = Math.floor(d.fuelMilli / 1000);
  if (fuel > 0) {
    out.push({ item: "fuel", name: llItemName("fuel"), gens: [[1, fuel]] });
  }
  return out;
}

/** Every item the request flow lists (spec §13.4): all equipment, then fuel. */
export function llRequestItems(): { item: LendLeaseItem; name: string }[] {
  return [
    ...EQUIPMENT_TYPES.map((t) => ({ item: t, name: llItemName(t) })),
    { item: "fuel" as const, name: llItemName("fuel") },
  ];
}

/** The generation's label ("I", "II"…); fuel's is empty. */
export function llGenName(item: LendLeaseItem, gen: number): string {
  return item === "fuel" ? "" : genName(gen);
}

/** The −/+ step of a monthly amount. */
export function amountStep(n: number): number {
  return n < 10 ? 1 : n < 100 ? 10 : n < 1000 ? 100 : 1000;
}

export interface LlCountryRow {
  id: number;
  name: string;
  flag: string | null;
  why: Why | null;
}

/** Every other playing country, the ones I may send to first (then by name). */
export function llCountries(game: EndgameGame, me: number): LlCountryRow[] {
  const sc = game.worldWarScenario();
  if (sc === null) return [];
  const rows: LlCountryRow[] = [];
  for (let id = 1; id <= sc.countries.length; id++) {
    if (id === me || !wwActive(game, id)) continue;
    rows.push({
      id,
      name: egName(game, id),
      flag: egFlag(game, id),
      why: llGate(game, me, id),
    });
  }
  return rows.sort(
    (a, b) =>
      Number(a.why !== null) - Number(b.why !== null) ||
      a.name.localeCompare(b.name),
  );
}

function divisionsOf(game: EndgameGame, id: number): number {
  return game.wwLand?.()?.countries.get(id)?.divisions ?? 0;
}

/** volunteerBlock's inputs for `me` sending an army of `armyDivs` to `to`. */
export function volunteerInputs(
  game: EndgameGame,
  me: number,
  to: number,
  armyDivs: number,
): VolunteerIn {
  const mine = new Set(enemiesOf(game, me));
  const theirs = enemiesOf(game, to);
  const toTag = game.worldWarScenario()?.tagOfSmallId(to);
  return {
    self: me === to,
    targetAtWar: theirs.length > 0,
    atWarWithTargetEnemy: theirs.some((e) => mine.has(e)),
    atWarWithTarget: mine.has(to),
    senderDemocracy: isDemocracy(game, me),
    tensionPct: tensionPct(game),
    senderDivs: divisionsOf(game, me),
    targetDivs: divisionsOf(game, to),
    alreadySent: (myAid(game, me)?.volunteersOut ?? []).reduce(
      (s, v) => s + v.divisions,
      0,
    ),
    armyDivs,
    ruleBlocks:
      toTag !== undefined &&
      hasRule(
        game,
        me,
        (r) =>
          typeof r === "object" &&
          r !== null &&
          "noAidTo" in r &&
          (r as { noAidTo: readonly string[] }).noAidTo.includes(toTag),
      ),
  };
}

/** Why volunteers may not go (spec §12.1); null when they may. */
export function volunteerWhy(i: VolunteerIn): Why | null {
  const b = volunteerBlock(i);
  if (b === null) return null;
  if (b === "volunteer_limit") {
    return { key: "ww1936.aid.why.volunteer_limit", params: {} };
  }
  const other =
    i.self ||
    !i.targetAtWar ||
    i.atWarWithTargetEnemy ||
    i.atWarWithTarget ||
    i.ruleBlocks;
  if (!other && i.senderDemocracy && i.tensionPct < WW_VOLUNTEER_TENSION_PCT) {
    return {
      key: "ww1936.aid.why.ll_tension",
      params: { need: WW_VOLUNTEER_TENSION_PCT, now: i.tensionPct },
    };
  }
  return { key: "ww1936.aid.why.volunteer_conditions", params: {} };
}

/** How many more volunteer divisions may go (spec §12.1). */
export function volunteerRoom(i: VolunteerIn): number {
  return Math.max(0, volunteerCap(i.senderDivs, i.targetDivs) - i.alreadySent);
}

export interface VolunteerArmy {
  army: number;
  nameNo: number;
  divisions: number;
  why: Why | null;
}

/** My armies that could go as volunteers to `to` (not garrisons, not abroad). */
export function volunteerArmies(
  game: EndgameGame,
  me: number,
  to: number,
): VolunteerArmy[] {
  const land = game.wwLand?.() ?? null;
  if (land === null) return [];
  const abroad = new Set(
    (myAid(game, me)?.volunteersOut ?? []).map((v) => v.army),
  );
  return land
    .armiesOf(me)
    .filter(
      (a) =>
        a.divisions > 0 &&
        !abroad.has(a.id) &&
        a.mine?.order.kind !== "garrison",
    )
    .map((a) => ({
      army: a.id,
      nameNo: a.nameNo,
      divisions: a.divisions,
      why: volunteerWhy(volunteerInputs(game, me, to, a.divisions)),
    }));
}

/** Why a volunteer air group may not go: the volunteer conditions without the division counts. */
export function airVolunteerWhy(
  game: EndgameGame,
  me: number,
  to: number,
): Why | null {
  return volunteerWhy({
    ...volunteerInputs(game, me, to, 0),
    senderDivs: WW_VOLUNTEER_MIN_DIV,
    targetDivs: 3 * WW_VOLUNTEER_MIN_DIV,
    alreadySent: 0,
  });
}

/** Planes of each type I hold, and how many may go as volunteers (spec §12.4). */
export function airVolunteerTypes(
  game: EndgameGame,
  me: number,
): { type: AirType; name: string; cap: number }[] {
  const d = game.wwEconomy?.()?.detail(me) ?? null;
  if (d === null) return [];
  return AIR_TYPES.flatMap((type) => {
    let n = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      n += d.stock[equipKey(type, g)] ?? 0;
    }
    const cap = Math.min(
      WW_AIR_VOLUNTEER_MAX,
      Math.floor((n * WW_AIR_VOLUNTEER_PCT) / 100),
    );
    return cap > 0 ? [{ type, name: equipmentName(type), cap }] : [];
  });
}

/** The air zones (strategic regions) where `to` holds an air base, by id. */
export function airVolunteerZones(game: EndgameGame, to: number): number[] {
  const sc = game.worldWarScenario();
  const econ = game.wwEconomy?.() ?? null;
  if (sc === null || econ === null) return [];
  const out = new Set<number>();
  for (const r of sc.landRegions) {
    if (econ.controller[r.id] !== to) continue;
    if ((econ.airBase[r.id] ?? 0) <= 0) continue;
    const sr = sc.regionSr(r.id);
    if (sr > 0) out.add(sr);
  }
  return [...out].sort((a, b) => a - b);
}

/** My fleets with ships (each goes whole, at most 50 ships). */
export function shipFleets(
  game: EndgameGame,
  me: number,
): { fleet: number; ships: number[]; count: number; name: string }[] {
  const navy = game.wwNavy?.() ?? null;
  if (navy === null) return [];
  return [...navy.fleets.values()]
    .filter((f) => f.owner === me && f.ships.length > 0)
    .sort((a, b) => a.id - b.id)
    .map((f) => ({
      fleet: f.id,
      ships: f.ships.slice(0, 50).map((s) => s.id),
      count: Math.min(50, f.ships.length),
      name: fleetName(f),
    }));
}

// ---- Subjects (spec §9, §20.5) ----

export type SubjectActionId =
  | "tighten"
  | "lower"
  | "annex"
  | "release"
  | "ask_more"
  | "ask_independence"
  | "demand";

/** The P3 decision behind each subject button (spec §9.3, K5's decisions). */
export const SUBJECT_DECISIONS: Readonly<Record<SubjectActionId, string>> = {
  tighten: "gen_tighten_control",
  lower: "gen_downgrade_subject",
  annex: "gen_annex_subject",
  release: "gen_release_subject",
  ask_more: "gen_request_autonomy",
  ask_independence: "gen_request_autonomy",
  demand: "gen_demand_autonomy",
};

export interface SubjectAction {
  id: SubjectActionId;
  decision: string;
  label: string;
  /** The decision's target (0: untargeted). */
  target: number;
  /** P3's card state: 0 can take. */
  state: number;
  reason: string | null;
}

export interface SubjectRow {
  view: WwSubjectView;
  id: number;
  name: string;
  flag: string | null;
  levelName: string;
  autPct: number;
  /** "⛏ 30% · 🏭 2 · 👥 4K": what the overlord takes. */
  share: string;
  actions: SubjectAction[];
}

/** P3 decision card states (PoliticsModel.DecisionView.state). */
const DECISION_COST = 2;
const DECISION_COOLDOWN = 3;

function decisionAction(
  game: EndgameGame,
  views: Map<string, DecisionView>,
  id: SubjectActionId,
  target: number,
  label: string,
): SubjectAction {
  const decision = SUBJECT_DECISIONS[id];
  const v = views.get(decision);
  const locked = translateText("ww1936.pol.decision.locked");
  const out: SubjectAction = {
    id,
    decision,
    label,
    target,
    state: 1,
    reason: locked,
  };
  if (v !== undefined && target > 0) {
    const t = v.targets.find((x) => x.target === target);
    out.state = t?.state ?? 1;
    out.reason = t === undefined ? locked : t.reason;
  } else if (v !== undefined) {
    out.state = v.state;
    out.reason = v.reason ?? v.failing[0] ?? null;
  }
  // The subject screens' own words for the usual refusals (spec §9.3).
  if (out.state === DECISION_COST) {
    out.reason = translateText("ww1936.subject.why.no_pp");
  } else if (
    id === "annex" &&
    out.state !== 0 &&
    enemiesOf(game, target).length > 0
  ) {
    out.reason = translateText("ww1936.subject.why.at_war");
  } else if (
    (id === "ask_more" || id === "ask_independence") &&
    out.state === DECISION_COOLDOWN
  ) {
    out.reason = translateText("ww1936.subject.request_pending");
  }
  return out;
}

/**
 * The civilian factories `buyer` pays for its deals buying from `seller`,
 * and their full price (spec §9.1: half from its own dominion — lane S's
 * subjectTradeCivPct and paidCivsAt, as the engine's tradePaidCivs). Only
 * my own deals are on the client: zeros for anyone else.
 */
export function tradeCivsWith(
  game: EndgameGame,
  buyer: number,
  seller: number,
): { paid: number; full: number } {
  const deals = game.wwEconomy?.()?.detail(buyer)?.buying ?? [];
  const pct = subjectTradeCivPct(
    egView(game)?.subjectOf(seller) ?? null,
    buyer,
  );
  let paid = 0;
  let full = 0;
  for (const t of deals) {
    if (t.seller !== seller) continue;
    full += t.civs;
    paid += paidCivsAt(t.civs, pct);
  }
  return { paid, full };
}

/**
 * What the overlord gets from a subject (spec §9.1): the level's resource
 * share and, as the engine counts them (subjectFlows), civilian factories
 * and men; then what its deals with the subject cost ("🤝 🏭 paid/full")
 * when that is less than the full price (a dominion).
 */
function shareText(game: EndgameGame, s: WwSubjectView): string {
  const p = subjectShares(s.level);
  const parts: string[] = [];
  if (p.resourcePct > 0 || p.civPct > 0 || p.manpowerPct > 0) {
    const sum = game.wwEconomy?.()?.summary(s.subject) ?? null;
    const f = subjectFlows(s.level, [], sum?.civ ?? 0, sum?.recruitable ?? 0);
    parts.push(
      `⛏ ${p.resourcePct}%`,
      `🏭 ${f.civ}`,
      `👥 ${menText(f.manpower)}`,
    );
  }
  const t = tradeCivsWith(game, s.overlord, s.subject);
  if (t.full > 0 && t.paid !== t.full) parts.push(`🤝 🏭 ${t.paid}/${t.full}`);
  return parts.length === 0 ? "—" : parts.join(" · ");
}

/** The subjects tab (spec §20.5): my subjects as their overlord, and my own overlord. */
export function subjectsTab(
  game: EndgameGame,
  me: number,
): { mine: SubjectRow[]; overlord: SubjectRow | null } {
  const v = egView(game);
  const i = politicsInput(game);
  const views = new Map<string, DecisionView>();
  if (i !== null) {
    for (const g of decisionTab(i).groups) {
      for (const d of g.decisions) views.set(d.id, d);
    }
  }
  const row = (
    s: WwSubjectView,
    id: number,
    actions: SubjectAction[],
  ): SubjectRow => ({
    view: s,
    id,
    name: egName(game, id),
    flag: egFlag(game, id),
    levelName: subjectLevelName(s.level),
    autPct: pctOf(s.autBp),
    share: shareText(game, s),
    actions,
  });
  const mine = (v?.subjects ?? [])
    .filter((s) => s.overlord === me)
    .sort((a, b) => a.subject - b.subject)
    .map((s) =>
      row(
        s,
        s.subject,
        (["tighten", "lower", "annex", "release"] as const).map((a) =>
          decisionAction(
            game,
            views,
            a,
            s.subject,
            translateText(`ww1936.subject.${a}`),
          ),
        ),
      ),
    );
  const own = v?.subjectOf(me) ?? null;
  let overlord: SubjectRow | null = null;
  if (own !== null) {
    const ask: SubjectActionId =
      own.level === "dominion" ? "ask_independence" : "ask_more";
    const request = decisionAction(
      game,
      views,
      ask,
      0,
      translateText(`ww1936.subject.${ask}`),
    );
    if (own.autBp < 10000) {
      request.state = 1;
      request.reason = translateText("ww1936.subject.why.not_max");
    }
    overlord = row(own, own.overlord, [
      request,
      decisionAction(
        game,
        views,
        "demand",
        0,
        decisionName("gen_demand_autonomy"),
      ),
    ]);
  }
  return { mine, overlord };
}

/** The subject decisions I may take on `target` (the player panel, spec §20.7). */
export function subjectActionsOn(
  game: EndgameGame,
  me: number,
  target: number,
): SubjectAction[] {
  return subjectsTab(game, me).mine.find((r) => r.id === target)?.actions ?? [];
}

// ---- Wars (spec §4, §20.5) ----

export interface WarMemberView {
  id: number;
  name: string;
  flag: string | null;
  state: MemberState;
  stateName: string;
  sharePm: number;
  me: boolean;
}

/** A war card's badge: still fought, over, over with its conference to come. */
export type WarStatus = "ongoing" | "ended" | "conference_pending";

export interface WarCard {
  id: number;
  name: string;
  kind: WarKind;
  ended: boolean;
  status: WarStatus;
  sides: {
    leader: number;
    name: string;
    flag: string | null;
    members: WarMemberView[];
  }[];
  /** My side (0 attackers, 1 defenders), -1 outside the war. */
  mySide: number;
  /** My share of my side's war score, ‰; null outside the war. */
  mySharePm: number | null;
}

/** "German–Polish War (1939)" (spec §20.5). */
export function warName(game: EndgameGame, w: WwWarSummary): string {
  const year = dateOfDay(w.startDay).year;
  const a = egName(game, w.sides[0]?.leader ?? 0);
  if (w.kind === "civil") {
    // A civil war takes its country's name: the rebel slot's parent.
    const v = egView(game);
    const arg =
      w.sides
        .flatMap((s) => s.members)
        .map((m) => v?.countries.get(m.id)?.nameArg ?? null)
        .find((t) => t !== null) ?? null;
    const name =
      arg !== null ? countryName(arg) : egName(game, w.sides[1]?.leader ?? 0);
    return translateText("ww1936.war.name_civil", { a: name, year });
  }
  if (w.kind === "independence") {
    return translateText("ww1936.war.name_independence", { a, year });
  }
  return translateText("ww1936.war.name", {
    a,
    b: egName(game, w.sides[1]?.leader ?? 0),
    year,
  });
}

/**
 * An ended war whose losers still wait for their peace conference (open
 * or queued, spec §5.1) shows "Peace conference pending".
 */
function warStatus(game: EndgameGame, w: WwWarSummary): WarStatus {
  if (!w.ended) return "ongoing";
  const v = egView(game);
  const conf = v?.conference() ?? null;
  const members = new Set(w.sides.flatMap((s) => s.members.map((m) => m.id)));
  const open = conf !== null && conf.losers.some((l) => members.has(l));
  return open || (v?.queued ?? 0) > 0 ? "conference_pending" : "ended";
}

/** The war cards: my ongoing wars, other ongoing wars, then my ended ones; by id within each. */
export function warCards(game: EndgameGame, me: number): WarCard[] {
  const v = egView(game);
  if (v === null) return [];
  const cards = v.wars.map((w): WarCard => {
    let mySide = -1;
    let mySharePm: number | null = null;
    const sides = w.sides.map((s, n) => ({
      leader: s.leader,
      name: egName(game, s.leader),
      flag: egFlag(game, s.leader),
      members: s.members.map((m) => {
        if (m.id === me) {
          mySide = n;
          mySharePm = m.sharePm;
        }
        return {
          id: m.id,
          name: egName(game, m.id),
          flag: egFlag(game, m.id),
          state: m.state,
          stateName: memberStateName(m.state),
          sharePm: m.sharePm,
          me: m.id === me,
        };
      }),
    }));
    return {
      id: w.id,
      name: warName(game, w),
      kind: w.kind,
      ended: w.ended,
      status: warStatus(game, w),
      sides,
      mySide,
      mySharePm,
    };
  });
  const rank = (c: WarCard) =>
    !c.ended && c.mySide >= 0 ? 0 : !c.ended ? 1 : c.mySide >= 0 ? 2 : 3;
  return cards
    .filter((c) => rank(c) < 3)
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export interface PastConference {
  date: string;
  /** "Poland · Germany, Soviet Union": the losers, then who took something. */
  line: string;
  lines: string[];
}

/** Region names of a treaty line's "12,13,14" (three, then "+N"). */
function regionList(game: EndgameGame, regions: string): string {
  const sc = game.worldWarScenario();
  const ids = regions
    .split(",")
    .map(Number)
    .filter((r) => r > 0);
  if (sc === null || ids.length === 0) return "";
  const names = ids.slice(0, 3).map((r) => regionName(sc, r));
  if (ids.length > 3) {
    names.push(translateText("ww1936.eventui.more", { n: ids.length - 3 }));
  }
  return names.join(", ");
}

/** A treaty line (spec §6.5) as text: country tags as names, `regions` as `what`. */
export function treatyLineText(
  game: EndgameGame,
  l: { key: string; params: Record<string, string | number> },
): string {
  const p = translateCountryParams(l.params);
  if (p.what === undefined && typeof l.params.regions === "string") {
    p.what = regionList(game, l.params.regions);
  }
  return translateText(l.key, p);
}

/** The last ten conferences, newest first (spec §20.5 "past conferences"). */
export function pastConferences(game: EndgameGame): PastConference[] {
  const sc = game.worldWarScenario();
  const log = egView(game)?.peaceLog ?? [];
  return [...log]
    .sort((a, b) => b.day - a.day)
    .slice(0, 10)
    .map((e) => {
      const victors = [
        ...new Set(
          e.lines
            .map((l) => l.params.whoTag)
            .filter((t): t is string => typeof t === "string"),
        ),
      ].map((t) => {
        const id = sc?.smallIdOf(t as CountryTag) ?? 0;
        return id > 0 ? egName(game, id) : t;
      });
      return {
        date: dateLabel(e.day),
        line: translateText("ww1936.peace.past_line", {
          losers: e.losers.map((id) => egName(game, id)).join(", "),
          victors: victors.join(", "),
        }),
        lines: e.lines.map((l) => treatyLineText(game, l)),
      };
    });
}

// ---- The model the tabs read (plan Task 10 Interfaces) ----

export class EndgameModel {
  constructor(
    readonly view: WwEndgameView | null,
    readonly game: EndgameGame | null = null,
  ) {}

  /** My administered regions in short: count, averages, garrison need and supply (tenths). */
  occupationSummary(me: number): OccSummary {
    return summarize(this.game === null ? [] : myOccRows(this.game, me));
  }

  /** My administered regions grouped by legal owner (owners by smallID, regions by id). */
  byLegalOwner(me: number): Map<number, WwOccView[]> {
    const out = new Map<number, WwOccView[]>();
    if (this.game === null) return out;
    for (const r of myOccRows(this.game, me)) {
      const list = out.get(r.owner) ?? [];
      list.push(r.occ);
      out.set(r.owner, list);
    }
    return new Map([...out.entries()].sort(([a], [b]) => a - b));
  }

  /** My lend-lease and volunteer lines (the engine's). */
  aidRows(me: number): WwAidView | null {
    return this.view?.aid.get(me) ?? null;
  }

  /** My subjects, or my overlord's line when I am a subject. */
  subjectRows(me: number): WwSubjectView[] {
    const v = this.view;
    if (v === null) return [];
    const mine = v.subjects
      .filter((s) => s.overlord === me)
      .sort((a, b) => a.subject - b.subject);
    if (mine.length > 0) return mine;
    const own = v.subjectOf(me);
    return own === null ? [] : [own];
  }

  /** The war cards' records: wars I fight in first, then the other ongoing ones. */
  warCards(me: number): WwWarSummary[] {
    const v = this.view;
    if (this.game === null || v === null) return [];
    return warCards(this.game, me)
      .map((c) => v.wars.find((w) => w.id === c.id))
      .filter((w): w is WwWarSummary => w !== undefined);
  }
}
