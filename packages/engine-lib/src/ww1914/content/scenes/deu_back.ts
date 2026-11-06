import {
  GW_GAUGES,
  GW_INSTITUTIONS,
  GwGauge,
  GwInstitution,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  any,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwScene,
  GwWho,
  keepPromise,
  reason,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * Promises that come back (design §5.6). A promise made in a talk has a way to
 * be kept and a person who returns if it isn't. Each talk here is one promise:
 * called from the people screen while it is open, it is the seat making it
 * good at a shown price; after the date it is the person coming back. Promises
 * of the "I won't blame you" kind have no talk: they keep themselves by a date
 * unless a scene says otherwise. Text: resources/ww1914/ko/DEU.back.json.
 */

interface BackTalk {
  key: string;
  who: string;
  /** Tell tokens: what making it good costs, shown and paid. */
  pay: readonly string[];
}

const BACK_TALKS: readonly BackTalk[] = [
  { key: "tsch_read", who: "deu_tschirschky", pay: [] },
  { key: "tsch_annex_credit", who: "deu_tschirschky", pay: [] },
  { key: "tsch_channel", who: "deu_tschirschky", pay: ["auh:+1"] },
  { key: "tsch_home", who: "deu_tschirschky", pay: ["fm:-1"] },
  { key: "tsch_corps", who: "deu_tschirschky", pay: ["auh:+1", "cos:-1"] },
  { key: "jagow_rome_letter", who: "deu_jagow", pay: ["auh:-1", "ita:+1"] },
  { key: "jagow_london_two", who: "deu_jagow", pay: ["amb_london:-1"] },
  { key: "jagow_resign", who: "deu_jagow", pay: ["leaves"] },
  { key: "jagow_poland_first", who: "deu_jagow", pay: ["army:-1"] },
  { key: "zimm_net", who: "deu_zimmermann", pay: ["fm:-1"] },
  { key: "zimm_bernstorff", who: "deu_zimmermann", pay: ["navy:-1", "usa:+1"] },
  { key: "lich_read", who: "deu_lichnowsky", pay: [] },
  { key: "lich_answer", who: "deu_lichnowsky", pay: ["gbr:+1", "auh:-1"] },
  { key: "lich_raw", who: "deu_lichnowsky", pay: ["fm:-1"] },
  { key: "lich_circulate", who: "deu_lichnowsky", pay: ["army:-1", "cos:-1"] },
  { key: "lich_channel", who: "deu_lichnowsky", pay: ["gbr:+1", "navy:-1"] },
  { key: "pour_recheck", who: "deu_pourtales", pay: [] },
  { key: "pour_vienna_word", who: "deu_pourtales", pay: ["auh:-1", "rus:+1"] },
  { key: "pour_use", who: "deu_pourtales", pay: ["rus:+1", "army:-1"] },
  { key: "moltke_bill", who: "deu_moltke", pay: ["money:-1", "chancellor:-1"] },
  { key: "moltke_aide", who: "deu_moltke", pay: ["war:-1"] },
  { key: "moltke_name", who: "deu_moltke", pay: ["reichstag:-1"] },
  { key: "falk_work", who: "deu_falkenhayn", pay: ["cos:-1", "army:+1"] },
  { key: "falk_remembered", who: "deu_falkenhayn", pay: ["cos:-1"] },
  { key: "hind_exercise", who: "deu_hindenburg", pay: ["money:-1"] },
  { key: "hind_keep_lud", who: "deu_hindenburg", pay: ["cos:-1"] },
  {
    key: "hind_east_command",
    who: "deu_hindenburg",
    pay: ["cos:-1", "army:+1"],
  },
  { key: "lud_return", who: "deu_ludendorff", pay: ["cos:-1"] },
  { key: "lud_rail_post", who: "deu_ludendorff", pay: ["cos:-1"] },
  { key: "lud_honour", who: "deu_ludendorff", pay: ["army:+1"] },
  { key: "lud_ear", who: "deu_ludendorff", pay: ["chancellor:-1", "army:+1"] },
  { key: "tirp_budget", who: "deu_tirpitz", pay: ["money:-1", "gbr:-1"] },
  { key: "tirp_direct", who: "deu_tirpitz", pay: ["court:-1"] },
  { key: "tirp_review", who: "deu_tirpitz", pay: ["court:-1", "army:+1"] },
  { key: "tirp_uboats", who: "deu_tirpitz", pay: ["money:-1", "usa:-1"] },
  { key: "tirp_silent", who: "deu_tirpitz", pay: ["chancellor:-1"] },
  { key: "beth_stay", who: "deu_bethmann", pay: ["countersign:+1", "army:-1"] },
  { key: "delb_relief", who: "deu_delbruck", pay: ["money:-1", "order:+1"] },
];

const fromChapter = (min: number): GwCond => ({ kind: "chapter", min });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });

/** What keeps a promise by itself, the chapter it holds. */
const KEEPS: Readonly<Record<string, GwCond>> = {
  tsch_annex_credit: chose("deu_c_blank_cheque", "no_annex"),
  tsch_channel: any(
    chose("deu_c_ultimatum_text", "demand_draft"),
    chose("deu_c_serbian_reply", "halt_belgrade"),
  ),
  tsch_draft_cover: fromChapter(4),
  tsch_corps: any(
    chose("deu_w_conrad_help", "send_corps"),
    chose("deu_w_conrad_help", "joint_command"),
  ),
  jagow_text_cover: fromChapter(5),
  jagow_london_two: chose("deu_p_london_quarrel", "back_jagow"),
  jagow_poland_first: chose("deu_w_war_aims", "poland_clause"),
  jagow_russia_cover: fromChapter(5),
  zimm_no_name: any(
    chose("deu_w_revolution_policy", "back_rebels"),
    fromChapter(11),
  ),
  zimm_bernstorff: chose("deu_w_sub_note", "study"),
  zimm_speed_credit: any(
    chose("deu_c_ultimatum_text", "hurry"),
    fromChapter(5),
  ),
  zimm_hoyos_cover: fromChapter(4),
  zimm_bosporus: any(flag("f_ottoman_signed"), fromChapter(5)),
  lich_read: any(
    chose("deu_p_london_quarrel", "read_direct"),
    chose("deu_p_london_quarrel", "back_lich"),
  ),
  lich_raw: chose("deu_p_london_quarrel", "read_direct"),
  lich_no_recall: fromChapter(7),
  lich_channel: chose("deu_w_separate_peace", "via_london"),
  pour_cover: fromChapter(6),
  pour_recheck: seen("deu_c_rus_report"),
  pour_three_times: fromChapter(6),
  pour_use: chose("deu_w_separate_peace", "via_pourtales"),
  pour_attache: any(seen("deu_c_rus_report"), fromChapter(4)),
  moltke_east_blame: any(flag("f_east_first"), fromChapter(6)),
  moltke_belgium_name: any(flag("f_belgium_sent"), fromChapter(7)),
  moltke_aide: chose("deu_w_new_chief", "moltke_in_name"),
  falk_remembered: chose("deu_c_kriegsgefahr", "overrule_cos"),
  falk_work: chose("deu_c_potsdam", "quiet_prep"),
  falk_seat: fromChapter(11),
  hind_exercise: chose("deu_c_manoeuvres", "east_exercise"),
  hind_keep_lud: any(
    flag("f_east_pair"),
    chose("deu_w_prittwitz", "recall_pair"),
  ),
  hind_east_command: flag("f_east_pair"),
  lud_return: chose("deu_w_prittwitz", "recall_pair"),
  lud_honour: any(
    chose("deu_p_orders", "both"),
    chose("deu_p_orders", "the_staff"),
  ),
  tirp_budget: chose("deu_c_naval_holiday", "refuse"),
  tirp_direct: any(
    chose("deu_p_navy_command", "give_command"),
    chose("deu_p_navy_command", "share"),
  ),
  tirp_review: any(
    chose("deu_p_navy_command", "give_command"),
    chose("deu_p_navy_command", "share"),
  ),
  tirp_share: any(flag("f_goeben_straits"), fromChapter(6)),
  heir_after: fromChapter(12),
};

/** The scene a promise comes back with. */
const BACKS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(BACK_TALKS.map((b) => [b.key, `deu_b_${b.key}`])),
  k_haase_promise: "deu_v_haase_promise",
  heir_quiet: "deu_v_heir_promise",
};

const WHO: GwWho = role("who");

const TELL_TAGS: Readonly<Record<string, GwTag>> = {
  auh: "AUH",
  gbr: "GBR",
  ita: "ITA",
  rus: "RUS",
  usa: "USA",
};

const TELL_OFFICES: Readonly<Record<string, GwOffice>> = {
  amb_london: "ambassador_london",
  chancellor: "chancellor",
  cos: "chief_of_staff",
  court: "court",
  fm: "foreign",
  navy: "navy",
  war: "war",
};

/** A tell token as the effect it shows. */
function paid(token: string): GwEffect {
  if (token === "leaves") {
    return { kind: "world", of: { do: "leave", who: WHO } };
  }
  const [key, value] = token.split(":");
  const delta = Number(value);
  if (TELL_TAGS[key] !== undefined) {
    return { kind: "trust", tag: TELL_TAGS[key], delta };
  }
  if (TELL_OFFICES[key] !== undefined) {
    return {
      kind: "person_trust",
      who: { office: TELL_OFFICES[key] },
      delta,
    };
  }
  if ((GW_INSTITUTIONS as readonly string[]).includes(key)) {
    return { kind: "inst", inst: key as GwInstitution, delta };
  }
  if ((GW_GAUGES as readonly string[]).includes(key)) {
    return { kind: "gauge", gauge: key as GwGauge, delta };
  }
  throw new Error(`deu_back: no effect for ${token}`);
}

function backTalk(b: BackTalk): GwScene {
  const open: GwCond = {
    kind: "promise",
    who: WHO,
    key: b.key,
    kept: false,
    broken: false,
  };
  const broken: GwCond = {
    kind: "promise",
    who: WHO,
    key: b.key,
    broken: true,
  };
  return {
    id: `deu_b_${b.key}`,
    nation: ["DEU"],
    kind: "talk",
    when: open,
    cast: { who: { person: b.who } },
    salience: 6,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [{ id: "broken", when: broken }, { id: "base" }],
        replies: [
          {
            id: "pay",
            stance: "warm",
            kind: "deal",
            tell: [...b.pay],
            effects: [
              ...b.pay.map(paid),
              keepPromise(WHO, b.key),
              {
                kind: "maybe",
                when: broken,
                then: [
                  { kind: "person_trust", who: WHO, delta: 1 },
                  reason("promise_mended", WHO),
                ],
              },
            ],
            next: "paid",
          },
          {
            id: "hold",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wait",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      paid: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wait: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  };
}

export const DEU_BACK_SCENES: readonly GwScene[] = BACK_TALKS.map(backTalk);

const termsOf = (e: GwEffect): GwEffect => {
  if (e.kind === "maybe") return { ...e, then: e.then.map(termsOf) };
  if (e.kind === "roll") {
    return {
      ...e,
      then: e.then.map(termsOf),
      otherwise: e.otherwise?.map(termsOf),
    };
  }
  if (e.kind !== "promise") return e;
  const keep = KEEPS[e.key];
  const back = BACKS[e.key];
  return {
    ...e,
    ...(keep === undefined ? {} : { keep }),
    ...(back === undefined ? {} : { back }),
  };
};

const makesPromise = (list: readonly GwEffect[]): boolean =>
  list.some(
    (e) =>
      e.kind === "promise" ||
      (e.kind === "maybe" && makesPromise(e.then)) ||
      (e.kind === "roll" &&
        (makesPromise(e.then) || makesPromise(e.otherwise ?? []))),
  );

/** Every promise in `scene` with its terms, and a reply that makes one says so. */
export function withPromiseTerms(scene: GwScene): GwScene {
  if (scene.nodes === undefined) return scene;
  const nodes = Object.fromEntries(
    Object.entries(scene.nodes).map(([id, n]) => [
      id,
      {
        ...n,
        replies: n.replies.map((r) => {
          const effects = r.effects.map(termsOf);
          const gain = r.gain?.map(termsOf);
          const reacts = r.reacts?.map((x) => ({
            ...x,
            effects: x.effects.map(termsOf),
          }));
          const makes =
            makesPromise(effects) ||
            makesPromise(gain ?? []) ||
            (reacts ?? []).some((x) => makesPromise(x.effects));
          return {
            ...r,
            effects,
            ...(gain === undefined ? {} : { gain }),
            ...(reacts === undefined ? {} : { reacts }),
            tell:
              makes && !r.tell.includes("promise")
                ? ["promise", ...r.tell]
                : r.tell,
          };
        }),
      },
    ]),
  );
  return { ...scene, nodes };
}
