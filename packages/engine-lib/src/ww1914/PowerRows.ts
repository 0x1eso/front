// Great War 1914: the ruler's powers (ww169, design ww168 B1-B3). One file of
// rows per country in content/powers/<tag>.ts, text in
// resources/ww1914/ko/<TAG>.powers.json: a later country adds rows, no code.
// engine/ww1914/Powers runs them. See /home/eser/dev/ww169-format.md.
import type {
  GwCamp,
  GwEnding,
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
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSide } from "./HouseRows";

/**
 * A threat to the government (engine GovTable `GW_GOV` id) or a plot (house
 * content `plots` id) the use makes hotter (`by` > 0) or cooler. Never by
 * `gov_heat` in a power's effects: through here the fair warning holds (a
 * fatal row's last step comes only after its warning, never from one click),
 * and a plot stays unseen (no reason line names it).
 */
export interface GwPowerHeat {
  readonly id: string;
  readonly by: number;
}

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
  /** Threats and plots this pick heats too, on top of the row's (ww169). */
  readonly heats?: readonly GwPowerHeat[];
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
  /** Threats and plots it heats when it goes through (phase 2). */
  readonly heats?: readonly GwPowerHeat[];
  /**
   * A chance from the state, rolled after it goes through: `pct`, plus each
   * `mods` that holds, plus GW_BEYOND_AGAIN for every beyond use in the last
   * GW_BEYOND_WITHIN chapters when the row is `beyond`. When it fires: `then`,
   * `heats`, the line `power_went_wrong`, and `scene` instead of the row's.
   */
  readonly risk?: {
    readonly pct: number;
    readonly mods?: readonly { readonly when: GwCond; readonly add: number }[];
    readonly then: readonly GwEffect[];
    readonly heats?: readonly GwPowerHeat[];
    readonly scene?: string;
  };
  /**
   * The person's own ending: abdication, resignation. It ends the game with
   * this ending once it goes through; the tab says so as a fact and asks
   * twice. The only way a power ends the game.
   */
  readonly ends?: GwEnding;
  /** The silent result card laid at once (`scheduledOnly`, `silent`). */
  readonly scene?: string;
  /**
   * ww207: a faction's ability (group `factions`, S2). Asked only at trust
   * 호의 (1) or more and temper 1 or less; it costs trust -1 and cools down
   * GW_ABILITY_COOLDOWN chapters unless `cooldown` says. At temper 3+ the
   * faction turns it against the seat: `turned` runs instead, unasked.
   */
  readonly ability?: {
    readonly faction: string;
    /** Once a node of kind `ability` is open: these effects replace the row's. */
    readonly strong?: readonly GwEffect[];
    readonly turned?: {
      readonly effects: readonly GwEffect[];
      /** Its card (`scheduledOnly`); the news line if absent. */
      readonly scene?: string;
    };
  };
}

/** ww207: chapters an ability cools down; trust it needs; temper it turns at. */
export const GW_ABILITY_COOLDOWN = 6;
export const GW_ABILITY_TRUST = 1;
export const GW_ABILITY_TURNS = 3;

/**
 * While a seat flag holds, a row of these groups that wants this office's
 * signature asks it of another office instead (ww171): the OHL's rule takes
 * the Chancellor's say over war and the army.
 */
export interface GwSignForRow {
  readonly tag: GwTag;
  readonly flag: string;
  readonly from: GwOffice;
  readonly to: GwOffice;
  readonly groups: readonly GwPowerRow["group"][];
}

export const GW_SIGN_FOR: readonly GwSignForRow[] = [
  {
    tag: "DEU",
    flag: "f_deu_ohl_rule",
    from: "chancellor",
    to: "chief_of_staff",
    groups: ["war", "army"],
  },
];

/** The office whose holder signs the row now, if it wants one. */
export function signOffice(
  tag: GwTag,
  flags: readonly string[],
  row: GwPowerRow,
): GwOffice | undefined {
  const office = row.needs?.office;
  if (office === undefined) return undefined;
  const by = GW_SIGN_FOR.find(
    (s) =>
      s.tag === tag &&
      s.from === office &&
      s.groups.includes(row.group) &&
      flags.includes(s.flag),
  );
  return by?.to ?? office;
}

/** With no cooldown of its own, chapters before a power can be used again. */
export const GW_POWER_COOLDOWN = 2;
/** Risk added for each beyond use lately: the state remembers. */
export const GW_BEYOND_AGAIN = 10;
/** "Lately", in chapters, for GW_BEYOND_AGAIN and harsh measures repeated. */
export const GW_BEYOND_WITHIN = 12;
/**
 * A fatal threat's warning paper counts as fresh this many chapters: a use
 * that would bring the last step otherwise brings the warning again first.
 */
export const GW_POWER_WARN_FRESH = 4;

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
  /** `allies`/`neutrals`: only these countries (absent: every one). */
  readonly who?: readonly GwTag[];
  /** Only a use of one of these power rows (absent: any row with the tag). */
  readonly powers?: readonly string[];
  readonly delta: number;
  readonly key?: string;
  /** Plain effects on top (the house's weight, a general's pride). */
  readonly does?: readonly GwEffect[];
}

const war: GwCond = { kind: "world", of: { is: "war" } };
const streets: GwCond = { kind: "world", of: { is: "unrest", min: 2 } };
const quiet: GwCond = { kind: "world", of: { is: "unrest", max: 1 } };
const usaOut: GwCond = { kind: "world", of: { is: "neutral", tag: "USA" } };
/** The ruler's own conscience pays for a harsh measure (his card, warned). */
const conscience = (key: string): GwReactorRow["does"] => [
  { kind: "ruler", side: "conscience", delta: -1, key },
];
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
  // Harsh measures (phase 2): each answer by the state, each with its line.
  r("harsh_war", "neutrals", -1),
  r("harsh_war", "people", 1, ["army"]),
  r("harsh_war", "people", -1, ["press"]),
  {
    tag: "harsh_war",
    actor: "neutrals",
    who: ["USA"],
    by: usaOut,
    delta: -1,
    key: "react_harsh_usa",
  },
  {
    tag: "harsh_war",
    actor: "other",
    delta: -1,
    key: "react_harsh_conscience",
    does: conscience("react_harsh_conscience"),
  },
  r("harsh_home", "people", -1, ["workers"]),
  r("harsh_home", "people", -1, ["press"]),
  r("harsh_home", "people", 1, ["court"]),
  r("harsh_home", "factions", -1, ["workers", "parliament"]),
  // Quiet streets stay quiet for a while; streets already out take it as war.
  {
    tag: "harsh_home",
    actor: "other",
    by: quiet,
    delta: 1,
    key: "react_harsh_quiet",
    does: [{ kind: "gauge", gauge: "order", delta: 1 }],
  },
  {
    tag: "harsh_home",
    actor: "other",
    by: streets,
    delta: -1,
    key: "react_harsh_streets",
    does: [{ kind: "gauge", gauge: "order", delta: -1 }],
  },
  {
    tag: "harsh_home",
    actor: "other",
    delta: -1,
    key: "react_harsh_conscience",
    does: conscience("react_harsh_conscience"),
  },
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
    if (p.risk?.scene) out.add(p.risk.scene);
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

/** Effects that end a seat at once: never in a power but through `ends`. */
const FATAL_WORLD: readonly GwWorldEffect["do"][] = [
  "close_seat",
  "next_regime",
];

/** Every effect, into `maybe` and `roll`. */
function flatEffects(list: readonly GwEffect[]): GwEffect[] {
  return list.flatMap((e) =>
    e.kind === "maybe"
      ? [e, ...flatEffects(e.then)]
      : e.kind === "roll"
        ? [e, ...flatEffects(e.then), ...flatEffects(e.otherwise ?? [])]
        : [e],
  );
}

/**
 * What in a list could lose the game in one click, or heat a threat past its
 * warning: `end`, `close_seat`, `next_regime`, `gov_heat` (use `heats`).
 */
export function fatalEffects(list: readonly GwEffect[]): string[] {
  return flatEffects(list).flatMap((e) => {
    if (e.kind === "end") return ["end"];
    if (e.kind !== "world") return [];
    if (FATAL_WORLD.includes(e.of.do)) return [e.of.do];
    return e.of.do === "gov_heat" ? ["gov_heat"] : [];
  });
}

/** A row's target and field options. */
function rowOptions(p: GwPowerRow): GwPowerOption[] {
  return [
    ...(p.target !== undefined && p.target.kind !== "person"
      ? p.target.of
      : []),
    ...(p.fields ?? []).flatMap((f) => f.options),
  ];
}

/** Every effect list a row can run. */
function rowEffects(p: GwPowerRow): GwEffect[] {
  const opts = rowOptions(p);
  return [
    ...p.effects,
    ...(p.failed ?? []),
    ...(p.risk?.then ?? []),
    ...opts.flatMap((o) => o.effects ?? []),
  ];
}

/**
 * What the types can't say; a content test requires an empty list. `threats`:
 * the ids a `heats` may name (GW_GOV and the plots), unchecked when absent.
 */
export function gwPowerProblems(
  rows: GwPowerContent,
  scenes: ReadonlyMap<string, GwScene>,
  threats?: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const all = rows.powers ?? [];
  const ids = new Map(all.map((p) => [p.id, p]));
  if (ids.size !== all.length) out.push("a power id twice");
  for (const r of rows.reactors ?? []) {
    for (const f of fatalEffects(r.does ?? [])) {
      out.push(
        `reactor ${r.tag}/${r.actor}: ${f} (no fatal step in one click)`,
      );
    }
    for (const id of r.powers ?? []) {
      if (!ids.has(id)) out.push(`reactor ${r.tag}/${r.actor}: no power ${id}`);
    }
  }
  for (const p of all) {
    for (const f of fatalEffects(rowEffects(p))) {
      out.push(`${p.id}: ${f} (use \`ends\` or \`heats\`)`);
    }
    for (const h of [
      ...(p.heats ?? []),
      ...(p.risk?.heats ?? []),
      ...rowOptions(p).flatMap((o) => o.heats ?? []),
    ]) {
      if (threats !== undefined && !threats.has(h.id)) {
        out.push(`${p.id}: heats no threat or plot ${h.id}`);
      }
    }
    if (p.ends !== undefined) {
      if (
        p.kind === "beyond" ||
        p.beyond !== undefined ||
        p.risk !== undefined
      ) {
        out.push(`${p.id}: an ending is the person's own lawful act`);
      }
    }
    if (p.risk?.scene !== undefined) {
      const s = scenes.get(p.risk.scene);
      if (s === undefined) out.push(`${p.id}: no scene ${p.risk.scene}`);
      else if (s.scheduledOnly !== true) {
        out.push(`${p.id}: scene ${p.risk.scene} is not scheduledOnly`);
      }
    }
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
