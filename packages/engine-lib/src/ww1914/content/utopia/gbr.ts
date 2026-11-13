import type {
  GwAxisPush,
  GwNodeKind,
  GwNodeTier,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwNodeRow, GwTreeRow, GwUtopiaContent } from "../../UtopiaRows";

// ww207 (W-GBR): GBR's faction trees: a template each, every node bent to
// the faction's own (its kind, what it gives, its axis push), one node of its
// own, and the regime and head a realised utopia brings. Text:
// resources/ww1914/ko/GBR.house.json `utopia.<id>` (names of all nine nodes
// and the own one). See /home/eser/dev/ww207-format.md.
//
// The axes: union (연합 - / 자치 +), class (재산 - / 노동 +), rule (통제 - / 자유 +).
// Facts behind the names, from memory (F): the Free Trade Union (1903); the
// Primrose League (1883); the Tariff Reform League (1903); Lord Roberts's
// National Service League; the Daily Herald (1912); the War Emergency
// Workers' National Committee (Aug 1914); Labour and the New Social Order
// (1918); the National Volunteers (Sep 1914); the Freeman's Journal; the
// Parliament House on College Green; the Ministry of Munitions (1915) and its
// "men of push and go"; the Ministry of Reconstruction (1917); the coupon
// (1918); Lloyd George's Garden Suburb secretariat; "homes fit for heroes"
// (Wolverhampton, Nov 1918).

type Bend = Partial<Omit<GwNodeRow, "id" | "tier">>;

const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const inst = (
  i: "cabinet" | "commons" | "opposition" | "irish",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const ireland = (delta: number): GwEffect => ({
  kind: "pressure",
  topic: "ireland",
  delta,
});
const trustOf = (id: string, delta: number): GwEffect =>
  doWorld({ do: "community_trust", id, delta });
const support = (id: string, delta: number): GwEffect =>
  doWorld({ do: "support", id, delta });

/** A bent node: what it gives, and the axes it moves. */
const n = (
  kind: GwNodeKind,
  effects: GwEffect[],
  axes?: GwAxisPush,
  more: Bend = {},
): Bend => ({
  kind,
  effects,
  ...(axes === undefined ? {} : { axes }),
  ...more,
});
/** Its own node, in place of a template node of the same tier. */
const own = (
  id: string,
  tier: GwNodeTier,
  replaces: string,
  kind: GwNodeKind,
  effects: GwEffect[],
  axes?: GwAxisPush,
): GwNodeRow & { readonly replaces: string } => ({
  id,
  tier,
  kind,
  effects,
  ...(axes === undefined ? {} : { axes }),
  replaces,
});
const law = (id: string): Bend => ({ kind: "law", law: id });
const ability = (power: string): Bend => ({ kind: "ability", power });

const trees: GwTreeRow[] = [
  // Free trade, Home Rule and a house the people choose: the Liberal state.
  {
    faction: "gbr_liberals",
    template: "parliament",
    utopia: "gbr_free_empire",
    bend: {
      m1: n("perk", [opinion("business", 1)], { rule: 1 }),
      m2: n("institution", [opinion("press", 1)], undefined, {
        institution: "gbr_liberal_press",
      }),
      m3: ability("gbr_pw_ab_liberals"),
      b1: law("gbr_x_senate"),
      b2: n("perk", [
        trustOf("gbr_nonconformists", 1),
        support("gbr_liberals", 1),
      ]),
      b3: n(
        "institution",
        [inst("irish", 1)],
        { union: 1 },
        {
          institution: "gbr_home_rule_council",
        },
      ),
      x1: n("perk", [gauge("morale", 1), gauge("order", -1)], { rule: 1 }),
      x3: n(
        "institution",
        [inst("commons", 2)],
        { rule: 1 },
        {
          institution: "gbr_peoples_house",
        },
      ),
    },
    own: [
      own("dominions", "extreme", "x2", "perk", [ireland(-2)], { union: 1 }),
    ],
  },
  // Tariff Reform and the Empire as one: Chamberlain's dream.
  {
    faction: "gbr_unionists",
    template: "market_empire",
    utopia: "gbr_imperial_union",
    bend: {
      m1: n("perk", [opinion("business", 1)], { union: -1 }),
      m2: n("institution", [opinion("court", 1)], undefined, {
        institution: "gbr_primrose_league",
      }),
      m3: ability("gbr_pw_ab_unionists"),
      b1: law("gbr_x_tariff"),
      b2: n("institution", [gauge("money", 1)], undefined, {
        institution: "gbr_imperial_council",
      }),
      b3: n("perk", [opinion("army", 1)], { rule: -1 }),
      x1: n("perk", [inst("irish", -2), trustOf("gbr_ulster_church", 2)], {
        union: -1,
      }),
      x3: n("perk", [gauge("money", 1)], { class: -1 }),
    },
    own: [
      own(
        "imperial_parliament",
        "extreme",
        "x2",
        "institution",
        [inst("commons", -1), opinion("business", 1)],
        { union: -1 },
      ),
    ],
  },
  // The national minimum: Labour's 1918 programme, and a Labour government.
  // Decision 1B: Asquith goes; the seat may play on as Henderson (lane P's
  // ruler row `henderson`; the regime `gbr_labour` is S2's to make).
  {
    faction: "gbr_labour",
    template: "labour",
    utopia: "gbr_national_minimum",
    regime: "gbr_labour",
    head: "henderson",
    bend: {
      m1: n("perk", [trustOf("gbr_unions", 1)]),
      m2: n("institution", [opinion("workers", 1)], undefined, {
        institution: "gbr_daily_herald",
      }),
      m3: ability("gbr_pw_ab_labour"),
      b1: law("gbr_x_mines"),
      b2: n("institution", [gauge("order", 1)], undefined, {
        institution: "gbr_workers_committee",
      }),
      b3: n("perk", [support("gbr_labour", 1)], { class: 1 }),
      x1: n("perk", [gauge("money", 1), opinion("business", -1)], { class: 1 }),
      x3: n("institution", [opinion("workers", 1)], undefined, {
        institution: "gbr_labour_cabinet",
      }),
    },
    own: [
      own(
        "new_social_order",
        "extreme",
        "x2",
        "perk",
        [support("gbr_labour", 1), trustOf("gbr_unions", 1)],
        { class: 1 },
      ),
    ],
  },
  // Ireland's own parliament on College Green, with its own purse.
  {
    faction: "gbr_irish",
    template: "nation",
    utopia: "gbr_irish_parliament",
    bend: {
      m1: n("perk", [ireland(-1)]),
      m2: n("institution", [inst("irish", 1)], undefined, {
        institution: "gbr_freemans_journal",
      }),
      m3: ability("gbr_pw_ab_irish"),
      b1: law("gbr_x_irish_purse"),
      b2: n("perk", [trustOf("gbr_irish_catholics", 1)], { class: 1 }),
      b3: n(
        "institution",
        [inst("irish", 1)],
        { union: 1 },
        {
          institution: "gbr_college_green",
        },
      ),
      x1: n("perk", [ireland(-1), opinion("army", 1)]),
      x3: n("perk", [ireland(-2)], { union: 1 }),
    },
    own: [
      own(
        "one_ireland",
        "extreme",
        "x2",
        "perk",
        [trustOf("gbr_ulster_church", -2), inst("irish", 2)],
        { union: 1 },
      ),
    ],
  },
  // Lloyd George's men: win the war by the state's hand, then build the
  // homes fit for heroes.
  {
    faction: "gbr_lg",
    template: "crown_army",
    utopia: "gbr_heroes",
    bend: {
      m1: n("perk", [gauge("shells", 1)]),
      m2: n(
        "institution",
        [gauge("shells", 1)],
        { rule: -1 },
        {
          institution: "gbr_munitions_ministry",
        },
      ),
      m3: ability("gbr_pw_ab_lg"),
      b1: n("perk", [inst("cabinet", 1)], { rule: -1 }),
      b2: n("institution", [gauge("order", 1)], undefined, {
        institution: "gbr_reconstruction",
      }),
      b3: n("perk", [support("gbr_lg", 1)]),
      x1: n("perk", [support("gbr_lg", 1), support("gbr_liberals", -1)], {
        rule: -1,
      }),
      x3: n("institution", [inst("cabinet", 1)], undefined, {
        institution: "gbr_garden_suburb",
      }),
    },
    own: [
      own(
        "homes_for_heroes",
        "extreme",
        "x2",
        "perk",
        [gauge("morale", 1), gauge("money", -1)],
        { class: 1 },
      ),
    ],
  },
];

export const GBR_UTOPIA: GwUtopiaContent = { trees };
