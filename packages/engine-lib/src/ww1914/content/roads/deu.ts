// ww220 W1: Germany's papers on the roads history did not take (design
// /home/eser/dev/ww220-design.md §5 R1-R4; shapes /home/eser/dev/ww220-format.md).
// The Kaiser walks them as the man would: the Foreign Office's envoy courses
// toward London, Petersburg and Paris, audiences with Lichnowsky and
// Pourtalès, the treaty papers under the Chancellor's countersignature (a
// pledge asked of Britain may carry Belgium: `spare`), the parties' answers
// and a diary line in the margin for the feeler, the signature and the fall.
//
// Text: DEU.depts.json (depts.answers.deu_ans_road_*), DEU.powers.json
// (powers.deu_pw_pledge_gbr|pledge_east|alliance, cards, reasons),
// DEU.years.json (the two audiences), DEU.persona.json (deu_di_road_*).
//
// Facts used, as flavour: the Haldane mission (Feb 1912) and Ballin's part
// in it; the Björkö treaty the Kaiser and the Tsar signed in July 1905 and
// the "Willy-Nicky" letters; the Reinsurance Treaty (1887-90); the Durnovo
// memorandum (Feb 1914); Caillaux and the Agadir bargain (1911).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAnswerRow,
  GwCourseRow,
  GwDeptContent,
  GwFindingRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import type {
  GwDiaryRow,
  GwPersonaContent,
} from "@openfront/engine-api/ww1914/GwPersona";
import {
  all,
  any,
  flag,
  type GwCond,
  type GwEffect,
  type GwNode,
  type GwReply,
  type GwReplyKind,
  type GwScene,
  type GwStance,
  not,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  doWorld,
  type GwWorldEffect,
  world,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";

const NATION: ["DEU"] = ["DEU"];

// ---- small words ----

const war = world({ is: "war" });
const peace = not(war);
const empire: GwCond = world({ is: "regime", of: ["empire"] });
const road = (tag: GwTag, min?: number, max?: number, of?: GwTag): GwCond =>
  world({
    is: "road",
    tag,
    ...(of === undefined ? {} : { of }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });
const bond = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });
const act = (of: GwWorldEffect): GwEffect => ({ kind: "world", of });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const heat = (id: string, delta: number): GwEffect =>
  doWorld({ do: "faction", id, delta });
const person = (id: string, delta: number): GwEffect => ({
  kind: "person_trust",
  who: { person: id },
  delta,
});
const reason = (key: string): GwEffect => ({ kind: "reason", key });
/** The Foreign Office has a draft for `tag` on the table. */
const draftFlag = (tag: GwTag) => `f_deu_road_draft_${tag.toLowerCase()}`;

// ---- 외교: the Foreign Office's courses ----

const fd = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
const co = (
  id: string,
  lean: GwCourseRow["lean"],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });

/** The road's reading, as findings, and the three steps on it. */
function roadRow(
  tag: "GBR" | "RUS" | "FRA",
  findings: GwFindingRow[],
  envoyFx: GwEffect[],
): GwAnswerRow {
  return {
    id: `deu_ans_road_${tag.toLowerCase()}`,
    nation: NATION,
    type: "envoy",
    topic: [tag],
    question: "reach",
    when: all(peace, road(tag)),
    findings: [
      fd("cold", 3, { when: road(tag, 0, 0) }),
      fd("thaw", 3, { when: road(tag, 1, 1) }),
      fd("understanding", 3, { when: road(tag, 2, 2) }),
      fd("pledge", 3, { when: road(tag, 3, 3) }),
      fd("alliance", 3, { when: road(tag, 4) }),
      ...findings,
    ],
    courses: [
      co("open_line", ["gentle", "calm"], [bond(tag, 1), trust(tag, 1)], {
        when: road(tag, 0, 1),
      }),
      co(
        "secret_envoy",
        ["bold"],
        [bond(tag, 1), remember(`m_deu_road_envoy_${tag.toLowerCase()}`)],
        { when: road(tag, 1, 3), needs: [{ kind: "person" }] },
      ),
      co("draft", ["firm", "calm"], [setFlag(draftFlag(tag)), ...envoyFx], {
        when: all(road(tag, 2), not(flag(draftFlag(tag)))),
      }),
      co("leave_it", ["wait", "cheap"], [], { wait: true }),
    ],
  };
}

const DEPTS: GwDeptContent = {
  answers: [
    roadRow(
      "GBR",
      [
        fd("tirpitz_against", 2, { when: road("GBR", 1) }),
        // A weak head reads London as won: hindsight when the road falls.
        fd("london_won", 1, {
          wrong: true,
          when: road("GBR", 2),
          truth: road("GBR", 2),
        }),
      ],
      [remember("m_deu_road_draft_gbr")],
    ),
    roadRow(
      "RUS",
      [
        fd("court_party", 2, { when: road("RUS", 1) }),
        fd("duma_against", 2, { when: road("RUS", 2) }),
        // Vienna walking its own road to Petersburg.
        fd("vienna_road", 3, { when: road("RUS", 2, undefined, "AUH") }),
      ],
      [remember("m_deu_road_draft_rus"), trust("AUH", -1)],
    ),
    roadRow(
      "FRA",
      [fd("caillaux", 2, { when: road("FRA", 1) }), fd("alsace", 2)],
      [remember("m_deu_road_draft_fra")],
    ),
  ],
};

// ---- 동맹과 조약: the treaty papers ----

/** A partner the Kaiser can offer a road's step to, at `min` or better. */
const partner = (
  tag: "GBR" | "RUS" | "FRA",
  min: number,
  effects: GwEffect[],
  inWar = false,
) => ({
  id: tag,
  when: inWar
    ? any(
        all(peace, road(tag, min), flag(draftFlag(tag))),
        all(war, world({ is: "switch_can", tag })),
      )
    : all(road(tag, min), flag(draftFlag(tag))),
  effects,
});

export const DEU_ROAD_POWERS: readonly GwPowerRow[] = [
  {
    // R1: Britain's neutrality asked, Belgium spared or not.
    id: "deu_pw_pledge_gbr",
    tag: "DEU",
    group: "treaty",
    kind: "lawful",
    shows: empire,
    opens: [
      { when: peace, why: "at_war" },
      { when: road("GBR", 2), why: "no_road" },
      { when: flag(draftFlag("GBR")), why: "no_draft" },
    ],
    needs: { office: "chancellor" },
    authority: 10,
    cooldown: 6,
    fields: [
      {
        id: "belgium",
        options: [
          {
            id: "spare",
            effects: [
              act({
                do: "realign_offer",
                tag: "GBR",
                step: "pledge",
                ask: true,
                spare: true,
              }),
              reason("deu_pw_pledge_gbr_spare"),
            ],
          },
          {
            id: "keep",
            effects: [
              act({
                do: "realign_offer",
                tag: "GBR",
                step: "pledge",
                ask: true,
              }),
              reason("deu_pw_pledge_gbr_keep"),
            ],
          },
        ],
      },
    ],
    tags: ["realign"],
    effects: [remember("m_deu_road_pledge")],
    // Moltke hears that the west plan may not go through Belgium.
    risk: {
      pct: 20,
      then: [person("deu_moltke", -1), reason("deu_pw_pledge_gbr_staff")],
    },
    scene: "deu_pw_pledge_gbr_r",
  },
  {
    // R3, R4: Russia's or France's neutrality asked.
    id: "deu_pw_pledge_east",
    tag: "DEU",
    group: "treaty",
    kind: "lawful",
    shows: empire,
    opens: [{ when: peace, why: "at_war" }],
    needs: { office: "chancellor" },
    authority: 10,
    cooldown: 6,
    target: {
      kind: "country",
      of: [
        partner("RUS", 2, [
          act({ do: "realign_offer", tag: "RUS", step: "pledge", ask: true }),
        ]),
        partner("FRA", 2, [
          act({ do: "realign_offer", tag: "FRA", step: "pledge", ask: true }),
        ]),
      ],
    },
    tags: ["realign"],
    effects: [remember("m_deu_road_pledge")],
    scene: "deu_pw_pledge_east_r",
  },
  {
    // R2, R3: an alliance across the camps; in the war only with a foe that
    // may change sides (Alignment.canSwitch).
    id: "deu_pw_alliance",
    tag: "DEU",
    group: "treaty",
    kind: "lawful",
    shows: empire,
    needs: { office: "chancellor" },
    authority: 20,
    cooldown: 8,
    target: {
      kind: "country",
      of: [
        partner(
          "GBR",
          3,
          [act({ do: "realign_offer", tag: "GBR", step: "alliance" })],
          true,
        ),
        partner(
          "RUS",
          3,
          [act({ do: "realign_offer", tag: "RUS", step: "alliance" })],
          true,
        ),
        partner(
          "FRA",
          3,
          [act({ do: "realign_offer", tag: "FRA", step: "alliance" })],
          true,
        ),
      ],
    },
    tags: ["realign"],
    effects: [remember("m_deu_road_alliance")],
    // Vienna reads it as Berlin leaving it alone.
    risk: {
      pct: 30,
      then: [trust("AUH", -1), reason("deu_pw_alliance_vienna")],
    },
    scene: "deu_pw_alliance_r",
  },
];

/** The parties' answers (on top of GW_REACTORS `realign`). */
export const DEU_ROAD_REACTORS: readonly GwReactorRow[] = [
  {
    // The navalists: a deal with London is the fleet given away.
    tag: "realign",
    nation: "DEU",
    actor: "other",
    powers: ["deu_pw_pledge_gbr", "deu_pw_alliance"],
    delta: -1,
    key: "deu_react_realign_navy",
    does: [heat("deu_natlib", 1), person("deu_tirpitz", -1)],
  },
  {
    // The SPD: anything that keeps the war away.
    tag: "realign",
    nation: "DEU",
    actor: "other",
    delta: 1,
    key: "deu_react_realign_spd",
    does: [heat("deu_spd", -1)],
  },
  {
    // The Conservatives: the old friendship with the Tsar.
    tag: "realign",
    nation: "DEU",
    actor: "other",
    powers: ["deu_pw_pledge_east"],
    delta: 1,
    key: "deu_react_realign_cons",
    does: [heat("deu_cons", -1)],
  },
];

// ---- audiences: Lichnowsky on London, Pourtalès on Petersburg ----

const who = role("who");
const paid = (d: number) => `trust:${d > 0 ? "+" : ""}${d}`;
const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  effects: GwEffect[] = [],
): GwReply => ({
  id,
  stance,
  kind,
  tell: effects
    .filter((e) => e.kind === "person_trust")
    .map((e) => paid((e as { delta: number }).delta)),
  effects,
  next,
});
const node = (...replies: GwReply[]): GwNode => ({
  says: [{ id: "base" }],
  replies,
});
const audience = (
  id: string,
  personId: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  stage: ["crisis", "y1914"],
  when,
  cast: { who: { person: personId } },
  salience: 3,
  tags: ["people", "foreign"],
  once: true,
  summon: true,
  who: "who",
  variants: [{ id: "base" }],
  start: "open",
  nodes,
});

const spare = r("spare", "frank", "deal", "staff", [
  bond("GBR", 1),
  setFlag(draftFlag("GBR")),
  remember("m_deu_road_spare"),
]);
const fleet = r("fleet", "warm", "deal", "tirp", [
  bond("GBR", 1),
  { kind: "pressure", topic: "naval", delta: -1 },
  person("deu_tirpitz", -1),
]);
const letter = r("letter", "warm", "deal", "court", [
  bond("RUS", 1),
  trust("RUS", 1),
]);
const balkan = r("balkan", "frank", "deal", null, [
  bond("RUS", 1),
  trust("AUH", -1),
]);

const SCENES: GwScene[] = [
  audience("deu_r_lich_road", "deu_lichnowsky", all(peace, road("GBR", 1)), {
    open: node(
      spare,
      fleet,
      r("ask", "frank", "ask", "wants"),
      r("leave", "cold", "leave", null, [trustOf(who, -1)]),
    ),
    wants: node(spare, fleet, r("leave", "cold", "leave", null)),
    staff: node(r("end", "frank", "leave", null)),
    tirp: node(r("end", "warm", "leave", null)),
  }),
  audience(
    "deu_r_pourtales_road",
    "deu_pourtales",
    all(peace, road("RUS", 1)),
    {
      open: node(
        letter,
        balkan,
        r("ask", "frank", "ask", "court"),
        r("leave", "cold", "leave", null),
      ),
      court: node(
        r("draft", "frank", "leave", null, [setFlag(draftFlag("RUS"))]),
        r("end", "warm", "leave", null),
      ),
    },
  ),
];

// ---- result cards ----

const card = (id: string): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["foreign"],
  variants: [{ id: "base" }],
});

export const DEU_ROAD_SCENES: readonly GwScene[] = [
  ...SCENES,
  card("deu_pw_pledge_gbr_r"),
  card("deu_pw_pledge_east_r"),
  card("deu_pw_alliance_r"),
];

// ---- the diary: in the margin ----

const diary = (id: string, moment: GwDiaryRow["moment"]): GwDiaryRow => ({
  id: `deu_di_road_${id}`,
  nation: NATION,
  moment,
});

export const DEU_ROAD_PERSONA: GwPersonaContent = {
  diary: [
    diary("feeler", "road_feeler"),
    diary("signed", "road_signed"),
    diary("fell", "road_fell"),
  ],
};

export const DEU_ROAD_DEPTS = DEPTS;
