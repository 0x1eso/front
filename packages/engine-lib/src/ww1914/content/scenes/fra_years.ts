// Great War 1914 (ww190 §1): FRA's peace years, and the small kit the other
// ww190 FRA files share (fra_rule, fra_homefront, fra_after, fra_colonies,
// fra_president). Owned by the W-FRA lane; the conds and effects are in
// /home/eser/dev/ww190-interfaces.md. Text in resources/ww1914/ko/FRA.years.json.
import type {
  GwGauge,
  GwInstitution,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  not,
  reason,
  type GwCond,
  type GwEffect,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  doWorld,
  world,
  type GwWorldCond,
} from "@openfront/engine-api/ww1914/WorldDsl";

// ---- The kit (ww190, FRA) ----

type Option = NonNullable<GwScene["options"]>[number];

/** A world cond whose range fields are left out when undefined. */
export const ranged = (of: GwWorldCond, min?: number, max?: number): GwCond =>
  world({
    ...of,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  } as GwWorldCond);

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
export const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
export const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
export const men = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
export const low = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
export const atWar = world({ is: "war" });
/** France's own war, at least `min` whole months old. */
export const warMonths = (min: number, max?: number): GwCond =>
  ranged({ is: "war_months", own: true }, min, max);

export const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** An option whose record line is `<scene>_<option>`; nothing shown before. */
export const o = (scene: string, id: string, effects: GwEffect[]): Option => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

/** A paper to sign; a timer takes the last option. */
export function paper(
  id: string,
  when: GwCond,
  variants: GwVariant[],
  options: [string, GwEffect[]][],
  x: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: ["FRA"],
    kind: "proposal",
    salience: 6,
    tags: ["foreign", "tension_up"],
    cast: {},
    when,
    variants,
    options: options.map(([oid, fx]) => o(id, oid, fx)),
    fallback: options[options.length - 1][0],
    ...x,
  };
}

/** A wire: read and gone. */
export function wire(
  id: string,
  when: GwCond,
  variants: GwVariant[],
  x: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: ["FRA"],
    kind: "wire",
    salience: 5,
    tags: ["foreign"],
    cast: {},
    once: true,
    when,
    variants,
    ...x,
  };
}

export const fm = { office: "foreign" } as const;
export const pm = { office: "chancellor" } as const;
export const navy = { office: "navy" } as const;
export const warMin = { office: "war" } as const;
export const cos = { office: "chief_of_staff" } as const;
export const fin = { office: "finance" } as const;
export const home = { office: "interior" } as const;

// ---- Conditions ----

/**
 * Poincaré's desk while the war doesn't come: the arms race with Germany, the
 * accords, the two alliances, the incidents that ripen with pressure, and the
 * home that goes on. Every card waits on `peace_months` with France never at
 * war; the state calls them, not the calendar.
 */
const peace = (min = 1): GwCond =>
  all(world({ is: "peace_months", min }), not(atWar));
const pressure = (topic: GwTopic, min: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
});
const arming = (tag: GwTag | null, min: number, max?: number): GwCond =>
  ranged(tag === null ? { is: "arming" } : { is: "arming", tag }, min, max);
const bond = (tag: GwTag, min?: number, max?: number): GwCond =>
  ranged({ is: "bond", tag }, min, max);
const race = (tag: GwTag): GwCond => world({ is: "arms_race", tag });
const colonialInForce = world({
  is: "accord",
  kind: "colonial",
  broken: false,
});

// ---- Effects ----

const press = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
const arms = (line: "army" | "navy", delta: number): GwEffect =>
  doWorld({ do: "arms", line, delta });
const tie = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });

// ---- Arms (cooldown 6) ----

const ARMS: GwScene[] = [
  paper(
    "fra_y_arms_rival",
    all(peace(), arming("DEU", 1)),
    [v("race", race("DEU")), v("base")],
    [
      ["army_bill", [arms("army", 5), temp(1), opinion("army", 1)]],
      ["publish", [opinion("press", 1), press("alsace", 1)]],
      ["wait", [inst("chamber", 1)]],
    ],
    { cast: { war: warMin, cos }, cooldown: 6, salience: 7 },
  ),
  paper(
    "fra_y_arms_bill",
    all(peace(4), arming(null, 0, 2)),
    [v("navy_race", any(race("ITA"), race("AUH"))), v("base")],
    [
      ["navy", [arms("navy", 5), opinion("business", 1)]],
      ["army", [arms("army", 5), opinion("army", 1)]],
      ["works", [gauge("order", 1), opinion("workers", 1)]],
    ],
    {
      cast: { navy, war: warMin },
      cooldown: 6,
      tags: ["home", "tension_up"],
    },
  ),
  paper(
    "fra_y_arms_price",
    all(peace(), arming(null, 2)),
    [v("high", arming(null, 3)), v("base")],
    [
      ["income_tax", [gauge("money", 1), inst("senate", -1)]],
      ["loan", [gauge("money", 1), opinion("business", -1)]],
      ["slow_down", [arms("army", -5), inst("chamber", 1), temp(-1)]],
    ],
    { cast: { fin, pm }, cooldown: 6, tags: ["home", "tension_up"] },
  ),
];

// ---- Talks (once) ----

const TALKS: GwScene[] = [
  paper(
    "fra_y_accord_seek",
    all(
      peace(3),
      // ww190 tune: was 4; the accord is sought once the question has ripened.
      pressure("colonial", 12),
      not(world({ is: "accord", kind: "colonial", tag: "DEU" })),
      not(world({ is: "accord_offered" })),
    ),
    [v("hot", pressure("colonial", 7)), v("base")],
    [
      [
        "offer_deu",
        [doWorld({ do: "accord", kind: "colonial", tag: "DEU" }), temp(-1)],
      ],
      ["ask_london", [trust("GBR", 1), press("colonial", 1)]],
      ["stand", [opinion("press", 1), press("colonial", 1)]],
    ],
    { cast: { fm }, once: true, salience: 7 },
  ),
  paper(
    "fra_y_accord_keep",
    all(peace(), colonialInForce),
    [
      v("ours", {
        kind: "chose",
        scene: "fra_y_accord_seek",
        pick: "offer_deu",
      }),
      v("base"),
    ],
    [
      ["keep", [temp(-1), opinion("army", -1)]],
      ["guard", [opinion("parliament", 1)]],
      [
        "end_it",
        [
          doWorld({ do: "break_accord", kind: "colonial" }),
          opinion("press", 1),
        ],
      ],
    ],
    { cast: { fm }, once: true, tags: ["foreign", "tension_down"] },
  ),
];

// ---- The alliances (once) ----

const ALLIANCE: GwScene[] = [
  paper(
    "fra_y_ally_renew",
    all(peace(3), bond("RUS", 0)),
    [v("close", bond("RUS", 2)), v("base")],
    [
      ["rail_loan", [tie("RUS", 1), gauge("money", -1)]],
      ["plain_loan", [tie("RUS", 1), opinion("business", 1)]],
      ["no_loan", [tie("RUS", -1), gauge("money", 1)]],
    ],
    { cast: { fin, fm }, once: true },
  ),
  paper(
    "fra_y_ally_crack",
    all(peace(3), bond("RUS", undefined, -1)),
    [v("deep", bond("RUS", undefined, -2)), v("base")],
    [
      ["visit", [tie("RUS", 1), temp(1)]],
      ["staff", [tie("RUS", 1), opinion("army", 1)]],
      ["let_be", [tie("RUS", -1), temp(-1)]],
    ],
    { cast: { fm }, once: true, salience: 7 },
  ),
  paper(
    "fra_y_ally_staff",
    all(peace(2), any(bond("GBR", 0), pressure("naval", 4))),
    [v("navy", pressure("naval", 4)), v("base")],
    [
      ["letters", [tie("GBR", 1), trust("GBR", 1)]],
      ["fleet_south", [tie("GBR", 1), arms("navy", 3), temp(1)]],
      ["unwritten", [inst("chamber", 1)]],
    ],
    { cast: { fm, navy }, once: true },
  ),
  paper(
    "fra_y_italy",
    all(peace(6), world({ is: "neutral", tag: "ITA" })),
    [v("tight", bond("RUS", 1)), v("base")],
    [
      ["assure", [trust("ITA", 1), temp(-1)]],
      ["med_talk", [trust("ITA", 1), arms("navy", -3)]],
      ["leave", [opinion("press", 1)]],
    ],
    { cast: { fm }, once: true, tags: ["foreign", "tension_down"] },
  ),
];

// ---- Incidents (cooldown 4): two on Alsace, one colonial, one Balkan or Straits ----

const INCIDENTS: GwScene[] = [
  paper(
    "fra_y_inc_airship",
    all(peace(), pressure("alsace", 4)),
    [v("high", pressure("alsace", 7)), v("base")],
    [
      ["return", [press("alsace", -1), temp(-1)]],
      ["inquiry", [opinion("press", 1)]],
      ["protest", [press("alsace", 1), temp(1), opinion("army", 1)]],
    ],
    { cast: { home }, cooldown: 4 },
  ),
  paper(
    "fra_y_inc_border",
    // ww190 tune: incidents ripen in turn as pressure climbs.
    all(peace(), pressure("alsace", 10)),
    [v("high", pressure("alsace", 13)), v("base")],
    [
      ["ten_km", [press("alsace", -1), opinion("army", -1)]],
      ["note", [temp(1), opinion("press", 1)]],
      ["quiet", [press("alsace", 1)]],
    ],
    { cast: { war: warMin, fm }, cooldown: 4, salience: 7 },
  ),
  paper(
    "fra_y_inc_morocco",
    // ww190 tune: incidents ripen in turn as pressure climbs.
    all(peace(), pressure("colonial", 15)),
    [v("high", pressure("colonial", 18)), v("base")],
    [
      ["settle", [press("colonial", -1), gauge("money", -1)]],
      ["court", [press("colonial", -1), temp(1)]],
      ["refuse", [press("colonial", 1), opinion("press", 1)]],
    ],
    { cast: { fm }, cooldown: 4 },
  ),
  paper(
    "fra_y_inc_straits",
    // ww190 tune: incidents ripen in turn as pressure climbs.
    all(peace(), any(pressure("straits", 19), pressure("balkan", 19))),
    [
      v("straits", pressure("straits", 22)),
      v("balkan", pressure("balkan", 19)),
      v("base"),
    ],
    [
      ["back_rus", [tie("RUS", 1), temp(1)]],
      ["loan", [gauge("money", -1), press("balkan", -1)]],
      ["mediate", [temp(-1), tie("RUS", -1)]],
    ],
    { cast: { fm }, cooldown: 4 },
  ),
];

// ---- Home (cooldown 3; the long peace once) ----

const HOME: GwScene[] = [
  paper(
    "fra_y_home_strike",
    all(peace(2), any(arming(null, 1), low("order", 3))),
    [v("arms", arming(null, 2)), v("base")],
    [
      ["arbitrate", [gauge("order", 1), gauge("money", -1)]],
      ["troops", [gauge("order", 1), opinion("workers", -1)]],
      ["wait", [opinion("parliament", 1)]],
    ],
    { cast: { home, pm }, cooldown: 3, tags: ["home", "tension_down"] },
  ),
  paper(
    "fra_y_home_long_peace",
    // ww190 tune: peace_months counts from the last crisis, so 18 of them never
    // came. The home question climbs about a point a month in peace: at 12
    // the summer is a year behind (the state, not a
    // date), two quiet months on.
    all(peace(2), { kind: "pressure", topic: "home", min: 12 }),
    [v("armed", arming(null, 2)), v("base")],
    [
      ["exhibition", [gauge("morale", 1), gauge("money", -1)]],
      ["reserves", [inst("army", 1)]],
      ["reform", [inst("chamber", 1), opinion("workers", 1)]],
    ],
    { cast: { pm }, once: true, tags: ["home", "tension_down"] },
  ),
];

export const FRA_YEARS_SCENES: readonly GwScene[] = [
  ...ARMS,
  ...TALKS,
  ...ALLIANCE,
  ...INCIDENTS,
  ...HOME,
];
