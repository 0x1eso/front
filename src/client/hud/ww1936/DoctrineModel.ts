// World War 1936 P6 lane U1 (plan Task 10, spec §20.1–§20.4): the doctrine
// and command screens' data — the dials, the band chips, the drawer's tabs
// and the army group tab. Pure over the views (WwDepthView, WwLandView,
// WwNavyView); the client reads and sends intents, never the engine.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ARMY_SPIRIT_CATEGORIES,
  ARMY_SPIRITS,
  CP_FM_UPKEEP_MILLI,
  CP_MAX_MILLI,
  DOCTRINE_DOMAINS,
  DOCTRINE_TRACKS,
  FM_TRAITS,
  GD_DOMAIN,
  GD_SWITCH_XP,
  GRAND_DOCTRINES,
  MASTERY_LEVELS_MILLI,
  MEDAL_CP,
  MEDALS,
  SPIRIT_CAT_DOMAIN,
  SUB_SWITCH_XP,
  SUB_TRACK,
  SUBDOCTRINES,
  type WwArmyGroupData,
  type WwDepthDetail,
  type WwDepthSummary,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  GENERAL_TRAITS,
  type GeneralData,
  type GeneralTrait,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  ADMIRAL_TRAITS,
  type AdmiralTrait,
  admiralTraitBit,
  WW_ADMIRAL_TRAIT_MAX,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  ASSIGNABLE_ADMIRAL_TRAITS,
  fieldMarshalCap,
  FM_EXTRA_TRAIT_CP,
  fmEligible,
  promoteFmBlock,
  spiritCost,
  spiritPickBlock,
  traitAssignBlock,
  traitCost,
  traitSlots,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  doctrinePickBlock,
  masteryLevel,
  SUBDOCTRINE_REWARDS,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import type { GameView } from "../../view/GameView";
import { generalName, rosterName } from "./LandModel";
import { admiralDef, admiralName, admiralTraits } from "./NavyModel";
import { today } from "./WorldWarModel";

/** Whole experience points of the domains (air: not in the views, null). */
export type DomainXp = readonly [number, number, number | null];

export type DoctrineBlock =
  | "doctrine_locked"
  | "no_xp"
  | "bad_index"
  | "no_cp"
  | "no_pp"
  | "no_slot"
  | "fm_cap"
  | "not_ready";

export const DOCTRINE_BLOCK_KEYS: Readonly<Record<DoctrineBlock, string>> = {
  doctrine_locked: "ww1936.econ.block.doctrine_locked",
  no_xp: "ww1936.econ.block.no_xp",
  bad_index: "ww1936.econ.block.bad_index",
  no_cp: "ww1936.econ.block.no_cp",
  no_pp: "ww1936.econ.block.no_pp",
  no_slot: "ww1936.econ.block.trait_unavailable",
  fm_cap: "ww1936.econ.block.fm_limit",
  not_ready: "ww1936.econ.block.general_unavailable",
};

const MAX_LEVEL = 5;

export interface GdChip {
  /** GRAND_DOCTRINES index. */
  index: number;
  id: (typeof GRAND_DOCTRINES)[number];
  picked: boolean;
}

export interface SubCard {
  /** SUBDOCTRINES index. */
  index: number;
  id: (typeof SUBDOCTRINES)[number];
  picked: boolean;
  /** L1..L5 rewards. */
  rewards: readonly Partial<WwStats>[];
}

export interface TrackRow {
  /** DOCTRINE_TRACKS index. */
  track: number;
  id: (typeof DOCTRINE_TRACKS)[number];
  /** SUBDOCTRINES index, -1 none. */
  sub: number;
  level: number;
  milli: number;
  /** Fill of the stretch to the next level, 0..1. */
  fill: number;
  next: { level: number; stats: Partial<WwStats> } | null;
  days: number | null;
  /** Yesterday's gain, "0.84"; "" when none. */
  gainText: string;
  subs: SubCard[];
}

export interface DomainView {
  domain: number;
  id: (typeof DOCTRINE_DOMAINS)[number];
  /** GRAND_DOCTRINES index, -1 none. */
  picked: number;
  /** No grand doctrine yet: the tab glows "pick one". */
  unpicked: boolean;
  chips: GdChip[];
  /** Whole experience of the domain; null when the screens cannot know it. */
  xp: number | null;
  switchXp: number;
  lockDays: number;
  levelSum: number;
  tracks: TrackRow[];
}

export interface SpiritCard {
  category: number;
  id: (typeof ARMY_SPIRIT_CATEGORIES)[number];
  domain: number;
  /** ARMY_SPIRITS index, -1 none. */
  picked: number;
  options: {
    index: number;
    id: (typeof ARMY_SPIRITS)[number];
    picked: boolean;
  }[];
  cost: number;
  lockDays: number;
}

export interface TraitCandidate {
  trait: string;
  cp: number;
  block: DoctrineBlock | null;
}

export interface CommandPerson {
  id: number;
  admiral: boolean;
  name: string;
  level: number;
  slots: number;
  used: number;
  traits: string[];
  candidates: TraitCandidate[];
}

export interface MarshalRow {
  id: number;
  name: string;
  traits: string[];
  /** The group they lead; 0 none. */
  group: number;
}

export interface CpBar {
  cp: number;
  cpText: string;
  max: number;
  pct: number;
  gainMilli: number;
  upkeepMilli: number;
  marshals: number;
  cap: number;
}

export interface DoctrineDial {
  /** The lowest army track's way to its next level, 0..1. */
  progress: number;
  unpicked: number;
  points: number;
  glow: boolean;
  badge: { kind: "unpicked" | "points"; n: number } | null;
}

export interface IntelDial {
  progress: number;
  captured: number;
  idle: number;
  badge: { kind: "captured" | "idle"; n: number } | null;
}

export interface BandDepth {
  cpText: string;
  energyPct: number | null;
  congressPct: number | null;
  nukes: number | null;
}

export interface GroupRow {
  id: number;
  fm: number;
  fmName: string;
  fmTraits: string[];
  armies: number[];
}

function tenth(milli: number): string {
  const t = Math.trunc(milli / 100);
  return `${Math.trunc(t / 10)}.${Math.abs(t % 10)}`;
}

/** The level a mastery reached and the fill of the stretch to the next. */
export function levelFill(milli: number): { level: number; fill: number } {
  const level = masteryLevel(milli);
  if (level === 5) return { level, fill: 1 };
  const lo = level === 0 ? 0 : MASTERY_LEVELS_MILLI[level - 1];
  const hi = MASTERY_LEVELS_MILLI[level];
  return { level, fill: Math.max(0, Math.min(1, (milli - lo) / (hi - lo))) };
}

export function generalTraitIds(mask: number): GeneralTrait[] {
  return GENERAL_TRAITS.filter((t) => (mask & traitBit(t)) !== 0);
}

/** Lane D's field marshal flag (GeneralData.fm; a marshal's army is -1). */
export function isMarshal(g: GeneralData): boolean {
  return g.fm === true;
}

export function marshalTraitIds(g: GeneralData): string[] {
  const mask = g.fmTraits ?? 0;
  return FM_TRAITS.filter((_, i) => (mask & (1 << i)) !== 0);
}

/** A K5 START_FIELD_MARSHALS row names this general of `tag` on `day` (as lane D's listedFm). */
function listedMarshal(
  tag: string | null,
  g: GeneralData,
  day: number,
): boolean {
  if (tag === null || g.key === "") return false;
  return CONTENT.startFieldMarshals.some(
    (r) =>
      r.tag === tag &&
      r.general === g.key &&
      (r.from === undefined || dayOfDate(r.from) <= day) &&
      (r.until === undefined || day < dayOfDate(r.until)),
  );
}

/** Spec §4.3 (lane D's fmEligible): level 3, abilities summing to 12, or a K5 row. */
export function promotable(
  g: GeneralData,
  tag: string | null = null,
  day = 0,
): boolean {
  return fmEligible(
    g.level,
    g.att + g.def + g.plan + g.log,
    listedMarshal(tag, g, day),
  );
}

interface Ctx {
  game: GameView;
  me: number;
  day: number;
  detail: WwDepthDetail;
  sum: WwDepthSummary | undefined;
}

export class DoctrineModel {
  constructor(readonly view: GameView) {}

  /** Command power an extra marshal trait costs (spec §4.2). */
  readonly fmTraitCp = FM_EXTRA_TRAIT_CP;

  private ctx(): Ctx | null {
    const depth = this.view.wwDepth?.() ?? null;
    const me = this.view.myPlayer();
    if (depth === null || me === null) return null;
    const detail = depth.detail(me.smallID());
    if (detail === undefined) return null;
    return {
      game: this.view,
      me: me.smallID(),
      day: this.view.worldWarScenario() ? today(this.view) : 0,
      detail,
      sum: depth.summary(me.smallID()),
    };
  }

  ready(): boolean {
    return this.ctx() !== null;
  }

  /** Changes when a view the screens read changes (they redraw on it). */
  version(): string {
    const g = this.view;
    return [
      g.wwDepth?.()?.version,
      g.wwLand?.()?.version,
      g.wwNavy?.()?.version,
      g.wwPolitics?.()?.version,
      this.view.worldWarScenario() ? today(this.view) : 0,
    ].join("|");
  }

  /** Lane D's detail.doctrine.xp (army, navy, air), whole points. */
  private xp(c: Ctx): DomainXp {
    const x = c.detail.doctrine.xp;
    if (x !== undefined) return [x[0] ?? 0, x[1] ?? 0, x[2] ?? 0];
    const land = c.game.wwLand?.()?.details.get(c.me)?.armyXpMilli ?? 0;
    const navy = c.game.wwNavy?.()?.detail?.navyXpMilli ?? 0;
    return [Math.floor(land / 1000), Math.floor(navy / 1000), null];
  }

  private pp(c: Ctx): number | null {
    const s = c.game.wwPolitics?.()?.summary(c.me);
    return s === undefined || s === null ? null : Math.floor(s.ppMilli / 1000);
  }

  // ---- The doctrine tabs (spec §20.3 tabs 1–3) ----

  domains(): DomainView[] {
    const c = this.ctx();
    if (c === null) return [];
    return DOCTRINE_DOMAINS.map((_, d) => this.domainOf(c, d));
  }

  private domainOf(c: Ctx, domain: number): DomainView {
    const doc = c.detail.doctrine;
    const picked = doc.gd[domain] ?? -1;
    const chips: GdChip[] = [];
    GRAND_DOCTRINES.forEach((id, index) => {
      if (GD_DOMAIN[index] === domain) {
        chips.push({ index, id, picked: index === picked });
      }
    });
    const tracks = this.trackRowsOf(c, domain);
    const lock = doc.gdLock[domain] ?? -1;
    return {
      domain,
      id: DOCTRINE_DOMAINS[domain],
      picked,
      unpicked: picked < 0,
      chips,
      xp: this.xp(c)[domain],
      switchXp: GD_SWITCH_XP[domain],
      lockDays: lock > c.day ? lock - c.day : 0,
      levelSum: tracks.reduce((a, t) => a + t.level, 0),
      tracks,
    };
  }

  /** The domain's three track rows: level, next reward and days. */
  trackRows(domain: number): TrackRow[] {
    const c = this.ctx();
    return c === null ? [] : this.trackRowsOf(c, domain);
  }

  private trackRowsOf(c: Ctx, domain: number): TrackRow[] {
    const doc = c.detail.doctrine;
    const rows: TrackRow[] = [];
    for (let track = domain * 3; track < domain * 3 + 3; track++) {
      const milli = doc.masteryMilli[track] ?? 0;
      const { level, fill } = levelFill(milli);
      const sub = doc.sub[track] ?? -1;
      const gain = doc.gainMilli[track] ?? 0;
      const subs: SubCard[] = [];
      SUBDOCTRINES.forEach((id, index) => {
        if (SUB_TRACK[index] === track) {
          subs.push({
            index,
            id,
            picked: index === sub,
            rewards: SUBDOCTRINE_REWARDS[id],
          });
        }
      });
      rows.push({
        track,
        id: DOCTRINE_TRACKS[track],
        sub,
        level,
        milli,
        fill,
        next: this.rewardOf(sub, level),
        days: this.daysOf(milli, gain),
        gainText: gain > 0 ? (gain / 1000).toFixed(2) : "",
        subs,
      });
    }
    return rows;
  }

  private rewardOf(
    sub: number,
    level: number,
  ): { level: number; stats: Partial<WwStats> } | null {
    if (sub < 0 || level >= MAX_LEVEL) return null;
    return {
      level: level + 1,
      stats: SUBDOCTRINE_REWARDS[SUBDOCTRINES[sub]][level] ?? {},
    };
  }

  private daysOf(milli: number, gain: number): number | null {
    const level = masteryLevel(milli);
    if (level === 5 || gain <= 0) return null;
    return Math.ceil((MASTERY_LEVELS_MILLI[level] - milli) / gain);
  }

  /** The reward the track's next level gives (null at the top or with no sub-doctrine). */
  nextReward(track: number): { level: number; stats: Partial<WwStats> } | null {
    const c = this.ctx();
    if (c === null) return null;
    return this.rewardOf(
      c.detail.doctrine.sub[track] ?? -1,
      masteryLevel(c.detail.doctrine.masteryMilli[track] ?? 0),
    );
  }

  /** Days to the next level at yesterday's gain; null when it does not grow or is full. */
  daysToNext(track: number): number | null {
    const c = this.ctx();
    if (c === null) return null;
    return this.daysOf(
      c.detail.doctrine.masteryMilli[track] ?? 0,
      c.detail.doctrine.gainMilli[track] ?? 0,
    );
  }

  /**
   * Why a grand doctrine (`{domain, gd}`) or sub-doctrine (`{track, sub}`)
   * cannot be picked now (the engine's own check), the xp it costs and how
   * many days it stays locked. `switching`: it replaces another pick.
   */
  pickBlock(
    what: { domain: number; gd: number } | { track: number; sub: number },
  ): {
    block: "doctrine_locked" | "no_xp" | "bad_index" | null;
    xpCost: number;
    lockDays: number;
    switching: boolean;
  } {
    const c = this.ctx();
    if (c === null) {
      return { block: null, xpCost: 0, lockDays: 0, switching: false };
    }
    const doc = c.detail.doctrine;
    const xp = this.xp(c);
    if ("gd" in what) {
      const current = doc.gd[what.domain] ?? -1;
      const lock = doc.gdLock[what.domain] ?? -1;
      return {
        block: doctrinePickBlock({
          domain: what.domain,
          gd: what.gd,
          current,
          lockUntil: lock,
          day: c.day,
          xp: xp[what.domain] ?? Number.MAX_SAFE_INTEGER,
        }),
        xpCost: current >= 0 ? GD_SWITCH_XP[what.domain] : 0,
        lockDays: current >= 0 && lock > c.day ? lock - c.day : 0,
        switching: current >= 0,
      };
    }
    const domain = Math.floor(what.track / 3);
    const current = doc.sub[what.track] ?? -1;
    const lock = doc.subLock[what.track] ?? -1;
    return {
      block: doctrinePickBlock({
        domain,
        gd: -1,
        current: -1,
        lockUntil: lock,
        day: c.day,
        xp: xp[domain] ?? Number.MAX_SAFE_INTEGER,
        track: what.track,
        sub: what.sub,
        currentSub: current,
      }),
      xpCost: current >= 0 ? SUB_SWITCH_XP : 0,
      lockDays: current >= 0 && lock > c.day ? lock - c.day : 0,
      switching: current >= 0,
    };
  }

  gdOrder(domain: number, gd: number): WwOrder {
    return {
      kind: "doctrine_pick",
      domain: DOCTRINE_DOMAINS[domain],
      id: GRAND_DOCTRINES[gd],
    };
  }

  subOrder(track: number, sub: number): WwOrder {
    return {
      kind: "subdoctrine_pick",
      track: DOCTRINE_TRACKS[track],
      id: SUBDOCTRINES[sub],
    };
  }

  // ---- Officer corps (tab 4) ----

  spiritCards(): SpiritCard[] {
    const c = this.ctx();
    if (c === null) return [];
    return ARMY_SPIRIT_CATEGORIES.map((id, category) => {
      const picked = c.detail.command.spirits[category] ?? -1;
      const lock = c.detail.command.spiritLock[category] ?? -1;
      return {
        category,
        id,
        domain: SPIRIT_CAT_DOMAIN[category],
        picked,
        options: [0, 1, 2].map((k) => ({
          index: category * 3 + k,
          id: ARMY_SPIRITS[category * 3 + k],
          picked: category * 3 + k === picked,
        })),
        cost: spiritCost(picked),
        lockDays: picked >= 0 && lock > c.day ? lock - c.day : 0,
      };
    });
  }

  /** Lane D's spiritPickBlock (the engine's own check). */
  spiritBlock(category: number, index: number): DoctrineBlock | null {
    const c = this.ctx();
    if (c === null) return "not_ready";
    const card = this.spiritCards()[category];
    if (card === undefined) return "bad_index";
    const have = this.xp(c)[card.domain];
    return spiritPickBlock({
      category,
      spirit: index,
      current: card.picked,
      lockUntil: c.detail.command.spiritLock[category] ?? -1,
      day: c.day,
      xp: have ?? Number.MAX_SAFE_INTEGER,
    });
  }

  spiritOrder(category: number, index: number): WwOrder {
    return {
      kind: "army_spirit_pick",
      category: ARMY_SPIRIT_CATEGORIES[category],
      id: ARMY_SPIRITS[index],
    };
  }

  // ---- Command (tab 5) ----

  cpBar(): CpBar | null {
    const c = this.ctx();
    if (c === null) return null;
    const land = c.game.wwLand?.()?.countries.get(c.me);
    const marshals = c.sum?.fieldMarshals ?? 0;
    const cp = c.detail.command.cpMilli;
    return {
      cp: Math.floor(cp / 1000),
      cpText: tenth(cp),
      max: CP_MAX_MILLI / 1000,
      pct: Math.max(0, Math.min(100, Math.floor((cp * 100) / CP_MAX_MILLI))),
      gainMilli: c.detail.command.cpGainMilli,
      upkeepMilli: CP_FM_UPKEEP_MILLI * marshals,
      marshals,
      cap: fieldMarshalCap(land?.divisions ?? 0),
    };
  }

  /** Generals and admirals; those with something to buy first. */
  commandPeople(): CommandPerson[] {
    const c = this.ctx();
    if (c === null) return [];
    const out: CommandPerson[] = [];
    const land = c.game.wwLand?.()?.details.get(c.me);
    for (const g of land?.generals ?? []) {
      if (isMarshal(g)) continue;
      const traits = generalTraitIds(g.traits);
      out.push({
        id: g.id,
        admiral: false,
        name: rosterName(g),
        level: g.level,
        slots: traitSlots(g.level),
        used: traits.length,
        traits,
        candidates: this.generalCandidates(c, g),
      });
    }
    const navy = c.game.wwNavy?.()?.detail;
    for (const [id] of navy?.admirals ?? []) {
      const row = navy?.admiralSkills?.find((x) => x[0] === id);
      const traits: AdmiralTrait[] =
        row !== undefined
          ? ADMIRAL_TRAITS.filter((t) => (row[5] & admiralTraitBit(t)) !== 0)
          : admiralTraits(admiralDef(id));
      const level = row?.[6] ?? 0;
      out.push({
        id,
        admiral: true,
        name: admiralName(id),
        level,
        slots: WW_ADMIRAL_TRAIT_MAX,
        used: traits.length,
        traits,
        candidates: this.admiralCandidates(c, level, traits),
      });
    }
    const rank = (p: CommandPerson) =>
      p.candidates.some((t) => t.block === null) ? 0 : 1;
    return out.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  }

  /** The traits a general (or an admiral) could be given: those whose conditions hold, each with why not now. */
  traitCandidates(general: number, admiral = false): TraitCandidate[] {
    return (
      this.commandPeople().find(
        (p) => p.id === general && p.admiral === admiral,
      )?.candidates ?? []
    );
  }

  /**
   * The traits lane D's traitAssignBlock lets this person take once there
   * is room and command power, each with why not now: "no_cp", or
   * "no_slot" when only the slots refuse it.
   */
  private candidatesOf(
    c: Ctx,
    admiral: boolean,
    pool: readonly string[],
    base: {
      level: number;
      traits: readonly string[];
      slots: number;
      isFm: boolean;
      fmTraits: readonly string[];
    },
  ): TraitCandidate[] {
    const out: TraitCandidate[] = [];
    for (const t of pool) {
      const judge = (cpMilli: number, slots: number) =>
        traitAssignBlock({ ...base, admiral, trait: t, cpMilli, slots });
      // Room and power aside, the trait must be open to him.
      const open = admiral
        ? base.level >= 2 && !base.traits.includes(t)
        : judge(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) === null;
      if (!open) continue;
      const real = judge(c.detail.command.cpMilli, base.slots);
      out.push({
        trait: t,
        cp: traitCost(t, admiral),
        block:
          real === null
            ? null
            : real === "no_cp"
              ? "no_cp"
              : ("no_slot" as const),
      });
    }
    return out;
  }

  private generalCandidates(c: Ctx, g: GeneralData): TraitCandidate[] {
    return this.candidatesOf(c, false, GENERAL_TRAITS, {
      level: g.level,
      traits: generalTraitIds(g.traits),
      slots: traitSlots(g.level),
      isFm: isMarshal(g),
      fmTraits: marshalTraitIds(g),
    });
  }

  private admiralCandidates(
    c: Ctx,
    level: number,
    held: readonly AdmiralTrait[],
  ): TraitCandidate[] {
    return this.candidatesOf(c, true, ASSIGNABLE_ADMIRAL_TRAITS, {
      level,
      traits: held,
      slots: WW_ADMIRAL_TRAIT_MAX,
      isFm: false,
      fmTraits: [],
    });
  }

  /** Why a marshal cannot take field marshal trait `trait` now (lane D's traitAssignBlock); null: he can. */
  fmTraitBlock(marshal: number, trait: string): DoctrineBlock | null {
    const c = this.ctx();
    if (c === null) return "not_ready";
    const g = c.game
      .wwLand?.()
      ?.details.get(c.me)
      ?.generals.find((x) => x.id === marshal);
    if (g === undefined) return "not_ready";
    const b = traitAssignBlock({
      admiral: false,
      level: g.level,
      traits: generalTraitIds(g.traits),
      slots: traitSlots(g.level),
      trait,
      cpMilli: c.detail.command.cpMilli,
      isFm: isMarshal(g),
      fmTraits: marshalTraitIds(g),
    });
    return b === null ? null : b === "no_cp" ? "no_cp" : "no_slot";
  }

  traitOrder(general: number, trait: string, admiral: boolean): WwOrder {
    return { kind: "trait_assign", general, trait: trait as never, admiral };
  }

  /** My field marshals: the record's flag, plus those leading a group. */
  marshalRows(): MarshalRow[] {
    const c = this.ctx();
    if (c === null) return [];
    const land = c.game.wwLand?.()?.details.get(c.me);
    const rows = new Map<number, MarshalRow>();
    for (const g of land?.generals ?? []) {
      if (!isMarshal(g)) continue;
      rows.set(g.id, {
        id: g.id,
        name: rosterName(g),
        traits: marshalTraitIds(g),
        group: 0,
      });
    }
    for (const gr of this.groups()) {
      const r = rows.get(gr.fm);
      if (r !== undefined) r.group = gr.id;
      else {
        rows.set(gr.fm, {
          id: gr.fm,
          name: gr.fmName,
          traits: gr.fmTraits,
          group: gr.id,
        });
      }
    }
    return [...rows.values()].sort((a, b) => a.id - b.id);
  }

  /** Generals who may be promoted, each with why not now. */
  promoteCandidates(): {
    id: number;
    name: string;
    level: number;
    block: DoctrineBlock | null;
  }[] {
    const c = this.ctx();
    const bar = this.cpBar();
    if (c === null || bar === null) return [];
    const pp = this.pp(c);
    const land = c.game.wwLand?.()?.details.get(c.me);
    const tag = c.game.myPlayer()?.countryTag?.() ?? null;
    const divisions = c.game.wwLand?.()?.countries.get(c.me)?.divisions ?? 0;
    return (land?.generals ?? [])
      .filter((g) => !isMarshal(g) && promotable(g, tag, c.day))
      .map((g) => {
        // Lane D's promoteFmBlock (serving is the engine's to judge).
        const b = promoteFmBlock({
          isFm: false,
          serves: true,
          level: g.level,
          skillSum: g.att + g.def + g.plan + g.log,
          listed: listedMarshal(tag, g, c.day),
          fieldMarshals: bar.marshals,
          divisions,
          cpMilli: c.detail.command.cpMilli,
          pp: pp ?? Number.MAX_SAFE_INTEGER,
        });
        return {
          id: g.id,
          name: rosterName(g),
          level: g.level,
          block:
            b === null
              ? null
              : b === "fm_limit"
                ? ("fm_cap" as const)
                : b === "no_cp" || b === "no_pp"
                  ? b
                  : ("not_ready" as const),
        };
      });
  }

  /** Days until `army` may get a medal again (lane D's detail.command.medalCooldown); 0: now. */
  medalDaysLeft(army: number): number {
    const c = this.ctx();
    if (c === null) return 0;
    const row = (c.detail.command.medalCooldown ?? []).find(
      (m) => m[0] === army,
    );
    return row === undefined ? 0 : Math.max(0, row[1] - c.day);
  }

  promoteOrder(general: number, trait: string): WwOrder {
    return { kind: "promote_fm", general, trait: trait as never };
  }

  medalCards(): {
    id: (typeof MEDALS)[number];
    cp: number;
    block: DoctrineBlock | null;
  }[] {
    const c = this.ctx();
    return MEDALS.map((id) => ({
      id,
      cp: MEDAL_CP,
      block:
        c === null
          ? ("not_ready" as const)
          : c.detail.command.cpMilli < MEDAL_CP * 1000
            ? ("no_cp" as const)
            : null,
    }));
  }

  // ---- The dials and the band (spec §20.1, §20.2) ----

  /** 🎖: the lowest land track's ring; a glowing badge for unpicked doctrines, else the slots you could fill. */
  dial(): DoctrineDial | null {
    const c = this.ctx();
    if (c === null) return null;
    const doc = c.detail.doctrine;
    let unpicked = 0;
    for (let d = 0; d < 3; d++) if ((doc.gd[d] ?? -1) < 0) unpicked++;
    for (let t = 0; t < 9; t++) if ((doc.sub[t] ?? -1) < 0) unpicked++;
    const lowest = Math.min(
      doc.masteryMilli[0] ?? 0,
      doc.masteryMilli[1] ?? 0,
      doc.masteryMilli[2] ?? 0,
    );
    const points = this.commandPeople().filter((p) =>
      p.candidates.some((t) => t.block === null),
    ).length;
    return {
      progress: levelFill(lowest).fill,
      unpicked,
      points,
      glow: unpicked > 0,
      badge:
        unpicked > 0
          ? { kind: "unpicked", n: unpicked }
          : points > 0
            ? { kind: "points", n: points }
            : null,
    };
  }

  /** 🕵: the running upgrade's ring; a red badge for captured operatives, else the idle ones. */
  intelDial(): IntelDial | null {
    const c = this.ctx();
    if (c === null) return null;
    const intel = c.detail.intel;
    const captured = intel.operatives.filter(
      (o) => o.state === "captured",
    ).length;
    const idle = intel.operatives.filter((o) => o.state === "idle").length;
    return {
      progress:
        intel.upId < 0
          ? 0
          : Math.max(0, Math.min(1, intel.upProgressPm / 1000)),
      captured,
      idle,
      badge:
        captured > 0
          ? { kind: "captured", n: captured }
          : idle > 0
            ? { kind: "idle", n: idle }
            : null,
    };
  }

  /** The band's chips: 🎖 command power, ⚡ energy under 100%, 🏛 US congress, ☢ my atomic bombs. */
  band(): BandDepth | null {
    const c = this.ctx();
    const me = this.view.myPlayer();
    if (c === null || me === null) return null;
    const e = c.sum?.energyPm;
    return {
      cpText: tenth(c.detail.command.cpMilli),
      energyPct: e !== undefined && e < 1000 ? Math.floor(e / 10) : null,
      congressPct:
        me.countryTag?.() === "USA"
          ? Math.floor(this.view.wwDepth!()!.congressBp / 100)
          : null,
      nukes:
        c.sum !== undefined && c.sum.atomicStock > 0 ? c.sum.atomicStock : null,
    };
  }

  // ---- Army groups (spec §20.4) ----

  groups(): GroupRow[] {
    const c = this.ctx();
    if (c === null) return [];
    const land = c.game.wwLand?.()?.details.get(c.me);
    return this.view.wwDepth!()!
      .armyGroups()
      .filter((g: WwArmyGroupData) => g.owner === c.me)
      .map((g) => {
        const gen = land?.generals.find((x) => x.id === g.fm);
        return {
          id: g.id,
          fm: g.fm,
          fmName: gen === undefined ? generalName(g.fm) : rosterName(gen),
          fmTraits: gen === undefined ? [] : marshalTraitIds(gen),
          armies: g.armies,
        };
      })
      .sort((a, b) => a.id - b.id);
  }

  /** Marshals who lead no group yet. */
  freeMarshals(): MarshalRow[] {
    return this.marshalRows().filter((m) => m.group === 0);
  }

  /** The group an army belongs to; 0 none. */
  groupOf(army: number): number {
    return this.groups().find((g) => g.armies.includes(army))?.id ?? 0;
  }
}
