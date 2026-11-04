// World War 1936 w51 (air groups, design ww50-air-group-design.md Part 2):
// what the group card, the air tab's template editor and the map taps compute
// from the views, as plain data. The engine owns every rule (WwAir groups);
// this file only reads AirGroupView / AirTemplate and builds orders.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_TYPES,
  AirGroupView,
  AirGroupZone,
  AirTemplate,
  AirType,
  CARRIER_AIR_TYPES,
  WING_PHASES,
  WingDetail,
  WP_BACK,
  WP_FERRY,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
  WW_AIR_TEMPLATE_NAME_MAX,
  WW_BOMB_CLASSES,
  WW_GROUP_MAX_ZONES,
  WW_GROUP_STEP,
  WW_MAX_AIR_TEMPLATES,
  WW_MAX_GROUP_PLANES,
  WW_MAX_KEEP_GROUPS,
} from "@openfront/engine-api/ww1936/AirTypes";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { translateText } from "../../Utils";
import { NavyCtx, srName } from "./NavyModel";

/** Ticks in a game day (the wing card's "days left" uses the same 7.5). */
const TICKS_PER_DAY_X2 = 15;

export const airTypeLabel = (t: number): string =>
  translateText(`ww1936.equip.${AIR_TYPES[t]}`);

// ---- Templates ----

/** The types a template may hold: no carrier types, no transports (never members). */
export const TEMPLATE_TYPES: readonly number[] = AIR_TYPES.map(
  (t, i) => [t, i] as const,
)
  .filter(
    ([t]) =>
      t !== "transport_plane" &&
      !(CARRIER_AIR_TYPES as readonly AirType[]).includes(t),
  )
  .map(([, i]) => i);

/** The roles the editor totals by, in order. */
export const TEMPLATE_ROLES = ["air", "ground", "bomb", "sea"] as const;
export type TemplateRole = (typeof TEMPLATE_ROLES)[number];
const ROLE_OF: Readonly<Partial<Record<AirType, TemplateRole>>> = {
  fighter: "air",
  heavy_fighter: "air",
  cas: "ground",
  bomber: "bomb",
  strat_bomber: "bomb",
  naval_bomber: "sea",
};

/** A range this many times another's in one mix gets the warning. */
export const RANGE_WARN_RATIO_PCT = 150;

export interface TemplateDraft {
  /** 0: a new template. */
  id: number;
  name: string;
  planes: number[];
  keep: number;
}

export function emptyDraft(): TemplateDraft {
  return { id: 0, name: "", planes: AIR_TYPES.map(() => 0), keep: 0 };
}

export function draftOf(t: AirTemplate): TemplateDraft {
  return { id: t.id, name: t.name, planes: [...t.planes], keep: t.keep };
}

export const draftTotal = (d: Pick<TemplateDraft, "planes">): number =>
  d.planes.reduce((a, n) => a + n, 0);

/** One step of a type (in WW_GROUP_STEP), kept inside 0..total limit. */
export function stepType(
  d: TemplateDraft,
  type: number,
  dir: 1 | -1,
): TemplateDraft {
  if (!TEMPLATE_TYPES.includes(type)) return d;
  const cur = d.planes[type] ?? 0;
  let next = cur + dir * WW_GROUP_STEP;
  if (next < 0) next = 0;
  if (dir > 0 && draftTotal(d) + WW_GROUP_STEP > WW_MAX_GROUP_PLANES) {
    next = cur;
  }
  if (next === cur) return d;
  const planes = [...d.planes];
  planes[type] = next;
  return { ...d, planes };
}

export function stepKeep(d: TemplateDraft, dir: 1 | -1): TemplateDraft {
  const keep = Math.max(0, Math.min(WW_MAX_KEEP_GROUPS, d.keep + dir));
  return keep === d.keep ? d : { ...d, keep };
}

export function roleTotals(
  d: Pick<TemplateDraft, "planes">,
): Record<TemplateRole, number> {
  const out: Record<TemplateRole, number> = {
    air: 0,
    ground: 0,
    bomb: 0,
    sea: 0,
  };
  for (const i of TEMPLATE_TYPES) {
    const r = ROLE_OF[AIR_TYPES[i]];
    if (r !== undefined) out[r] += d.planes[i] ?? 0;
  }
  return out;
}

/** My range in km per AIR_TYPES index (best generation I could field), from the design stats. */
export function typeRanges(ctx: NavyCtx): number[] {
  return AIR_TYPES.map((t) => {
    let best = 0;
    for (let gen = 1; gen <= 4; gen++) {
      try {
        best = Math.max(best, planeStats(t, gen, ctx.stats, ctx.techs).rangeKm);
      } catch {
        break;
      }
    }
    return best;
  });
}

/** The least and greatest range among the types in the mix; null with fewer than two types. */
export function rangeSpread(
  d: Pick<TemplateDraft, "planes">,
  ranges: readonly number[],
): { min: number; max: number; warn: boolean } | null {
  const rs: number[] = [];
  for (const i of TEMPLATE_TYPES) {
    if ((d.planes[i] ?? 0) > 0 && (ranges[i] ?? 0) > 0) rs.push(ranges[i]);
  }
  if (rs.length < 2) return null;
  const min = Math.min(...rs);
  const max = Math.max(...rs);
  return { min, max, warn: max * 100 >= min * RANGE_WARN_RATIO_PCT };
}

export type TemplateBlock =
  | "no_name"
  | "no_planes"
  | "too_many"
  | "too_many_templates"
  | "step";

export function templateBlock(
  d: TemplateDraft,
  existing: readonly AirTemplate[],
): TemplateBlock | null {
  if (d.name.trim() === "") return "no_name";
  const total = draftTotal(d);
  if (total <= 0) return "no_planes";
  if (total > WW_MAX_GROUP_PLANES) return "too_many";
  for (const n of d.planes) if (n % WW_GROUP_STEP !== 0) return "step";
  if (d.id === 0 && existing.length >= WW_MAX_AIR_TEMPLATES) {
    return "too_many_templates";
  }
  return null;
}

export function templateOrder(
  d: TemplateDraft,
  existing: readonly AirTemplate[],
): WwOrder | null {
  if (templateBlock(d, existing) !== null) return null;
  return {
    kind: "air_template",
    id: d.id,
    name: d.name.trim().slice(0, WW_AIR_TEMPLATE_NAME_MAX),
    planes: [...d.planes],
    keep: d.keep,
  };
}

export const templateDropOrder = (id: number): WwOrder => ({
  kind: "air_template_drop",
  id,
});

export function myTemplates(ctx: NavyCtx): AirTemplate[] {
  return [...(ctx.air.detail?.templates ?? [])].sort((a, b) => a.id - b.id);
}

/** The groups the template keeps formed now, and how many it wants. */
export function templateFormed(ctx: NavyCtx, tpl: number): number {
  return myGroups(ctx).filter((g) => g.tpl === tpl).length;
}

// ---- Groups ----

export function myGroups(ctx: NavyCtx): AirGroupView[] {
  return [...(ctx.air.detail?.groups ?? [])].sort((a, b) => a.id - b.id);
}

export function groupById(ctx: NavyCtx, id: number): AirGroupView | undefined {
  return ctx.air.detail?.groups?.find((g) => g.id === id);
}

/** My wings that are in no group: shown as one-type entries (the old wing card commands them). */
export function ungroupedWings(ctx: NavyCtx): WingDetail[] {
  return [...ctx.air.wings.values()]
    .filter((w) => w.owner === ctx.me && (w.group ?? 0) === 0 && w.planes > 0)
    .sort((a, b) => a.id - b.id);
}

export const groupPlanes = (g: Pick<AirGroupView, "planes">): number =>
  g.planes.reduce((a, n) => a + n, 0);

export const groupWanted = (g: Pick<AirGroupView, "want">): number =>
  g.want.reduce((a, n) => a + n, 0);

/** The type holding most planes (the token's silhouette), ties to the lower index. */
export function mainType(g: Pick<AirGroupView, "planes">): number {
  let best = 0;
  for (let i = 1; i < g.planes.length; i++) {
    if (g.planes[i] > g.planes[best]) best = i;
  }
  return best;
}

/** ‰ of the group's full size (its members' full sizes). */
export function groupStrengthPm(g: AirGroupView): number {
  let full = 0;
  let now = 0;
  for (const m of g.members) {
    full += m.full;
    now += m.planes;
  }
  return full > 0 ? Math.min(1000, Math.round((now * 1000) / full)) : 0;
}

export type GroupStatus = "none" | "out" | "rearm" | "range" | "ready" | "auto";

export interface GroupStatusInfo {
  status: GroupStatus;
  /** Days left of a rearm (the longest member's), 0 otherwise. */
  days: number;
}

const inSortie = (phase: number): boolean =>
  phase === WP_OUT || phase === WP_STATION || phase === WP_BACK;

/** True when an order's zone or army stands. */
export const hasOrder = (g: AirGroupView): boolean =>
  g.zones.length > 0 || g.army !== 0;

/** "No order", "On sortie", "Rearm 2 days", "Out of range" — in that priority. */
export function groupStatus(g: AirGroupView, ticks: number): GroupStatusInfo {
  if (g.auto) return { status: "auto", days: 0 };
  if (!hasOrder(g)) return { status: "none", days: 0 };
  if (g.members.some((m) => inSortie(m.phase))) {
    return { status: "out", days: 0 };
  }
  if (
    g.zones.length > 0 &&
    g.zoneInfo.length > 0 &&
    g.zoneInfo.every((z) => z.reachMask === 0)
  ) {
    return { status: "range", days: 0 };
  }
  const resting = g.members.filter(
    (m) => m.phase === WP_REARM || m.phase === WP_FERRY,
  );
  if (resting.length > 0 && resting.length === g.members.length) {
    const left = Math.max(...resting.map((m) => m.until - ticks));
    return {
      status: "rearm",
      days: Math.max(1, Math.ceil((left * 2) / TICKS_PER_DAY_X2)),
    };
  }
  return { status: "ready", days: 0 };
}

export function statusText(s: GroupStatusInfo): string {
  switch (s.status) {
    case "none":
      return translateText("ww1936.airgroup.status_none");
    case "out":
      return translateText("ww1936.airgroup.status_out");
    case "rearm":
      return translateText("ww1936.airgroup.status_rearm", { d: s.days });
    case "range":
      return translateText("ww1936.airgroup.status_range");
    case "auto":
      return translateText("ww1936.airgroup.status_auto");
    case "ready":
      return translateText("ww1936.airgroup.status_ready");
  }
}

/** A member's state key (the wing card's). */
export function memberStateKey(phase: number, planes: number): string {
  if (planes <= 0) return "ww1936.wing.state_empty";
  return `ww1936.wing.state_${WING_PHASES[phase] ?? "ground"}`;
}

export function groupName(g: Pick<AirGroupView, "id" | "name">): string {
  return g.name !== ""
    ? g.name
    : translateText("ww1936.airgroup.default_name", { id: g.id });
}

/** The group's total in the air: members out, station or back, and the zones they fly over. */
export function flyingPlanes(g: AirGroupView): number {
  return g.members.reduce((a, m) => a + (inSortie(m.phase) ? m.planes : 0), 0);
}

// ---- Zones: the tap that adds or removes, the priority, the follow ----

export interface ZoneEdit {
  zones: number[];
  priority: number;
  /** "full": the sixth zone was refused. */
  blocked: "full" | null;
}

/** A tap on zone `sr`: adds it, or removes it when it is there; at most WW_GROUP_MAX_ZONES. */
export function toggleZone(
  g: Pick<AirGroupView, "zones" | "priority">,
  sr: number,
): ZoneEdit {
  if (g.zones.includes(sr)) {
    const zones = g.zones.filter((z) => z !== sr);
    return {
      zones,
      priority: g.priority === sr ? 0 : g.priority,
      blocked: null,
    };
  }
  if (g.zones.length >= WW_GROUP_MAX_ZONES) {
    return { zones: [...g.zones], priority: g.priority, blocked: "full" };
  }
  return { zones: [...g.zones, sr], priority: g.priority, blocked: null };
}

/** The priority mark on `sr` (a second press clears it). Only a zone of the order can have it. */
export function togglePriority(
  g: Pick<AirGroupView, "zones" | "priority">,
  sr: number,
): number {
  if (!g.zones.includes(sr)) return g.priority;
  return g.priority === sr ? 0 : sr;
}

/** How long (ms) a sent order's draft stands in for the view. */
export const DRAFT_MS = 2000;

/** The group with the draft laid over its order while the view has not caught up. */
export function shownGroup(
  g: AirGroupView,
  draft: {
    group: number;
    zones: number[];
    priority: number;
    army: number;
    at: number;
  } | null,
  nowMs: number,
): AirGroupView {
  if (draft === null || draft.group !== g.id || nowMs - draft.at > DRAFT_MS) {
    return g;
  }
  const same =
    draft.army === g.army &&
    draft.priority === g.priority &&
    draft.zones.length === g.zones.length &&
    draft.zones.every((z, i) => z === g.zones[i]);
  if (same) return g;
  return {
    ...g,
    zones: draft.zones,
    priority: draft.priority,
    army: draft.army,
  };
}

export interface GroupPatch {
  zones?: number[];
  priority?: number;
  /** 0: none. */
  army?: number;
  cls?: number;
  target?: number;
  auto?: boolean;
  night?: boolean;
}

/**
 * The air_group_order for `g` with `p` applied. Everything not patched
 * stays as the group has it (the order replaces the whole standing order).
 */
export function groupOrder(g: AirGroupView, p: GroupPatch): WwOrder {
  const army = p.army ?? g.army;
  const zones = army !== 0 ? [] : (p.zones ?? g.zones);
  const priority = army !== 0 ? 0 : (p.priority ?? g.priority);
  const cls = p.cls ?? g.cls;
  const target = p.target ?? g.target;
  const auto = p.auto ?? g.auto;
  const night = p.night ?? g.night;
  return {
    kind: "air_group_order",
    group: g.id,
    zones: zones.slice(0, WW_GROUP_MAX_ZONES),
    priority: zones.includes(priority) ? priority : 0,
    ...(army !== 0 ? { army } : {}),
    ...(cls > 0 ? { cls: WW_BOMB_CLASSES[cls] } : {}),
    ...(target !== 0 ? { target } : {}),
    ...(auto ? { auto: true } : {}),
    ...(night ? { night: true } : {}),
  } as WwOrder;
}

/** [중지]: no zones, no army, not auto. */
export const standDown = (g: AirGroupView): WwOrder =>
  groupOrder(g, { zones: [], priority: 0, army: 0, auto: false });

export const disbandOrder = (g: Pick<AirGroupView, "id">): WwOrder => ({
  kind: "air_group_disband",
  group: g.id,
});

// ---- The card's numbers ----

const CIRCLED = ["①", "②", "③", "④", "⑤"];
export const zoneMark = (i: number): string => CIRCLED[i] ?? String(i + 1);

export function typesIn(g: Pick<AirGroupView, "planes">): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.planes.length; i++) if (g.planes[i] > 0) out.push(i);
  return out;
}

export interface ZoneRowData {
  sr: number;
  mark: string;
  name: string;
  planes: number;
  /** Our superiority in percent, and the enemy's. */
  supPct: number;
  enemyPct: number;
  priority: boolean;
  /** AIR_TYPES indexes of the group's types that reach this zone. */
  reach: number[];
  /** Types that don't. */
  noReach: number[];
}

export function reachTypes(g: AirGroupView, z: AirGroupZone): number[] {
  return typesIn(g).filter((t) => (z.reachMask & (1 << t)) !== 0);
}

export function zoneRowsOf(ctx: NavyCtx, g: AirGroupView): ZoneRowData[] {
  return g.zones.map((sr, i) => {
    const z = g.zoneInfo.find((x) => x.sr === sr);
    const all = typesIn(g);
    const reach = z === undefined ? [] : reachTypes(g, z);
    return {
      sr,
      mark: zoneMark(i),
      name: srName(ctx.scenario, sr),
      planes: z?.planes ?? 0,
      supPct: Math.floor((z?.supPm ?? 0) / 10),
      enemyPct: Math.floor((z?.enemySupPm ?? 0) / 10),
      priority: g.priority === sr,
      reach,
      noReach: all.filter((t) => !reach.includes(t)),
    };
  });
}

/** "③ only bombers reach": empty when all types reach (or the zone has no info yet). */
export function reachLine(row: ZoneRowData): string {
  if (row.noReach.length === 0 || row.reach.length === 0) {
    return row.reach.length === 0 && row.noReach.length > 0
      ? translateText("ww1936.airgroup.reach_none", { z: row.mark })
      : "";
  }
  const names = row.reach.map(airTypeLabel).join(", ");
  return translateText("ww1936.airgroup.reach_only", {
    z: row.mark,
    types: names,
  });
}

export interface MemberLine {
  type: number;
  planes: number;
  full: number;
  state: string;
  kills: number;
  lost: number;
}

/** Per-type lines: the members of one type added up, with the worst state shown. */
export function memberLines(g: AirGroupView): MemberLine[] {
  const out: MemberLine[] = [];
  for (const t of typesIn(g)) {
    const ms = g.members.filter((m) => m.type === t);
    const flying = ms.find((m) => inSortie(m.phase));
    const rest = ms.find((m) => m.phase === WP_REARM || m.phase === WP_FERRY);
    const rep = flying ?? rest ?? ms[0];
    out.push({
      type: t,
      planes: ms.reduce((a, m) => a + m.planes, 0),
      full: ms.reduce((a, m) => a + m.full, 0),
      state: memberStateKey(rep?.phase ?? WP_GROUND, g.planes[t]),
      kills: ms.reduce((a, m) => a + m.kills, 0),
      lost: ms.reduce((a, m) => a + m.lost, 0),
    });
  }
  return out;
}

/** The farthest range among the group's types, km (the ellipse the map shows), and every type's. */
export function groupRanges(g: AirGroupView): { type: number; km: number }[] {
  return typesIn(g)
    .map((t) => ({ type: t, km: g.rangeKm[t] ?? 0 }))
    .filter((r) => r.km > 0);
}

/** Regions' ids a map glow shows for the group's zones (land members, else sea). */
export function zoneGlow(
  ctx: NavyCtx,
  g: Pick<AirGroupView, "zones">,
): { kind: "sea" | "land"; ids: number[] } | null {
  const land: number[] = [];
  const sea: number[] = [];
  for (const sr of g.zones) {
    const s = ctx.scenario.sr(sr);
    if (s === undefined) continue;
    (s.kind === "land" ? land : sea).push(...s.members);
  }
  if (land.length > 0) return { kind: "land", ids: land };
  if (sea.length > 0) return { kind: "sea", ids: sea };
  return null;
}
