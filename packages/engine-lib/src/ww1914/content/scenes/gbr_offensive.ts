// Great War 1914 (ww173 phase B): GBR's scenes of its great offensives:
// the plan laid out (`gbr_w_off_prep`), each round's result
// (`gbr_w_off_result`), an enemy offensive met (`gbr_w_off_defended`), the
// army's refusal (`gbr_w_off_mutiny`). Owned by the GBR writer lane; shapes
// and conditions in /home/eser/dev/ww173-formatb.md. Text in
// resources/ww1914/ko/GBR.offensive.json.
//
// The engine lays them (Offensives.callScene); the state picks the variant.
// A variant's weight is how many leaves its `when` has (SceneRun.specificity),
// so each fact is a leaf of its own: result, front, method, era, round.
import type {
  GwEra,
  GwGauge,
  GwOffMethod,
  GwOffResult,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  memory,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["GBR"];

type Side = "ours" | "foe";
const res = (side: Side, ...of: GwOffResult[]): GwCond =>
  world({ is: "offensive", side, result: of });
const at = (side: Side, ...of: GwTheatre[]): GwCond =>
  world({ is: "offensive", side, theatre: of });
const by = (side: Side, ...of: GwOffMethod[]): GwCond =>
  world({ is: "offensive", side, method: of });
const rounds = (side: Side, min: number, max?: number): GwCond =>
  world(
    max === undefined
      ? { is: "offensive", side, min }
      : { is: "offensive", side, min, max },
  );
const era = (...of: GwEra[]): GwCond => world({ is: "era", of });
const tanks = world({ is: "tech", id: "tanks" });
const SOUTH: GwTheatre[] = ["palestine", "mesopotamia", "straits", "persia"];
const GAINED: GwOffResult[] = ["break", "bite"];
const STUCK: GwOffResult[] = ["attrition", "repulsed"];

const v = (id: string, ...when: GwCond[]): GwVariant =>
  when.length === 0
    ? { id }
    : { id, when: when.length === 1 ? when[0] : all(...when) };
const o = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const commons = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "commons",
  delta,
});
const promised = memory("m_gbr_off_promised");

const report = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  scheduledOnly: true,
  noBack: true,
  cast: {},
  salience: 7,
  tags: ["war"],
  stamp: "confirmed",
  source: "staff",
  variants,
});

const staff = {
  any_of: [{ office: "chief_of_staff" as const }, { office: "war" as const }],
};

export const GBR_OFFENSIVE_SCENES: readonly GwScene[] = [
  // The chapter after the Prime Minister signs "대공세를 준비한다".
  {
    id: "gbr_w_off_prep",
    nation: NATION,
    kind: "proposal",
    scheduledOnly: true,
    noBack: true,
    cast: { cos: staff },
    salience: 8,
    tags: ["war"],
    variants: [
      v("cambrai", at("ours", "west"), by("ours", "surprise"), tanks),
      v(
        "amiens",
        at("ours", "west"),
        by("ours", "surprise", "broad"),
        era("storm"),
      ),
      v("messines", at("ours", "west"), by("ours", "long"), era("depth")),
      v("somme", at("ours", "west"), by("ours", "long"), era("material")),
      v("loos", at("ours", "west"), era("trenches")),
      v("west_broad", at("ours", "west"), by("ours", "broad")),
      v("west_surprise", at("ours", "west"), by("ours", "surprise")),
      v("gaza", at("ours", "palestine")),
      v("baghdad", at("ours", "mesopotamia")),
      v("suvla", at("ours", "straits")),
      v("west", at("ours", "west")),
      v("base"),
    ],
    fallback: "quiet",
    options: [
      o("quiet", [trustOf(role("cos"), 1), reason("gbr_off_quiet")]),
      o("papers", [
        gauge("morale", 1),
        remember("m_gbr_off_promised"),
        reason("gbr_off_promised"),
      ]),
      o("ask_toll", [
        trustOf(role("cos"), -1),
        remember("m_gbr_off_asked"),
        reason("gbr_off_asked"),
      ]),
      o(
        "paris",
        [{ kind: "trust", tag: "FRA", delta: 1 }, reason("gbr_off_paris")],
        world({ is: "entered", tag: "FRA", side: "entente" }),
      ),
    ],
  },

  // After each round of our own offensive (rounds 1-4).
  report("gbr_w_off_result", [
    v(
      "cambrai",
      res("ours", ...GAINED),
      at("ours", "west"),
      by("ours", "surprise"),
      tanks,
    ),
    v("amiens", res("ours", ...GAINED), at("ours", "west"), era("storm")),
    v(
      "messines",
      res("ours", "bite"),
      at("ours", "west"),
      by("ours", "long"),
      era("depth"),
    ),
    v(
      "somme_first",
      res("ours", ...STUCK),
      at("ours", "west"),
      by("ours", "long"),
      rounds("ours", 1, 1),
    ),
    v(
      "mud",
      res("ours", ...STUCK),
      at("ours", "west"),
      era("material", "depth"),
      rounds("ours", 2),
    ),
    v("loos", res("ours", ...STUCK), at("ours", "west"), era("trenches")),
    v("promised", res("ours", ...STUCK), promised),
    v("west_break", res("ours", "break"), at("ours", "west")),
    v("west_bite", res("ours", "bite"), at("ours", "west")),
    v("west_stuck", res("ours", ...STUCK), at("ours", "west")),
    v("gaza", res("ours", ...GAINED), at("ours", "palestine")),
    v("baghdad", res("ours", ...GAINED), at("ours", "mesopotamia")),
    v("suvla", res("ours", ...STUCK), at("ours", "straits")),
    v("south_stuck", res("ours", ...STUCK), at("ours", ...SOUTH)),
    v("break", res("ours", "break")),
    v("bite", res("ours", "bite")),
    v("attrition", res("ours", "attrition")),
    v("repulsed", res("ours", "repulsed")),
    v("base"),
  ]),

  // After each round of an enemy offensive on a front we hold.
  report("gbr_w_off_defended", [
    v("backs_wall", res("foe", ...GAINED), at("foe", "west"), era("storm")),
    v("gas", res("foe", ...GAINED), at("foe", "west"), era("trenches")),
    v(
      "bent_held",
      res("foe", ...STUCK),
      at("foe", "west"),
      era("depth", "storm"),
    ),
    v("west_gave", res("foe", ...GAINED), at("foe", "west")),
    v("west_held", res("foe", ...STUCK), at("foe", "west")),
    v("south_gave", res("foe", ...GAINED), at("foe", ...SOUTH)),
    v("south_held", res("foe", ...STUCK), at("foe", ...SOUTH)),
    v("gave", res("foe", ...GAINED)),
    v("held", res("foe", ...STUCK)),
    v("base"),
  ]),

  // Our repulsed army will not go again (strain high, morale low).
  {
    id: "gbr_w_off_mutiny",
    nation: NATION,
    kind: "proposal",
    scheduledOnly: true,
    noBack: true,
    cast: { cos: staff },
    salience: 8,
    tags: ["war", "home"],
    variants: [
      v("promised", at("ours", "west"), promised),
      v("base_camp", at("ours", "west")),
      v("south", at("ours", ...SOUTH)),
      v("base"),
    ],
    fallback: "courts",
    options: [
      o("courts", [
        gauge("order", 1),
        gauge("morale", -1),
        remember("m_gbr_mutiny_shot"),
        reason("gbr_off_mutiny_courts"),
      ]),
      o("grievances", [
        gauge("morale", 1),
        gauge("money", -1),
        trustOf(role("cos"), -1),
        reason("gbr_off_mutiny_leave"),
      ]),
      o("silence", [
        commons(-1),
        remember("m_gbr_mutiny_hidden"),
        reason("gbr_off_mutiny_hidden"),
      ]),
    ],
  },
];
