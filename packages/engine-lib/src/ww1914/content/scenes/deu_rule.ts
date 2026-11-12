// Great War 1914 (ww190 §3): Germany rules occupied land, and German land
// under foreign rule. Owned by the DEU writer lane. A governing card comes
// once for each land Germany has held three months and rules; after it the
// state calls the rest: requisition, labour, resistance, a client state,
// relief. Text in resources/ww1914/ko/DEU.rule.json.
import type { GwRulePolicy } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  not,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  act,
  bondBy,
  card,
  gauge,
  holder,
  inst,
  men,
  opinion,
  trust,
  v,
  w,
} from "./deu_years";

/** The lands Germany is likeliest to rule. */
const LANDS: readonly GwTag[] = ["BEL", "FRA", "RUS", "ROU"];

const rules = (of: GwTag): GwCond => w({ is: "rule", of });
/** Held three months and ruled: the governing card's door. */
const governs = (of: GwTag): GwCond =>
  all(w({ is: "land_taken", from: of, min: 3 }), rules(of));
/** The country is out, or its capital is held: a client may be set up. */
const clientMay = (of: GwTag, ...also: GwCond[]): GwCond =>
  any(
    w({ is: "beaten", tag: of }),
    w({ is: "land_taken", from: of, capital: true }),
    ...also,
  );

const rule = (
  of: GwTag,
  ch: {
    policy?: GwRulePolicy;
    hard?: number;
    relief?: boolean;
    client?: "poland" | "lithuania" | "flanders";
  },
): GwEffect => act({ do: "rule", of, ...ch });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
/** The same change in every land Germany rules. */
const everywhere = (ch: { hard?: number; relief?: boolean }): GwEffect[] =>
  LANDS.map((of) => maybe(rules(of), rule(of, ch)));
/** Harder or softer only where the land resists. */
const whereResists = (hard: number): GwEffect[] =>
  LANDS.map((of) => maybe(w({ is: "resist", of, min: 2 }), rule(of, { hard })));

const cos = holder("chief_of_staff");
const interior = holder("interior");
const finance = holder("finance");
const foreign = holder("foreign");
const chancellor = holder("chancellor");

const TAGS: GwScene["tags"] = ["war", "foreign"];

// ---- The governing cards, once a land ----

const GOVERN: GwScene[] = [
  card({
    id: "deu_oc_bel",
    when: governs("BEL"),
    cast: { cos, interior },
    salience: 8,
    tags: TAGS,
    once: true,
    variants: [v("out", w({ is: "beaten", tag: "BEL" })), v("base")],
    options: (p, q) => [
      p(
        "civil",
        rule("BEL", { policy: "civil", hard: 1 }),
        inst("reichstag", 1),
      ),
      p("army", rule("BEL", { policy: "army", hard: 2 }), inst("army", 1)),
      q(
        "flanders",
        clientMay("BEL"),
        rule("BEL", { policy: "client", client: "flanders" }),
        trust("NLD", -1),
      ),
    ],
  }),
  card({
    id: "deu_oc_fra",
    when: governs("FRA"),
    cast: { cos, finance },
    salience: 8,
    tags: TAGS,
    once: true,
    variants: [v("base")],
    options: (p) => [
      p("army", rule("FRA", { policy: "army", hard: 2 }), gauge("shells", 1)),
      p("civil", rule("FRA", { policy: "civil", hard: 1 })),
      p(
        "mayors",
        rule("FRA", { policy: "civil", relief: true }),
        opinion("army", -1),
      ),
    ],
  }),
  card({
    id: "deu_oc_rus",
    when: governs("RUS"),
    cast: { cos, chancellor },
    salience: 8,
    tags: TAGS,
    once: true,
    variants: [
      v(
        "poland",
        w({ is: "land_taken", from: "RUS", group: ["russian_poland"] }),
      ),
      v("base"),
    ],
    options: (p, q) => [
      p(
        "civil",
        rule("RUS", { policy: "civil", hard: 1 }),
        inst("reichstag", 1),
      ),
      p("army", rule("RUS", { policy: "army", hard: 2 }), inst("army", 1)),
      q(
        "poland",
        clientMay(
          "RUS",
          w({ is: "land_taken", from: "RUS", group: ["russian_poland"] }),
        ),
        rule("RUS", { policy: "client", client: "poland" }),
        bondBy("AUH", -1),
      ),
      q(
        "lithuania",
        clientMay(
          "RUS",
          w({ is: "land_taken", from: "RUS", group: ["baltic"] }),
        ),
        rule("RUS", { policy: "client", client: "lithuania" }),
        opinion("court", 1),
      ),
    ],
  }),
  card({
    id: "deu_oc_rou",
    when: governs("ROU"),
    cast: { cos, finance },
    salience: 7,
    tags: TAGS,
    once: true,
    variants: [v("base")],
    options: (p) => [
      p("army", rule("ROU", { policy: "army", hard: 2 }), gauge("bread", 1)),
      p("civil", rule("ROU", { policy: "civil", hard: 1 }), bondBy("AUH", 1)),
    ],
  }),
];

// ---- What the state calls next ----

const ruling = w({ is: "rule" });

const AFTER: GwScene[] = [
  card({
    id: "deu_oc_requisition",
    when: w({ is: "rule", min: 2 }),
    cast: { finance, cos },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    variants: [
      v("hungry", { kind: "gauge", gauge: "bread", max: 1 }),
      v("base"),
    ],
    options: (p) => [
      p("as_is", opinion("army", 1)),
      p("squeeze", ...everywhere({ hard: 1 }), gauge("bread", 1)),
      p("receipts", ...everywhere({ hard: -1 }), trust("USA", 1)),
    ],
  }),
  card({
    id: "deu_oc_labour",
    when: all(ruling, w({ is: "war_months", own: true, min: 18 })),
    cast: { interior, cos },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [v("base")],
    options: (p) => [
      p("volunteers", gauge("money", -1), men(1)),
      p(
        "deport",
        ...everywhere({ hard: 1 }),
        gauge("shells", 1),
        trust("USA", -1),
        trust("NLD", -1),
      ),
      p("stop", ...everywhere({ hard: -1 }), opinion("business", -1)),
    ],
  }),
  card({
    id: "deu_oc_resist",
    when: w({ is: "resist", min: 2 }),
    cast: { cos, interior },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    variants: [
      v("rising", w({ is: "resist", min: 3 })),
      v("line", w({ is: "resist", of: "BEL", min: 2 })),
      v("base"),
    ],
    options: (p) => [
      p("courts", trust("USA", -1), gauge("order", 1)),
      p("hostages", ...whereResists(1), trust("USA", -2), opinion("army", 1)),
      p("amnesty", ...whereResists(-1), opinion("army", -1)),
    ],
  }),
  card({
    id: "deu_oc_client",
    when: any(
      w({ is: "rule", client: "poland" }),
      w({ is: "rule", client: "lithuania" }),
      w({ is: "rule", client: "flanders" }),
    ),
    cast: { chancellor, cos },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [
      v("poland", w({ is: "rule", client: "poland" })),
      v("lithuania", w({ is: "rule", client: "lithuania" })),
      v("flanders", w({ is: "rule", client: "flanders" })),
      v("base"),
    ],
    options: (p) => [
      p("tight", inst("army", 1), opinion("parliament", -1)),
      p(
        "council",
        opinion("parliament", 1),
        inst("army", -1),
        gauge("order", 1),
      ),
      p("legion", men(2), bondBy("AUH", -1), trust("RUS", -1)),
    ],
  }),
  card({
    id: "deu_oc_relief",
    when: all(
      any(rules("BEL"), rules("FRA")),
      not(any(w({ is: "relief", of: "BEL" }), w({ is: "relief", of: "FRA" }))),
      w({ is: "neutral", tag: "USA" }),
    ),
    cast: { foreign, cos },
    salience: 7,
    tags: TAGS,
    once: true,
    variants: [v("base")],
    options: (p) => [
      p(
        "let_in",
        maybe(rules("BEL"), rule("BEL", { relief: true })),
        maybe(rules("FRA"), rule("FRA", { relief: true })),
        trust("USA", 1),
        opinion("army", -1),
      ),
      p("refuse", trust("USA", -2), inst("army", 1)),
      p(
        "skim",
        maybe(rules("BEL"), rule("BEL", { relief: true })),
        maybe(rules("FRA"), rule("FRA", { relief: true })),
        gauge("bread", 1),
        trust("USA", -1),
      ),
    ],
  }),
];

// ---- German land under foreign rule ----

const RULED: GwScene[] = [
  card({
    id: "deu_oc_ruled",
    when: w({ is: "ruled" }),
    cast: { interior, chancellor },
    salience: 7,
    tags: ["war", "home"],
    cooldown: 4,
    max: 3,
    variants: [
      v("rus", w({ is: "ruled", by: "RUS" })),
      v("fra", w({ is: "ruled", by: "FRA" })),
      v("base"),
    ],
    options: (p) => [
      p("help", gauge("money", -1), gauge("order", 1)),
      p("neutrals", trust("USA", 1), opinion("press", 1)),
      p("vow", gauge("morale", 1), opinion("army", 1), trust("USA", -1)),
    ],
  }),
];

export const DEU_RULE_SCENES: readonly GwScene[] = [
  ...GOVERN,
  ...AFTER,
  ...RULED,
];
