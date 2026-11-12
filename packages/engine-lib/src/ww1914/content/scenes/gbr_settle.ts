import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GBR, gauge, inst, men, opinion, pick, trust } from "./gbr_years";

/**
 * GBR: a beaten country's fate (ww199). The sign card in the Prime
 * Minister's place (`gbr_settle_sign`, used before the common
 * `gw_settle_sign`), the letters of the states Britain founds (the Hejaz,
 * Bohemia), and the years after: the Rhine garrison, a protectorate's
 * resident, and the radicals against annexation. Data only; the text is in
 * resources/ww1914/ko/GBR.settle.json. See /home/eser/dev/ww199-format.md.
 *
 * Facts (checked): Asquith's Guildhall speech of 9 Nov 1914 (the sword not
 * sheathed until Belgium is restored and Prussia's military domination
 * ended); Egypt a British protectorate on 18 Dec 1914, its Sultan under a
 * High Commissioner; the subsidy in gold to the Sharif of Mecca (125,000
 * pounds a month from 1916); Hussein styled himself king of the Arab lands,
 * the Allies named him King of the Hejaz only; Masaryk's King's College
 * lecture of 19 Oct 1915, which Asquith was to open but missed through
 * illness; the Union of Democratic Control (Morel, MacDonald, Trevelyan,
 * Sep 1914), for a plebiscite before any land changes hands; the British
 * Army of the Rhine at Cologne, whose commander asked in March 1919 for food
 * for the starving Germans around his men.
 */

const fm: GwCastRule = { office: "foreign" };
const treasury: GwCastRule = { office: "finance" };
const home: GwCastRule = { office: "interior" };
const soldier: GwCastRule = {
  any_of: [{ office: "war" }, { office: "chief_of_staff" }],
};

const sign = (how: "sign" | "press" | "reserve"): GwEffect =>
  doWorld({ do: "treaty_sign", how });
const winter: GwCond = world({ is: "month", of: [11, 12, 1, 2] });

export const GBR_SETTLE_SCENES: readonly GwScene[] = [
  // ---- The treaty card: the Prime Minister signs for the Crown ----
  {
    id: "gbr_settle_sign",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "settle_open" }),
    cast: { fm, soldier },
    salience: 9,
    tags: ["foreign"],
    cooldown: 2,
    max: 6,
    noBack: true,
    variants: [
      { id: "ott", when: world({ is: "settle_open", of: "OTT" }) },
      { id: "deu", when: world({ is: "settle_open", of: "DEU" }) },
      { id: "base" },
    ],
    fallback: "sign",
    options: [
      pick("gbr_settle_sign", "sign", [sign("sign")]),
      pick("gbr_settle_sign", "press", [sign("press")]),
      pick("gbr_settle_sign", "reserve", [sign("reserve")]),
    ],
  },

  // ---- The states Britain founds write to London ----
  {
    id: "gbr_settle_hejaz",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "client_state", client: "hejaz" }),
    cast: { fm, treasury },
    salience: 7,
    tags: ["foreign"],
    cooldown: 8,
    max: 2,
    variants: [
      {
        id: "wavering",
        when: world({ is: "client_state", client: "hejaz", max: 1 }),
      },
      { id: "promise", when: { kind: "seen", scene: "gbr_f_mcmahon" } },
      { id: "base" },
    ],
    fallback: "cairo",
    options: [
      pick("gbr_settle_hejaz", "gold", [gauge("money", -1), trust("HEJ", 1)]),
      pick("gbr_settle_hejaz", "syria_no", [trust("HEJ", -1), trust("FRA", 1)]),
      pick("gbr_settle_hejaz", "cairo", [trust("HEJ", -1)]),
    ],
  },
  {
    id: "gbr_settle_prague",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "client_state", client: "bohemia" }),
    cast: { fm, treasury },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "lecture", when: world({ is: "date", from: "1915-11" }) },
      { id: "base" },
    ],
    fallback: "paris",
    options: [
      pick("gbr_settle_prague", "recognise", [
        trust("CZE", 1),
        trust("USA", 1),
      ]),
      pick("gbr_settle_prague", "loan", [gauge("money", -1), trust("CZE", 1)]),
      pick("gbr_settle_prague", "paris", [trust("FRA", 1), trust("CZE", -1)]),
    ],
  },

  // ---- The years after ----
  {
    id: "gbr_settle_rhine",
    nation: GBR,
    kind: "dispute",
    when: world({ is: "fate", fate: "occupy", tag: "DEU", min: 2 }),
    cast: { soldier, fm },
    salience: 7,
    tags: ["foreign", "war"],
    cooldown: 6,
    max: 2,
    variants: [{ id: "winter", when: winter }, { id: "base" }],
    fallback: "strict",
    options: [
      pick("gbr_settle_rhine", "feed", [
        doWorld({ do: "rule", of: "DEU", relief: true }),
        gauge("money", -1),
        trust("DEU", 1),
        trust("USA", 1),
        trust("FRA", -1),
      ]),
      pick("gbr_settle_rhine", "strict", [
        doWorld({ do: "rule", of: "DEU", hard: 1 }),
        trust("DEU", -1),
        opinion("press", 1),
      ]),
      pick("gbr_settle_rhine", "fewer", [
        men(1),
        opinion("workers", 1),
        trust("FRA", -1),
      ]),
    ],
  },
  {
    id: "gbr_settle_protectorate",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "vassal" }),
    cast: { fm, treasury },
    salience: 6,
    tags: ["foreign"],
    cooldown: 6,
    max: 3,
    variants: [
      { id: "wavering", when: world({ is: "vassal", max: 1 }) },
      { id: "base" },
    ],
    fallback: "ministers",
    options: [
      pick("gbr_settle_protectorate", "ministers", [
        gauge("money", -1),
        opinion("press", 1),
      ]),
      pick("gbr_settle_protectorate", "tribute", [
        gauge("money", 1),
        trust("USA", -1),
      ]),
      pick("gbr_settle_protectorate", "garrison", [
        men(-1),
        opinion("army", 1),
      ]),
    ],
  },
  {
    id: "gbr_settle_udc",
    nation: GBR,
    kind: "proposal",
    when: world({ is: "fate", fate: "annex", min: 1 }),
    cast: { fm, home },
    salience: 6,
    tags: ["home", "foreign"],
    once: true,
    variants: [
      { id: "america", when: world({ is: "entered", tag: "USA" }) },
      { id: "base" },
    ],
    fallback: "answer",
    options: [
      pick("gbr_settle_udc", "answer", [
        opinion("press", 1),
        opinion("workers", -1),
      ]),
      pick("gbr_settle_udc", "plebiscite", [
        trust("USA", 1),
        inst("opposition", 1),
        opinion("business", -1),
      ]),
      pick("gbr_settle_udc", "silence", [
        opinion("workers", -1),
        inst("opposition", -1),
      ]),
    ],
  },
];
