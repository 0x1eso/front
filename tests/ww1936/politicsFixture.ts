// World War 1936 P3 (spec §24.2, plan decision 7): small test content for
// the politics game tests. Every country plays the generic tree; the region
// groups name the ww1936pol test map's islands (plan "test map" table).
// Lanes add their own data: usePoliticsContent(politicsFixture({ events })).
import { TRAITS } from "@openfront/engine-lib/ww1936/content/advisors";
import { FLAGS_BASE } from "@openfront/engine-lib/ww1936/content/flags/base";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import {
  buildRegistry,
  ContentParts,
  ContentRegistry,
} from "@openfront/engine-lib/ww1936/content/registry";
import { START_NAPS } from "@openfront/engine-lib/ww1936/content/treaties";

/** Small test content (spec §24.2): 3 focuses, 3 events, 2 decisions, test groups, every country generic. */
export function politicsFixture(
  extra: Partial<ContentParts> = {},
): ContentRegistry {
  const base: ContentParts = {
    focuses: [
      {
        id: "gen_t_a",
        tree: "generic",
        x: 0,
        y: 0,
        days: 70,
        branch: "politics",
        icon: "flag",
        effects: [{ kind: "pp", amount: 50 }],
      },
      {
        id: "gen_t_b",
        tree: "generic",
        x: 0,
        y: 1,
        days: 35,
        branch: "industry",
        icon: "factory",
        prereq: [["gen_t_a"]],
        exclusive: ["gen_t_c"],
        effects: [{ kind: "stability", pct: 5 }],
      },
      {
        id: "gen_t_c",
        tree: "generic",
        x: 1,
        y: 1,
        days: 70,
        branch: "army",
        icon: "infantry",
        prereq: [["gen_t_a"]],
        exclusive: ["gen_t_b"],
        effects: [{ kind: "army_xp", amount: 10 }],
      },
    ],
    paths: { generic: ["gen_t_a", "gen_t_b"] },
    branchPoints: {
      generic: [
        {
          id: "bp_t",
          historical: "gen_t_b",
          alternatives: ["gen_t_c"],
          political: false,
        },
      ],
    },
    events: [
      {
        id: "gen_t_news",
        kind: "news",
        options: [{ id: "a", ai: { base: 1 }, effects: [] }],
      },
      {
        id: "gen_t_choice",
        kind: "country",
        options: [
          {
            id: "a",
            history: true,
            ai: { base: 10 },
            effects: [{ kind: "pp", amount: 10 }],
          },
          {
            id: "b",
            ai: { base: 10 },
            effects: [{ kind: "stability", pct: -5 }],
          },
        ],
      },
      {
        id: "gen_t_chain",
        kind: "country",
        once: "never",
        options: [
          {
            id: "a",
            ai: { base: 1 },
            effects: [{ kind: "fire_event", id: "gen_t_chain" }],
          },
        ],
      },
    ],
    decisions: [
      {
        id: "gen_t_rally",
        category: "political",
        for: "any",
        cost: { pp: 50 },
        cooldownDays: 180,
        effects: [{ kind: "add_spirit", id: "gen_t_spirit", days: 90 }],
        ai: { base: 10 },
      },
      {
        id: "gen_t_mission",
        category: "military",
        for: "any",
        cost: { pp: 25 },
        days: 30,
        effects: [],
        completeEffects: [{ kind: "army_xp", amount: 5 }],
        ai: { base: 0 },
      },
    ],
    spirits: [{ id: "gen_t_spirit", stats: { ppGainPct: 10 }, icon: "flag" }],
    traits: TRAITS,
    persons: [],
    beats: HISTORY_BEATS,
    groups: [
      { id: "sudetenland", regions: [13], owner1936: "CSK" },
      { id: "bohemia_moravia", regions: [14], owner1936: "CSK" },
      { id: "slovakia", regions: [15], owner1936: "CSK" },
      { id: "memel", regions: [16], owner1936: "LTU" },
      { id: "rhineland", regions: [4], owner1936: "DEU" },
      { id: "french_border_de", regions: [3, 4], owner1936: "DEU" },
    ],
    countries: [],
    claims: [],
    factionNames: [],
    templates: [],
    flags: FLAGS_BASE,
    startNaps: START_NAPS,
    // P5 (plan decision 30): the endgame tables, empty (endgameFixture fills some).
    peace: [],
    cores: [],
    seeds: [],
    occupationDefaults: [],
  };
  return buildRegistry({ ...base, ...extra });
}
