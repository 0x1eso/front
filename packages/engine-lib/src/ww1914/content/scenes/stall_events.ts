// Great War 1914 (ww173 phase A): a front that breaks from strain, and the
// conditions every seat's collapse scenes use (scenes/<seat>_stall.ts), so
// the five writer lanes open their scenes on the same states. The engine
// (engine/ww1914/Stalemate.ts) calls the seat's own `<seat>_w_collapse`
// when it is written, else `gw_w_collapse` below. Its four options keep
// these ids, which the engine reads for the front that broke: `sack`,
// `river`, `allies`, `peace`. Text in resources/ww1914/ko/common.war.json.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import {
  type GwCond,
  type GwScene,
  reason,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/** The seat's own end of `theatres` (absent: any) broke within `months`. */
export const collapsed = (theatres?: GwTheatre[], months = 0): GwCond =>
  world(
    theatres === undefined
      ? { is: "collapse", max: months }
      : { is: "collapse", theatre: theatres, max: months },
  );

/** The end facing the seat on `theatres` (absent: any) broke within `months`. */
export const foeCollapsed = (theatres?: GwTheatre[], months = 0): GwCond =>
  world(
    theatres === undefined
      ? { is: "collapse", foe: true, max: months }
      : { is: "collapse", theatre: theatres, foe: true, max: months },
  );

/**
 * Scenes only the engine calls on a collapse: the plain card and each seat's
 * own (Stalemate.collapse picks `<seat>_w_collapse` when it is written).
 */
export const GW_STALL_CALLED: readonly string[] = [
  "gw_w_collapse",
  ...["deu", "gbr", "auh", "rus", "fra"].map((x) => `${x}_w_collapse`),
];

/**
 * Scenes only the engine calls on a great offensive (Offensives.callScene
 * lays `<seat>_w_off_<key>` when the seat has written it): the plan, each
 * round's result, an enemy offensive met, the army's refusal.
 */
export const GW_OFFENSIVE_CALLED: readonly string[] = [
  "deu",
  "gbr",
  "auh",
  "rus",
  "fra",
].flatMap((x) =>
  ["prep", "result", "defended", "mutiny"].map((k) => `${x}_w_off_${k}`),
);

const cmd = role("cmd");

/**
 * The plain card for any seat whose end broke: the commander there, or the
 * chief of staff, at the table. No option shows its result before the pick.
 */
export const STALL_SCENES: readonly GwScene[] = [
  {
    id: "gw_w_collapse",
    nation: [...GW_TAGS],
    kind: "proposal",
    scheduledOnly: true,
    cast: {
      cmd: {
        any_of: [
          { called: true },
          { office: "chief_of_staff" },
          { office: "war" },
        ],
      },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      { id: "west", when: collapsed(["west", "low_countries"]) },
      { id: "east", when: collapsed(["east", "danube", "dobruja"]) },
      { id: "italy", when: collapsed(["italy", "alps"]) },
      { id: "base" },
    ],
    fallback: "river",
    options: [
      {
        id: "sack",
        tell: [],
        effects: [
          doWorld({ do: "leave", who: cmd }),
          reason("gw_w_collapse_sack"),
        ],
      },
      { id: "river", tell: [], effects: [reason("gw_w_collapse_river")] },
      { id: "allies", tell: [], effects: [reason("gw_w_collapse_allies")] },
      {
        id: "peace",
        tell: [],
        effects: [doWorld({ do: "talks" }), reason("gw_w_collapse_peace")],
      },
    ],
  },
];
