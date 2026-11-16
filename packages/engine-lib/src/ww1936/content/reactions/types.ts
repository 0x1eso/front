// ww229 MR (design ww227 §7): the majors' reactions to the minors' content.
// One ReactionDef per lane, joined after the minors' national content by
// registry.ts's joinReactions, so nothing of it reaches the Imjin War
// (CONTENT_PARTS_BASE) and no earlier index moves. Data only.
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type {
  AiWeight,
  DecisionDef,
  EventDef,
  EventId,
  HistoryBeat,
  OptionDef,
  SpiritDef,
} from "../types";

/**
 * The answers a minor gets to an existing major's demand (an event of the
 * base content): options appended after the event's own (c, d), and AI
 * weights that replace an existing option's (by option id).
 */
export interface EventAnswer {
  event: EventId;
  options?: readonly OptionDef[];
  ai?: Readonly<Record<string, AiWeight>>;
}

export interface ReactionDef {
  /** The lane's name, for messages only. */
  id: string;
  /** The majors' reaction focuses, each in its major's tree. */
  focuses: readonly FocusDef[];
  events: readonly EventDef[];
  decisions: readonly DecisionDef[];
  spirits: readonly SpiritDef[];
  flags: readonly string[];
  /**
   * The historical AI's reaction focuses: a "focus" beat with a `when`
   * waits for its situation, so a major on its history path still answers.
   */
  beats: readonly HistoryBeat[];
  answers: readonly EventAnswer[];
}
