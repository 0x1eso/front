// ww222 (W2): Austria-Hungary's roads to the other camp (design ww220 R7 and
// the Balkan bargain of R3). In peace: Petersburg, through a Balkan
// understanding as in 1897; Paris and London, which have no bond with
// Vienna, only what is signed. In the war: a losing or federal monarchy may
// leave the Dual Alliance, or go over. The envoy department's courses, an
// audience with Berchtold, the pledge, alliance and leave rows, the army and
// the Magyars against and the Czechs and South Slavs for, four diary lines.
// Text: AUH.depts.json, AUH.powers.json, AUH.persona.json.
//
// Facts used: the Austro-Russian understanding on the Balkans (May 1897);
// the Mediterranean Agreements with Britain and Italy (1887); Berchtold as
// ambassador in St Petersburg (1906-1911) before the Foreign Ministry; the
// common foreign minister answering to both governments under the 1867
// Compromise; the Dual Alliance (1879); Conrad's staff wanting war on
// Serbia and Italy; Silesia lost to Prussia in 1742.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwAnswerRow } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwDiaryRow } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, reason } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";
import { cool, heat } from "../house/kit";
import { node, reply, summons } from "../scenes/ruler_kit";
import {
  allyWith,
  bond,
  c,
  f,
  peace,
  pledgeTo,
  remember,
  road,
  roadCourses,
  roadDiary,
  roadFindings,
  someOpen,
  switchCan,
  trust,
  war,
} from "./kit";

const NATION: GwTag[] = ["AUH"];
/** The monarchy's forms (powers/auh.ts CROWN). */
const crown = world({
  is: "regime",
  tag: "AUH",
  of: ["dual_monarchy", "karl", "ff_throne"],
});
/** The crown, or the federation that may turn (Regimes `camp: "turn"`). */
const rules = any(
  crown,
  world({ is: "regime", tag: "AUH", of: ["federation"] }),
);
const feeler = remember("auh_road_feeler");

const ans = (
  id: string,
  type: GwAnswerRow["type"],
  topic: GwTag,
  findings: GwAnswerRow["findings"],
  courses: GwAnswerRow["courses"],
): GwAnswerRow => ({
  id: `auh_ans_${id}`,
  nation: NATION,
  type,
  topic: [topic],
  findings,
  courses,
});

export const AUH_ROAD_ANSWERS: readonly GwAnswerRow[] = [
  // Ballhausplatz on Petersburg: the Balkans, Serbia between the two.
  ans(
    "road_rus",
    "envoy",
    "RUS",
    [
      ...roadFindings("RUS"),
      f("serbia_between", 2, { when: peace }),
      f("ninety_seven", 1, { when: peace }),
    ],
    roadCourses("auh", "RUS", "balkan"),
  ),
  // On Paris: no bond, only what is signed.
  ans(
    "road_fra",
    "envoy",
    "FRA",
    [...roadFindings("FRA"), f("paris_far", 2, { when: peace })],
    roadCourses("auh", "FRA", "balkan", trust("FRA", 1)),
  ),
  // On London: the old Mediterranean understanding.
  ans(
    "road_gbr",
    "envoy",
    "GBR",
    [...roadFindings("GBR"), f("mediterranean", 2, { when: peace })],
    roadCourses("auh", "GBR", "straits", trust("GBR", 1)),
  ),
  // Berlin warms to Petersburg over Vienna's head: hold Berlin to the word.
  ans(
    "road_deu",
    "envoy",
    "DEU",
    [f("berlin_petersburg", 3, { when: road("RUS", { of: "DEU", min: 1 }) })],
    [
      c("road_hold_berlin", ["firm", "calm"], [bond("DEU", 1)], {
        when: all(peace, road("RUS", { of: "DEU", min: 1 })),
      }),
    ],
  ),
  // 정보: whom Petersburg talks to besides us.
  ans(
    "road_intel_rus",
    "intel",
    "RUS",
    [f("envoys_berlin", 3, { when: road("DEU", { of: "RUS", min: 1 }) })],
    [],
  ),
];

const PLEDGE = [pledgeTo("RUS"), pledgeTo("FRA"), pledgeTo("GBR")];
const ALLY = [allyWith("RUS"), allyWith("FRA"), allyWith("GBR")];

export const AUH_ROAD_POWERS: readonly GwPowerRow[] = [
  // The common foreign minister signs; Budapest must not stand against it.
  {
    id: "auh_pw_pledge",
    tag: "AUH",
    group: "treaty",
    kind: "lawful",
    shows: crown,
    opens: [
      { when: peace, why: "in_war" },
      { when: someOpen(PLEDGE), why: "no_road" },
    ],
    needs: { office: "foreign", consent: "auh_work" },
    against: ["hard"],
    authority: 10,
    cooldown: 6,
    target: { kind: "country", of: PLEDGE },
    tags: ["realign"],
    effects: [],
    scene: "auh_pw_pledge_r",
  },
  {
    id: "auh_pw_alliance",
    tag: "AUH",
    group: "treaty",
    kind: "lawful",
    shows: rules,
    opens: [{ when: someOpen(ALLY), why: "no_road" }],
    needs: { office: "foreign", consent: "auh_work" },
    against: ["hard", "military"],
    authority: 20,
    cooldown: 12,
    slot: true,
    target: { kind: "country", of: ALLY },
    tags: ["realign"],
    effects: [],
    risk: {
      pct: 20,
      mods: [{ when: { kind: "bloc", bloc: "army", max: -1 }, add: 20 }],
      then: [
        { kind: "opinion", bloc: "army", delta: -1 },
        reason("auh_pw_alliance_army"),
      ],
      heats: [{ id: "auh_pl_army", by: 1 }],
    },
    scene: "auh_pw_alliance_r",
  },
  // Out of the war by a peace with every foe, not beaten: the Dual Alliance
  // is broken, and Berlin will not forget it.
  {
    id: "auh_pw_leave",
    tag: "AUH",
    group: "war",
    kind: "custom",
    shows: rules,
    opens: [
      { when: war, why: "no_war" },
      { when: switchCan, why: "holds" },
    ],
    needs: { office: "foreign" },
    against: ["hard", "military"],
    authority: 15,
    once: true,
    tags: ["realign", "peace_separate", "alliance_broken"],
    effects: [trust("DEU", -2), doWorld({ do: "leave_coalition" })],
    risk: {
      pct: 25,
      mods: [{ when: { kind: "bloc", bloc: "army", max: -1 }, add: 20 }],
      then: [
        { kind: "opinion", bloc: "army", delta: -1 },
        reason("auh_pw_leave_army"),
      ],
      heats: [{ id: "auh_pl_army", by: 2 }],
    },
    scene: "auh_pw_leave_r",
  },
];

export const AUH_ROAD_REACTORS: readonly GwReactorRow[] = [
  // Conrad's staff: the army was raised for this war, against these foes.
  {
    tag: "realign",
    nation: "AUH",
    actor: "other",
    delta: -1,
    key: "auh_pw_r_aok",
    does: [heat("auh_aok")],
  },
  // Tisza's Party of Work: Budapest fears a Slav peace most.
  {
    tag: "realign",
    nation: "AUH",
    actor: "other",
    delta: -1,
    key: "auh_pw_r_magyars",
    does: [heat("auh_work")],
  },
  // The Czechs and the South Slavs, who never wanted Berlin's war.
  {
    tag: "realign",
    nation: "AUH",
    actor: "other",
    delta: 1,
    key: "auh_pw_r_slavs",
    does: [cool("auh_czech"), cool("auh_slavs")],
  },
  // The German nationalists, when it is Berlin that is left.
  {
    tag: "realign",
    nation: "AUH",
    actor: "other",
    delta: -1,
    powers: ["auh_pw_alliance", "auh_pw_leave"],
    key: "auh_pw_r_germans",
    does: [heat("auh_germans")],
  },
];

const card = (id: string): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["war"],
  variants: [{ id: "base" }],
});

export const AUH_ROAD_SCENES: readonly GwScene[] = [
  card("auh_pw_pledge_r"),
  card("auh_pw_alliance_r"),
  card("auh_pw_leave_r"),
  // Berchtold, five years ambassador in Petersburg, on a line there; once.
  summons({
    id: "auh_road_t_berchtold",
    nation: NATION,
    person: "auh_berchtold",
    when: all(
      crown,
      peace,
      { kind: "person_active", person: "auh_berchtold" },
      road("RUS", { max: 2 }),
    ),
    nodes: {
      open: node([
        reply("ask_petersburg", "frank", "ask", "petersburg"),
        reply("ask_serbia", "frank", "ask", "serbia"),
        reply("leave", "cold", "leave", null),
      ]),
      petersburg: node([
        reply("write_sazonov", "warm", "deal", "end", [bond("RUS", 1), feeler]),
        reply("leave", "cold", "leave", null),
      ]),
      serbia: node([
        reply("write_sazonov", "warm", "deal", "end", [bond("RUS", 1), feeler]),
        reply("close", "cold", "leave", null),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
];

export const AUH_ROAD_DIARY: readonly GwDiaryRow[] = roadDiary("auh_dy", "AUH");
