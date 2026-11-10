// Great War 1914 (ww170 S3): filler rows for the odd states the dated desk
// never planned for, so the desk doesn't run dry when the state is unusual: a
// peace that lasts, a seat that stays out of a war the world is fighting, a
// war joined late. Every seat draws them; each comes back after a cooldown.
// Small papers with small effects, no results shown before the pick. Text in
// resources/ww1914/ko/common.filler.json.
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const SEATS: GwScene["nation"] = ["DEU", "GBR", "AUH", "RUS", "FRA"];

// The rows of a state come a month apart, not all on one desk: with one
// cooldown, rows that open together would come together every time and leave
// the months between them quiet (ww170 merge).
/** The seat has never fought and the last crisis is `min` months behind. */
const longPeace = (min: number): GwCond => world({ is: "peace_months", min });
/** The world is at war `min` months; the seat's country stands out of it. */
const neutralInWar = (min: number): GwCond => ({
  kind: "all",
  of: [
    world({ is: "war_months", min }),
    { kind: "not", of: world({ is: "war" }) },
  ],
});
/** The seat's country came into a war that was half a year old. */
const lateWar = (min: number, max: number): GwCond => ({
  kind: "all",
  of: [
    world({ is: "war_months", min: 6 }),
    world({ is: "war_months", own: true, min, max }),
  ],
});

const base = (
  id: string,
  kind: GwScene["kind"],
  when: GwCond,
  tags: GwScene["tags"],
): Omit<GwScene, "options"> => ({
  id,
  nation: SEATS,
  kind,
  stage: ["crisis", "y1914", "war"],
  when,
  cast: {},
  salience: kind === "report" || kind === "wire" ? 2 : 3,
  tags,
  cooldown: 8,
  variants: [{ id: "base" }],
});

export const GW_FILLER_SCENES: readonly GwScene[] = [
  {
    ...base("gw_fill_peace_reserves", "proposal", longPeace(2), ["home"]),
    fallback: "send_home",
    options: [
      {
        id: "keep",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "opinion", bloc: "workers", delta: -1 },
        ],
      },
      {
        id: "send_home",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "workers", delta: 1 },
          { kind: "opinion", bloc: "army", delta: -1 },
        ],
      },
    ],
  },
  base("gw_fill_peace_markets", "report", longPeace(1), ["home"]),
  {
    ...base("gw_fill_peace_spring", "proposal", longPeace(3), ["foreign"]),
    fallback: "wait",
    options: [
      {
        id: "talk",
        tell: [],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "opinion", bloc: "press", delta: 1 },
        ],
      },
      {
        id: "arm",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -1 },
        ],
      },
      { id: "wait", tell: [], effects: [] },
    ],
  },
  {
    ...base("gw_fill_neutral_trade", "proposal", neutralInWar(2), ["foreign"]),
    fallback: "both",
    options: [
      {
        id: "both",
        tell: [],
        effects: [
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "opinion", bloc: "business", delta: 1 },
        ],
      },
      {
        id: "none",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "press", delta: 1 },
          { kind: "opinion", bloc: "business", delta: -1 },
        ],
      },
    ],
  },
  base("gw_fill_neutral_volunteers", "report", neutralInWar(3), ["home"]),
  base("gw_fill_neutral_papers", "wire", neutralInWar(1), ["foreign"]),
  {
    ...base("gw_fill_late_officers", "proposal", lateWar(1, 3), ["war"]),
    fallback: "own_way",
    options: [
      {
        id: "learn",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "army", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
        ],
      },
      {
        id: "own_way",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "army", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: -1 },
        ],
      },
    ],
  },
  base("gw_fill_late_trains", "report", lateWar(0, 1), ["war"]),
];
