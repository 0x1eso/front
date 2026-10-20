// World War 1936 P3 (spec §23, plan decision 25): every politics name has
// its en and ko text. The content's keys are checked now (empty tables
// pass); the screens' fixed lists are lane T's (Task 9), which sets
// UI_KEYS_PENDING to false and adds the screens' own keys here.
import {
  CONDITION_KINDS,
  EFFECT_KINDS,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  ADVISOR_SLOTS,
  IDEOLOGIES,
  RESERVE_KEYS,
  TRAIT_IDS,
  WAR_GOAL_TYPES,
  WW_STAT_KEYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { hasKey } from "./contentUtil";

/** Task 9 (lane T) writes the screens' keys, then sets this to false. */
const UI_KEYS_PENDING = true;

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

  it.skipIf(UI_KEYS_PENDING)(
    "the fixed lists: ideologies, war goals, seats, traits, effects, conditions, stats, P4 values, generic titles",
    () => {
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
      ];
      expect(missing(keys)).toEqual([]);
    },
  );

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
