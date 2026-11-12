// Great War 1914 (ww190 §1, §6): Austria-Hungary's peace years, and the years
// it sits out a war the others fight. Data only; the text is in
// resources/ww1914/ko/AUH.years.json. The kit at the top serves the other
// ww190 AUH files (rule, homefront, after, colonies, agents).
import type {
  GwAccordKind,
  GwGauge,
  GwInstitution,
  GwOffice,
  GwSide,
  GwStage,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwSceneKind,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  not,
  reason,
  remember,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

// ---- The kit ----

export const w = (of: GwWorldCond): GwCond => world(of);
/** Whoever holds the office, or the favourite while it stands empty. */
export const office = (o: GwOffice): GwCastRule => ({
  any_of: [{ office: o }, { favourite: true }],
});
export const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
export const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
export const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
export const pressure = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
export const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
export const low = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
export const bond = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });
export const arms = (line: "army" | "navy", delta: number): GwEffect =>
  doWorld({ do: "arms", line, delta });
export const seen = (scene: string): GwCond => ({ kind: "seen", scene });

/** No great war has begun anywhere. */
export const noGreatWar: GwCond = not(w({ is: "war_months", min: 0 }));
/** The peace years: a crisis closed without war this many months ago, no war since. */
export const peaceFor = (min: number): GwCond =>
  all(w({ is: "peace_months", min }), noGreatWar);
/** The great war runs and the seat's country sits it out. */
export const sittingOut: GwCond = all(
  w({ is: "war_months", min: 0 }),
  w({ is: "side", of: ["neutral"] }),
  not(w({ is: "left_war" })),
);

/** An option: its effects, then its reason line `<scene>_<id>`. */
export interface Pick {
  id: string;
  effects: GwEffect[];
}
export const pick = (id: string, ...effects: GwEffect[]): Pick => ({
  id,
  effects,
});

export type Bodies = readonly (readonly [string, GwCond?])[];

export interface Card {
  id: string;
  kind?: GwSceneKind;
  when: GwCond;
  cast: Record<string, GwCastRule>;
  vs: Bodies;
  picks?: readonly Pick[];
  salience?: number;
  tags?: GwScene["tags"];
  once?: boolean;
  cooldown?: number;
  max?: number;
  stage?: GwStage[];
  assumes?: GwAssumes;
}

/** A scene of the seat: a proposal with picks, or a wire with none. */
export function card(c: Card): GwScene {
  const options: GwOption[] = (c.picks ?? []).map((p) => ({
    id: p.id,
    tell: [],
    effects: [...p.effects, reason(`${c.id}_${p.id}`)],
  }));
  const s: GwScene = {
    id: c.id,
    nation: ["AUH"],
    kind: c.kind ?? (options.length > 0 ? "proposal" : "wire"),
    salience: c.salience ?? 6,
    tags: c.tags ?? ["home"],
    cast: c.cast,
    when: c.when,
    variants: c.vs.map(([id, when]) =>
      when === undefined ? { id } : { id, when },
    ),
  };
  if (options.length > 0) {
    s.options = options;
    s.fallback = options[0].id;
  }
  if (c.once !== undefined) s.once = c.once;
  if (c.cooldown !== undefined) s.cooldown = c.cooldown;
  if (c.max !== undefined) s.max = c.max;
  if (c.stage !== undefined) s.stage = c.stage;
  if (c.assumes !== undefined) s.assumes = c.assumes;
  return s;
}

// ---- People ----

const COS = office("chief_of_staff");
const FM = office("foreign");
const HUN = office("hun_pm");
const NAVY = office("navy");
const WAR = office("war");
const PM = office("chancellor");
const FIN = office("finance");

// ---- Conditions ----

const arming = (min: number, max?: number, tag?: GwTag): GwCond =>
  w({
    is: "arming",
    ...(tag === undefined ? {} : { tag }),
    min,
    ...(max === undefined ? {} : { max }),
  });
const race = (tag: GwTag): GwCond => w({ is: "arms_race", tag });
const bondIs = (tag: GwTag, min?: number, max?: number): GwCond =>
  w({
    is: "bond",
    tag,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });
const accordIn = (kind?: GwAccordKind, tag?: GwTag): GwCond =>
  w({
    is: "accord",
    broken: false,
    ...(kind === undefined ? {} : { kind }),
    ...(tag === undefined ? {} : { tag }),
  });
const offered: GwCond = w({ is: "accord_offered" });
const pressureIs = (topic: GwTopic, min: number, max?: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
  ...(max === undefined ? {} : { max }),
});
const courted = (side: GwSide, min: number): GwCond =>
  w({ is: "courted", side, min });

// ---- The peace years (ww190 §1) ----

const ARMS: readonly GwScene[] = [
  card({
    id: "auh_y_rus_army",
    when: all(peaceFor(3), any(race("RUS"), arming(1, undefined, "RUS"))),
    cast: { cos: COS, fm: FM },
    vs: [["race", race("RUS")], ["base"]],
    picks: [
      pick("match", arms("army", 5), temp(1), opinion("army", 1)),
      pick("wait", inst("army", -1), trust("RUS", 1)),
    ],
    tags: ["foreign", "tension_up"],
    cooldown: 6,
  }),
  card({
    id: "auh_y_ita_navy",
    when: all(peaceFor(3), any(race("ITA"), arming(1, undefined, "ITA"))),
    cast: { navy: NAVY, fm: FM },
    vs: [["race", race("ITA")], ["base"]],
    picks: [
      pick("keels", arms("navy", 5), trust("ITA", -1)),
      pick("hold", inst("army", 1), trust("ITA", 1)),
    ],
    tags: ["foreign", "tension_up"],
    cooldown: 6,
  }),
  card({
    id: "auh_y_army_bill",
    when: all(peaceFor(2), arming(0, 1)),
    cast: { cos: COS, war: WAR, hun: HUN },
    vs: [["behind", race("RUS")], ["base"]],
    picks: [
      pick("budget", arms("army", 5), inst("hungary", -1)),
      pick("bill", inst("army", 1), remember("k_auh_y_bill_waits")),
      pick("later", inst("army", -1)),
    ],
    cooldown: 6,
  }),
  card({
    id: "auh_y_navy_estimates",
    when: all(peaceFor(6), arming(1)),
    cast: { navy: NAVY, hun: HUN, fin: FIN },
    vs: [["ita", race("ITA")], ["base"]],
    picks: [
      pick("fiume", arms("navy", 5), inst("hungary", 1), gauge("money", -1)),
      pick("trieste", arms("navy", 5), inst("hungary", -1)),
      pick("refuse", inst("army", 1), opinion("business", -1)),
    ],
    cooldown: 6,
  }),
  card({
    id: "auh_y_arms_price",
    when: all(peaceFor(4), arming(2)),
    cast: { hun: HUN, fin: FIN },
    vs: [["hungary_low", { kind: "inst", inst: "hungary", max: 0 }], ["base"]],
    picks: [
      pick("concede", inst("hungary", 1), inst("army", -1)),
      pick(
        "borrow",
        doWorld({ do: "budget_item", item: "debt", pct: 5 }),
        inst("berlin", 1),
      ),
      pick("cut", arms("army", -5), opinion("army", -1)),
    ],
    cooldown: 6,
  }),
];

const TALKS: readonly GwScene[] = [
  card({
    id: "auh_y_balkan_accord",
    when: all(
      peaceFor(3),
      pressureIs("balkan", 3),
      not(accordIn("balkan")),
      not(offered),
    ),
    cast: { fm: FM },
    vs: [["race", race("RUS")], ["base"]],
    picks: [
      pick(
        "offer",
        doWorld({ do: "accord", kind: "balkan", tag: "RUS" }),
        trust("RUS", 1),
      ),
      pick("no", opinion("army", 1)),
    ],
    tags: ["foreign", "tension_down"],
    once: true,
  }),
  card({
    id: "auh_y_adriatic_accord",
    when: all(
      peaceFor(4),
      any(race("ITA"), arming(2, undefined, "ITA")),
      not(accordIn("naval", "ITA")),
      not(offered),
    ),
    cast: { fm: FM, navy: NAVY },
    vs: [["race", race("ITA")], ["base"]],
    picks: [
      pick(
        "offer",
        doWorld({ do: "accord", kind: "naval", tag: "ITA" }),
        trust("ITA", 1),
      ),
      pick("no", inst("army", 1)),
    ],
    tags: ["foreign", "tension_down"],
    once: true,
  }),
  card({
    id: "auh_y_accord_keep",
    when: all(peaceFor(2), accordIn()),
    cast: { cos: COS, navy: NAVY },
    vs: [
      ["naval", accordIn("naval")],
      ["balkan", accordIn("balkan")],
      ["base"],
    ],
    picks: [
      pick("keep", inst("army", -1), temp(-1)),
      pick(
        "break",
        maybe(
          accordIn("naval"),
          doWorld({ do: "break_accord", kind: "naval" }),
        ),
        maybe(
          accordIn("balkan"),
          doWorld({ do: "break_accord", kind: "balkan" }),
        ),
        opinion("army", 1),
      ),
    ],
    tags: ["foreign"],
    once: true,
  }),
];

const ALLIANCE: readonly GwScene[] = [
  card({
    id: "auh_y_ally_renew",
    when: all(peaceFor(5), bondIs("DEU", 0)),
    cast: { fm: FM },
    vs: [["rome_cold", bondIs("ITA", undefined, -1)], ["base"]],
    picks: [
      pick("renew", bond("DEU", 1), bond("ITA", 1)),
      pick("albania", bond("DEU", 1), bond("ITA", -1), trust("ITA", -1)),
    ],
    tags: ["foreign"],
    once: true,
  }),
  card({
    id: "auh_y_ally_crack",
    when: all(peaceFor(3), bondIs("DEU", undefined, -1)),
    cast: { fm: FM, cos: COS },
    vs: [["deep", bondIs("DEU", undefined, -2)], ["base"]],
    picks: [
      pick("mend", bond("DEU", 1), inst("berlin", 1)),
      pick("own_way", bond("DEU", -1), inst("berlin", -1), temp(-1)),
    ],
    tags: ["foreign"],
    once: true,
  }),
  card({
    id: "auh_y_staff_talks",
    when: all(peaceFor(6), bondIs("DEU", 0)),
    cast: { cos: COS },
    vs: [["race", race("RUS")], ["base"]],
    picks: [
      pick("promise_east", bond("DEU", 1), opinion("army", 1)),
      pick("keep_free", bond("DEU", -1), inst("army", -1)),
    ],
    tags: ["foreign"],
    once: true,
  }),
];

const INCIDENTS: readonly GwScene[] = [
  card({
    id: "auh_y_inc_albania",
    when: all(peaceFor(1), pressureIs("balkan", 4, 6)),
    cast: { fm: FM },
    vs: [["again", seen("auh_y_inc_albania")], ["base"]],
    picks: [
      pick("money", pressure("balkan", -1), gauge("money", -1)),
      pick("with_rome", trust("ITA", 1), pressure("balkan", 1)),
    ],
    tags: ["foreign"],
    cooldown: 4,
  }),
  card({
    id: "auh_y_inc_border",
    when: all(peaceFor(1), pressureIs("balkan", 7, 8)),
    cast: { fm: FM, cos: COS },
    vs: [["race", race("RUS")], ["base"]],
    picks: [
      pick("note", temp(1), trust("SRB", -1), pressure("balkan", -2)),
      pick(
        "conference",
        trust("RUS", 1),
        pressure("balkan", 1),
        opinion("army", -1),
      ),
    ],
    salience: 7,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
  }),
  card({
    id: "auh_y_inc_romania",
    when: all(peaceFor(2), pressureIs("balkan", 4)),
    cast: { hun: HUN, fm: FM },
    vs: [["hot", pressureIs("balkan", 7)], ["base"]],
    picks: [
      pick("schools", inst("hungary", -1), inst("nations", 1), trust("ROU", 1)),
      pick(
        "refuse",
        inst("hungary", 1),
        trust("ROU", -1),
        pressure("balkan", 1),
      ),
    ],
    tags: ["foreign"],
    cooldown: 4,
  }),
  card({
    id: "auh_y_inc_galicia",
    when: all(peaceFor(2), pressureIs("poland", 4)),
    cast: { pm: PM, fm: FM },
    vs: [["hot", pressureIs("poland", 7)], ["base"]],
    picks: [
      pick("trial", trust("RUS", -1), gauge("order", 1), pressure("poland", 1)),
      pick("quiet", pressure("poland", -1), inst("army", -1)),
    ],
    tags: ["foreign"],
    cooldown: 4,
  }),
  card({
    id: "auh_y_inc_asia",
    when: all(
      peaceFor(3),
      any(pressureIs("straits", 4), pressureIs("colonial", 4)),
    ),
    cast: { fm: FM },
    vs: [["straits", pressureIs("straits", 4)], ["base"]],
    picks: [
      pick("seek", trust("ITA", -1), trust("OTT", 1), pressure("colonial", 1)),
      pick("drop", bond("DEU", 1), pressure("colonial", -1)),
    ],
    tags: ["foreign"],
    cooldown: 4,
  }),
];

const HOME: readonly GwScene[] = [
  card({
    id: "auh_y_home_bohemia",
    when: peaceFor(4),
    cast: { pm: PM },
    vs: [["strike", low("order", 2)], ["base"]],
    picks: [
      pick(
        "decree",
        gauge("order", 1),
        inst("nations", -1),
        inst("council", 1),
      ),
      pick("talks", inst("nations", 1), gauge("money", -1)),
    ],
    cooldown: 3,
  }),
  card({
    id: "auh_y_home_nowar",
    when: peaceFor(18),
    cast: { cos: COS },
    vs: [["armed", arming(2)], ["base"]],
    picks: [
      pick("rest", inst("army", -1), gauge("morale", 1)),
      pick("watch", opinion("army", 1)),
    ],
    tags: ["home", "tension_down"],
    once: true,
  }),
];

// ---- Sitting out the war (ww190 §6) ----

const NEUTRAL: readonly GwScene[] = [
  card({
    id: "auh_nt_berlin",
    when: all(sittingOut, courted("central", 1)),
    cast: { fm: FM },
    vs: [["high", courted("central", 3)], ["base"]],
    picks: [
      pick("listen", trust("DEU", 1), bond("DEU", 1)),
      pick("more", trust("DEU", -1)),
    ],
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
  }),
  card({
    id: "auh_nt_entente",
    when: all(sittingOut, courted("entente", 1)),
    cast: { fm: FM },
    vs: [["high", courted("entente", 3)], ["base"]],
    picks: [
      pick("hear", trust("RUS", 1), bond("DEU", -1)),
      pick("send_back", bond("DEU", 1), trust("RUS", -1)),
    ],
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
  }),
  card({
    id: "auh_nt_mediate",
    when: all(
      sittingOut,
      w({ is: "war_months", min: 3 }),
      not(w({ is: "mediating" })),
    ),
    cast: { fm: FM },
    vs: [["long", w({ is: "war_months", min: 18 })], ["base"]],
    picks: [pick("offer", doWorld({ do: "mediate" })), pick("not_yet")],
    tags: ["foreign", "tension_down"],
    cooldown: 6,
    max: 3,
  }),
  card({
    id: "auh_nt_mediating",
    when: all(sittingOut, w({ is: "mediating" })),
    cast: { fm: FM },
    vs: [["base"]],
    tags: ["foreign"],
    cooldown: 3,
    max: 3,
  }),
  card({
    id: "auh_nt_profits",
    when: all(sittingOut, w({ is: "war_months", min: 2 })),
    cast: { hun: HUN, fin: FIN },
    vs: [["blockade", w({ is: "blockade", min: 3 })], ["base"]],
    picks: [
      pick(
        "sell",
        doWorld({ do: "budget_item", item: "treasury", pct: 5 }),
        gauge("bread", -1),
        inst("hungary", 1),
      ),
      pick("keep", gauge("bread", 1), opinion("business", -1)),
    ],
    cooldown: 3,
    max: 3,
  }),
  card({
    id: "auh_nt_join",
    when: all(sittingOut, courted("central", 3)),
    cast: { cos: COS, hun: HUN },
    vs: [["ally_losing", w({ is: "score", max: -20 })], ["base"]],
    picks: [
      pick("join", doWorld({ do: "join", side: "central" }), bond("DEU", 1)),
      pick("wait", inst("army", -1), inst("hungary", 1)),
    ],
    salience: 8,
    tags: ["foreign", "war", "tension_up"],
    cooldown: 4,
    max: 2,
  }),
  card({
    id: "auh_nt_army",
    when: all(sittingOut, w({ is: "war_months", min: 4 })),
    cast: { cos: COS },
    vs: [["long", w({ is: "war_months", min: 15 })], ["base"]],
    picks: [
      pick("drills", inst("army", 1), gauge("money", -1)),
      pick("silence", inst("army", -1), opinion("army", -1)),
    ],
    cooldown: 3,
    max: 2,
  }),
  card({
    id: "auh_nt_poland",
    when: all(
      sittingOut,
      w({
        is: "land_taken",
        tag: "DEU",
        from: "RUS",
        group: ["russian_poland"],
      }),
    ),
    cast: { fm: FM, pm: PM },
    vs: [
      [
        "warsaw",
        w({ is: "land_taken", tag: "DEU", from: "RUS", place: ["warsaw"] }),
      ],
      ["base"],
    ],
    picks: [
      pick("claim", trust("DEU", -1), inst("nations", 1)),
      pick("leave", bond("DEU", 1), inst("nations", -1)),
    ],
    tags: ["foreign"],
    once: true,
  }),
  card({
    id: "auh_nt_tisza",
    when: all(sittingOut, w({ is: "war_months", min: 1 })),
    cast: { hun: HUN },
    vs: [["courted", courted("central", 2)], ["base"]],
    picks: [
      pick("agree", inst("hungary", 1), inst("army", -1)),
      pick("rebuke", inst("hungary", -1), inst("army", 1)),
    ],
    once: true,
  }),
];

export const AUH_YEARS_SCENES: readonly GwScene[] = [
  ...ARMS,
  ...TALKS,
  ...ALLIANCE,
  ...INCIDENTS,
  ...HOME,
  ...NEUTRAL,
];
