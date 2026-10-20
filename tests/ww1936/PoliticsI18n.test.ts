// World War 1936 P3 (spec §23, plan decision 25): every politics name has
// its en and ko text. The content's keys are checked now (empty tables
// pass); the screens' fixed lists and keys are lane T's (Task 9).
import {
  CONDITION_KINDS,
  EFFECT_KINDS,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  ADVISOR_SLOTS,
  DECISION_CATEGORIES,
  EVENT_PICTURES,
  FOCUS_BRANCHES,
  IDEOLOGIES,
  RESERVE_KEYS,
  TRAIT_IDS,
  WAR_GOAL_TYPES,
  WW_STAT_KEYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import IntlMessageFormat from "intl-messageformat";
import { en, hasKey, keyIn, ko } from "./contentUtil";

const SCREEN_KEYS = [
  "ww1936.diplo.act.access_ask",
  "ww1936.diplo.act.access_revoke",
  "ww1936.diplo.act.coup",
  "ww1936.diplo.act.declare_goal",
  "ww1936.diplo.act.declare_no_goal",
  "ww1936.diplo.act.faction_invite",
  "ww1936.diplo.act.faction_request",
  "ww1936.diplo.act.guarantee",
  "ww1936.diplo.act.guarantee_end",
  "ww1936.diplo.act.improve",
  "ww1936.diplo.act.justify",
  "ww1936.diplo.act.justify_cancel",
  "ww1936.diplo.act.justify_cost",
  "ww1936.diplo.act.justify_pick",
  "ww1936.diplo.act.nap_break",
  "ww1936.diplo.act.nap_offer",
  "ww1936.diplo.act.sent",
  "ww1936.diplo.act.support_party",
  "ww1936.diplo.faction.create",
  "ww1936.diplo.faction.dissolve",
  "ww1936.diplo.faction.ideology",
  "ww1936.diplo.faction.invite",
  "ww1936.diplo.faction.kick",
  "ww1936.diplo.faction.leader",
  "ww1936.diplo.faction.leave",
  "ww1936.diplo.faction.members",
  "ww1936.diplo.faction.mine",
  "ww1936.diplo.faction.none",
  "ww1936.diplo.faction.others",
  "ww1936.diplo.faction.request",
  "ww1936.diplo.info",
  "ww1936.diplo.relations",
  "ww1936.diplo.surrender",
  "ww1936.diplo.tab.factions",
  "ww1936.diplo.tab.treaties",
  "ww1936.diplo.tab.wars",
  "ww1936.diplo.tab.world",
  "ww1936.diplo.treaties.access_given",
  "ww1936.diplo.treaties.access_received",
  "ww1936.diplo.treaties.end",
  "ww1936.diplo.treaties.given",
  "ww1936.diplo.treaties.nap",
  "ww1936.diplo.treaties.nap_break_in",
  "ww1936.diplo.treaties.nap_start",
  "ww1936.diplo.treaties.none",
  "ww1936.diplo.treaties.received",
  "ww1936.diplo.treaty.access",
  "ww1936.diplo.treaty.guarantee",
  "ww1936.diplo.treaty.nap",
  "ww1936.diplo.wars.against",
  "ww1936.diplo.wars.against_line",
  "ww1936.diplo.wars.goal_line",
  "ww1936.diplo.wars.goals",
  "ww1936.diplo.wars.justify_blocked",
  "ww1936.diplo.wars.justify_line",
  "ww1936.diplo.wars.justifying",
  "ww1936.diplo.wars.none",
  "ww1936.diplo.wars.none_against",
  "ww1936.diplo.wars.none_goals",
  "ww1936.diplo.world.news",
  "ww1936.diplo.world.news_none",
  "ww1936.diplo.world.next_beat",
  "ww1936.diplo.world.tension",
  "ww1936.diplo.world.top",
  "ww1936.eventui.annex_warning",
  "ww1936.eventui.collapse",
  "ww1936.eventui.confirm",
  "ww1936.eventui.default",
  "ww1936.eventui.expand",
  "ww1936.eventui.from",
  "ww1936.eventui.more",
  "ww1936.eventui.news",
  "ww1936.eventui.read_less",
  "ww1936.eventui.read_more",
  "ww1936.eventui.seconds",
  "ww1936.eventui.sent",
  "ww1936.focusui.cancel",
  "ww1936.focusui.cancel_tap",
  "ww1936.focusui.chip.air",
  "ww1936.focusui.chip.air_navy",
  "ww1936.focusui.chip.all",
  "ww1936.focusui.chip.army",
  "ww1936.focusui.chip.diplomacy",
  "ww1936.focusui.chip.industry",
  "ww1936.focusui.chip.navy",
  "ww1936.focusui.chip.politics",
  "ww1936.focusui.chip.research",
  "ww1936.focusui.conditions",
  "ww1936.focusui.days_chip",
  "ww1936.focusui.detail_empty",
  "ww1936.focusui.duration",
  "ww1936.focusui.duration_same",
  "ww1936.focusui.effects",
  "ww1936.focusui.excludes",
  "ww1936.focusui.idle",
  "ww1936.focusui.left",
  "ww1936.focusui.queue",
  "ww1936.focusui.queued",
  "ww1936.focusui.requires",
  "ww1936.focusui.requires_all",
  "ww1936.focusui.requires_any",
  "ww1936.focusui.running",
  "ww1936.focusui.start",
  "ww1936.focusui.state.blocked",
  "ww1936.focusui.state.bypassed",
  "ww1936.focusui.state.done",
  "ww1936.focusui.state.exclusive",
  "ww1936.focusui.state.open",
  "ww1936.focusui.state.prereq",
  "ww1936.focusui.state.queued",
  "ww1936.focusui.state.running",
  "ww1936.focusui.title",
  "ww1936.focusui.tree.generic",
  "ww1936.focusui.tree.national",
  "ww1936.focusui.unqueue",
  "ww1936.focusui.unqueue_tap",
  "ww1936.pol.adv.candidates",
  "ww1936.pol.adv.cost",
  "ww1936.pol.adv.empty",
  "ww1936.pol.adv.fire",
  "ww1936.pol.adv.from",
  "ww1936.pol.adv.hire",
  "ww1936.pol.adv.in_seat",
  "ww1936.pol.adv.locked",
  "ww1936.pol.adv.no_candidates",
  "ww1936.pol.adv.until",
  "ww1936.pol.band.pp",
  "ww1936.pol.band.stability",
  "ww1936.pol.band.tension",
  "ww1936.pol.band.war_support",
  "ww1936.pol.close",
  "ww1936.pol.days",
  "ww1936.pol.decision.cancel",
  "ww1936.pol.decision.choose_target",
  "ww1936.pol.decision.cooldown",
  "ww1936.pol.decision.cost",
  "ww1936.pol.decision.locked",
  "ww1936.pol.decision.mission",
  "ww1936.pol.decision.none",
  "ww1936.pol.decision.take",
  "ww1936.pol.dial.decisions_badge",
  "ww1936.pol.dial.diplomacy",
  "ww1936.pol.dial.diplomacy_label",
  "ww1936.pol.dial.focus",
  "ww1936.pol.dial.focus_idle",
  "ww1936.pol.dial.focus_running",
  "ww1936.pol.dial.justify_label",
  "ww1936.pol.dial.politics",
  "ww1936.pol.dial.politics_label",
  "ww1936.pol.gov.base",
  "ww1936.pol.gov.crisis",
  "ww1936.pol.gov.drift_down",
  "ww1936.pol.gov.drift_up",
  "ww1936.pol.gov.effects",
  "ww1936.pol.gov.elections_suspended",
  "ww1936.pol.gov.government",
  "ww1936.pol.gov.leader",
  "ww1936.pol.gov.next_election",
  "ww1936.pol.gov.no_crisis",
  "ww1936.pol.gov.no_election",
  "ww1936.pol.gov.pop_line",
  "ww1936.pol.gov.pp",
  "ww1936.pol.gov.pp_base",
  "ww1936.pol.gov.pp_now",
  "ww1936.pol.gov.pp_sources",
  "ww1936.pol.gov.stability",
  "ww1936.pol.gov.support",
  "ww1936.pol.gov.surrender",
  "ww1936.pol.gov.war_support",
  "ww1936.pol.ideo_largest_other",
  "ww1936.pol.ideo_ruling",
  "ww1936.pol.law.change",
  "ww1936.pol.law.cost",
  "ww1936.pol.law.in_force",
  "ww1936.pol.law.need_tension",
  "ww1936.pol.law.need_war",
  "ww1936.pol.law.need_ws",
  "ww1936.pol.law.ok",
  "ww1936.pol.law.wait",
  "ww1936.pol.line.stab_base",
  "ww1936.pol.line.stab_modifiers",
  "ww1936.pol.line.stab_no_pp",
  "ww1936.pol.line.stab_occupation",
  "ww1936.pol.line.stab_offensive",
  "ww1936.pol.line.stab_party",
  "ww1936.pol.line.ws_base",
  "ww1936.pol.line.ws_capital",
  "ww1936.pol.line.ws_casualties",
  "ww1936.pol.line.ws_defense",
  "ww1936.pol.line.ws_lost_vp",
  "ww1936.pol.line.ws_modifiers",
  "ww1936.pol.line.ws_tension",
  "ww1936.pol.manpower.casualties",
  "ww1936.pol.manpower.law",
  "ww1936.pol.manpower.open_laws",
  "ww1936.pol.none",
  "ww1936.pol.pick.acquired",
  "ww1936.pol.pick.best",
  "ww1936.pol.pick.best_of",
  "ww1936.pol.pick.border",
  "ww1936.pol.pick.border_threat",
  "ww1936.pol.pick.capital",
  "ww1936.pol.pick.coastal",
  "ww1936.pol.pick.core",
  "ww1936.pol.pick.group",
  "ww1936.pol.pick.regions",
  "ww1936.pol.pick.resources",
  "ww1936.pol.pp_amount",
  "ww1936.pol.sel.all",
  "ww1936.pol.sel.from",
  "ww1936.pol.sel.leader_of",
  "ww1936.pol.sel.owner_of",
  "ww1936.pol.sel.self",
  "ww1936.pol.sel.target",
  "ww1936.pol.source.advisors",
  "ww1936.pol.source.dynamic",
  "ww1936.pol.source.government",
  "ww1936.pol.source.laws",
  "ww1936.pol.source.leader",
  "ww1936.pol.source.spirits",
  "ww1936.pol.source.tech",
  "ww1936.pol.spirit.left",
  "ww1936.pol.spirit.none",
  "ww1936.pol.spirit.permanent",
  "ww1936.pol.tab.advisors",
  "ww1936.pol.tab.decisions",
  "ww1936.pol.tab.government",
  "ww1936.pol.tab.laws",
  "ww1936.pol.tab.manpower",
  "ww1936.pol.tab.spirits",
  "ww1936.pol.tap_again",
  "ww1936.pol.title",
  "ww1936.pol.value_signed",
  "ww1936.pol.who_prefix",
];

const NOTIFICATION_KEYS = [
  "events_display.ww1936_advisor_left",
  "events_display.ww1936_annexed",
  "events_display.ww1936_decision",
  "events_display.ww1936_election",
  "events_display.ww1936_event_auto_chosen",
  "events_display.ww1936_faction_joined",
  "events_display.ww1936_faction_leader",
  "events_display.ww1936_faction_left",
  "events_display.ww1936_focus_done",
  "events_display.ww1936_focus_queue_failed",
  "events_display.ww1936_government_changed",
  "events_display.ww1936_justified_against",
  "events_display.ww1936_justify_started",
  "events_display.ww1936_leader_changed",
  "events_display.ww1936_mission_done",
  "events_display.ww1936_mission_failed",
  "events_display.ww1936_treaty",
  "events_display.ww1936_treaty_ended",
  "events_display.ww1936_war_goal_expired",
];

const missing = (keys: readonly string[]) => keys.filter((k) => !hasKey(k));

describe("politics strings", () => {
  it("the content's names: spirits, persons, titles, governments, factions", () => {
    const keys: string[] = [];
    for (const s of CONTENT.spirits) {
      if (s.hidden === true) continue;
      keys.push(`ww1936.spirit.${s.id}`, `ww1936.spirit_desc.${s.id}`);
    }
    for (const p of CONTENT.persons) keys.push(p.nameKey);
    for (const c of CONTENT.countries) {
      for (const id of [c.startLeader, ...Object.values(c.leaders)]) {
        // title:leader_<ideology> is the screens' (Task 9).
        if (id?.startsWith("title:") && !id.startsWith("title:leader_")) {
          keys.push(`ww1936.title.${id.slice(6)}`);
        }
      }
      for (const i of c.govNames ?? []) keys.push(`ww1936.gov.${c.tag}.${i}`);
    }
    for (const f of CONTENT.factionNames) {
      keys.push(`ww1936.faction_name.${f.id}`);
    }
    expect(missing(keys)).toEqual([]);
  });

  it("the fixed lists: ideologies, war goals, seats, traits, effects, conditions, stats, P4 values, generic titles", () => {
    const keys = [
      ...IDEOLOGIES.map((i) => `ww1936.ideology.${i}`),
      ...IDEOLOGIES.map((i) => `ww1936.gov.generic.${i}`),
      ...IDEOLOGIES.map((i) => `ww1936.title.leader_${i}`),
      ...WAR_GOAL_TYPES.map((t) => `ww1936.wargoal.${t}`),
      ...[...new Set(ADVISOR_SLOTS)].map((s) => `ww1936.advisor_slot.${s}`),
      ...TRAIT_IDS.map((t) => `ww1936.trait.adv_${t}`),
      ...CONTENT.traits
        .filter((t) => t.generic)
        .map((t) => `ww1936.title.${t.id}`),
      ...EFFECT_KINDS.map((k) => `ww1936.fx.${k}`),
      "ww1936.fx.else",
      "ww1936.fx.random_option",
      ...CONDITION_KINDS.map((k) => `ww1936.cond.${k}`),
      "ww1936.cond.all",
      "ww1936.cond.any",
      "ww1936.cond.not",
      ...WW_STAT_KEYS.map((k) => `ww1936.stat.${k}`),
      ...RESERVE_KEYS.map((k) => `ww1936.reserve.${k}`),
      "ww1936.faction_name.auto",
      ...CONTENT.groups.map((g) => `ww1936.pol.group.${g.id}`),
      ...DECISION_CATEGORIES.map((c) => `ww1936.pol.decision.cat.${c}`),
      ...EVENT_PICTURES.map((p) => `ww1936.eventui.pic.${p}`),
      ...FOCUS_BRANCHES.map((b) => `ww1936.focusui.chip.${b}`),
    ];
    expect(missing(keys)).toEqual([]);
  });

  it("the screens' keys: politics, focus, diplomacy and event cards", () => {
    expect(missing(SCREEN_KEYS)).toEqual([]);
  });

  it("the 19 displayMessage notifications (plan decision 5)", () => {
    expect(missing(NOTIFICATION_KEYS)).toEqual([]);
  });

  it("every screen text is a valid ICU message in en and ko", () => {
    const keys = [
      ...SCREEN_KEYS,
      ...NOTIFICATION_KEYS,
      ...EFFECT_KINDS.map((k) => `ww1936.fx.${k}`),
      ...CONDITION_KINDS.map((k) => `ww1936.cond.${k}`),
      ...WW_STAT_KEYS.map((k) => `ww1936.stat.${k}`),
    ];
    for (const [lang, json] of [
      ["en", en],
      ["ko", ko],
    ] as const) {
      for (const k of keys) {
        const text = keyIn(json, k) ?? "";
        expect(
          () => new IntlMessageFormat(text, lang),
          `${lang} ${k}`,
        ).not.toThrow();
      }
    }
  });

  it("en and ko use the same ICU argument names in every ww1936 text", () => {
    const argNames = (text: string, lang: string): string[] => {
      const out = new Set<string>();
      const walk = (nodes: any[]): void => {
        for (const n of nodes) {
          if (n.type !== 0 && typeof n.value === "string") out.add(n.value);
          if (n.options) {
            for (const o of Object.values<any>(n.options)) walk(o.value);
          }
        }
      };
      walk(new IntlMessageFormat(text, lang).getAst() as any[]);
      return [...out].sort();
    };
    const texts = (o: unknown, at: string, out: Map<string, string>) => {
      if (typeof o === "string") out.set(at, o);
      else if (typeof o === "object" && o !== null) {
        for (const [k, v] of Object.entries(o)) texts(v, `${at}.${k}`, out);
      }
    };
    const enT = new Map<string, string>();
    const root = (j: unknown) => j as Record<string, Record<string, unknown>>;
    texts(root(en).ww1936, "ww1936", enT);
    for (const [k, v] of Object.entries(root(en).events_display)) {
      if (k.startsWith("ww1936_")) enT.set(`events_display.${k}`, v as string);
    }
    for (const [k, text] of enT) {
      const koText = keyIn(ko, k);
      if (koText === undefined) continue;
      expect(argNames(koText, "ko"), k).toEqual(argNames(text, "en"));
    }
  });

  it("the foundation's block reasons are there (plan decision 25)", () => {
    expect(
      missing([
        "ww1936.econ.block.no_pp",
        "ww1936.econ.block.focus_none",
        "ww1936.declare.block.prep",
        "ww1936.declare.block.isolation",
      ]),
    ).toEqual([]);
  });
});
