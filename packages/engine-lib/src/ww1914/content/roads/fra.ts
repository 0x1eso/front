// ww222 (W2): France's roads to the other camp (design ww220 R4, "France
// alone, or reconciled"). A Caillaux-like bargain with Berlin, as in 1911;
// a line to Vienna; and the answers when London or Petersburg warm to
// Berlin. The envoy department's courses, an audience with Caillaux, the
// pledge and alliance rows, the revanchists against and the socialists and
// Caillaux's radicals for, four diary lines. Text: FRA.depts.json,
// FRA.powers.json, FRA.persona.json.
//
// Facts used: the Agadir crisis and the Franco-German treaty of 4 November
// 1911 (Morocco for a slice of the French Congo), negotiated by Caillaux's
// government past the Quai d'Orsay; Fashoda (1898); the constitutional law
// of 16 July 1875, art. 8 (the President negotiates and ratifies treaties,
// and tells the chambers when the State's safety allows); the Action
// française and Clemenceau as the voices of revanche; Jaurès's SFIO against
// the three-year law.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwAnswerRow } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwDiaryRow } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, reason } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
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
  trust,
} from "./kit";

const NATION: GwTag[] = ["FRA"];
const ours = world({
  is: "regime",
  tag: "FRA",
  of: ["fra_republic", "fra_union", "fra_tiger"],
});
const feeler = remember("fra_road_feeler");

const ans = (
  id: string,
  type: GwAnswerRow["type"],
  topic: GwTag,
  findings: GwAnswerRow["findings"],
  courses: GwAnswerRow["courses"],
): GwAnswerRow => ({
  id: `fra_ans_${id}`,
  nation: NATION,
  type,
  topic: [topic],
  findings,
  courses,
});

export const FRA_ROAD_ANSWERS: readonly GwAnswerRow[] = [
  // Quai d'Orsay on Berlin: the road, Agadir's precedent, Alsace in the way.
  ans(
    "road_deu",
    "envoy",
    "DEU",
    [...roadFindings("DEU"), f("agadir", 2, { when: peace }), f("alsace", 2)],
    roadCourses("fra", "DEU", "colonial"),
  ),
  // On Vienna: no bond between the two, only what is signed.
  ans(
    "road_auh",
    "envoy",
    "AUH",
    [...roadFindings("AUH"), f("vienna_bound", 2, { when: peace })],
    roadCourses("fra", "AUH", "balkan", trust("AUH", 1)),
  ),
  // London warms to Berlin: the staff talks are the answer.
  ans(
    "road_gbr",
    "envoy",
    "GBR",
    [f("london_berlin", 3, { when: road("DEU", { of: "GBR", min: 1 }) })],
    [
      c("road_staff_talks", ["firm", "calm"], [bond("GBR", 1)], {
        when: all(peace, road("DEU", { of: "GBR", min: 1 })),
      }),
    ],
  ),
  // Petersburg warms to Berlin: the loans are the answer.
  ans(
    "road_rus",
    "envoy",
    "RUS",
    [
      f("petersburg_berlin", 3, {
        when: road("DEU", { of: "RUS", min: 1 }),
      }),
    ],
    [
      c(
        "road_loan",
        ["bold", "gentle"],
        [bond("RUS", 1), { kind: "gauge", gauge: "money", delta: -1 }],
        { when: all(peace, road("DEU", { of: "RUS", min: 1 })) },
      ),
    ],
  ),
  // 정보: whom Berlin talks to besides us.
  ans(
    "road_intel_deu",
    "intel",
    "DEU",
    [
      f("envoys_london", 3, { when: road("GBR", { of: "DEU", min: 1 }) }),
      f("envoys_petersburg", 3, {
        when: road("RUS", { of: "DEU", min: 1 }),
      }),
    ],
    [],
  ),
];

const PLEDGE = [pledgeTo("DEU"), pledgeTo("AUH")];
const ALLY = [allyWith("DEU"), allyWith("AUH")];

export const FRA_ROAD_POWERS: readonly GwPowerRow[] = [
  // Art. 8: the President negotiates and ratifies; the premier signs under.
  {
    id: "fra_pw_pledge",
    tag: "FRA",
    group: "treaty",
    kind: "lawful",
    shows: ours,
    opens: [
      { when: peace, why: "in_war" },
      { when: someOpen(PLEDGE), why: "no_road" },
    ],
    needs: { office: "chancellor" },
    against: ["right"],
    authority: 10,
    cooldown: 6,
    target: { kind: "country", of: PLEDGE },
    tags: ["realign"],
    effects: [],
    scene: "fra_pw_pledge_r",
  },
  {
    id: "fra_pw_alliance",
    tag: "FRA",
    group: "treaty",
    kind: "lawful",
    shows: ours,
    opens: [{ when: someOpen(ALLY), why: "no_road" }],
    needs: { office: "chancellor" },
    against: ["right", "hard"],
    authority: 20,
    cooldown: 12,
    slot: true,
    target: { kind: "country", of: ALLY },
    tags: ["realign"],
    effects: [],
    // A secret the Chamber learns: the revanche in the streets.
    risk: {
      pct: 20,
      mods: [{ when: { kind: "rumour", min: 3 }, add: 15 }],
      then: [heat("fra_tiger", 2), reason("fra_pw_alliance_out")],
      heats: [{ id: "fra_pl_elysee", by: 1 }],
    },
    scene: "fra_pw_alliance_r",
  },
];

export const FRA_ROAD_REACTORS: readonly GwReactorRow[] = [
  // The revanchists: the Action française and Clemenceau's friends.
  {
    tag: "realign",
    nation: "FRA",
    actor: "other",
    delta: -1,
    key: "fra_pw_r_revanche",
    does: [heat("fra_af"), heat("fra_tiger")],
  },
  // The socialists, who fought the three-year law, are glad of it.
  {
    tag: "realign",
    nation: "FRA",
    actor: "other",
    delta: 1,
    key: "fra_pw_r_sfio",
    does: [cool("fra_sfio")],
  },
  // Caillaux's radicals: the 1911 bargain, again.
  {
    tag: "realign",
    nation: "FRA",
    actor: "other",
    delta: 1,
    key: "fra_pw_r_caillaux",
    does: [cool("fra_caillaux")],
  },
  // The officers who were raised on the lost provinces.
  {
    tag: "realign",
    nation: "FRA",
    actor: "people",
    of: ["army"],
    delta: -1,
    key: "fra_pw_r_army",
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

export const FRA_ROAD_SCENES: readonly GwScene[] = [
  card("fra_pw_pledge_r"),
  card("fra_pw_alliance_r"),
  // Caillaux, who made the 1911 bargain, on making another; once, in peace.
  summons({
    id: "fra_road_t_caillaux",
    nation: NATION,
    person: "fra_caillaux",
    when: all(
      ours,
      peace,
      { kind: "person_active", person: "fra_caillaux" },
      road("DEU", { max: 2 }),
    ),
    nodes: {
      open: node([
        reply("ask_agadir", "frank", "ask", "agadir"),
        reply("ask_price", "frank", "ask", "price"),
        reply("leave", "cold", "leave", null),
      ]),
      agadir: node([
        reply("go_on", "warm", "deal", "end", [bond("DEU", 1), feeler]),
        reply("leave", "cold", "leave", null),
      ]),
      price: node([
        reply("go_on", "warm", "deal", "end", [bond("DEU", 1), feeler]),
        reply("close", "cold", "leave", null),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
];

export const FRA_ROAD_DIARY: readonly GwDiaryRow[] = roadDiary("fra_di", "FRA");
