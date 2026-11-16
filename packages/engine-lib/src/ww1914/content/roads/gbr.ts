// ww220 W1: Britain's papers on the roads history did not take (design
// /home/eser/dev/ww220-design.md §5 R1, R2; shapes /home/eser/dev/ww220-format.md).
// The road between two powers of opposite camps is a reading (Alignment.ts);
// the Prime Minister walks it the way the man would: the Foreign Office's
// envoy courses, an audience with Haldane and one with Grey, the treaty
// papers with the cabinet's vote and the Commons, the parties' answers, a
// diary line for the first feeler, the signature and the fall, and a short
// list of aims against enemies Britain never had in 1914.
//
// Text: GBR.depts.json (depts.answers.gbr_ans_road_*), GBR.powers.json
// (powers.gbr_pw_pledge|alliance, their cards, reasons), GBR.years.json (the
// two audiences), GBR.persona.json (gbr_di_road_*).
//
// Facts used, as flavour: the Haldane mission to Berlin (Feb 1912), where
// Germany asked for British neutrality against a naval slowdown; the
// Anglo-German Portuguese-colonies (1913) and Baghdad-railway (June 1914)
// agreements initialled; Grey's line that Britain's hands were free.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
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
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";

const NATION: ["GBR"] = ["GBR"];

// ---- small words ----

const war = world({ is: "war" });
const peace = not(war);
/** The road to `tag` stands at `min`..`max` (0 cold .. 4 alliance). */
const road = (tag: GwTag, min?: number, max?: number, of?: GwTag): GwCond =>
  world({
    is: "road",
    tag,
    ...(of === undefined ? {} : { of }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });
const bondAt = (tag: GwTag, min?: number, max?: number): GwCond =>
  world({
    is: "bond",
    tag,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });
const bond = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });
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
const pressure = (
  topic: "colonial" | "naval" | "balkan",
  delta: number,
): GwEffect => ({ kind: "pressure", topic, delta });
const reason = (key: string): GwEffect => ({ kind: "reason", key });

/** The Foreign Office has a draft of the pledge on the table. */
const DRAFT = "f_gbr_road_draft";
/** A quarrel with France's or Russia's camp that an alliance could answer. */
const quarrel: GwCond = any(bondAt("RUS", undefined, -2), {
  kind: "pressure",
  topic: "colonial",
  min: 2,
});

// ---- 외교: the Foreign Office's courses ----

const f = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
const c = (
  id: string,
  lean: GwCourseRow["lean"],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });

const DEPTS: GwDeptContent = {
  answers: [
    {
      // Berlin, while there is a road to it (the camps apart).
      id: "gbr_ans_road_deu",
      nation: NATION,
      type: "envoy",
      topic: ["DEU"],
      question: "reach",
      when: all(peace, road("DEU")),
      findings: [
        f("cold", 3, { when: road("DEU", 0, 0) }),
        f("thaw", 3, { when: road("DEU", 1, 1) }),
        f("understanding", 3, { when: road("DEU", 2, 2) }),
        f("pledge", 3, { when: road("DEU", 3, 3) }),
        f("alliance", 3, { when: road("DEU", 4) }),
        f("paris_smells", 2, { when: road("DEU", 1) }),
        // A weak head reads Berlin as sincere: hindsight when the road falls.
        f("berlin_sincere", 1, {
          wrong: true,
          when: road("DEU", 2),
          truth: road("DEU", 2),
        }),
      ],
      courses: [
        c("open_line", ["gentle", "calm"], [bond("DEU", 1), trust("DEU", 1)], {
          when: road("DEU", 0, 1),
        }),
        c(
          "secret_envoy",
          ["bold"],
          [bond("DEU", 1), setFlag("f_gbr_road_envoy"), trust("FRA", -1)],
          { when: road("DEU", 1, 3), needs: [{ kind: "person" }] },
        ),
        c(
          "draft_pledge",
          ["firm", "calm"],
          [setFlag(DRAFT), remember("m_gbr_road_draft")],
          { when: all(road("DEU", 2), not(flag(DRAFT))) },
        ),
        c("leave_it", ["wait", "cheap"], [], { wait: true }),
      ],
    },
    {
      // Paris, while the road to Berlin is open: room to step back.
      id: "gbr_ans_road_fra",
      nation: NATION,
      type: "envoy",
      topic: ["FRA"],
      when: all(peace, road("DEU", 1)),
      findings: [
        f("cambon", 3),
        f("staff_talks", 2, { when: bondAt("FRA", 1) }),
      ],
      courses: [
        c("free_hands", ["cheap", "calm"], [bond("FRA", -1), trust("FRA", -1)]),
        c("reassure", ["gentle"], [bond("FRA", 1), trust("FRA", 1)]),
      ],
    },
    {
      // Petersburg: Persia and the Indian frontier, and a warning when
      // Russia walks a road to Berlin of its own.
      id: "gbr_ans_road_rus",
      nation: NATION,
      type: "envoy",
      topic: ["RUS"],
      when: peace,
      findings: [
        f("persia", 2, { when: road("DEU", 1) }),
        f("rus_berlin", 3, { when: road("DEU", 2, undefined, "RUS") }),
      ],
      courses: [
        c("persia_firm", ["firm"], [bond("RUS", -1), pressure("colonial", 1)], {
          when: road("DEU", 1),
        }),
      ],
    },
  ],
};

// ---- 동맹과 조약: the treaty papers ----

/** The Commons on a pledge: the Liberal benches and Labour for, Unionists against. */
const PLEDGE_HOUSE = {
  gbr_liberals: 1,
  gbr_rebels: 1,
  gbr_lg: 1,
  gbr_unionists: -1,
  gbr_uwc: -1,
  gbr_labour: 1,
  gbr_ilp: 1,
  gbr_irish: 1,
  gbr_sinn_fein: 0,
} as const;

export const GBR_ROAD_POWERS: readonly GwPowerRow[] = [
  {
    // R1: Britain's own neutrality, offered to Berlin.
    id: "gbr_pw_pledge",
    tag: "GBR",
    group: "treaty",
    kind: "lawful",
    opens: [
      { when: not({ kind: "at_war", tag: "DEU" }), why: "at_war" },
      { when: road("DEU", 2), why: "no_road" },
      { when: flag(DRAFT), why: "no_draft" },
    ],
    needs: {
      office: "foreign",
      council: "neutrality",
      house: { houses: ["commons"], stance: PLEDGE_HOUSE },
    },
    authority: 10,
    cooldown: 6,
    tags: ["realign"],
    effects: [
      doWorld({ do: "realign_offer", tag: "DEU", step: "pledge" }),
      remember("m_gbr_road_pledge"),
    ],
    failed: [reason("gbr_pw_pledge_failed")],
    scene: "gbr_pw_pledge_r",
  },
  {
    // R2: an alliance with Germany, in peace from a pledge; in the war only
    // when it is going badly (Alignment.canSwitch).
    id: "gbr_pw_alliance",
    tag: "GBR",
    group: "treaty",
    kind: "lawful",
    opens: [
      {
        when: any(
          all(peace, road("DEU", 3)),
          all(war, world({ is: "switch_can" })),
        ),
        why: "no_road",
      },
      { when: any(war, bondAt("DEU", 2)), why: "no_bond" },
      { when: any(war, bondAt("FRA", undefined, -1)), why: "paris" },
      { when: any(war, quarrel), why: "no_quarrel" },
    ],
    needs: { office: "foreign", council: "realign" },
    against: ["unionist", "labour"],
    authority: 20,
    cooldown: 8,
    tags: ["realign"],
    effects: [
      doWorld({ do: "realign_offer", tag: "DEU", step: "alliance" }),
      remember("m_gbr_road_alliance"),
    ],
    failed: [reason("gbr_pw_alliance_failed")],
    // The Unionists split, Labour against, Grey's resignation in the air.
    risk: {
      pct: 30,
      mods: [{ when: { kind: "inst", inst: "cabinet", max: -1 }, add: 20 }],
      then: [
        heat("gbr_unionists", 1),
        heat("gbr_labour", 1),
        person("gbr_grey", -2),
        reason("gbr_pw_alliance_split"),
      ],
    },
    scene: "gbr_pw_alliance_r",
  },
];

/** The parties' answers to a road taken (on top of GW_REACTORS `realign`). */
export const GBR_ROAD_REACTORS: readonly GwReactorRow[] = [
  {
    tag: "realign",
    nation: "GBR",
    actor: "other",
    delta: -1,
    key: "gbr_react_realign_unionists",
    does: [heat("gbr_unionists", 1)],
  },
  {
    tag: "realign",
    nation: "GBR",
    actor: "other",
    powers: ["gbr_pw_pledge"],
    delta: 1,
    key: "gbr_react_realign_radicals",
    does: [heat("gbr_rebels", -1), heat("gbr_ilp", -1)],
  },
  {
    tag: "realign",
    nation: "GBR",
    actor: "other",
    powers: ["gbr_pw_alliance"],
    delta: -1,
    key: "gbr_react_realign_labour",
    does: [heat("gbr_labour", 1), heat("gbr_ilp", 1)],
  },
];

// ---- audiences: Haldane to Berlin, Grey against ----

const who = role("who");
const paid = (d: number) => `trust:${d > 0 ? "+" : ""}${d}`;
const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  effects: GwEffect[] = [],
  when?: GwCond,
): GwReply => ({
  id,
  stance,
  kind,
  tell: effects
    .filter((e) => e.kind === "person_trust")
    .map((e) => paid((e as { delta: number }).delta)),
  effects,
  next,
  ...(when === undefined ? {} : { when }),
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
const navalFree = not(world({ is: "accord", kind: "naval" }));

const SCENES: GwScene[] = [
  audience(
    "gbr_r_haldane",
    "gbr_haldane",
    all(peace, any(road("DEU", 1), flag("f_gbr_road_envoy"))),
    {
      open: node(
        r(
          "fleet",
          "frank",
          "deal",
          "fleet",
          [
            bond("DEU", 1),
            doWorld({ do: "accord", kind: "naval", tag: "DEU" }),
          ],
          navalFree,
        ),
        r("neutral", "warm", "deal", "warn", [
          bond("DEU", 1),
          setFlag(DRAFT),
          remember("m_gbr_road_haldane"),
        ]),
        r("paris", "frank", "ask", "paris"),
        r("not_now", "cold", "leave", null),
      ),
      paris: node(
        r(
          "fleet",
          "frank",
          "deal",
          "fleet",
          [
            bond("DEU", 1),
            doWorld({ do: "accord", kind: "naval", tag: "DEU" }),
          ],
          navalFree,
        ),
        r("neutral", "warm", "deal", "warn", [
          bond("DEU", 1),
          setFlag(DRAFT),
          remember("m_gbr_road_haldane"),
        ]),
        r("not_now", "cold", "leave", null),
      ),
      fleet: node(r("end", "warm", "leave", null)),
      warn: node(
        r("tell_grey", "frank", "leave", null, [person("gbr_grey", 1)]),
        r("keep_quiet", "cold", "leave", null, [
          remember("m_gbr_road_secret"),
          trustOf(who, -1),
        ]),
      ),
    },
  ),
  audience("gbr_r_grey", "gbr_grey", all(peace, road("DEU", 2)), {
    open: node(
      r("explain", "frank", "ask", "why"),
      r("order", "cold", "push", null, [trustOf(who, -1)]),
      r("soothe", "warm", "deal", null, [bond("FRA", 1)]),
    ),
    why: node(
      r("pledge_only", "warm", "leave", null, [trustOf(who, 1)]),
      r("further", "cold", "leave", null, [
        trustOf(who, -2),
        remember("m_gbr_grey_against"),
      ]),
    ),
  }),
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

export const GBR_ROAD_SCENES: readonly GwScene[] = [
  ...SCENES,
  card("gbr_pw_pledge_r"),
  card("gbr_pw_alliance_r"),
];

// ---- the diary: the first feeler, the signature, the fall ----

const diary = (id: string, moment: GwDiaryRow["moment"]): GwDiaryRow => ({
  id: `gbr_di_road_${id}`,
  nation: NATION,
  moment,
});

export const GBR_ROAD_PERSONA: GwPersonaContent = {
  diary: [
    diary("feeler", "road_feeler"),
    diary("signed", "road_signed"),
    diary("fell", "road_fell"),
  ],
};

export const GBR_ROAD_DEPTS = DEPTS;
