// Great War 1914 (ww190 §1, §6): Germany's peace years, and Germany sitting
// out a great war after it stood aside. Owned by the DEU writer lane. Text,
// with each pick's line after it (`<scene>_<pick>`), in
// resources/ww1914/ko/DEU.years.json. The small kit below is shared by the
// DEU ww190 files (deu_rule, deu_homefront, deu_after).
import type {
  GwAccordKind,
  GwGauge,
  GwInstitution,
  GwOffice,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  not,
  reason,
  trustOf,
  type GwCond,
  type GwEffect,
  type GwOption,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  doWorld,
  world,
  type GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Wilhelm II reads these. A card frames what the state has brought; its
 * options say what is done, in words, never what it brings. What a pick
 * cost comes after, as the reason line `<scene>_<pick>`.
 */

// ---- The state ----

export const w = world;
export const act = (e: GwWorldEffect): GwEffect => doWorld(e);

/** A great war runs somewhere. */
export const worldWar: GwCond = w({ is: "war_months", min: 0 });
/** Germany at peace `min` whole months after the summer, and no great war. */
export const peaceFor = (min: number): GwCond =>
  all(w({ is: "peace_months", min }), not(worldWar));
export const arming = (min: number, tag?: GwTag): GwCond =>
  w(tag === undefined ? { is: "arming", min } : { is: "arming", tag, min });
export const race = (tag: GwTag): GwCond => w({ is: "arms_race", tag });
export const bond = (tag: GwTag, r: { min?: number; max?: number }): GwCond =>
  w({ is: "bond", tag, ...r });
export const pressure = (topic: GwTopic, min: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
});
export const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });

// ---- Prices ----

export const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
export const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
export const press = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
export const arms = (line: "army" | "navy", delta: number): GwEffect =>
  act({ do: "arms", line, delta });
export const bondBy = (tag: GwTag, delta: number): GwEffect =>
  act({ do: "bond", tag, delta });
export const men = (delta: number): GwEffect => act({ do: "manpower", delta });
export const treasury = (pct: number): GwEffect =>
  act({ do: "budget_item", item: "treasury", pct });
/** The trust of the person a cast role holds. */
export const trusts = (roleId: string, delta: number): GwEffect =>
  trustOf({ role: roleId }, delta);

// ---- Builders ----

export const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
export const holder = (o: GwOffice) => ({ office: o }) as const;

type Pick = (id: string, ...effects: GwEffect[]) => GwOption;
type PickIf = (id: string, when: GwCond, ...effects: GwEffect[]) => GwOption;

/** An option of `scene`; its line after the pick is `<scene>_<id>`. */
const pick =
  (scene: string): Pick =>
  (id, ...effects) => ({
    id,
    tell: [],
    effects: [...effects, reason(`${scene}_${id}`)],
  });
/** The same, greyed with the pack's `why.<id>` while `when` is false. */
const pickIf =
  (scene: string): PickIf =>
  (id, when, ...effects) => ({ ...pick(scene)(id, ...effects), when });

export interface Card {
  id: string;
  kind?: GwScene["kind"];
  when: GwCond;
  cast: GwScene["cast"];
  salience: number;
  tags: GwScene["tags"];
  variants?: GwVariant[];
  /** The first is what a timer takes. */
  options?: (p: Pick, q: PickIf) => GwOption[];
  once?: boolean;
  cooldown?: number;
  max?: number;
  stage?: GwScene["stage"];
  assumes?: GwScene["assumes"];
}

/** A German card: a paper with options, or a wire with none. */
export function card(c: Card): GwScene {
  const options = c.options?.(pick(c.id), pickIf(c.id));
  return {
    id: c.id,
    nation: ["DEU"],
    kind: c.kind ?? (options === undefined ? "wire" : "proposal"),
    ...(c.stage === undefined ? {} : { stage: c.stage }),
    when: c.when,
    ...(c.assumes === undefined ? {} : { assumes: c.assumes }),
    cast: c.cast,
    salience: c.salience,
    tags: c.tags,
    ...(c.once === undefined ? {} : { once: c.once }),
    ...(c.cooldown === undefined ? {} : { cooldown: c.cooldown }),
    ...(c.max === undefined ? {} : { max: c.max }),
    variants: c.variants ?? [v("base")],
    ...(options === undefined ? {} : { fallback: options[0].id, options }),
  };
}

const chancellor = holder("chancellor");
const foreign = holder("foreign");
const cos = holder("chief_of_staff");
const war = holder("war");
const navy = holder("navy");
const interior = holder("interior");
const finance = holder("finance");
const london = holder("ambassador_london");
const vienna = holder("ambassador_vienna");

const offered = (kind?: GwAccordKind): GwCond =>
  w(
    kind === undefined
      ? { is: "accord_offered" }
      : { is: "accord_offered", kind },
  );

// ---- §1 Arms: the rival's programme, our bill, the bill's price ----

const ARMS: GwScene[] = [
  card({
    id: "deu_y_arms_rival",
    when: all(
      peaceFor(2),
      any(arming(1, "GBR"), arming(1, "FRA"), arming(1, "RUS")),
    ),
    cast: { navy, cos },
    salience: 6,
    tags: ["foreign", "war"],
    cooldown: 6,
    variants: [
      v("gbr", arming(1, "GBR")),
      v("rus", arming(1, "RUS")),
      v("fra", arming(1, "FRA")),
      v("base"),
    ],
  }),
  card({
    id: "deu_y_arms_bill",
    when: all(
      peaceFor(3),
      any(race("GBR"), race("FRA"), race("RUS"), { kind: "temp", min: 5 }),
    ),
    cast: { war, navy, chancellor },
    salience: 7,
    tags: ["home", "war", "tension_up"],
    cooldown: 6,
    variants: [
      v("navy", race("GBR")),
      v("army", any(race("FRA"), race("RUS"))),
      v("base"),
    ],
    options: (p) => [
      p("hold", inst("army", -1), trusts("navy", -1), temp(-1)),
      p("army", arms("army", 5), inst("army", 1), trust("RUS", -1)),
      p(
        "navy",
        arms("navy", 5),
        trusts("navy", 1),
        trust("GBR", -1),
        press("naval", 1),
      ),
      p("both", arms("army", 3), arms("navy", 3), gauge("money", -1), temp(1)),
    ],
  }),
  card({
    id: "deu_y_arms_price",
    when: all(peaceFor(4), arming(2)),
    cast: { finance, chancellor },
    salience: 7,
    tags: ["home"],
    cooldown: 6,
    variants: [v("third", arming(3)), v("base")],
    options: (p) => [
      p(
        "loans",
        act({ do: "budget_item", item: "debt", pct: 10 }),
        opinion("business", 1),
      ),
      p("levy", treasury(8), opinion("business", -1), inst("reichstag", 1)),
      p(
        "excise",
        gauge("money", 1),
        opinion("workers", -1),
        gauge("order", -1),
      ),
      p("trim", arms("army", -2), inst("army", -1), trusts("chancellor", 1)),
    ],
  }),
];

// ---- §1 Talks: an accord offered, sought, kept ----

const TALKS: GwScene[] = [
  card({
    id: "deu_y_talks_offer",
    when: all(peaceFor(1), offered()),
    cast: { foreign, navy, chancellor },
    salience: 8,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      v("naval", offered("naval")),
      v("colonial", offered("colonial")),
      v("base"),
    ],
    options: (p) => [
      p(
        "formula",
        act({ do: "accord_answer", yes: false }),
        trusts("chancellor", -1),
        trusts("navy", 1),
      ),
      p(
        "accept",
        act({ do: "accord_answer", yes: true }),
        trusts("navy", -1),
        trust("GBR", 1),
      ),
      p(
        "refuse",
        act({ do: "accord_answer", yes: false }),
        trust("GBR", -1),
        press("naval", 1),
        trusts("navy", 1),
      ),
    ],
  }),
  card({
    id: "deu_y_talks_seek",
    when: all(
      peaceFor(4),
      not(w({ is: "accord", tag: "GBR" })),
      not(offered()),
      any(pressure("naval", 5), pressure("colonial", 4), race("GBR")),
    ),
    cast: { chancellor, navy, london },
    salience: 7,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [v("naval", pressure("naval", 5)), v("base")],
    options: (p) => [
      p("not_now", trusts("navy", 1), press("naval", 1)),
      p(
        "naval",
        act({ do: "accord", kind: "naval", tag: "GBR" }),
        trusts("navy", -2),
      ),
      p(
        "colonial",
        act({ do: "accord", kind: "colonial", tag: "GBR" }),
        opinion("business", 1),
      ),
    ],
  }),
  card({
    id: "deu_y_talks_keep",
    when: all(peaceFor(6), w({ is: "accord", kind: "naval", broken: false })),
    cast: { navy, chancellor },
    salience: 7,
    tags: ["foreign", "war"],
    once: true,
    variants: [v("race", arming(2, "GBR")), v("base")],
    options: (p) => [
      p("keep", trusts("navy", -1), trust("GBR", 1), press("naval", -1)),
      p("to_army", arms("army", 3), inst("army", 1), trusts("navy", -1)),
      p(
        "break",
        act({ do: "break_accord", kind: "naval", tag: "GBR" }),
        trusts("navy", 2),
        opinion("press", 1),
      ),
    ],
  }),
];

// ---- §1 The alliance: renewal, a crack, the staffs ----

const ALLIANCE: GwScene[] = [
  card({
    id: "deu_y_ally_renew",
    when: all(peaceFor(6), bond("AUH", { min: 0 })),
    cast: { foreign, vienna },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [v("italy", bond("ITA", { max: -1 })), v("base")],
    options: (p) => [
      p("renew", bondBy("AUH", 1), bondBy("ITA", 1)),
      p(
        "tighten",
        bondBy("AUH", 2),
        bondBy("ITA", -1),
        trust("RUS", -1),
        press("balkan", 1),
      ),
      p("loose", bondBy("AUH", -1), trust("GBR", 1)),
    ],
  }),
  card({
    id: "deu_y_ally_crack",
    when: all(peaceFor(3), bond("AUH", { max: -1 })),
    cast: { foreign, vienna },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [v("deep", bond("AUH", { max: -2 })), v("base")],
    options: (p) => [
      p("visit", bondBy("AUH", 1), trust("RUS", -1)),
      p("credit", bondBy("AUH", 1), gauge("money", -1)),
      p("let_cool", bondBy("AUH", -1), trust("RUS", 1), trust("GBR", 1)),
    ],
  }),
  card({
    id: "deu_y_ally_staff",
    when: all(peaceFor(5), any(race("RUS"), pressure("balkan", 5))),
    cast: { cos, foreign },
    salience: 8,
    tags: ["foreign", "war"],
    once: true,
    variants: [v("race", race("RUS")), v("base")],
    options: (p) => [
      p("vague", press("balkan", -1), trusts("cos", -1)),
      p("east", bondBy("AUH", 1), temp(1), trust("RUS", -1), trusts("cos", -1)),
      p("west", bondBy("AUH", -1), inst("army", 1), trusts("cos", 1)),
    ],
  }),
];

// ---- §1 Incidents: two of Germany's own, one Balkan, one Straits ----

const INCIDENTS: GwScene[] = [
  card({
    id: "deu_y_inc_naval",
    when: all(peaceFor(1), pressure("naval", 4)),
    cast: { navy, foreign },
    salience: 6,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("hot", pressure("naval", 7)), v("base")],
    options: (p) => [
      p("calm", press("naval", -1), trusts("navy", -1)),
      p("protest", temp(1), trust("GBR", -1), trusts("navy", 1)),
      p("invite", press("naval", -2), trust("GBR", 1), opinion("press", -1)),
    ],
  }),
  card({
    id: "deu_y_inc_alsace",
    when: all(peaceFor(1), pressure("alsace", 4)),
    cast: { war, interior },
    salience: 6,
    tags: ["home", "foreign", "tension_up"],
    cooldown: 4,
    variants: [v("hot", pressure("alsace", 7)), v("base")],
    options: (p) => [
      p("consul", press("alsace", -1), trust("FRA", 1), inst("army", -1)),
      p("harsh", gauge("order", 1), trust("FRA", -1), press("alsace", 1)),
      p("court", press("alsace", -1), inst("reichstag", 1), trusts("war", -1)),
    ],
  }),
  card({
    id: "deu_y_inc_balkan",
    when: all(peaceFor(2), pressure("balkan", 4)),
    cast: { foreign, vienna },
    salience: 7,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("hot", pressure("balkan", 7)), v("base")],
    options: (p) => [
      p("restrain", bondBy("AUH", -1), press("balkan", -1), trust("RUS", 1)),
      p("back_vienna", bondBy("AUH", 1), temp(1), press("balkan", 1)),
      p(
        "conference",
        press("balkan", -2),
        trust("GBR", 1),
        bondBy("AUH", -1),
        temp(-1),
      ),
    ],
  }),
  card({
    id: "deu_y_inc_straits",
    when: all(peaceFor(2), pressure("straits", 4)),
    cast: { foreign, war },
    salience: 6,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("hot", pressure("straits", 7)), v("base")],
    options: (p) => [
      p("quiet", press("straits", -1), trusts("war", -1)),
      p("stay", trust("OTT", 1), trust("RUS", -1), press("straits", 1)),
      p("recall", trust("RUS", 1), trust("OTT", -1), press("straits", -2)),
    ],
  }),
];

// ---- §1 Home: a strike in peace, the war that didn't come ----

const HOME: GwScene[] = [
  card({
    id: "deu_y_home_strike",
    when: all(peaceFor(4), { kind: "gauge", gauge: "order", max: 4 }),
    cast: { interior, chancellor },
    salience: 6,
    tags: ["home"],
    cooldown: 3,
    variants: [v("ruhr"), v("docks"), v("base")],
    options: (p) => [
      p("wait", gauge("order", -1), opinion("business", 1)),
      p("troops", gauge("order", 1), opinion("workers", -2), inst("army", 1)),
      p(
        "arbitrate",
        gauge("money", -1),
        opinion("workers", 1),
        opinion("business", -1),
      ),
    ],
  }),
  card({
    id: "deu_y_home_long",
    when: peaceFor(18),
    cast: { chancellor, cos },
    salience: 8,
    tags: ["home", "tension_down"],
    once: true,
    variants: [v("armed", arming(2)), v("base")],
    options: (p) => [
      p("ready", inst("army", 1), gauge("money", -1)),
      p("ease", arms("army", -3), gauge("order", 1), trusts("cos", -1)),
      p("speech", gauge("morale", 1), opinion("press", 1)),
    ],
  }),
];

// ---- §6 Germany sits out a great war, after it stood aside ----

const ASIDE: GwCond = all(
  w({ is: "aside" }),
  worldWar,
  w({ is: "side", of: ["neutral"] }),
);

const NEUTRAL: GwScene[] = [
  card({
    id: "deu_nt_courted",
    when: all(ASIDE, w({ is: "courted", min: 1 })),
    cast: { foreign, cos },
    salience: 8,
    tags: ["foreign", "war"],
    cooldown: 3,
    max: 2,
    variants: [
      v(
        "vienna",
        all(atWar("AUH"), w({ is: "courted", side: "central", min: 1 })),
      ),
      v("base"),
    ],
    options: (p) => [
      p("stay_out", bondBy("AUH", -1), gauge("order", 1)),
      p("price", trust("AUH", 1), trust("RUS", -1), temp(1)),
      p(
        "join",
        act({ do: "join", side: "central" }),
        bondBy("AUH", 2),
        trusts("cos", 1),
      ),
    ],
  }),
  card({
    id: "deu_nt_mediate",
    when: all(ASIDE, not(w({ is: "mediating" }))),
    cast: { chancellor, foreign },
    salience: 7,
    tags: ["foreign", "tension_down"],
    cooldown: 3,
    max: 2,
    variants: [v("long", w({ is: "war_months", min: 12 })), v("base")],
    options: (p) => [
      p("wait", trusts("chancellor", -1)),
      p("offer", act({ do: "mediate" }), trust("USA", 1)),
    ],
  }),
  card({
    id: "deu_nt_trade",
    when: all(ASIDE, w({ is: "war_months", min: 3 })),
    cast: { finance, foreign },
    salience: 6,
    tags: ["foreign", "home"],
    cooldown: 3,
    options: (p) => [
      p("sell_all", treasury(5), trust("GBR", -1), trust("RUS", -1)),
      p("sell_ally", treasury(3), bondBy("AUH", 1), trust("RUS", -1)),
      p("hold", opinion("business", -1), trust("USA", 1)),
    ],
  }),
];

export const DEU_YEARS_SCENES: readonly GwScene[] = [
  ...ARMS,
  ...TALKS,
  ...ALLIANCE,
  ...INCIDENTS,
  ...HOME,
  ...NEUTRAL,
];
