// World War 1936 P3 (spec §10, plan decisions 12, 21; Task 1 Steps 2 and
// 6): one sample of every condition and effect kind through the schemas,
// the groups and the explain lines.
import {
  Condition,
  CONDITION_KINDS,
  ConditionKind,
  Effect,
  EFFECT_KINDS,
  effectGroup,
  EffectKind,
  LeafCondition,
  RegionPickSchema,
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  conditionLeaves,
  describeCondition,
  describeEffects,
  describeStats,
  pickCode,
  selectorCode,
} from "@openfront/engine-lib/ww1936/Describe";

const DEU = { tag: "DEU" } as const;

const SAMPLE_CONDITIONS: Record<ConditionKind, LeafCondition> = {
  always: { kind: "always", value: true },
  date_ge: { kind: "date_ge", date: "1938-03-12" },
  date_lt: { kind: "date_lt", date: "1939-09-01" },
  days_since_flag_ge: {
    kind: "days_since_flag_ge",
    flag: "munich_done",
    days: 30,
  },
  tag: { kind: "tag", tag: "GBR" },
  exists: { kind: "exists", who: { tag: "AUT" } },
  is_major: { kind: "is_major" },
  is_ai: { kind: "is_ai" },
  is_human: { kind: "is_human", who: "from" },
  capitulated: { kind: "capitulated", who: "target" },
  historical_ai: { kind: "historical_ai" },
  ruling: { kind: "ruling", ideology: "fascist" },
  pop_ge: { kind: "pop_ge", ideology: "communist", pct: 40 },
  stability_ge: { kind: "stability_ge", pct: 30 },
  ws_ge: { kind: "ws_ge", pct: 70 },
  pp_ge: { kind: "pp_ge", amount: 100 },
  has_spirit: { kind: "has_spirit", id: "gen_t_spirit" },
  has_advisor: { kind: "has_advisor", person: "title:diplomat" },
  leader: { kind: "leader", person: "leader_deu" },
  focus_done: { kind: "focus_done", id: "gen_t_a" },
  focus_in_progress: { kind: "focus_in_progress", id: "gen_t_b" },
  flag: { kind: "flag", flag: "purge_path" },
  gflag: { kind: "gflag", flag: "munich_done" },
  law: { kind: "law", law: "economy", value: "war_economy" },
  law_ge: { kind: "law_ge", law: "conscription", value: "extensive" },
  has_tech: { kind: "has_tech", tech: "electronics_1" },
  factories_ge: { kind: "factories_ge", count: 50 },
  divisions_ge: { kind: "divisions_ge", count: 24 },
  strength_ratio_ge: { kind: "strength_ratio_ge", vs: DEU, permille: 800 },
  army_xp_ge: { kind: "army_xp_ge", amount: 10 },
  owns_group: { kind: "owns_group", group: "sudetenland" },
  controls_group: { kind: "controls_group", group: "memel" },
  controls_capital_of: { kind: "controls_capital_of", of: { tag: "POL" } },
  neighbor_of: { kind: "neighbor_of", of: { factionLeaderOf: "self" } },
  lost_vp_ge: { kind: "lost_vp_ge", pct: 20 },
  at_war: { kind: "at_war" },
  at_war_with: { kind: "at_war_with", of: "from" },
  war_days_ge: { kind: "war_days_ge", days: 365 },
  in_faction: { kind: "in_faction" },
  faction_leader: { kind: "faction_leader" },
  same_faction: { kind: "same_faction", of: DEU },
  faction_ideology: { kind: "faction_ideology", ideology: "democratic" },
  has_war_goal_on: { kind: "has_war_goal_on", of: { tag: "CSK" } },
  justifying_on: { kind: "justifying_on", of: "target" },
  justified_against: { kind: "justified_against" },
  nap_with: { kind: "nap_with", of: { tag: "SUN" } },
  guarantees: { kind: "guarantees", of: { tag: "POL" } },
  guaranteed_by: { kind: "guaranteed_by", of: { tag: "GBR" } },
  has_access_from: { kind: "has_access_from", of: { tag: "FIN" } },
  wt_ge: { kind: "wt_ge", pct: 50 },
  threat_ge: { kind: "threat_ge", of: DEU, pct: 5 },
  opinion_ge: { kind: "opinion_ge", of: { ownerOf: "danzig" }, value: -20 },
  decision_taken: { kind: "decision_taken", id: "gen_t_rally" },
  coastal: { kind: "coastal" },
  landlocked: { kind: "landlocked", who: { tag: "CSK" } },
  declared_by: { kind: "declared_by", of: DEU },
  // P4 (plan decision 24).
  navy_size: { kind: "navy_size", min: 4, cls: "bb" },
  fuel_ratio_below: { kind: "fuel_ratio_below", pct: 50 },
  // P5 (plan decision 26).
  is_exile: { kind: "is_exile" },
  exile_host: { kind: "exile_host", of: { tag: "GBR" } },
  is_subject: { kind: "is_subject", who: { tag: "MCK" } },
  subject_of: { kind: "subject_of", of: { tag: "JPN" } },
  subject_level_ge: { kind: "subject_level_ge", level: "puppet" },
  autonomy_ge: { kind: "autonomy_ge", pct: 60 },
  country_state: { kind: "country_state", tag: "VIC", state: "dormant" },
  occupied_by: { kind: "occupied_by", group: "paris", of: DEU },
  resistance_ge: { kind: "resistance_ge", group: "paris", pct: 40 },
  compliance_ge: { kind: "compliance_ge", group: "paris", pct: 50 },
  war_score_share_ge: { kind: "war_score_share_ge", of: DEU, pct: 30 },
  in_conference: { kind: "in_conference" },
  legitimacy_ge: { kind: "legitimacy_ge", pct: 50 },
  // P5 lane E (spec §17.6).
  borders_group: { kind: "borders_group", group: "warsaw" },
  // P6 (plan decision 27, pre-flight §0-11).
  has_doctrine: { kind: "has_doctrine", doctrine: "gd_mobile" },
  mastery_level: { kind: "mastery_level", track: "armor", level: 3 },
  has_agency: { kind: "has_agency" },
  intel_level: { kind: "intel_level", of: DEU, domain: "army", pct: 50 },
  project_done: { kind: "project_done", project: "sp_atomic" },
  has_atomic: { kind: "has_atomic", count: 2 },
  congress_above: { kind: "congress_above", pct: 60 },
  bop_range: { kind: "bop_range", tag: "FRA", band: 2 },
  energy_below: { kind: "energy_below", pct: 80 },
  nukes_on: { kind: "nukes_on" },
};

const SAMPLE_EFFECTS: Record<EffectKind, Effect> = {
  pp: { kind: "pp", amount: -50 },
  stability: { kind: "stability", pct: 5 },
  war_support: { kind: "war_support", pct: -10 },
  add_spirit: { kind: "add_spirit", id: "gen_t_spirit", days: 90 },
  remove_spirit: { kind: "remove_spirit", id: "gen_t_spirit" },
  swap_spirit: { kind: "swap_spirit", from: "gen_a", to: "gen_b" },
  popularity: { kind: "popularity", ideology: "largest_other", pp: 5 },
  set_government: { kind: "set_government", ideology: "fascist" },
  set_leader: { kind: "set_leader", person: "title:leader_neutral" },
  civil_war: { kind: "civil_war", ideology: "communist" },
  set_law: {
    kind: "set_law",
    law: "conscription",
    value: "service",
    free: true,
  },
  law_step: { kind: "law_step", law: "economy", steps: 1 },
  add_advisor_candidate: {
    kind: "add_advisor_candidate",
    person: "gbr_tizard",
  },
  remove_advisor: { kind: "remove_advisor", person: "gbr_eden" },
  person_trait: {
    kind: "person_trait",
    person: "sun_molotov",
    trait: "diplomat",
  },
  set_flag: { kind: "set_flag", flag: "purge_path", days: 365 },
  clear_flag: { kind: "clear_flag", flag: "purge_path" },
  set_gflag: { kind: "set_gflag", flag: "munich_done" },
  clear_gflag: { kind: "clear_gflag", flag: "munich_done" },
  elections: { kind: "elections", suspend: true },
  build: { kind: "build", where: { best: 2 }, building: "civ", count: 2 },
  infra: { kind: "infra", where: "capital", amount: 1 },
  rail: { kind: "rail", where: { group: "rhineland" }, amount: 2 },
  fort: { kind: "fort", where: { borderWith: "threat", n: 3 }, amount: 1 },
  resource: {
    kind: "resource",
    where: { withResources: 2 },
    res: "oil",
    amount: 4,
  },
  move_buildings: {
    kind: "move_buildings",
    from: { group: "soviet_west_industry" },
    to: { group: "ural_industry" },
    building: "mil",
    count: 10,
  },
  manpower: { kind: "manpower", recruitablePct: 2 },
  equipment: { kind: "equipment", type: "fighter", gen: 1, count: 50 },
  send_equipment: {
    kind: "send_equipment",
    to: "target",
    type: "infantry_equipment",
    count: 1000,
  },
  research_bonus: {
    kind: "research_bonus",
    branch: "armour",
    pct: 100,
    uses: 1,
  },
  add_tech: { kind: "add_tech", tech: "electronics_1" },
  research_slot: { kind: "research_slot", amount: 1 },
  reserve: { kind: "reserve", key: "radar", amount: 4 },
  army_xp: { kind: "army_xp", amount: 10 },
  unlock_template: { kind: "unlock_template", template: "deu_panzer_ii" },
  add_general: { kind: "add_general" },
  remove_general: { kind: "remove_general", general: "tukhachevsky" },
  restore_general: { kind: "restore_general", general: "rokossovsky" },
  divisions: {
    kind: "divisions",
    template: "infantry",
    count: 6,
    where: { regions: [11, 12] },
  },
  fire_event: { kind: "fire_event", id: "gen_t_choice", to: "from", days: 2 },
  news: { kind: "news", id: "news_t" },
  unlock_decision: { kind: "unlock_decision", id: "gen_t_rally" },
  lock_decision: { kind: "lock_decision", id: "gen_t_rally" },
  take_decision: { kind: "take_decision", id: "gen_t_rally" },
  if: {
    kind: "if",
    cond: { all: [{ kind: "at_war" }, { not: { kind: "is_major" } }] },
    then: [{ kind: "pp", amount: 10 }],
    else: [{ kind: "stability", pct: -5 }],
  },
  random_list: {
    kind: "random_list",
    options: [
      { weight: 3, effects: [{ kind: "pp", amount: 10 }] },
      { weight: 1, effects: [] },
    ],
  },
  tension: { kind: "tension", pct: 4 },
  war_goal: {
    kind: "war_goal",
    on: { tag: "CSK" },
    type: "claim",
    group: "sudetenland",
  },
  remove_war_goal: { kind: "remove_war_goal", on: { tag: "CSK" } },
  declare_war: { kind: "declare_war", on: { tag: "POL" }, goal: "conquer" },
  join_war: { kind: "join_war", of: { factionLeaderOf: { tag: "GBR" } } },
  end_war: { kind: "end_war", of: "from" },
  create_faction: { kind: "create_faction", name: "little_entente" },
  join_faction: { kind: "join_faction", of: DEU },
  invite: { kind: "invite", of: "target" },
  leave_faction: { kind: "leave_faction" },
  kick: { kind: "kick", of: "target" },
  dissolve_faction: { kind: "dissolve_faction" },
  guarantee: { kind: "guarantee", of: { tag: "POL" } },
  end_guarantee: { kind: "end_guarantee", of: { tag: "POL" } },
  nap: { kind: "nap", of: "from" },
  break_nap: { kind: "break_nap", of: { tag: "SUN" } },
  access: { kind: "access", of: "from", who: { tag: "FIN" } },
  end_access: { kind: "end_access", of: "from" },
  opinion: { kind: "opinion", of: "all", value: -20, days: 180 },
  annex: {
    kind: "annex",
    who: "from",
    target: "self",
    units: "transfer",
    core: true,
  },
  transfer_regions: { kind: "transfer_regions", group: "sudetenland", to: DEU },
  // P4 (plan decision 24).
  ships: { kind: "ships", cls: "dd", gen: 1, count: 50, port: 10 },
  convoys: { kind: "convoys", amount: 100 },
  fuel: { kind: "fuel", amount: -500 },
  // P5 (plan decision 26).
  release: { kind: "release", tag: "SVK", as: "puppet", regions: "slovakia" },
  create_state: {
    kind: "create_state",
    tag: "SVK",
    regions: ["slovakia"],
    from: { tag: "CSK" },
    overlord: "self",
    level: "puppet",
    ideology: "neutral",
  },
  make_subject: { kind: "make_subject", target: "target", level: "up" },
  end_subject: { kind: "end_subject", target: "target" },
  autonomy: { kind: "autonomy", pct: -10 },
  occupation_zone: { kind: "occupation_zone", group: "paris", days: 30 },
  annex_occupied: { kind: "annex_occupied", group: "paris" },
  separate_peace: { kind: "separate_peace", with: "all" },
  switch_sides: { kind: "switch_sides", to: { tag: "GBR" } },
  set_name: { kind: "set_name", key: "ww1936.rename.spain" },
  transfer_ships: { kind: "transfer_ships", to: { tag: "GBR" }, pct: 50 },
  scuttle_fleet: { kind: "scuttle_fleet", pct: 75 },
  lend_lease: {
    kind: "lend_lease",
    to: { tag: "GBR" },
    item: "infantry_equipment",
    perMonth: 500,
  },
  volunteers: { kind: "volunteers", to: { tag: "ESN" }, divisions: 4 },
  exile_legitimacy: { kind: "exile_legitimacy", pct: 10 },
  embargo: { kind: "embargo", on: { tag: "JPN" } },
  end_embargo: { kind: "end_embargo", on: { tag: "JPN" } },
  reparations: { kind: "reparations", to: { tag: "FRA" }, k: 4, days: 730 },
  surrender: { kind: "surrender" },
  uprising: { kind: "uprising", group: "paris" },
  resistance: { kind: "resistance", group: "paris", pct: 10 },
  compliance: { kind: "compliance", group: "paris", pct: -10 },
  restore_country: { kind: "restore_country", tag: "target" },
  navy_xp: { kind: "navy_xp", amount: 20 },
  // P6 (plan decision 27).
  doctrine_mastery: { kind: "doctrine_mastery", domain: "land", amount: 120 },
  congress: { kind: "congress", pp: 10 },
  bop: { kind: "bop", amount: -100 },
  cp: { kind: "cp", amount: 20 },
  intel_network: { kind: "intel_network", on: DEU, pm: 200 },
  decrypt: { kind: "decrypt", on: DEU, pm: 300 },
  project_progress: { kind: "project_progress", project: "sp_atomic", pct: 10 },
  design_grant: { kind: "design_grant", preset: "test_tank" },
  energy: { kind: "energy", amount: 12 },
  agency: { kind: "agency", upgrade: "ag_ops_1" },
  cfocus_unlock: { kind: "cfocus_unlock" },
};

/** The optional fields of each kind (besides `who`, optional everywhere). */
const OPTIONAL: Partial<Record<string, readonly string[]>> = {
  add_spirit: ["days"],
  set_law: ["free"],
  set_flag: ["days"],
  elections: ["suspend", "postponeDays"],
  manpower: ["amount", "recruitablePct"],
  research_bonus: ["branch", "tech"],
  add_general: ["general"],
  fire_event: ["to", "days"],
  if: ["else"],
  war_goal: ["group"],
  declare_war: ["goal"],
  create_faction: ["name"],
  annex: ["units", "core"],
  transfer_regions: ["core"],
  navy_size: ["cls"],
  ships: ["port"],
  // P5 (plan decision 26).
  release: ["regions", "overlord"],
  create_state: ["neutral", "leader"],
  make_subject: ["neutral"],
  occupation_zone: ["holder", "days", "seize"],
  annex_occupied: ["to"],
  lend_lease: ["gen"],
  volunteers: ["divisions", "planes"],
  exile_legitimacy: ["scope"],
  surrender: ["to"],
  // P6 (plan decision 27).
  doctrine_mastery: ["track"],
  has_atomic: ["count"],
  agency: ["upgrade"],
};
/** A copy of `o` without the field `f`. */
const without = (o: object, f: string) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== f));

/** Required fields besides kind. */
const required = (o: { kind: string }) =>
  Object.keys(o).filter(
    (k) => k !== "kind" && k !== "who" && !(OPTIONAL[o.kind] ?? []).includes(k),
  );

describe("the condition and effect language", () => {
  it.each(CONDITION_KINDS)(
    "condition %s: the schema takes its sample, not a stranger",
    (k) => {
      const c = SAMPLE_CONDITIONS[k];
      expect(c.kind).toBe(k);
      expect(() => WwConditionSchema.parse(c)).not.toThrow();
      expect(() => WwConditionSchema.parse({ ...c, extra: 1 })).toThrow();
      for (const f of required(c)) {
        const rest = without(c, f);
        expect(
          () => WwConditionSchema.parse(rest),
          `${k} without ${f}`,
        ).toThrow();
      }
    },
  );

  it.each(EFFECT_KINDS)(
    "effect %s: the schema takes its sample, not a stranger",
    (k) => {
      const e = SAMPLE_EFFECTS[k];
      expect(e.kind).toBe(k);
      expect(() => WwEffectSchema.parse(e)).not.toThrow();
      expect(() => WwEffectSchema.parse({ ...e, extra: 1 })).toThrow();
      for (const f of required(e)) {
        const rest = without(e, f);
        expect(() => WwEffectSchema.parse(rest), `${k} without ${f}`).toThrow();
      }
    },
  );

  it("the boolean nodes and bad values are checked", () => {
    const c: Condition = {
      any: [SAMPLE_CONDITIONS.at_war, { not: SAMPLE_CONDITIONS.is_major }],
    };
    expect(() => WwConditionSchema.parse(c)).not.toThrow();
    expect(() => WwConditionSchema.parse({ all: [] })).toThrow();
    expect(() => WwConditionSchema.parse({ kind: "nope" })).toThrow();
    expect(() =>
      WwConditionSchema.parse({ kind: "date_ge", date: "1950-01-01" }),
    ).toThrow();
    expect(() =>
      WwEffectSchema.parse({ kind: "add_spirit", id: "Bad-Id" }),
    ).toThrow();
    expect(() =>
      WwEffectSchema.parse({
        kind: "random_list",
        options: [{ weight: 1, effects: [] }],
      }),
    ).toThrow();
    expect(() => RegionPickSchema.parse({ regions: [] })).toThrow();
    expect(() => RegionPickSchema.parse({ regions: [40_001] })).toThrow();
  });

  it("each effect kind belongs to one group, in the list's blocks (plan decision 12)", () => {
    const groups = EFFECT_KINDS.map(effectGroup);
    expect(groups.slice(0, 20).every((g) => g === "political")).toBe(true);
    expect(groups.slice(20, 39).every((g) => g === "econ")).toBe(true);
    expect(
      EFFECT_KINDS.slice(39, 47)
        .map(effectGroup)
        .every((g) => g === "event"),
    ).toBe(true);
    expect(effectGroup("war_goal")).toBe("diplo");
    expect(effectGroup("opinion")).toBe("diplo");
    expect(effectGroup("annex")).toBe("territory");
    expect(effectGroup("transfer_regions")).toBe("territory");
    // Every block is contiguous.
    let changes = 0;
    for (let i = 1; i < groups.length; i++)
      if (groups[i] !== groups[i - 1]) changes++;
    // P4's navy block (ships, convoys, fuel) after the territory one, P5's
    // endgame block (release … navy_xp) after it, P6's depth block last.
    expect(changes).toBe(7);
    expect(effectGroup("doctrine_mastery")).toBe("depth");
    expect(effectGroup("cfocus_unlock")).toBe("depth");
    expect(effectGroup("release")).toBe("endgame");
    expect(effectGroup("navy_xp")).toBe("endgame");
    expect(effectGroup("ships")).toBe("navy");
  });

  it("the lists are unique", () => {
    expect(new Set(EFFECT_KINDS).size).toBe(EFFECT_KINDS.length);
    expect(new Set(CONDITION_KINDS).size).toBe(CONDITION_KINDS.length);
  });

  it.each(EFFECT_KINDS)("effect %s describes to its key", (k) => {
    const lines = describeEffects([SAMPLE_EFFECTS[k]]);
    expect(lines[0].key).toBe(`ww1936.fx.${k}`);
    expect(lines[0].params.who).toBeDefined();
  });

  it.each(CONDITION_KINDS)("condition %s describes to its key", (k) => {
    const c = SAMPLE_CONDITIONS[k];
    const lines = describeCondition(c);
    expect(lines[0].key).toBe(`ww1936.cond.${k}`);
    expect(lines.filter((l) => l.leaf >= 0)).toHaveLength(
      conditionLeaves(c).length,
    );
  });

  it("nested conditions and effects number their leaves and lines", () => {
    const c: Condition = {
      all: [
        SAMPLE_CONDITIONS.at_war,
        { any: [SAMPLE_CONDITIONS.is_major, SAMPLE_CONDITIONS.tag] },
        { not: SAMPLE_CONDITIONS.in_faction },
      ],
    };
    const lines = describeCondition(c);
    expect(lines.map((l) => [l.key, l.depth, l.leaf])).toEqual([
      ["ww1936.cond.all", 0, -1],
      ["ww1936.cond.at_war", 1, 0],
      ["ww1936.cond.any", 1, -1],
      ["ww1936.cond.is_major", 2, 1],
      ["ww1936.cond.tag", 2, 2],
      ["ww1936.cond.not", 1, -1],
      ["ww1936.cond.in_faction", 2, 3],
    ]);
    expect(conditionLeaves(c).map((l) => l.kind)).toEqual([
      "at_war",
      "is_major",
      "tag",
      "in_faction",
    ]);
    const fx = describeEffects([SAMPLE_EFFECTS.if, SAMPLE_EFFECTS.random_list]);
    expect(fx.map((l) => [l.key, l.depth])).toEqual([
      ["ww1936.fx.if", 0],
      ["ww1936.cond.all", 1],
      ["ww1936.cond.at_war", 2],
      ["ww1936.cond.not", 2],
      ["ww1936.cond.is_major", 3],
      ["ww1936.fx.pp", 1],
      ["ww1936.fx.else", 0],
      ["ww1936.fx.stability", 1],
      ["ww1936.fx.random_list", 0],
      ["ww1936.fx.random_option", 1],
      ["ww1936.fx.pp", 2],
      ["ww1936.fx.random_option", 1],
    ]);
  });

  it("selectors and region picks become codes", () => {
    expect(selectorCode(undefined)).toBe("@self");
    expect(selectorCode("from")).toBe("@from");
    expect(selectorCode({ tag: "AUT" })).toBe("AUT");
    expect(selectorCode({ factionLeaderOf: { tag: "GBR" } })).toBe(
      "@leader:GBR",
    );
    expect(selectorCode({ ownerOf: "danzig" })).toBe("@owner:danzig");
    expect(selectorCode({ overlordOf: "self" })).toBe("@overlord:@self");
    expect(pickCode("capital")).toBe("capital");
    expect(pickCode({ best: 2, of: "rhineland" })).toBe("best:2:rhineland");
    expect(pickCode({ borderWith: "threat", n: 3 })).toBe("border:threat:3");
    expect(pickCode({ withResources: 2 })).toBe("resources:2");
    expect(pickCode({ regions: [11, 12] })).toBe("regions:11,12");
    const [move] = describeEffects([SAMPLE_EFFECTS.move_buildings]);
    expect(move.params).toMatchObject({
      from: "group:soviet_west_industry",
      to: "group:ural_industry",
      count: 10,
      who: "@self",
    });
    // A string selector stays as written (the screens read "self" and
    // "@self" alike); an object selector becomes its code.
    const [annex] = describeEffects([SAMPLE_EFFECTS.annex]);
    expect(annex.params).toMatchObject({
      who: "from",
      target: "self",
      core: 1,
    });
    const [join] = describeEffects([SAMPLE_EFFECTS.join_war]);
    expect(join.params).toMatchObject({ of: "@leader:GBR", who: "@self" });
  });

  it("stats describe one line each, non-zero only", () => {
    expect(
      describeStats({ ppGainPct: 10, stabilityBp: 0, attackPct: -5 }),
    ).toEqual([
      {
        key: "ww1936.stat.attackPct",
        params: { value: -5 },
        depth: 0,
        leaf: -1,
      },
      {
        key: "ww1936.stat.ppGainPct",
        params: { value: 10 },
        depth: 0,
        leaf: -1,
      },
    ]);
  });
});
