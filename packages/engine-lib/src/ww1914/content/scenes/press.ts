import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  GwCond,
  GwEffect,
  GwScene,
  inst_,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Who comes when a bloc has turned, and when rumour has outrun the papers
 * (ww142). Dealt by state: `pr_<tag>_<bloc>` while the bloc stands at
 * GW_BLOC_AGAINST or under, `pr_<tag>_rumour` from a rumour of 4. Every option
 * is a way on, none is a dead end. Text is in resources/ww1914/ko/<TAG>.press.json.
 */
const AGAINST = -3;
/** Chapters before the same people come back. */
const COME_BACK = 12;

type Opt = [id: string, tell: string[], effects: GwEffect[]];

/** The office's holder, or whoever the seat trusts most if it stands empty. */
const seat = (office: GwOffice) => ({
  any_of: [{ office }, { favourite: true as const }],
});

function scene(
  tag: GwTag,
  key: GwBloc | "rumour",
  when: GwCond,
  cast: Record<string, GwOffice>,
  fallback: string,
  options: Opt[],
): GwScene {
  return {
    id: `pr_${tag.toLowerCase()}_${key}`,
    nation: [tag],
    kind: "audience",
    when: all(world({ is: "war" }), when),
    cast: Object.fromEntries(
      Object.entries(cast).map(([role, office]) => [role, seat(office)]),
    ),
    salience: 7,
    tags: ["home", "tension_up"],
    cooldown: COME_BACK,
    variants: [{ id: "base" }],
    fallback,
    options: options.map(([id, tell, effects]) => ({ id, tell, effects })),
  };
}

const bloc = (b: GwBloc): GwCond => ({ kind: "bloc", bloc: b, max: AGAINST });
const rumour: GwCond = { kind: "rumour", min: 4 };

export const PRESS_SCENES: readonly GwScene[] = [
  scene(
    "DEU",
    "army",
    bloc("army"),
    { cos: "chief_of_staff", ch: "chancellor" },
    "go_there",
    [
      [
        "yield",
        ["army:+2", "countersign:-1"],
        [inst_("army", 2), inst_("countersign", -1)],
      ],
      [
        "go_there",
        ["army:+1", "audiences:-1"],
        [
          inst_("army", 1),
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "send_back",
        ["army:-1", "countersign:+1"],
        [inst_("army", -1), inst_("countersign", 1)],
      ],
    ],
  ),
  scene(
    "DEU",
    "court",
    bloc("court"),
    { ct: "court", ch: "chancellor" },
    "heir_talk",
    [
      [
        "hear_them",
        ["court:+1", "reichstag:-1"],
        [{ kind: "opinion", bloc: "court", delta: 2 }, inst_("reichstag", -1)],
      ],
      [
        "heir_talk",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "court", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "ignore",
        ["countersign:+1"],
        [
          inst_("countersign", 1),
          { kind: "opinion", bloc: "court", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "DEU",
    "parliament",
    bloc("parliament"),
    { ch: "chancellor", in: "interior" },
    "word_only",
    [
      [
        "open_door",
        ["reichstag:+2", "army:-1"],
        [inst_("reichstag", 2), inst_("army", -1)],
      ],
      [
        "word_only",
        ["reichstag:+1"],
        [
          inst_("reichstag", 1),
          { kind: "opinion", bloc: "parliament", delta: -1 },
        ],
      ],
      [
        "shut",
        ["reichstag:-1", "army:+1"],
        [inst_("reichstag", -1), inst_("army", 1)],
      ],
    ],
  ),
  scene(
    "DEU",
    "business",
    bloc("business"),
    { fin: "finance", ch: "chancellor" },
    "hear_ballin",
    [
      [
        "contracts",
        ["money:-1"],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "opinion", bloc: "business", delta: 2 },
        ],
      ],
      [
        "hear_ballin",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "business", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "profit_word",
        ["order:+1"],
        [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "business", delta: -1 },
          { kind: "opinion", bloc: "workers", delta: 1 },
        ],
      ],
    ],
  ),
  scene(
    "DEU",
    "workers",
    bloc("workers"),
    { in: "interior", ch: "chancellor" },
    "meet_legien",
    [
      [
        "meet_legien",
        ["reichstag:+1"],
        [
          inst_("reichstag", 1),
          { kind: "opinion", bloc: "workers", delta: 1 },
          { kind: "opinion", bloc: "court", delta: -1 },
        ],
      ],
      [
        "ration_share",
        ["order:+1", "army:-1"],
        [
          { kind: "gauge", gauge: "order", delta: 1 },
          inst_("army", -1),
          { kind: "opinion", bloc: "workers", delta: 2 },
        ],
      ],
      [
        "front",
        ["army:+1", "order:-1"],
        [
          inst_("army", 1),
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "opinion", bloc: "workers", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "DEU",
    "press",
    bloc("press"),
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "briefing",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "press", delta: 2 },
          { kind: "rumour", delta: -1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "loosen",
        ["army:-1"],
        [
          { kind: "censor", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 2 },
          inst_("army", -1),
        ],
      ],
      ["leave", [], [{ kind: "opinion", bloc: "press", delta: -1 }]],
    ],
  ),
  scene(
    "DEU",
    "rumour",
    rumour,
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "publish",
        ["morale:-1"],
        [
          { kind: "rumour", delta: -3 },
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 1 },
        ],
      ],
      [
        "hunt",
        ["order:-1"],
        [
          { kind: "rumour", delta: -1 },
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "opinion", bloc: "press", delta: -1 },
        ],
      ],
      ["leave", [], [{ kind: "opinion", bloc: "workers", delta: -1 }]],
    ],
  ),
  scene(
    "GBR",
    "army",
    bloc("army"),
    { cos: "chief_of_staff", fin: "finance" },
    "go_france",
    [
      [
        "back_them",
        ["army:+2", "cabinet:-1"],
        [inst_("army", 2), inst_("cabinet", -1)],
      ],
      [
        "go_france",
        ["audiences:-1"],
        [
          inst_("army", 1),
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "rebuke",
        ["army:-1", "cabinet:+1"],
        [inst_("army", -1), inst_("cabinet", 1)],
      ],
    ],
  ),
  scene(
    "GBR",
    "court",
    bloc("court"),
    { ct: "court", fm: "foreign" },
    "audience",
    [
      [
        "audience",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "court", delta: 2 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      ["memo", [], [{ kind: "opinion", bloc: "court", delta: 1 }]],
      [
        "stiff",
        ["commons:+1"],
        [inst_("commons", 1), { kind: "opinion", bloc: "court", delta: -1 }],
      ],
    ],
  ),
  scene(
    "GBR",
    "parliament",
    bloc("parliament"),
    { fin: "finance", fm: "foreign" },
    "speech",
    [
      [
        "secret_session",
        ["commons:+2", "army:-1"],
        [inst_("commons", 2), inst_("army", -1)],
      ],
      [
        "whips",
        ["cabinet:+1"],
        [
          inst_("cabinet", 1),
          { kind: "opinion", bloc: "parliament", delta: -1 },
        ],
      ],
      [
        "speech",
        ["commons:+1", "audiences:-1"],
        [
          inst_("commons", 1),
          { kind: "opinion", bloc: "parliament", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "GBR",
    "business",
    bloc("business"),
    { fin: "finance", fm: "foreign" },
    "hear_city",
    [
      [
        "pay_city",
        ["money:-1"],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "opinion", bloc: "business", delta: 2 },
        ],
      ],
      [
        "hear_city",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "business", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "profits",
        ["order:+1"],
        [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "business", delta: -1 },
          { kind: "opinion", bloc: "workers", delta: 1 },
        ],
      ],
    ],
  ),
  scene(
    "GBR",
    "workers",
    bloc("workers"),
    { fin: "finance", in: "interior" },
    "go_clyde",
    [
      [
        "settle",
        ["money:-1", "order:+1"],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: 2 },
        ],
      ],
      [
        "go_clyde",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "workers", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "dora",
        ["order:-1", "army:+1"],
        [
          { kind: "gauge", gauge: "order", delta: -1 },
          inst_("army", 1),
          { kind: "opinion", bloc: "workers", delta: -2 },
        ],
      ],
    ],
  ),
  scene(
    "GBR",
    "press",
    bloc("press"),
    { in: "interior", fm: "foreign" },
    "editors",
    [
      [
        "editors",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "press", delta: 2 },
          { kind: "rumour", delta: -1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "loosen",
        ["opposition:+1"],
        [
          { kind: "censor", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 2 },
          inst_("opposition", 1),
        ],
      ],
      [
        "ignore",
        ["cabinet:+1"],
        [inst_("cabinet", 1), { kind: "opinion", bloc: "press", delta: -2 }],
      ],
    ],
  ),
  scene("GBR", "rumour", rumour, { in: "interior", fm: "foreign" }, "leave", [
    [
      "answer",
      ["morale:-1"],
      [
        { kind: "rumour", delta: -3 },
        { kind: "gauge", gauge: "morale", delta: -1 },
        { kind: "opinion", bloc: "press", delta: 1 },
      ],
    ],
    [
      "libel",
      ["audiences:-1"],
      [
        { kind: "rumour", delta: -1 },
        { kind: "opinion", bloc: "court", delta: 1 },
        { kind: "audiences", delta: -1 },
      ],
    ],
    ["leave", [], [{ kind: "opinion", bloc: "parliament", delta: -1 }]],
  ]),
  scene(
    "AUH",
    "army",
    bloc("army"),
    { cos: "chief_of_staff", w: "war" },
    "visit",
    [
      [
        "give_rear",
        ["army:+2", "nations:-1"],
        [inst_("army", 2), inst_("nations", -1)],
      ],
      [
        "visit",
        ["audiences:-1"],
        [
          inst_("army", 1),
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "file",
        ["army:-1", "council:+1"],
        [inst_("army", -1), inst_("council", 1)],
      ],
    ],
  ),
  scene(
    "AUH",
    "court",
    bloc("court"),
    { ct: "court", fm: "foreign" },
    "council",
    [
      [
        "family",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "court", delta: 2 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "council",
        ["council:+1"],
        [inst_("council", 1), { kind: "opinion", bloc: "court", delta: 1 }],
      ],
      [
        "close_door",
        ["nations:+1"],
        [inst_("nations", 1), { kind: "opinion", bloc: "court", delta: -1 }],
      ],
    ],
  ),
  scene(
    "AUH",
    "parliament",
    bloc("parliament"),
    { hun: "hun_pm", ch: "chancellor" },
    "neither",
    [
      [
        "budapest",
        ["hungary:+2", "nations:-1"],
        [inst_("hungary", 2), inst_("nations", -1)],
      ],
      [
        "prague",
        ["nations:+2", "hungary:-1"],
        [inst_("nations", 2), inst_("hungary", -1)],
      ],
      [
        "neither",
        ["council:+1"],
        [
          inst_("council", 1),
          { kind: "opinion", bloc: "parliament", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "AUH",
    "business",
    bloc("business"),
    { fin: "finance", ch: "chancellor" },
    "wait",
    [
      [
        "berlin_money",
        ["berlin:+1"],
        [inst_("berlin", 1), { kind: "opinion", bloc: "business", delta: 2 }],
      ],
      [
        "print",
        ["money:+1", "order:-1"],
        [
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "opinion", bloc: "business", delta: 1 },
        ],
      ],
      [
        "wait",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "business", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "AUH",
    "workers",
    bloc("workers"),
    { ch: "chancellor", w: "war" },
    "flour",
    [
      [
        "lift_military",
        ["order:+1", "army:-1"],
        [
          { kind: "gauge", gauge: "order", delta: 1 },
          inst_("army", -1),
          { kind: "opinion", bloc: "workers", delta: 2 },
        ],
      ],
      [
        "flour",
        ["bread:-1", "order:+1"],
        [
          { kind: "gauge", gauge: "bread", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: 1 },
        ],
      ],
      [
        "hold",
        ["army:+1", "order:-1"],
        [
          inst_("army", 1),
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "opinion", bloc: "workers", delta: -1 },
        ],
      ],
    ],
  ),
  scene(
    "AUH",
    "press",
    bloc("press"),
    { ch: "chancellor", fm: "foreign" },
    "leave",
    [
      [
        "editors",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "press", delta: 2 },
          { kind: "rumour", delta: -1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "loosen",
        ["army:-1"],
        [
          { kind: "censor", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 2 },
          inst_("army", -1),
        ],
      ],
      ["leave", [], [{ kind: "opinion", bloc: "press", delta: -1 }]],
    ],
  ),
  scene("AUH", "rumour", rumour, { ch: "chancellor", fm: "foreign" }, "leave", [
    [
      "appear",
      ["audiences:-1"],
      [
        { kind: "rumour", delta: -3 },
        { kind: "opinion", bloc: "court", delta: 1 },
        { kind: "audiences", delta: -1 },
      ],
    ],
    [
      "police",
      ["nations:-1"],
      [
        { kind: "rumour", delta: -1 },
        inst_("nations", -1),
        { kind: "opinion", bloc: "press", delta: -1 },
      ],
    ],
    ["leave", [], [{ kind: "opinion", bloc: "workers", delta: -1 }]],
  ]),
  scene(
    "RUS",
    "army",
    bloc("army"),
    { cos: "chief_of_staff", w: "war" },
    "go_stavka",
    [
      [
        "go_stavka",
        ["stavka:+2", "court:-1"],
        [inst_("stavka", 2), inst_("court", -1)],
      ],
      [
        "shells",
        ["shells:-1", "stavka:+1"],
        [
          { kind: "gauge", gauge: "shells", delta: -1 },
          inst_("stavka", 1),
          { kind: "opinion", bloc: "army", delta: 1 },
        ],
      ],
      [
        "rebuke",
        ["stavka:-1", "court:+1"],
        [inst_("stavka", -1), inst_("court", 1)],
      ],
    ],
  ),
  scene(
    "RUS",
    "court",
    bloc("court"),
    { ct: "court", ch: "chancellor" },
    "family_talk",
    [
      [
        "with_her",
        ["court:+2", "duma:-1"],
        [inst_("court", 2), inst_("duma", -1)],
      ],
      [
        "family_talk",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "court", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "alone",
        ["ministers:+1"],
        [inst_("ministers", 1), { kind: "opinion", bloc: "court", delta: -1 }],
      ],
    ],
  ),
  scene(
    "RUS",
    "parliament",
    bloc("parliament"),
    { ch: "chancellor", ag: "agriculture" },
    "hear_him",
    [
      [
        "take_hand",
        ["duma:+2", "court:-2"],
        [inst_("duma", 2), inst_("court", -2)],
      ],
      [
        "hear_him",
        ["duma:+1"],
        [inst_("duma", 1), { kind: "opinion", bloc: "parliament", delta: -1 }],
      ],
      ["no", ["court:+1", "duma:-2"], [inst_("court", 1), inst_("duma", -2)]],
    ],
  ),
  scene(
    "RUS",
    "business",
    bloc("business"),
    { fin: "finance", w: "war" },
    "pay",
    [
      [
        "pay",
        ["money:-1"],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "opinion", bloc: "business", delta: 2 },
        ],
      ],
      [
        "give_rail",
        ["stavka:-1"],
        [inst_("stavka", -1), { kind: "opinion", bloc: "business", delta: 2 }],
      ],
      [
        "police",
        ["court:+1"],
        [inst_("court", 1), { kind: "opinion", bloc: "business", delta: -2 }],
      ],
    ],
  ),
  scene(
    "RUS",
    "workers",
    bloc("workers"),
    { in: "interior", ch: "chancellor" },
    "bread_trains",
    [
      [
        "bread_trains",
        ["bread:-1", "order:+1"],
        [
          { kind: "gauge", gauge: "bread", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: 2 },
        ],
      ],
      [
        "wages",
        ["money:-1", "order:+1"],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: 1 },
        ],
      ],
      [
        "arrest",
        ["order:-1", "court:+1"],
        [
          { kind: "gauge", gauge: "order", delta: -1 },
          inst_("court", 1),
          { kind: "opinion", bloc: "workers", delta: -2 },
        ],
      ],
    ],
  ),
  scene(
    "RUS",
    "press",
    bloc("press"),
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "editors",
        ["audiences:-1"],
        [
          { kind: "opinion", bloc: "press", delta: 2 },
          { kind: "rumour", delta: -1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "loosen",
        ["stavka:-1"],
        [
          { kind: "censor", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 2 },
          inst_("stavka", -1),
        ],
      ],
      [
        "leave",
        ["court:+1"],
        [inst_("court", 1), { kind: "opinion", bloc: "press", delta: -1 }],
      ],
    ],
  ),
  scene(
    "RUS",
    "rumour",
    rumour,
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "show",
        ["audiences:-1", "court:-1"],
        [
          { kind: "rumour", delta: -3 },
          inst_("court", -1),
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "hunt",
        ["order:-1"],
        [
          { kind: "rumour", delta: -1 },
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "opinion", bloc: "press", delta: -1 },
        ],
      ],
      ["leave", [], [{ kind: "opinion", bloc: "parliament", delta: -1 }]],
    ],
  ),
  // ---- France (ww166, lane W5). No `tell`: what came of it shows after. ----
  scene(
    "FRA",
    "army",
    bloc("army"),
    { cos: "chief_of_staff", w: "war" },
    "go_chantilly",
    [
      [
        "go_chantilly",
        [],
        [
          inst_("army", 1),
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      ["back_gqg", [], [inst_("army", 2), inst_("chamber", -1)]],
      ["minister_speaks", [], [inst_("army", -1), inst_("chamber", 1)]],
    ],
  ),
  scene(
    "FRA",
    "court",
    bloc("court"),
    { in: "interior", ch: "chancellor" },
    "see_barres",
    [
      [
        "see_barres",
        [],
        [
          { kind: "opinion", bloc: "court", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "cardinal_mass",
        [],
        [
          { kind: "opinion", bloc: "court", delta: 2 },
          { kind: "opinion", bloc: "workers", delta: -1 },
        ],
      ],
      [
        "republic_first",
        [],
        [inst_("chamber", 1), { kind: "opinion", bloc: "court", delta: -1 }],
      ],
    ],
  ),
  scene(
    "FRA",
    "parliament",
    bloc("parliament"),
    { ch: "chancellor", in: "interior" },
    "hear_leaders",
    [
      [
        "hear_leaders",
        [],
        [
          inst_("chamber", 1),
          { kind: "opinion", bloc: "parliament", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      ["message", [], [inst_("chamber", 2), inst_("countersign", -1)]],
      ["behind_pm", [], [inst_("countersign", 1), inst_("chamber", -1)]],
    ],
  ),
  scene(
    "FRA",
    "business",
    bloc("business"),
    { fin: "finance", w: "war" },
    "contracts",
    [
      [
        "contracts",
        [],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "opinion", bloc: "business", delta: 2 },
        ],
      ],
      [
        "hear_forges",
        [],
        [
          { kind: "opinion", bloc: "business", delta: 1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "profits_word",
        [],
        [
          { kind: "opinion", bloc: "business", delta: -1 },
          { kind: "opinion", bloc: "workers", delta: 1 },
          { kind: "gauge", gauge: "order", delta: 1 },
        ],
      ],
    ],
  ),
  scene(
    "FRA",
    "workers",
    bloc("workers"),
    { in: "interior", ch: "chancellor" },
    "meet_cgt",
    [
      [
        "meet_cgt",
        [],
        [
          inst_("chamber", 1),
          { kind: "opinion", bloc: "workers", delta: 1 },
          { kind: "opinion", bloc: "court", delta: -1 },
        ],
      ],
      [
        "wages",
        [],
        [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: 2 },
        ],
      ],
      [
        "prefects",
        [],
        [
          { kind: "gauge", gauge: "order", delta: -1 },
          inst_("army", 1),
          { kind: "opinion", bloc: "workers", delta: -2 },
        ],
      ],
    ],
  ),
  scene(
    "FRA",
    "press",
    bloc("press"),
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "editors",
        [],
        [
          { kind: "opinion", bloc: "press", delta: 2 },
          { kind: "rumour", delta: -1 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "loosen",
        [],
        [
          { kind: "censor", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 2 },
          inst_("army", -1),
        ],
      ],
      [
        "leave",
        [],
        [inst_("army", 1), { kind: "opinion", bloc: "press", delta: -1 }],
      ],
    ],
  ),
  scene(
    "FRA",
    "rumour",
    rumour,
    { in: "interior", ch: "chancellor" },
    "leave",
    [
      [
        "communique",
        [],
        [
          { kind: "rumour", delta: -3 },
          inst_("army", -1),
          { kind: "audiences", delta: -1 },
        ],
      ],
      [
        "go_see",
        [],
        [
          { kind: "rumour", delta: -2 },
          { kind: "audiences", delta: -1 },
        ],
      ],
      ["leave", [], [{ kind: "opinion", bloc: "parliament", delta: -1 }]],
    ],
  ),
];
