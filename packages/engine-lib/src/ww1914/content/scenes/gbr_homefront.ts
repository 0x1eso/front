import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
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
 * GBR's scenes: the home front (ww190 §5): women at work, prisoners both
 * ways, refugees, the wounded, the flu, and hunger by the U-boats. All by the
 * derived state (HomeFront.ts), cooldown 4. Data only; the text is in
 * resources/ww1914/ko/GBR.homefront.json.
 */

const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });
const theirs = (tag: GwTag): GwCond =>
  world({ is: "prisoners", held: "theirs", tag, min: 1 });
/** Prisoners swapped with whichever enemy holds ours. */
const exchangeWith = (...tags: GwTag[]): GwEffect[] =>
  tags.map((tag) => ({
    kind: "maybe",
    when: any(
      theirs(tag),
      world({ is: "prisoners", held: "ours", tag, min: 1 }),
    ),
    then: [doWorld({ do: "exchange", tag })],
  }));
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });

const home: GwCastRule = { office: "interior" };
const fin: GwCastRule = { office: "finance" };
const munitions: GwCastRule = {
  any_of: [{ office: "munitions" }, { office: "finance" }],
};
const war: GwCastRule = {
  any_of: [{ office: "war" }, { office: "chief_of_staff" }],
};

export const GBR_HOMEFRONT_SCENES: readonly GwScene[] = [
  // ---- Women at work ----
  {
    id: "gbr_hf_women_shells",
    nation: GBR,
    kind: "proposal",
    when: all(months(4), world({ is: "women_work", min: 1 })),
    cast: { mun: munitions },
    salience: 6,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [
      { id: "yellow", when: world({ is: "women_work", min: 2 }) },
      { id: "base" },
    ],
    fallback: "dilution",
    options: [
      pick("gbr_hf_women_shells", "equal_rates", [
        gauge("money", -1),
        opinion("workers", 1),
      ]),
      pick("gbr_hf_women_shells", "dilution", [
        gauge("shells", 1),
        opinion("workers", -1),
      ]),
      pick("gbr_hf_women_shells", "hostels", [
        gauge("money", -1),
        gauge("morale", 1),
      ]),
    ],
  },
  {
    id: "gbr_hf_women_corps",
    nation: GBR,
    kind: "dispute",
    when: all(months(12), world({ is: "women_work", min: 2 })),
    cast: { war, home },
    salience: 6,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [
      { id: "all_out", when: world({ is: "women_work", min: 3 }) },
      { id: "base" },
    ],
    fallback: "land",
    options: [
      pick("gbr_hf_women_corps", "uniform", [men(1), opinion("army", -1)]),
      pick("gbr_hf_women_corps", "land", [
        gauge("bread", 1),
        gauge("money", -1),
      ]),
      pick("gbr_hf_women_corps", "the_vote", [
        gauge("morale", 1),
        opinion("parliament", 1),
        opinion("court", -1),
      ]),
    ],
  },

  // ---- Prisoners, both ways ----
  {
    id: "gbr_hf_pow_theirs",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "prisoners", held: "theirs", min: 1 }),
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["war", "foreign"],
    cooldown: 4,
    variants: [{ id: "kut", when: theirs("OTT") }, { id: "base" }],
    fallback: "parcels",
    options: [
      pick("gbr_hf_pow_theirs", "exchange", [
        ...exchangeWith("DEU", "OTT", "AUH"),
      ]),
      pick("gbr_hf_pow_theirs", "reprisal", [
        doWorld({ do: "reprisal", tag: "DEU" }),
        opinion("press", 1),
      ]),
      pick("gbr_hf_pow_theirs", "parcels", [
        gauge("money", -1),
        gauge("morale", 1),
      ]),
    ],
  },
  {
    id: "gbr_hf_pow_ours",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "prisoners", held: "ours", min: 1 }),
    cast: { home },
    salience: 5,
    tags: ["war", "home"],
    cooldown: 4,
    variants: [
      { id: "many", when: world({ is: "prisoners", held: "ours", min: 50 }) },
      { id: "base" },
    ],
    fallback: "fields",
    options: [
      pick("gbr_hf_pow_ours", "fields", [
        gauge("bread", 1),
        opinion("workers", -1),
      ]),
      pick("gbr_hf_pow_ours", "swap", [...exchangeWith("DEU", "AUH", "OTT")]),
      pick("gbr_hf_pow_ours", "inspectors", [
        trust("USA", 1),
        gauge("money", -1),
      ]),
    ],
  },

  // ---- Refugees, the wounded ----
  {
    id: "gbr_hf_refugees",
    nation: GBR,
    kind: "proposal",
    when: all(months(1), world({ is: "refugees", min: 1 })),
    cast: { home },
    salience: 5,
    tags: ["home"],
    cooldown: 4,
    variants: [
      { id: "many", when: world({ is: "refugees", min: 2 }) },
      { id: "base" },
    ],
    fallback: "towns",
    options: [
      pick("gbr_hf_refugees", "towns", [
        gauge("money", -1),
        gauge("morale", 1),
      ]),
      pick("gbr_hf_refugees", "works", [
        gauge("shells", 1),
        opinion("workers", -1),
      ]),
      pick("gbr_hf_refugees", "onward", [
        trust("BEL", -1),
        trust("NLD", -1),
        gauge("money", 1),
      ]),
    ],
  },
  {
    id: "gbr_hf_wounded",
    nation: GBR,
    kind: "dispute",
    when: months(8),
    cast: { war, fin },
    salience: 5,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [
      { id: "heavy", when: world({ is: "manpower", max: 50 }) },
      { id: "base" },
    ],
    fallback: "pensions",
    options: [
      pick("gbr_hf_wounded", "pensions", [
        gauge("money", -1),
        gauge("morale", 1),
      ]),
      pick("gbr_hf_wounded", "comb_out", [men(1), gauge("morale", -1)]),
      pick("gbr_hf_wounded", "limbs", [gauge("money", -1), gauge("order", 1)]),
    ],
  },

  // ---- The flu, and hunger by the U-boats ----
  {
    id: "gbr_hf_flu",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "flu", min: 1 }),
    cast: { home },
    salience: 7,
    tags: ["home"],
    cooldown: 4,
    variants: [
      { id: "autumn", when: world({ is: "flu", min: 2 }) },
      { id: "base" },
    ],
    fallback: "carry_on",
    options: [
      pick("gbr_hf_flu", "close", [gauge("order", 1), gauge("shells", -1)]),
      pick("gbr_hf_flu", "carry_on", [gauge("morale", -1)]),
      pick("gbr_hf_flu", "quiet", [censor(1), opinion("press", -1)]),
    ],
  },
  {
    id: "gbr_hf_hunger",
    nation: GBR,
    kind: "dispute",
    when: world({ is: "hunger", min: 1 }),
    cast: { home, fin },
    salience: 7,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [
      { id: "queues", when: world({ is: "hunger", min: 2 }) },
      { id: "base" },
    ],
    fallback: "eat_less",
    options: [
      pick("gbr_hf_hunger", "ration", [
        gauge("bread", 1),
        opinion("business", -1),
      ]),
      pick("gbr_hf_hunger", "prices", [gauge("bread", 1), gauge("money", -1)]),
      pick("gbr_hf_hunger", "eat_less", [
        gauge("morale", -1),
        opinion("press", 1),
      ]),
    ],
  },
];
