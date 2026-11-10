import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * Common scenes, the 외교 share: the 35 `gw_d_` scenes any seat can meet. Data
 * only; text is in resources/ww1914/ko/common.dip.json, written with no form
 * of address. Plan: ww135-plan-common.md sections 1, 5, 9.
 *
 * Who speaks is never one of the four seats: an ally who asks is a country a
 * seat can't be yet (Ottomans, Serbia, Italy, Romania), which stands in for the
 * `human` condition the plan wanted and no lane wrote. A greyed option that a
 * key from one side alone would open also has a way in for the other side.

 */
// ---- Words ----

const everyone = [...GW_TAGS];
const but = (...out: GwTag[]) => everyone.filter((t) => !out.includes(t));
/** Plan section 0: the four seats and the countries that come after them. */
type Loose = Record<string, unknown>;

const CENTRAL: GwTag[] = ["DEU", "AUH", "OTT", "BGR"];
const ENTENTE: GwTag[] = [
  "GBR",
  "RUS",
  "FRA",
  "ITA",
  "SRB",
  "USA",
  "JPN",
  "ROU",
  "GRC",
  "BEL",
  "MNE",
  "PRT",
];

const w = (of: Loose): Loose => ({ kind: "world", of });
const all = (...of: Loose[]): Loose => ({ kind: "all", of });
const any = (...of: Loose[]): Loose => ({ kind: "any", of });
const not = (of: Loose): Loose => ({ kind: "not", of });
const flag = (f: string): Loose => ({ kind: "flag", flag: f });
const memory = (key: string): Loose => ({ kind: "memory", key });
const chose = (scene: string, pick?: string): Loose =>
  pick === undefined
    ? { kind: "chose", scene }
    : { kind: "chose", scene, pick };
const date = (from: string, to: string): Loose => w({ is: "date", from, to });
const since = (from: string): Loose => w({ is: "date", from });
const until = (to: string): Loose => w({ is: "date", to });
const war = w({ is: "war" });
const central = w({ is: "side", of: ["central"] });
const entente = w({ is: "side", of: ["entente"] });
const inWar = (tag: GwTag): Loose => w({ is: "entered", tag });
const out = (tag: GwTag): Loose => w({ is: "out", tag });
const neutral = (tag: GwTag): Loose => w({ is: "neutral", tag });
const low = (tag: GwTag, gauge: string): Loose => ({
  kind: "nation_gauge",
  tag,
  gauge,
  max: 1,
});
const fighting = (tag: GwTag): Loose => all(inWar(tag), not(out(tag)));

/** The seat's country, read off its form of government (no plainer way yet). */
const seatDEU = w({ is: "regime", of: ["empire", "republic"] });
const seatGBR = w({
  is: "regime",
  of: ["liberal", "coalition", "war_cabinet", "national"],
});
const seatAUH = w({
  is: "regime",
  of: [
    "dual_monarchy",
    "karl",
    "ff_throne",
    "federation",
    "austria_republic",
    "crown_remnant",
  ],
});
const seatRUS = w({
  is: "regime",
  of: ["tsar", "crown", "regency", "rep", "provisional", "soviet"],
});
const seatFRA = w({
  is: "regime",
  of: ["fra_republic", "fra_union", "fra_tiger", "fra_defeat"],
});
/** Scenes France's own seat writes for itself (lane ww166 W4): not for FRA. */
const noFra = (tags: GwTag[]): GwTag[] => tags.filter((t) => t !== "FRA");

const maybe = (when: Loose, then: Loose[]): Loose => ({
  kind: "maybe",
  when,
  then,
});
const trust = (tag: GwTag, delta: number): Loose => ({
  kind: "trust",
  tag,
  delta,
});
const ally = (delta: number): Loose[] => [
  maybe(
    central,
    CENTRAL.map((t) => trust(t, delta)),
  ),
  maybe(
    entente,
    (["FRA", "GBR", "RUS", "ITA"] as GwTag[]).map((t) => trust(t, delta)),
  ),
];
const gauge = (g: string, delta: number): Loose => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const authority = (delta: number): Loose => ({
  kind: "world",
  of: { do: "authority", delta },
});
const manpower = (delta: number): Loose => ({
  kind: "world",
  of: { do: "manpower", delta },
});
const talks: Loose = { kind: "world", of: { do: "talks" } };
const why = (key: string): Loose => ({ kind: "reason", key });
const set = (f: string): Loose => ({ kind: "flag", flag: f });
const keep = (person: string, key: string): Loose => ({
  kind: "keep_promise",
  who: { person },
  key,
});
const reveal = (id: string): Loose =>
  maybe({ kind: "secret", id }, [{ kind: "world", of: { do: "reveal", id } }]);
const agents = (right: boolean): Loose => ({
  kind: "source",
  source: "agents",
  right,
});
/** A report on the enemy's morale, by way of agents. */
const foeReport: Loose[] = [
  maybe(central, [
    {
      kind: "world",
      of: { do: "report", fact: "morale", tag: "FRA", source: "agents" },
    },
  ]),
  maybe(entente, [
    {
      kind: "world",
      of: { do: "report", fact: "morale", tag: "DEU", source: "agents" },
    },
  ]),
];
/** America moves toward the seat's own side: entente in, central off. */
const americaKind = (d: number): Loose[] => [
  maybe(entente, [
    { kind: "world", of: { do: "readiness", tag: "USA", delta: d } },
  ]),
  maybe(central, [
    { kind: "world", of: { do: "readiness", tag: "USA", delta: -d } },
  ]),
  trust("USA", 1),
];

const fm = { any_of: [{ office: "foreign" }, { favourite: true }] };
const cos = { any_of: [{ office: "chief_of_staff" }, { favourite: true }] };
const fin = { any_of: [{ office: "finance" }, { favourite: true }] };

const opt = (
  id: string,
  tell: string[],
  effects: Loose[],
  when?: Loose,
): Loose =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };
const v = (id: string, when?: Loose): Loose =>
  when === undefined ? { id } : { id, when };

const foreign = ["foreign"];
const foreignUp = ["foreign", "tension_up"];
const foreignDown = ["foreign", "tension_down"];

/** A paper to sign or return. */
function paper(
  id: string,
  nation: GwTag[],
  salience: number,
  tags: string[],
  when: Loose,
  cast: Loose,
  variants: Loose[],
  options: Loose[],
  repeat?: number,
): Loose {
  return {
    id,
    nation,
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when,
    cast,
    salience,
    tags,
    ...(repeat === undefined ? { once: true } : { cooldown: repeat }),
    variants,
    fallback: options[0].id,
    options,
  };
}

/** Read and put down. `stamp` and `source` only on a report. */
function reading(
  id: string,
  nation: GwTag[],
  salience: number,
  tags: string[],
  when: Loose,
  variants: Loose[],
  over: Loose = {},
): Loose {
  return {
    id,
    nation,
    kind: "report",
    when,
    cast: {},
    salience,
    tags,
    once: true,
    variants,
    ...over,
  };
}

const press = { stamp: "confirmed", source: "press" };

const RAW: Loose[] = [
  // Allies.
  paper(
    "gw_d_ally_shells",
    everyone,
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 47 } },
        {
          kind: "any",
          of: [
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "OTT" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "OTT" } },
                    },
                  ],
                },
                { kind: "nation_gauge", tag: "OTT", gauge: "shells", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "BGR" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "BGR" } },
                    },
                  ],
                },
                { kind: "nation_gauge", tag: "BGR", gauge: "shells", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "SRB" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "SRB" } },
                    },
                  ],
                },
                { kind: "nation_gauge", tag: "SRB", gauge: "shells", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "ITA" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "ITA" } },
                    },
                  ],
                },
                { kind: "nation_gauge", tag: "ITA", gauge: "shells", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "ROU" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "ROU" } },
                    },
                  ],
                },
                { kind: "nation_gauge", tag: "ROU", gauge: "shells", max: 1 },
              ],
            },
          ],
        },
      ],
    },
    { fm },
    [
      v(
        "owed",
        all(entente, {
          kind: "promise",
          who: { person: "rou_bratianu" },
          key: "p_rou_shells",
        }),
      ),
      v("romania", all(entente, fighting("ROU"), low("ROU", "shells"))),
      v("serbs", all(entente, fighting("SRB"), low("SRB", "shells"))),
      v("turks", all(central, fighting("OTT"), low("OTT", "shells"))),
      v("base"),
    ],
    [
      opt(
        "small_share",
        ["shells:-1", "ally:+1"],
        [gauge("shells", -1), ...ally(1)],
      ),
      opt(
        "big_share",
        ["shells:-2", "ally:+2"],
        [gauge("shells", -2), ...ally(2), keep("rou_bratianu", "p_rou_shells")],
        { kind: "gauge", gauge: "shells", min: 2 },
      ),
      opt("refuse", ["ally:-1"], [...ally(-1), why("d_shells_refused")]),
      opt(
        "trade_for_favour",
        ["shells:-1", "ally:+1", "authority:+5"],
        [
          gauge("shells", -1),
          ...ally(1),
          authority(5),
          set("f_d_shell_favour"),
          why("d_shells_trade"),
        ],
        any(memory("k_joffre_plan"), {
          kind: "person_trust",
          who: { role: "fm" },
          min: 2,
        }),
      ),
    ],
    6,
  ),
  paper(
    "gw_d_ally_summit",
    everyone,
    7,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 47 },
        },
      ],
    },
    { fm, cos },
    [
      v(
        "fra_chantilly",
        all(seatFRA, entente, war, date("1915-12", "1916-12")),
      ),
      v("fra", all(seatFRA, entente, war)),
      v("chantilly", all(entente, date("1915-12", "1916-12"))),
      v("versailles", all(entente, since("1917-11"))),
      v("entente", entente),
      v(
        "pless",
        all(central, since("1916-09"), fighting("BGR"), fighting("OTT")),
      ),
      v("central_late", all(central, since("1917-01"))),
      v("base"),
    ],
    [
      opt(
        "join_plan",
        ["ally:+1"],
        [...ally(1), set("f_d_joint_plan"), why("d_summit_joined")],
      ),
      opt(
        "own_plan",
        ["ally:-1", "authority:+5"],
        [...ally(-1), authority(5), why("d_summit_own")],
      ),
      opt("delay_answer", [], [why("d_summit_put_off")]),
      opt(
        "unified_plan",
        ["ally:+2", "authority:-5"],
        [...ally(2), authority(-5), set("f_d_unified_plan")],
        any(memory("k_foch_unity"), all(central, since("1916-09"))),
      ),
    ],
    10,
  ),
  {
    id: "gw_d_ally_cold",
    nation: everyone,
    kind: "wire",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 47 } },
        {
          kind: "any",
          of: [
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                {
                  kind: "any",
                  of: [
                    { kind: "trust", tag: "DEU", max: -1 },
                    { kind: "trust", tag: "AUH", max: -1 },
                    { kind: "trust", tag: "OTT", max: -1 },
                    { kind: "trust", tag: "BGR", max: -1 },
                  ],
                },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                {
                  kind: "any",
                  of: [
                    { kind: "trust", tag: "FRA", max: -1 },
                    { kind: "trust", tag: "GBR", max: -1 },
                    { kind: "trust", tag: "RUS", max: -1 },
                    { kind: "trust", tag: "ITA", max: -1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: foreignDown,
    cooldown: 14,
    variants: [
      v("shells", chose("gw_d_ally_shells", "refuse")),
      v("summit", chose("gw_d_ally_summit", "own_plan")),
      v("second"),
      v("base"),
    ],
  },
  paper(
    "gw_d_ally_fallen",
    everyone,
    7,
    foreignUp,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war_months", min: 11, max: 47 } },
        {
          kind: "any",
          of: [
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                {
                  kind: "any",
                  of: [
                    { kind: "flag", flag: "w_serbia_fallen" },
                    { kind: "world", of: { is: "out", tag: "SRB" } },
                    { kind: "world", of: { is: "out", tag: "ROU" } },
                    { kind: "world", of: { is: "out", tag: "BEL" } },
                  ],
                },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                { kind: "world", of: { is: "out", tag: "BGR" } },
              ],
            },
          ],
        },
      ],
    },
    { fm },
    [
      v("bulgaria", all(central, out("BGR"))),
      v("romania", all(entente, out("ROU"))),
      v("belgium", all(entente, out("BEL"))),
      v("base"),
    ],
    [
      opt("words", [], []),
      opt(
        "keep_paying",
        ["money:-1", "ally:+1"],
        [gauge("money", -1), ...ally(1)],
      ),
      opt(
        "promise_return",
        ["ally:+1"],
        [
          ...ally(1),
          set("f_d_return_promised"),
          keep("srb_pasic", "p_pasic_return"),
          why("d_fallen_return"),
        ],
      ),
      opt(
        "invite_to_table",
        ["ally:+1", "authority:+5"],
        [...ally(1), authority(5)],
        any(memory("k_pasic_tomorrow"), memory("k_ferdinand_bargain")),
      ),
    ],
  ),

  // War aims and peace.
  paper(
    "gw_d_aims_asked",
    everyone,
    7,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 23, max: 35 },
        },
        { kind: "world", of: { is: "neutral", tag: "USA" } },
        { kind: "not", of: { kind: "seen", scene: "gbr_f_peace_notes" } },
      ],
    },
    { fm },
    [v("house", memory("k_house_second")), v("central", central), v("base")],
    [
      opt("general_words", [], []),
      opt(
        "name_terms",
        ["america", "trust:+1", "ally:-1"],
        [...americaKind(5), ...ally(-1), why("d_aims_named")],
      ),
      opt(
        "refuse_answer",
        ["trust:-1", "authority:+5"],
        [trust("USA", -1), authority(5), why("d_aims_refused")],
      ),
      opt(
        "secret_answer",
        ["america", "trust:+1"],
        [...americaKind(5), keep("usa_house", "p_house_word")],
        memory("k_house_second"),
      ),
    ],
  ),
  paper(
    "gw_d_carve_ottoman",
    noFra(ENTENTE),
    7,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "side", of: ["entente"] } },
        { kind: "at_war", tag: "OTT" },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 23 } },
        { kind: "not", of: { kind: "seen", scene: "rus_h_straits_note" } },
      ],
    },
    { fm },
    [v("lines", since("1915-11")), v("straits", until("1915-06")), v("base")],
    [
      opt(
        "sign",
        ["ally:+1"],
        [...ally(1), set("f_d_carve_signed"), why("d_carve_signed")],
      ),
      opt("smaller_share", [], [set("f_d_carve_signed")]),
      opt(
        "refuse",
        ["ally:-1", "authority:+5"],
        [...ally(-1), authority(5), why("d_carve_refused")],
      ),
    ],
  ),
  reading(
    "gw_d_treaties_out",
    everyone,
    8,
    foreignUp,
    {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "regime", tag: "RUS", of: ["soviet"] } },
            { kind: "world", of: { is: "out", tag: "RUS" } },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 39, max: 47 } },
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "regime",
              of: ["tsar", "crown", "regency", "rep", "provisional", "soviet"],
            },
          },
        },
      ],
    },
    [
      v(
        "signed",
        any(
          chose("gw_d_carve_ottoman", "sign"),
          chose("gw_d_carve_ottoman", "smaller_share"),
        ),
      ),
      v("lines", chose("gw_d_mecca_letters", "promise_lines")),
      v("central", central),
      v("base"),
    ],
    press,
  ),
  paper(
    "gw_d_stockholm",
    noFra(everyone),
    7,
    foreignDown,
    {
      kind: "all",
      of: [
        {
          kind: "world",
          of: { is: "regime", tag: "RUS", of: ["provisional"] },
        },
        { kind: "world", of: { is: "war_months", min: 31, max: 41 } },
        { kind: "not", of: { kind: "seen", scene: "gbr_h_stockholm" } },
      ],
    },
    { fm },
    [v("russia", seatRUS), v("central", central), v("base")],
    [
      opt(
        "refuse",
        ["order:-1"],
        [gauge("order", -1), why("d_stockholm_refused")],
      ),
      opt(
        "passports",
        ["order:+1", "ally:-1"],
        [
          gauge("order", 1),
          ...ally(-1),
          keep("deu_haase", "p_haase_passport"),
          why("d_stockholm_given"),
        ],
      ),
      opt(
        "watched_passports",
        ["authority:-5"],
        [authority(-5), keep("deu_haase", "p_haase_passport")],
      ),
    ],
  ),
  paper(
    "gw_d_papal_note",
    but("DEU"),
    7,
    foreignDown,
    // The Pope's note marks three years of a war nobody is winning.
    all(
      war,
      w({ is: "war_months", min: 36, max: 41 }),
      not(w({ is: "armistice" })),
    ),
    { fm },
    [
      v("fra", all(seatFRA, not(memory("k_benedict_line")))),
      v("heard", memory("k_benedict_line")),
      v("central", central),
      v("base"),
    ],
    [
      opt("polite", [], []),
      opt("reject", ["ally:+1"], [...ally(1), why("d_papal_rejected")]),
      opt(
        "open_door",
        ["talks", "ally:-1"],
        [talks, ...ally(-1), why("d_papal_door")],
        memory("k_benedict_line"),
      ),
    ],
  ),
  paper(
    "gw_d_soviet_peace",
    but("RUS"),
    7,
    foreignDown,
    {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "regime", tag: "RUS", of: ["soviet"] } },
            { kind: "world", of: { is: "out", tag: "RUS" } },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 39, max: 47 } },
      ],
    },
    { fm },
    [v("central", central), v("entente", entente), v("base")],
    [
      opt("ignore", ["order:-1"], [gauge("order", -1)]),
      opt(
        "answer_words",
        ["order:+1", "ally:-1"],
        [gauge("order", 1), ...ally(-1), why("d_soviet_answered")],
      ),
      opt("send_observer", ["money:-1"], [gauge("money", -1), ...foeReport]),
    ],
  ),
  paper(
    "gw_d_fourteen",
    noFra(everyone),
    8,
    foreign,
    {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "flag", flag: "w_america_in" },
            { kind: "world", of: { is: "america", min: 70 } },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 41, max: 47 } },
      ],
    },
    { fm },
    [
      v("deu", seatDEU),
      v("auh", seatAUH),
      v("gbr", seatGBR),
      v("rus", seatRUS),
      v("base"),
    ],
    [
      opt("polite", [], []),
      opt(
        "accept_base",
        ["trust:+1", "ally:-1", "authority:-5"],
        [
          trust("USA", 1),
          ...ally(-1),
          authority(-5),
          set("f_d_fourteen_taken"),
          why("d_fourteen_taken"),
        ],
        memory("k_wilson_terms"),
      ),
      opt(
        "reject",
        ["trust:-1", "authority:+5"],
        [trust("USA", -1), authority(5), why("d_fourteen_rejected")],
      ),
      opt("reserve_clause", ["authority:+5"], [authority(5)]),
    ],
  ),
  paper(
    "gw_d_peace_reply",
    but("DEU"),
    7,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "flag", flag: "w_german_offer" },
        { kind: "world", of: { is: "side", of: ["entente"] } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 23, max: 29 },
        },
        { kind: "not", of: { kind: "seen", scene: "gbr_f_peace_notes" } },
      ],
    },
    { fm },
    [
      v("fra", all(seatFRA, entente)),
      v("asked", chose("gw_d_aims_asked")),
      v("ahead", w({ is: "score", min: 5 })),
      v("base"),
    ],
    [
      opt("refuse", [], []),
      opt(
        "ask_terms",
        ["ally:-1", "trust:+1"],
        [
          ...ally(-1),
          trust("USA", 1),
          keep("usa_house", "p_house_word"),
          why("d_peace_terms_asked"),
        ],
        memory("k_house_second"),
      ),
      opt("joint_answer", ["ally:+1"], [...ally(1)]),
    ],
  ),
  paper(
    "gw_d_sounding",
    everyone,
    6,
    foreignDown,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 47 },
        },
      ],
    },
    { fm },
    [
      v("fra_late", all(seatFRA, entente, date("1917-07", "1917-12"))),
      v("briand", all(entente, date("1917-07", "1917-12"))),
      v("central", central),
      v("late", since("1917-01")),
      v("base"),
    ],
    [
      opt("decline", [], []),
      opt(
        "listen",
        [],
        [...foeReport, set("f_d_listened"), why("d_sounding_heard")],
      ),
      opt(
        "send_man",
        ["talks", "ally:-1"],
        [talks, ...ally(-1), set("f_d_listened")],
        memory("k_andersen_cousins"),
      ),
      opt("tell_ally", ["ally:+1"], [...ally(1), why("d_sounding_told")]),
    ],
    12,
  ),
  reading(
    "gw_d_vienna_rumour",
    but("AUH", "FRA"),
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war_months", min: 31, max: 47 } },
        { kind: "world", of: { is: "regime", tag: "AUH", of: ["karl"] } },
        { kind: "nation_gauge", tag: "AUH", gauge: "order", max: 2 },
      ],
    },
    [v("printed", since("1918-04")), v("central", central), v("base")],
    { stamp: "unconfirmed", source: "agents" },
  ),

  // The Red Cross and the neutrals' good offices.
  paper(
    "gw_d_prisoner_swap",
    everyone,
    5,
    foreignDown,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 47 },
        },
      ],
    },
    { fm },
    [v("trains", until("1915-12")), v("swiss", until("1917-05")), v("base")],
    [
      opt(
        "accept",
        ["morale:+1"],
        [gauge("morale", 1), keep("esp_alfonso", "p_alfonso_list")],
      ),
      opt(
        "terms",
        ["morale:+1", "authority:+5"],
        [gauge("morale", 1), authority(5)],
        memory("k_ador_lists"),
      ),
      opt(
        "refuse",
        ["morale:-1"],
        [gauge("morale", -1), why("d_swap_refused")],
      ),
    ],
    10,
  ),
  paper(
    "gw_d_hospital_ship",
    everyone,
    4,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 17, max: 41 },
        },
        {
          kind: "any",
          of: [
            { kind: "at_war", tag: "GBR" },
            { kind: "at_war", tag: "DEU" },
          ],
        },
      ],
    },
    { fm },
    [v("central", central), v("base")],
    [
      opt("accept_inspect", ["trust:+1"], [trust("ESP", 1), trust("USA", 1)]),
      opt("refuse", ["trust:-1"], [trust("ESP", -1), trust("USA", -1)]),
      opt(
        "neutral_officers",
        ["trust:+1", "morale:+1"],
        [trust("ESP", 1), trust("USA", 1), gauge("morale", 1)],
        memory("k_ador_lists"),
      ),
    ],
  ),

  // Secrets.
  paper(
    "gw_d_cipher_book",
    everyone,
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 35 } },
      ],
    },
    { fm },
    [
      v("greek", { kind: "secret", id: "grc_king_letters" }),
      v("central", central),
      v("base"),
    ],
    [
      opt(
        "keep_silent",
        [],
        [reveal("grc_king_letters"), set("f_d_cipher_kept")],
      ),
      opt(
        "use_now",
        ["authority:+5"],
        [
          reveal("grc_king_letters"),
          authority(5),
          ...foeReport,
          why("d_cipher_used"),
        ],
      ),
      opt("share_ally", ["ally:+1"], [reveal("grc_king_letters"), ...ally(1)]),
    ],
  ),
  paper(
    "gw_d_double_agent",
    everyone,
    5,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 47 },
        },
      ],
    },
    { fm },
    [
      v(
        "paid",
        any(chose("gw_d_agent_offer", "buy_regular"), flag("f_d_agent_paid")),
      ),
      v("late", since("1917-01")),
      v("base"),
    ],
    [
      opt(
        "turn_him",
        ["money:-1"],
        [gauge("money", -1), agents(true), why("d_agent_turned")],
      ),
      opt("expel", [], [{ kind: "unflag", flag: "f_d_agent_paid" }]),
      opt("tell_ally", ["ally:+1"], [...ally(1)]),
    ],
    12,
  ),
  paper(
    "gw_d_agent_offer",
    everyone,
    5,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 47 } },
      ],
    },
    { fm },
    [
      v("trusted", { kind: "source_record", source: "agents", min: 2 }),
      v("burned", { kind: "source_record", source: "agents", max: -1 }),
      v("base"),
    ],
    [
      opt("decline", [], []),
      opt(
        "buy_once",
        ["money:-1"],
        [gauge("money", -1), ...foeReport, why("d_agent_bought")],
      ),
      opt(
        "buy_regular",
        ["money:-1"],
        [gauge("money", -1), ...foeReport, agents(true), set("f_d_agent_paid")],
      ),
    ],
    10,
  ),
  paper(
    "gw_d_neutral_press",
    everyone,
    4,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 35 } },
      ],
    },
    { fm, fin },
    [
      v("central_late", all(central, since("1916-07"))),
      v("central", central),
      v("base_late", since("1916-07")),
      v("base"),
    ],
    [
      opt("leave", [], []),
      opt(
        "buy_paper",
        ["money:-1", "authority:+5"],
        [gauge("money", -1), authority(5), why("d_press_bought")],
      ),
      opt("feed_facts", ["trust:+1"], [trust("ESP", 1), trust("NLD", 1)]),
    ],
    12,
  ),
  paper(
    "gw_d_blacklist",
    everyone,
    5,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 41 },
        },
        { kind: "world", of: { is: "blockade", min: 3 } },
      ],
    },
    { fm, fin },
    [
      v("usa", all(seatGBR, date("1916-07", "1917-03"), neutral("USA"))),
      v("central", central),
      v("base"),
    ],
    [
      opt("quiet_list", [], []),
      opt(
        "public_list",
        ["blockade", "trust:-1"],
        [
          maybe(entente, [{ kind: "world", of: { do: "blockade", delta: 1 } }]),
          trust("USA", -1),
          trust("NLD", -1),
          why("d_list_public"),
        ],
      ),
      opt(
        "buy_through_them",
        ["money:-1", "bread:+1"],
        [gauge("money", -1), gauge("bread", 1)],
      ),
    ],
  ),

  // Peoples and promises.
  paper(
    "gw_d_exiles",
    everyone,
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 17, max: 47 },
        },
      ],
    },
    { fm },
    [
      v("auh", seatAUH),
      v("central", central),
      v("entente", entente),
      v("base"),
    ],
    [
      opt("no_word", [], []),
      opt("money_only", ["money:-1"], [gauge("money", -1)]),
      opt(
        "recognize",
        ["trust:+1", "ally:-1"],
        [
          trust("USA", 1),
          ...ally(-1),
          set("f_d_exiles_named"),
          why("d_exiles_named"),
        ],
        memory("k_wilson_terms"),
      ),
    ],
  ),
  paper(
    "gw_d_poland_word",
    ["DEU", "AUH", "RUS", "GBR"],
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war_months", min: 27, max: 35 } },
        { kind: "world", of: { is: "front", theatre: "east", from: "warsaw" } },
        { kind: "not", of: { kind: "seen", scene: "rus_h_poland_charter" } },
      ],
    },
    { fm },
    [v("central", central), v("russia", seatRUS), v("base")],
    [
      opt("same_words", [], []),
      opt(
        "higher_word",
        ["manpower:+2", "ally:-1"],
        [
          manpower(2),
          ...ally(-1),
          { kind: "pressure", topic: "poland", delta: 1 },
          why("d_poland_raised"),
        ],
      ),
      opt("leave_it", ["trust:-1"], [trust("FRA", -1), trust("AUH", -1)]),
    ],
  ),
  reading(
    "gw_d_holy_war",
    everyone,
    5,
    foreignUp,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "entered", tag: "OTT", side: "central" } },
        { kind: "world", of: { is: "war_months", min: 5, max: 11 } },
      ],
    },
    [v("central", central), v("base")],
    press,
  ),
  paper(
    "gw_d_india_road",
    everyone,
    4,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "entered", tag: "OTT" } },
        { kind: "world", of: { is: "war_months", min: 13, max: 23 } },
        {
          kind: "any",
          of: [
            { kind: "at_war", tag: "GBR" },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["liberal", "coalition", "war_cabinet", "national"],
              },
            },
          ],
        },
      ],
    },
    { fm },
    [v("central", central), v("base")],
    [
      opt("ignore", [], []),
      opt("send_or_stop", ["money:-1"], [gauge("money", -1), ...foeReport]),
      opt(
        "pay_emir",
        ["money:-1", "order:+1"],
        [gauge("money", -1), gauge("order", 1), why("d_kabul_paid")],
      ),
    ],
  ),
  paper(
    "gw_d_mecca_letters",
    noFra(ENTENTE),
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "at_war", tag: "OTT" },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 23 },
        },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "open", theatre: "palestine" } },
            { kind: "world", of: { is: "open", theatre: "mesopotamia" } },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "gbr_f_mcmahon" } },
      ],
    },
    { fm },
    [v("russia", seatRUS), v("heard", memory("k_hussein_lines")), v("base")],
    [
      opt("vague_yes", [], []),
      opt(
        "promise_lines",
        ["ally:-1", "authority:+5"],
        [
          ...ally(-1),
          authority(5),
          set("f_d_mecca_lines"),
          why("d_mecca_lines"),
        ],
        memory("k_hussein_lines"),
      ),
      opt("refuse", ["order:-1"], [gauge("order", -1)]),
    ],
  ),
  paper(
    "gw_d_palestine_word",
    noFra(everyone),
    5,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war_months", min: 35, max: 41 } },
        {
          kind: "any",
          of: [
            { kind: "at_war", tag: "OTT" },
            { kind: "world", of: { is: "entered", tag: "OTT" } },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "gbr_f_palestine" } },
      ],
    },
    { fm },
    [
      v("lines", chose("gw_d_mecca_letters", "promise_lines")),
      v("central", central),
      v("base"),
    ],
    [
      opt("no_word", [], []),
      opt(
        "word",
        ["trust:+1", "ally:-1"],
        [trust("USA", 1), ...ally(-1), why("d_palestine_word")],
      ),
      opt("vague_word", ["trust:+1"], [trust("USA", 1)]),
    ],
  ),

  // Neutrals, envoys.
  paper(
    "gw_d_neutral_note",
    everyone,
    5,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 23 } },
      ],
    },
    { fm },
    [
      v("scandinavia", until("1915-12")),
      v("america", neutral("USA")),
      v("base"),
    ],
    [
      opt("polite", [], []),
      opt(
        "ignore",
        ["trust:-1", "authority:+5"],
        [
          trust("USA", -1),
          trust("NLD", -1),
          authority(5),
          why("d_neutrals_ignored"),
        ],
      ),
      opt(
        "concession",
        ["trust:+1", "money:-1"],
        [trust("USA", 1), trust("NLD", 1), gauge("money", -1)],
      ),
    ],
    8,
  ),
  {
    id: "gw_d_ambassador_gone",
    nation: everyone,
    kind: "wire",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, max: 5 } },
      ],
    },
    cast: {},
    salience: 5,
    tags: foreign,
    cooldown: 2,
    variants: [v("crowd"), v("own"), v("base")],
  },
  paper(
    "gw_d_new_front_ask",
    noFra(everyone),
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 41 } },
      ],
    },
    { fm, cos },
    [
      v("salonika", all(entente, since("1915-10"), until("1917-06"))),
      v("straits", all(entente, until("1915-09"))),
      v("trentino", all(central, date("1916-01", "1916-12"), inWar("ITA"))),
      v("tired", since("1916-01")),
      v("base"),
    ],
    [
      opt("decline", ["ally:-1"], [...ally(-1)]),
      opt(
        "token_force",
        ["manpower:-3", "ally:+1"],
        [manpower(-3), ...ally(1)],
      ),
      opt(
        "full_force",
        ["manpower:-6", "ally:+2"],
        [manpower(-6), ...ally(2), why("d_front_full")],
      ),
    ],
    12,
  ),
  paper(
    "gw_d_ally_money",
    everyone,
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 11, max: 47 },
        },
        {
          kind: "any",
          of: [
            { kind: "gauge", gauge: "money", max: 1 },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                { kind: "nation_gauge", tag: "OTT", gauge: "money", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                { kind: "nation_gauge", tag: "BGR", gauge: "money", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                { kind: "nation_gauge", tag: "ITA", gauge: "money", max: 1 },
              ],
            },
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["entente"] } },
                { kind: "nation_gauge", tag: "SRB", gauge: "money", max: 1 },
              ],
            },
          ],
        },
      ],
    },
    { fin, fm },
    [
      v("borrow_rus", all(seatRUS, { kind: "gauge", gauge: "money", max: 1 })),
      v("borrow_auh", all(seatAUH, { kind: "gauge", gauge: "money", max: 1 })),
      v(
        "banker_late",
        all({ kind: "gauge", gauge: "money", max: 1 }, since("1917-01")),
      ),
      v("banker_poor", { kind: "gauge", gauge: "money", max: 1 }),
      v("base"),
    ],
    [
      opt(
        "modest",
        ["money", "ally:+1"],
        [
          maybe(borrower(), [gauge("money", 1)]),
          maybe(not(borrower()), [gauge("money", -1)]),
          ...ally(1),
        ],
      ),
      opt(
        "large",
        ["money", "ally:+2"],
        [
          maybe(borrower(), [gauge("money", 2)]),
          maybe(not(borrower()), [gauge("money", -2)]),
          ...ally(2),
        ],
      ),
      opt(
        "gold_price",
        ["money:+1", "ally:-1"],
        [gauge("money", 1), ...ally(-1), why("d_money_gold")],
      ),
    ],
    12,
  ),
  paper(
    "gw_d_offer_card",
    everyone,
    6,
    foreign,
    {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 47 } },
        {
          kind: "any",
          of: [
            {
              kind: "all",
              of: [
                { kind: "world", of: { is: "side", of: ["central"] } },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "OTT" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "OTT" } },
                    },
                  ],
                },
              ],
            },
            {
              kind: "all",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "regime",
                    of: ["liberal", "coalition", "war_cabinet", "national"],
                  },
                },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "ITA" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "ITA" } },
                    },
                  ],
                },
              ],
            },
            {
              kind: "all",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "regime",
                    of: [
                      "tsar",
                      "crown",
                      "regency",
                      "rep",
                      "provisional",
                      "soviet",
                    ],
                  },
                },
                {
                  kind: "all",
                  of: [
                    { kind: "world", of: { is: "entered", tag: "JPN" } },
                    {
                      kind: "not",
                      of: { kind: "world", of: { is: "out", tag: "JPN" } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { fm },
    [
      v("again", chose("gw_d_offer_card", "accept")),
      v(
        "ott_hard",
        all(central, {
          kind: "ai",
          tag: "OTT",
          of: ["hardline", "opportunist"],
        }),
      ),
      v("ott", central),
      v("japan", seatRUS),
      v("ita_hard", {
        kind: "ai",
        tag: "ITA",
        of: ["hardline", "opportunist"],
      }),
      v("base"),
    ],
    [
      opt("decline", [], []),
      opt(
        "accept",
        ["money:-1", "manpower:+3", "ally:+1"],
        [gauge("money", -1), manpower(3), ...ally(1), why("d_offer_taken")],
      ),
      opt("counter", ["manpower:+3", "ally:-1"], [manpower(3), ...ally(-1)]),
    ],
    10,
  ),

  // Treaties between friends (lane M's flags; alone at the table, none come).
  reading(
    "gw_d_treaty_kept",
    everyone,
    5,
    foreignDown,
    flag("w_treaty_kept"),
    [v("long", since("1916-01")), v("base")],
    { stamp: "confirmed", source: "staff" },
  ),
  reading(
    "gw_d_treaty_broken",
    everyone,
    7,
    foreignUp,
    flag("w_treaty_broken"),
    [v("mine", flag("w_treaty_i_broke")), v("cold"), v("base")],
  ),
  paper(
    "gw_d_treaty_leaked",
    everyone,
    7,
    foreignUp,
    flag("w_treaty_leaked"),
    { fm },
    [v("enemy", war), v("ally", { kind: "tension", min: 3 }), v("base")],
    [
      opt("deny", ["trust:-1"], [trust("USA", -1), why("d_leak_denied")]),
      opt("admit", ["authority:-5"], [authority(-5), why("d_leak_admitted")]),
      opt("blame_ally", ["ally:-1"], [...ally(-1), why("d_leak_blamed")]),
    ],
  ),
];

/** Who takes rather than gives in `gw_d_ally_money`: the bloc's two borrowers. */
function borrower(): Loose {
  return all({ kind: "gauge", gauge: "money", max: 1 }, any(seatRUS, seatAUH));
}

/** Plain data: Content.test holds every scene to its schema. */
export const GW_DIP_SCENES = RAW as unknown as readonly GwScene[];
