// Great War 1914: the ruler's powers (ww169, design ww168 B1-B3). One file of
// rows per country in content/powers/<tag>.ts, text in
// resources/ww1914/ko/<TAG>.powers.json: a later country adds rows, no code.
// engine/ww1914/Powers runs them. See /home/eser/dev/ww169-format.md.
import type {
  GwCamp,
  GwIssue,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwPowerGroup,
  GwPowerKind,
  GwPowerTag,
  GwReactorActor,
} from "@openfront/engine-api/ww1914/GwPowers";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import { walkEffects } from "@openfront/engine-api/ww1914/SceneCheck";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwSide } from "./HouseRows";

/** One choice in a target list or a field. Nothing shows before the pick but its words. */
export interface GwPowerOption {
  /** A tag, a theatre, a chamber, or the row's own option id. */
  readonly id: string;
  /** Not met: off the list. */
  readonly when?: GwCond;
  /** Run on success, after the row's. */
  readonly effects?: readonly GwEffect[];
  /** What the world answers to, on top of the row's. */
  readonly tags?: readonly GwPowerTag[];
}

export type GwPowerTarget =
  /** The seat's people: in office (`cabinet`) or any (`own`). Cast role `target`. */
  | {
      readonly kind: "person";
      readonly people: "cabinet" | "own";
      readonly offices?: readonly GwOffice[];
    }
  | {
      readonly kind: "country" | "front" | "house" | "option";
      readonly of: readonly GwPowerOption[];
    };

/** A greyed condition: not met, the row shows with its `why` line. */
export interface GwPowerGate {
  readonly when: GwCond;
  /** Pack `powers.<id>.why.<why>`, else gw.power.why.<why>. */
  readonly why: string;
}

export interface GwPowerRow {
  /** `<tag>_pw_<name>`. Text: pack `powers.<id>`. */
  readonly id: string;
  readonly tag: GwTag;
  /** Its topic; a `beyond` row shows under 법 밖의 일 whatever this says. */
  readonly group: Exclude<GwPowerGroup, "schedule" | "beyond">;
  readonly kind: GwPowerKind;
  /** Not met: off the tab (another regime, another age). */
  readonly shows?: GwCond;
  /** Not met: greyed with its line. The first that fails speaks. */
  readonly opens?: readonly GwPowerGate[];
  /** Once a game. */
  readonly once?: boolean;
  /** Chapters before it can be used again; absent: GW_POWER_COOLDOWN. */
  readonly cooldown?: number;
  readonly target?: GwPowerTarget;
  /** Further list fields, picked in order (`picks`). */
  readonly fields?: readonly {
    readonly id: string;
    readonly options: readonly GwPowerOption[];
  }[];
  /** The procedure (design B2), checked in this order: office, consent, council, house. */
  readonly needs?: {
    /** Whoever holds it must countersign. */
    readonly office?: GwOffice;
    /** The house votes on it, as on a bill: each faction's side. */
    readonly house?: {
      readonly stance: Readonly<Record<string, GwSide>>;
      /** Absent: every chamber that isn't optional. */
      readonly houses?: readonly GwChamber[];
      readonly lean?: number;
    };
    /** The cabinet votes on it (Authority.holdVote). */
    readonly council?: GwIssue;
    /** A faction that must not stand against it (Hungary's Party of Work). */
    readonly consent?: string;
  };
  /** Camps the signer dislikes it from: each makes his signature less likely. */
  readonly against?: readonly GwCamp[];
  /** Past the signer: this row runs instead (its beyond form). */
  readonly beyond?: string;
  /** A beyond row only reached as another row's `beyond`: never listed itself. */
  readonly formOnly?: boolean;
  /** Authority it spends when it goes through. Greyed while short. */
  readonly authority?: number;
  /** It takes the ruler's time: spends a schedule slot. */
  readonly slot?: boolean;
  readonly tags: readonly GwPowerTag[];
  /** Run when it goes through. */
  readonly effects: readonly GwEffect[];
  /** Run when the procedure stops it (refused, voted down). */
  readonly failed?: readonly GwEffect[];
  /** A chance from the state, rolled after it goes through. */
  readonly risk?: {
    readonly pct: number;
    readonly mods?: readonly { readonly when: GwCond; readonly add: number }[];
    readonly then: readonly GwEffect[];
  };
  /** The silent result card laid at once (`scheduledOnly`, `silent`). */
  readonly scene?: string;
}

/** With no cooldown of its own, chapters before a power can be used again. */
export const GW_POWER_COOLDOWN = 2;

/**
 * Who answers a tag, by its state (design B3). `of`: blocs for `people` and
 * `factions`, camps for `cabinet`. `delta`: the step, + good for the seat.
 * Text: pack `reasons.<key>`, else gw.reason.<key>; absent key:
 * `react_<actor>_up|down` (with `_<bloc>` for people).
 */
export interface GwReactorRow {
  readonly tag: GwPowerTag;
  /** Only this seat's country; absent: every seat. */
  readonly nation?: GwTag;
  readonly actor: GwReactorActor;
  /** It answers only while this holds. */
  readonly by?: GwCond;
  readonly of?: readonly (GwBloc | GwCamp)[];
  readonly delta: number;
  readonly key?: string;
  /** Plain effects on top (the house's weight, a general's pride). */
  readonly does?: readonly GwEffect[];
}

const war: GwCond = { kind: "world", of: { is: "war" } };
const r = (
  tag: GwPowerTag,
  actor: GwReactorActor,
  delta: number,
  of?: readonly (GwBloc | GwCamp)[],
  by?: GwCond,
): GwReactorRow => ({
  tag,
  actor,
  delta,
  ...(of === undefined ? {} : { of }),
  ...(by === undefined ? {} : { by }),
});

/** Reactors v1, every seat: allies, neutrals, the blocs, factions, the cabinet. */
export const GW_REACTORS: readonly GwReactorRow[] = [
  r("war_offensive", "neutrals", -1),
  r("war_offensive", "people", -1, ["workers"]),
  r("war_offensive", "people", 1, ["army"]),
  r("war_defensive", "people", 1, ["army", "press"]),
  r("war_defensive", "allies", 1),
  r("mobilise", "allies", 1),
  r("mobilise", "people", -1, ["workers"]),
  r("stand_down", "people", -1, ["army"]),
  r("ultimatum", "neutrals", -1),
  r("peace_white", "people", 1, ["workers"], war),
  r("peace_white", "people", -1, ["army"], war),
  r("peace_separate", "allies", -2),
  r("peace_separate", "people", -1, ["army"]),
  r("treaty", "allies", 1),
  r("alliance_broken", "allies", -1),
  r("alliance_broken", "neutrals", -1),
  r("house_closed", "people", -1, ["parliament"]),
  r("house_closed", "factions", -1, ["parliament", "workers"]),
  r("house_opened", "people", 1, ["parliament"]),
  r("house_opened", "people", -1, ["court"]),
  r("dissolve", "people", -1, ["parliament"]),
  r("decree", "factions", -1, ["parliament"]),
  r("franchise", "people", 1, ["workers"]),
  r("franchise", "people", -1, ["court"]),
  r("franchise", "cabinet", -1, ["hard", "court", "right"]),
  r("army_over_civil", "people", 1, ["army"]),
  r("army_over_civil", "people", -1, ["parliament"]),
  r("command_self", "people", 1, ["army"]),
  r("press_gag", "people", -1, ["press"]),
  r("arrests", "people", -1, ["workers"]),
  r("arrests", "factions", -1, ["workers"]),
  r("amnesty", "people", 1, ["workers"]),
  r("amnesty", "people", -1, ["army"]),
  r("harsh_war", "neutrals", -1),
  r("harsh_home", "people", -1, ["workers"]),
  r("coalition", "people", 1, ["parliament"]),
];

/** A seat's power content: rows, its own reactors, its result cards. */
export interface GwPowerContent {
  readonly powers?: readonly GwPowerRow[];
  readonly reactors?: readonly GwReactorRow[];
}

/**
 * Scenes the powers lay themselves: result cards and the sounding-out talk. A
 * scheduledOnly scene here has its scheduler (SceneCheck's `outside`). Also
 * the flags, memories and scenes the rows' own effects set, write or lay, so a
 * card may read the pick or the risk that came out.
 */
export function powerCalledScenes(rows: GwPowerContent): string[] {
  const out = new Set<string>([GW_POWER_SOUND]);
  const lists: (readonly GwEffect[] | undefined)[] = [];
  for (const p of rows.powers ?? []) {
    if (p.scene) out.add(p.scene);
    lists.push(p.effects, p.failed, p.risk?.then);
    if (p.target !== undefined && p.target.kind !== "person") {
      for (const o of p.target.of) lists.push(o.effects);
    }
    for (const f of p.fields ?? []) {
      for (const o of f.options) lists.push(o.effects);
    }
  }
  for (const r of rows.reactors ?? []) lists.push(r.does);
  for (const list of lists) {
    walkEffects(list ?? [], (e) => {
      if (e.kind === "flag") out.add(e.flag);
      if (e.kind === "remember") out.add(e.key);
      if (e.kind === "schedule") out.add(e.scene);
      if (e.kind === "promise") {
        out.add(`kept_${e.key}`);
        out.add(`broke_${e.key}`);
        if (e.back !== undefined) out.add(e.back);
      }
    });
  }
  return [...out];
}

/** The talk a signer is sounded out in: content/powers/common.ts. */
export const GW_POWER_SOUND = "gw_pw_sound";

/** What the types can't say; a content test requires an empty list. */
export function gwPowerProblems(
  rows: GwPowerContent,
  scenes: ReadonlyMap<string, GwScene>,
): string[] {
  const out: string[] = [];
  const all = rows.powers ?? [];
  const ids = new Map(all.map((p) => [p.id, p]));
  if (ids.size !== all.length) out.push("a power id twice");
  for (const p of all) {
    if (!p.id.startsWith(`${p.tag.toLowerCase()}_pw_`)) {
      out.push(`${p.id}: not <tag>_pw_<name>`);
    }
    if (p.scene !== undefined) {
      const s = scenes.get(p.scene);
      if (s === undefined) out.push(`${p.id}: no scene ${p.scene}`);
      else if (s.scheduledOnly !== true) {
        out.push(`${p.id}: scene ${p.scene} is not scheduledOnly`);
      }
    }
    if (p.beyond !== undefined) {
      const b = ids.get(p.beyond);
      if (b === undefined) out.push(`${p.id}: no beyond row ${p.beyond}`);
      else if (b.kind !== "beyond") out.push(`${p.id}: ${p.beyond} not beyond`);
      if (p.needs?.office === undefined) {
        out.push(`${p.id}: a beyond form with no signer to go past`);
      }
    }
    if (p.formOnly === true && p.kind !== "beyond") {
      out.push(`${p.id}: formOnly on a lawful row`);
    }
    const t = p.target;
    if (t !== undefined && t.kind !== "person") {
      // Every entry may close: the tab greys the row `no_target` then.
      if (t.of.length === 0) out.push(`${p.id}: an empty target list`);
    }
  }
  return out;
}

/** What the pack lacks for the tab; a content test requires an empty list. */
export function gwPowerPackProblems(
  rows: readonly GwPowerRow[],
  pack: {
    powers?: Readonly<
      Record<
        string,
        {
          name: string;
          why?: Readonly<Record<string, string>>;
          opt?: Readonly<Record<string, string>>;
          fields?: Readonly<
            Record<
              string,
              { label: string; opt?: Readonly<Record<string, string>> }
            >
          >;
        }
      >
    >;
  },
  genericWhy: readonly string[] = [],
): string[] {
  const out: string[] = [];
  for (const p of rows) {
    const t = pack.powers?.[p.id];
    if (t === undefined) {
      out.push(`${p.id}: power not in the pack`);
      continue;
    }
    for (const g of p.opens ?? []) {
      if (t.why?.[g.why] === undefined && !genericWhy.includes(g.why)) {
        out.push(`${p.id}: no why ${g.why}`);
      }
    }
    if (p.target?.kind === "option") {
      for (const o of p.target.of) {
        if (t.opt?.[o.id] === undefined) out.push(`${p.id}.${o.id}: no text`);
      }
    }
    for (const f of p.fields ?? []) {
      const ft = t.fields?.[f.id];
      if (ft === undefined) out.push(`${p.id}.${f.id}: no label`);
      for (const o of f.options) {
        if (ft?.opt?.[o.id] === undefined) {
          out.push(`${p.id}.${f.id}.${o.id}: no text`);
        }
      }
    }
  }
  return out;
}
