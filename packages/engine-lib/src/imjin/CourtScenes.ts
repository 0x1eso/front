// ww177 P4 (Imjin design §7, lane I4a): the scenes and decisions of
// Joseon's court, the king's flight, the righteous armies and the envoys to
// Ming. The engine (engine/imjin/JoseonMing.ts) opens every scene by the
// game's state, never by date. An option only sets a pick flag (hidden on
// the card), so no result shows before the pick; the engine reads the flag,
// applies the result and sends a result line in words. P6 writes the texts.
import type {
  DecisionDef,
  EventDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { flag, gflag, not } from "../ww1936/content/helpers";

/** The pick flag an option sets: `imjin_pick_<scene>_<option>`. */
export function pickFlag(scene: string, option: string): string {
  return `imjin_pick_${scene}_${option}`;
}

/** Flags the engine keeps on Joseon for scenes, decisions and other lanes. */
export const IMJIN_FLAGS = {
  /** The crown prince's court runs beside the king's. */
  divided: "imjin_court_divided",
  /** At least one righteous army is in the field. */
  bandsOut: "imjin_bands_out",
  /** The court has taken command of the righteous armies. */
  commanded: "imjin_bands_commanded",
  /** Yi Sun-sin holds the Jeolla Left Navy (the sea lanes read it). */
  yiNavy: "imjin_yi_navy",
  /** Gwon Yul holds a command (the land lanes read it). */
  gwonYul: "imjin_gwon_yul",
  /** The admiral was arrested on a double agent's tip (the sea lanes read it). */
  admiralArrested: "imjin_admiral_arrested",
  /** A temple burned (the monks' call can go out). */
  templeBurned: "imjin_temple_burned",
} as const;

/** Global flags other lanes set or read. */
export const IMJIN_GFLAGS = {
  /** Set by the Japan lane: Japan's open demand for passage to Ming. */
  japanDemand: "imjin_japan_demand",
  /** Set by the truce lane: a truce broke (the tip scene may come). */
  truceBroken: "imjin_truce_broken",
  /** Ming is in the war (vanguard). */
  mingIn: "imjin_ming_in",
  /** Ming's relief army has come. */
  mingRelief: "imjin_ming_relief",
  /** Ming's meter fell low after its entry: it wants a way out. */
  mingWeary: "imjin_ming_weary",
} as const;

type Opt = {
  id: string;
  ai: number;
  available?: EventDef["options"][number]["available"];
};

function scene(
  id: string,
  opts: readonly Opt[],
  picture: EventDef["picture"],
  once: EventDef["once"] = "country",
): EventDef {
  return {
    id,
    kind: "country",
    once,
    picture,
    aiDelayDays: [1, 3],
    options: opts.map((o) => ({
      id: o.id,
      effects: [{ kind: "set_flag", flag: pickFlag(id, o.id) }],
      ai: { base: o.ai },
      ...(o.available !== undefined ? { available: o.available } : {}),
    })),
  };
}

const NOT_DIVIDED = not(flag(IMJIN_FLAGS.divided));

/**
 * The scene ids and their options (a is the card's default):
 * - imjin_flight_capital: a flee north, b hold the capital, c flee and
 *   split the court with the crown prince;
 * - imjin_flight_north: a flee to the border, b hold, c split the court
 *   (not when already split);
 * - imjin_flight_border: a hold the border town, b cross the Yalu (the
 *   court in exile on Ming soil);
 * - imjin_court_shift: a hand the rival the chief councillor's seat,
 *   b keep the ministers;
 * - imjin_appoint_yi: a raise him over seniority, b keep the order of rank;
 * - imjin_appoint_gwon: a give him the command, b pass him over;
 * - imjin_double_agent: a order the admiral out, b trust the admiral;
 * - imjin_monks_call: a call the monks to arms, b leave the temples be.
 */
export const IMJIN_COURT_EVENTS: readonly EventDef[] = [
  scene(
    "imjin_flight_capital",
    [
      { id: "a", ai: 50 },
      { id: "b", ai: 25 },
      { id: "c", ai: 25 },
    ],
    "map",
  ),
  scene(
    "imjin_flight_north",
    [
      { id: "a", ai: 50 },
      { id: "b", ai: 30 },
      { id: "c", ai: 20, available: NOT_DIVIDED },
    ],
    "map",
  ),
  scene(
    "imjin_flight_border",
    [
      { id: "a", ai: 70 },
      { id: "b", ai: 30 },
    ],
    "border",
  ),
  scene(
    "imjin_court_shift",
    [
      { id: "a", ai: 50 },
      { id: "b", ai: 50 },
    ],
    "table",
    "never",
  ),
  scene(
    "imjin_appoint_yi",
    [
      { id: "a", ai: 70 },
      { id: "b", ai: 30 },
    ],
    "document",
  ),
  scene(
    "imjin_appoint_gwon",
    [
      { id: "a", ai: 70 },
      { id: "b", ai: 30 },
    ],
    "document",
  ),
  scene(
    "imjin_double_agent",
    [
      { id: "a", ai: 50 },
      { id: "b", ai: 50 },
    ],
    "document",
  ),
  scene(
    "imjin_monks_call",
    [
      { id: "a", ai: 80 },
      { id: "b", ai: 20 },
    ],
    "crowd",
  ),
];

/**
 * Joseon's decisions: an envoy to Ming; command of the righteous armies
 * (the court's authority decides whether the leaders obey); mustering
 * them into the army.
 */
export const IMJIN_COURT_DECISIONS: readonly DecisionDef[] = [
  {
    id: "imjin_envoy_ming",
    category: "diplomacy",
    for: ["JOS"],
    visible: not(gflag(IMJIN_GFLAGS.mingRelief)),
    // ww177 m2: Joseon asks Ming for an army only once Japan has struck;
    // before the war the envoys filled the meter and Ming came in on day one.
    available: { kind: "war_days_ge", days: 1 },
    cost: { pp: 25 },
    cooldownDays: 45,
    effects: [{ kind: "set_flag", flag: pickFlag("envoy", "ming") }],
    ai: {
      base: 20,
      mods: [{ if: { kind: "war_days_ge", days: 1 }, factor: 400 }],
    },
  },
  {
    id: "imjin_command_righteous",
    category: "military",
    for: ["JOS"],
    visible: flag(IMJIN_FLAGS.bandsOut),
    available: not(flag(IMJIN_FLAGS.commanded)),
    cost: { pp: 15 },
    cooldownDays: 30,
    effects: [{ kind: "set_flag", flag: pickFlag("bands", "command") }],
    ai: { base: 40 },
  },
  {
    id: "imjin_muster_righteous",
    category: "military",
    for: ["JOS"],
    visible: flag(IMJIN_FLAGS.bandsOut),
    cooldownDays: 60,
    effects: [{ kind: "set_flag", flag: pickFlag("bands", "muster") }],
    ai: { base: 5 },
  },
];
