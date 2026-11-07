import type {
  GwPersonDef,
  GwStage,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  byName,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwReact,
  GwReply,
  GwReplyKind,
  GwScene,
  GwStance,
  GwVariant,
  memory,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { period, sinceChapter } from "./period";

/**
 * 「영국」, people's private stories: ten lines in the Prime Minister's circle,
 * four to six scenes each, outside work. Tag `private`: summoned ones belong to
 * the private meeting of the chapter (the DEU lane builds the slot), the others
 * are dealt, as a death or a letter is. Data only; the text is in
 * GBR.private.json. Keys of a line start `m_p_<line>`.
 *
 * All of it is Asquith's life, so every scene closes under `f_pm_lg`.
 *
 * `withGbrPrivate` is the way back into work: what happened here is said in
 * the work talks, by variants added to their nodes. Their text sits with the
 * scene it belongs to, in the GBR packs, as gbr_more's does.
 *
 * Facts: /home/eser/dev/ww143-report-gbr.md.
 */

const NATION: GwScene["nation"] = ["GBR"];
const who = role("who");

const CRISIS: GwStage[] = ["crisis"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR: GwStage[] = ["war"];

const during = period;
const since = sinceChapter;
const chapter = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
/** Two dates, YYYY-MM, on any calendar. */
const between = (from: string, to: string): GwCond => ({
  kind: "world",
  of: { is: "date", from, to },
});

const notLg = not(flag("f_pm_lg"));
const war: GwCond = { kind: "at_war", tag: "DEU" };
const co = flag("f_coalition");
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const raymond = seen("gbr_h_raymond");
const easter = seen("gbr_h_easter");
/** The person holds it against the seat. */
const cold: GwCond = { kind: "person_trust", who, max: -1 };
const warm: GwCond = { kind: "person_trust", who, min: 2 };

const opposition = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "opposition",
  delta,
});
const cabinet = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "cabinet",
  delta,
});
const ireland = (delta: number): GwEffect => ({
  kind: "pressure",
  topic: "ireland",
  delta,
});
const trust = (delta: number): GwEffect => trustOf(who, delta);
const paid = (delta: number) => `trust:${delta > 0 ? "+" : ""}${delta}`;

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const says = (...ids: (string | [string, GwCond])[]): GwVariant[] =>
  ids.map((x) => (typeof x === "string" ? v(x) : v(x[0], x[1])));
const base = says("base");

interface ReplyMore {
  tell?: string[];
  effects?: GwEffect[];
  when?: GwCond;
  reacts?: GwReact[];
}

const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  more: ReplyMore = {},
): GwReply => ({
  id,
  stance,
  kind,
  tell: more.tell ?? [],
  effects: more.effects ?? [],
  next,
  ...(more.when === undefined ? {} : { when: more.when }),
  ...(more.reacts === undefined ? {} : { reacts: more.reacts }),
});
/** An ending: the line remembers it, and the person, by `d`. */
const end = (
  id: string,
  stance: GwStance,
  d: number,
  ...keys: string[]
): GwReply =>
  r(id, stance, "leave", null, {
    tell: d === 0 ? [] : [paid(d)],
    effects: [...(d === 0 ? [] : [trust(d)]), ...keys.map((k) => remember(k))],
  });
const node = (list: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says: list,
  replies,
});
const react = (when: GwCond, next: string | null): GwReact => ({
  when,
  next,
  effects: [],
});

interface More {
  intro?: GwVariant[];
  starts?: Record<string, string>;
  cooldown?: number;
}

const talkOf = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: More,
) => ({
  id,
  nation: NATION,
  kind: "talk" as const,
  stage,
  when: all(notLg, when),
  cast: { who: { person } },
  tags: ["people" as const, "private" as const],
  who: "who",
  variants: more.intro ?? base,
  start: "open",
  nodes,
  ...(more.starts === undefined ? {} : { starts: more.starts }),
  ...(more.cooldown === undefined
    ? { once: true }
    : { cooldown: more.cooldown }),
});

/** A topic of the private meeting. */
const meet = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: More = {},
): GwScene => ({
  ...talkOf(id, person, stage, when, nodes, more),
  salience: 2,
  summon: true,
});

/** It comes by itself: a death, a letter, someone at the door. */
const comes = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  salience: number,
  nodes: Record<string, GwNode>,
  more: More = {},
): GwScene => ({
  ...talkOf(id, person, stage, when, nodes, more),
  salience,
});

// ---- 1. 그레이: 눈, 그리고 도로시 ----

const greyRead = memory("m_p_grey_read");
const greyStar = memory("m_p_grey_star");
const greyKept = memory("m_p_grey_kept_sunday");
const greyNoRest = memory("m_p_grey_no_rest");

const GREY: readonly GwScene[] = [
  meet("gbr_p_grey_wagoner", "gbr_grey", CRISIS, chapter(0, 3), {
    open: node(
      says(["cold", cold], "base"),
      r("ask", "frank", "ask", "what", {
        effects: [remember("m_p_grey_told")],
      }),
      r("may", "warm", "ask", "what", {
        effects: [remember("m_p_grey_told")],
      }),
      end("ducks", "warm", 0),
    ),
    what: node(
      base,
      r("go_now", "warm", "deal", "go", {
        tell: [paid(1)],
        effects: [trust(1)],
      }),
      r("when", "frank", "ask", "star"),
      r("keep", "cold", "deal", "keep", {
        effects: [remember("m_p_grey_secret")],
      }),
    ),
    star: node(
      base,
      end("look", "warm", 1, "m_p_grey_star"),
      r("go_now", "warm", "deal", "go", {
        tell: [paid(1)],
        effects: [trust(1), remember("m_p_grey_star")],
      }),
    ),
    go: node(base, end("end", "warm", 0)),
    keep: node(base, end("end", "cold", 0)),
  }),
  comes(
    "gbr_p_grey_sunday",
    "gbr_grey",
    CRISIS,
    all(chapter(3, 4), { kind: "crisis", topic: "balkan" }),
    5,
    {
      open: node(
        says(["cold", cold], "base"),
        r("go", "warm", "leave", null, {
          tell: [paid(1)],
          effects: [
            trust(1),
            remember("m_p_grey_sunday"),
            reason("p_grey_sunday"),
          ],
        }),
        r("stay", "cold", "push", "stay", {
          tell: [paid(-1), "temp:-1"],
          effects: [
            trust(-1),
            { kind: "temp", delta: -1 },
            remember("m_p_grey_kept_sunday"),
          ],
        }),
        r("who", "frank", "ask", "whom"),
      ),
      whom: node(
        base,
        r("go", "warm", "leave", null, {
          tell: [paid(1)],
          effects: [
            trust(1),
            remember("m_p_grey_sunday"),
            reason("p_grey_sunday"),
          ],
        }),
        r("stay", "cold", "push", "stay", {
          tell: [paid(-1), "temp:-1"],
          effects: [
            trust(-1),
            { kind: "temp", delta: -1 },
            remember("m_p_grey_kept_sunday"),
          ],
        }),
      ),
      stay: node(base, end("end", "warm", 0)),
    },
  ),
  meet(
    "gbr_p_grey_book",
    "gbr_grey",
    Y14_ON,
    since(6, "15b"),
    {
      open: node(
        says(["cold", cold], ["war", war], "base"),
        r("read", "warm", "deal", "page", { reacts: [react(cold, "shut")] }),
        r("why", "frank", "ask", "why"),
        end("leave", "warm", 0),
      ),
      why: node(
        base,
        r("read", "warm", "deal", "page"),
        end("leave", "warm", 0),
      ),
      page: node(base, r("line1", "warm", "ask", "page2")),
      page2: node(
        base,
        r("line2", "warm", "ask", "page3"),
        end("stop", "frank", 1, "m_p_grey_read"),
      ),
      page3: node(
        base,
        end("again", "warm", 2, "m_p_grey_read"),
        end("close", "warm", 1, "m_p_grey_read"),
      ),
      shut: node(base, end("end", "cold", 0)),
    },
    { intro: says(["night2", cold], "base") },
  ),
  comes("gbr_p_grey_six_weeks", "gbr_grey", WAR, during("15a", "15b"), 5, {
    open: node(
      says(["read", greyRead], ["kept", greyKept], "base"),
      r("rest", "warm", "deal", "rest", {
        tell: [paid(1)],
        effects: [trust(1), remember("m_p_grey_rested")],
      }),
      r("stay", "frank", "push", "stay", {
        tell: [paid(-1), "fra:+1"],
        effects: [
          trust(-1),
          { kind: "trust", tag: "FRA", delta: 1 },
          remember("m_p_grey_no_rest"),
        ],
      }),
      r("ask", "frank", "ask", "his"),
    ),
    his: node(
      base,
      r("rest", "warm", "deal", "rest", {
        tell: [paid(1)],
        effects: [trust(1), remember("m_p_grey_rested")],
      }),
      r("stay", "frank", "push", "stay", {
        tell: [paid(-1), "fra:+1"],
        effects: [
          trust(-1),
          { kind: "trust", tag: "FRA", delta: 1 },
          remember("m_p_grey_no_rest"),
        ],
      }),
    ),
    rest: node(base, end("end", "warm", 0)),
    stay: node(base, end("end", "frank", 0)),
  }),
  comes("gbr_p_grey_fire", "gbr_grey", WAR, between("1917-05", "1917-09"), 5, {
    open: node(
      says(["read", greyRead], ["cold", cold], "base"),
      r("book", "warm", "ask", "book", { when: greyRead }),
      r("books", "frank", "ask", "books"),
      end("sorry", "warm", 1),
    ),
    book: node(base, end("end", "warm", 1)),
    books: node(base, end("end", "warm", 0)),
  }),
  meet(
    "gbr_p_grey_gravel",
    "gbr_grey",
    WAR,
    during("18a", "18b"),
    {
      open: node(
        says(["star", greyStar], ["no_rest", greyNoRest], "base"),
        r("see", "warm", "ask", "seen"),
        r("nosee", "frank", "ask", "both"),
      ),
      seen: node(base, end("end", "warm", 1, "m_p_grey_end")),
      both: node(base, end("end", "frank", 1, "m_p_grey_end")),
      letter: node(base, end("end", "warm", 0)),
    },
    {
      intro: says(["letter", any(cold, all(greyKept, greyNoRest))], "base"),
      starts: { letter: "letter" },
    },
  ),
];

// ---- 2. 홀데인: 가장 오랜 벗 ----

const halNote = memory("m_p_hal_note");
const halKept = flag("f_gbr_haldane_kept");

const haldaneOut = (id: string): GwReply => end(id, "cold", -2, "m_p_hal_note");

const HALDANE: readonly GwScene[] = [
  meet("gbr_p_hal_hampstead", "gbr_haldane", CRISIS, chapter(0, 4), {
    open: node(
      base,
      r("hear", "warm", "ask", "helen"),
      end("stop", "cold", -1, "m_p_hal_shut"),
      r("margot", "frank", "ask", "margot"),
    ),
    helen: node(
      base,
      r("arran", "frank", "ask", "arran"),
      end("end", "warm", 1, "m_p_hal_helen"),
    ),
    arran: node(base, end("end", "warm", 2, "m_p_hal_helen")),
    margot: node(base, end("end", "warm", 0)),
  }),
  meet("gbr_p_hal_basket", "gbr_haldane", Y14_ON, all(war, since(6, "15a")), {
    open: node(
      says(["helen", memory("m_p_hal_helen")], "base"),
      r("papers", "warm", "deal", "papers", {
        tell: [paid(1), "grey:-1"],
        effects: [
          trust(1),
          trustOf(byName("gbr_grey"), -1),
          remember("m_p_hal_papers"),
        ],
      }),
      r("speak", "warm", "deal", "speak", {
        tell: [paid(1), "opposition:+1"],
        effects: [trust(1), opposition(1), remember("m_p_hal_defended")],
      }),
      end("wait", "cold", -1, "m_p_hal_wait"),
      r("mother", "frank", "ask", "mother"),
    ),
    mother: node(
      base,
      r("papers", "warm", "deal", "papers", {
        tell: [paid(1), "grey:-1"],
        effects: [
          trust(1),
          trustOf(byName("gbr_grey"), -1),
          remember("m_p_hal_papers"),
        ],
      }),
      r("speak", "warm", "deal", "speak", {
        tell: [paid(1), "opposition:+1"],
        effects: [trust(1), opposition(1), remember("m_p_hal_defended")],
      }),
      end("wait", "cold", -1, "m_p_hal_wait"),
    ),
    papers: node(base, end("end", "warm", 0)),
    speak: node(base, end("end", "warm", 0)),
  }),
  meet("gbr_p_hal_relugas", "gbr_haldane", Y14_ON, all(war, since(7, "15a")), {
    open: node(
      says(["cold", cold], "base"),
      r("reason", "frank", "ask", "reason"),
      r("said", "warm", "ask", "said", {
        tell: [paid(1)],
        effects: [trust(1), remember("m_p_hal_relugas")],
      }),
      end("old", "cold", -1),
    ),
    reason: node(base, end("end", "frank", 0)),
    said: node(base, end("end", "warm", 0)),
  }),
  comes(
    "gbr_p_hal_everything",
    "gbr_haldane",
    WAR,
    all(co, during("15a", "15b")),
    7,
    {
      open: node(
        says(["cold", cold], ["relugas", memory("m_p_hal_relugas")], "base"),
        r("keep", "frank", "deal", "keep"),
        r("say", "warm", "deal", "said", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_hal_said")],
        }),
        haldaneOut("note"),
        r("listen", "frank", "ask", "owe"),
      ),
      owe: node(
        base,
        r("say", "warm", "deal", "said", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_hal_said")],
        }),
        haldaneOut("note"),
        r("keep", "frank", "deal", "keep"),
      ),
      keep: node(
        base,
        r("hold", "warm", "leave", null, {
          tell: [paid(2), "opposition:+2"],
          effects: [
            trust(2),
            opposition(2),
            trustOf(byName("gbr_bonar_law"), -1),
            setFlag("f_gbr_haldane_kept"),
            reason("p_hal_kept"),
          ],
        }),
        r("give", "warm", "deal", "said", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_hal_said")],
        }),
      ),
      said: node(base, end("end", "warm", 0)),
    },
  ),
  meet(
    "gbr_p_hal_dinner",
    "gbr_haldane",
    WAR,
    all(seen("gbr_p_hal_everything"), during("15b", "16b")),
    {
      open: node(
        base,
        r("who", "frank", "ask", "who"),
        end("deny", "cold", -1),
        end("thanks", "warm", 1),
      ),
      who: node(
        base,
        end("end", "frank", 1, "m_p_hal_warned"),
        r("fear", "frank", "ask", "fear", {
          effects: [remember("m_p_hal_warned")],
        }),
      ),
      fear: node(base, end("end", "warm", 2)),
      kept_open: node(
        base,
        end("lock", "warm", 1),
        r("take", "frank", "deal", "taken", {
          tell: ["opposition:-2"],
          effects: [
            opposition(-2),
            { kind: "unflag", flag: "f_gbr_haldane_kept" },
            remember("m_p_hal_said"),
          ],
        }),
        r("who", "frank", "ask", "who"),
      ),
      taken: node(base, end("end", "warm", 0)),
      note_open: node(
        base,
        r("go", "warm", "deal", "late", {
          tell: [paid(1)],
          effects: [trust(1), { kind: "forget", key: "m_p_hal_note" }],
        }),
        end("leave", "cold", 0),
      ),
      late: node(base, r("who", "frank", "ask", "who"), end("end", "warm", 0)),
    },
    {
      intro: says(["kept", halKept], ["note", halNote], "base"),
      starts: { kept: "kept_open", note: "note_open" },
    },
  ),
  comes(
    "gbr_p_hal_laces",
    "gbr_haldane",
    WAR,
    all(raymond, during("16b", "17a")),
    5,
    {
      open: node(
        base,
        end("stay", "warm", 2, "m_p_hal_sat"),
        end("helen", "frank", 2, "m_p_hal_sat"),
      ),
      card: node(base, end("write", "warm", 1), end("pile", "cold", 0)),
    },
    { intro: says(["card", halNote], "base"), starts: { card: "card" } },
  ),
];

// ---- 3. 비렐과 엘리너 ----

const birStayed = memory("m_p_bir_stayed");
const birSent = memory("m_p_bir_sent");

const BIRRELL: readonly GwScene[] = [
  meet("gbr_p_bir_tennyson", "gbr_birrell", CRISIS, chapter(0, 5), {
    open: node(
      says(["warm", warm], "base"),
      r("ask", "frank", "ask", "how"),
      r("off", "warm", "deal", "off", {
        tell: [paid(1), "ireland:+1"],
        effects: [trust(1), ireland(1), remember("m_p_bir_home")],
      }),
      end("joke", "cold", 0, "m_p_bir_joked"),
    ),
    how: node(
      base,
      r("off", "warm", "deal", "off", {
        tell: [paid(1), "ireland:+1"],
        effects: [trust(1), ireland(1), remember("m_p_bir_home")],
      }),
      r("resign", "frank", "deal", "resign"),
    ),
    off: node(base, end("end", "warm", 0)),
    resign: node(base, end("end", "warm", 1)),
  }),
  comes("gbr_p_bir_winter", "gbr_birrell", Y14_ON, since(8, "15a"), 4, {
    open: node(
      says(["home", memory("m_p_bir_home")], "base"),
      r("stay", "warm", "deal", "stay", {
        tell: [paid(1), "ireland:+1"],
        effects: [trust(1), ireland(1), remember("m_p_bir_stayed")],
      }),
      r("go", "cold", "push", "go", {
        tell: [paid(-1), "ireland:-1"],
        effects: [trust(-1), ireland(-1), remember("m_p_bir_sent")],
      }),
      r("truth", "frank", "ask", "truth"),
    ),
    truth: node(
      base,
      r("stay", "warm", "deal", "stay", {
        tell: [paid(1), "ireland:+1"],
        effects: [trust(1), ireland(1), remember("m_p_bir_stayed")],
      }),
      r("go", "cold", "push", "go", {
        tell: [paid(-1), "ireland:-1"],
        effects: [trust(-1), ireland(-1), remember("m_p_bir_sent")],
      }),
    ),
    stay: node(base, end("end", "warm", 0)),
    go: node(base, end("end", "cold", 0)),
  }),
  comes(
    "gbr_p_bir_march",
    "gbr_birrell",
    WAR,
    between("1915-01", "1915-04"),
    6,
    {
      open: node(
        base,
        r("go", "warm", "deal", "funeral", {
          tell: [paid(2), "cabinet:-1"],
          effects: [trust(2), cabinet(-1), remember("m_p_bir_funeral")],
        }),
        end("write", "warm", 1, "m_p_bir_wrote"),
        end("none", "cold", -1, "m_p_bir_noword"),
      ),
      funeral: node(base, end("end", "warm", 0)),
    },
    { intro: says(["sent", birSent], "base") },
  ),
  meet(
    "gbr_p_bir_evening",
    "gbr_birrell",
    WAR,
    all(seen("gbr_p_bir_march"), between("1915-05", "1916-03")),
    {
      open: node(
        says(
          ["funeral", memory("m_p_bir_funeral")],
          ["noword", memory("m_p_bir_noword")],
          "base",
        ),
        r("count", "frank", "deal", "count", {
          effects: [remember("k_birrell_dublin")],
        }),
        r("dine", "warm", "deal", "dine", {
          tell: [paid(1)],
          effects: [trust(1)],
        }),
        r("book", "warm", "ask", "book"),
      ),
      book: node(
        base,
        r("count", "frank", "deal", "count", {
          effects: [remember("k_birrell_dublin")],
        }),
        r("dine", "warm", "deal", "dine", {
          tell: [paid(1)],
          effects: [trust(1)],
        }),
      ),
      count: node(base, end("end", "warm", 0)),
      dine: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_bir_lyrics",
    "gbr_birrell",
    WAR,
    all(during("16a", "16b"), any(easter, flag("f_home_rule_lives"))),
    6,
    {
      open: node(
        says(
          ["quiet", not(easter)],
          ["stayed", birStayed],
          ["sent", birSent],
          "base",
        ),
        r("accept", "warm", "deal", "book", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_bir_end")],
        }),
        r("refuse", "frank", "push", "refused"),
        end("blame", "cold", -2, "m_p_bir_end"),
      ),
      book: node(base, end("end", "warm", 0)),
      refused: node(
        base,
        r("accept", "warm", "deal", "book", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_bir_end")],
        }),
      ),
    },
    { intro: says(["quiet", not(easter)], "base") },
  ),
];

// ---- 4. 바텐베르크 왕자 ----

const louisOut = not({
  kind: "holder",
  office: "sea_lord",
  person: "gbr_battenberg",
});

const LOUIS: readonly GwScene[] = [
  meet("gbr_p_louis_cards", "gbr_battenberg", CRISIS, chapter(3, 5), {
    open: node(
      base,
      r("who", "frank", "ask", "who"),
      end("joke", "warm", 1),
      end("work", "cold", 0),
    ),
    who: node(base, end("end", "warm", 1, "m_p_louis_not_asked")),
  }),
  meet(
    "gbr_p_louis_osborne",
    "gbr_battenberg",
    Y14_ON,
    all(war, since(6, "14")),
    {
      open: node(
        says(["cold", cold], "base"),
        r("boy", "warm", "ask", "boy"),
        r("press", "warm", "deal", "press", {
          tell: [paid(1), "opposition:+1"],
          effects: [trust(1), opposition(1), remember("m_p_louis_defended")],
        }),
        end("leave", "cold", 0),
      ),
      boy: node(
        base,
        r("press", "warm", "deal", "press", {
          tell: [paid(1), "opposition:+1"],
          effects: [trust(1), opposition(1), remember("m_p_louis_defended")],
        }),
        end("end", "warm", 1, "m_p_louis_boy"),
      ),
      press: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_louis_maurice",
    "gbr_battenberg",
    Y14_ON,
    all(war, chapter(8, 9), not(louisOut)),
    6,
    {
      open: node(
        base,
        r("ask", "frank", "ask", "resign"),
        end("sorry", "warm", 1),
        end("papers", "cold", 0),
      ),
      resign: node(
        base,
        end("own", "warm", 1, "m_p_louis_own_mouth"),
        end("stay", "warm", 1, "m_p_louis_told_stay"),
      ),
    },
  ),
  comes(
    "gbr_p_louis_mast",
    "gbr_battenberg",
    Y14_ON,
    all(war, chapter(9, 10), seen("gbr_c_first_sea")),
    5,
    {
      open: node(
        base,
        r("boy", "warm", "ask", "boy", { when: memory("m_p_louis_boy") }),
        end("thanks", "warm", 1),
        end("cold", "cold", 0),
      ),
      boy: node(base, end("end", "warm", 1, "m_p_louis_end")),
      kept_open: node(
        base,
        end("thanks", "warm", 1, "m_p_louis_end"),
        r("cost", "frank", "ask", "cost"),
      ),
      cost: node(base, end("end", "warm", 0, "m_p_louis_end")),
    },
    {
      intro: says(["kept", not(louisOut)], "base"),
      starts: { kept: "kept_open" },
    },
  ),
  comes(
    "gbr_p_louis_book",
    "gbr_battenberg",
    WAR,
    between("1917-07", "1917-12"),
    4,
    {
      open: node(
        says(["end", memory("m_p_louis_end")], "base"),
        end("laugh", "warm", 1),
        end("sorry", "frank", 0),
      ),
    },
  ),
];

// ---- 5. 스탬퍼덤 경과 왕 ----

const stamSat = memory("m_p_stam_sat");
const stamWork = memory("m_p_stam_work");

const STAMFORDHAM: readonly GwScene[] = [
  meet("gbr_p_stam_boots", "gbr_stamfordham", Y14_ON, since(7, "15a"), {
    open: node(
      says(["warm", warm], "base"),
      r("offer", "warm", "deal", "offer", {
        effects: [remember("m_p_stam_offered")],
      }),
      r("age", "warm", "ask", "age"),
      end("boots", "warm", 1, "m_p_stam_boots"),
    ),
    age: node(
      base,
      r("offer", "warm", "deal", "offer", {
        effects: [remember("m_p_stam_offered")],
      }),
      end("boots", "warm", 1, "m_p_stam_boots"),
    ),
    offer: node(base, end("end", "warm", 0)),
  }),
  comes(
    "gbr_p_stam_may",
    "gbr_stamfordham",
    WAR,
    between("1915-05", "1915-07"),
    7,
    {
      open: node(
        base,
        r("go", "warm", "deal", "go"),
        end("write", "warm", 1, "m_p_stam_wrote"),
        end("work", "cold", 0, "m_p_stam_work"),
      ),
      go: node(base, r("sit", "warm", "ask", "sit")),
      sit: node(
        says(
          ["boots", memory("m_p_stam_boots")],
          ["offered", memory("m_p_stam_offered")],
          "base",
        ),
        end("papers", "warm", 2, "m_p_stam_sat"),
        end("go", "warm", 1, "m_p_stam_sat"),
      ),
    },
  ),
  comes(
    "gbr_p_king_mare",
    "gbr_george_v",
    WAR,
    between("1915-10", "1916-02"),
    5,
    {
      open: node(
        base,
        r("pain", "warm", "ask", "pain"),
        r("glass", "frank", "ask", "glass"),
        end("papers", "cold", 0),
      ),
      pain: node(
        says(["sat", stamSat], "base"),
        end("end", "warm", 1, "m_p_king_pain"),
      ),
      glass: node(base, end("end", "warm", 1)),
    },
  ),
  meet("gbr_p_king_john", "gbr_george_v", WAR, between("1916-01", "1916-12"), {
    open: node(
      base,
      r("arran", "frank", "ask", "arran"),
      r("wales", "warm", "ask", "wales"),
      end("leave", "warm", 0),
    ),
    arran: node(base, end("end", "warm", 2, "m_p_king_john")),
    wales: node(base, end("end", "warm", 1, "m_p_king_john")),
  }),
  comes(
    "gbr_p_king_nicky",
    "gbr_george_v",
    WAR,
    all(between("1918-07", "1918-10"), seen("gbr_t_king_tsar"), {
      kind: "world",
      of: { is: "regime", tag: "RUS", of: ["soviet"] },
    }),
    6,
    {
      open: node(
        says(["john", memory("m_p_king_john")], "base"),
        r("share", "warm", "ask", "share"),
        r("note", "frank", "ask", "note"),
        end("leave", "warm", 0),
      ),
      share: node(base, end("end", "warm", 1)),
      note: node(base, end("end", "frank", 1)),
    },
  ),
  comes(
    "gbr_p_stam_fifteenth",
    "gbr_stamfordham",
    WAR,
    all(
      any(
        between("1916-05", "1916-06"),
        between("1917-05", "1917-06"),
        between("1918-05", "1918-06"),
      ),
      seen("gbr_p_stam_may"),
    ),
    7,
    {
      open: node(
        base,
        end("same", "warm", 1, "m_p_stam_end"),
        end("ring", "warm", 1, "m_p_stam_end"),
      ),
      busy: node(base, end("end", "cold", 0)),
    },
    {
      intro: says(["busy", any(stamWork, cold)], "base"),
      starts: { busy: "busy" },
    },
  ),
];

// ---- 6. 보나 로: 쪽지로 두는 체스 ----

const chess = memory("m_p_law_chess");

const LAW: readonly GwScene[] = [
  comes(
    "gbr_p_law_kensington",
    "gbr_bonar_law",
    CRISIS,
    all(chapter(4, 5), { kind: "crisis", topic: "balkan" }),
    4,
    {
      open: node(
        says(["cold", cold], "base"),
        r("play", "warm", "deal", "play", {
          effects: [remember("m_p_law_chess")],
        }),
        end("no", "cold", 0),
        r("annie", "warm", "ask", "annie"),
      ),
      annie: node(
        base,
        r("play", "warm", "deal", "play", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_law_chess")],
        }),
        end("no", "warm", 1),
      ),
      play: node(base, end("end", "warm", 0)),
    },
  ),
  meet("gbr_p_law_note", "gbr_bonar_law", Y14_ON, all(chess, since(8, "15b")), {
    open: node(
      says(["warm", warm], ["cold", cold], "base"),
      r("sons", "warm", "ask", "sons"),
      r("house", "frank", "deal", "house", {
        tell: [paid(1)],
        effects: [trust(1), remember("m_p_law_board_apart")],
      }),
      end("resign", "frank", 0, "m_p_law_resigned"),
    ),
    sons: node(base, end("end", "warm", 1)),
    house: node(base, end("end", "warm", 0)),
  }),
  comes(
    "gbr_p_law_not_urgent",
    "gbr_bonar_law",
    WAR,
    all(raymond, during("16b", "17a")),
    5,
    {
      open: node(
        says(["no_game", not(chess)], "base"),
        end("thank", "warm", 1, "m_p_law_kept_board"),
        r("move", "warm", "deal", "move", {
          when: chess,
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_law_moved")],
        }),
      ),
      move: node(base, end("end", "warm", 0)),
    },
    { intro: says(["no_game", not(chess)], "base") },
  ),
  comes(
    "gbr_p_law_gaza",
    "gbr_bonar_law",
    WAR,
    between("1917-04", "1917-07"),
    6,
    {
      open: node(
        says(["cold", cold], "base"),
        r("urgent", "warm", "leave", null, {
          when: seen("gbr_p_law_not_urgent"),
          tell: [paid(2)],
          effects: [trust(2), remember("m_p_law_returned")],
        }),
        r("rome", "warm", "deal", "rome", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_law_rome")],
        }),
        end("home", "warm", 1),
      ),
      rome: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_law_confirmed",
    "gbr_bonar_law",
    WAR,
    all(memory("m_p_law_rome"), between("1917-05", "1917-09")),
    7,
    {
      open: node(
        base,
        end("letter", "warm", 1, "m_p_law_told"),
        r("sit", "warm", "ask", "sit"),
      ),
      sit: node(base, end("end", "warm", 2, "m_p_law_told")),
    },
  ),
  comes(
    "gbr_p_law_black",
    "gbr_bonar_law",
    WAR,
    all(between("1917-09", "1918-03"), seen("gbr_p_law_gaza")),
    5,
    {
      open: node(
        says(["no_game", not(chess)], ["cold", cold], "base"),
        r("move", "warm", "deal", "last", { when: chess }),
        end("draw", "warm", 2, "m_p_law_end"),
        end("sit", "frank", 1, "m_p_law_end"),
      ),
      last: node(base, end("end", "warm", 1, "m_p_law_end")),
      parcel: node(base, end("end", "cold", 0, "m_p_law_end")),
    },
    {
      intro: says(
        ["parcel", all(chess, cold)],
        ["no_game", not(chess)],
        "base",
      ),
      starts: { parcel: "parcel" },
    },
  ),
];

// ---- 7. 로이드 조지 ----

const lgDrawer = memory("m_p_lg_drawer");
const lgGiven = memory("m_p_lg_given");

const LLOYD_GEORGE: readonly GwScene[] = [
  meet("gbr_p_lg_heath", "gbr_lloyd_george", CRISIS, chapter(0, 5), {
    open: node(
      says(["cold", cold], "base"),
      r("helen", "warm", "ask", "helen"),
      r("why", "frank", "ask", "why"),
      end("ball", "cold", 0),
    ),
    helen: node(base, end("end", "warm", 2, "m_p_lg_helen")),
    why: node(base, end("end", "frank", 1)),
  }),
  comes(
    "gbr_p_lg_stones",
    "gbr_lloyd_george",
    WAR,
    all(war, between("1915-03", "1915-05")),
    6,
    {
      open: node(
        says(["helen", memory("m_p_lg_helen")], "base"),
        r("believe", "warm", "deal", "believed", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_lg_believed")],
        }),
        r("doubt", "frank", "ask", "doubted"),
        end("wipe", "cold", -1, "m_p_lg_wiped"),
      ),
      believed: node(base, end("end", "warm", 0)),
      doubted: node(base, end("end", "frank", 0, "m_p_lg_doubted")),
    },
  ),
  comes("gbr_p_lg_envelope", "gbr_montagu", WAR, during("15b", "16a"), 4, {
    open: node(
      base,
      end("burn", "warm", 1, "m_p_lg_burned"),
      r("give", "frank", "deal", "give", {
        tell: ["trust:+1"],
        effects: [
          trustOf(byName("gbr_lloyd_george"), 1),
          remember("m_p_lg_given"),
        ],
      }),
      r("drawer", "cold", "deal", "drawer", {
        effects: [remember("m_p_lg_drawer")],
      }),
    ),
    give: node(base, end("end", "warm", 0)),
    drawer: node(base, end("end", "cold", -1)),
  }),
  meet(
    "gbr_p_lg_sons",
    "gbr_lloyd_george",
    WAR,
    all(war, between("1916-01", "1916-08")),
    {
      open: node(
        says(["cold", any(cold, lgDrawer)], "base"),
        r("raymond", "frank", "ask", "raymond"),
        r("out", "warm", "deal", "out", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_lg_son_out")],
        }),
        r("stay", "cold", "push", "stayed", {
          tell: [paid(-1)],
          effects: [trust(-1), remember("m_p_lg_son_stays")],
        }),
      ),
      raymond: node(
        base,
        r("out", "warm", "deal", "out", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_lg_son_out")],
        }),
        end("own", "frank", 1, "m_p_lg_son_own"),
      ),
      out: node(base, end("end", "warm", 0)),
      stayed: node(base, end("end", "cold", 0)),
    },
  ),
  comes(
    "gbr_p_lg_uncle",
    "gbr_lloyd_george",
    WAR,
    between("1917-02", "1917-04"),
    5,
    {
      open: node(
        says(["given", lgGiven], ["cold", any(cold, lgDrawer)], "base"),
        r("go", "warm", "deal", "go", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_lg_end")],
        }),
        r("ask", "frank", "ask", "boots"),
        end("work", "cold", -1, "m_p_lg_end"),
      ),
      boots: node(
        base,
        r("go", "warm", "deal", "go", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_lg_end")],
        }),
      ),
      go: node(says(["given", lgGiven], "base"), end("end", "warm", 0)),
      gone: node(base, end("end", "cold", 0, "m_p_lg_end")),
    },
    {
      intro: says(["gone", all(lgDrawer, cold)], "base"),
      starts: { gone: "gone" },
    },
  ),
];

// ---- 8. 클레먼타인과 처칠 ----

const clemNoAnswer = memory("m_p_clem_noanswer");
const clemSpring = (kept: boolean): GwCond => ({
  kind: "promise",
  who: byName("gbr_churchill"),
  key: "p_clem_spring",
  ...(kept ? { kept: true } : { broken: true }),
});

const CLEMENTINE: readonly GwScene[] = [
  comes(
    "gbr_p_clem_antwerp",
    "gbr_clementine",
    Y14_ON,
    all(war, chapter(7, 8)),
    5,
    {
      open: node(
        base,
        r("own", "frank", "ask", "own"),
        r("wire", "warm", "deal", "wire", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_clem_wired")],
        }),
        end("leave", "cold", 0),
      ),
      own: node(
        base,
        r("wire", "warm", "deal", "wire", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_clem_wired")],
        }),
        end("end", "frank", 1),
      ),
      wire: node(base, end("end", "warm", 0)),
    },
    { intro: says(["antwerp", flag("f_chu_antwerp")], "base") },
  ),
  comes(
    "gbr_p_clem_fisher",
    "gbr_clementine",
    Y14_ON,
    all(between("1914-11", "1915-05"), {
      kind: "holder",
      office: "sea_lord",
      person: "gbr_fisher",
    }),
    5,
    {
      open: node(
        base,
        r("why", "frank", "ask", "why"),
        r("see", "warm", "deal", "see", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_clem_fisher")],
        }),
        end("him", "cold", -1),
      ),
      why: node(base, end("end", "frank", 1, "m_p_clem_fisher")),
      see: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_clem_letter",
    "gbr_clementine",
    WAR,
    all(co, during("15a", "15b"), not(seen("gbr_h_seats"))),
    7,
    {
      open: node(
        base,
        r("answer", "warm", "deal", "meet", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_clem_answered")],
        }),
        end("short", "cold", 0, "m_p_clem_short"),
        end("none", "cold", -2, "m_p_clem_noanswer"),
      ),
      meet: node(
        base,
        end("keep", "warm", 0),
        r("truth", "frank", "ask", "truth"),
      ),
      truth: node(base, end("end", "frank", 1)),
    },
  ),
  meet(
    "gbr_p_chu_paint",
    "gbr_churchill",
    WAR,
    all(memory("m_churchill_out"), during("15a", "16a")),
    {
      open: node(
        says(["no_answer", clemNoAnswer], ["cold", cold], "base"),
        r("sorry", "frank", "ask", "sorry"),
        end("good", "flatter", 1, "m_p_chu_painted"),
        r("sky", "warm", "ask", "sky"),
      ),
      sorry: node(
        says(["no_answer", clemNoAnswer], "base"),
        end("end", "warm", 1, "m_p_chu_painted"),
      ),
      sky: node(base, end("end", "warm", 1, "m_p_chu_painted")),
    },
  ),
  meet(
    "gbr_p_clem_lunch",
    "gbr_clementine",
    WAR,
    all(seen("gbr_t_churchill_trenches"), during("15b", "16b")),
    {
      open: node(
        says(
          ["no_answer", clemNoAnswer],
          ["answered", memory("m_p_clem_answered")],
          "base",
        ),
        r("spring", "warm", "deal", "spring", {
          tell: ["promise"],
          effects: [
            promise(byName("gbr_churchill"), "p_clem_spring", 6, {
              keep: { kind: "in_office", who: byName("gbr_churchill") },
            }),
          ],
        }),
        r("shell", "frank", "ask", "shell"),
        end("eat", "cold", 0),
      ),
      shell: node(
        base,
        r("spring", "warm", "deal", "spring", {
          tell: ["promise"],
          effects: [
            promise(byName("gbr_churchill"), "p_clem_spring", 6, {
              keep: { kind: "in_office", who: byName("gbr_churchill") },
            }),
          ],
        }),
        end("end", "warm", 1),
      ),
      spring: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_clem_last",
    "gbr_clementine",
    WAR,
    all(
      any(seen("gbr_p_clem_lunch"), seen("gbr_p_clem_letter")),
      during("17a", "18a"),
    ),
    4,
    {
      open: node(
        says(["kept", clemSpring(true)], ["broke", clemSpring(false)], "base"),
        end("thanks", "warm", 1, "m_p_clem_end"),
        end("ask", "frank", 0, "m_p_clem_end"),
      ),
    },
  ),
];

// ---- 9. 레드먼드 형제 ----

const RED_WENT = memory("m_p_red_went");

const REDMOND: readonly GwScene[] = [
  meet("gbr_p_red_captain", "gbr_redmond", Y14_ON, all(war, since(8, "15a")), {
    open: node(
      says(["warm", warm], ["cold", cold], "base"),
      r("safe", "warm", "deal", "safe", {
        effects: [remember("m_p_red_safe")],
      }),
      r("why", "frank", "ask", "why"),
      end("leave", "warm", 0),
    ),
    why: node(
      base,
      r("safe", "warm", "deal", "safe", {
        effects: [remember("m_p_red_safe")],
      }),
      end("end", "warm", 1),
    ),
    safe: node(base, end("end", "warm", 1)),
  }),
  meet(
    "gbr_p_red_lodge",
    "gbr_redmond",
    WAR,
    all(easter, during("16a", "16b")),
    {
      open: node(
        says(["cold", cold], "base"),
        r("stay", "warm", "ask", "stay"),
        end("end", "warm", 1),
      ),
      stay: node(base, end("end", "warm", 1, "m_p_red_lodge")),
    },
  ),
  comes(
    "gbr_p_red_esther",
    "gbr_redmond",
    WAR,
    between("1917-01", "1917-03"),
    5,
    {
      open: node(
        base,
        r("house", "frank", "deal", "house", {
          tell: ["irish:+1"],
          effects: [{ kind: "inst", inst: "irish", delta: 1 }],
        }),
        end("write", "warm", 1, "m_p_red_esther"),
        end("none", "cold", 0),
      ),
      house: node(base, end("end", "warm", 1, "m_p_red_esther")),
    },
  ),
  comes(
    "gbr_p_red_speech",
    "gbr_redmond",
    WAR,
    all(war, between("1917-03", "1917-05")),
    5,
    {
      open: node(
        says(["cold", cold], "base"),
        r("supper", "warm", "deal", "supper", {
          tell: [paid(1)],
          effects: [trust(1), remember("m_p_red_supper")],
        }),
        end("rule", "frank", 0, "m_p_red_rule"),
        end("leave", "warm", 0),
      ),
      supper: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_red_messines",
    "gbr_redmond",
    WAR,
    all(war, between("1917-06", "1917-08")),
    7,
    {
      open: node(
        says(["safe", memory("m_p_red_safe")], "base"),
        r("go", "warm", "deal", "stretcher", {
          tell: [paid(2)],
          effects: [trust(2), remember("m_p_red_went")],
        }),
        r("say", "warm", "deal", "house", {
          tell: [paid(1), "irish:+1"],
          effects: [
            trust(1),
            { kind: "inst", inst: "irish", delta: 1 },
            remember("m_p_red_spoke"),
          ],
        }),
        end("wire", "cold", 0),
      ),
      stretcher: node(base, end("end", "warm", 0)),
      house: node(base, end("end", "warm", 0)),
    },
  ),
  comes(
    "gbr_p_red_nursing",
    "gbr_redmond",
    WAR,
    all(seen("gbr_p_red_messines"), between("1918-01", "1918-04")),
    6,
    {
      open: node(
        says(
          ["lives", flag("f_home_rule_lives")],
          ["went", RED_WENT],
          ["cold", cold],
          "base",
        ),
        end("hand", "warm", 1, "m_p_red_end"),
        r("wexford", "frank", "ask", "wexford"),
      ),
      wexford: node(base, end("end", "warm", 0, "m_p_red_end")),
    },
  ),
];

// ---- 10. 헨더슨: 같은 날 ----

const HENDERSON: readonly GwScene[] = [
  meet("gbr_p_hen_water", "gbr_henderson", Y14_ON, all(war, since(8, "16a")), {
    open: node(
      says(["warm", warm], ["cold", cold], "base"),
      r("sons", "warm", "ask", "sons"),
      r("preach", "frank", "ask", "preach"),
      end("leave", "warm", 0),
    ),
    sons: node(base, end("end", "warm", 1, "m_p_hen_sons")),
    preach: node(base, end("end", "warm", 1)),
  }),
  meet(
    "gbr_p_hen_featherstone",
    "gbr_henderson",
    WAR,
    all(war, during("15b", "16a")),
    {
      open: node(
        says(["cold", cold], "base"),
        r("law", "cold", "ask", "law"),
        r("names", "frank", "ask", "names"),
        end("stop", "cold", -1),
      ),
      law: node(
        base,
        r("names", "frank", "ask", "names"),
        end("end", "cold", 0),
      ),
      names: node(base, end("end", "frank", 2, "m_p_hen_feather")),
    },
  ),
  meet(
    "gbr_p_hen_david",
    "gbr_henderson",
    WAR,
    all(war, between("1916-01", "1916-09")),
    {
      open: node(
        says(["sons", memory("m_p_hen_sons")], "base"),
        r("staff", "warm", "deal", "staff", {
          effects: [remember("m_p_hen_offered")],
        }),
        r("mother", "warm", "ask", "mother"),
        end("leave", "frank", 0),
      ),
      staff: node(base, end("end", "warm", 0)),
      mother: node(base, end("end", "warm", 1)),
    },
  ),
  comes(
    "gbr_p_hen_same_day",
    "gbr_henderson",
    WAR,
    all(raymond, during("16b", "17a")),
    6,
    {
      open: node(
        says(["offered", memory("m_p_hen_offered")], "base"),
        r("age", "warm", "ask", "age"),
        end("sit", "warm", 2, "m_p_hen_sat"),
        end("work", "cold", 0, "m_p_hen_work"),
      ),
      age: node(
        base,
        end("sit", "warm", 2, "m_p_hen_sat"),
        r("pray", "frank", "ask", "pray"),
      ),
      pray: node(base, end("end", "warm", 1, "m_p_hen_sat")),
    },
    { intro: says(["outside", not(flag("f_gbr_labour_in"))], "base") },
  ),
  meet(
    "gbr_p_hen_chapel",
    "gbr_henderson",
    WAR,
    all(seen("gbr_p_hen_same_day"), during("17a", "18b")),
    {
      open: node(
        says(["sat", memory("m_p_hen_sat")], ["cold", cold], "base"),
        r("sit", "warm", "ask", "pew"),
        end("leave", "frank", 0),
      ),
      pew: node(base, end("end", "warm", 1, "m_p_hen_end")),
    },
  ),
];

export const GBR_PRIVATE_SCENES: readonly GwScene[] = [
  ...GREY,
  ...HALDANE,
  ...BIRRELL,
  ...LOUIS,
  ...STAMFORDHAM,
  ...LAW,
  ...LLOYD_GEORGE,
  ...CLEMENTINE,
  ...REDMOND,
  ...HENDERSON,
];

/** One person these lines need that work never called. */
export const GBR_PRIVATE_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "gbr_clementine",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "liberal"],
    temperaments: ["cold", "stubborn"],
    rivals: ["gbr_fisher"],
    allies: ["gbr_churchill"],
    fame: 2,
    source:
      "Clementine Churchill: Sarah born 7 Oct 1914; wrote to Asquith in May 1915 (memory, Soames); lunch with Asquith Jan 1916 (Churchill Archives); YMCA canteens for munition workers, CBE 1918 (en.wikipedia)",
  },
];

/** The way she talks, as GBR_VOICE_NOTES. */
export const GBR_PRIVATE_VOICE_NOTES: Readonly<Record<string, string>> = {
  gbr_clementine:
    "서른 살의 곧은 등. 남편 말고는 아무도 안 무서워하고 남편도 조금만 무서워한다. 정중한 하십시오체, 문장이 짧고 끝이 칼이다. 묻는 말에 먼저 사실을 요구한다. 울지 않는다.",
};

/** Lines said in a work talk because of what happened here. */
interface Back {
  scene: string;
  node: string;
  /** New says variants, first that holds wins. */
  says: readonly GwVariant[];
}

const BACK: readonly Back[] = [
  {
    scene: "gbr_t_grey_eyes",
    node: "open",
    says: [
      v("p_hal", memory("m_p_hal_note")),
      v("p_read", memory("m_p_grey_read")),
      v("p_kept", memory("m_p_grey_kept_sunday")),
    ],
  },
  {
    scene: "gbr_t_grey_leave",
    node: "open",
    says: [v("p_told", memory("m_p_grey_told"))],
  },
  {
    scene: "gbr_v_birrell_warn",
    node: "open",
    says: [
      v("p_funeral", memory("m_p_bir_funeral")),
      v("p_noword", memory("m_p_bir_noword")),
      v("p_sent", memory("m_p_bir_sent")),
    ],
  },
  {
    scene: "gbr_v_haldane_army",
    node: "open",
    says: [v("p_helen", memory("m_p_hal_helen"))],
  },
  {
    scene: "gbr_t_redmond_convention",
    node: "open",
    says: [
      v("p_went", memory("m_p_red_went")),
      v("p_spoke", memory("m_p_red_spoke")),
    ],
  },
  {
    scene: "gbr_t_henderson_truce",
    node: "open",
    says: [v("p_feather", memory("m_p_hen_feather"))],
  },
  {
    scene: "gbr_t_redmond_division",
    node: "open",
    says: [v("p_safe", memory("m_p_red_safe"))],
  },
  {
    scene: "gbr_t_king_letters",
    node: "open",
    says: [v("p_pain", memory("m_p_king_pain"))],
  },
  {
    scene: "gbr_t_churchill_fisher",
    node: "open",
    says: [v("p_fisher", memory("m_p_clem_fisher"))],
  },
  {
    scene: "gbr_t_henderson_cons",
    node: "open",
    says: [v("p_david", memory("m_p_hen_offered"))],
  },
  {
    scene: "gbr_t_henderson_after",
    node: "open",
    says: [
      v("p_sat", memory("m_p_hen_sat")),
      v("p_work", memory("m_p_hen_work")),
    ],
  },
  {
    scene: "gbr_t_lg_ambition",
    node: "open",
    says: [
      v("p_son_stays", memory("m_p_lg_son_stays")),
      v("p_son_out", memory("m_p_lg_son_out")),
      v("p_given", memory("m_p_lg_given")),
      v("p_drawer", memory("m_p_lg_drawer")),
      v("p_wiped", memory("m_p_lg_wiped")),
      v("p_believed", memory("m_p_lg_believed")),
    ],
  },
  {
    scene: "gbr_t_law_december",
    node: "open",
    says: [
      v("p_moved", memory("m_p_law_moved")),
      v("p_board", memory("m_p_law_board_apart")),
    ],
  },
  {
    scene: "gbr_t_law_truce",
    node: "open",
    says: [v("p_chess", memory("m_p_law_chess"))],
  },
  {
    scene: "gbr_t_churchill_trenches",
    node: "open",
    says: [
      v("p_noanswer", memory("m_p_clem_noanswer")),
      v("p_painted", memory("m_p_chu_painted")),
    ],
  },
  {
    scene: "gbr_t_churchill_back",
    node: "open",
    says: [v("p_spring", clemSpring(false))],
  },
  {
    scene: "gbr_t_king_tsar",
    node: "open",
    says: [v("p_john", memory("m_p_king_john"))],
  },
  {
    scene: "gbr_v_stamfordham_note",
    node: "open",
    says: [v("p_sat", memory("m_p_stam_sat"))],
  },
];

const birrellThere: GwCond = {
  kind: "holder",
  office: "ireland",
  person: "gbr_birrell",
};

/** Whole bodies of decisions, chosen as the others are. */
const BACK_BODIES: Readonly<Record<string, readonly GwVariant[]>> = {
  gbr_h_easter: [
    v("p_winter", all(memory("m_p_bir_stayed"), birrellThere)),
    v("p_sent", all(memory("m_p_bir_sent"), birrellThere)),
  ],
  gbr_h_committee: [v("p_warned", memory("m_p_hal_warned"))],
  gbr_c_first_sea: [v("p_own", memory("m_p_louis_own_mouth"))],
};

/** A reply that goes another way because of what happened here. */
const BACK_REACTS: readonly {
  scene: string;
  node: string;
  reply: string;
  react: GwReact;
}[] = [
  // He has stopped joking with this man: the question gets the sober answer.
  {
    scene: "gbr_v_birrell_warn",
    node: "open",
    reply: "ask",
    react: react(memory("m_p_bir_funeral"), "sober"),
  },
];

/** The private lines' way back into the work scenes. */
export function withGbrPrivate(scenes: readonly GwScene[]): GwScene[] {
  return scenes.map((s) => {
    let out = s;
    const bodies = BACK_BODIES[s.id];
    if (bodies !== undefined) {
      out = { ...out, variants: [...bodies, ...out.variants] };
    }
    for (const b of BACK.filter((x) => x.scene === s.id)) {
      const n = out.nodes?.[b.node];
      if (n === undefined) throw new Error(`${s.id}: no node ${b.node}`);
      out = {
        ...out,
        nodes: {
          ...out.nodes,
          [b.node]: { ...n, says: [...b.says, ...n.says] },
        },
      };
    }
    for (const b of BACK_REACTS.filter((x) => x.scene === s.id)) {
      const n = out.nodes![b.node];
      const replies = n.replies.map((x) =>
        x.id === b.reply ? { ...x, reacts: [b.react, ...(x.reacts ?? [])] } : x,
      );
      out = {
        ...out,
        nodes: { ...out.nodes, [b.node]: { ...n, replies } },
      };
    }
    return out;
  });
}
