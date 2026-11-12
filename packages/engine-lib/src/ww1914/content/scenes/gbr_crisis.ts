import type {
  GwInstitution,
  GwOpening,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  byName,
  candid,
  chose,
  dropCard,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
  keepPromise,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * 「영국」, the crisis share: the gbr_c_ scenes, the talks of Grey, the King,
 * Carson and Redmond, and five visits. Data only; the text is in
 * resources/ww1914/ko/GBR.crisis.json. Plan: ww135-plan-gbr.md §5, §9, §10.
 *
 * Chapters are windows, not dates. A card is dealt when its chapter opens, so
 * a chapter's cards can't read each other's choice in their text, but options
 * can: the second cabinet, the Commons and the ultimatum share chapter 5, the
 * week they shared in 1914, and the ultimatum's `send` opens from what the
 * cabinet decided.
 */

const NATION: GwScene["nation"] = ["GBR"];
/**
 * A crisis can close and a later spark bring it back: the world's chain is not
 * a calendar. What July's scenes wait on is the state, up to about 1916.
 */
const LATE: GwScene["stage"] = ["crisis", "y1914", "war"];
const p = role("p");
const fm = role("fm");
const navy = role("navy");
const fin = role("fin");
const lord = role("lord");
const home = role("home");
const cos = role("cos");
const king = byName("gbr_george_v");
const carson = byName("gbr_carson");
const redmond = byName("gbr_redmond");

const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const cabinet = (d: number) => body("cabinet", d);
const commons = (d: number) => body("commons", d);
const opposition = (d: number) => body("opposition", d);
const irish = (d: number) => body("irish", d);

type Issue = "entry" | "bef" | "home_rule";
/** The cabinet is counted. */
const vote = (issue: Issue): GwEffect => act({ do: "vote", issue });
/** The count is enough: who has been told shows in `v_<issue>`. */
const votes = (issue: Issue): GwCond => world({ is: "votes", issue, min: 0 });

const chapters = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
/**
 * July's state, while it lasts: the crisis at this link of the chain, or a war
 * still under a year and a half old (the cabinet may sit on after the crisis
 * closed into a war on the continent).
 */
const late = (min: number): GwCond =>
  any(world({ is: "chain", min }), world({ is: "war_months", max: 17 }));
const from = (min: number): GwCond => ({ kind: "chapter", min });

const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const gauge = (
  g: "money" | "order" | "morale" | "shells",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const irishHeat = (delta: number): GwEffect => ({
  kind: "pressure",
  topic: "ireland",
  delta,
});
const delay = (days: number): GwEffect => ({ kind: "delay", days });
const act = (of: GwWorldEffect): GwEffect => ({ kind: "world", of });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const appoint = (person: string, office: "war" | "sea_lord"): GwEffect => ({
  kind: "appoint",
  who: byName(person),
  office,
});
const force = (delta: number): GwEffect =>
  act({ do: "force", tag: "GBR", theatre: "west", delta });

const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const opening = (...of: GwOpening[]): GwCond => ({ kind: "opening", of });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const world = (of: Extract<GwCond, { kind: "world" }>["of"]): GwCond => ({
  kind: "world",
  of,
});
const irishPress = (min: number): GwCond => ({
  kind: "pressure",
  topic: "ireland",
  min,
});
const tempMin = (min: number): GwCond => ({ kind: "temp", min });
const trusted = (who: GwWho, min: number): GwCond => ({
  kind: "person_trust",
  who,
  min,
});
const distrusted = (who: GwWho, max: number): GwCond => ({
  kind: "person_trust",
  who,
  max,
});
const holds = (
  office: "sea_lord" | "war" | "navy",
  person: string,
): GwCond => ({
  kind: "holder",
  office,
  person,
});

/** The war on the continent: the crisis may close before the cabinet does. */
const continent = world({ is: "entered", tag: "FRA" });
const hot = any(crisis, continent);
const inWar = atWar("DEU");
const notInWar = not(inWar);
const belg = world({ is: "plan", of: ["west"] });
const east1 = world({ is: "plan", of: ["east"] });
const hr = flag("f_home_rule_lives");
const sarajevo = opening("sarajevo", "sarajevo_survived", "sarajevo_failed");
const heardFrom = (key: string): GwCond => memory(key);

const v = (id: string, when: GwCond): GwVariant => ({ id, when });
const base: GwVariant = { id: "base" };

function scene(
  id: string,
  kind: GwScene["kind"],
  salience: number,
  tags: GwScene["tags"],
  cast: GwScene["cast"],
  when: GwCond,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind,
    stage: ["crisis", "y1914"],
    when,
    cast,
    salience,
    tags,
    once: true,
    variants,
    ...more,
  };
}

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined ? { id, tell, effects } : { id, when, tell, effects };

const r = (
  id: string,
  stance: GwStance,
  kind: GwReply["kind"],
  tell: string[],
  effects: GwEffect[],
  next: string | null,
  more: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell, effects, next, ...more });

const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([base], ...replies);
const close = (id: string, stance: GwStance): GwReply =>
  r(id, stance, "leave", [], [], null);
/** `open` says by each temperament named, then the base. */
const moods = (...of: Parameters<typeof moody>[1][]): GwVariant[] => [
  ...of.map((t) => v(t, moody(p, t))),
  base,
];

/** An asked person answers straight: these replace the reply's plain end. */
const straight = (next: string, ...effects: GwEffect[]) => ({
  when: candid(p),
  next,
  effects,
});

/** Called from the people screen. */
function talk(
  id: string,
  person: string,
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    when,
    cast: { p: { person } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes,
    ...more,
  };
}

/** The desk brings it: they come without being called. */
function visit(
  id: string,
  person: string,
  when: GwCond,
  salience: number,
  tags: GwScene["tags"],
  nodes: Record<string, GwNode>,
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    when,
    cast: { p: { person } },
    salience,
    tags,
    once: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes,
  };
}

const CRISIS_SCENES: readonly GwScene[] = [
  // ---- The first desk: Ulster on top, Sarajevo under it ----
  scene(
    "gbr_c_roster",
    "report",
    9,
    ["people", "home"],
    { fm: { office: "foreign" } },
    chapters(0, 0),
    [
      v("ulster", world({ is: "thread", id: "ireland" })),
      v("naval", world({ is: "thread", id: "naval_race" })),
      base,
    ],
    { stamp: "confirmed", source: "staff" },
  ),
  scene(
    "gbr_c_amending",
    "crisis",
    9,
    ["home", "tension_up"],
    // Carson and Redmond are named here, not cast: a first game meets them later.
    { ire: { office: "ireland" }, fm: { office: "foreign" } },
    chapters(0, 1),
    [
      v("first", all({ kind: "first_game" }, chapters(0, 1))),
      v("no_wire", opening("no_sarajevo")),
      v("hot", world({ is: "thread", id: "ireland" })),
      v("proud", moody(carson, "arrogant")),
      v("worn", moody(carson, "weary")),
      base,
    ],
    {
      fallback: "six_years",
      options: [
        opt(
          "six_years",
          ["irish:-1", "carson:-1"],
          [
            vote("home_rule"),
            irish(-1),
            trustOf(carson, -1),
            irishHeat(1),
            setFlag("f_amend_six"),
          ],
        ),
        opt(
          "county_option",
          ["irish:+1", "carson:-1", "cabinet:+1"],
          [
            vote("home_rule"),
            irish(1),
            cabinet(1),
            trustOf(carson, -1),
            setFlag("f_amend_county"),
          ],
          heardFrom("k_red_counties"),
        ),
        opt(
          "clean_cut",
          ["irish:-2", "opposition:-1", "redmond:-2"],
          [
            vote("home_rule"),
            irish(-2),
            opposition(-1),
            trustOf(redmond, -2),
            setFlag("f_amend_clean"),
          ],
          all(heardFrom("k_car_clean"), votes("home_rule")),
        ),
        opt(
          "palace_talk",
          ["king:+1", "opposition:+1"],
          [
            opposition(1),
            trustOf(king, 1),
            irishHeat(1),
            setFlag("f_amend_palace"),
          ],
          heardFrom("k_king_conf"),
        ),
        opt(
          "press_on",
          ["irish:+1", "opposition:+2", "carson:-2"],
          [
            irish(1),
            opposition(2),
            trustOf(carson, -2),
            irishHeat(2),
            setFlag("f_press_on"),
          ],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_sarajevo_wire",
    "wire",
    5,
    ["foreign"],
    { fm: { office: "foreign" } },
    all(chapters(0, 0), sarajevo),
    [
      v("failed", opening("sarajevo_failed")),
      v("survived", opening("sarajevo_survived")),
      // ww187: the wire tells what has happened.
      { ...base, assumes: { past: true } },
    ],
  ),
  // ---- The skeleton of July ----
  scene(
    "gbr_c_palace",
    "crisis",
    8,
    ["home", "tension_up"],
    {
      court: { office: "court" },
      ire: { office: "ireland" },
      carson: { person: "gbr_carson" },
      redmond: { person: "gbr_redmond" },
      king: { person: "gbr_george_v" },
    },
    all(
      // Five new faces at once: a first game has the room a link later.
      world({ is: "chain", short: false, min: 2, max: 3 }),
      any(
        world({ is: "chain", short: false, min: 3, max: 3 }),
        not({ kind: "first_game" }),
      ),
      any(
        heardFrom("k_king_conf"),
        irishPress(3),
        chose("gbr_c_amending", "palace_talk"),
        world({ is: "chain", short: false, min: 3, max: 3 }),
      ),
    ),
    [
      v("asked", chose("gbr_c_amending", "palace_talk")),
      v("pressed", flag("f_press_on")),
      v("county", flag("f_amend_county")),
      base,
    ],
    {
      fallback: "attend_firm",
      options: [
        opt(
          "attend_firm",
          ["king:+1"],
          [trustOf(role("king"), 1), setFlag("f_palace_firm")],
        ),
        opt(
          "chancellor_leads",
          ["finance:+1", "king:-1", "opposition:+1"],
          [
            { kind: "person_trust", who: { office: "finance" }, delta: 1 },
            trustOf(role("king"), -1),
            opposition(1),
            setFlag("f_palace_lg"),
          ],
        ),
        opt(
          "offer_counties",
          ["irish:-1", "carson:+1"],
          [
            irish(-1),
            trustOf(role("carson"), 1),
            remember("m_counties_offered"),
            setFlag("f_palace_counties"),
          ],
          heardFrom("k_red_counties"),
        ),
        opt(
          "police_figures",
          ["carson:-1", "opposition:-1"],
          [
            trustOf(role("carson"), -1),
            opposition(-1),
            setFlag("f_palace_figures"),
          ],
          heardFrom("k_mck_police"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_note_read",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, navy: { office: "navy" } },
    all(late(3), hot, flag("w_ultimatum_out")),
    [
      v("settled", hr),
      v("survived", opening("sarajevo_survived")),
      v("map", seen("gbr_c_palace")),
      base,
    ],
    {
      stage: LATE,
      fallback: "back_to_ulster",
      options: [
        opt(
          "back_to_ulster",
          ["irish:+1", "temp:+1"],
          [irish(1), temp(1), setFlag("f_back_to_ulster")],
        ),
        opt(
          "grey_conference",
          ["temp:-1", "fra:+1"],
          [
            temp(-1),
            trust("FRA", 1),
            trustOf(fm, 1),
            setFlag("f_grey_conference"),
          ],
          heardFrom("k_grey_conf"),
        ),
        opt(
          "warn_berlin",
          ["deu:-1", "temp:-1", "cabinet:-1"],
          [trust("DEU", -1), temp(-1), cabinet(-1), setFlag("f_warned_berlin")],
        ),
        opt(
          "quiet_word_fleet",
          ["navy:+1", "temp:+1"],
          [trustOf(navy, 1), temp(1), setFlag("f_fleet_word")],
          heardFrom("k_chu_fleet"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_cambon",
    "crisis",
    8,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, cambon: { person: "fra_paul_cambon" } },
    all(late(4), hot, tempMin(3)),
    [
      v("conference", flag("f_grey_conference")),
      v("warned", flag("f_warned_berlin")),
      v("known", heardFrom("k_grey_letters")),
      base,
    ],
    {
      stage: LATE,
      fallback: "say_nothing",
      options: [
        opt(
          "say_nothing",
          ["fra:-1", "cabinet:+1"],
          [trust("FRA", -1), cabinet(1), setFlag("f_cambon_nothing")],
        ),
        opt(
          "coast_word",
          ["fra:+2", "cabinet:-1"],
          [trust("FRA", 2), cabinet(-1), setFlag("f_coast_word")],
          heardFrom("k_grey_letters"),
        ),
        opt(
          "read_letters",
          ["fra:+1", "cabinet:-2", "temp:+1"],
          [trust("FRA", 1), cabinet(-2), temp(1), setFlag("f_letters_read")],
          heardFrom("k_grey_letters"),
        ),
        opt(
          "staff_papers",
          ["fra:+1", "opposition:-1"],
          [trust("FRA", 1), opposition(-1), setFlag("f_staff_papers")],
          heardFrom("k_bal_cid"),
        ),
        opt(
          "king_letter",
          ["fra:+1", "king:+1"],
          [
            trust("FRA", 1),
            trustOf(king, 1),
            keepPromise(king, "p_king_warn"),
            setFlag("f_king_letter"),
          ],
          heardFrom("k_king_cousin"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_cabinet_one",
    "crisis",
    9,
    ["foreign", "tension_up"],
    {
      fm: { office: "foreign" },
      fin: { office: "finance" },
      navy: { office: "navy" },
      morley: { person: "gbr_morley" },
    },
    all(late(4), hot),
    [
      v("heard_cambon", seen("gbr_c_cambon")),
      v("warned", flag("f_warned_berlin")),
      v("ulster_still", flag("f_back_to_ulster")),
      base,
    ],
    {
      stage: LATE,
      fallback: "free_hand",
      options: [
        opt(
          "free_hand",
          ["cabinet:+1", "fra:-1"],
          [vote("entry"), cabinet(1), trust("FRA", -1), setFlag("f_free_hand")],
        ),
        opt(
          "belgium_policy",
          ["cabinet:+2"],
          [vote("entry"), cabinet(2), setFlag("f_belgium_policy")],
          heardFrom("k_lg_belgium"),
        ),
        opt(
          "offer_resign",
          ["cabinet:-1", "foreign:+1"],
          [
            cabinet(-1),
            trustOf(fm, 1),
            trustOf(role("morley"), -1),
            setFlag("f_split"),
          ],
        ),
        opt(
          "send_fleet_north",
          ["temp:+1", "fra:+1", "cabinet:-1"],
          [
            vote("entry"),
            temp(1),
            trust("FRA", 1),
            cabinet(-1),
            setFlag("f_split"),
            setFlag("f_fleet_north"),
          ],
          votes("entry"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_cabinet_two",
    "crisis",
    9,
    ["foreign", "tension_up"],
    {
      fm: { office: "foreign" },
      fin: { office: "finance" },
      navy: { office: "navy" },
      morley: { person: "gbr_morley" },
      lg: { person: "gbr_lloyd_george" },
      law: { person: "gbr_bonar_law" },
    },
    all(
      all(
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "peace_months", max: 17 } },
      ),
      hot,
      notInWar,
      seen("gbr_c_cabinet_one"),
    ),
    [
      v("treaty", flag("f_lich_understanding")),
      v("belg_split", all(belg, flag("f_split"))),
      v("belg_whole", all(belg, flag("f_belgium_policy"))),
      v("belg", belg),
      v("east1", east1),
      base,
    ],
    {
      stage: LATE,
      fallback: "wait_day",
      options: [
        opt(
          "wait_day",
          ["delay:1", "fra:-1"],
          [delay(1), trust("FRA", -1), setFlag("f_two_waited")],
        ),
        opt(
          "belgium_condition",
          ["cabinet:+2", "radicals:-1"],
          [
            vote("entry"),
            cabinet(2),
            trustOf(role("morley"), -1),
            setFlag("f_morley_out"),
            setFlag("f_belgium_condition"),
          ],
          all(belg, heardFrom("k_lg_belgium")),
        ),
        opt(
          "coast_only",
          ["fra:-2", "cabinet:-1", "leaves"],
          [
            trust("FRA", -2),
            cabinet(-1),
            act({ do: "letter", who: fm }),
            setFlag("f_coast_only"),
          ],
        ),
        opt(
          "keep_morley",
          ["cabinet:+1", "delay:1"],
          [
            cabinet(1),
            delay(1),
            trustOf(role("morley"), 1),
            setFlag("f_morley_kept"),
          ],
          heardFrom("k_morley_stay"),
        ),
        opt(
          "last_word_berlin",
          ["deu:+1", "temp:-1", "delay:1"],
          [trust("DEU", 1), temp(-1), delay(1), setFlag("f_last_word")],
          heardFrom("k_lich_last"),
        ),
        opt(
          "stand_with_france",
          ["fra:+3", "cabinet:-4", "opposition:-1"],
          [
            vote("entry"),
            trust("FRA", 3),
            cabinet(-4),
            opposition(-1),
            keepPromise(king, "p_king_warn"),
            setFlag("f_morley_out"),
            setFlag("f_stand_france"),
          ],
          any(belg, votes("entry")),
        ),
        opt(
          "declare_neutral",
          ["fra:-3", "cabinet:+1", "king:-1", "leaves"],
          [
            trust("FRA", -3),
            cabinet(1),
            trustOf(king, -1),
            keepPromise(king, "p_king_warn"),
            act({ do: "aside" }),
            act({ do: "letter", who: fm }),
            setFlag("f_neutral_declared"),
          ],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_commons",
    "crisis",
    8,
    ["home", "foreign"],
    {
      fm: { office: "foreign" },
      redmond: { person: "gbr_redmond" },
      law: { person: "gbr_bonar_law" },
    },
    all(
      all(
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "peace_months", max: 17 } },
      ),
      hot,
      notInWar,
    ),
    [v("belg", belg), v("east1", east1), base],
    {
      stage: LATE,
      fallback: "plain_speech",
      options: [
        opt(
          "plain_speech",
          ["commons:+1"],
          [commons(1), setFlag("f_commons_plain")],
        ),
        opt(
          "irish_offer",
          ["irish:+2", "commons:+1", "opposition:-1"],
          [
            irish(2),
            commons(1),
            opposition(-1),
            trustOf(role("redmond"), 1),
            setFlag("f_redmond_spoke"),
          ],
          heardFrom("k_red_speech"),
        ),
        opt(
          "opposition_word",
          ["opposition:-2", "cabinet:-1"],
          [
            opposition(-2),
            cabinet(-1),
            trustOf(role("law"), 1),
            setFlag("f_law_spoke"),
          ],
          heardFrom("k_law_letter"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_ultimatum",
    "crisis",
    9,
    ["foreign", "war", "tension_up"],
    {
      fm: { office: "foreign" },
      goschen: { person: "gbr_goschen" },
    },
    all(
      all(
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "peace_months", max: 17 } },
      ),
      any(belg, flag("f_stand_france")),
      notInWar,
      not(flag("f_ult_lapsed")),
      not(flag("f_neutral_declared")),
    ),
    [
      v("waited", heardFrom("m_ult_waited")),
      v("france", all(not(belg), flag("f_stand_france"))),
      base,
    ],
    {
      once: false,
      cooldown: 1,
      stage: LATE,
      fallback: "send",
      options: [
        opt(
          "send",
          ["fra:+2", "cabinet:-1"],
          [
            vote("entry"),
            trust("FRA", 2),
            cabinet(-1),
            keepPromise(king, "p_king_warn"),
            act({ do: "declare", tag: "DEU" }),
            act({
              do: "command",
              who: { person: "gbr_jellicoe" },
              theatre: "sea",
            }),
            setFlag("f_war_aug"),
            dropCard("gw_gbr_entry"),
            dropCard("gbr_f_neutral_line"),
          ],
          any(
            chose("gbr_c_cabinet_two", "belgium_condition"),
            chose("gbr_c_cabinet_two", "stand_with_france"),
            votes("entry"),
          ),
        ),
        opt(
          "wait_reply",
          ["fra:-1", "delay:1"],
          [
            trust("FRA", -1),
            delay(1),
            maybe(heardFrom("m_ult_waited"), setFlag("f_ult_lapsed")),
            remember("m_ult_waited"),
          ],
        ),
        opt(
          "ask_paris_first",
          ["fra:+1", "delay:1"],
          [
            trust("FRA", 1),
            delay(1),
            maybe(heardFrom("m_ult_waited"), setFlag("f_ult_lapsed")),
            remember("m_ult_waited"),
          ],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_war_office",
    "crisis",
    8,
    ["people", "war"],
    {
      fm: { office: "foreign" },
      kit: { person: "gbr_kitchener" },
      hal: { person: "gbr_haldane" },
    },
    all(
      all(
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "war_months", own: true, max: 17 } },
      ),
      inWar,
      { kind: "office_empty", office: "war" },
    ),
    [
      v("held", chose("gbr_c_war_office_held", "keep_it")),
      v("offered", chose("gbr_c_war_office_held", "give_haldane")),
      base,
    ],
    {
      stage: LATE,
      fallback: "kitchener",
      options: [
        opt(
          "kitchener",
          ["opposition:-1", "commons:+1"],
          [
            appoint("gbr_kitchener", "war"),
            opposition(-1),
            commons(1),
            setFlag("f_kitchener_in"),
          ],
        ),
        opt(
          "haldane",
          ["cabinet:+1", "opposition:+1"],
          [
            appoint("gbr_haldane", "war"),
            cabinet(1),
            opposition(1),
            setFlag("f_haldane_war"),
          ],
          heardFrom("k_hal_army"),
        ),
        opt(
          "keep_it",
          ["opposition:+2"],
          [opposition(2), setFlag("f_war_kept")],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_bef",
    "crisis",
    9,
    ["war", "tension_up"],
    {
      war: { any_of: [{ office: "war" }, { person: "gbr_haldane" }] },
      cos: { office: "chief_of_staff" },
      navy: { office: "navy" },
      wilson: { person: "gbr_wilson" },
      french: { person: "gbr_french" },
    },
    all(
      all(
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "war_months", own: true, max: 17 } },
      ),
      inWar,
    ),
    [
      v("east1", east1),
      v("long", heardFrom("k_kit_long")),
      {
        ...v(
          "liege",
          world({ is: "battle", theatre: "west", of: ["advance", "break"] }),
        ),
        // "fall back to Amiens and gather there"
        assumes: { held: { amiens: "us" } },
      },
      base,
    ],
    {
      stage: LATE,
      fallback: "four_divisions",
      options: [
        opt(
          "four_divisions",
          ["fra:+1", "west:+1"],
          [vote("bef"), trust("FRA", 1), force(1), setFlag("f_bef_four")],
        ),
        opt(
          "six_divisions",
          ["fra:+2", "west:+2", "order:-1"],
          [
            vote("bef"),
            trust("FRA", 2),
            force(2),
            gauge("order", -1),
            setFlag("f_bef_six"),
          ],
          all(heardFrom("k_kit_long"), votes("bef")),
        ),
        opt(
          "antwerp_line",
          ["fra:-1", "west:+1"],
          [vote("bef"), trust("FRA", -1), force(1), setFlag("f_bef_antwerp")],
        ),
        opt(
          "hold_home",
          ["fra:-2", "cabinet:+1"],
          [vote("bef"), trust("FRA", -2), cabinet(1), setFlag("f_bef_home")],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_retreat",
    "crisis",
    8,
    ["war"],
    {
      war: { any_of: [{ office: "war" }, { person: "gbr_haldane" }] },
      french: { person: "gbr_french" },
    },
    all(
      all(
        { kind: "world", of: { is: "war_months", own: true, min: 1 } },
        { kind: "world", of: { is: "war_months", own: true, max: 17 } },
      ),
      inWar,
      world({
        is: "battle",
        theatre: "west",
        of: ["repelled", "stalemate", "advance", "break"],
      }),
      not(flag("f_bef_home")),
      seen("gbr_c_bef"),
      not(east1),
    ),
    [
      v("six", flag("f_bef_six")),
      {
        ...v("kit", holds("war", "gbr_kitchener")),
        // "to Paris by the night train"
        assumes: { held: { paris: "us" } },
      },
      base,
    ],
    {
      stage: LATE,
      fallback: "wire_french",
      options: [
        opt(
          "wire_french",
          ["fra:+1", "french:-1"],
          [
            trust("FRA", 1),
            trustOf(role("french"), -1),
            setFlag("f_french_wired"),
          ],
        ),
        opt(
          "leave_french",
          ["fra:-2", "french:+1", "west:-1"],
          [
            trust("FRA", -2),
            trustOf(role("french"), 1),
            force(-1),
            setFlag("f_french_left"),
          ],
        ),
        opt(
          "go_to_paris",
          ["fra:+2", "french:-2", "west:+1"],
          [
            trust("FRA", 2),
            trustOf(role("french"), -2),
            force(1),
            setFlag("f_paris_meeting"),
          ],
          all(heardFrom("k_kit_paris"), holds("war", "gbr_kitchener")),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_home_rule_act",
    "crisis",
    8,
    ["home"],
    {
      ire: { office: "ireland" },
      carson: { person: "gbr_carson" },
      redmond: { person: "gbr_redmond" },
    },
    all(
      all(
        { kind: "world", of: { is: "war_months", own: true, min: 1 } },
        { kind: "world", of: { is: "war_months", own: true, max: 17 } },
      ),
      inWar,
      not(hr),
    ),
    [
      v("county", flag("f_amend_county")),
      v("clean", flag("f_amend_clean")),
      v("pressed", flag("f_press_on")),
      base,
    ],
    {
      stage: LATE,
      fallback: "sign_suspend",
      options: [
        opt(
          "sign_suspend",
          ["irish:+1", "opposition:+1"],
          [irish(1), opposition(1), setFlag("f_act_suspended")],
        ),
        opt(
          "ulster_division",
          ["opposition:-1", "irish:-1"],
          [
            opposition(-1),
            irish(-1),
            trustOf(role("carson"), 1),
            setFlag("f_act_suspended"),
            setFlag("f_ulster_division"),
          ],
          heardFrom("k_car_volunteers"),
        ),
        opt(
          "irish_division",
          ["irish:+2", "opposition:+1"],
          [
            irish(2),
            opposition(1),
            trustOf(role("redmond"), 1),
            setFlag("f_act_suspended"),
            setFlag("f_irish_division"),
          ],
          heardFrom("k_red_division"),
        ),
        opt(
          "shelve_both",
          ["irish:-2", "opposition:-1", "redmond:-2"],
          [
            irish(-2),
            opposition(-1),
            trustOf(role("redmond"), -2),
            irishHeat(2),
            setFlag("f_act_shelved"),
          ],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_closing",
    "ledger",
    9,
    ["home", "foreign"],
    { fm: { office: "foreign" } },
    chapters(11, 11),
    [
      v("settled", hr),
      v("neutral", all(continent, notInWar)),
      v("peace", not(continent)),
      base,
    ],
    {
      stage: ["closing"],
      fallback: "close_year",
      options: [opt("close_year", [], [reason("c_closing_r1")])],
    },
  ),
  // ---- The branches ----
  scene(
    "gbr_c_ulster_rifles",
    "report",
    6,
    ["home", "tension_up"],
    {},
    all(chapters(1, 2), irishPress(2)),
    [v("swollen", { kind: "source_band", source: "agents", max: 1 }), base],
    { stamp: "unconfirmed", source: "agents" },
  ),
  scene(
    "gbr_c_war_office_held",
    "audience",
    6,
    ["people"],
    { cos: { office: "chief_of_staff" } },
    chapters(1, 2),
    [v("tired", moody(cos, "weary")), base],
    {
      fallback: "keep_it",
      options: [
        opt(
          "keep_it",
          ["army:-1"],
          [{ kind: "inst", inst: "army", delta: -1 }],
        ),
        opt(
          "give_haldane",
          ["army:+1", "opposition:+1"],
          [
            { kind: "inst", inst: "army", delta: 1 },
            opposition(1),
            appoint("gbr_haldane", "war"),
          ],
          heardFrom("k_hal_army"),
        ),
        opt(
          "name_soldier",
          ["army:+1", "cabinet:-1"],
          [
            { kind: "inst", inst: "army", delta: 1 },
            cabinet(-1),
            appoint("gbr_kitchener", "war"),
            setFlag("f_kitchener_in"),
          ],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_deputation",
    "proposal",
    5,
    ["home", "tension_down"],
    { home: { office: "interior" } },
    chapters(1, 2),
    [v("hard", moody(home, "stubborn")), base],
    {
      fallback: "polite_reply",
      options: [
        opt("polite_reply", [], [reason("c_deputation_r1")]),
        opt(
          "no_special_case",
          ["order:-1", "interior:+1"],
          [gauge("order", -1), trustOf(home, 1), setFlag("f_no_special_case")],
        ),
        opt(
          "word_on_vote",
          ["order:+1", "interior:-1", "cabinet:-1"],
          [
            gauge("order", 1),
            trustOf(home, -1),
            cabinet(-1),
            remember("m_vote_word"),
            setFlag("f_vote_word"),
          ],
          heardFrom("k_ven_franchise"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_budget_muddle",
    "proposal",
    5,
    ["home"],
    { fin: { office: "finance" } },
    chapters(1, 2),
    [v("sly", moody(fin, "cunning")), base],
    {
      fallback: "cut_clauses",
      options: [
        opt(
          "cut_clauses",
          ["commons:+1", "finance:-1"],
          [commons(1), trustOf(fin, -1)],
        ),
        opt(
          "fight_it",
          ["commons:-1", "opposition:+1", "finance:+1"],
          [commons(-1), opposition(1), trustOf(fin, 1)],
        ),
        opt(
          "chancellor_own",
          ["commons:+1", "finance:+1", "money:-1"],
          [commons(1), trustOf(fin, 1), gauge("money", -1)],
          heardFrom("k_lg_budget"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_kiel",
    "wire",
    4,
    ["foreign", "tension_down"],
    { navy: { office: "navy" } },
    all(chapters(0, 0), any(sarajevo, opening("no_sarajevo"))),
    [v("no_wire", opening("no_sarajevo")), base],
  ),
  scene(
    "gbr_c_baghdad",
    "proposal",
    5,
    ["foreign", "tension_down"],
    { fm: { office: "foreign" } },
    all(chapters(1, 3), not(crisis)),
    [
      {
        ...v("rail", world({ is: "thread", id: "baghdad_rail" })),
        // "the German railway as far as Baghdad": the Turks' city.
        assumes: { held: { baghdad: "owner" } },
      },
      base,
    ],
    {
      fallback: "initial",
      options: [
        opt(
          "initial",
          ["deu:+1", "temp:-1"],
          [trust("DEU", 1), temp(-1), setFlag("f_baghdad_initialled")],
        ),
        opt("hold", ["fra:+1"], [trust("FRA", 1)]),
        opt(
          "publish",
          ["deu:-1", "commons:+1"],
          [trust("DEU", -1), commons(1), setFlag("f_baghdad_published")],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_naval_talks",
    "proposal",
    6,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" }, navy: { office: "navy" } },
    all(chapters(1, 3), { kind: "secret", id: "anglo_russian_naval_talks" }),
    [v("known", heardFrom("k_grey_naval")), base],
    {
      fallback: "deny",
      options: [
        opt(
          "deny",
          ["deu:+1", "foreign:-1"],
          [trust("DEU", 1), trustOf(fm, -1), setFlag("f_talks_denied")],
        ),
        opt("vague", ["rus:+1", "temp:+1"], [trust("RUS", 1), temp(1)]),
        opt(
          "stop_talks",
          ["deu:+1", "rus:-2", "temp:-1"],
          [
            trust("DEU", 1),
            trust("RUS", -2),
            temp(-1),
            setFlag("f_talks_stopped"),
          ],
          heardFrom("k_grey_naval"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_tyrone",
    "dispute",
    7,
    ["home", "tension_up"],
    {
      fm: { office: "foreign" },
      carson: { person: "gbr_carson" },
      redmond: { person: "gbr_redmond" },
    },
    all(chapters(3, 4), seen("gbr_c_palace")),
    [
      v("county", flag("f_amend_county")),
      v("offered", heardFrom("m_counties_offered")),
      base,
    ],
    {
      fallback: "split_tyrone",
      options: [
        opt(
          "split_tyrone",
          ["irish:-1", "carson:-1", "home_rule"],
          [
            irish(-1),
            trustOf(role("carson"), -1),
            maybe(flag("f_amend_county"), setFlag("f_home_rule_lives")),
          ],
        ),
        opt(
          "tyrone_out",
          ["irish:-2", "redmond:-1", "home_rule"],
          [
            irish(-2),
            trustOf(role("redmond"), -1),
            maybe(flag("f_amend_county"), setFlag("f_home_rule_lives")),
          ],
          heardFrom("k_car_clean"),
        ),
        opt(
          "tyrone_in",
          ["irish:+1", "carson:-2", "opposition:+1"],
          [
            irish(1),
            opposition(1),
            trustOf(role("carson"), -2),
            maybe(
              all(flag("f_amend_county"), heardFrom("k_car_clean")),
              setFlag("f_home_rule_lives"),
            ),
          ],
          heardFrom("k_red_counties"),
        ),
        opt(
          "adjourn",
          ["delay:1"],
          [irishHeat(1), setFlag("f_tyrone_adjourned")],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_fleet_stays",
    "proposal",
    7,
    ["war", "tension_up"],
    { navy: { office: "navy" }, lord: { office: "sea_lord" } },
    all(chapters(3, 4), hot, tempMin(3)),
    [
      v("anxious", moody(navy, "anxious")),
      v("arrogant", moody(navy, "arrogant")),
      base,
    ],
    {
      fallback: "disperse",
      options: [
        opt(
          "disperse",
          ["temp:-1", "navy:-1"],
          [temp(-1), trustOf(navy, -1), setFlag("f_fleet_dispersed")],
        ),
        opt("keep_fleet", ["temp:+1"], [temp(1), setFlag("f_fleet_kept")]),
        opt(
          "war_stations",
          ["temp:+2", "fra:+1", "cabinet:-1"],
          [
            temp(2),
            trust("FRA", 1),
            cabinet(-1),
            setFlag("f_fleet_kept"),
            setFlag("f_fleet_north"),
          ],
          heardFrom("k_chu_fleet"),
        ),
      ],
    },
  ),
  scene(
    "gbr_c_howth_record",
    "report",
    5,
    ["home"],
    {},
    all(chapters(4, 5), irishPress(3)),
    [v("after", chapters(5, 5)), base],
    { stamp: "confirmed", source: "press" },
  ),
  scene(
    "gbr_c_city",
    "proposal",
    6,
    ["home"],
    { fin: { office: "finance" } },
    // The City shuts as the crisis comes to its last week, or the war's first.
    all(
      any(world({ is: "chain", min: 4 }), world({ is: "war_months", max: 0 })),
      hot,
    ),
    [v("sly", moody(fin, "cunning")), base],
    {
      stage: LATE,
      fallback: "bank_holiday",
      options: [
        opt(
          "bank_holiday",
          ["money:+1"],
          [gauge("money", 1), setFlag("f_city_holiday")],
        ),
        opt(
          "paper_notes",
          ["money:+1", "order:+1", "finance:+1"],
          [
            gauge("money", 1),
            gauge("order", 1),
            trustOf(fin, 1),
            setFlag("f_city_notes"),
          ],
          heardFrom("k_lg_city"),
        ),
        opt(
          "let_it_run",
          ["money:-1", "order:-1"],
          [gauge("money", -1), gauge("order", -1)],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_neutrality_league",
    "report",
    4,
    ["home", "tension_down"],
    {},
    all(chapters(4, 5), hot),
    [v("belg", belg), base],
    { stamp: "confirmed", source: "press" },
  ),
  scene(
    "gbr_c_antwerp",
    "dispute",
    7,
    ["war", "people"],
    {
      navy: { office: "navy" },
      war: { any_of: [{ office: "war" }, { person: "gbr_haldane" }] },
    },
    all(
      all(
        { kind: "world", of: { is: "war_months", own: true, min: 1 } },
        { kind: "world", of: { is: "war_months", own: true, max: 17 } },
      ),
      inWar,
      any(
        world({ is: "front", theatre: "west", from: "aisne", to: "paris" }),
        flag("f_bef_antwerp"),
      ),
    ),
    [
      v("north", flag("f_bef_antwerp")),
      v("proud", moody(navy, "arrogant")),
      base,
    ],
    {
      stage: LATE,
      fallback: "marines_only",
      options: [
        opt(
          "marines_only",
          ["navy:-1"],
          [trustOf(navy, -1), setFlag("f_antwerp_marines")],
        ),
        opt(
          "give_command",
          ["navy:+1", "cabinet:-1", "opposition:+1"],
          [
            trustOf(navy, 1),
            cabinet(-1),
            opposition(1),
            setFlag("f_chu_antwerp"),
          ],
          heardFrom("k_chu_antwerp"),
        ),
        opt(
          "call_him_home",
          ["navy:-2", "cabinet:+1"],
          [trustOf(navy, -2), cabinet(1)],
        ),
      ],
    },
  ),
  scene(
    "gbr_c_first_sea",
    "audience",
    7,
    ["people", "war"],
    { navy: { office: "navy" }, lord: { office: "sea_lord" } },
    all(
      inWar,
      world({ is: "war_months", own: true, min: 2, max: 4 }),
      holds("sea_lord", "gbr_battenberg"),
    ),
    [
      v("antwerp", flag("f_chu_antwerp")),
      v("weary", moody(lord, "weary")),
      base,
    ],
    {
      stage: LATE,
      fallback: "keep_him",
      options: [
        opt(
          "keep_him",
          ["opposition:+1", "king:+1"],
          [opposition(1), trustOf(king, 1), trustOf(lord, 1)],
        ),
        opt(
          "recall_fisher",
          ["opposition:-1", "navy:+1", "king:-1"],
          [
            opposition(-1),
            trustOf(navy, 1),
            trustOf(king, -1),
            appoint("gbr_fisher", "sea_lord"),
          ],
          heardFrom("k_chu_fisher"),
        ),
        opt(
          "name_jellicoe",
          ["opposition:-1", "navy:-1"],
          [
            opposition(-1),
            trustOf(navy, -1),
            appoint("gbr_jellicoe", "sea_lord"),
          ],
        ),
      ],
    },
  ),
  // ---- Grey ----
  talk("gbr_t_grey_france", "gbr_grey", chapters(0, 4), {
    open: node(
      moods("cold", "weary"),
      r("ask", "frank", "ask", [], [], "evade", {
        reacts: [straight("letters", remember("k_grey_letters"))],
      }),
      r("press", "cold", "push", ["grey:-1"], [trustOf(p, -1)], "letters", {
        gain: [remember("k_grey_letters")],
        miss: "sour",
      }),
      r(
        "deal",
        "warm",
        "deal",
        [],
        [
          remember("k_grey_letters"),
          promise(p, "p_grey_quiet", 5, {
            keep: all(from(5), not(chose("gbr_c_cambon", "read_letters"))),
          }),
        ],
        "letters",
      ),
      close("leave", "cold"),
    ),
    evade: plain(
      r("again", "cold", "push", ["grey:-1"], [trustOf(p, -1)], "letters", {
        gain: [remember("k_grey_letters")],
        miss: "sour",
      }),
      close("drop", "warm"),
    ),
    letters: plain(
      r("staff", "frank", "ask", [], [], "staff", {
        reacts: [{ when: moody(p, "weary"), next: "staff_soft", effects: [] }],
      }),
      close("enough", "cold"),
    ),
    staff: plain(close("end", "frank")),
    staff_soft: plain(close("end", "warm")),
    sour: plain(close("end", "cold")),
  }),
  talk(
    "gbr_t_grey_naval",
    "gbr_grey",
    all(chapters(0, 3), { kind: "secret", id: "anglo_russian_naval_talks" }),
    {
      open: node(
        moods("weary"),
        r("ask", "frank", "ask", [], [], "dodge", {
          reacts: [
            straight(
              "truth",
              remember("k_grey_naval"),
              act({ do: "reveal", id: "anglo_russian_naval_talks" }),
            ),
          ],
        }),
        r(
          "deal",
          "flatter",
          "deal",
          [],
          [
            remember("k_grey_naval"),
            act({ do: "reveal", id: "anglo_russian_naval_talks" }),
            promise(p, "p_grey_answer", 4, {
              keep: all(from(3), not(chose("gbr_c_naval_talks", "deny"))),
            }),
          ],
          "truth",
        ),
        close("leave", "cold"),
      ),
      dodge: plain(
        r("who", "threat", "push", ["grey:-1"], [trustOf(p, -1)], "truth", {
          gain: [
            remember("k_grey_naval"),
            act({ do: "reveal", id: "anglo_russian_naval_talks" }),
          ],
          miss: "stiff",
        }),
        close("drop", "warm"),
      ),
      truth: plain(
        r("berlin", "frank", "ask", [], [], "leak"),
        close("end", "cold"),
      ),
      leak: plain(close("end", "frank")),
      stiff: plain(close("end", "cold")),
    },
  ),
  talk("gbr_t_grey_conf", "gbr_grey", all(late(3), hot), {
    open: node(
      moods("cold"),
      r("why", "frank", "ask", [], [], "plan", {
        gain: [remember("k_grey_conf")],
      }),
      r(
        "deal",
        "warm",
        "deal",
        [],
        [
          remember("k_grey_conf"),
          promise(p, "p_grey_conf", 2, { keep: flag("f_grey_conference") }),
        ],
        "plan",
      ),
      r("doubt", "cold", "push", ["grey:-1"], [trustOf(p, -1)], "doubted", {
        gain: [remember("k_grey_conf")],
        reacts: [
          {
            when: moody(p, "cold"),
            next: "plan",
            effects: [remember("k_grey_conf"), reason("t_grey_conf_r1")],
          },
        ],
      }),
      close("leave", "cold"),
    ),
    plan: plain(
      r("berlin", "frank", "ask", [], [], "lich"),
      close("end", "warm"),
    ),
    doubted: plain(close("end", "cold")),
    lich: plain(close("end", "frank")),
  }),
  talk("gbr_t_grey_leave", "gbr_grey", all(late(4), hot, tempMin(4)), {
    open: node(
      [v("hard", distrusted(p, -1)), v("cold", moody(p, "cold")), base],
      r("ask", "frank", "ask", [], [], "fog", {
        reacts: [straight("yes", remember("v_entry", p))],
      }),
      r("fear", "frank", "push", ["grey:+1"], [trustOf(p, 1)], "yes", {
        gain: [remember("v_entry", p)],
        miss: "fog",
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["grey:+1"],
        [
          trustOf(p, 1),
          remember("v_entry", p),
          promise(p, "p_grey_stay", 2, {
            keep: any(
              chose("gbr_c_cabinet_two", "belgium_condition"),
              chose("gbr_c_cabinet_two", "stand_with_france"),
            ),
          }),
        ],
        "bound",
      ),
      r("threat", "threat", "push", ["grey:-2"], [trustOf(p, -2)], "stone"),
      close("leave", "warm"),
    ),
    fog: plain(close("end", "warm")),
    yes: plain(
      r("who", "frank", "ask", [], [], "who_else"),
      close("end", "warm"),
    ),
    who_else: plain(close("end", "cold")),
    bound: plain(close("end", "warm")),
    stone: plain(close("end", "cold")),
  }),
  talk(
    "gbr_t_grey_eyes",
    "gbr_grey",
    { kind: "world", of: { is: "war_months", min: 5, max: 29 } },
    {
      open: node(
        [
          v("bad", { kind: "health", who: p, max: 1 }),
          v("after_salonika", seen("gbr_w_salonika")),
          v("cold", moody(p, "cold")),
          base,
        ],
        r("ask", "warm", "ask", [], [], "dark", {
          reacts: [straight("honest", remember("m_grey_eyes"))],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [promise(p, "p_grey_rest", 12, { keep: seen("gbr_h_vacant") })],
          "rest",
        ),
        r("work", "cold", "push", ["grey:-1"], [trustOf(p, -1)], "dark"),
        close("leave", "warm"),
      ),
      dark: plain(close("end", "warm")),
      honest: plain(
        r("who_next", "frank", "ask", [], [], "next_man"),
        close("end", "warm"),
      ),
      rest: plain(close("end", "warm")),
      next_man: plain(close("end", "cold")),
    },
    { once: false, cooldown: 8 },
  ),
  talk(
    "gbr_t_grey_house",
    "gbr_grey",
    all(
      { kind: "world", of: { is: "peace_months", min: 11, max: 23 } },
      not(atWar("USA")),
    ),
    {
      open: node(
        moods("weary"),
        r("what", "frank", "ask", [], [], "memo", {
          gain: [remember("k_grey_house")],
        }),
        r(
          "deal",
          "flatter",
          "deal",
          [],
          [
            remember("k_grey_house"),
            promise(p, "p_grey_house", 8, { keep: seen("gbr_f_house") }),
          ],
          "memo",
        ),
        r(
          "scorn",
          "cold",
          "push",
          ["grey:-1"],
          [trustOf(p, -1)],
          "memo_stiff",
          {
            gain: [remember("k_grey_house")],
            reacts: [
              {
                when: moody(p, "weary"),
                next: "memo",
                effects: [remember("k_grey_house"), reason("t_grey_house_r1")],
              },
            ],
          },
        ),
        close("leave", "cold"),
      ),
      memo: plain(
        r("trust", "frank", "ask", [], [], "wilson"),
        close("end", "warm"),
      ),
      memo_stiff: plain(close("end", "cold")),
      wilson: plain(close("end", "frank")),
    },
  ),

  // ---- The King ----
  talk("gbr_t_king_ulster", "gbr_george_v", chapters(0, 2), {
    open: node(
      moods("anxious"),
      r("listen", "warm", "ask", [], [], "worry", {
        gain: [remember("k_king_conf")],
      }),
      r(
        "deal",
        "flatter",
        "deal",
        ["king:+1"],
        [
          trustOf(p, 1),
          remember("k_king_conf"),
          promise(p, "p_king_conf", 3, { keep: seen("gbr_c_palace") }),
        ],
        "room",
      ),
      r("const", "cold", "push", ["king:-1"], [trustOf(p, -1)], "stiff", {
        reacts: [{ when: moody(p, "stubborn"), next: "row", effects: [] }],
      }),
      close("leave", "cold"),
    ),
    worry: plain(
      r("room", "warm", "ask", [], [], "room"),
      close("end", "warm"),
    ),
    room: plain(close("end", "warm")),
    stiff: plain(close("end", "warm")),
    row: plain(close("end", "cold")),
  }),
  talk("gbr_t_king_assent", "gbr_george_v", chapters(0, 2), {
    open: node(
      [v("anx", moody(p, "anxious")), v("told", trusted(p, 2)), base],
      r("ask", "frank", "ask", [], [], "hedge", {
        reacts: [straight("will", remember("m_king_assent"))],
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["king:+1"],
        [
          trustOf(p, 1),
          remember("m_king_assent"),
          promise(p, "p_king_warn", 6, { back: "gbr_v_stamfordham_note" }),
        ],
        "will",
      ),
      r("law", "cold", "push", ["king:-1"], [trustOf(p, -1)], "hurt", {
        gain: [remember("m_king_assent")],
      }),
      close("leave", "warm"),
    ),
    hedge: plain(close("end", "warm")),
    will: plain(
      r("carson", "frank", "ask", [], [], "said"),
      close("end", "warm"),
    ),
    hurt: plain(close("end", "cold")),
    said: plain(close("end", "frank")),
  }),
  talk("gbr_t_king_cousin", "gbr_george_v", all(late(3), hot), {
    open: node(
      moods("anxious"),
      r("ask", "frank", "ask", [], [], "vague", {
        reacts: [straight("said", remember("k_king_cousin"))],
      }),
      r(
        "deal",
        "warm",
        "deal",
        [],
        [
          remember("k_king_cousin"),
          promise(p, "p_king_letter", 2, { keep: flag("f_king_letter") }),
        ],
        "said",
      ),
      close("leave", "cold"),
    ),
    vague: plain(
      r("press", "cold", "push", ["king:-1"], [trustOf(p, -1)], "said", {
        gain: [remember("k_king_cousin")],
        miss: "cross",
      }),
      close("drop", "warm"),
    ),
    said: plain(close("end", "warm")),
    cross: plain(close("end", "cold")),
  }),
  talk(
    "gbr_t_king_pledge",
    "gbr_george_v",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 5, max: 11 } },
      inWar,
    ),
    {
      open: node(
        moods("stubborn"),
        r("why", "warm", "ask", [], [], "cellar", {
          gain: [remember("k_king_pledge")],
        }),
        r(
          "deal",
          "flatter",
          "deal",
          ["king:+1"],
          [
            trustOf(p, 1),
            remember("k_king_pledge"),
            promise(p, "p_king_pledge", 5, {
              keep: chose("gbr_h_pledge", "follow_king"),
            }),
          ],
          "glass",
        ),
        r("laugh", "frank", "push", ["king:-1"], [trustOf(p, -1)], "cellar", {
          gain: [remember("k_king_pledge")],
          reacts: [
            {
              when: moody(p, "stubborn"),
              next: "cross",
              effects: [trustOf(p, -1), reason("t_king_pledge_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      cellar: plain(close("end", "warm")),
      glass: plain(close("end", "warm")),
      cross: plain(close("end", "cold")),
    },
  ),
  talk(
    "gbr_t_king_letters",
    "gbr_george_v",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 11, max: 41 } },
      inWar,
    ),
    {
      open: node(
        [
          v("after_french", chose("gbr_w_french_out", "haig")),
          v("lg", flag("f_pm_lg")),
          v("anx", moody(p, "anxious")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "duty", {
          reacts: [
            straight(
              "haig",
              remember("k_king_letters"),
              act({ do: "reveal", id: "gbr_haig_letters" }),
            ),
          ],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_king_letters"),
            act({ do: "reveal", id: "gbr_haig_letters" }),
            promise(p, "p_king_haig", 8, { keep: seen("gbr_w_french_out") }),
          ],
          "haig",
        ),
        r("stop", "threat", "push", ["king:-2"], [trustOf(p, -2)], "wall"),
        close("leave", "cold"),
      ),
      duty: plain(close("end", "warm")),
      haig: plain(
        r("what", "frank", "ask", [], [], "says"),
        close("end", "warm"),
      ),
      says: plain(close("end", "cold")),
      wall: plain(close("end", "cold")),
    },
    { once: false, cooldown: 10 },
  ),
  talk(
    "gbr_t_king_tsar",
    "gbr_george_v",
    all(
      { kind: "world", of: { is: "war_months", min: 29, max: 35 } },
      world({ is: "regime", tag: "RUS", of: ["provisional", "rep", "soviet"] }),
    ),
    {
      open: node(
        moods("anxious"),
        r("ask", "frank", "ask", [], [], "cousin", {
          gain: [remember("k_king_tsar")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["king:+1"],
          [
            trustOf(p, 1),
            remember("k_king_tsar"),
            promise(p, "p_king_tsar", 4, { keep: seen("gbr_f_tsar") }),
          ],
          "cousin",
        ),
        r("no", "cold", "push", ["king:-1"], [trustOf(p, -1)], "letter", {
          reacts: [
            {
              when: moody(p, "anxious"),
              next: "cousin",
              effects: [remember("k_king_tsar"), reason("t_king_tsar_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      cousin: plain(close("end", "warm")),
      letter: plain(close("end", "cold")),
    },
  ),
  // ---- Carson ----
  talk("gbr_t_carson_clean", "gbr_carson", chapters(0, 3), {
    open: node(
      moods("arrogant", "weary"),
      r("ask", "frank", "ask", [], [], "which", {
        gain: [remember("k_car_clean")],
        miss: "cross",
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["carson:+1"],
        [
          trustOf(p, 1),
          remember("k_car_clean"),
          promise(p, "p_carson_line", 3, {
            keep: any(
              chose("gbr_c_amending", "clean_cut"),
              chose("gbr_c_palace", "offer_counties"),
              chose("gbr_c_tyrone", "tyrone_out"),
            ),
          }),
        ],
        "which",
      ),
      r("law", "threat", "push", ["carson:-1"], [trustOf(p, -1)], "cross", {
        reacts: [{ when: moody(p, "weary"), next: "worn", effects: [] }],
      }),
      close("leave", "cold"),
    ),
    which: plain(
      r("tyrone", "frank", "ask", [], [], "tyrone"),
      close("end", "cold"),
    ),
    cross: plain(close("end", "cold")),
    worn: plain(
      r("rest", "warm", "ask", [], [remember("k_car_clean")], "which"),
      close("end", "cold"),
    ),
    tyrone: plain(close("end", "frank")),
  }),
  talk("gbr_t_carson_rifles", "gbr_carson", chapters(0, 2), {
    open: node(
      moods("stubborn"),
      r("ask", "frank", "ask", [], [], "smile", {
        reacts: [straight("count", remember("m_rifles_heard"))],
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["carson:+1"],
        [
          trustOf(p, 1),
          remember("m_rifles_heard"),
          promise(p, "p_carson_no_force", 3, {
            keep: all(
              seen("gbr_c_amending"),
              not(chose("gbr_c_amending", "press_on")),
            ),
          }),
        ],
        "count",
      ),
      r("arrest", "threat", "push", ["carson:-2"], [trustOf(p, -2)], "dare"),
      close("leave", "cold"),
    ),
    smile: plain(close("end", "cold")),
    count: plain(r("use", "frank", "ask", [], [], "use"), close("end", "cold")),
    dare: plain(close("end", "cold")),
    use: plain(close("end", "frank")),
  }),
  talk(
    "gbr_t_carson_war",
    "gbr_carson",
    all(late(4), any(all(hot, tempMin(4)), inWar)),
    {
      open: node(
        moods("stubborn", "weary"),
        r("ask", "frank", "ask", [], [], "price", {
          gain: [remember("k_car_volunteers")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["carson:+1"],
          [
            trustOf(p, 1),
            remember("k_car_volunteers"),
            remember("v_home_rule", p),
            promise(p, "p_carson_div", 6, {
              keep: flag("f_ulster_division"),
            }),
          ],
          "men",
        ),
        r("king", "flatter", "push", [], [], "men", {
          gain: [remember("k_car_volunteers")],
          miss: "scorn",
          reacts: [
            {
              when: moody(p, "weary"),
              next: "scorn",
              effects: [reason("t_carson_war_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      price: plain(
        r("redmond", "frank", "ask", [], [], "redmond"),
        close("end", "cold"),
      ),
      men: plain(close("end", "warm")),
      scorn: plain(close("end", "cold")),
      redmond: plain(close("end", "frank")),
    },
  ),
  talk(
    "gbr_t_carson_office",
    "gbr_carson",
    all(
      { kind: "world", of: { is: "war_months", own: true, min: 5, max: 17 } },
      inWar,
    ),
    {
      open: node(
        moods("arrogant"),
        r("ask", "frank", "ask", [], [], "terms", {
          gain: [remember("k_car_office")],
        }),
        r(
          "deal",
          "flatter",
          "deal",
          ["carson:+1"],
          [
            trustOf(p, 1),
            remember("k_car_office"),
            promise(p, "p_carson_seat", 6, {
              keep: chose("gbr_h_seats", "carson_in"),
            }),
          ],
          "terms",
        ),
        r("ireland", "cold", "push", ["carson:-1"], [trustOf(p, -1)], "ire", {
          reacts: [
            {
              when: moody(p, "weary"),
              next: "terms",
              effects: [remember("k_car_office"), reason("t_carson_office_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      terms: plain(close("end", "frank")),
      ire: plain(close("end", "cold")),
    },
  ),
  talk(
    "gbr_t_carson_serbia",
    "gbr_carson",
    all(
      { kind: "world", of: { is: "war_months", min: 11, max: 17 } },
      world({ is: "entered", tag: "BGR" }),
    ),
    {
      open: node(
        moods("stubborn", "arrogant"),
        r("ask", "frank", "ask", [], [], "cross", {
          gain: [remember("k_car_serbia")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_car_serbia"),
            promise(p, "p_carson_serbia", 3, {
              keep: chose("gbr_w_salonika", "send_division"),
            }),
          ],
          "stay",
        ),
        r("west", "cold", "push", ["carson:-1"], [trustOf(p, -1)], "cross", {
          gain: [remember("k_car_serbia")],
          reacts: [
            {
              when: moody(p, "stubborn"),
              next: "letter",
              effects: [reason("t_carson_serbia_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      cross: plain(close("end", "cold")),
      stay: plain(close("end", "warm")),
      letter: plain(close("end", "cold")),
    },
  ),
  talk(
    "gbr_t_carson_lastword",
    "gbr_carson",
    all({ kind: "world", of: { is: "war_months", min: 17, max: 41 } }, not(hr)),
    {
      open: node(
        [
          v("broken", memory("broke_p_carson_no_force")),
          v("easter", seen("gbr_h_easter")),
          v("worn", moody(p, "weary")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "no", {
          gain: [remember("k_car_lastword")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_car_lastword"),
            promise(p, "p_carson_law", 8, {
              keep: chose("gbr_h_ireland_talks", "lloyd_george_terms"),
            }),
          ],
          "line",
        ),
        r("somme", "frank", "push", [], [], "dead", {
          reacts: [{ when: moody(p, "arrogant"), next: "no", effects: [] }],
          gain: [remember("k_car_lastword")],
        }),
        close("leave", "cold"),
      ),
      no: plain(close("end", "cold")),
      line: plain(close("end", "frank")),
      dead: plain(close("end", "warm")),
    },
    { once: false, cooldown: 8 },
  ),

  // ---- Redmond ----
  talk("gbr_t_redmond_counties", "gbr_redmond", chapters(0, 3), {
    open: node(
      moods("anxious", "weary"),
      r("ask", "frank", "ask", [], [], "hedge", {
        reacts: [straight("four", remember("k_red_counties"))],
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["redmond:+1"],
        [
          trustOf(p, 1),
          remember("k_red_counties"),
          promise(p, "p_redmond_four", 4, {
            keep: all(
              from(3),
              not(chose("gbr_c_amending", "clean_cut")),
              not(chose("gbr_c_tyrone", "tyrone_out")),
            ),
          }),
        ],
        "four",
      ),
      r("votes", "threat", "push", ["redmond:-1"], [trustOf(p, -1)], "wound", {
        gain: [remember("k_red_counties")],
      }),
      close("leave", "warm"),
    ),
    hedge: plain(
      r("again", "warm", "ask", [], [], "four", {
        gain: [remember("k_red_counties")],
      }),
      close("drop", "warm"),
    ),
    four: plain(
      r("dublin", "frank", "ask", [], [], "dublin"),
      close("end", "warm"),
    ),
    wound: plain(close("end", "cold")),
    dublin: plain(close("end", "warm")),
  }),
  talk("gbr_t_redmond_volunteers", "gbr_redmond", chapters(0, 3), {
    open: node(
      moods("stubborn"),
      r("ask", "frank", "ask", [], [], "proud", {
        reacts: [straight("thin", remember("m_volunteers_thin"))],
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["irish:+1"],
        [
          irish(1),
          remember("m_volunteers_thin"),
          promise(p, "p_redmond_castle", 10, {
            keep: any(flag("f_act_suspended"), hr),
          }),
        ],
        "thin",
      ),
      r("rifles", "cold", "push", ["redmond:-1"], [trustOf(p, -1)], "proud"),
      close("leave", "warm"),
    ),
    proud: plain(close("end", "warm")),
    thin: plain(r("who", "frank", "ask", [], [], "who"), close("end", "warm")),
    who: plain(close("end", "warm")),
  }),
  talk("gbr_t_redmond_speech", "gbr_redmond", all(late(4), hot, tempMin(4)), {
    open: node(
      moods("anxious"),
      r("ask", "frank", "ask", [], [], "think", {
        gain: [remember("k_red_speech")],
      }),
      r(
        "deal",
        "warm",
        "deal",
        ["irish:+1"],
        [
          irish(1),
          remember("k_red_speech"),
          promise(p, "p_redmond_act", 6, {
            keep: any(flag("f_act_suspended"), hr),
          }),
        ],
        "offer",
      ),
      r("flatter", "flatter", "push", [], [], "offer", {
        gain: [remember("k_red_speech")],
        miss: "think",
        reacts: [
          {
            when: moody(p, "anxious"),
            next: "think",
            effects: [reason("t_redmond_speech_r1")],
          },
        ],
      }),
      close("leave", "warm"),
    ),
    think: plain(close("end", "warm")),
    offer: plain(
      r("dillon", "frank", "ask", [], [], "dillon"),
      close("end", "warm"),
    ),
    dillon: plain(close("end", "frank")),
  }),
  talk(
    "gbr_t_redmond_division",
    "gbr_redmond",
    all({ kind: "world", of: { is: "war_months", own: true, max: 17 } }, inWar),
    {
      open: node(
        moods("weary"),
        r("ask", "frank", "ask", [], [], "badge", {
          gain: [remember("k_red_division")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["irish:+1"],
          [
            irish(1),
            remember("k_red_division"),
            promise(p, "p_redmond_badge", 14, {
              keep: chose("gbr_h_irish_division", "keep_word"),
              back: "gbr_v_redmond_badge",
            }),
          ],
          "word",
        ),
        r(
          "army",
          "cold",
          "push",
          ["redmond:-1"],
          [trustOf(p, -1)],
          "kitchener",
          {
            gain: [remember("k_red_division")],
            reacts: [
              {
                when: moody(p, "stubborn"),
                next: "kitchener",
                effects: [irish(-1), reason("t_redmond_division_r1")],
              },
            ],
          },
        ),
        close("leave", "cold"),
      ),
      badge: plain(close("end", "warm")),
      word: plain(close("end", "warm")),
      kitchener: plain(close("end", "cold")),
    },
  ),
  talk(
    "gbr_t_redmond_amnesty",
    "gbr_redmond",
    all(
      { kind: "world", of: { is: "war_months", min: 17, max: 23 } },
      seen("gbr_h_easter"),
    ),
    {
      open: node(
        moods("weary", "anxious"),
        r("ask", "warm", "ask", [], [], "dublin", {
          gain: [remember("k_red_amnesty")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_red_amnesty"),
            promise(p, "p_redmond_mercy", 3, {
              keep: chose("gbr_h_stop", "amnesty_word"),
            }),
          ],
          "ask_it",
        ),
        r("order", "cold", "push", ["redmond:-1"], [trustOf(p, -1)], "gone", {
          reacts: [
            {
              when: moody(p, "anxious"),
              next: "dublin",
              effects: [
                remember("k_red_amnesty"),
                reason("t_redmond_amnesty_r1"),
              ],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      dublin: plain(close("end", "warm")),
      ask_it: plain(close("end", "warm")),
      gone: plain(close("end", "cold")),
    },
  ),
  talk(
    "gbr_t_redmond_convention",
    "gbr_redmond",
    all({ kind: "world", of: { is: "war_months", min: 23, max: 41 } }, not(hr)),
    {
      open: node(
        [
          v("badge", memory("broke_p_redmond_badge")),
          v("easter", seen("gbr_h_easter")),
          v("weary", moody(p, "weary")),
          base,
        ],
        r("ask", "frank", "ask", [], [], "table", {
          gain: [remember("k_red_convention")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_red_convention"),
            promise(p, "p_redmond_table", 6, {
              keep: chose("gbr_h_ireland_talks", "convention"),
            }),
          ],
          "last",
        ),
        r("sinn", "cold", "push", ["redmond:-1"], [trustOf(p, -1)], "young", {
          reacts: [
            {
              when: moody(p, "stubborn"),
              next: "table",
              effects: [
                remember("k_red_convention"),
                reason("t_redmond_convention_r1"),
              ],
            },
          ],
        }),
        close("leave", "warm"),
      ),
      table: plain(close("end", "warm")),
      last: plain(close("end", "warm")),
      young: plain(close("end", "cold")),
    },
    { once: false, cooldown: 8 },
  ),

  // ---- Visits ----
  visit(
    "gbr_v_lichnowsky_tears",
    "deu_lichnowsky",
    all(late(4), hot, tempMin(4)),
    6,
    ["foreign", "people"],
    {
      open: node(
        moods("anxious", "arrogant"),
        r("hear", "warm", "ask", [], [], "plea", {
          gain: [remember("k_lich_last")],
        }),
        r(
          "deal",
          "frank",
          "deal",
          ["deu:+1", "fra:-1"],
          [
            trust("DEU", 1),
            trust("FRA", -1),
            remember("k_lich_last"),
            setFlag("f_lich_understanding"),
            promise(p, "p_lich_word", 2, { keep: flag("f_last_word") }),
          ],
          "paper",
        ),
        r("belgium", "cold", "push", ["deu:-1"], [trust("DEU", -1)], "pale", {
          reacts: [
            {
              when: moody(p, "stubborn"),
              next: "unread",
              effects: [remember("k_lich_last"), reason("t_lichnowsky_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      plea: plain(
        r("berlin", "frank", "ask", [], [], "unread"),
        close("end", "warm"),
      ),
      paper: plain(close("end", "cold")),
      pale: plain(close("end", "cold")),
      unread: plain(close("end", "warm")),
    },
  ),
  visit(
    "gbr_v_morley_letter",
    "gbr_morley",
    all(late(4), hot, tempMin(4)),
    6,
    ["people", "home"],
    {
      open: node(
        moods("stubborn"),
        r("read", "warm", "ask", [], [], "why", {
          gain: [remember("k_morley_stay"), remember("v_entry", p)],
        }),
        r(
          "deal",
          "warm",
          "deal",
          ["morley:+1"],
          [
            trustOf(p, 1),
            remember("k_morley_stay"),
            remember("v_entry", p),
            promise(p, "p_morley_wait", 2, {
              keep: chose("gbr_c_cabinet_two", "keep_morley"),
            }),
          ],
          "wait",
        ),
        r("old", "frank", "push", [], [], "why", {
          gain: [remember("k_morley_stay")],
          miss: "gladstone",
          reacts: [
            {
              when: moody(p, "stubborn"),
              next: "gladstone",
              effects: [reason("t_morley_r1")],
            },
          ],
        }),
        close("leave", "cold"),
      ),
      why: plain(close("end", "warm")),
      wait: plain(close("end", "warm")),
      gladstone: plain(close("end", "cold")),
    },
  ),
  visit("gbr_v_haldane_army", "gbr_haldane", chapters(1, 5), 5, ["people"], {
    open: node(
      moods("weary"),
      r("hear", "warm", "ask", [], [], "table", {
        gain: [remember("k_hal_army"), remember("v_entry", p)],
      }),
      r(
        "deal",
        "warm",
        "deal",
        [],
        [
          remember("k_hal_army"),
          remember("v_entry", p),
          promise(p, "p_haldane_first", 8, {
            keep: any(
              chose("gbr_c_war_office_held", "give_haldane"),
              chose("gbr_c_war_office", "haldane"),
              seen("gbr_c_war_office"),
            ),
          }),
        ],
        "first",
      ),
      r(
        "germany",
        "cold",
        "push",
        ["haldane:-1"],
        [trustOf(p, -1)],
        "explains",
        {
          gain: [remember("k_hal_army")],
          reacts: [
            {
              when: moody(p, "cold"),
              next: "table",
              effects: [remember("k_hal_army"), reason("t_haldane_r1")],
            },
          ],
        },
      ),
      close("leave", "cold"),
    ),
    table: plain(close("end", "warm")),
    first: plain(close("end", "warm")),
    explains: plain(close("end", "cold")),
  }),
  visit(
    "gbr_v_birrell_warn",
    "gbr_birrell",
    all(
      { kind: "world", of: { is: "war_months", min: 11, max: 23 } },
      irishPress(3),
      not(hr),
    ),
    6,
    ["home", "people"],
    {
      open: node(
        moods("weary"),
        r("ask", "frank", "ask", [], [], "joke", {
          reacts: [straight("sober", remember("k_birrell_dublin"))],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("k_birrell_dublin"),
            promise(p, "p_birrell_castle", 8, {
              keep: chose("gbr_h_easter", "castle_ready"),
            }),
          ],
          "sober",
        ),
        r("london", "cold", "push", ["ireland:-1"], [trustOf(p, -1)], "joke", {
          gain: [remember("k_birrell_dublin")],
        }),
        close("leave", "warm"),
      ),
      joke: plain(close("end", "warm")),
      sober: plain(close("end", "warm")),
    },
  ),
  visit(
    "gbr_v_goschen_home",
    "gbr_goschen",
    all({ kind: "world", of: { is: "war_months", own: true, max: 17 } }, inWar),
    5,
    ["people", "foreign"],
    {
      open: node(
        moods("weary"),
        r("day", "warm", "ask", [], [], "paper", {
          gain: [remember("m_scrap_of_paper")],
        }),
        r(
          "deal",
          "warm",
          "deal",
          [],
          [
            remember("m_scrap_of_paper"),
            promise(p, "p_goschen_paper", 3, { keep: from(7) }),
          ],
          "publish",
        ),
        r("failed", "cold", "push", ["goschen:-1"], [trustOf(p, -1)], "stiff", {
          reacts: [
            {
              when: moody(p, "weary"),
              next: "paper",
              effects: [remember("m_scrap_of_paper"), reason("t_goschen_r1")],
            },
          ],
        }),
        close("leave", "warm"),
      ),
      paper: plain(
        r("bethmann", "frank", "ask", [], [], "man"),
        close("end", "warm"),
      ),
      publish: plain(close("end", "warm")),
      stiff: plain(close("end", "cold")),
      man: plain(close("end", "warm")),
    },
  ),
];

/** ww187: what a scene's text takes for granted (the builder takes no tags). */
const ASSUMES: Readonly<Record<string, GwAssumes>> = {
  gbr_c_war_office: { active: ["gbr_kitchener"] },
  gbr_c_war_office_held: { active: ["gbr_kitchener"] },
  // "a question in the House": it sits.
  gbr_c_naval_talks: { sits: ["commons"] },
};

export const GBR_CRISIS_SCENES: readonly GwScene[] = CRISIS_SCENES.map((s) =>
  ASSUMES[s.id] === undefined ? s : { ...s, assumes: ASSUMES[s.id] },
);
