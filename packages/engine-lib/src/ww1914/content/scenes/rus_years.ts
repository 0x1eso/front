import type {
  GwAccordKind,
  GwGauge,
  GwInstitution,
  GwOffice,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, not, reason } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * RUS's scenes: the peace years (ww190 §1, `rus_y_*`) and the neutral great
 * power (§6, `rus_nt_*`). Data only; the text is in
 * resources/ww1914/ko/RUS.years.json. The kit at the top is shared by the
 * other ww190 RUS files (rus_rule, rus_homefront, rus_after, rus_colonies,
 * rus_agents). Options show no price: what a pick did comes after it, as the
 * reason line `<scene>_<pick>`.
 */

// ---- Kit ----

export const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
export const w = (of: GwWorldCond): GwCond => world(of);
export const dw = (of: GwWorldEffect): GwEffect => doWorld(of);
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
export const pressure = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
export const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const men = (delta: number): GwEffect => dw({ do: "manpower", delta });
export const arms = (line: "army" | "navy", delta: number): GwEffect =>
  dw({ do: "arms", line, delta });
export const bond = (tag: GwTag, delta: number): GwEffect =>
  dw({ do: "bond", tag, delta });
export const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
/** Whoever holds the office, or the minister trusted most if it stands empty. */
export const held = (o: GwOffice): GwCastRule => ({
  any_of: [{ office: o }, { favourite: true }],
});

export interface RusOpt {
  id: string;
  effects: GwEffect[];
  when?: GwCond;
}
export const o = (id: string, effects: GwEffect[], when?: GwCond): RusOpt =>
  when === undefined ? { id, effects } : { id, effects, when };

export interface RusSpec {
  kind: GwScene["kind"];
  when: GwCond;
  cast: Record<string, GwCastRule>;
  salience: number;
  tags: GwScene["tags"];
  variants: GwVariant[];
  options?: RusOpt[];
  once?: boolean;
  cooldown?: number;
  max?: number;
  stage?: GwScene["stage"];
  assumes?: GwAssumes;
  fallback?: string;
}

/**
 * A RUS desk scene. Each option ends on its reason line `<id>_<option>`; the
 * fallback is the last option unless named.
 */
export function rusScene(id: string, s: RusSpec): GwScene {
  const out: GwScene = {
    id,
    nation: ["RUS"],
    kind: s.kind,
    when: s.when,
    cast: s.cast,
    salience: s.salience,
    tags: s.tags,
    variants: s.variants,
  };
  if (s.stage !== undefined) out.stage = s.stage;
  if (s.assumes !== undefined) out.assumes = s.assumes;
  if (s.once === true) out.once = true;
  if (s.cooldown !== undefined) out.cooldown = s.cooldown;
  if (s.max !== undefined) out.max = s.max;
  const opts = s.options ?? [];
  if (opts.length > 0) {
    out.options = opts.map((x) => ({
      id: x.id,
      ...(x.when === undefined ? {} : { when: x.when }),
      tell: [],
      effects: [...x.effects, reason(`${id}_${x.id}`)],
    }));
    out.fallback = s.fallback ?? opts[opts.length - 1].id;
  }
  return out;
}

// ---- The peace years ----

/** No great war anywhere: none has begun, so there are no months to count. */
const noWorldWar = not(w({ is: "war_months", min: 0 }));
/** Months of peace since the crisis closed, and no great war. */
const peace = (min: number): GwCond =>
  all(w({ is: "peace_months", min }), noWorldWar);
const arming = (tag: GwTag, min: number): GwCond =>
  w({ is: "arming", tag, min });
const ourArms = (min: number, max?: number): GwCond =>
  w(max === undefined ? { is: "arming", min } : { is: "arming", min, max });
const bondWith = (tag: GwTag, r: { min?: number; max?: number }): GwCond =>
  w({ is: "bond", tag, ...r });
const pressureOf = (topic: GwTopic, min: number, max?: number): GwCond =>
  max === undefined
    ? { kind: "pressure", topic, min }
    : { kind: "pressure", topic, min, max };
const accordOf = (kind?: GwAccordKind): GwCond =>
  w(
    kind === undefined
      ? { is: "accord", broken: false }
      : { is: "accord", kind, broken: false },
  );
const treasury = (pct: number): GwEffect =>
  dw({ do: "budget_item", item: "treasury", pct });

const FOREIGN = { foreign: held("foreign") };
const COS = { cos: held("chief_of_staff") };
const WAR = { war: held("war") };
const FIN = { fin: held("finance") };
const NAVY = { navy: held("navy") };

const YEARS: GwScene[] = [
  // Arms 3, and the railway loan; cooldown 6.
  rusScene("rus_y_arms_rival", {
    kind: "proposal",
    when: all(peace(0), any(arming("DEU", 1), arming("AUH", 1))),
    cast: { ...COS, ...WAR },
    salience: 6,
    tags: ["foreign", "tension_up"],
    cooldown: 6,
    variants: [
      v("both", all(arming("DEU", 1), arming("AUH", 1))),
      v("deu", arming("DEU", 1)),
      v("base"),
    ],
    options: [
      o("match", [arms("army", 5), inst("stavka", 1)]),
      o("railways", [gauge("money", -1), trust("FRA", 1), bond("FRA", 1)]),
      o("wait", [inst("stavka", -1), temp(-1)]),
    ],
  }),
  rusScene("rus_y_arms_bill", {
    kind: "proposal",
    when: all(peace(2), ourArms(0, 1)),
    cast: { ...WAR, ...FIN },
    salience: 6,
    tags: ["home"],
    cooldown: 6,
    variants: [v("race", w({ is: "arms_race", tag: "DEU" })), v("base")],
    options: [
      o("whole", [arms("army", 10), inst("stavka", 1), gauge("money", -1)]),
      o("half", [arms("army", 5)]),
      o("shelve", [inst("stavka", -1), inst("ministers", 1)]),
    ],
  }),
  rusScene("rus_y_arms_price", {
    kind: "proposal",
    when: all(peace(3), ourArms(2)),
    cast: FIN,
    salience: 6,
    tags: ["home"],
    cooldown: 6,
    variants: [v("race", w({ is: "arms_race", tag: "AUH" })), v("base")],
    options: [
      o("taxes", [
        dw({ do: "budget_mix", source: "taxes", delta: 10 }),
        opinion("workers", -1),
        gauge("order", -1),
      ]),
      o("paris", [
        dw({ do: "budget_mix", source: "loans", delta: 10 }),
        bond("FRA", 1),
      ]),
      o("trim", [arms("army", -5), inst("stavka", -1)]),
    ],
  }),
  rusScene("rus_y_arms_rail_loan", {
    kind: "proposal",
    // ww190 tune: from the first month after the summer (was 1).
    when: all(peace(0), bondWith("FRA", { min: 0 })),
    cast: { ...FIN, ...COS },
    salience: 5,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("take", [bond("FRA", 1), treasury(10), inst("stavka", 1)]),
      o("own_lines", [gauge("money", -1), opinion("business", 1)]),
      o("decline", [bond("FRA", -1), trust("FRA", -1)]),
    ],
  }),
  // Talks 2, once.
  rusScene("rus_y_talk_seek", {
    kind: "proposal",
    when: all(
      peace(2),
      // ww190 tune: was 4; talks are sought once the questions have ripened.
      any(pressureOf("balkan", 14), pressureOf("straits", 14)),
      not(accordOf()),
    ),
    cast: FOREIGN,
    salience: 6,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [v("straits", pressureOf("straits", 5)), v("base")],
    options: [
      o("vienna", [dw({ do: "accord", kind: "balkan", tag: "AUH" })]),
      o("berlin", [dw({ do: "accord", kind: "straits", tag: "DEU" })]),
      o("london", [dw({ do: "accord", kind: "colonial", tag: "GBR" })]),
      o("none", [opinion("press", 1)]),
    ],
  }),
  rusScene("rus_y_talk_keep", {
    kind: "proposal",
    when: all(peace(3), accordOf(), { kind: "temp", min: 4 }),
    cast: { ...FOREIGN, ...COS },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o(
        "break_balkan",
        [dw({ do: "break_accord", kind: "balkan" }), inst("stavka", 1)],
        accordOf("balkan"),
      ),
      o(
        "break_straits",
        [dw({ do: "break_accord", kind: "straits" }), inst("stavka", 1)],
        accordOf("straits"),
      ),
      o(
        "break_colonial",
        [dw({ do: "break_accord", kind: "colonial" }), inst("stavka", 1)],
        accordOf("colonial"),
      ),
      o("keep", [inst("stavka", -1), opinion("press", -1), temp(-1)]),
    ],
  }),
  // The alliance 3, once.
  rusScene("rus_y_ally_renew", {
    kind: "proposal",
    when: all(peace(3), bondWith("FRA", { min: 0 })),
    cast: { ...FOREIGN, ...COS },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [v("close", bondWith("FRA", { min: 2 })), v("base")],
    options: [
      o("fifteenth_day", [bond("FRA", 1), trust("FRA", 1), inst("stavka", -1)]),
      o("renew", [bond("FRA", 1)]),
      o("loosen", [bond("FRA", -1), temp(-1)]),
    ],
  }),
  rusScene("rus_y_ally_crack", {
    kind: "proposal",
    when: all(peace(1), bondWith("FRA", { max: -1 })),
    cast: { ...FOREIGN, ...FIN },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("mend", [bond("FRA", 1), gauge("money", -1)]),
      o("berlin", [trust("DEU", 1), bond("FRA", -1), temp(-1)]),
      o("wait", [trust("FRA", -1)]),
    ],
  }),
  rusScene("rus_y_ally_staff", {
    kind: "proposal",
    when: all(peace(2), bondWith("GBR", { min: 0 })),
    cast: { ...NAVY, ...FOREIGN },
    salience: 5,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("talk_on", [bond("GBR", 1), trust("DEU", -1), temp(1)]),
      o("quietly", [bond("GBR", 1), trust("GBR", -1)]),
      o("drop", [bond("GBR", -1), trust("DEU", 1)]),
    ],
  }),
  // Incidents 4: the straits twice, the Balkans, Persia. Cooldown 4.
  rusScene("rus_y_inc_dreadnoughts", {
    kind: "proposal",
    when: all(peace(0), pressureOf("straits", 4, 6)),
    cast: { ...NAVY, ...FOREIGN },
    salience: 6,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("black_sea", [arms("navy", 5), pressure("straits", 1)]),
      o("london", [trust("GBR", -1), bond("GBR", -1), pressure("straits", -1)]),
      o("wait", [pressure("straits", 1)]),
    ],
  }),
  rusScene("rus_y_inc_straits_shut", {
    kind: "proposal",
    // ww190 tune: the Straits shut later (was 7).
    when: all(peace(0), pressureOf("straits", 14)),
    cast: { ...FOREIGN, ...NAVY },
    salience: 7,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("fleet", [
        temp(1),
        pressure("straits", 1),
        trust("OTT", -1),
        opinion("press", 1),
      ]),
      o("protest", [
        pressure("straits", -1),
        trust("GBR", 1),
        gauge("money", -1),
      ]),
      o("wait", [gauge("money", -1), opinion("business", -1)]),
    ],
  }),
  rusScene("rus_y_inc_balkan", {
    kind: "proposal",
    // ww190 tune: incidents ripen in turn as pressure climbs (about a point a
    // month in peace), not all in the first autumn.
    when: all(peace(0), pressureOf("balkan", 10)),
    cast: FOREIGN,
    salience: 6,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [v("hot", pressureOf("balkan", 13)), v("base")],
    options: [
      o("back_belgrade", [
        pressure("balkan", 1),
        temp(1),
        trust("SRB", 1),
        trust("AUH", -1),
      ]),
      o("restrain", [
        pressure("balkan", -1),
        trust("SRB", -1),
        opinion("press", -1),
      ]),
      o("vienna", [
        pressure("balkan", -1),
        trust("AUH", 1),
        opinion("army", -1),
      ]),
    ],
  }),
  rusScene("rus_y_inc_persia", {
    kind: "proposal",
    // ww190 tune: incidents ripen in turn as pressure climbs (about a point a
    // month in peace), not all in the first autumn.
    when: all(peace(0), pressureOf("colonial", 16)),
    cast: FOREIGN,
    salience: 5,
    tags: ["foreign"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("tabriz", [pressure("colonial", 1), bond("GBR", -1), trust("GBR", -1)]),
      o("settle", [
        pressure("colonial", -1),
        bond("GBR", 1),
        opinion("army", -1),
      ]),
      o("wait", [pressure("colonial", 1)]),
    ],
  }),
  // Home 2, and the war that didn't come; cooldown 3.
  rusScene("rus_y_home_strike", {
    kind: "proposal",
    // ww190 tune: the home goes on from the first month after the summer.
    when: peace(0),
    cast: { interior: held("interior") },
    salience: 5,
    tags: ["home"],
    cooldown: 3,
    variants: [v("orders", ourArms(2)), v("base")],
    options: [
      o("troops", [
        gauge("order", 1),
        gauge("morale", -1),
        opinion("workers", -1),
      ]),
      o("inspectors", [opinion("workers", 1), opinion("business", -1)]),
      o("wait_out", [gauge("order", -1), opinion("business", 1)]),
    ],
  }),
  rusScene("rus_y_home_reform", {
    kind: "proposal",
    when: peace(4),
    cast: { agri: held("agriculture") },
    salience: 5,
    tags: ["home"],
    cooldown: 3,
    variants: [v("base")],
    options: [
      o("push", [gauge("bread", 1), gauge("money", -1), inst("duma", 1)]),
      o("zemstvo", [inst("duma", 1), inst("court", -1)]),
      o("slow", [inst("court", 1), opinion("press", -1)]),
    ],
  }),
  rusScene("rus_y_home_no_war", {
    kind: "proposal",
    // ww190 tune: a year and a half after the summer (peace_months counts
    // from the last crisis, so 18 of them never came), two quiet months on.
    when: all(peace(2), w({ is: "date", from: "1916-01" })),
    cast: { pm: held("chancellor"), ...COS },
    salience: 6,
    tags: ["home", "tension_down"],
    once: true,
    variants: [v("armed", ourArms(2)), v("base")],
    options: [
      o("keep_arming", [inst("stavka", 1), gauge("money", -1)]),
      o("to_the_land", [
        arms("army", -5),
        gauge("bread", 1),
        inst("stavka", -1),
      ]),
      o("as_it_is", [temp(-1)]),
    ],
  }),
];

// ---- The neutral great power (§6): cooldown 3, an offer at most twice ----

/** The great war is on and Russia sits it out, still in the game. */
const sitsOut = (min: number): GwCond =>
  all(
    w({ is: "war_months", min }),
    w({ is: "side", of: ["neutral"] }),
    not(w({ is: "out", tag: "RUS" })),
  );
const courted = (side: "entente" | "central", min: number): GwCond =>
  w({ is: "courted", side, min });

const NEUTRAL: GwScene[] = [
  rusScene("rus_nt_offer_entente", {
    kind: "proposal",
    when: all(sitsOut(0), courted("entente", 1)),
    cast: FOREIGN,
    salience: 7,
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
    variants: [v("rich", courted("entente", 3)), v("base")],
    options: [
      o("join", [dw({ do: "join", side: "entente" })]),
      o("more", [trust("FRA", -1), trust("GBR", -1), pressure("straits", 1)]),
      o("wait", [opinion("press", -1)]),
    ],
  }),
  rusScene("rus_nt_offer_central", {
    kind: "proposal",
    when: all(sitsOut(0), courted("central", 1)),
    cast: FOREIGN,
    salience: 7,
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
    variants: [v("rich", courted("central", 3)), v("base")],
    options: [
      o("join", [dw({ do: "join", side: "central" }), opinion("press", -2)]),
      o("listen", [trust("DEU", 1), trust("FRA", -1)]),
      o("refuse", [trust("DEU", -1), trust("FRA", 1)]),
    ],
  }),
  rusScene("rus_nt_price", {
    kind: "proposal",
    when: sitsOut(2),
    cast: FOREIGN,
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("straits", [pressure("straits", 1), opinion("press", 1)]),
      o("galicia", [trust("AUH", -1), opinion("army", 1)]),
      o("nothing", [opinion("press", -1)]),
    ],
  }),
  rusScene("rus_nt_mediate", {
    kind: "proposal",
    when: all(sitsOut(4), not(w({ is: "mediating" }))),
    cast: FOREIGN,
    salience: 6,
    tags: ["foreign", "tension_down"],
    cooldown: 6,
    variants: [v("base")],
    options: [
      o("offer", [dw({ do: "mediate" }), opinion("court", 1)]),
      o("not_yet", [opinion("press", -1)]),
    ],
  }),
  rusScene("rus_nt_mediating", {
    kind: "wire",
    when: all(sitsOut(0), w({ is: "mediating" })),
    cast: FOREIGN,
    salience: 5,
    tags: ["foreign"],
    cooldown: 3,
    variants: [v("base")],
  }),
  rusScene("rus_nt_profits", {
    kind: "proposal",
    when: sitsOut(2),
    cast: { ...FIN, agri: held("agriculture") },
    salience: 5,
    tags: ["home", "foreign"],
    cooldown: 3,
    variants: [v("shut", w({ is: "entered", tag: "OTT" })), v("base")],
    options: [
      o("sell_all", [treasury(20), trust("FRA", -1)]),
      o("friends_only", [treasury(10), trust("FRA", 1), trust("DEU", -1)]),
      o("keep_home", [gauge("bread", 1), opinion("business", -1)]),
    ],
  }),
  rusScene("rus_nt_generals", {
    kind: "proposal",
    when: sitsOut(3),
    cast: COS,
    salience: 6,
    tags: ["war", "home"],
    cooldown: 3,
    variants: [v("base")],
    options: [
      o("in_with_paris", [dw({ do: "join", side: "entente" })]),
      o("ready", [inst("stavka", 1), gauge("money", -1)]),
      o("no", [inst("stavka", -1)]),
    ],
  }),
  rusScene("rus_nt_slavs", {
    kind: "proposal",
    when: all(sitsOut(1), w({ is: "entered", tag: "SRB" })),
    cast: FOREIGN,
    salience: 6,
    tags: ["foreign", "home"],
    cooldown: 3,
    variants: [v("base")],
    options: [
      o("go_in", [dw({ do: "join", side: "entente" }), opinion("press", 1)]),
      o("aid", [gauge("money", -1), trust("SRB", 1), opinion("press", 1)]),
      o("silent", [trust("SRB", -1), opinion("press", -1)]),
    ],
  }),
  rusScene("rus_nt_long", {
    kind: "proposal",
    when: sitsOut(18),
    cast: { pm: held("chancellor") },
    salience: 6,
    tags: ["home", "foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("stay_out", [gauge("morale", 1), opinion("army", -1)]),
      o("entente", [dw({ do: "join", side: "entente" })]),
      o("central", [dw({ do: "join", side: "central" }), opinion("press", -2)]),
    ],
  }),
];

export const RUS_YEARS_SCENES: readonly GwScene[] = [...YEARS, ...NEUTRAL];
