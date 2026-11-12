import type {
  GwGauge,
  GwInstitution,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, not, reason } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * GBR's scenes: the peace years (ww190 §1). Data only; the text is in
 * resources/ww1914/ko/GBR.years.json. The small kit below is shared by the
 * other ww190 GBR files (rule, homefront, after, the neutral cards).
 */

export const GBR: GwScene["nation"] = ["GBR"];

// ---- The kit ----

/** An option with no price shown: what came of it is its reason line after. */
export const pick = (
  scene: string,
  id: string,
  effects: GwEffect[],
  when?: GwCond,
): GwOption => {
  const fx = [...effects, reason(`${scene}_${id}`)];
  return when === undefined
    ? { id, tell: [], effects: fx }
    : { id, when, tell: [], effects: fx };
};
export const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
export const press = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
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
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const men = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });

/** Peace: no great war, and so many months since a crisis closed without one. */
export const peaceFor = (min: number, max?: number): GwCond =>
  all(
    not(world({ is: "war" })),
    world({
      is: "peace_months",
      min,
      ...(max === undefined ? {} : { max }),
    }),
  );
const tension = (topic: GwTopic, min: number, max?: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
  ...(max === undefined ? {} : { max }),
});
const arms = (line: "army" | "navy", delta: number): GwEffect =>
  doWorld({ do: "arms", line, delta });
const bond = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });
const mix = (source: "taxes" | "bonds", delta: number): GwEffect =>
  doWorld({ do: "budget_mix", source, delta });
const bondAt = (tag: GwTag, min?: number, max?: number): GwCond =>
  world({
    is: "bond",
    tag,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });
const germanyArms = world({ is: "arming", tag: "DEU", min: 1 });
const weArm = (min: number): GwCond => world({ is: "arming", min });
const navalAccord = world({ is: "accord", kind: "naval", tag: "DEU" });

const navy: GwCastRule = { office: "navy" };
const fin: GwCastRule = { office: "finance" };
const fm: GwCastRule = { office: "foreign" };
const home: GwCastRule = { office: "interior" };

export const GBR_YEARS_SCENES: readonly GwScene[] = [
  // ---- Arms: the rival's programme, our bill, the bill's price ----
  {
    id: "gbr_y_arms_rival",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(1), any(germanyArms, tension("naval", 4))),
    cast: { navy },
    salience: 7,
    tags: ["foreign", "tension_up"],
    cooldown: 6,
    variants: [
      { id: "race", when: world({ is: "arms_race", tag: "DEU" }) },
      { id: "base" },
    ],
    fallback: "hold_ratio",
    options: [
      pick("gbr_y_arms_rival", "two_keels", [
        arms("navy", 5),
        press("naval", 1),
        trust("DEU", -1),
      ]),
      pick("gbr_y_arms_rival", "hold_ratio", [inst("cabinet", 1)]),
      pick("gbr_y_arms_rival", "ask_berlin", [
        doWorld({ do: "accord", kind: "naval", tag: "DEU" }),
      ]),
    ],
  },
  {
    id: "gbr_y_arms_bill",
    nation: GBR,
    kind: "dispute",
    when: all(peaceFor(3), any(germanyArms, weArm(1), tension("naval", 5))),
    cast: { navy, fin },
    salience: 7,
    tags: ["home", "tension_up"],
    cooldown: 6,
    variants: [{ id: "arming", when: weArm(2) }, { id: "base" }],
    fallback: "split",
    options: [
      pick("gbr_y_arms_bill", "admiralty", [
        arms("navy", 5),
        inst("cabinet", -1),
      ]),
      pick("gbr_y_arms_bill", "treasury", [
        arms("navy", -5),
        gauge("money", 1),
        opinion("press", -1),
      ]),
      pick("gbr_y_arms_bill", "split", [
        doWorld({
          do: "law_start",
          law: "gbr_navy_estimates",
          origin: "seat",
        }),
      ]),
    ],
  },
  {
    id: "gbr_y_arms_price",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(4), weArm(2)),
    cast: { fin },
    salience: 6,
    tags: ["home"],
    cooldown: 6,
    variants: [{ id: "army_too", when: weArm(3) }, { id: "base" }],
    fallback: "borrow",
    options: [
      pick("gbr_y_arms_price", "land_tax", [
        mix("taxes", 5),
        opinion("business", -1),
        opinion("workers", 1),
      ]),
      pick("gbr_y_arms_price", "borrow", [mix("bonds", 5)]),
      pick("gbr_y_arms_price", "army_pays", [
        arms("army", -5),
        opinion("army", -1),
      ]),
    ],
  },

  // ---- Talks: an accord sought, offered, kept ----
  {
    id: "gbr_y_talk_berlin",
    nation: GBR,
    kind: "proposal",
    when: all(
      peaceFor(2),
      any(germanyArms, tension("naval", 3)),
      not(world({ is: "accord", kind: "naval" })),
      not(world({ is: "accord_offered" })),
    ),
    cast: { fm, navy },
    salience: 7,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "race", when: world({ is: "arms_race", tag: "DEU" }) },
      { id: "base" },
    ],
    fallback: "not_now",
    options: [
      pick("gbr_y_talk_berlin", "envoy", [
        doWorld({ do: "accord", kind: "naval", tag: "DEU" }),
        bond("FRA", -1),
      ]),
      pick("gbr_y_talk_berlin", "holiday", [
        doWorld({ do: "accord", kind: "naval", tag: "DEU" }),
        opinion("press", 1),
        opinion("army", -1),
      ]),
      pick("gbr_y_talk_berlin", "colonies", [
        doWorld({ do: "accord", kind: "colonial", tag: "DEU" }),
      ]),
      pick("gbr_y_talk_berlin", "not_now", [press("naval", 1)]),
    ],
  },
  {
    id: "gbr_y_talk_offer",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(0), world({ is: "accord_offered" })),
    cast: { fm },
    salience: 8,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "naval", when: world({ is: "accord_offered", kind: "naval" }) },
      {
        id: "colonial",
        when: world({ is: "accord_offered", kind: "colonial" }),
      },
      { id: "base" },
    ],
    fallback: "paris_first",
    options: [
      pick("gbr_y_talk_offer", "accept", [
        doWorld({ do: "accord_answer", yes: true }),
      ]),
      pick("gbr_y_talk_offer", "paris_first", [
        doWorld({ do: "accord_answer", yes: true }),
        trust("FRA", 1),
        temp(1),
      ]),
      pick("gbr_y_talk_offer", "decline", [
        doWorld({ do: "accord_answer", yes: false }),
        bond("FRA", 1),
      ]),
    ],
  },
  {
    id: "gbr_y_talk_keep",
    nation: GBR,
    kind: "dispute",
    when: all(peaceFor(1), navalAccord, any(germanyArms, tension("naval", 3))),
    cast: { navy, fm },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "race", when: world({ is: "arming", tag: "DEU", min: 2 }) },
      { id: "base" },
    ],
    fallback: "keep",
    options: [
      pick("gbr_y_talk_keep", "keep", [
        press("naval", -1),
        opinion("press", -1),
      ]),
      pick("gbr_y_talk_keep", "build", [arms("navy", 5)]),
      pick("gbr_y_talk_keep", "end_it", [
        doWorld({ do: "break_accord", kind: "naval", tag: "DEU" }),
      ]),
    ],
  },

  // ---- The alliance: renewal, a crack, staff talks ----
  {
    id: "gbr_y_bond_letters",
    nation: GBR,
    kind: "audience",
    when: all(peaceFor(3), bondAt("FRA", 0)),
    cast: { amb: { office: "ambassador_london", tag: "FRA" }, fm },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [{ id: "close", when: bondAt("FRA", 2) }, { id: "base" }],
    fallback: "letters",
    options: [
      pick("gbr_y_bond_letters", "letters", [bond("FRA", 1), temp(1)]),
      pick("gbr_y_bond_letters", "free_hands", [
        bond("FRA", -1),
        trust("DEU", 1),
      ]),
      pick("gbr_y_bond_letters", "cabinet_sees", [
        bond("FRA", 1),
        inst("cabinet", -1),
      ]),
    ],
  },
  {
    id: "gbr_y_bond_crack",
    nation: GBR,
    kind: "proposal",
    when: all(
      peaceFor(2),
      any(bondAt("FRA", undefined, -1), bondAt("RUS", undefined, -1)),
    ),
    cast: { fm },
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "persia", when: bondAt("RUS", undefined, -1) },
      { id: "base" },
    ],
    fallback: "let_cool",
    options: [
      pick("gbr_y_bond_crack", "mend", [
        {
          kind: "maybe",
          when: bondAt("FRA", undefined, -1),
          then: [bond("FRA", 1)],
        },
        {
          kind: "maybe",
          when: bondAt("RUS", undefined, -1),
          then: [bond("RUS", 1)],
        },
        gauge("money", -1),
      ]),
      pick("gbr_y_bond_crack", "let_cool", [temp(-1)]),
      pick("gbr_y_bond_crack", "berlin_door", [
        trust("DEU", 1),
        bond("FRA", -1),
        bond("RUS", -1),
      ]),
    ],
  },
  {
    id: "gbr_y_bond_staff",
    nation: GBR,
    kind: "dispute",
    when: all(peaceFor(4), any(bondAt("FRA", 0), bondAt("RUS", 1))),
    cast: {
      soldier: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      fm,
    },
    salience: 6,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [{ id: "russia", when: bondAt("RUS", 1) }, { id: "base" }],
    fallback: "fleets_only",
    options: [
      pick("gbr_y_bond_staff", "full_talks", [
        bond("FRA", 1),
        temp(1),
        inst("cabinet", -1),
      ]),
      pick("gbr_y_bond_staff", "fleets_only", [bond("FRA", 1)]),
      pick("gbr_y_bond_staff", "russian_ships", [
        bond("RUS", 1),
        trust("DEU", -1),
        temp(1),
      ]),
      pick("gbr_y_bond_staff", "no_talks", [bond("FRA", -1), bond("RUS", -1)]),
    ],
  },

  // ---- Incidents: two at sea, one Balkan, one colonial ----
  {
    id: "gbr_y_inc_spy",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(1), tension("naval", 4, 6)),
    cast: { home },
    salience: 5,
    tags: ["home", "tension_up"],
    cooldown: 4,
    variants: [
      { id: "race", when: world({ is: "arms_race", tag: "DEU" }) },
      { id: "base" },
    ],
    fallback: "deport",
    options: [
      pick("gbr_y_inc_spy", "trial", [
        press("naval", 1),
        opinion("press", 1),
        trust("DEU", -1),
      ]),
      pick("gbr_y_inc_spy", "deport", [press("naval", -1)]),
      pick("gbr_y_inc_spy", "watch", [gauge("order", 1)]),
    ],
  },
  {
    id: "gbr_y_inc_fog",
    nation: GBR,
    kind: "crisis",
    when: all(peaceFor(1), tension("naval", 7, 8)),
    cast: { navy, fm },
    salience: 8,
    tags: ["foreign", "tension_up"],
    cooldown: 4,
    variants: [{ id: "accord", when: navalAccord }, { id: "base" }],
    fallback: "inquiry",
    options: [
      pick("gbr_y_inc_fog", "inquiry", [
        press("naval", -2),
        temp(-1),
        trust("DEU", 1),
        opinion("press", -1),
      ]),
      pick("gbr_y_inc_fog", "apology", [
        press("naval", 1),
        temp(1),
        opinion("press", 1),
      ]),
      pick("gbr_y_inc_fog", "silence", [
        press("naval", -1),
        opinion("army", -1),
      ]),
    ],
  },
  {
    id: "gbr_y_inc_albania",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(1), tension("balkan", 4)),
    cast: { fm },
    salience: 6,
    tags: ["foreign"],
    cooldown: 4,
    variants: [{ id: "hot", when: tension("balkan", 7) }, { id: "base" }],
    fallback: "vienna_rome",
    options: [
      pick("gbr_y_inc_albania", "cruiser", [
        press("balkan", -1),
        trust("AUH", 1),
        trust("ITA", 1),
        gauge("money", -1),
      ]),
      pick("gbr_y_inc_albania", "vienna_rome", [press("balkan", 1)]),
      pick("gbr_y_inc_albania", "ambassadors", [
        press("balkan", -1),
        temp(-1),
        trust("RUS", -1),
      ]),
    ],
  },
  {
    id: "gbr_y_inc_colonies",
    nation: GBR,
    kind: "proposal",
    when: all(peaceFor(2), tension("colonial", 4)),
    cast: { fm },
    salience: 6,
    tags: ["foreign"],
    cooldown: 4,
    variants: [
      {
        id: "signed",
        when: world({ is: "accord", kind: "colonial", tag: "DEU" }),
      },
      { id: "base" },
    ],
    fallback: "drawer",
    options: [
      pick("gbr_y_inc_colonies", "publish", [
        doWorld({ do: "accord", kind: "colonial", tag: "DEU" }),
        press("colonial", -1),
        trust("PRT", -1),
      ]),
      pick("gbr_y_inc_colonies", "drawer", [press("colonial", 1)]),
      pick("gbr_y_inc_colonies", "lisbon", [
        trust("PRT", 1),
        trust("DEU", -1),
        press("colonial", 1),
      ]),
    ],
  },

  // ---- At home: a strike in peace, and the war that didn't come ----
  {
    id: "gbr_y_home_strike",
    nation: GBR,
    kind: "proposal",
    when: peaceFor(2),
    cast: { home, fin },
    salience: 6,
    tags: ["home", "tension_up"],
    cooldown: 3,
    variants: [
      { id: "tense", when: { kind: "gauge", gauge: "order", max: 2 } },
      { id: "base" },
    ],
    fallback: "conciliate",
    options: [
      pick("gbr_y_home_strike", "conciliate", [
        gauge("money", -1),
        opinion("workers", 1),
      ]),
      pick("gbr_y_home_strike", "troops", [
        gauge("order", 1),
        opinion("workers", -2),
        inst("cabinet", -1),
      ]),
      pick("gbr_y_home_strike", "wage_law", [
        opinion("workers", 1),
        opinion("business", -1),
        gauge("money", -1),
      ]),
    ],
  },
  {
    id: "gbr_y_home_long",
    nation: GBR,
    kind: "proposal",
    when: peaceFor(18),
    cast: { fin, navy },
    salience: 7,
    tags: ["home", "tension_down"],
    once: true,
    variants: [{ id: "arming", when: weArm(1) }, { id: "base" }],
    fallback: "keep_fleet",
    options: [
      pick("gbr_y_home_long", "cut", [
        arms("navy", -5),
        gauge("money", 1),
        opinion("workers", 1),
      ]),
      pick("gbr_y_home_long", "keep_fleet", [opinion("press", 1)]),
      pick("gbr_y_home_long", "conference", [temp(-1), trust("DEU", 1)]),
    ],
  },
];
