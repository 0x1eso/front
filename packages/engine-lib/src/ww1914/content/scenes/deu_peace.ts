import type {
  GwOffice,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwWho,
  memory,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { paid } from "./deu_back";

/**
 * 「독일 1914년」, the run with no war in it. The war share's August to December
 * belongs to a war begun in summer; these are what a head of state has when the
 * summer passed: the home question, the fleet, Vienna's bill, the staff's next
 * memorandum, and nine people to call about them. A late spark that goes all the
 * way gets its own signature and its own ledgers, since August's scenes can't
 * follow it. Text: resources/ww1914/ko/DEU.peace.json.
 */

const WHO: GwWho = role("who");
const war: GwCond = any(
  { kind: "at_war", tag: "RUS" },
  { kind: "at_war", tag: "FRA" },
);
const peace: GwCond = not(war);
const chapter = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
const fromChapter = (min: number): GwCond => ({ kind: "chapter", min });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const holder = (o: GwOffice) => ({ office: o });
const humiliated: GwCond = {
  kind: "world",
  of: { is: "chain_end", of: ["humiliation"] },
};
const compromised: GwCond = {
  kind: "world",
  of: { is: "chain_end", of: ["compromise"] },
};
export const SUMMER_WAR = "w_summer_war";

const option = (
  id: string,
  tell: readonly string[],
  extra: {
    when?: GwCond;
    effects?: readonly GwEffect[];
  } = {},
): GwOption => ({
  id,
  ...(extra.when === undefined ? {} : { when: extra.when }),
  tell: [...tell],
  effects: [...tell.map(paid), ...(extra.effects ?? [])],
});

const decision = (
  id: string,
  over: Omit<GwScene, "id" | "nation" | "kind" | "variants" | "tags"> &
    Partial<Pick<GwScene, "kind" | "variants" | "tags">>,
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "proposal",
  stage: ["y1914"],
  tags: ["home"],
  once: true,
  variants: [{ id: "base" }],
  ...over,
});

const SCENES: readonly GwScene[] = [
  decision("deu_w_peace_summer", {
    kind: "wire",
    when: all(chapter(6, 6), peace),
    cast: { court: holder("court") },
    salience: 8,
    tags: ["home", "tension_down"],
    variants: [
      { id: "humiliation", when: humiliated },
      { id: "compromise", when: compromised },
      { id: "base" },
    ],
  }),
  decision("deu_w_peace_congress", {
    when: all(chapter(6, 6), peace),
    cast: { interior: holder("interior"), chancellor: holder("chancellor") },
    salience: 7,
    tags: ["home", "foreign"],
    variants: [{ id: "met", when: memory("k_haase_met") }, { id: "base" }],
    fallback: "let_be",
    options: [
      option("let_be", []),
      option("watch", ["reichstag:-1", "order:+1"]),
      option("greet", ["reichstag:+2", "army:-1"], {
        when: memory("k_haase_congress"),
        effects: [setFlag("f_congress_word")],
      }),
    ],
  }),
  decision("deu_w_peace_manoeuvre", {
    kind: "audience",
    when: all(chapter(7, 7), peace),
    cast: { cos: holder("chief_of_staff"), court: holder("court") },
    salience: 7,
    tags: ["war", "people"],
    fallback: "usual",
    options: [
      option("usual", []),
      option("open_doors", ["gbr:+1", "army:-1"]),
      option("heir_leads", ["army:+1", "chancellor:-1"], {
        when: memory("k_heir_manoeuvre"),
        effects: [setFlag("f_heir_manoeuvre")],
      }),
    ],
  }),
  decision("deu_w_peace_franchise", {
    when: all(chapter(7, 8), peace),
    cast: { interior: holder("interior"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [{ id: "heard", when: memory("k_beth_peace") }, { id: "base" }],
    fallback: "shelve",
    options: [
      option("shelve", ["reichstag:-1"]),
      option("small_step", ["reichstag:+1", "army:-1"]),
      option("full_word", ["reichstag:+2", "army:-2", "order:+1"], {
        when: any(memory("k_delb_franchise"), memory("k_beth_peace")),
        effects: [setFlag("f_franchise_opened")],
      }),
    ],
  }),
  decision("deu_w_peace_alsace", {
    when: all(chapter(8, 8), peace),
    cast: { interior: holder("interior"), war: holder("war") },
    salience: 6,
    tags: ["home"],
    fallback: "keep_order",
    options: [
      option("keep_order", ["reichstag:-1"]),
      option("civil_first", ["reichstag:+1", "army:-1", "order:+1"], {
        when: memory("k_delb_alsace"),
        effects: [{ kind: "pressure", topic: "alsace", delta: -2 }],
      }),
      option("garrison", ["army:+1", "reichstag:-1", "fra:-1"]),
    ],
  }),
  decision("deu_w_peace_novelle", {
    kind: "dispute",
    when: all(chapter(8, 8), peace),
    cast: {
      navy: holder("navy"),
      chancellor: holder("chancellor"),
      finance: holder("finance"),
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    fallback: "hold_law",
    options: [
      option("hold_law", ["navy:-1"]),
      option("novelle", ["money:-1", "gbr:-2", "navy:+1"], {
        effects: [{ kind: "pressure", topic: "naval", delta: 2 }],
      }),
      option("trade_tonnage", ["gbr:+2", "navy:-2", "money:+1"], {
        when: any(memory("k_lich_angola"), memory("k_kuhn_ledger")),
        effects: [
          setFlag("f_tonnage_traded"),
          { kind: "pressure", topic: "naval", delta: -3 },
        ],
      }),
    ],
  }),
  decision("deu_w_peace_trade", {
    when: all(chapter(8, 9), peace),
    cast: { foreign: holder("foreign") },
    salience: 6,
    tags: ["foreign", "tension_down"],
    fallback: "wait",
    options: [
      option("wait", []),
      option("early_talks", ["rus:+1", "army:-1"], {
        when: memory("k_pour_trade"),
      }),
      option("wall", ["rus:-2", "money:+1", "reichstag:-1"]),
    ],
  }),
  decision("deu_w_peace_memo", {
    kind: "dispute",
    when: all(chapter(9, 9), peace),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      { id: "promised", when: memory("k_moltke_memo") },
      { id: "base" },
    ],
    fallback: "file",
    options: [
      option("file", ["cos:-1"]),
      option("read_aloud", ["temp:+1", "army:+1"]),
      option("answer_it", ["temp:-1", "cos:-1", "countersign:+1"], {
        when: any(memory("k_moltke_memo"), memory("k_beth_peace")),
      }),
    ],
  }),
  decision("deu_w_peace_vienna", {
    when: all(chapter(9, 10), peace),
    cast: {
      foreign: holder("foreign"),
      ambassador: holder("ambassador_vienna"),
    },
    salience: 7,
    tags: ["foreign"],
    variants: [{ id: "humiliation", when: humiliated }, { id: "base" }],
    fallback: "words",
    options: [
      option("words", ["auh:-1"]),
      option("staff_talks", ["auh:+2", "rus:-1", "temp:+1"]),
      option("read_bill", ["auh:+1", "money:-1"], {
        when: memory("k_tsch_bill"),
      }),
    ],
  }),
  decision("deu_w_peace_papers", {
    kind: "report",
    when: all(chapter(6, 10), peace),
    cast: {},
    salience: 4,
    tags: ["foreign", "tension_down"],
    once: false,
    cooldown: 1,
    stamp: "confirmed",
    source: "press",
    variants: [
      { id: "panama" },
      { id: "caillaux" },
      { id: "ulster" },
      { id: "unions" },
    ],
  }),
  decision("deu_w_late_mobilise", {
    kind: "crisis",
    when: all(
      chapter(6, 10),
      any(
        { kind: "crisis", topic: "balkan" },
        { kind: "crisis", topic: "straits" },
        { kind: "crisis", topic: "colonial" },
      ),
      { kind: "temp", min: 6 },
      { kind: "world", of: { is: "chain", min: 4 } },
      not(flag("f_west_plan")),
      not(flag("f_east_first")),
    ),
    cast: { cos: holder("chief_of_staff"), chancellor: holder("chancellor") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      { id: "second", when: { kind: "seen", scene: "deu_c_mobilise" } },
      { id: "base" },
    ],
    fallback: "wait_day",
    options: [
      option("wait_day", ["army:-1"], {
        effects: [
          { kind: "world", of: { do: "plan", plan: "wait" } },
          reason("mob_second_held"),
        ],
      }),
      option("west_plan", ["army:+2", "temp:+3", "gbr:-1", "cos:+1"], {
        effects: [setFlag("f_west_plan")],
      }),
      option(
        "east_first",
        ["army:-2", "temp:+2", "gbr:+1", "fra:+1", "cos:-2"],
        {
          effects: [setFlag("f_east_first")],
        },
      ),
      option("last_wire", ["temp:-2", "rus:+1", "army:-1", "cos:-1"], {
        when: memory("k_nicky_trust"),
      }),
    ],
  }),
  decision("deu_w_late_ledger", {
    kind: "ledger",
    when: all(chapter(7, 10), war, not(flag(SUMMER_WAR))),
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war"],
    once: false,
    cooldown: 0,
    variants: [
      { id: "first", when: { kind: "world", of: { is: "war_age", max: 1 } } },
      { id: "base" },
    ],
    fallback: "sign_chief",
    options: [
      option("sign_chief", [], {
        effects: [{ kind: "world", of: { do: "sign_chief" } }],
      }),
      { ...option("return_chief", ["army:-1"]), screen: "fronts" },
    ],
  }),
];

interface PeaceTalk {
  id: string;
  who: string;
  from: number;
  to: number;
  temper: GwTemperament;
  key: string;
  promise: string;
  chapters: number;
  keep: GwCond;
  when?: GwCond;
}

const TALKS: readonly PeaceTalk[] = [
  {
    id: "beth",
    who: "deu_bethmann",
    from: 6,
    to: 9,
    temper: "anxious",
    key: "k_beth_peace",
    promise: "beth_peace_word",
    chapters: 3,
    keep: any(
      chose("deu_w_peace_franchise", "small_step"),
      chose("deu_w_peace_franchise", "full_word"),
      fromChapter(9),
    ),
  },
  {
    id: "moltke",
    who: "deu_moltke",
    from: 6,
    to: 8,
    temper: "anxious",
    key: "k_moltke_memo",
    promise: "moltke_memo_read",
    chapters: 3,
    keep: any(seen("deu_w_peace_memo"), fromChapter(10)),
  },
  {
    id: "lich",
    who: "deu_lichnowsky",
    from: 6,
    to: 9,
    temper: "arrogant",
    key: "k_lich_angola",
    promise: "lich_peace_read",
    chapters: 2,
    keep: any(seen("deu_w_peace_novelle"), fromChapter(9)),
  },
  {
    id: "delb",
    who: "deu_delbruck",
    from: 7,
    to: 10,
    temper: "cold",
    key: "k_delb_alsace",
    promise: "delb_grain_bill",
    chapters: 2,
    keep: fromChapter(10),
  },
  {
    id: "kuhn",
    who: "deu_kuhn",
    from: 6,
    to: 10,
    temper: "stubborn",
    key: "k_kuhn_ledger",
    promise: "kuhn_ledger_word",
    chapters: 2,
    keep: fromChapter(9),
  },
  {
    id: "haase",
    who: "deu_haase",
    from: 6,
    to: 6,
    temper: "stubborn",
    key: "k_haase_congress",
    promise: "haase_no_police",
    chapters: 1,
    keep: any(
      chose("deu_w_peace_congress", "let_be"),
      chose("deu_w_peace_congress", "greet"),
      fromChapter(8),
    ),
    when: any(memory("k_haase_met"), memory("k_delb_bridge")),
  },
  {
    id: "pour",
    who: "deu_pourtales",
    from: 7,
    to: 10,
    temper: "weary",
    key: "k_pour_trade",
    promise: "pour_numbers",
    chapters: 2,
    keep: fromChapter(10),
  },
  {
    id: "tsch",
    who: "deu_tschirschky",
    from: 8,
    to: 10,
    temper: "cold",
    key: "k_tsch_bill",
    promise: "tsch_line",
    chapters: 2,
    keep: any(chose("deu_w_peace_vienna", "read_bill"), fromChapter(11)),
  },
  {
    id: "heir",
    who: "deu_heir",
    from: 6,
    to: 7,
    temper: "arrogant",
    key: "k_heir_manoeuvre",
    promise: "heir_behave",
    chapters: 2,
    keep: fromChapter(9),
  },
];

function peaceTalk(t: PeaceTalk): GwScene {
  const end = (id: string, effects: GwEffect[] = []) => ({
    id,
    stance: "frank" as const,
    kind: "leave" as const,
    tell: [],
    effects,
    next: null,
  });
  return {
    id: `deu_t_${t.id}_peace`,
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: all(
      chapter(t.from, t.to),
      peace,
      ...(t.when === undefined ? [] : [t.when]),
    ),
    cast: { who: { person: t.who } },
    salience: 5,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: t.temper,
            when: { kind: "temperament", who: WHO, of: [t.temper] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "answer",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: WHO, delta: -1 }],
            next: "hard",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              promise(WHO, t.promise, t.chapters, { keep: t.keep }),
              { kind: "person_trust", who: WHO, delta: 1 },
            ],
            next: "answer",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      answer: {
        says: [{ id: "base" }],
        replies: [
          end("take", [remember(t.key)]),
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [remember(t.key)],
            next: "more",
          },
        ],
      },
      more: { says: [{ id: "base" }], replies: [end("end")] },
      hard: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "soft",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "answer",
          },
          end("end"),
        ],
      },
    },
  };
}

export const DEU_PEACE_SCENES: readonly GwScene[] = [
  ...SCENES,
  ...TALKS.map(peaceTalk),
];

/** Told in the months of a war begun in summer: a late war can't reach them. */
const SUMMER_ONLY: readonly string[] = [
  "deu_p_navy_command",
  "deu_p_orders",
  "deu_t_beth_aims",
  "deu_t_beth_son",
  "deu_t_delb_bread",
  "deu_t_delb_jobs",
  "deu_t_falk_chief",
  "deu_t_falk_peace",
  "deu_t_falk_ypres",
  "deu_t_haase_belgium",
  "deu_t_haase_second",
  "deu_t_heir_falk",
  "deu_t_heir_west",
  "deu_t_hind_baton",
  "deu_t_hind_falk",
  "deu_t_hind_ludendorff",
  "deu_t_hind_victory",
  "deu_t_jagow_poland",
  "deu_t_kuhn_bonds",
  "deu_t_kuhn_rathenau",
  "deu_t_lich_farewell",
  "deu_t_lud_nerves",
  "deu_t_lud_politics",
  "deu_t_moltke_after",
  "deu_t_moltke_nerves",
  "deu_t_muller_denmark",
  "deu_t_tirp_chancellor",
  "deu_t_tirp_command",
  "deu_t_tirp_sub",
  "deu_t_zimm_irish",
  "deu_t_zimm_usa",
  "deu_v_conrad_cry",
  "deu_v_conrad_winter",
];

const isSummer = (id: string) =>
  SUMMER_ONLY.includes(id) ||
  (id.startsWith("deu_w_") &&
    !id.startsWith("deu_w_peace_") &&
    !id.startsWith("deu_w_late_") &&
    id !== "deu_w_closing");

/** August's scenes wait for a war that began in summer. */
export function withSummerWar(scene: GwScene): GwScene {
  if (!isSummer(scene.id)) return scene;
  const gate = flag(SUMMER_WAR);
  return {
    ...scene,
    when: scene.when === undefined ? gate : all(scene.when, gate),
  };
}
