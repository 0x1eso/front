// ww222 (W2): Russia's roads to the other camp (design ww220 R3, "Björkö's
// road"). The Tsar's letters to "Willy", Durnovo's line, a Balkan bargain
// with Vienna, Paris's loans held back: the envoy department's courses, an
// audience with Durnovo, the pledge and alliance rows on the 통치 tab, the
// Pan-Slavs against and the court's German party for, four diary lines.
// Text: RUS.depts.json (answers), RUS.powers.json (rows, cards, the talk,
// reasons), RUS.persona.json (diary).
//
// Facts used: Björkö (24 July 1905, Nicholas and Wilhelm, never in force);
// the Potsdam agreement on Persia and the Baghdad railway (1910-11); the
// Austro-Russian understanding on the Balkans (1897); the Durnovo memorandum
// (February 1914); Novoye Vremya, the Pan-Slav daily; the Fundamental Laws'
// Art. 13 (treaties are the Emperor's). Not checked: the exact days of the
// Potsdam talks, so the text names only the years.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwAnswerRow } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwDiaryRow } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
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
} from "./kit";

const NATION: GwTag[] = ["RUS"];
const reigns = world({ is: "regime", tag: "RUS", of: ["tsar", "crown"] });
const feeler = remember("rus_road_feeler");
/** Paris holds its loans back: the bond with France has gone cold. */
const parisCold: GwCond = world({ is: "bond", tag: "FRA", max: -1 });

const ans = (
  id: string,
  type: GwAnswerRow["type"],
  topic: GwTag,
  findings: GwAnswerRow["findings"],
  courses: GwAnswerRow["courses"],
): GwAnswerRow => ({
  id: `rus_ans_${id}`,
  nation: NATION,
  type,
  topic: [topic],
  findings,
  courses,
});

export const RUS_ROAD_ANSWERS: readonly GwAnswerRow[] = [
  // 외무부 on Berlin: the road, the cousins' letters, Paris's purse.
  ans(
    "road_deu",
    "envoy",
    "DEU",
    [
      ...roadFindings("DEU"),
      f("willy", 2, { when: peace }),
      f("paris_cold", 2, { when: parisCold }),
    ],
    roadCourses("rus", "DEU", "colonial"),
  ),
  // 외무부 on Vienna: the Balkans as the one question between the two.
  ans(
    "road_auh",
    "envoy",
    "AUH",
    [...roadFindings("AUH"), f("balkans", 2, { when: peace })],
    roadCourses("rus", "AUH", "balkan"),
  ),
  // 외무부 on Paris: an ally that warms to Berlin, and the answer to it.
  ans(
    "road_fra",
    "envoy",
    "FRA",
    [f("paris_berlin", 3, { when: road("DEU", { of: "FRA", min: 1 }) })],
    [
      c("road_remind", ["gentle", "calm"], [bond("FRA", 1)], {
        when: all(peace, road("DEU", { of: "FRA", min: 1 })),
      }),
    ],
  ),
  // 정보부 on Germany: whom Berlin talks to besides us.
  ans(
    "road_intel_deu",
    "intel",
    "DEU",
    [
      f("envoys_london", 3, { when: road("GBR", { of: "DEU", min: 1 }) }),
      f("envoys_paris", 3, { when: road("FRA", { of: "DEU", min: 1 }) }),
    ],
    [],
  ),
];

const PLEDGE = [pledgeTo("DEU"), pledgeTo("AUH")];
const ALLY = [allyWith("DEU"), allyWith("AUH")];

export const RUS_ROAD_POWERS: readonly GwPowerRow[] = [
  // Art. 13: a treaty is the Emperor's; the foreign minister signs under it.
  {
    id: "rus_pw_pledge",
    tag: "RUS",
    group: "treaty",
    kind: "lawful",
    shows: reigns,
    opens: [
      { when: peace, why: "in_war" },
      { when: someOpen(PLEDGE), why: "no_road" },
    ],
    needs: { office: "foreign" },
    against: ["duma"],
    authority: 10,
    cooldown: 6,
    target: { kind: "country", of: PLEDGE },
    tags: ["realign"],
    effects: [],
    scene: "rus_pw_pledge_r",
  },
  {
    id: "rus_pw_alliance",
    tag: "RUS",
    group: "treaty",
    kind: "lawful",
    shows: reigns,
    opens: [{ when: someOpen(ALLY), why: "no_road" }],
    needs: { office: "foreign" },
    against: ["duma", "hard"],
    authority: 20,
    cooldown: 12,
    slot: true,
    target: { kind: "country", of: ALLY },
    tags: ["realign"],
    effects: [],
    risk: {
      pct: 15,
      mods: [{ when: { kind: "bloc", bloc: "army", max: -1 }, add: 20 }],
      then: [
        { kind: "opinion", bloc: "army", delta: -1 },
        reason("rus_pw_alliance_split"),
      ],
      heats: [{ id: "rus_pl_generals", by: 1 }],
    },
    scene: "rus_pw_alliance_r",
  },
];

export const RUS_ROAD_REACTORS: readonly GwReactorRow[] = [
  // The Pan-Slavs in the Duma: the nationalists and the Kadets of the Straits.
  {
    tag: "realign",
    nation: "RUS",
    actor: "other",
    delta: -1,
    key: "rus_pw_r_panslav",
    does: [heat("rus_pnat"), heat("rus_kadets")],
  },
  // Novoye Vremya and the Moscow papers.
  {
    tag: "realign",
    nation: "RUS",
    actor: "people",
    of: ["press"],
    delta: -1,
    key: "rus_pw_r_papers",
  },
  // The court's German party, Durnovo's line, is glad of it.
  {
    tag: "realign",
    nation: "RUS",
    actor: "people",
    of: ["court"],
    delta: 1,
    key: "rus_pw_r_german_party",
    does: [cool("rus_rights")],
  },
  // An alliance splits the army: the officers raised against Germany.
  {
    tag: "realign",
    nation: "RUS",
    actor: "people",
    of: ["army"],
    delta: -1,
    powers: ["rus_pw_alliance"],
    key: "rus_pw_r_army_split",
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

export const RUS_ROAD_SCENES: readonly GwScene[] = [
  card("rus_pw_pledge_r"),
  card("rus_pw_alliance_r"),
  // Durnovo, out of office, on the road to Berlin; once, in peace.
  summons({
    id: "rus_road_t_durnovo",
    nation: NATION,
    person: "rus_durnovo",
    when: all(
      reigns,
      peace,
      { kind: "person_active", person: "rus_durnovo" },
      road("DEU", { max: 2 }),
    ),
    nodes: {
      open: node([
        reply("ask_berlin", "frank", "ask", "berlin"),
        reply("ask_cost", "frank", "ask", "cost"),
        reply("leave", "cold", "leave", null),
      ]),
      berlin: node([
        reply("write_willy", "warm", "deal", "end", [bond("DEU", 1), feeler]),
        reply("leave", "cold", "leave", null),
      ]),
      cost: node([
        reply("write_willy", "warm", "deal", "end", [bond("DEU", 1), feeler]),
        reply("close", "cold", "leave", null),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
];

export const RUS_ROAD_DIARY: readonly GwDiaryRow[] = roadDiary("rus_dy", "RUS");
