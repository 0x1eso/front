import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  FM_TRAITS,
  type WwArmyGroupData,
  type WwDepthDetail,
  type WwDepthSummary,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  GENERAL_TRAITS,
  type GeneralData,
  type GeneralTrait,
  RETIRED_GENERAL_TRAITS,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  ADMIRAL_TRAITS,
  type AdmiralTrait,
  admiralTraitBit,
  WW_ADMIRAL_TRAIT_MAX,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  THOUGHT_EDGE_IDS,
  THOUGHT_MAX_STEP,
  THOUGHT_SLIDER_COUNT,
  THOUGHT_SLIDER_DOMAIN,
  THOUGHT_SLIDERS,
  type ThoughtEdgeId,
} from "@openfront/engine-api/ww1936/ThoughtTypes";
import { dateOfDay, dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fieldMarshalCap,
  fmEligible,
  promoteFmBlock,
  traitSlots,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  THOUGHT_ENDS,
  thoughtDaysToGo,
  thoughtEdgeLit,
  thoughtNotch,
  thoughtTermValue,
  thoughtYearPct,
} from "@openfront/engine-lib/ww1936/ThoughtRules";
import type { GameView } from "../../view/GameView";
import { generalName, rosterName } from "./LandModel";
import { admiralDef, admiralName, admiralTraits } from "./NavyModel";
import { statLines } from "./PoliticsModel";
import { today } from "./WorldWarModel";

export type DoctrineBlock =
  | "doctrine_locked"
  | "bad_index"
  | "no_pp"
  | "no_slot"
  | "fm_cap"
  | "not_ready";

export const DOCTRINE_BLOCK_KEYS: Readonly<Record<DoctrineBlock, string>> = {
  doctrine_locked: "ww1936.econ.block.doctrine_locked",
  bad_index: "ww1936.econ.block.bad_index",
  no_pp: "ww1936.econ.block.no_pp",
  no_slot: "ww1936.econ.block.trait_unavailable",
  fm_cap: "ww1936.econ.block.fm_limit",
  not_ready: "ww1936.econ.block.general_unavailable",
};

/** One line of an end: what it gives at the actual position, and at the target while moving. */
export interface ThoughtLine {
  now: string;
  goal: string;
}

export interface ThoughtEnd {
  id: ThoughtEdgeId;
  /** 0 left (negative notches), 1 right. */
  end: 0 | 1;
  lines: ThoughtLine[];
  /** The star bonus lines; lit once the actual position is at the end's edge. */
  star: { lines: string[]; lit: boolean; goalLit: boolean };
}

export interface ThoughtSliderView {
  /** THOUGHT_SLIDERS index. */
  index: number;
  id: (typeof THOUGHT_SLIDERS)[number];
  /** 0 land, 1 naval, 2 air. */
  domain: number;
  /** The notch asked for (-10..10). */
  target: number;
  /** The actual position's notch, and in milli-notches. */
  notch: number;
  curMilli: number;
  moving: boolean;
  /** Days until the actual position reaches the target; 0 when there. */
  days: number;
  left: ThoughtEnd;
  right: ThoughtEnd;
}

export interface CommandPerson {
  id: number;
  admiral: boolean;
  name: string;
  level: number;
  slots: number;
  used: number;
  traits: string[];
}

export interface MarshalRow {
  id: number;
  name: string;
  traits: string[];
  /** The group they lead; 0 none. */
  group: number;
}

export interface MarshalCap {
  marshals: number;
  cap: number;
}

/** The dock's thought dial: no badge; a thin ring only while a slider moves. */
export interface ThoughtDial {
  moving: number;
  /** 0 when nothing moves; else how far the slowest slider has come, 0.05..1. */
  progress: number;
}

export interface IntelDial {
  progress: number;
  captured: number;
  idle: number;
  badge: { kind: "captured" | "idle"; n: number } | null;
}

export interface BandDepth {
  energyPct: number | null;
  congressPct: number | null;
  /** The US congress is dissolved: the chip reads "suspended" in place of the percentage. */
  congressSuspended?: boolean;
  nukes: number | null;
}

export interface GroupRow {
  id: number;
  fm: number;
  fmName: string;
  fmTraits: string[];
  armies: number[];
}

export function generalTraitIds(mask: number): GeneralTrait[] {
  return GENERAL_TRAITS.filter(
    (t) => (mask & traitBit(t)) !== 0 && !RETIRED_GENERAL_TRAITS.includes(t),
  );
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

  private pp(c: Ctx): number | null {
    const s = c.game.wwPolitics?.()?.summary(c.me);
    return s === undefined || s === null ? null : Math.floor(s.ppMilli / 1000);
  }

  // ---- The thought sliders (design §11.1) ----

  /** The detail's thought state; before the engine sends it, every slider rests in the middle. */
  private thoughtOf(c: Ctx): {
    target: number[];
    curMilli: number[];
    rateMilli: number;
  } {
    const t = c.detail.thought;
    return {
      target: t?.target ?? [],
      curMilli: t?.curMilli ?? [],
      rateMilli: t?.rateMilli ?? 100,
    };
  }

  /**
   * Sliders of a service (0 land, 1 naval, 2 air), in THOUGHT_SLIDERS order.
   * `preview`: targets being dragged (by slider index) that stand in for the
   * view's own until the engine has taken the order.
   */
  sliders(
    domain: number,
    preview: ReadonlyMap<number, number> = new Map(),
  ): ThoughtSliderView[] {
    const c = this.ctx();
    if (c === null) return [];
    const t = this.thoughtOf(c);
    const yearPct = thoughtYearPct(
      this.view.worldWarScenario() ? dateOfDay(c.day).year : 1936,
    );
    const out: ThoughtSliderView[] = [];
    for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
      if (THOUGHT_SLIDER_DOMAIN[s] !== domain) continue;
      const cur = t.curMilli[s] ?? 0;
      const target = preview.get(s) ?? t.target[s] ?? 0;
      const notch = thoughtNotch(cur);
      const moving = cur !== target * 1000;
      out.push({
        index: s,
        id: THOUGHT_SLIDERS[s],
        domain,
        target,
        notch,
        curMilli: cur,
        moving,
        days: moving ? thoughtDaysToGo(cur, target, t.rateMilli) : 0,
        left: this.endOf(s, 0, notch, target, moving, yearPct),
        right: this.endOf(s, 1, notch, target, moving, yearPct),
      });
    }
    return out;
  }

  private endOf(
    s: number,
    end: 0 | 1,
    notch: number,
    target: number,
    moving: boolean,
    yearPct: number,
  ): ThoughtEnd {
    const def = THOUGHT_ENDS[2 * s + end];
    const line = (key: string, v: number): string =>
      v === 0 ? "" : (statLines({ [key]: v } as Partial<WwStats>)[0] ?? "");
    return {
      id: THOUGHT_EDGE_IDS[2 * s + end],
      end,
      lines: def.terms.map((term) => ({
        now: line(term.key, thoughtTermValue(term, notch, end, yearPct)),
        goal: moving
          ? line(term.key, thoughtTermValue(term, target, end, yearPct))
          : "",
      })),
      star: {
        lines: statLines(def.edge),
        lit: thoughtEdgeLit(notch, end),
        goalLit: thoughtEdgeLit(target, end),
      },
    };
  }

  /** A drag lands on notch `pos` of slider `slider`. */
  thoughtOrder(slider: number, pos: number): WwOrder {
    return {
      kind: "thought_set",
      slider: THOUGHT_SLIDERS[slider],
      pos: Math.max(-THOUGHT_MAX_STEP, Math.min(THOUGHT_MAX_STEP, pos)),
    };
  }

  /** Whether any slider is moving (the dock's ring). */
  thoughtDial(): ThoughtDial | null {
    const c = this.ctx();
    if (c === null) return null;
    const t = this.thoughtOf(c);
    let moving = 0;
    let far = 0;
    for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
      const gap = Math.abs((t.target[s] ?? 0) * 1000 - (t.curMilli[s] ?? 0));
      if (gap === 0) continue;
      moving++;
      far = Math.max(far, gap);
    }
    return {
      moving,
      progress:
        moving === 0
          ? 0
          : Math.max(0.05, 1 - far / (2 * THOUGHT_MAX_STEP * 1000)),
    };
  }

  // ---- Command (tab 5) ----

  /** The field marshals I have and may have (design §12.4: no command power bar any more). */
  marshalCap(): MarshalCap | null {
    const c = this.ctx();
    if (c === null) return null;
    const land = c.game.wwLand?.()?.countries.get(c.me);
    return {
      marshals: c.sum?.fieldMarshals ?? 0,
      cap: fieldMarshalCap(land?.divisions ?? 0),
    };
  }

  /** Generals, then admirals (traits come by themselves). */
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
      });
    }
    return out.sort(
      (a, b) => Number(a.admiral) - Number(b.admiral) || a.id - b.id,
    );
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
    const bar = this.marshalCap();
    if (c === null || bar === null) return [];
    const pp = this.pp(c);
    const land = c.game.wwLand?.()?.details.get(c.me);
    const tag = c.game.myPlayer()?.countryTag?.() ?? null;
    const divisions = c.game.wwLand?.()?.countries.get(c.me)?.divisions ?? 0;
    return (land?.generals ?? [])
      .filter((g) => !isMarshal(g) && promotable(g, tag, c.day))
      .map((g) => {
        // The engine's promoteFmBlock (serving is the engine's to judge); only PP is paid.
        const b = promoteFmBlock({
          isFm: false,
          serves: true,
          level: g.level,
          skillSum: g.att + g.def + g.plan + g.log,
          listed: listedMarshal(tag, g, c.day),
          fieldMarshals: bar.marshals,
          divisions,
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
                : b === "no_pp"
                  ? b
                  : ("not_ready" as const),
        };
      });
  }

  /** Armies still waiting out their medal cooldown (medals are awarded by themselves): army id and days left. */
  medalRows(): { army: number; days: number }[] {
    const c = this.ctx();
    if (c === null) return [];
    return (c.detail.command.medalCooldown ?? [])
      .map((m) => ({ army: m[0], days: Math.max(0, m[1] - c.day) }))
      .filter((m) => m.days > 0)
      .sort((a, b) => a.army - b.army);
  }

  promoteOrder(general: number, trait: string): WwOrder {
    return { kind: "promote_fm", general, trait: trait as never };
  }

  // ---- The dials and the band (spec §20.1, §20.2) ----

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

  /** The band's chips: ⚡ energy under 100%, 🏛 US congress, ☢ my atomic bombs. */
  band(): BandDepth | null {
    const c = this.ctx();
    const me = this.view.myPlayer();
    if (c === null || me === null) return null;
    const e = c.sum?.energyPm;
    return {
      energyPct: e !== undefined && e < 1000 ? Math.floor(e / 10) : null,
      congressPct:
        me.countryTag?.() === "USA"
          ? Math.floor(this.view.wwDepth!()!.congressBp / 100)
          : null,
      congressSuspended:
        me.countryTag?.() === "USA" &&
        this.view.wwDepth!()!.congressDissolved === true,
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
