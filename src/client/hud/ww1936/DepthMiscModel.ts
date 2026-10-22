// P6 lane U5 (plan Task 14): congress, balance of power, faction rules,
// naval treaty, relation lines, the continuous-focus band, the region, army
// and fleet card additions and the depth notices (spec §20.10–§20.11). Pure
// data and text from the views: no Lit, no engine. The screens render it.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BOP_TAGS,
  CFOCUS_LOCK_DAYS,
  CFOCUS_UNLOCK_DATE,
  CFOCUS_UNLOCK_FOCUSES,
  CONTINUOUS_FOCUSES,
  type ContinuousFocus,
  DAMS,
  FACILITY_IDS,
  FACTION_GOALS,
  FACTION_RULES,
  FM_TRAITS,
  HARBOR_DAYS,
  ID_CIVIL,
  PACK_COLUMNS,
  RAID_KINDS,
  type RaidKind,
  REINFORCE_PRIORITIES,
  ROCKET_RANGE_KM,
  WW_MAX_RAILGUNS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { ADMIRAL_TRAITS } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { intelBand } from "@openfront/engine-lib/ww1936/IntelRules";
import {
  BOP_DEFS,
  bopBand,
  cfocusBlock,
  cfocusOpen,
  CONGRESS,
} from "@openfront/engine-lib/ww1936/MechRules";
import { isNoStrike, strikeBlock } from "@openfront/engine-lib/ww1936/NoStrike";
import {
  RAID_TARGETS,
  rocketTargetBlock,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import {
  LANDMARK_STATS,
  scorchBlock,
} from "@openfront/engine-lib/ww1936/WorldRules";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { fogModelOf } from "./FogModel";
import {
  canAct,
  nameOf,
  politicsInput,
  relationBase,
  statLines,
} from "./PoliticsModel";
import { countryName, dateLabel, enemiesOf, today } from "./WorldWarModel";

// ---- Congress (spec §13.1) ----

export interface CongressBar {
  bp: number;
  pct: number;
  /** The three thresholds (50 / 60 / 70) and whether the support has reached each. */
  marks: { pct: number; passed: boolean; gate: string }[];
}

/** The decisions the congress tab lists (spec §13.1). */
export const CONGRESS_DECISIONS: readonly string[] = [
  "usa_lobby_congress",
  "usa_fireside_chat",
  "usa_defense_bill",
];

/**
 * The balance-of-power decisions of each tag: K5's ids (W3 reads the same;
 * only the band spirits carry the `bop_` prefix).
 */
export const BOP_DECISIONS: Readonly<Record<string, readonly string[]>> = {
  CHN: ["chn_central_officers", "chn_regional_appeasement"],
  JPN: ["jpn_army_budget", "jpn_navy_budget"],
  FRA: ["fra_social_reform", "fra_rearmament_act"],
};

/** Whether `id` is one of `tag`'s balance-of-power decisions. */
export function isBopDecision(tag: string, id: string): boolean {
  return BOP_DECISIONS[tag]?.includes(id) ?? false;
}

// ---- Balance of power (spec §13.2) ----

export interface BopBar {
  tag: (typeof BOP_TAGS)[number];
  valuePm: number;
  /** The marker's place on the bar, 0..1. */
  pos: number;
  /** The current band 0..4 (far left … far right). */
  band: number;
  /** The spirit id of each band (null: none). */
  spirits: readonly (string | null)[];
  spirit: string | null;
}

export interface FactionRuleRow {
  rule: (typeof FACTION_RULES)[number];
  on: boolean;
  /** I am the leader and may toggle it (two taps). */
  canToggle: boolean;
  order: WwOrder;
}

export interface GoalSlot {
  slot: number;
  goal: (typeof FACTION_GOALS)[number] | null;
  achieved: boolean;
  /** The goals the leader may still pick for an empty slot. */
  options: (typeof FACTION_GOALS)[number][];
  canPick: boolean;
}

export interface TreatyRows {
  member: boolean;
  members: { id: number; tag: CountryTag; name: string }[];
  escalated: boolean;
  ended: boolean;
  endDate: string;
}

export interface RelationRow {
  id: number;
  tag: CountryTag;
  name: string;
  value: number;
}

export interface CfocusChip {
  id: ContinuousFocus;
  selected: boolean;
  /** Dimmed and not tappable. */
  disabled: boolean;
}

export interface CfocusBand {
  open: boolean;
  done: number;
  need: number;
  unlockDate: string;
  current: ContinuousFocus | null;
  /** Days left of the lock after a change; 0: none. */
  lockLeft: number;
  chips: CfocusChip[];
}

export interface RegionLine {
  id: string;
  text: string;
  tone: "info" | "warn";
}

export interface ArmyExtraButton {
  id: "raid" | "railgun" | "medal" | "priority";
  label: string;
  /** The order a tap sends; null: it opens a picker. */
  order: WwOrder | null;
}

export interface FleetChip {
  mission: "lay_mines" | "sweep_mines";
}

export interface RaidTarget {
  building: BuildingId;
  facility: boolean;
}

const FACILITY_BUILDINGS: ReadonlySet<BuildingId> = new Set(FACILITY_IDS);

/** The notices of §20.11 plus the plan's three. */
export const DEPTH_NOTICE_KEYS: readonly string[] = [
  "ww1936_mastery_level",
  "ww1936_design_saved",
  "ww1936_mio_size",
  "ww1936_licence_granted",
  "ww1936_licence_denied",
  "ww1936_licence_ended",
  "ww1936_market_sale",
  "ww1936_operative_captured",
  "ww1936_operation_done",
  "ww1936_operation_failed",
  "ww1936_decrypted",
  "ww1936_codes_broken",
  "ww1936_project_milestone",
  "ww1936_project_done",
  "ww1936_nuke_dropped",
  "ww1936_nuke_intercepted",
  "ww1936_rocket_strike",
  "ww1936_raid_result",
  "ww1936_dam_destroyed",
  "ww1936_scorched",
  "ww1936_ace",
  "ww1936_energy_shortage",
  "ww1936_congress_threshold",
  "ww1936_faction_goal",
  "ww1936_trait_unlocked",
  "ww1936_fm_promoted",
  "ww1936_operative_released",
];

/** Notices drawn in the world-news colour (everyone gets them). */
const WORLD_NEWS: ReadonlySet<string> = new Set([
  "events_display.ww1936_nuke_dropped",
  "events_display.ww1936_dam_destroyed",
]);

export function isWorldNewsNotice(message: string): boolean {
  return WORLD_NEWS.has(message);
}

/**
 * The content-id args of the depth notices (t21-keys.md) and the key
 * prefix that names each. Other args (country, region, general, name,
 * design, counts) come translated, resolved by EventsDisplay (countries
 * from …Tag, regions and generals from ids) or numeric; an arg that is not
 * an id is passed through. A design is its own name (a player's or the
 * automatic one), never a content id.
 */
export const NOTICE_ID_PARAMS: Readonly<Record<string, string>> = {
  domain: "ww1936.doctrine.tab",
  track: "ww1936.track",
  mio: "ww1936.mio_family",
  item: "ww1936.equip",
  op: "ww1936.op",
  project: "ww1936.project",
  goal: "ww1936.faction_goal",
};

const ID_LIKE = /^[a-z][a-z0-9_]*$/;

/** A trait id's name key: field marshal, admiral or general (P2's keys). */
function traitKey(id: string): string {
  if ((FM_TRAITS as readonly string[]).includes(id)) {
    return `ww1936.fm_trait.${id}`;
  }
  if ((ADMIRAL_TRAITS as readonly string[]).includes(id)) {
    return `ww1936.admiral_trait.${id}`;
  }
  return `ww1936.trait.${id}`;
}

/** Depth notices: ids in their params become the viewer's language. */
export function depthNoticeParams(
  message: string,
  params: Record<string, string | number>,
): Record<string, string | number> {
  const name = message.replace("events_display.", "");
  if (!DEPTH_NOTICE_KEYS.includes(name)) return params;
  let out = params;
  for (const [k, prefix] of Object.entries(NOTICE_ID_PARAMS)) {
    const v = params[k];
    if (typeof v === "string" && ID_LIKE.test(v)) {
      const sep = k === "domain" ? "_" : ".";
      out = { ...out, [k]: translateText(`${prefix}${sep}${v}`) };
    }
  }
  if (typeof params.trait === "string" && ID_LIKE.test(params.trait)) {
    out = { ...out, trait: translateText(traitKey(params.trait)) };
  }
  // Operatives go by codename number (K5's ww1936.codename.c<n>), aces by
  // their wing's number (W2: ww1936.ace.callsign {n}).
  if (typeof params.codename === "number") {
    out = {
      ...out,
      codename: translateText(`ww1936.codename.c${params.codename}`),
    };
  }
  if (typeof params.callsign === "number") {
    out = {
      ...out,
      callsign: translateText("ww1936.ace.callsign", { n: params.callsign }),
    };
  }
  return out;
}

/** Pack focuses sit in columns 20..35 of the tree canvas. */
export function isPackFocus(f: { x: number }): boolean {
  return f.x >= PACK_COLUMNS[0] && f.x <= PACK_COLUMNS[1];
}

/** The first pack card (top row, leftmost); -1 if none. */
export function packFirst(tree: readonly { x: number; y: number }[]): number {
  let best = -1;
  tree.forEach((f, i) => {
    if (!isPackFocus(f)) return;
    const b = tree[best];
    if (best === -1 || f.y < b.y || (f.y === b.y && f.x < b.x)) best = i;
  });
  return best;
}

const MEMO = new WeakMap<object, Map<string, { key: unknown[]; v: unknown }>>();

/** Recomputes only when `key` changed: the panels redraw often, the data moves daily. */
function memo<T>(view: object, slot: string, key: unknown[], make: () => T): T {
  let m = MEMO.get(view);
  if (m === undefined) MEMO.set(view, (m = new Map()));
  const hit = m.get(slot);
  if (hit !== undefined && hit.key.every((k, n) => k === key[n])) {
    return hit.v as T;
  }
  const v = make();
  m.set(slot, { key, v });
  return v;
}

export class DepthMiscModel {
  constructor(readonly view: GameView) {}

  private me(): number {
    return this.view.myPlayer?.()?.smallID() ?? 0;
  }

  private myTag(): CountryTag | null {
    return this.view.myPlayer?.()?.countryTag() ?? null;
  }

  /** The United States' congress support; null for everyone else. */
  congressBar(): CongressBar | null {
    const d = this.view.wwDepth?.() ?? null;
    if (d === null || this.myTag() !== "USA") return null;
    const bp = d.congressBp;
    const gates: [number, string][] = [
      [CONGRESS.laws, "laws"],
      [CONGRESS.declare, "declare"],
      [CONGRESS.faction, "faction"],
    ];
    return {
      bp,
      pct: Math.floor(bp / 100),
      marks: gates.map(([v, gate]) => ({
        pct: Math.floor(v / 100),
        passed: bp >= v,
        gate,
      })),
    };
  }

  /** My country's balance-of-power bar (China, Japan, France); null otherwise. */
  bopBar(tag: string): BopBar | null {
    const d = this.view.wwDepth?.() ?? null;
    if (d === null || this.myTag() !== tag) return null;
    const i = BOP_DEFS.findIndex((b) => b.tag === tag);
    if (i < 0) return null;
    const v = d.bopData.find((x) => x[0] === i)?.[1] ?? BOP_DEFS[i].startPm;
    const band = bopBand(v);
    return {
      tag: BOP_DEFS[i].tag,
      valuePm: v,
      pos: Math.max(0, Math.min(1, (v + 1000) / 2000)),
      band,
      spirits: BOP_DEFS[i].spirits,
      spirit: BOP_DEFS[i].spirits[band],
    };
  }

  private factionIdx(): number {
    return this.view.wwPolitics?.()?.factionIdx(this.me()) ?? -1;
  }

  private amLeader(): boolean {
    const f = this.factionIdx();
    if (f < 0) return false;
    const g = this.view.wwPolitics?.()?.global;
    return g?.factions.find((x) => x.idx === f)?.leader === this.me();
  }

  /** The three faction rules of my faction; empty without one. */
  factionRuleRows(): FactionRuleRow[] {
    const d = this.view.wwDepth?.() ?? null;
    const f = this.factionIdx();
    if (d === null || f < 0) return [];
    const leader = this.amLeader();
    return FACTION_RULES.map((rule, n) => {
      const on = d.factionRulesData.some(
        (r) => r[0] === f && r[1] === n && r[2],
      );
      return {
        rule,
        on,
        canToggle: leader,
        order: { kind: "faction_rule", rule, on: !on },
      };
    });
  }

  /** My faction's three goal slots. */
  goalSlots(): GoalSlot[] {
    const d = this.view.wwDepth?.() ?? null;
    const f = this.factionIdx();
    if (d === null || f < 0) return [];
    const row = d.factionGoalsData.find((g) => g[0] === f);
    const slots = row?.[1] ?? [];
    const achieved = row?.[2] ?? 0;
    const leader = this.amLeader();
    const taken = new Set(slots);
    return [0, 1, 2].map((slot) => {
      const g = slots[slot];
      const set = g !== undefined && g >= 0;
      return {
        slot,
        goal: set ? FACTION_GOALS[g] : null,
        achieved: set && (achieved & (1 << g)) !== 0,
        options: FACTION_GOALS.filter(
          (_, n) => !taken.has(n) && (achieved & (1 << n)) === 0,
        ),
        canPick: leader && !set,
      };
    });
  }

  /** The naval treaty: its members, whether I am one, when it ends. */
  treatyRows(): TreatyRows {
    const d = this.view.wwDepth?.() ?? null;
    const t = d?.treatyData ?? { members: [], escalated: false, endDay: 0 };
    const sc = this.view.worldWarScenario?.() ?? null;
    const members = t.members.flatMap((id) => {
      const tag = sc?.tagOfSmallId(id);
      return tag === undefined ? [] : [{ id, tag, name: countryName(tag) }];
    });
    const day = sc === null ? 0 : today(this.view);
    return {
      member: members.some((m) => m.id === this.me()),
      members,
      escalated: t.escalated,
      ended: t.endDay > 0 && day >= t.endDay,
      endDate: t.endDay > 0 ? dateLabel(t.endDay) : "",
    };
  }

  /** The five countries that think best and the five that think worst of me. */
  relationRows(): { best: RelationRow[]; worst: RelationRow[] } {
    return memo(
      this.view,
      "relations",
      [
        this.view.wwPolitics?.()?.version,
        this.view.wwDepth?.()?.version,
        this.view.worldWarScenario?.() ? today(this.view) : 0,
      ],
      () => this.computeRelations(),
    );
  }

  private computeRelations(): { best: RelationRow[]; worst: RelationRow[] } {
    const i = politicsInput(this.view);
    const sc = this.view.worldWarScenario?.() ?? null;
    if (i === null || sc === null) return { best: [], worst: [] };
    const rows: RelationRow[] = [];
    for (const tag of sc.scenarioTags()) {
      const id = sc.smallIdOf(tag);
      if (id === i.me || sc.isDormantSlot(id)) continue;
      const v = relationBase(i, id, i.me);
      if (v === null) continue;
      rows.push({ id, tag, name: nameOf(i.game, id), value: v });
    }
    rows.sort((a, b) => b.value - a.value || a.id - b.id);
    const best = rows.slice(0, 5);
    const worst = rows
      .slice(5)
      .slice(-5)
      .sort((a, b) => a.value - b.value || a.id - b.id);
    return { best, worst };
  }

  /** The continuous-focus band above the tree. */
  cfocusBand(): CfocusBand | null {
    const d = this.view.wwDepth?.() ?? null;
    const id = this.me();
    const det = d?.detail(id);
    if (det === undefined) return null;
    const pol = this.view.wwPolitics?.()?.detail(id) ?? null;
    const done = (pol?.cards ?? []).filter(
      (c) => c.state === 1 || c.state === 2,
    ).length;
    const day = today(this.view);
    // W3's rules (MechRules): open after 10 focuses, on 1939-01-01 or by
    // an effect; a pick is refused while closed, locked or already running.
    const open = cfocusOpen(done, day, det.mech.cfocusOpen);
    const cur = det.mech.cfocus;
    const lockUntil = det.mech.cfocusLock;
    const lockLeft = open
      ? Math.max(0, Math.min(CFOCUS_LOCK_DAYS, lockUntil - day))
      : 0;
    return {
      open,
      done,
      need: CFOCUS_UNLOCK_FOCUSES,
      unlockDate: dateLabel(dayOfDate(CFOCUS_UNLOCK_DATE)),
      current: cur >= 0 ? CONTINUOUS_FOCUSES[cur] : null,
      lockLeft,
      chips: CONTINUOUS_FOCUSES.map((cid, n) => ({
        id: cid,
        selected: n === cur,
        // The running one can be cleared while open (cfocus_clear).
        disabled:
          n === cur
            ? !open
            : cfocusBlock({ open, current: cur, lockUntil, day, want: n }) !==
              null,
      })),
    };
  }

  /** The depth lines of a region card (landmark, dam, facility, plant, deposits, status). */
  regionLines(region: number): RegionLine[] {
    return memo(
      this.view,
      "region",
      [
        region,
        this.view.wwDepth?.()?.version,
        this.view.wwEconomy?.()?.version,
        this.view.worldWarScenario?.() ? today(this.view) : 0,
      ],
      () => this.computeRegionLines(region),
    );
  }

  private computeRegionLines(region: number): RegionLine[] {
    const sc = this.view.worldWarScenario?.() ?? null;
    const d = this.view.wwDepth?.() ?? null;
    if (sc === null || d === null) return [];
    const out: RegionLine[] = [];
    const day = today(this.view);
    const fog = fogModelOf(this.view).regionView(region);
    for (const lm of sc.landmarksOf(region)) {
      out.push({
        id: lm,
        text: translateText("ww1936.region_status.landmark_effect", {
          name: translateText(`ww1936.landmark.${lm}`),
          effect: statLines(LANDMARK_STATS[lm]).join(", "),
        }),
        tone: "info",
      });
    }
    const dam = sc.damOf(region);
    if (dam >= 0) {
      out.push({
        id: "dam",
        text: translateText("ww1936.region_status.dam_effect", {
          name: translateText(`ww1936.dam.${DAMS[dam]}`),
          effect:
            fog.buildings === "hidden"
              ? "?"
              : fog.label(d.worldData.damLevel[dam] ?? 0),
        }),
        tone: "info",
      });
    }
    const econ = this.view.wwEconomy?.()?.region(region);
    if (econ !== undefined && fog.buildings !== "hidden") {
      if (econ.facility > 0) {
        out.push({
          id: "facility",
          text: translateText("ww1936.region_status.facility", {
            name: translateText(
              `ww1936.facility.${FACILITY_IDS[econ.facility - 1]}`,
            ),
          }),
          tone: "info",
        });
      }
      if (econ.powerPlant > 0) {
        out.push({
          id: "plant",
          text: translateText("ww1936.region_status.power_plant", {
            n: fog.label(econ.powerPlant),
          }),
          tone: "info",
        });
      }
    }
    for (const [key, n] of [
      ["coal", sc.coalOf(region)],
      ["uranium", sc.uraniumOf(region)],
      ["hydro", sc.hydroOf(region)],
    ] as const) {
      if (n > 0) {
        out.push({
          id: key,
          text: translateText(`ww1936.region_status.${key}`, { n }),
          tone: "info",
        });
      }
    }
    const left = (list: readonly (readonly number[])[]) => {
      const x = list.find((e) => e[0] === region);
      return x === undefined ? -1 : x[1] - day;
    };
    const nuked = left(d.worldData.nuked);
    if (nuked > 0) {
      out.push({
        id: "nuked",
        text: translateText("ww1936.region_status.nuked", { days: nuked }),
        tone: "warn",
      });
    }
    if (left(d.worldData.scorched) > 0) {
      out.push({
        id: "scorched",
        text: translateText("ww1936.region_status.scorched"),
        tone: "warn",
      });
    }
    const flood = left(d.worldData.flooded);
    if (flood > 0) {
      out.push({
        id: "flooded",
        text: translateText("ww1936.region_status.flooded", { days: flood }),
        tone: "warn",
      });
    }
    const h = d.worldData.harbors.find((x) => x[0] === region);
    if (h !== undefined && HARBOR_DAYS - (day - h[2]) > 0) {
      out.push({
        id: "harbor",
        text: translateText("ww1936.region_status.harbor", {
          days: HARBOR_DAYS - (day - h[2]),
        }),
        tone: "info",
      });
    }
    return out;
  }

  /** Whether the region is mine to scorch, whether I can launch rockets from it, and the engine-lib judges' refusals. */
  regionActions(region: number): {
    scorch: boolean;
    rocket: boolean;
    scorchBlock: string | null;
    rocketBlock: string | null;
  } {
    const econ = this.view.wwEconomy?.()?.region(region);
    const i = politicsInput(this.view);
    const sc = this.view.worldWarScenario?.() ?? null;
    if (econ === undefined || i === null || sc === null || !canAct(i)) {
      return {
        scorch: false,
        rocket: false,
        scorchBlock: null,
        rocketBlock: null,
      };
    }
    const me = this.me();
    const noStrike = isNoStrike(sc, region);
    // Sensitivity: the screens never offer Korea or Taiwan a strike or a scorch.
    if (noStrike) {
      return {
        scorch: false,
        rocket: false,
        scorchBlock: "no_strike_region",
        rocketBlock: "no_strike_region",
      };
    }
    const mine = econ.controller === me;
    const eco = this.view.wwEconomy?.();
    const enemies = enemiesOf(this.view, me);
    const enemyAdjacent = sc
      .regionNeighbours(region)
      .some((n) => enemies.includes(eco?.region(n).controller ?? 0));
    const scorchBlockId = scorchBlock({
      legalOwner: i.view.legalOwner[region] === me,
      controls: mine,
      enemyAdjacent,
      pp: Math.floor((i.view.summary(me)?.ppMilli ?? 0) / 1000),
      queued: false,
      noStrike,
    });
    const rocketBlockId =
      strikeBlock(sc, region) ??
      rocketTargetBlock({ km: 0, rangeKm: ROCKET_RANGE_KM[0], noStrike });
    return {
      scorch: mine,
      rocket: mine && econ.rocketSite > 0,
      scorchBlock: scorchBlockId,
      rocketBlock: rocketBlockId,
    };
  }

  /** The army card's extra buttons ([raid], [rail guns n/2], [medal], [priority]); mine only. */
  armyButtons(armyId: number): ArmyExtraButton[] {
    const land = this.view.wwLand?.() ?? null;
    const a = land?.armies.get(armyId);
    if (land === null || a === undefined || a.owner !== this.me()) return [];
    const det = land.details.get(this.me());
    const divs = (det?.divisions ?? []).filter((x) => x.army === armyId);
    const raider = divs.some((x) => {
      const t = det?.templates.find((y) => y.id === x.template);
      return (
        t?.battalions.some((b) => b === "paratrooper" || b === "marine") ??
        false
      );
    });
    // The W lanes add these two to the army summary; absent: the defaults.
    const extra = a as unknown as { railGuns?: number; priority?: number };
    const guns = extra.railGuns ?? 0;
    const prio = extra.priority ?? 1;
    const out: ArmyExtraButton[] = [];
    if (raider) {
      out.push({
        id: "raid",
        label: translateText("ww1936.raid_ui.raid"),
        order: null,
      });
    }
    out.push({
      id: "railgun",
      label: translateText("ww1936.raid_ui.railgun", {
        n: guns,
        max: WW_MAX_RAILGUNS,
      }),
      order:
        guns < WW_MAX_RAILGUNS
          ? { kind: "railgun_assign", army: armyId, count: guns + 1 }
          : { kind: "railgun_return", army: armyId },
    });
    out.push({
      id: "medal",
      label: translateText("ww1936.raid_ui.medal"),
      order: null,
    });
    out.push({
      id: "priority",
      label: translateText(
        `ww1936.raid_ui.priority_${REINFORCE_PRIORITIES[prio] ?? "normal"}`,
      ),
      order: {
        kind: "army_priority",
        army: armyId,
        value: (prio + 1) % REINFORCE_PRIORITIES.length,
      },
    });
    return out;
  }

  /** Raid targets of a kind in an enemy country: facilities only from close civil intel. */
  raidTargets(kind: RaidKind, targetOwner: number): RaidTarget[] {
    const level = this.view
      .wwDepth()
      ?.intelOf(this.me(), targetOwner, ID_CIVIL);
    const close =
      fogModelOf(this.view).fogOff() ||
      (level !== undefined && intelBand(level) >= 2);
    return RAID_TARGETS[kind]
      .filter((b) => close || !FACILITY_BUILDINGS.has(b))
      .map((b) => ({ building: b, facility: FACILITY_BUILDINGS.has(b) }));
  }

  /** The fleet card's mine chips: when a design with the module is in the owner's list. */
  fleetChips(fleetId: number): FleetChip[] {
    const f = this.view.wwNavy?.()?.fleets.get(fleetId);
    const det = (this.view.wwDepth?.() ?? null)?.detail(this.me());
    if (f === undefined || det === undefined || f.owner !== this.me()) {
      return [];
    }
    const classes = (names: string[]) =>
      f.ships.some((s) => names.includes(s.cls));
    const has = (module: string) =>
      det.designs.some(
        (x) =>
          x.kind === "ship" && !x.obsolete && x.def.modules.includes(module),
      );
    const out: FleetChip[] = [];
    if (has("mine_layer") && classes(["dd", "cl", "ss"])) {
      out.push({ mission: "lay_mines" });
    }
    if (has("minesweep") && classes(["dd", "cl"])) {
      out.push({ mission: "sweep_mines" });
    }
    return out;
  }
}

export { RAID_KINDS };
