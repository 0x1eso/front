import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  chose,
  flag,
  GwCastRule,
  GwEffect,
  GwScene,
  GwVariant,
  memory,
  not,
  reason,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common share `world`: the `gw_n_` news and the `gw_x_` crises every seat
 * lives through. Data only; text is in resources/ww1914/ko/common.world.json.
 * Plan: ww135-plan-common.md sections 1 and 7. No form of address, no `voice`,
 * no `chancellor`: Britain has no holder, and one line serves four countries.
 */
/** Plain data: Content.test holds every scene to its schema. */
const w = (of: Record<string, unknown>) => world(of as never);

const date = (from: string, to: string) => w({ is: "date", from, to });
const except = (...tags: GwTag[]): GwTag[] =>
  GW_TAGS.filter((t) => !tags.includes(t));

// A seat out of the war reads the base text, whatever side it left.
const WAR = w({ is: "war" });
/** Whole months of war; `own`: since the seat's country came in (ww170). */
const months = (min?: number, max?: number) =>
  w({ is: "war_months", min, max });
const ownMonths = (min?: number, max?: number) =>
  w({ is: "war_months", own: true, min, max });
/** The calendar month: seasons and feasts keep their time of year. */
const inMonth = (...of: number[]) => w({ is: "month", of });
const CENTRAL = all(w({ is: "side", of: ["central"] }), WAR);
const ENTENTE = all(w({ is: "side", of: ["entente"] }), WAR);
/** The base is the neutral's: it must also hold for a seat that left the war. */
const SIDES: GwVariant[] = [
  { id: "central", when: CENTRAL },
  { id: "entente", when: ENTENTE },
  { id: "neutral" },
];
const CENTRAL_OR_BASE: GwVariant[] = [
  { id: "central", when: CENTRAL },
  { id: "base" },
];

/** No great war has begun in this game. */
const PEACE = not(w({ is: "war_age", min: 0 }));
const ARMISTICE = w({ is: "armistice" });

const FM: GwCastRule = { any_of: [{ office: "foreign" }, { favourite: true }] };
const COS: GwCastRule = {
  any_of: [{ office: "chief_of_staff" }, { favourite: true }],
};
const FIN: GwCastRule = {
  any_of: [{ office: "finance" }, { favourite: true }],
};

const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const manpower = (delta: number): GwEffect => ({
  kind: "world",
  of: { do: "manpower", delta },
});

type ReportOpts = Pick<GwScene, "nation" | "when" | "salience" | "tags"> &
  Partial<Pick<GwScene, "stamp" | "source" | "cooldown">> & {
    variants: GwVariant[];
    repeats?: boolean;
  };

/** A paper that is only read. Dealt once unless it `repeats`. */
function report(id: string, o: ReportOpts): GwScene {
  const { repeats, ...rest } = o;
  return {
    id,
    kind: "report",
    stage: ["war"],
    cast: {},
    stamp: "confirmed",
    source: "press",
    ...(repeats === true ? {} : { once: true }),
    ...rest,
  };
}

const BATTLE_ANY = ["break", "advance", "stalemate", "repelled"];
const GAINED = ["break", "advance"];
const foeGained = (theatre: string) =>
  w({ is: "battle", theatre, of: GAINED, by: "foe" });

const NEWS: readonly GwScene[] = [
  report("gw_n_gallipoli", {
    nation: except("GBR"),
    when: all(
      w({ is: "open", theatre: "straits" }),
      world({ is: "war_months", min: 8, max: 17 }),
    ),
    salience: 5,
    tags: ["war"],
    variants: SIDES,
  }),
  report("gw_n_kut", {
    nation: except("GBR"),
    when: all(
      w({ is: "front", theatre: "mesopotamia", from: "kut", to: "kut" }),
      world({ is: "war_months", min: 14, max: 22 }),
    ),
    salience: 4,
    tags: ["war"],
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_liner", {
    nation: except("DEU"),
    when: all(
      flag("w_liner_sunk"),
      world({ is: "war_months", min: 5, max: 32 }),
    ),
    salience: 6,
    tags: ["foreign", "tension_up"],
    variants: [
      { id: "lusitania", when: date("1915-03", "1915-09") },
      { id: "base" },
    ],
  }),
  report("gw_n_easter", {
    nation: except("GBR"),
    when: all(
      { kind: "pressure", topic: "ireland", min: 6 },
      WAR,
      months(12),
      // Easter Monday, and the news of it.
      inMonth(3, 4, 5),
    ),
    salience: 5,
    tags: ["foreign"],
    stamp: "unconfirmed",
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_verdun", {
    // France's own seat has its Verdun (lane ww166 W4).
    nation: except("DEU", "FRA"),
    when: all(
      w({ is: "battle", theatre: "west", of: BATTLE_ANY, by: "central" }),
      w({ is: "front", theatre: "west", from: "hindenburg", to: "aisne" }),
      world({ is: "war_months", min: 18, max: 29 }),
    ),
    salience: 6,
    tags: ["war"],
    variants: SIDES,
  }),
  report("gw_n_somme", {
    nation: except("GBR"),
    when: all(
      w({ is: "battle", theatre: "west", of: BATTLE_ANY, by: "entente" }),
      w({ is: "entered", tag: "GBR" }),
      world({ is: "war_months", min: 22, max: 28 }),
    ),
    salience: 6,
    tags: ["war"],
    variants: SIDES,
  }),
  report("gw_n_jutland", {
    nation: except("GBR", "DEU"),
    when: all(
      w({ is: "entered", tag: "GBR", side: "entente" }),
      w({ is: "entered", tag: "DEU", side: "central" }),
      // The fleets come out once the blockade has held a year and a half.
      months(18),
    ),
    salience: 5,
    tags: ["war"],
    stamp: "unconfirmed",
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_brusilov", {
    nation: except("RUS", "AUH"),
    when: all(
      w({ is: "battle", theatre: "east", of: GAINED, by: "entente" }),
      world({ is: "war_months", min: 21, max: 27 }),
    ),
    salience: 5,
    tags: ["war"],
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_tsar_falls", {
    nation: except("RUS"),
    when: all(
      w({
        is: "regime",
        tag: "RUS",
        of: ["provisional", "rep", "soviet"],
      }),
      world({ is: "war_months", min: 10 }),
    ),
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: SIDES,
  }),
  report("gw_n_october", {
    nation: except("RUS"),
    when: all(
      any(
        w({ is: "regime", tag: "RUS", of: ["soviet"] }),
        all(
          w({ is: "regime", tag: "RUS", of: ["provisional", "rep"] }),
          w({ is: "out", tag: "RUS" }),
        ),
      ),
      world({ is: "war_months", min: 10 }),
    ),
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: SIDES,
  }),
  report("gw_n_refusals", {
    // France's own seat has its mutinies (lane ww166 W4).
    nation: except("FRA"),
    when: all(
      { kind: "secret", id: "fra_army_refusals" },
      w({
        is: "battle",
        theatre: "west",
        of: ["repelled", "stalemate"],
        by: "entente",
      }),
      world({ is: "war_months", min: 31, max: 41 }),
    ),
    salience: 6,
    tags: ["war"],
    stamp: "unconfirmed",
    source: "agents",
    variants: SIDES,
  }),
  report("gw_n_caporetto", {
    nation: except("AUH"),
    when: all(
      w({ is: "front", theatre: "italy", from: "piave" }),
      world({ is: "war_months", min: 17, max: 51 }),
    ),
    salience: 6,
    tags: ["war"],
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_jerusalem", {
    nation: [...GW_TAGS],
    when: all(
      w({ is: "front", theatre: "palestine", from: "jerusalem" }),
      world({ is: "war_months", min: 17, max: 51 }),
    ),
    salience: 5,
    tags: ["war"],
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_unity", {
    nation: [...GW_TAGS],
    // AI Germany rarely attacks in the west after 1916: Russia's exit with
    // America in calls this too, or a seat would almost never read it.
    when: all(
      any(
        w({ is: "battle", theatre: "west", of: BATTLE_ANY, by: "central" }),
        flag("w_france_falling"),
        all(w({ is: "out", tag: "RUS" }), flag("w_america_in")),
      ),
      w({ is: "entered", tag: "GBR", side: "entente" }),
      world({ is: "war_months", min: 38, max: 50 }),
    ),
    salience: 5,
    tags: ["war"],
    variants: CENTRAL_OR_BASE,
  }),
  report("gw_n_bulgaria_falls", {
    nation: [...GW_TAGS],
    when: all(
      w({ is: "out", tag: "BGR" }),
      w({ is: "entered", tag: "BGR", side: "central" }),
      not(w({ is: "out", tag: "AUH" })),
      not(w({ is: "out", tag: "OTT" })),
      world({ is: "war_months", min: 17 }),
    ),
    salience: 7,
    tags: ["foreign", "tension_up"],
    variants: SIDES,
  }),
  // Record cards (plan §13): date, place, number. No option, price or feeling.
  report("gw_n_record_armenia", {
    nation: [...GW_TAGS],
    when: all(
      w({ is: "entered", tag: "OTT", side: "central" }),
      w({ is: "in_war", tag: "OTT", min: 3 }),
      world({ is: "war_months", min: 10, max: 17 }),
    ),
    salience: 4,
    tags: ["foreign"],
    variants: [{ id: "base" }],
  }),
  report("gw_n_record_blockade", {
    nation: [...GW_TAGS],
    when: all(
      w({ is: "blockade", min: 6 }),
      world({ is: "war_months", min: 29 }),
    ),
    salience: 3,
    tags: ["home"],
    stamp: "estimate",
    repeats: true,
    cooldown: 12,
    variants: [
      { id: "winter", when: date("1917-01", "1917-12") },
      { id: "base" },
    ],
  }),
  report("gw_n_record_kut", {
    nation: [...GW_TAGS],
    when: all(
      w({ is: "front", theatre: "mesopotamia", from: "kut", to: "kut" }),
      any(
        w({
          is: "battle",
          theatre: "mesopotamia",
          of: ["repelled"],
          by: "entente",
        }),
        w({ is: "battle", theatre: "mesopotamia", of: GAINED, by: "central" }),
      ),
      world({ is: "war_months", min: 21, max: 35 }),
    ),
    salience: 3,
    tags: ["war"],
    stamp: "estimate",
    variants: [{ id: "base" }],
  }),
];

const WARTIME_READS: readonly GwScene[] = [
  report("gw_x_flu_spring", {
    nation: [...GW_TAGS],
    // The fever of a long war's camps and troopships, in the spring.
    when: all(months(36), inMonth(3, 4, 5, 6)),
    salience: 6,
    tags: ["home"],
    variants: SIDES,
  }),
  report("gw_x_weariness", {
    nation: [...GW_TAGS],
    when: all(
      WAR,
      { kind: "gauge", gauge: "morale", max: 2 },
      world({ is: "war_months", own: true, min: 23, max: 51 }),
    ),
    salience: 6,
    tags: ["home", "tension_down"],
    stamp: "estimate",
    source: "staff",
    repeats: true,
    cooldown: 8,
    variants: [
      { id: "y16", when: date("1916-07", "1916-12") },
      { id: "y17_spring", when: date("1917-01", "1917-06") },
      { id: "y18_spring", when: date("1918-01", "1918-05") },
      { id: "y18_late", when: date("1918-06", "1918-10") },
      { id: "base" },
    ],
  }),
  report("gw_x_rails_worn", {
    nation: [...GW_TAGS],
    when: all(WAR, world({ is: "war_months", own: true, min: 23, max: 49 })),
    salience: 5,
    tags: ["home"],
    source: "staff",
    repeats: true,
    cooldown: 10,
    variants: [
      { id: "coal", when: all(chose("gw_x_coal_winter", "army"), WAR) },
      { id: "y16", when: date("1916-07", "1916-12") },
      { id: "base" },
    ],
  }),
  report("gw_x_veterans", {
    nation: [...GW_TAGS],
    when: all(
      WAR,
      w({ is: "casualties", min: 200 }),
      world({ is: "war_months", own: true, min: 17, max: 49 }),
    ),
    salience: 4,
    tags: ["home", "tension_down"],
    repeats: true,
    cooldown: 12,
    variants: [{ id: "sleeve" }, { id: "field" }, { id: "base" }],
  }),
  report("gw_x_christmas", {
    nation: [...GW_TAGS],
    // The war's second, third and fourth Christmas for the seat's own men.
    when: all(WAR, inMonth(12), ownMonths(12, 47)),
    salience: 4,
    tags: ["war", "tension_down"],
    repeats: true,
    cooldown: 10,
    variants: [
      { id: "y15", when: ownMonths(12, 23) },
      { id: "y16", when: ownMonths(24, 35) },
      { id: "base" },
    ],
  }),
  report("gw_x_russia_gone", {
    nation: except("RUS"),
    when: all(
      w({ is: "out", tag: "RUS" }),
      world({ is: "war_months", min: 34, max: 51 }),
    ),
    salience: 7,
    tags: ["war"],
    source: "staff",
    variants: SIDES,
  }),
  report("gw_x_americans", {
    nation: except("USA"),
    when: all(
      flag("w_america_in"),
      w({ is: "in_war", tag: "USA", min: 6 }),
      world({ is: "war_months", min: 38 }),
    ),
    salience: 8,
    tags: ["war", "tension_up"],
    variants: SIDES,
  }),
  report("gw_x_peace_spark", {
    nation: [...GW_TAGS],
    when: all(
      PEACE,
      any(
        { kind: "crisis", topic: "balkan" },
        { kind: "crisis", topic: "straits" },
        { kind: "crisis", topic: "colonial" },
      ),
      world({ is: "war_months", min: 5, max: 35 }),
    ),
    salience: 6,
    tags: ["foreign", "tension_up"],
    repeats: true,
    cooldown: 8,
    variants: [
      { id: "balkan", when: { kind: "crisis", topic: "balkan" } },
      { id: "straits", when: { kind: "crisis", topic: "straits" } },
      { id: "colonial" },
    ],
  }),
];

const FLU_AFTER = all(ARMISTICE, not(WAR));

const DECISIONS: readonly GwScene[] = [
  {
    id: "gw_x_coal_winter",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    // A hard winter on railways worn by two years of war.
    when: all(WAR, months(24), inMonth(12, 1, 2, 3)),
    cast: { fm: FM, fin: FIN },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "hungry",
        when: all(WAR, { kind: "gauge", gauge: "bread", max: 1 }),
      },
      { id: "central", when: CENTRAL },
      { id: "entente", when: ENTENTE },
      { id: "base" },
    ],
    fallback: "factories",
    options: [
      {
        id: "factories",
        tell: ["shells:+1", "order:-1"],
        effects: [
          gauge("shells", 1),
          gauge("order", -1),
          reason("gwx_coal_factories"),
        ],
      },
      {
        id: "homes",
        tell: ["order:+1", "shells:-1", "fin:-1"],
        effects: [
          gauge("order", 1),
          gauge("shells", -1),
          trustOf(role("fin"), -1),
          reason("gwx_coal_homes"),
        ],
      },
      {
        id: "army",
        tell: ["morale:+1", "bread:-1"],
        effects: [
          gauge("morale", 1),
          gauge("bread", -1),
          reason("gwx_coal_army"),
        ],
      },
    ],
  },
  {
    id: "gw_x_flu_autumn",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war", "conference", "closing"],
    // The spring's fever comes back in the autumn, and this time it kills.
    when: all(
      any({ kind: "seen", scene: "gw_x_flu_spring" }, months(44)),
      inMonth(8, 9, 10, 11, 12),
    ),
    cast: { fin: FIN },
    salience: 8,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      { id: "after", when: FLU_AFTER },
      { id: "central", when: CENTRAL },
      { id: "entente", when: ENTENTE },
      { id: "neutral" },
    ],
    fallback: "stay_open",
    options: [
      {
        id: "stay_open",
        tell: ["manpower:-3", "morale:-1"],
        effects: [manpower(-3), gauge("morale", -1), reason("gwx_flu_open")],
      },
      {
        id: "close_schools",
        tell: ["manpower:-2", "order:-1"],
        effects: [manpower(-2), gauge("order", -1), reason("gwx_flu_schools")],
      },
      {
        id: "close_all",
        when: memory("k_alfonso_office"),
        tell: ["manpower:-1", "shells:-1", "fin:-1"],
        effects: [
          manpower(-1),
          gauge("shells", -1),
          trustOf(role("fin"), -1),
          reason("gwx_flu_all"),
        ],
      },
    ],
  },
  {
    id: "gw_x_blast",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(WAR, world({ is: "war_months", own: true, min: 17, max: 49 })),
    cast: { fin: FIN },
    salience: 5,
    tags: ["home"],
    cooldown: 16,
    variants: [
      {
        id: "blamed",
        when: all(
          chose("gw_x_blast", "blame_enemy"),
          WAR,
          date("1916-01", "1918-08"),
        ),
      },
      { id: "powder" },
      { id: "base" },
    ],
    fallback: "rebuild",
    options: [
      {
        id: "rebuild",
        tell: ["money:-1"],
        effects: [gauge("money", -1), reason("gwx_blast_rebuild")],
      },
      {
        id: "inquiry",
        tell: ["shells:-1", "order:+1"],
        effects: [
          gauge("shells", -1),
          gauge("order", 1),
          reason("gwx_blast_inquiry"),
        ],
      },
      {
        id: "blame_enemy",
        tell: ["morale:+1", "order:-1"],
        effects: [
          gauge("morale", 1),
          gauge("order", -1),
          reason("gwx_blast_blame"),
        ],
      },
    ],
  },
  {
    id: "gw_x_horses",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(WAR, world({ is: "war_months", own: true, min: 11, max: 35 })),
    cast: { cos: COS, fin: FIN },
    salience: 5,
    tags: ["war"],
    once: true,
    variants: CENTRAL_OR_BASE,
    fallback: "army_takes",
    options: [
      {
        id: "army_takes",
        tell: ["bread:-1", "cos:+1"],
        effects: [
          gauge("bread", -1),
          trustOf(role("cos"), 1),
          reason("gwx_horses_army"),
        ],
      },
      {
        id: "farms_keep",
        tell: ["shells:-1", "cos:-1"],
        effects: [
          gauge("shells", -1),
          trustOf(role("cos"), -1),
          reason("gwx_horses_farms"),
        ],
      },
      {
        id: "buy_abroad",
        tell: ["money:-1", "fin:-1"],
        effects: [
          gauge("money", -1),
          trustOf(role("fin"), -1),
          reason("gwx_horses_abroad"),
        ],
      },
    ],
  },
  {
    id: "gw_x_prices",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(
      { kind: "gauge", gauge: "money", max: 1 },
      world({ is: "war_months", min: 11, max: 49 }),
      not(PEACE),
    ),
    cast: { fin: FIN },
    salience: 6,
    tags: ["home"],
    cooldown: 8,
    variants: [
      {
        id: "printed",
        when: all(
          chose("gw_x_prices", "print"),
          WAR,
          date("1915-07", "1918-08"),
        ),
      },
      { id: "central", when: CENTRAL },
      { id: "entente", when: ENTENTE },
      { id: "neutral" },
    ],
    fallback: "print",
    options: [
      {
        id: "print",
        tell: ["money:+1", "order:-1"],
        effects: [
          gauge("money", 1),
          gauge("order", -1),
          reason("gwx_prices_print"),
        ],
      },
      {
        id: "tax_part",
        tell: ["money:+1", "morale:-1", "fin:+1"],
        effects: [
          gauge("money", 1),
          gauge("morale", -1),
          trustOf(role("fin"), 1),
          reason("gwx_prices_tax"),
        ],
      },
      {
        id: "freeze_prices",
        tell: ["order:+1", "bread:-1", "fin:-1"],
        effects: [
          gauge("order", 1),
          gauge("bread", -1),
          trustOf(role("fin"), -1),
          reason("gwx_prices_freeze"),
        ],
      },
    ],
  },
  {
    id: "gw_x_refugees",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(
      WAR,
      any(
        foeGained("east"),
        foeGained("west"),
        foeGained("balkan"),
        foeGained("italy"),
        foeGained("caucasus"),
      ),
      world({ is: "war_months", own: true, min: 5, max: 41 }),
    ),
    cast: { fin: FIN },
    salience: 5,
    tags: ["home"],
    cooldown: 10,
    variants: [
      { id: "east", when: foeGained("east") },
      { id: "west", when: foeGained("west") },
      { id: "base" },
    ],
    fallback: "camps",
    options: [
      {
        id: "camps",
        tell: ["morale:-1"],
        effects: [gauge("morale", -1), reason("gwx_refugees_camps")],
      },
      {
        id: "towns_take",
        tell: ["order:-1", "morale:+1"],
        effects: [
          gauge("order", -1),
          gauge("morale", 1),
          reason("gwx_refugees_towns"),
        ],
      },
      {
        id: "abroad",
        tell: ["money:-1"],
        effects: [gauge("money", -1), reason("gwx_refugees_abroad")],
      },
    ],
  },
  {
    id: "gw_x_peace_arms",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(PEACE, world({ is: "war_months", min: 5, max: 29 })),
    cast: { fin: FIN, cos: COS },
    salience: 6,
    tags: ["home"],
    cooldown: 8,
    variants: [
      {
        id: "raced",
        when: all(
          chose("gw_x_peace_arms", "race"),
          PEACE,
          date("1915-01", "1916-12"),
        ),
      },
      { id: "budget" },
      { id: "base" },
    ],
    fallback: "steady",
    options: [
      {
        id: "steady",
        tell: [],
        effects: [reason("gwx_arms_steady")],
      },
      {
        id: "cut_a_little",
        tell: ["money:+1", "cos:-1"],
        effects: [
          gauge("money", 1),
          trustOf(role("cos"), -1),
          reason("gwx_arms_cut"),
        ],
      },
      {
        id: "race",
        tell: ["money:-1", "temp:+1", "cos:+1"],
        effects: [
          gauge("money", -1),
          { kind: "temp", delta: 1 },
          trustOf(role("cos"), 1),
          reason("gwx_arms_race"),
        ],
      },
    ],
  },
  {
    id: "gw_x_peace_conference",
    nation: [...GW_TAGS],
    kind: "proposal",
    stage: ["war"],
    when: all(PEACE, world({ is: "war_months", min: 7, max: 35 })),
    cast: { fm: FM },
    salience: 6,
    tags: ["foreign", "tension_down"],
    cooldown: 8,
    variants: [
      {
        id: "proposed",
        when: all(
          chose("gw_x_peace_conference", "real_proposal"),
          PEACE,
          date("1915-03", "1917-06"),
        ),
      },
      { id: "late", when: date("1916-01", "1917-06") },
      { id: "base" },
    ],
    fallback: "send_delegate",
    options: [
      {
        id: "send_delegate",
        tell: [],
        effects: [reason("gwx_hague_send")],
      },
      {
        id: "boycott",
        tell: ["temp:+1", "fm:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          trustOf(role("fm"), -1),
          reason("gwx_hague_boycott"),
        ],
      },
      {
        id: "real_proposal",
        tell: ["temp:-1", "fm:+1", "shells:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          trustOf(role("fm"), 1),
          gauge("shells", -1),
          reason("gwx_hague_real"),
        ],
      },
    ],
  },
  {
    id: "gw_x_peace_close",
    nation: except("DEU"),
    kind: "proposal",
    stage: ["war"],
    when: all(
      PEACE,
      { kind: "temp", max: 3 },
      not(w({ is: "chain" })),
      world({ is: "war_months", min: 11 }),
    ),
    cast: { fm: FM },
    salience: 7,
    tags: ["home", "tension_down"],
    cooldown: 12,
    variants: [
      { id: "again", when: flag("f_gwx_one_more_year") },
      { id: "base" },
    ],
    fallback: "go_on",
    options: [
      {
        id: "go_on",
        tell: [],
        effects: [reason("gwx_close_on")],
      },
      {
        id: "close_as_peace",
        tell: ["ends_game"],
        effects: [{ kind: "end", ending: "long_peace" }],
      },
      {
        id: "one_more_year",
        tell: ["temp:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          setFlag("f_gwx_one_more_year"),
          reason("gwx_close_year"),
        ],
      },
    ],
  },
];

export const GW_WORLD2_SCENES: readonly GwScene[] = [
  ...NEWS,
  ...WARTIME_READS,
  ...DECISIONS,
];
