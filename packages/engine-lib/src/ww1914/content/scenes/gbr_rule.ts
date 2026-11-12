import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlaceGroup } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GBR, gauge, men, opinion, pick, trust } from "./gbr_years";

/**
 * GBR's scenes: ruling occupied land (ww190 §3). Britain rules what it takes
 * from the Ottomans in Mesopotamia and Palestine, and Germany's colonies: one
 * governing card for each, `once`, then labour and the rising by state. Data
 * only; the text is in resources/ww1914/ko/GBR.rule.json.
 */

interface Rule {
  policy?: "army" | "civil" | "client";
  hard?: number;
  relief?: boolean;
}
const rule = (of: GwTag, ch: Rule): GwEffect =>
  doWorld({ do: "rule", of, ...ch });
/** The same change for every land Britain rules. */
const ruling: readonly GwTag[] = ["OTT", "DEU"];
const everywhere = (ch: Rule): GwEffect[] =>
  ruling.map((of) => ({
    kind: "maybe",
    when: world({ is: "rule", of }),
    then: [rule(of, ch)],
  }));
const taken = (from: GwTag, group: GwPlaceGroup): GwCond =>
  world({ is: "land_taken", from, group: [group], min: 3 });
const rulesAny: GwCond = any(...ruling.map((of) => world({ is: "rule", of })));

const soldier: GwCastRule = {
  any_of: [{ office: "war" }, { office: "chief_of_staff" }],
};
const fm: GwCastRule = { office: "foreign" };

export const GBR_RULE_SCENES: readonly GwScene[] = [
  // ---- One governing card per land ----
  {
    id: "gbr_oc_mesopotamia",
    nation: GBR,
    kind: "dispute",
    when: all(taken("OTT", "mesopotamia"), world({ is: "rule", of: "OTT" })),
    cast: { soldier, fm },
    salience: 7,
    tags: ["war", "foreign"],
    once: true,
    variants: [
      {
        id: "baghdad",
        when: world({ is: "held", place: "baghdad", by: "us" }),
        assumes: { held: { baghdad: "us" } },
      },
      { id: "base" },
    ],
    fallback: "officers",
    options: [
      pick("gbr_oc_mesopotamia", "army", [
        rule("OTT", { policy: "army", hard: 2 }),
        gauge("bread", 1),
      ]),
      pick("gbr_oc_mesopotamia", "officers", [
        rule("OTT", { policy: "civil", hard: 1 }),
      ]),
      pick("gbr_oc_mesopotamia", "liberators", [
        rule("OTT", { policy: "civil", relief: true }),
        gauge("money", -1),
      ]),
    ],
  },
  {
    id: "gbr_oc_palestine",
    nation: GBR,
    kind: "dispute",
    when: all(taken("OTT", "palestine"), world({ is: "rule", of: "OTT" })),
    cast: { soldier, fm },
    salience: 7,
    tags: ["war", "foreign"],
    once: true,
    variants: [
      {
        id: "jerusalem",
        when: world({ is: "held", place: "jerusalem", by: "us" }),
        assumes: { held: { jerusalem: "us" } },
      },
      { id: "base" },
    ],
    fallback: "military",
    options: [
      pick("gbr_oc_palestine", "military", [
        rule("OTT", { policy: "army", hard: 1 }),
      ]),
      pick("gbr_oc_palestine", "on_foot", [
        rule("OTT", { policy: "civil", relief: true }),
        opinion("press", 1),
      ]),
      pick("gbr_oc_palestine", "requisition", [
        rule("OTT", { policy: "army", hard: 2 }),
        gauge("bread", 1),
        trust("USA", -1),
      ]),
    ],
  },
  {
    id: "gbr_oc_colonies",
    nation: GBR,
    kind: "proposal",
    when: all(taken("DEU", "colonies"), world({ is: "rule", of: "DEU" })),
    cast: { fm },
    salience: 6,
    tags: ["war", "foreign"],
    once: true,
    variants: [{ id: "base" }],
    fallback: "administrator",
    options: [
      pick("gbr_oc_colonies", "garrison", [
        rule("DEU", { policy: "army", hard: 1 }),
      ]),
      pick("gbr_oc_colonies", "administrator", [
        rule("DEU", { policy: "civil" }),
        gauge("money", -1),
      ]),
      pick("gbr_oc_colonies", "planters", [
        rule("DEU", { policy: "civil", hard: 2 }),
        gauge("money", 1),
      ]),
    ],
  },

  // ---- After it, by state: labour, the rising ----
  {
    id: "gbr_oc_labour",
    nation: GBR,
    kind: "proposal",
    when: all(rulesAny, world({ is: "war_months", min: 6 })),
    cast: { soldier },
    salience: 5,
    tags: ["war"],
    cooldown: 4,
    variants: [
      {
        id: "hard",
        when: any(...ruling.map((of) => world({ is: "rule", of, min: 2 }))),
      },
      { id: "base" },
    ],
    fallback: "wages",
    options: [
      pick("gbr_oc_labour", "corps", [...everywhere({ hard: 1 }), men(1)]),
      pick("gbr_oc_labour", "wages", [
        ...everywhere({ hard: -1 }),
        gauge("money", -1),
      ]),
      pick("gbr_oc_labour", "grain", [
        ...everywhere({ hard: 1 }),
        gauge("bread", 1),
      ]),
    ],
  },
  {
    id: "gbr_oc_rising",
    nation: GBR,
    kind: "crisis",
    when: world({ is: "resist", min: 2 }),
    cast: { soldier, fm },
    salience: 7,
    tags: ["war", "tension_up"],
    cooldown: 4,
    variants: [
      { id: "worst", when: world({ is: "resist", min: 3 }) },
      { id: "base" },
    ],
    fallback: "columns",
    options: [
      pick("gbr_oc_rising", "columns", [...everywhere({ hard: 1 }), men(-1)]),
      pick("gbr_oc_rising", "sheikhs", [
        ...everywhere({ hard: -1, relief: true }),
        gauge("money", -1),
      ]),
      pick("gbr_oc_rising", "promise", [
        ...everywhere({ policy: "civil", hard: -1 }),
        opinion("army", -1),
      ]),
    ],
  },
];
