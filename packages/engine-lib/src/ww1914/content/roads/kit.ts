// ww222 (W2): the builders the roads to the other camp share (design ww220
// §5, format /home/eser/dev/ww220-format.md). Each seat's rows sit in
// roads/<seat>.ts and are spliced into that seat's depts, powers and persona;
// their text is in the seat's own packs (<TAG>.depts.json, <TAG>.powers.json,
// <TAG>.persona.json).
//
// The diary's road moments (road_feeler, road_signed, road_fell) are the
// engine's (Diary.roadMoments, shared with W1). A course or a talk reply that
// reaches out writes the memory `<seat>_road_feeler`.
import type { GwAccordKind } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCourseRow,
  GwFindingRow,
  GwLean,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwDiaryRow } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwCond, GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerOption } from "../../PowerRows";

export const war: GwCond = world({ is: "war" });
export const peace: GwCond = not(war);

/** The road between the seat's country (or `of`) and `tag`, by step 0..4. */
export const road = (
  tag: GwTag,
  r: { min?: number; max?: number; of?: GwTag },
): GwCond => world({ is: "road", tag, ...r });

export const switchCan: GwCond = world({ is: "switch_can" });
export const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });

export const bond = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "bond", tag, delta });
export const accord = (kind: GwAccordKind, tag: GwTag): GwEffect =>
  doWorld({ do: "accord", kind, tag });
export const pledge = (tag: GwTag): GwEffect =>
  doWorld({ do: "realign_offer", tag, step: "pledge" });
export const alliance = (tag: GwTag): GwEffect =>
  doWorld({ do: "realign_offer", tag, step: "alliance" });
export const remember = (key: string): GwEffect => ({ kind: "remember", key });
export const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});

export const f = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
export const c = (
  id: string,
  lean: GwLean[],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });

/** The road as the envoy finds it: one line a step (text `road_<step>`). */
export const roadFindings = (tag: GwTag): GwFindingRow[] => [
  f("road_cold", 2, { when: road(tag, { max: 0 }) }),
  f("road_thaw", 3, { when: road(tag, { min: 1, max: 1 }) }),
  f("road_understanding", 3, { when: road(tag, { min: 2, max: 2 }) }),
  f("road_pledge", 3, { when: road(tag, { min: 3, max: 3 }) }),
  f("road_alliance", 3, { when: road(tag, { min: 4 }) }),
  // A hopeful head reads the other side as sincere: the hindsight line once
  // the road falls back under the understanding (text `hindsight.sincere`).
  f("sincere", 1, {
    wrong: true,
    when: road(tag, { min: 2 }),
    truth: road(tag, { min: 2 }),
  }),
];

/**
 * The three peace courses toward a power of the other camp (§5 "papers
 * everywhere"): 선을 잇는다 (a bond), 밀사를 보낸다 (an accord on the table),
 * 조약 초안을 마련하라 (the pledge, then the alliance). Each opens by the road.
 */
export const roadCourses = (
  seat: string,
  tag: GwTag,
  kind: GwAccordKind,
  /** What 선을 잇는다 moves where the pair has no bond (trust instead). */
  line: GwEffect = bond(tag, 1),
): GwCourseRow[] => {
  const feeler = remember(`${seat}_road_feeler`);
  return [
    c("road_line", ["gentle", "calm"], [line, feeler], {
      when: all(peace, road(tag, { max: 1 })),
    }),
    c("road_envoy", ["bold", "cheap"], [accord(kind, tag), feeler], {
      when: all(peace, road(tag, { min: 1, max: 2 })),
      needs: [{ kind: "person" }],
    }),
    c("road_draft", ["bold", "firm"], [pledge(tag)], {
      when: all(peace, road(tag, { min: 2, max: 2 })),
    }),
    c("road_draft_alliance", ["bold"], [alliance(tag)], {
      when: all(peace, road(tag, { min: 3 })),
    }),
  ];
};

/** A target in a pledge row: open from the understanding, in peace. */
export const pledgeTo = (tag: GwTag): GwPowerOption => ({
  id: tag,
  when: road(tag, { min: 2 }),
  effects: [pledge(tag)],
});

/**
 * A target in an alliance row: in peace from the pledge; in the war only an
 * enemy, and only while the country may change sides (Alignment.canSwitch).
 */
export const allyWith = (tag: GwTag): GwPowerOption => ({
  id: tag,
  when: any(all(peace, road(tag, { min: 3 })), all(war, atWar(tag), switchCan)),
  effects: [alliance(tag)],
});

/** Some target in the list is open (the row's gate). */
export const someOpen = (opts: readonly GwPowerOption[]): GwCond =>
  any(...opts.map((o) => o.when!));

/** The three diary rows of a seat's roads (text `persona.diary.<id>`). */
/** `prefix`: the seat's diary id prefix (rus_dy, fra_di, auh_dy). */
export const roadDiary = (prefix: string, nation: GwTag): GwDiaryRow[] => {
  const row = (id: string, moment: GwDiaryRow["moment"]): GwDiaryRow => ({
    id: `${prefix}_road_${id}`,
    nation: [nation],
    moment,
  });
  return [
    row("feeler", "road_feeler"),
    row("signed", "road_signed"),
    row("fell", "road_fell"),
  ];
};
